import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ── Helper Anthropic Claude ─────────────────────────────────────────────────
async function anthropicChat(systemPrompt, userMessage, maxTokens = 400) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Clé ANTHROPIC_API_KEY manquante dans .env');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }]
        })
    });
    const data = await r.json();
    if (!r.ok) {
        const errMsg = data.error?.message || JSON.stringify(data);
        console.error('[Anthropic] Erreur API:', errMsg);
        throw new Error(errMsg);
    }
    const text = data.content?.[0]?.text || '';
    // Nettoyer les backticks markdown que le modèle peut inclure dans les JSON
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// IA : appel direct Anthropic Claude via fetch

// ── Cache suggestion-preview (mémoire serveur) ────────────────────────────
// Clé : nom normalisé de l'activité → évite les appels OpenAI répétés
// TTL : 24h (les infos touristiques ne changent pas)
const _suggestionCache = new Map();
const _SUGGESTION_TTL = 24 * 60 * 60 * 1000; // 24h en ms
function getCachedSuggestion(name) {
    const key = name.toLowerCase().trim();
    const entry = _suggestionCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > _SUGGESTION_TTL) { _suggestionCache.delete(key); return null; }
    return entry.data;
}
function setCachedSuggestion(name, data) {
    _suggestionCache.set(name.toLowerCase().trim(), { data, ts: Date.now() });
}

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

        const completionText = await anthropicChat(
            `Tu es un expert en voyages au Japon. Réponds UNIQUEMENT avec du JSON brut valide, SANS backticks, SANS markdown, SANS texte avant ou après.\nFormat exact: {"title_clean":"Nom Propre — description courte","suggested_location":"Nom du lieu, Ville, Japan"}`,
            text, 200
        );

        let parsedNorm;
        try { parsedNorm = JSON.parse(completionText); }
        catch(e) { parsedNorm = { title_clean: text, suggested_location: text + ", Japan" }; }
        res.json(parsedNorm);
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
        u.searchParams.set("fields", "place_id,name,formatted_address,geometry,opening_hours,current_opening_hours,price_level,types,editorial_summary,business_status,rating,user_ratings_total,photos");
        u.searchParams.set("language", "fr");
        u.searchParams.set("key", key);

        const r = await fetchJson(u.toString());
        if (r.json.status !== "OK") return res.json({ ok: false, status: r.json.status });

        const p = r.json.result;
        let opening_hours = p.current_opening_hours?.weekday_text || p.opening_hours?.weekday_text || null;
        let open_now      = p.current_opening_hours?.open_now ?? p.opening_hours?.open_now ?? null;
        let price_level   = p.price_level ?? null;
        let ai_hours      = false;
        // Note et avis directement depuis Google Maps (source la plus fiable)
        let rating        = p.rating ?? null;
        let review_count  = p.user_ratings_total ?? null;
        let visit_duration = null;
        let price_eur     = null;

        // ── Fallback OpenAI web search si Google n'a pas les horaires/prix ─
        const needsHours = !opening_hours;
        const needsPrice = price_level === null;
        if (needsHours || needsPrice) {
            try {
                const tokyoTime = new Date().toLocaleString('fr-FR', {timeZone: 'Asia/Tokyo'});
                const aiResText = await anthropicChat(
                    "Tu es un assistant de voyage expert au Japon. Cherche en mémoire les infos pratiques sur ce lieu japonais et réponds UNIQUEMENT en JSON valide.",
                    `Infos pour : "${p.name}", ${p.formatted_address || "Japon"}. Heure à Tokyo : ${tokyoTime}.\nIMPORTANT: prix ENTRÉE DIRECTE (pas visites guidées). Sources: site officiel, Japan-guide.com.\nRéponds UNIQUEMENT avec ce JSON :\n{\n  "opening_hours": ["Lundi: 06:00 - 17:00", ...] ou null,\n  "open_now": true/false/null,\n  "price_level": 0 si gratuit, 1 si <1000¥, 2 si 1000-2000¥, 3 si 2000-4000¥, 4 si >4000¥, null si inconnu,\n  "price_detail": "ex: 800¥ adulte" ou null,\n  "price_eur": 5.00 ou null,\n  "visit_duration": 90 ou null,\n  "booking_url": "https://..." ou null,\n  "booking_required": true/false\n}`,
                    600
                );
                const raw = aiResText?.trim();
                const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
                if (needsHours && parsed.opening_hours) opening_hours = parsed.opening_hours;
                if (parsed.open_now !== undefined && open_now === null) open_now = parsed.open_now;
                if (needsPrice && parsed.price_level !== undefined && parsed.price_level !== null) price_level = parsed.price_level;
                if (parsed.price_detail)    p._price_detail    = parsed.price_detail;
                if (parsed.price_eur)       price_eur          = parsed.price_eur;
                if (parsed.booking_url)     p._booking_url     = parsed.booking_url;
                if (parsed.booking_required !== undefined) p._booking_required = parsed.booking_required;
                if (parsed.visit_duration)  visit_duration     = parsed.visit_duration;
                ai_hours = true;
            } catch(aiErr) {
                console.warn("OpenAI search fallback failed:", aiErr.message);
            }
        }

        // Types d'espaces publics accessibles H24
        const publicTypes = ['neighborhood','sublocality','political','locality','geocode',
                             'natural_feature','park','street_address','route','intersection',
                             'premise','tourist_attraction','point_of_interest'];
        const isPublicSpace = (p.types || []).some(t => publicTypes.includes(t));
        // Si espace public sans horaires → H24
        if (isPublicSpace && !opening_hours && open_now === null) {
            opening_hours = ['Lundi: Ouvert 24h/24','Mardi: Ouvert 24h/24','Mercredi: Ouvert 24h/24',
                             'Jeudi: Ouvert 24h/24','Vendredi: Ouvert 24h/24','Samedi: Ouvert 24h/24',
                             'Dimanche: Ouvert 24h/24'];
            open_now = true;
            ai_hours = true;
        }

        res.json({
            ok: true,
            place: {
                place_id: p.place_id,
                name: p.name,
                formatted_address: p.formatted_address,
                lat: p.geometry?.location?.lat,
                lng: p.geometry?.location?.lng,
                opening_hours,
                open_now,
                price_level,
                price_detail:     p._price_detail     || null,
                price_eur:        price_eur          || null,
                booking_url:      p._booking_url     || null,
                booking_required: p._booking_required !== undefined ? p._booking_required : null,
                rating:           rating             || null,
                review_count:    review_count    || null,
                rating_source:   rating ? 'google' : null,
                visit_duration:  visit_duration  || null,
                types: p.types || [],
                ai_hours,
                photo_reference: p.photos?.[0]?.photo_reference || null
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

        const bestFrom = matrixFrom[0];
        const bestTo   = matrixTo[0];

        // Distance à vol d'oiseau entre les deux lieux (haversine)
        function haversineKm(a, b) {
            const R = 6371;
            const dLat = (b.lat - a.lat) * Math.PI / 180;
            const dLng = (b.lng - a.lng) * Math.PI / 180;
            const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
            return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
        }
        const distKm = haversineKm(fromCoords, toCoords).toFixed(1);

        // Durée OSRM à pied entre les deux lieux (pour détecter si tout est faisable à pied)
        const walkDirect = await getWalkingDirections(fromCoords, toCoords);
        const walkDirectMin = walkDirect.success ? walkDirect.duration : 999;

        // Si distance < 1.2km : tout à pied, pas de transit
        const useTransit = distKm > 1.2;

        const walkFrom = bestFrom?.walk_min || 3;
        const walkTo   = bestTo?.walk_min   || 3;

        let transit = 0;
        let mode = 'walk';
        let steps = '';

        if (!useTransit) {
            // Trajet entièrement à pied
            transit = 0;
            mode = 'walk';
            steps = `🚶 ${walkDirectMin}min`;
            const totalReal = walkDirectMin;
            return res.json({
                success: true,
                summary: steps,
                details: steps,
                total_minutes: totalReal,
                walk_from_min: walkDirectMin,
                transit_min: 0,
                walk_to_min: 0,
                mode: 'walk'
            });
        }

        // Trajet avec transit — demander à l'IA la durée du segment en transports
        const aiRouteText = await anthropicChat(`Tu es un expert des transports en commun au Japon (Tokyo, Kyoto, Osaka...).
On connait déjà les segments de marche. Tu dois UNIQUEMENT estimer la durée du trajet en transports entre deux stations.

Données :
- DÉPART : ${from_place.name}
- Station départ : ${bestFrom?.name ?? '?'} (${walkFrom}min à pied du départ)
- ARRIVÉE : ${to_place.name}  
- Station arrivée : ${bestTo?.name ?? '?'} (${walkTo}min à pied de l'arrivée)
- Distance directe : ${distKm} km

RÈGLE : transit_min = durée réelle en métro/train entre les deux stations (sans les marches).
Pour ${distKm}km au Japon, le transit typique est entre ${Math.round(distKm * 2)}min et ${Math.round(distKm * 4)}min selon les correspondances.
Si les deux stations sont sur la même ligne : moins de correspondances.
Si les stations sont différentes : ajouter 5-10min de correspondance.

Réponds UNIQUEMENT avec ce JSON :
{
  "transit_min": <int>,
  "mode": "metro|train|bus",
  "line_hint": "ex: Ginza Line direction Shibuya"
}`, `De "${bestFrom?.name}" à "${bestTo?.name}" pour aller de ${from_place.name} à ${to_place.name}.`, 400);


        const r = JSON.parse(aiRouteText);

        // Calcul arithmétique — serveur est maître du total
        transit = Math.max(1, parseInt(r.transit_min) || Math.round(distKm * 3));
        // Clamp transit entre 1 et 120min (sécurité anti-valeurs IA aberrantes)
        transit = Math.min(120, transit);
        mode    = r.mode || 'metro';
        const modeEmoji = { metro: '🚇', train: '🚄', bus: '🚌' }[mode] || '🚇';
        const totalReal = walkFrom + transit + walkTo;
        steps = `🚶 ${walkFrom}min + ${modeEmoji} ${transit}min + 🚶 ${walkTo}min`;

        res.json({
            success: true,
            summary: steps,
            details: steps,
            total_minutes: totalReal,
            walk_from_min: walkFrom,
            transit_min: transit,
            walk_to_min: walkTo,
            mode
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

        const completionText = await anthropicChat(
            `Tu es un expert du tourisme au Japon. Réponds UNIQUEMENT avec un objet JSON valide, SANS markdown, SANS backticks, SANS texte autour.
Format exact attendu :
{"why_visit":"...","history_detail":"...","cultural_context":"...","crowd_level":"low|medium|high","best_times":["09:00-10:00"],"rules":["Règle 1"],"tips":"...","local_tip":"...","nearby_food":"..."}`,
            `Lieu: ${place_name}${place_address ? ", " + place_address : ""}. Heure de visite prévue: ${visit_time || "journée"}.`,
            600
        );

        let info;
        try {
            info = JSON.parse(completionText);
        } catch(parseErr) {
            console.error('[activity-info] JSON.parse error:', parseErr.message, '| raw:', completionText.slice(0, 200));
            // Fallback: construire un objet minimal depuis le texte brut
            info = {
                why_visit: completionText.slice(0, 300) || `${place_name} est un lieu incontournable au Japon.`,
                history_detail: '', cultural_context: '',
                crowd_level: 'medium', best_times: ['09:00-11:00', '15:00-17:00'],
                rules: [], tips: 'Arrivez tôt pour éviter la foule.',
                local_tip: '', nearby_food: ''
            };
        }
        res.json({ success: true, info });

    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});


// --- ASSISTANT PLANNING IA ---
app.post('/api/ai-planner', async (req, res) => {
    try {
        const { message, context } = req.body;
        if (!message) return res.status(400).json({ error: 'Message manquant' });

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) return res.status(500).json({ success: false, error: 'Clé ANTHROPIC_API_KEY manquante dans .env' });

        const systemPrompt = `Tu es un assistant de voyage expert au Japon, intégré dans une app de planification.
Tu as accès au programme complet du voyage.

Programme actuel (Jour ${context.dayIndex + 1}/${context.totalDays}) :
${JSON.stringify(context.dayActivities?.map(a => ({
    time: a.time,
    title: a.title,
    duration: a.duration_minutes,
    place: a.place?.name
})) || [], null, 2)}

Informations voyage :
- Destination(s) : ${context.cities?.join(', ') || 'Japon'}
- Durée totale : ${context.totalDays} jours
- Activités ce jour : ${context.dayActivities?.length || 0}
- Temps de trajet estimé aujourd'hui : ${context.totalTravelMin || 0} min

Réponds en français, de façon concise et directe (max 3-4 phrases).
Si tu proposes d'ajouter/déplacer des activités, sois précis sur l'heure et le nom.
Tu peux suggérer des lieux japonais spécifiques avec leur nom en japonais.`;

        // Construire l'historique (hors message système)
        const history = (context.history || []).slice(-6).map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
        }));

        const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 400,
                system: systemPrompt,
                messages: [...history, { role: 'user', content: message }]
            })
        });

        const data = await r.json();
        if (!r.ok) return res.status(500).json({ success: false, error: data.error?.message || 'Erreur Anthropic' });

        const reply = data.content?.[0]?.text || '';
        res.json({ success: true, reply });
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
        const completionText = await anthropicChat(`Tu es un expert du tourisme au Japon. Analyse l'activité et retourne un JSON:
{
  "title": "Titre propre de l'activité",
  "description": "Description courte (1 phrase)",
  "search_query": "Requête Google Places précise pour trouver le lieu",
  "suggested_time": "09:00",
  "duration_minutes": 90,
  "duration_reason": "Raison courte ex: temple + jardins nécessitent 1h30 min"
}
Pour duration_minutes: base-toi sur les recommandations réelles (TripAdvisor, guides). Ex: Senso-ji=90min, Tsukiji=60min, Fushimi Inari=150min, musée=120min, marché=45min.`, `Activité: "${description}"\n\nCrée une activité structurée avec la durée de visite recommandée.`, 400);


        let parsed;
        try { parsed = JSON.parse(completionText); }
        catch(e) {
            console.error('[activity-analyze] JSON.parse error:', e.message, '| raw:', completionText.slice(0,200));
            parsed = { title: description, description: '', search_query: description + ' Japan', suggested_time: '10:00', duration_minutes: 90, duration_reason: '' };
        }

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
        detailsUrl.searchParams.set("fields", "place_id,name,formatted_address,geometry,opening_hours,price_level,types,photos,rating");
        detailsUrl.searchParams.set("language", "fr");
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
                duration_minutes: parsed.duration_minutes || 90,
                duration_reason: parsed.duration_reason || '',
                place: {
                    place_id: place.place_id,
                    name: place.name,
                    formatted_address: place.formatted_address,
                    lat: place.geometry.location.lat,
                    lng: place.geometry.location.lng,
                    opening_hours: place.opening_hours?.weekday_text || null,
                    open_now: place.opening_hours?.open_now ?? null,
                    price_level: place.price_level ?? null,
                    types: place.types || [],
                    photo_reference: place.photos?.[0]?.photo_reference || null,
                    rating: place.rating || null,
                    user_ratings_total: place.user_ratings_total || null
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

        // ── Vérifier le cache serveur d'abord ──────────────────────────
        const cached = getCachedSuggestion(name);
        if (cached) {
            console.log(`[cache HIT] suggestion-preview: ${name}`);
            return res.json({ success: true, ...cached, _cached: true });
        }
        console.log(`[cache MISS] suggestion-preview: ${name} — appel OpenAI`);

        const activitiesContext = (existing_activities || [])
            .map(a => `${a.time} - ${a.title}`)
            .join('\n') || 'Aucune activité planifiée';

        const completionText = await anthropicChat(
            `Tu es un expert du tourisme au Japon. Réponds UNIQUEMENT avec du JSON brut valide, SANS backticks, SANS markdown, SANS texte avant ou après.
Format exact: {"why_visit":"...","best_time":"...","duration_minutes":90,"crowd_level":"low|medium|high","price_eur":null,"tips":"...","energy_level":"légère|modérée|intense"}`,
            `Activité : "${name}" (${query})`,
            400
        );

        let preview;
        try {
            preview = JSON.parse(completionText);
        } catch(e) {
            console.error('[suggestion-preview] JSON.parse error:', e.message, '| raw:', completionText.slice(0,200));
            preview = { why_visit: `${name} est un lieu incontournable.`, best_time: '09:00', duration_minutes: 90, crowd_level: 'medium', price_eur: null, tips: '', energy_level: 'modérée' };
        }

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
            detailsUrl.searchParams.set("fields", "place_id,name,formatted_address,geometry,opening_hours,price_level,types,photos,rating");
            detailsUrl.searchParams.set("language", "fr");
            detailsUrl.searchParams.set("key", serverKey);
            const detailsRes = await fetchJson(detailsUrl.toString());
            const p = detailsRes.json?.result;
            if (p) {
                place = {
                    place_id: p.place_id,
                    name: p.name,
                    formatted_address: p.formatted_address,
                    lat: p.geometry?.location?.lat,
                    lng: p.geometry?.location?.lng,
                    opening_hours: p.opening_hours?.weekday_text || null,
                    open_now: p.opening_hours?.open_now ?? null,
                    price_level: p.price_level ?? null,
                    types: p.types || []
                };
            }
        }

        // ── Mettre en cache serveur ────────────────────────────────────
        setCachedSuggestion(name, { preview, place });
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

        const validActivities = activities.filter(a => a.place && a.place.name);
        if (validActivities.length === 0) {
            return res.status(400).json({ success: false, error: "Aucune activité avec lieu valide." });
        }

        const hotelName = hotel?.place?.name || hotel?.hotelName || null;
        const activitiesContext = validActivities.map(a => ({
            id: a.id,
            title: a.title,
            place: a.place.name,
            current_time: a.time,
            is_flexible: a.time_flexible !== false
        }));

        const prompt = `Tu es un expert en planification d'itinéraires au Japon. Crée un planning de journée optimal et humain.

Activités:
${JSON.stringify(activitiesContext, null, 2)}

${hotelName ? `Point de départ: ${hotelName}` : ''}

RÈGLES:
1. Respecter les vrais horaires d'ouverture
2. Éviter les pics d'affluence touristique
3. Optimiser l'ordre géographique pour minimiser les trajets
4. Ne JAMAIS changer is_flexible:false
5. Marges de respiration INTELLIGENTES (temps de flâner, se perdre, souffler):
   - Lieux proches: 15-20min
   - Lieux éloignés: 30-45min
   - Après marché/repas: 20min
   - Après site intense/randonnée: 30min
6. Journée réaliste: début 08h-09h, fin avant 21h
7. Activités physiques le matin, culturelles/légères l'après-midi

JSON de réponse:
{
  "optimized_activities": [
    {
      "id": 123,
      "time": "09:00",
      "duration_minutes": 90,
      "breathing_after_minutes": 20,
      "breathing_reason": "Flâner dans les ruelles avant de reprendre",
      "reason": "Ouverture à 8h30, lumière dorée et peu de monde",
      "time_changed": true
    }
  ],
  "day_summary": "Une journée fluide entre marchés animés et temples apaisants",
  "energy_level": "modérée"
}`;

        const completionText = await anthropicChat("Expert tourisme Japon. Réponds UNIQUEMENT en JSON valide.", prompt, 400);


        const result = JSON.parse(completionText);

        const optimizedWithFullData = result.optimized_activities.map(opt => {
            const original = validActivities.find(a => a.id === opt.id);
            if (!original) return null;
            return {
                id: opt.id,
                time: opt.time,
                title: original.title,
                description: original.description || '',
                place: original.place,
                reason: opt.reason || '',
                breathing_after_minutes: opt.breathing_after_minutes || 0,
                breathing_reason: opt.breathing_reason || '',
                duration_minutes: opt.duration_minutes || 90,
                time_changed: opt.time_changed || false
            };
        }).filter(Boolean);

        res.json({
            success: true,
            optimized_activities: optimizedWithFullData,
            day_summary: result.day_summary || '',
            energy_level: result.energy_level || ''
        });

    } catch (e) {
        console.error("optimize-day error:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});



// ── Proxy photo Google Places (évite CORS + cache navigateur) ──────────────
app.get('/api/place-photo', async (req, res) => {
    try {
        const key = mustEnv('GOOGLE_MAPS_SERVER_KEY');
        const ref = String(req.query.ref || '').trim();
        const maxw = Math.min(800, parseInt(req.query.maxw) || 400);
        if (!ref) return res.status(400).json({ error: 'missing ref' });

        const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxw}&photoreference=${ref}&key=${key}`;
        const r = await fetch(url);
        if (!r.ok) return res.status(r.status).send('Photo unavailable');

        // Cache 7 jours côté navigateur
        res.set('Cache-Control', 'public, max-age=604800');
        res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
        const buf = await r.arrayBuffer();
        res.send(Buffer.from(buf));
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ── Expose clé Maps navigateur au client ─────────────────────────────────
app.get('/api/maps-key', (req, res) => {
    const key = process.env.GOOGLE_MAPS_BROWSER_KEY || '';
    res.json({ key });
});

app.listen(port, () => console.log(`✅ Serveur prêt sur http://localhost:${port}`));
