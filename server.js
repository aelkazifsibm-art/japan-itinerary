import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.get('/api/config', (req, res) => {
    res.json({ googleKey: process.env.GOOGLE_MAPS_API_KEY });
});

app.post('/api/route', async (req, res) => {
    try {
        const { from, to, intent, fromPlaceId, toPlaceId, mode } = req.body;
        const googleKey = process.env.GOOGLE_MAPS_API_KEY;

        // 1. Déterminer la destination finale
        let finalDest = to;
        if (!to && intent) {
            const aiDest = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Tu es un expert du Japon. Convertis l'intention en un lieu précis (Nom + Ville + Japon). Réponds uniquement le nom." },
                    { role: "user", content: intent }
                ]
            });
            finalDest = aiDest.choices[0].message.content.trim();
        }

        // 2. Logique selon le mode
        if (mode === 'walk') {
            // Mode PIED uniquement via Google Maps
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(finalDest)}&mode=walking&language=fr&key=${googleKey}`;
            const resp = await fetch(url);
            const data = await resp.json();

            if (data.status === "OK") {
                const leg = data.routes[0].legs[0];
                return res.json({
                    success: true,
                    summary: `🚶 ${leg.duration.text} de marche`,
                    details: `Itinéraire direct à pied de ${leg.start_address} à ${leg.end_address}.`,
                    arrival: new Date(Date.now() + leg.duration.value * 1000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
                });
            }
        }

        // Mode OPTIMAL (Hybride IA + Google Maps)
        // Priorité 1: utiliser Google Maps pour les directions de transit
        const now = Math.floor(Date.now() / 1000);
        let googleMapsTransitUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(finalDest)}&mode=transit&departure_time=${now}&language=fr&region=JP&key=${googleKey}`;
        
        let directionData = await fetch(googleMapsTransitUrl);
        let directionResponse = await directionData.json();

        if (directionResponse.status === "OK" && directionResponse.routes && directionResponse.routes.length > 0) {
            const route = directionResponse.routes[0];
            const leg = route.legs[0];
            
            let stepsDescription = "";
            if (leg.steps && leg.steps.length > 0) {
                stepsDescription = leg.steps.map((step, index) => {
                    if (step.transit_details) {
                        const transit = step.transit_details;
                        const lineName = transit.line.short_name || transit.line.name || "Ligne";
                        const departure = transit.departure_stop.name;
                        const arrival = transit.arrival_stop.name;
                        const duration = step.duration.text;
                        return `${index + 1}. Prendre ${lineName} de ${departure} à ${arrival} (${duration})`;
                    } else {
                        return `${index + 1}. Marcher vers ${step.html_instructions.replace(/<[^>]*>/g, '')} (${step.duration.text})`;
                    }
                }).join('\n');
            }

            return res.json({
                success: true,
                summary: `🚇 ${leg.duration.text}`,
                details: stepsDescription || leg.summary,
                arrival: new Date(Date.now() + leg.duration.value * 1000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
            });
        }

        // Priorité 2: Si Google Maps transit échoue, essayer Google Maps walking
        console.log(`Google Maps transit échoué (${directionResponse.status}), tentative de marche...`);
        let googleMapsWalkingUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(finalDest)}&mode=walking&language=fr&key=${googleKey}`;
        
        directionData = await fetch(googleMapsWalkingUrl);
        directionResponse = await directionData.json();

        if (directionResponse.status === "OK" && directionResponse.routes && directionResponse.routes.length > 0) {
            const leg = directionResponse.routes[0].legs[0];
            return res.json({
                success: true,
                summary: `🚶 ${leg.duration.text} de marche`,
                details: `Itinéraire direct à pied de ${leg.start_address} à ${leg.end_address}.`,
                arrival: new Date(Date.now() + leg.duration.value * 1000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
            });
        }

        // Fallback: Si Google Maps (transit et marche) échoue, utiliser l'IA pour générer un itinéraire
        console.log(`Google Maps marche échoué (${directionResponse.status}), utilisation de l'IA comme fallback...`);
        
        const aiRoute = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: `Tu es un expert en transports au Japon. 
                    Calcule un itinéraire optimal entre le départ et l'arrivée.
                    Format de réponse JSON strict :
                    {
                        "summary": "Résumé court (ex: 🚇 45 min, 1 corresp.)",
                        "steps": "Liste détaillée des étapes (ex: Prendre la ligne Yamanote de X à Y...)",
                        "total_transit_minutes": nombre,
                        "walking_segments": [{"from": "...", "to": "..."}]
                    }`
                },
                { role: "user", content: `De : ${from} À : ${finalDest}. Privilégie le métro et le train.` }
            ],
            response_format: { type: "json_object" }
        });

        const routeData = JSON.parse(aiRoute.choices[0].message.content);
        
        // Calculer le temps de marche réel pour les segments identifiés par l'IA
        let totalWalkingMinutes = 0;
        if (routeData.walking_segments && routeData.walking_segments.length > 0) {
            for (const segment of routeData.walking_segments) {
                const walkUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(segment.from)}&destination=${encodeURIComponent(segment.to)}&mode=walking&key=${googleKey}`;
                const wResp = await fetch(walkUrl);
                const wData = await wResp.json();
                if (wData.status === "OK") {
                    totalWalkingMinutes += Math.round(wData.routes[0].legs[0].duration.value / 60);
                } else {
                    totalWalkingMinutes += 10; // Fallback
                }
            }
        }

        const totalTime = routeData.total_transit_minutes + totalWalkingMinutes;
        
        res.json({
            success: true,
            summary: `🚇 ${totalTime} min (Hybride IA - Fallback)`,
            details: `${routeData.steps}\n\n(Marche estimée via Google Maps : ${totalWalkingMinutes} min)`,
            arrival: new Date(Date.now() + totalTime * 60000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Erreur serveur", message: error.message });
    }
});

app.listen(port, () => console.log(`✅ Serveur prêt sur http://localhost:${port}`));
