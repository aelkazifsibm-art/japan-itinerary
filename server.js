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
    // Clé browser uniquement pour l'Autocomplete
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

// Health check pour valider les clés Google Server
app.get("/api/health", async (req, res) => {
    try {
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const testPlaceId = "ChIJ51cu8IcbXWARiRtXIothAS4"; // Tokyo Station
        
        const placeUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        placeUrl.searchParams.set("place_id", testPlaceId);
        placeUrl.searchParams.set("fields", "place_id,name,geometry");
        placeUrl.searchParams.set("key", serverKey);
        const p = await fetchJson(placeUrl.toString());

        const dirUrl = new URL("https://maps.googleapis.com/maps/api/directions/json");
        dirUrl.searchParams.set("origin", "place_id:ChIJ51cu8IcbXWARiRtXIothAS4");
        dirUrl.searchParams.set("destination", "place_id:ChIJyZB3m7uMGGARvGd2dF5QdU0");
        dirUrl.searchParams.set("mode", "transit");
        dirUrl.searchParams.set("key", serverKey);
        const d = await fetchJson(dirUrl.toString());

        const out = {
            env: {
                GOOGLE_MAPS_BROWSER_KEY: !!process.env.GOOGLE_MAPS_BROWSER_KEY,
                GOOGLE_MAPS_SERVER_KEY: !!process.env.GOOGLE_MAPS_SERVER_KEY
            },
            places: { ok: p.json?.status === "OK", status: p.json?.status },
            directions: { ok: d.json?.status === "OK", status: d.json?.status }
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

        // 1. Si intention IA, on trouve un lieu
        if (!to && intent) {
            const aiDest = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Expert Japon. Convertis l'intention en un lieu précis (Nom + Ville + Japon). Réponds uniquement le nom." },
                    { role: "user", content: intent }
                ]
            });
            const placeName = aiDest.choices[0].message.content.trim();
            
            // Trouver le place_id pour ce lieu
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

        // 2. Obtenir les détails (coordonnées pour OSRM)
        const getDetails = async (placeId) => {
            const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            u.searchParams.set("place_id", placeId);
            u.searchParams.set("fields", "geometry,name,formatted_address");
            u.searchParams.set("key", serverKey);
            return fetchJson(u.toString());
        };

        const p1 = await getDetails(from.id);
        const p2 = await getDetails(to.id);

        if (p1.json?.status !== "OK" || p2.json?.status !== "OK") throw new Error("Erreur lors de la récupération des lieux.");

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

        // 4. Mode Transit (Google Directions)
        const dirUrl = new URL("https://maps.googleapis.com/maps/api/directions/json");
        dirUrl.searchParams.set("origin", `place_id:${from.id}`);
        dirUrl.searchParams.set("destination", `place_id:${to.id}`);
        dirUrl.searchParams.set("mode", "transit");
        dirUrl.searchParams.set("language", "fr");
        dirUrl.searchParams.set("key", serverKey);

        const d = await fetchJson(dirUrl.toString());
        if (d.json?.status !== "OK") throw new Error(`Directions API error: ${d.json?.status}`);

        const leg = d.json.routes[0].legs[0];
        const totalMinutes = Math.round((leg.duration?.value || 0) / 60);
        
        // Calculer les segments de marche via OSRM pour plus de précision/gratuité si besoin
        // Ici on garde le résumé Google mais on pourrait injecter OSRM
        
        res.json({
            success: true,
            summary: `🚇 ${totalMinutes} min (${leg.arrival_time?.text || ""})`,
            details: leg.steps.map(s => s.html_instructions.replace(/<[^>]*>?/gm, '')).join('\n'),
            arrival: leg.arrival_time?.text || "Arrivée estimée"
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(port, () => console.log(`✅ Serveur prêt sur http://localhost:${port}`));
