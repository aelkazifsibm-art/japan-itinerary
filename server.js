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

// Route pour donner la clé Google au frontend (pour Autocomplete)
app.get('/api/config', (req, res) => {
    res.json({ googleKey: process.env.GOOGLE_MAPS_API_KEY });
});

app.post('/api/route', async (req, res) => {
    try {
        const { from, to, intent, fromPlaceId, toPlaceId } = req.body;
        if (!from || (!to && !intent)) return res.status(400).json({ error: "Manque l'origine, l'arrivée ou l'intention" });

        let origin = fromPlaceId ? `place_id:${fromPlaceId}` : from;
        let destination = toPlaceId ? `place_id:${toPlaceId}` : to;

        // 1. IA : Si l'arrivée n'est pas précisée (ni texte ni Place ID), on utilise l'intention
        if (!destination && intent) {
            const aiResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { 
                        role: "system", 
                        content: "Tu es un expert du Japon. Convertis l'intention de l'utilisateur en un lieu réel, précis et connu par Google Maps (nom du lieu + ville + Japon). Réponds UNIQUEMENT le nom du lieu le plus pertinent." 
                    },
                    { role: "user", content: intent }
                ]
            });
            const placeQuery = aiResponse.choices[0].message.content.trim();
            destination = placeQuery;
            console.log(`Intention: "${intent}" -> Lieu trouvé: "${placeQuery}"`);
        } else {
            console.log(`Utilisation de la destination fournie: "${destination}"`);
        }

        // 2. Google Directions (Transit)
        const googleKey = process.env.GOOGLE_MAPS_API_KEY;
        const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=transit&language=fr&region=JP&key=${googleKey}`;
        
        const dirResp = await fetch(dirUrl);
        const dirData = await dirResp.json();

        if (dirData.status !== "OK" || !dirData.routes[0]) {
            console.error("Erreur Google Directions:", dirData.status, dirData.error_message || "Aucune route trouvée");
            return res.status(404).json({ 
                error: "Aucun itinéraire trouvé", 
                details: dirData.status,
                place: destination 
            });
        }

        const leg = dirData.routes[0].legs[0];
        const totalMinutes = Math.round(leg.duration.value / 60);
        const arrival = leg.arrival_time ? leg.arrival_time.text : "Inconnue";
        
        const transitSteps = leg.steps.filter(s => s.travel_mode === "TRANSIT");
        const walkSeconds = leg.steps
            .filter(s => s.travel_mode === "WALKING")
            .reduce((acc, s) => acc + s.duration.value, 0);

        // Si aucun transport en commun n'est trouvé dans les étapes, on l'indique
        const transitInfo = transitSteps.length > 0 
            ? `🚇 ${totalMinutes} min (${Math.max(0, transitSteps.length - 1)} corresp.)`
            : `🚗 ${totalMinutes} min (Pas de transit direct)`;

        const result = {
            lines: [
                transitInfo,
                `🚶 ${Math.round(walkSeconds / 60)} min marche`,
                `⏱️ Arrivée: ${arrival} ✅`
            ]
        };

        res.json(result);

    } catch (error) {
        console.error("Erreur Serveur:", error);
        res.status(500).json({ 
            error: "Erreur interne du serveur", 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

app.listen(port, () => {
    console.log(`✅ Serveur Japan Route Engine lancé sur http://localhost:${port}`);
});
