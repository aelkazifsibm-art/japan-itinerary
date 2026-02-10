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
        const { from, intent } = req.body;
        if (!from || !intent) return res.status(400).json({ error: "Manque l'origine ou l'intention" });

        // 1. IA : Intention -> Lieu précis
        const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Utilisation du modèle o-mini plus robuste
            messages: [
                { 
                    role: "system", 
                    content: "Tu es un expert du Japon. Convertis l'intention de l'utilisateur en un lieu réel et précis (nom du lieu + ville + Japon). Réponds UNIQUEMENT le nom du lieu." 
                },
                { role: "user", content: intent }
            ]
        });
        const placeQuery = aiResponse.choices[0].message.content.trim();
        console.log(`Intention: "${intent}" -> Lieu trouvé: "${placeQuery}"`);

        // 2. Google Directions (Transit)
        const googleKey = process.env.GOOGLE_MAPS_API_KEY;
        const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(placeQuery)}&mode=transit&language=fr&region=JP&key=${googleKey}`;
        
        const dirResp = await fetch(dirUrl);
        const dirData = await dirResp.json();

        if (dirData.status !== "OK" || !dirData.routes[0]) {
            console.error("Erreur Google Directions:", dirData.status, dirData.error_message);
            return res.status(404).json({ error: "Aucun itinéraire trouvé" });
        }

        const leg = dirData.routes[0].legs[0];
        const totalMinutes = Math.round(leg.duration.value / 60);
        const arrival = leg.arrival_time ? leg.arrival_time.text : "Inconnue";
        
        const transitSteps = leg.steps.filter(s => s.travel_mode === "TRANSIT");
        const walkSeconds = leg.steps
            .filter(s => s.travel_mode === "WALKING")
            .reduce((acc, s) => acc + s.duration.value, 0);

        const result = {
            lines: [
                `🚇 ${totalMinutes} min (${Math.max(0, transitSteps.length - 1)} corresp.)`,
                `🚶 ${Math.round(walkSeconds / 60)} min marche`,
                `⏱️ Arrivée: ${arrival} ✅`
            ]
        };

        res.json(result);

    } catch (error) {
        console.error("Erreur Serveur:", error);
        res.status(500).json({ error: "Erreur interne du serveur" });
    }
});

app.listen(port, () => {
    console.log(`✅ Serveur Japan Route Engine lancé sur http://localhost:${port}`);
});
