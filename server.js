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

        // On garde les noms textuels bruts pour le fallback
        const rawFrom = from;
        let rawTo = to;

        // 1. IA : Si l'arrivée n'est pas précisée (ni texte ni Place ID), on utilise l'intention
        if (!to && !toPlaceId && intent) {
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
            rawTo = aiResponse.choices[0].message.content.trim();
            console.log(`Intention: "${intent}" -> Lieu trouvé: "${rawTo}"`);
        }

        let origin = fromPlaceId ? `place_id:${fromPlaceId}` : rawFrom;
        let destination = toPlaceId ? `place_id:${toPlaceId}` : rawTo;

        // 2. Google Directions
        const googleKey = process.env.GOOGLE_MAPS_API_KEY;
        const now = Math.floor(Date.now() / 1000);
        
        const getDirections = async (orig, dest, mode = 'transit') => {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(orig)}&destination=${encodeURIComponent(dest)}&mode=${mode}&departure_time=${now}&language=fr&region=JP&key=${googleKey}`;
            const resp = await fetch(url);
            return await resp.json();
        };

        // Première tentative : Transit avec Place IDs (si disponibles)
        let dirData = await getDirections(origin, destination, 'transit');
        console.log(`Tentative 1 (Transit, PlaceID): ${dirData.status}`);

        // STRATÉGIE DE REPLI (FALLBACK)
        
        // Étape A : Si échec avec Place ID (ZERO_RESULTS, NOT_FOUND, etc.), on tente avec le texte brut
        const hasPlaceId = origin.startsWith('place_id:') || destination.startsWith('place_id:');
        if (dirData.status !== "OK" && hasPlaceId) {
            console.log(`Échec avec Place ID (${dirData.status}), basculement vers texte brut...`);
            origin = rawFrom;
            destination = rawTo;
            dirData = await getDirections(origin, destination, 'transit');
            console.log(`Tentative 2 (Transit, Texte): ${dirData.status}`);
        }

        // Étape B : Si toujours ZERO_RESULTS (limitation transit au Japon), on tente Driving
        if (dirData.status === "ZERO_RESULTS") {
            console.log("Transit non disponible (ZERO_RESULTS), tentative en mode Driving...");
            dirData = await getDirections(origin, destination, 'driving');
            console.log(`Tentative 3 (Driving): ${dirData.status}`);
            
            if (dirData.status === "OK") {
                dirData.is_fallback_driving = true;
            }
        }

        // Vérification finale
        if (dirData.status !== "OK" || !dirData.routes[0]) {
            console.error("Erreur Google Directions finale:", dirData.status);
            return res.status(404).json({ 
                error: "Aucun itinéraire trouvé", 
                details: dirData.status,
                message: "L'API Google Maps n'a pas pu trouver de route. Essayez d'être plus précis (ex: 'Tokyo Station' au lieu de 'Tokyo')."
            });
        }

        const leg = dirData.routes[0].legs[0];
        const totalMinutes = Math.round(leg.duration.value / 60);
        const arrival = leg.arrival_time ? leg.arrival_time.text : "Calculée via durée";
        
        const transitSteps = leg.steps.filter(s => s.travel_mode === "TRANSIT");
        const walkSeconds = leg.steps
            .filter(s => s.travel_mode === "WALKING")
            .reduce((acc, s) => acc + s.duration.value, 0);

        // Construction de la réponse
        let transitInfo;
        if (dirData.is_fallback_driving) {
            transitInfo = `🚗 ~${totalMinutes} min (Mode voiture - Transit API indisponible)`;
        } else {
            transitInfo = `🚇 ${totalMinutes} min (${Math.max(0, transitSteps.length - 1)} corresp.)`;
        }

        const result = {
            lines: [
                transitInfo,
                `🚶 ${Math.round(walkSeconds / 60)} min marche estimée`,
                `⏱️ Arrivée estimée: ${arrival} ✅`
            ]
        };

        res.json(result);

    } catch (error) {
        console.error("Erreur Serveur:", error);
        res.status(500).json({ 
            error: "Erreur interne du serveur", 
            message: error.message
        });
    }
});

app.listen(port, () => {
    console.log(`✅ Serveur Japan Route Engine lancé sur http://localhost:${port}`);
});
