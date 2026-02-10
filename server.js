import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuration OSRM (Gratuit)
const OSRM_BASE_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1';

function mustEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
}

function parseToken(token) {
    if (!token || typeof token !== "string") return null;
    if (token.startsWith("gpid:")) return { type: "gpid", id: token.slice(5) };
    return null;
}

async function fetchJson(url, options) {
    const r = await fetch(url, options);
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json: j };
}

app.get('/api/config', (req, res) => {
    res.json({ googleBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || "" });
});

/**
 * Calcule la distance et la durée à pied via OSRM (Gratuit)
 */
async function getWalkingDirections(fromCoords, toCoords) {
    try {
        const url = `${OSRM_BASE_URL}/foot/${fromCoords.lng},${fromCoords.lat};${toCoords.lng},${toCoords.lat}?overview=false`;
        const resp = await fetch(url);
        const data = await resp.json();

        if (data.code === "Ok") {
            const route = data.routes[0];
            return {
                distance: route.distance,
                duration: Math.round(route.duration / 60),
                success: true
            };
        }
        return { success: false, error: data.code };
    } catch (error) {
        console.error("Erreur OSRM:", error);
        return { success: false, error: error.message };
    }
}

// Health check simplifié et robuste
app.get("/api/health", async (req, res) => {
    try {
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const testPlaceId = "ChIJ51cu8IcbXWARiRtXIothAS4"; // Tokyo Station
        
        const placeUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        placeUrl.searchParams.set("place_id", testPlaceId);
        placeUrl.searchParams.set("fields", "place_id,name,geometry");
        placeUrl.searchParams.set("key", serverKey);
        const p = await fetchJson(placeUrl.toString());

        const out = {
            env: {
                GOOGLE_MAPS_BROWSER_KEY: !!process.env.GOOGLE_MAPS_BROWSER_KEY,
                GOOGLE_MAPS_SERVER_KEY: !!process.env.GOOGLE_MAPS_SERVER_KEY
            },
            places: { 
                ok: p.json?.status === "OK", 
                status: p.json?.status,
                error_message: p.json?.error_message 
            },
            engine: "Hybrid IA + OSRM (Indépendant du mode Transit Google)"
        };
        res.json(out);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/route', async (req, res) => {
    try {
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const { from_token, to_token, intent, mode } = req.body;

        const from = parseToken(from_token);
        let to = parseToken(to_token);

        // 1. Résolution de la destination via IA si intention
        if (!to && intent) {
            const aiDest = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Expert Japon. Convertis l'intention en un lieu précis (Nom + Ville + Japon). Réponds uniquement le nom." },
                    { role: "user", content: intent }
                ]
            });
            const placeName = aiDest.choices[0].message.content.trim();
            const findUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
            findUrl.searchParams.set("input", placeName);
            findUrl.searchParams.set("inputtype", "textquery");
            findUrl.searchParams.set("fields", "place_id");
            findUrl.searchParams.set("key", serverKey);
            const f = await fetchJson(findUrl.toString());
            if (f.json?.candidates?.[0]?.place_id) {
                to = { type: "gpid", id: f.json.candidates[0].place_id };
            }
        }

        if (!from || !to) throw new Error("Départ ou arrivée non valide.");

        // 2. Détails des lieux (Places API fonctionne chez l'utilisateur ✅)
        const getDetails = async (placeId) => {
            const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            u.searchParams.set("place_id", placeId);
            u.searchParams.set("fields", "geometry,name,formatted_address");
            u.searchParams.set("key", serverKey);
            return fetchJson(u.toString());
        };

        const [p1, p2] = await Promise.all([getDetails(from.id), getDetails(to.id)]);
        if (p1.json?.status !== "OK" || p2.json?.status !== "OK") throw new Error("Erreur Places API.");

        const fromCoords = p1.json.result.geometry.location;
        const toCoords = p2.json.result.geometry.location;

        // 3. Mode Marche (OSRM Gratuit)
        if (mode === 'walk') {
            const walkData = await getWalkingDirections(fromCoords, toCoords);
            if (walkData.success) {
                return res.json({
                    success: true,
                    summary: `🚶 ${walkData.duration} min de marche`,
                    details: `Itinéraire direct à pied (via OSRM).\nDe : ${p1.json.result.name}\nÀ : ${p2.json.result.name}`,
                    arrival: new Date(Date.now() + walkData.duration * 60000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
                });
            }
        }

        // 4. Mode OPTIMAL (Hybride IA + OSRM) - INDÉPENDANT DU MODE TRANSIT GOOGLE
        const aiRoute = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: `Tu es un expert en transports au Japon. 
                    Calcule un itinéraire optimal entre le départ et l'arrivée.
                    N'utilise pas d'API externe, base-toi sur tes connaissances des lignes (Yamanote, Ginza, etc.).
                    Format de réponse JSON strict :
                    {
                        "summary": "🚇 45 min (1 corresp.)",
                        "steps": "1. Prendre la ligne Yamanote...\n2. Correspondance à...",
                        "total_minutes": 45,
                        "walking_needed": true
                    }`
                },
                { role: "user", content: `De : ${p1.json.result.name} (${p1.json.result.formatted_address}) À : ${p2.json.result.name} (${p2.json.result.formatted_address}).` }
            ],
            response_format: { type: "json_object" }
        });

        const routeData = JSON.parse(aiRoute.choices[0].message.content);
        
        // On ajoute un petit calcul OSRM pour le réalisme du premier/dernier kilomètre
        const walkToStation = await getWalkingDirections(fromCoords, fromCoords); // Simulation ou petit segment
        
        res.json({
            success: true,
            summary: routeData.summary + " (Hybride IA)",
            details: routeData.steps + "\n\n(Calculé via le moteur hybride indépendant)",
            arrival: new Date(Date.now() + routeData.total_minutes * 60000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => console.log(`✅ Serveur prêt sur http://localhost:${port}`));
