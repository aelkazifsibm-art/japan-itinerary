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

// PROTOCOLE TRANSIT SAFE TIME V1
const CONFIG_SAFE_TIME = {
    BUFFER_DEPART_MIN: 7,
    COEFF_REALITE_JAPON: 1.25,
    ARRONDI_MULTIPLE: 5
};

function mustEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
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
            return { distance: route.distance, duration: Math.round(route.duration / 60), success: true };
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
        url.searchParams.set("radius", "1000");
        url.searchParams.set("type", "transit_station");
        url.searchParams.set("key", serverKey);
        const resp = await fetchJson(url.toString());
        if (resp.json?.status === "OK") {
            return resp.json.results.slice(0, 8).map(r => ({
                name: r.name,
                coords: r.geometry.location,
                types: r.types
            }));
        }
        return [];
    } catch (e) {
        return [];
    }
}

// --- 1️⃣ PHASE IA : NORMALISATION TEXTE ---
app.post("/api/normalize-text", async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ error: "Texte manquant" });

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: `Tu es un expert en voyages au Japon. 
                    Normalise l'entrée utilisateur pour en faire un titre propre et suggérer un lieu Google Maps.
                    Format JSON strict :
                    {
                        "title_clean": "Nom Propre — description courte",
                        "suggested_location": "Nom du lieu, Ville, Japan"
                    }`
                },
                { role: "user", content: text }
            ],
            response_format: { type: "json_object" }
        });

        res.json(JSON.parse(completion.choices[0].message.content));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- 2️⃣ PHASE VALIDATION GOOGLE PLACES ---
