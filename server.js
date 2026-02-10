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
        return { success: false, error: error.message };
    }
}

/**
 * Trouve les stations et arrêts de bus à proximité via Google Places
 */
async function getNearbyTransit(coords, serverKey) {
    try {
        const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
        url.searchParams.set("location", `${coords.lat},${coords.lng}`);
        url.searchParams.set("radius", "1000"); // 1km pour être précis
        url.searchParams.set("type", "transit_station");
        url.searchParams.set("key", serverKey);
        
        const resp = await fetchJson(url.toString());
        if (resp.json?.status === "OK") {
            return resp.json.results.slice(0, 8).map(r => ({
                name: r.name,
                coords: r.geometry.location,
                vicinity: r.vicinity,
                types: r.types
            }));
        }
        return [];
    } catch (e) {
        return [];
    }
}

app.get('/api/config', (req, res) => {
    res.json({ googleBrowserKey: process.env.GOOGLE_MAPS_BROWSER_KEY || "" });
});

app.get("/api/health", async (req, res) => {
    try {
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const testPlaceId = "ChIJ51cu8IcbXWARiRtXIothAS4";
        const placeUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        placeUrl.searchParams.set("place_id", testPlaceId);
        placeUrl.searchParams.set("fields", "place_id,name,geometry");
        placeUrl.searchParams.set("key", serverKey);
        const p = await fetchJson(placeUrl.toString());

        res.json({
            env: {
                GOOGLE_MAPS_BROWSER_KEY: !!process.env.GOOGLE_MAPS_BROWSER_KEY,
                GOOGLE_MAPS_SERVER_KEY: !!process.env.GOOGLE_MAPS_SERVER_KEY
            },
            places: { ok: p.json?.status === "OK", status: p.json?.status },
            engine: "Protocol V4 Hybrid (Scan -> Matrix -> Assembly)"
        });
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

        // 1. Résolution destination
        if (!to && intent) {
            const aiDest = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Expert Japon. Convertis l'intention en un lieu précis. Réponds uniquement le nom." },
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

        // 2. Détails des lieux
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

        // 3. PROTOCOLE ÉTAPE 1 : SCAN DE PROXIMITÉ
        const [rawStationsFrom, rawStationsTo] = await Promise.all([
            getNearbyTransit(fromCoords, serverKey),
            getNearbyTransit(toCoords, serverKey)
        ]);

        // 4. PROTOCOLE ÉTAPE 2 : MATRICE DE MARCHE (OSRM)
        const matrixFrom = await Promise.all(rawStationsFrom.map(async s => {
            const w = await getWalkingDirections(fromCoords, s.coords);
            return { ...s, walk_min: w.success ? w.duration : 999 };
        }));
        const matrixTo = await Promise.all(rawStationsTo.map(async s => {
            const w = await getWalkingDirections(toCoords, s.coords);
            return { ...s, walk_min: w.success ? w.duration : 999 };
        }));

        // Trier par proximité réelle
        matrixFrom.sort((a, b) => a.walk_min - b.walk_min);
        matrixTo.sort((a, b) => a.walk_min - b.walk_min);

        // 5. PROTOCOLE ÉTAPE 3 : ASSEMBLAGE LOGIQUE (IA SOUS CONTRAINTE)
        const aiRoute = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: `Tu es un expert en transports au Japon. 
                    Tu dois calculer un itinéraire en respectant strictement les données de proximité fournies.
                    
                    DONNÉES RÉELLES DE DÉPART (Triées par marche à pied) :
                    ${matrixFrom.map(s => `- ${s.name} : ${s.walk_min} min de marche`).join('\n')}
                    
                    DONNÉES RÉELLES D'ARRIVÉE :
                    ${matrixTo.map(s => `- ${s.name} : ${s.walk_min} min de marche`).join('\n')}
                    
                    CONSIGNES :
                    1. Choisis le point de départ le plus proche et le plus logique (souvent un arrêt de bus si l'adresse est excentrée).
                    2. Utilise les lignes réelles (ex: Bus South 2 à Kyoto, Ligne Yamanote à Tokyo).
                    3. Calcule le temps total incluant la marche.
                    
                    Format JSON :
                    {
                        "summary": "🚇 52 min (1 corresp.)",
                        "steps": "1. Marcher vers [Nom Station] ([X] min)\n2. Prendre [Ligne] vers...",
                        "total_minutes": 52
                    }`
                },
                { role: "user", content: `De : ${p1.json.result.name} À : ${p2.json.result.name}.` }
            ],
            response_format: { type: "json_object" }
        });

        const routeData = JSON.parse(aiRoute.choices[0].message.content);
        
        res.json({
            success: true,
            summary: routeData.summary + " (Protocol V4 Hybrid)",
            details: routeData.steps + "\n\n(Vérifié par scan de proximité Google + OSRM)",
            arrival: new Date(Date.now() + routeData.total_minutes * 60000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => console.log(`✅ Serveur prêt sur http://localhost:${port}`));
