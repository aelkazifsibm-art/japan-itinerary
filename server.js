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
        // L'IA génère le plan de transport
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
            summary: `🚇 ${totalTime} min (Hybride IA)`,
            details: `${routeData.steps}\n\n(Marche estimée via Google Maps : ${totalWalkingMinutes} min)`,
            arrival: new Date(Date.now() + totalTime * 60000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: "Erreur serveur", message: error.message });
    }
});

app.listen(port, () => console.log(`✅ Serveur prêt sur http://localhost:${port}`));