app.get("/api/places/autocomplete", async (req, res) => {
    try {
        const key = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const q = String(req.query.q || "").trim();
        if (q.length < 2) return res.json({ predictions: [] });

        const u = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
        u.searchParams.set("input", q);
        u.searchParams.set("region", "jp");
        u.searchParams.set("language", "fr");
        u.searchParams.set("key", key);

        const r = await fetchJson(u.toString());
        res.json({ status: r.json.status, predictions: r.json.predictions || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/places/details", async (req, res) => {
    try {
        const key = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const placeId = String(req.query.place_id || "").trim();
        if (!placeId) return res.status(400).json({ ok: false, error: "missing place_id" });

        const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        u.searchParams.set("place_id", placeId);
        u.searchParams.set("fields", "place_id,name,formatted_address,geometry");
        u.searchParams.set("language", "fr");
        u.searchParams.set("key", key);

        const r = await fetchJson(u.toString());
        if (r.json.status !== "OK") return res.json({ ok: false, status: r.json.status });

        const p = r.json.result;
        res.json({
            ok: true,
            place: {
                place_id: p.place_id,
                name: p.name,
                formatted_address: p.formatted_address,
                lat: p.geometry?.location?.lat,
                lng: p.geometry?.location?.lng
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- 3️⃣ GÉNÉRATION NAVIGATION (ENTRE ACTIVITÉS) ---
app.post('/api/route', async (req, res) => {
    try {
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const { from_place, to_place } = req.body;

        if (!from_place?.place_id || !to_place?.place_id) {
            throw new Error("Place IDs manquants pour le calcul.");
        }

        const fromCoords = { lat: from_place.lat, lng: from_place.lng };
        const toCoords = { lat: to_place.lat, lng: to_place.lng };

        // SCAN & MATRICE
        const [rawStationsFrom, rawStationsTo] = await Promise.all([
            getNearbyTransit(fromCoords, serverKey),
            getNearbyTransit(toCoords, serverKey)
        ]);

        const matrixFrom = await Promise.all(rawStationsFrom.map(async s => {
            const w = await getWalkingDirections(fromCoords, s.coords);
            return { ...s, walk_min: w.success ? w.duration : 999 };
        }));
        const matrixTo = await Promise.all(rawStationsTo.map(async s => {
            const w = await getWalkingDirections(toCoords, s.coords);
            return { ...s, walk_min: w.success ? w.duration : 999 };
        }));

        matrixFrom.sort((a, b) => a.walk_min - b.walk_min);
        matrixTo.sort((a, b) => a.walk_min - b.walk_min);

        // IA ASSEMBLAGE
        const aiRoute = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: `Tu es un expert en transports au Japon. 
                    Calcule un itinéraire réaliste (Protocol Transit Safe Time v1).
                    
                    DÉPART : ${from_place.name}
                    STATIONS PROCHES DÉPART : ${matrixFrom.map(s => `${s.name} (${s.walk_min}m)`).join(', ')}
                    
                    ARRIVÉE : ${to_place.name}
                    STATIONS PROCHES ARRIVÉE : ${matrixTo.map(s => `${s.name} (${s.walk_min}m)`).join(', ')}
                    
                    CONSIGNES :
                    1. Applique Coeff 1.25 sur transport + Buffer 7 min.
                    2. Arrondis au multiple de 5 min supérieur.
                    3. Format JSON : {"summary": "🚇 X min", "steps": "...", "total_minutes": X}`
                },
                { role: "user", content: `Trajet de ${from_place.name} à ${to_place.name}.` }
            ],
            response_format: { type: "json_object" }
        });

        const routeData = JSON.parse(aiRoute.choices[0].message.content);
        
        res.json({
            success: true,
            summary: routeData.summary,
            details: routeData.steps,
            total_minutes: routeData.total_minutes,
            arrival: new Date(Date.now() + routeData.total_minutes * 60000).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get("/api/health", async (req, res) => {
    try {
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const testPlaceId = "ChIJ51cu8IcbXWARiRtXIothAS4";
        const u = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        u.searchParams.set("place_id", testPlaceId);
        u.searchParams.set("key", serverKey);
        const p = await fetchJson(u.toString());
        res.json({ env_ok: !!serverKey, places_ok: p.json?.status === "OK", engine: "Master Pipeline V4" });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- INFOS ACTIVITÉ AVEC IA ---
app.post("/api/activity-info", async (req, res) => {
    try {
        const { place_name, place_address, visit_time } = req.body;
        
        if (!place_name) {
            return res.status(400).json({ error: "Nom du lieu manquant" });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { 
                    role: "system", 
                    content: `Tu es un expert du tourisme au Japon. 
                    Analyse le lieu demandé et fournis des informations pratiques.
                    Format JSON strict :
                    {
                        "crowd_level": "low|medium|high",
                        "best_times": ["09:00-10:00", "15:00-16:00"],
                        "rules": ["Règle 1", "Règle 2"],
                        "tips": "Conseil pratique pour profiter au mieux"
                    }`
                },
                { 
                    role: "user", 
                    content: `Lieu: ${place_name}
                    Adresse: ${place_address || 'Non spécifiée'}
                    Heure de visite prévue: ${visit_time || 'Non spécifiée'}
                    
                    Donne-moi:
                    1. Le niveau d'affluence à cette heure (low/medium/high)
                    2. Les meilleures heures pour éviter la foule (2-3 créneaux)
                    3. Les règles importantes à respecter (dress code, photos, comportement)
                    4. Un conseil pratique`
                }
            ],
            response_format: { type: "json_object" }
        });

        const info = JSON.parse(completion.choices[0].message.content);
        res.json({ success: true, info });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- MÉTÉO ---
app.get("/api/weather", async (req, res) => {
    try {
        const { lat, lng, date } = req.query;
        const weatherKey = process.env.OPENWEATHER_API_KEY;
        
        if (!weatherKey) {
            return res.json({ success: false, error: "Clé OpenWeather manquante" });
        }
        
        if (!lat || !lng) {
            return res.json({ success: false, error: "Coordonnées manquantes" });
        }
        
        // API OpenWeather One Call
        const url = new URL("https://api.openweathermap.org/data/3.0/onecall");
        url.searchParams.set("lat", lat);
        url.searchParams.set("lon", lng);
        url.searchParams.set("appid", weatherKey);
        url.searchParams.set("units", "metric");
        url.searchParams.set("lang", "fr");
        url.searchParams.set("exclude", "minutely,alerts");
        
        const response = await fetchJson(url.toString());
        
        if (!response.json) {
            return res.json({ success: false, error: "Erreur API météo" });
        }
        
        const weather = response.json;
        
        // Extraire les données pertinentes
        const forecast = {
            current: {
                temp: Math.round(weather.current?.temp || 0),
                feels_like: Math.round(weather.current?.feels_like || 0),
                humidity: weather.current?.humidity || 0,
                description: weather.current?.weather?.[0]?.description || '',
                icon: weather.current?.weather?.[0]?.icon || '',
                rain: weather.current?.rain?.['1h'] || 0,
                is_raining: (weather.current?.rain?.['1h'] || 0) > 0
            },
            daily: weather.daily?.slice(0, 7).map(day => ({
                date: new Date(day.dt * 1000).toLocaleDateString('fr-FR'),
                temp_max: Math.round(day.temp.max),
                temp_min: Math.round(day.temp.min),
                description: day.weather[0].description,
                icon: day.weather[0].icon,
                rain_probability: Math.round((day.pop || 0) * 100),
                rain_mm: day.rain || 0,
                is_rainy: (day.pop || 0) > 0.3 // Plus de 30% de chance de pluie
            })) || []
        };
        
        res.json({ success: true, forecast });
        
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- AJOUT RAPIDE IA ---
app.post("/api/quick-add-activity", async (req, res) => {
    try {
        const { description, day_index, time_flexible, fixed_time } = req.body;
        
        // Analyser avec l'IA
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Tu es un assistant de voyage expert du Japon. Analyse la description d'activité et retourne un JSON:
                    {
                        "title": "Titre propre de l'activité",
                        "description": "Description courte",
                        "search_query": "Requête Google Places pour trouver le lieu exact",
                        "suggested_time": "09:00"
                    }`
                },
                {
                    role: "user",
                    content: `Activité décrite par l'utilisateur: "${description}"\n\nCrée une activité structurée.`
                }
            ],
            response_format: { type: "json_object" }
        });

        const parsed = JSON.parse(completion.choices[0].message.content);
        
        // Rechercher le lieu sur Google Places
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
        searchUrl.searchParams.set("query", parsed.search_query);
        searchUrl.searchParams.set("key", serverKey);
        
        const placesRes = await fetchJson(searchUrl.toString());
        
        if (!placesRes.json?.results?.[0]) {
            return res.json({ success: false, error: "Lieu non trouvé" });
        }
        
        const firstResult = placesRes.json.results[0];
        
        // Obtenir les détails
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.set("place_id", firstResult.place_id);
        detailsUrl.searchParams.set("key", serverKey);
        
        const detailsRes = await fetchJson(detailsUrl.toString());
        const place = detailsRes.json?.result;
        
        if (!place) {
            return res.json({ success: false, error: "Détails du lieu non disponibles" });
        }
        
        res.json({
            success: true,
            activity: {
                title: parsed.title,
                description: parsed.description,
                suggested_time: time_flexible ? null : (fixed_time || parsed.suggested_time),
                place: {
                    place_id: place.place_id,
                    name: place.name,
                    formatted_address: place.formatted_address,
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng
                }
            }
        });
        
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- FICHE SUGGESTION IA ---
app.post("/api/suggestion-preview", async (req, res) => {
    try {
        const { name, query, existing_activities } = req.body;

        const activitiesContext = (existing_activities || [])
            .map(a => `${a.time} - ${a.title}`)
            .join('\n') || 'Aucune activité planifiée';

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Tu es un expert du tourisme au Japon, passionné et enthousiaste. 
Tu connais parfaitement les horaires, l'affluence touristique, les meilleures conditions de visite.
Réponds UNIQUEMENT en JSON valide, sans markdown.`
                },
                {
                    role: "user",
                    content: `Activité : "${name}" (${query})
Activités déjà planifiées ce jour :
${activitiesContext}

Génère une fiche de présentation avec :
{
  "hook": "1-2 phrases poétiques/immersives qui donnent vraiment envie de visiter (max 120 caractères)",
  "best_time": "HH:MM",
  "best_time_reason": "Pourquoi c'est le meilleur moment (max 80 caractères, ex: Avant l'afflux de 10h, lumière dorée)",
  "avoid_time": "Plage à éviter (ex: 10h-13h)",
  "avoid_reason": "Pourquoi éviter (max 60 caractères)",
  "duration": "Durée recommandée (ex: 1h30)",
  "tip": "1 conseil insider court et précis (max 80 caractères)",
  "intensity": "balade|exploration|randonnée"
}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const preview = JSON.parse(completion.choices[0].message.content);

        // Rechercher le lieu sur Google Places pour avoir le place_id
        const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
        const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
        searchUrl.searchParams.set("query", query);
        searchUrl.searchParams.set("key", serverKey);
        const placesRes = await fetchJson(searchUrl.toString());
        const firstResult = placesRes.json?.results?.[0];

        let place = null;
        if (firstResult) {
            const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            detailsUrl.searchParams.set("place_id", firstResult.place_id);
            detailsUrl.searchParams.set("key", serverKey);
            const detailsRes = await fetchJson(detailsUrl.toString());
            const p = detailsRes.json?.result;
            if (p) {
                place = {
                    place_id: p.place_id,
                    name: p.name,
                    formatted_address: p.formatted_address,
                    lat: p.geometry?.location?.lat,
                    lng: p.geometry?.location?.lng
                };
            }
        }

        res.json({ success: true, preview, place });
    } catch (e) {
        console.error("suggestion-preview error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

// --- OPTIMISATION JOURNÉE ---
app.post("/api/optimize-day", async (req, res) => {
    try {
        const { activities, day_index, hotel } = req.body;
        
        // Préparer le contexte pour l'IA — ignorer les activités sans place valide
        const activitiesContext = activities
            .filter(a => a.place && a.place.name)
            .map(a => ({
                id: a.id,
                title: a.title,
                place: a.place.name,
                current_time: a.time,
                is_flexible: a.time_flexible || false
            }));

        if (activitiesContext.length === 0) {
            return res.status(400).json({ success: false, error: "Aucune activité avec lieu valide à optimiser." });
        }

        const hotelName = hotel?.place?.name || hotel?.hotelName || null;
        const prompt = `Tu es un expert en optimisation d'itinéraires au Japon.

Activités à optimiser:
${JSON.stringify(activitiesContext, null, 2)}

${hotelName ? `Hôtel: ${hotelName}` : 'Pas d\'hôtel défini'}

Tâches:
1. Vérifier les horaires d'ouverture
2. Éviter les heures d'affluence
3. Optimiser les trajets
4. Respecter les horaires fixes (is_flexible: false)
5. Proposer des horaires réalistes

Retourne un JSON avec UNIQUEMENT les IDs et nouveaux horaires:
{
    "optimized_activities": [
        {
            "id": 123,
            "time": "09:00",
            "reason": "Ouverture + peu de monde",
            "time_changed": true
        }
    ],
    "explanation": "Le planning a été optimisé pour..."
}`;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Tu es un expert en optimisation d'itinéraires au Japon." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        
        // IMPORTANT: Fusionner les données IA avec les données complètes originales
        const optimizedWithFullData = result.optimized_activities.map(opt => {
            const original = activities.find(a => a.id === opt.id);
            if (!original) return null;
            
            return {
                id: opt.id,
                time: opt.time,
                title: original.title,
                description: original.description,
                place: original.place, // Conserver l'objet place complet
                reason: opt.reason,
                time_changed: opt.time_changed
            };
        }).filter(a => a !== null);
        
        res.json({
            success: true,
            optimized_activities: optimizedWithFullData,
            explanation: result.explanation
        });
        
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.listen(port, () => console.log(`✅ Serveur prêt sur http://localhost:${port}`));
