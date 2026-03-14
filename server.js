import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ── Helper Anthropic Claude ─────────────────────────────────────────────────
// ── Convertir le profil voyageur en contexte pour les prompts IA ─────────────
function buildProfileContext(profile) {
    if (!profile) return '';
    const typeMap = { solo:'voyage solo', couple:'voyage en couple', famille:'voyage en famille', amis:'voyage entre amis', groupe:'voyage en groupe' };
    const intMap  = {
        culture:'temples/sanctuaires/quartiers historiques/châteaux',
        art:"musées d'art moderne/TeamLab/galeries contemporaines",
        nature:'parcs/jardins/forêts/nature',
        gastro:'marchés alimentaires/cours de cuisine/street food/restaurants typiques',
        shopping:'boutiques locales/vintage/artisanat',
        pop:'Akihabara/anime/manga/arcades/pop culture',
        wellness:'onsen/jardins zen/temples calmes/promenades',
        adventure:'randonnées/vélo/activités sportives',
        experiences:'cérémonie du thé/calligraphie/poterie/cours de cuisine',
        musees:'musées nationaux/musées de site/musées thématiques/expositions'
    };
    const budgetMap = { econome:'budget serré (konbini, < 1000¥, entrées gratuites prioritaires)', modere:'budget modéré (restaurants 1000–3000¥)', confortable:'budget confortable (restaurants et expériences premium OK)', luxe:'budget luxe (ryokan, gastronomique, exclusif)' };
    const constMap  = { mobility:'accessibilité PMR obligatoire', vegetarien:'options végétariennes', vegan:'options végétaliennes', halal:'options halal', noalcool:'sans alcool', nogluten:'sans gluten', enfants:'adapté aux jeunes enfants' };

    const parts = [];
    if (profile.travel_type) parts.push('Type: ' + (typeMap[profile.travel_type]||profile.travel_type));

    // Utiliser interests_order si disponible (1er intérêt = priorité maximale)
    const orderedInterests = profile.interests_order?.length ? profile.interests_order : (profile.interests || []);
    if (orderedInterests.length) {
        const mapped = orderedInterests.map((i,idx) => `${idx===0?'[PRIORITÉ HAUTE] ':''}${intMap[i]||i}`);
        parts.push("Centres intérêt (par ordre de préférence): " + mapped.join(' | '));
        parts.push("→ OBLIGATION: 1er intérêt prioritaire dans 40% des activités. Alterner les autres. Max 1 activité du même type par demi-journée.");
    }

    if (profile.budget) parts.push('Budget: ' + (budgetMap[profile.budget]||profile.budget));
    if (profile.constraints?.length) parts.push('Contraintes: ' + profile.constraints.map(c => constMap[c]||c).join(', '));
    if (profile.custom_constraint) parts.push('Contrainte spéciale: ' + profile.custom_constraint);

    // Nouveaux critères de rythme
    const sc = profile._score;
    if (sc) {
        parts.push(`Rythme: ${sc.activitiesPerDay} activités max/jour`);
        parts.push(`Heure début journée: ${sc.dayStartHour}h00`);
        if (sc.avoidCrowdedSlots) parts.push('Sensibilité foules forte → privilégier visites tôt matin (avant 9h) ou fin de journée (après 17h) pour sites touristiques');
    } else {
        if (profile.pace === 'tranquille') parts.push('Rythme: max 3 activités/jour — journées aérées, temps de pause');
        if (profile.pace === 'intense')    parts.push('Rythme: 6–7 activités/jour — journées bien remplies');
        if (profile.wake_time === 'tot')   parts.push('Départ dès 7h — peut accéder aux sites avant la foule');
        if (profile.wake_time === 'tard')  parts.push('Départ vers 10h — éviter activités matinales obligatoires');
        if (profile.crowd_sensitivity === 'forte') parts.push('Évite les foules → créneaux tôt matin ou après 17h pour Fushimi Inari, Arashiyama, etc.');
    }

    if (!parts.length) return '';
    return '\n=== PROFIL VOYAGEUR (OBLIGATOIRE À RESPECTER) ===\n' + parts.join('\n') + '\n=== FIN PROFIL ===\n';
}


// ── Nettoyage robuste du JSON IA ─────────────────────────────────────────────
function sanitizeJson(text) {
    let j = text.trim();
    j = j.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    j = j.replace(/[""]/g, '"').replace(/['']/g, "'");
    j = j.replace(/,\s*([}\]])/g, '$1');
    const m = j.match(/\{[\s\S]*\}/);
    if (m) j = m[0];
    try { JSON.parse(j); } catch(e) {
        const lastComma = j.lastIndexOf(',');
        const trimmed = j.slice(0, lastComma > 0 ? lastComma : j.length);
        let work = trimmed;
        const openB = (work.match(/\[/g)||[]).length - (work.match(/\]/g)||[]).length;
        const openC = (work.match(/\{/g)||[]).length - (work.match(/\}/g)||[]).length;
        for (let i=0; i<openB; i++) work += ']';
        for (let i=0; i<openC; i++) work += '}';
        work = work.replace(/,\s*([}\]])/g, '$1');
        try { JSON.parse(work); j = work; } catch(e2) { /* garder j original */ }
    }
    return j;
}

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

async function fetchJson(url, options, timeoutMs = 9000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(url, { ...options, signal: ctrl.signal });
        clearTimeout(timer);
        const j = await r.json().catch(() => ({}));
        return { ok: r.ok, status: r.status, json: j };
    } catch(e) {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error('Timeout Google Places (' + timeoutMs + 'ms)');
        throw e;
    }
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
        const { place_name, place_address, visit_time, traveler_profile: tp_info } = req.body;
        const profileCtxInfo = buildProfileContext(tp_info);
        
        if (!place_name) {
            return res.status(400).json({ error: "Nom du lieu manquant" });
        }

        const completionText = await anthropicChat(
            `Tu es un expert du tourisme au Japon. Réponds UNIQUEMENT avec un objet JSON valide, SANS markdown, SANS backticks, SANS texte autour.
Format exact attendu :
{"why_visit":"...","history_detail":"...","cultural_context":"...","crowd_level":"low|medium|high","best_times":["09:00-10:00"],"rules":["Règle 1"],"tips":"...","local_tip":"...","nearby_food":"..."}`,
            `${profileCtxInfo}Lieu: ${place_name}${place_address ? ", " + place_address : ""}. Heure de visite prévue: ${visit_time || "journée"}.`,
            600
        );

        let info;
        try {
            info = JSON.parse(completionText);
        } catch(parseErr) {
            console.error('[activity-info] JSON.parse error:', parseErr.message, '| raw:', completionText.slice(0, 200));
            // Fallback: construire un objet minimal depuis le texte brut
            info = {
                why_visit: `${place_name} est un lieu incontournable au Japon, riche en histoire et en culture.`,
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

        const dayActsSummary = (context.dayActivities || []).map(a =>
            `- id:${a.id} "${a.title}" à ${a.time} (${a.duration_minutes||90}min) — ${a.place?.name || 'lieu ?'}`
        ).join('\n') || '(aucune activité)';

        const allDaysSummary = (context.allDays || []).map((d, i) =>
            `Jour ${i+1} [dayIndex:${i}]: ${d.label || ''} — ${d.count||0} activité(s)`
        ).join('\n') || '';

        const systemPrompt = `Tu es un assistant de voyage expert au Japon, intégré dans une app de planification.
Tu peux VRAIMENT modifier le planning : ajouter, déplacer, supprimer des activités.

PROGRAMME COMPLET :
${allDaysSummary}

JOUR ACTUEL (Jour ${(context.dayIndex||0)+1}, dayIndex:${context.dayIndex||0}) :
${dayActsSummary}

Ville(s) visitée(s) : ${context.cities?.join(', ') || context.city || 'Japon'}
Durée totale : ${context.totalDays||1} jour(s)

INSTRUCTIONS :
- Réponds TOUJOURS avec un JSON valide, SANS backticks.
- Format : {"reply":"message en français max 4 phrases","actions":[...]}
- Actions possibles :
  * Ajouter : {"type":"add","dayIndex":N,"title":"Nom lieu","search_query":"Nom lieu Ville Japan","time":"HH:MM","duration_minutes":N,"note":"conseil court"}
  * Déplacer : {"type":"move","activity_id":N,"new_time":"HH:MM"}
  * Supprimer : {"type":"remove","activity_id":N}
  * Rien : actions:[]
- Si l'utilisateur dit "oui" ou confirme, EXECUTE les actions proposées dans le message précédent.
- Si l'utilisateur demande d'ajouter des activités sur un autre jour, utilise le bon dayIndex.
- Propose max 3 activités à la fois.
- Utilise des lieux japonais réels avec leur nom en japonais entre parenthèses.
- Ne promets JAMAIS d'ajouter si tu ne mets pas l'action correspondante dans "actions".`;

        const history = (context.history || []).slice(-8).map(m => ({
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
                max_tokens: 800,
                system: systemPrompt,
                messages: [...history, { role: 'user', content: message }]
            })
        });

        const data = await r.json();
        if (!r.ok) return res.status(500).json({ success: false, error: data.error?.message || 'Erreur Anthropic' });

        const raw = data.content?.[0]?.text || '{}';
        let parsed;
        try {
            parsed = JSON.parse(sanitizeJson(raw));
        } catch(e) {
            // Fallback : texte pur sans actions
            parsed = { reply: raw.replace(/\{[\s\S]*\}/g, '').trim() || raw, actions: [] };
        }

        // ── Résoudre les lieux via Google Places pour chaque action "add" ──
        const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
        const resolvedActions = [];
        for (const action of (parsed.actions || [])) {
            if (action.type === 'add' && serverKey) {
                try {
                    const query = action.search_query || action.title;
                    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
                    searchUrl.searchParams.set('query', query);
                    searchUrl.searchParams.set('language', 'fr');
                    searchUrl.searchParams.set('key', serverKey);
                    const placesRes = await fetchJson(searchUrl.toString(), {}, 6000);
                    const first = placesRes.json?.results?.[0];
                    if (first) {
                        action.place = {
                            place_id: first.place_id,
                            name: first.name,
                            formatted_address: first.formatted_address,
                            lat: first.geometry?.location?.lat,
                            lng: first.geometry?.location?.lng,
                            types: first.types || [],
                            rating: first.rating || null,
                            user_ratings_total: first.user_ratings_total || 0,
                            photo_reference: first.photos?.[0]?.photo_reference || null,
                            rating_source: 'google'
                        };
                    }
                } catch(e) {
                    console.warn('[ai-planner] place resolve failed:', e.message);
                }
            }
            resolvedActions.push(action);
        }

        res.json({ success: true, reply: parsed.reply || '', actions: resolvedActions });
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
// ── GÉNÉRATION DE PROGRAMME COMPLET ─────────────────────────────────────────
app.post("/api/generate-program", async (req, res) => {
    try {
        const { zone: zoneRaw, hotel_name, hotel_address, nb_days, start_day_index, start_date, intensity, existing_activities, traveler_profile } = req.body;
        // Normaliser la zone : "Osaka, Préfecture d'Osaka, Japon" → "Osaka"
        // "Yao, Préfecture d'Osaka" → "Yao" (ville réelle, pas la métropole)
        const zone = zoneRaw ? zoneRaw.split(',')[0].trim() : '';
        const profileCtx = buildProfileContext(traveler_profile);
        if (!zone || !nb_days) return res.status(400).json({ success: false, error: 'Zone et nb_days requis' });

        const dayNames = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
        const intensityProfiles = {
            relax:   { n: 2, mealDur: {breakfast:25,lunch:55,dinner:70}, startHour:'08:30' },
            normal:  { n: 3, mealDur: {breakfast:20,lunch:45,dinner:60}, startHour:'08:00' },
            intense: { n: 4, mealDur: {breakfast:15,lunch:35,dinner:55}, startHour:'07:30' }
        };
        const profile = intensityProfiles[intensity||'normal'];
        const existingTitles = (existing_activities||[]).map(a=>(a.title||'').toLowerCase()).slice(0,10);

        // Règles transit selon zone
        const getTransitRules = (z) => {
            const zl = z.toLowerCase();
            if (zl.includes('tokyo')) return 'Tokyo: meme quartier=12min marche, adjacent=20min metro, eloigne=35min metro, heure pointe +12min';
            if (zl.includes('kyoto')) return 'Kyoto: centre=15min, Arashiyama=30min JR, Fushimi=15min Keihan, Nara=45min Kintetsu';
            return 'Calculer transit realiste point a point selon distance';
        };

        const getDayInfo = (i) => {
            const dayIdx = (start_day_index||0) + i;
            if (!start_date) return { index: dayIdx, name: 'Jour '+(i+1), isWeekend:false, isMonday:false, isFriday:false };
            // Parse en local (évite le décalage UTC)
            const [y,mo,dd] = start_date.split('T')[0].split('-').map(Number);
            const d = new Date(y, mo-1, dd);
            d.setDate(d.getDate() + dayIdx);
            const dow = d.getDay();
            return { index: dayIdx, name: dayNames[dow], isWeekend: dow===0||dow===6,
                     isMonday: dow===1, isFriday: dow===5, isSaturday: dow===6, isSunday: dow===0,
                     date: d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'}) };
        };

        // ── Génération jour par jour pour éviter troncature JSON ──────────────
        const allDays = [];
        let globalSummary = '';

        for (let di = 0; di < nb_days; di++) {
            const dayInfo = getDayInfo(di);
            const dayNote = dayInfo.isMonday ? 'LUNDI: pas de musees, privilegier parcs/quartiers/shopping' :
                            dayInfo.isSaturday ? 'SAMEDI: forte affluence, temples avant 9h' :
                            dayInfo.isSunday ? 'DIMANCHE: forte affluence, familles dans les parcs' :
                            dayInfo.isFriday ? 'VENDREDI: affluence montante apres 14h' :
                            'Semaine: creneaux ideaux 14h-17h pour musees';

            const prompt = `Expert voyages Japon. Genere 1 journee complete a ${zone} pour le ${dayInfo.name} (${dayInfo.date||'jour '+(di+1)}).
Hotel: ${hotel_name||'centre-ville'}${hotel_address?' ('+hotel_address+')':''}
Intensite: ${intensity||'normal'} — ${profile.n} activites culturelles
Note jour: ${dayNote}
Transits: ${getTransitRules(zone)}
Deja planifie (a eviter): ${existingTitles.join(', ')||'aucun'}

STRUCTURE OBLIGATOIRE:
- hotel_start a ${profile.startHour}
- breakfast konbini/kissaten (${profile.mealDur.breakfast}min)
- transit + activity x${profile.n} avec transit entre chaque
- lunch teishoku local (${profile.mealDur.lunch}min)
- transit + activity suite
- transit + dinner izakaya (${profile.mealDur.dinner}min)
- hotel_end avant 22h

${profileCtx}
REGLES:
- Grouper les activites par quartier (min de transit)
- Jamais 2 temples consecutifs
- 1 activite hors-touristes minimum
- Titres courts (max 30 chars)
- Notes courtes (max 60 chars)

JSON BRUT UNIQUEMENT (pas de markdown):
{
  "day_index": ${dayInfo.index},
  "day_label": "Quartier1 & Quartier2",
  "quartiers": ["Q1","Q2"],
  "blocks": [
    {"type":"hotel_start","time":"08:00","title":"Depart hotel","duration_minutes":0},
    {"type":"transit","time":"08:00","title":"Hotel vers Q1","duration_minutes":20,"from":"Hotel","to":"Q1","mode":"metro","note":"Ligne X"},
    {"type":"meal","meal_type":"breakfast","time":"08:20","title":"Konbini 7-Eleven","duration_minutes":15,"quartier":"Q1","suggestion":"Onigiri + cafe ~300Y","local_tip":"Manger devant le temple"},
    {"type":"transit","time":"08:35","title":"Marche vers A1","duration_minutes":5,"from":"Konbini","to":"A1","mode":"walk","note":""},
    {"type":"activity","time":"08:40","title":"Activite 1","search_query":"Activite 1 ${zone}","duration_minutes":80,"local_tip":"Conseil court","crowd_note":"Peu de monde avant 9h"},
    {"type":"transit","time":"10:00","title":"Metro vers Q2","duration_minutes":20,"from":"Q1","to":"Q2","mode":"metro","note":""},
    {"type":"activity","time":"10:20","title":"Activite 2","search_query":"Activite 2 ${zone}","duration_minutes":100,"local_tip":"Conseil court","crowd_note":""},
    {"type":"transit","time":"12:00","title":"Vers restaurant","duration_minutes":10,"from":"Q2","to":"Resto","mode":"walk","note":""},
    {"type":"meal","meal_type":"lunch","time":"12:10","title":"Dejeuner teishoku","duration_minutes":${profile.mealDur.lunch},"quartier":"Q2","suggestion":"Teishoku poisson+riz ~900Y","local_tip":"Eviter les rues principales"},
    {"type":"transit","time":"13:00","title":"Vers Q3","duration_minutes":15,"from":"Q2","to":"Q3","mode":"metro","note":""},
    {"type":"activity","time":"13:15","title":"Activite 3","search_query":"Activite 3 ${zone}","duration_minutes":90,"local_tip":"Conseil court","crowd_note":"Ideal apres 13h"},
    {"type":"transit","time":"15:00","title":"Vers diner","duration_minutes":20,"from":"Q3","to":"Quartier diner","mode":"metro","note":""},
    {"type":"meal","meal_type":"dinner","time":"15:20","title":"Diner izakaya","duration_minutes":${profile.mealDur.dinner},"quartier":"Quartier diner","suggestion":"Yakitori + biere ~2000Y","local_tip":"Comptoir face au chef"},
    {"type":"transit","time":"16:20","title":"Retour hotel","duration_minutes":25,"from":"Quartier diner","to":"Hotel","mode":"metro","note":""},
    {"type":"hotel_end","time":"16:45","title":"Retour hotel","duration_minutes":0}
  ]
}`;

            const raw = await anthropicChat(
                "Expert voyages Japon. Reponds UNIQUEMENT avec le JSON demande, SANS backticks, SANS texte avant ou apres. Utilise uniquement des guillemets doubles. Titres et notes en francais.",
                prompt, 3000
            );

            let dayParsed;
            try { dayParsed = JSON.parse(raw); }
            catch(e) {
                try { dayParsed = JSON.parse(sanitizeJson(raw)); }
                catch(e2) {
                    console.error(`Jour ${di+1} JSON invalide:`, e2.message, raw.slice(0,200));
                    // Fallback minimal pour ce jour
                    dayParsed = {
                        day_index: dayInfo.index,
                        day_label: zone,
                        quartiers: [zone],
                        blocks: [
                            {type:'hotel_start', time: profile.startHour, title:'Depart hotel', duration_minutes:0},
                            {type:'activity', time:'09:00', title:`Exploration ${zone}`, search_query:`tourist attractions ${zone}`, duration_minutes:180, local_tip:'Journee libre', crowd_note:''},
                            {type:'meal', meal_type:'lunch', time:'12:00', title:'Dejeuner local', duration_minutes:45, quartier:zone, suggestion:'Restaurant de quartier', local_tip:''},
                            {type:'activity', time:'14:00', title:`${zone} centre`, search_query:`${zone} center attractions`, duration_minutes:120, local_tip:'', crowd_note:''},
                            {type:'meal', meal_type:'dinner', time:'19:00', title:'Diner izakaya', duration_minutes:60, quartier:zone, suggestion:'Izakaya local', local_tip:''},
                            {type:'hotel_end', time:'20:30', title:'Retour hotel', duration_minutes:0}
                        ]
                    };
                }
            }

            allDays.push(dayParsed);
            if (di === 0) globalSummary = `Programme ${nb_days} jour(s) a ${zone} — ${intensity||'normal'}`;
        }

        res.json({ success: true, program: allDays, summary: globalSummary });

    } catch(e) {
        console.error('generate-program error:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});


// ── RÉSOLUTION PLACE DIRECTE (sans IA, pour generate-program) ───────────────
app.post("/api/resolve-place", async (req, res) => {
    try {
        const { search_query, title } = req.body;
        const query = search_query || title;
        if (!query) return res.json({ success: false, error: "query manquant" });

        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");

        // ── Étape 1 : TextSearch (7s max) ─────────────────────────────────
        const searchUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
        searchUrl.searchParams.set("query", query);
        searchUrl.searchParams.set("language", "fr");
        searchUrl.searchParams.set("key", serverKey);

        let first;
        try {
            const placesRes = await fetchJson(searchUrl.toString(), {}, 7000);
            first = placesRes.json?.results?.[0];
        } catch(e) {
            console.warn("[resolve-place] textsearch timeout:", query);
            return res.json({ success: false, error: "Timeout recherche" });
        }

        if (!first) return res.json({ success: false, error: "Lieu non trouvé: " + query });

        // ── Étape 2 : Details (6s max) — optionnel, fallback sur textsearch ─
        let place = null;
        try {
            const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            detailsUrl.searchParams.set("place_id", first.place_id);
            detailsUrl.searchParams.set("fields", "place_id,name,formatted_address,geometry,opening_hours,price_level,types,rating,user_ratings_total,photos,website");
            detailsUrl.searchParams.set("language", "fr");
            detailsUrl.searchParams.set("key", serverKey);
            const detailsRes = await fetchJson(detailsUrl.toString(), {}, 6000);
            place = detailsRes.json?.result || null;
        } catch(e) {
            console.warn("[resolve-place] details timeout, fallback textsearch:", query);
        }

        // Fallback : construire depuis le résultat textsearch si details a échoué
        if (!place) {
            place = {
                place_id: first.place_id,
                name: first.name,
                formatted_address: first.formatted_address,
                geometry: first.geometry,
                types: first.types || [],
                rating: first.rating || null,
                user_ratings_total: first.user_ratings_total || 0,
                photos: first.photos || [],
                price_level: first.price_level ?? null,
                opening_hours: null
            };
        }

        const photo = place.photos?.[0]?.photo_reference || null;

        res.json({
            success: true,
            place: {
                place_id: place.place_id,
                name: place.name,
                formatted_address: place.formatted_address,
                lat: place.geometry?.location?.lat,
                lng: place.geometry?.location?.lng,
                opening_hours: place.opening_hours?.weekday_text || null,
                price_level: place.price_level ?? null,
                types: place.types || [],
                rating: place.rating || null,
                user_ratings_total: place.user_ratings_total || 0,
                photo_reference: photo,
                website: place.website || null,
                rating_source: 'google'
            }
        });
    } catch(e) {
        console.error("[resolve-place] error:", e.message);
        res.json({ success: false, error: e.message });
    }
});


app.post("/api/optimize-day", async (req, res) => {
    try {
        const { activities, day_index, hotel, traveler_profile: tp_opt } = req.body;
        const profileCtxOpt = buildProfileContext(tp_opt);

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

        const dayDate = (() => {
            try {
                const d = new Date(req.body.start_date || Date.now());
                d.setDate(d.getDate() + (day_index || 0));
                return d;
            } catch(e) { return new Date(); }
        })();
        const dayOfWeek = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][dayDate.getDay()];
        const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
        const fatigueMode = req.body.fatigue_mode || false;
        const weatherMode = req.body.weather_mode || false;

        // ── Prompt ultra-compact pour éviter la troncature JSON ──────────────
        const actListStr = activitiesContext.map(a =>
            '- id:' + a.id + ' "' + a.title + '" (' + a.place + ') a ' + a.current_time
        ).join('\n');
        const contexte = dayOfWeek
            + (isWeekend ? ' (weekend, affluence élevée)' : ' (semaine)')
            + (fatigueMode ? ' | Mode fatigue: reduire intensite, pause apres-midi' : '')
            + (weatherMode ? ' | Privilegier activites couvertes' : '')
            + (hotelName ? ' | Depart: ' + hotelName : '');
        const regles = 'Grouper par quartier, respecter horaires (musees fermes lundi), marges 15-25min, durees: temple 60-90min, musee 90-150min, resto 45min.'
            + (isWeekend ? ' Weekend: temples avant 9h ou apres 16h.' : '')
            + (fatigueMode ? ' Fatigue: -20% durees, pause 45min apres 13h.' : '');
        const prompt = 'Optimise cette journee au Japon. Reponds UNIQUEMENT en JSON brut valide.\n'
            + profileCtxOpt + '\n'
            + 'Contexte: ' + contexte + '\n\n'
            + 'Activites:\n' + actListStr + '\n\n'
            + regles + '\n\n'
            + 'REPONSE: JSON brut, ' + validActivities.length + ' objets dans optimized_activities.\n'
            + 'Format: {"optimized_activities":[{"id":NUM,"time":"HH:MM","duration_minutes":NUM,"breathing_after_minutes":NUM,"breathing_reason":"txt","reason":"txt","local_tip":"txt","time_changed":BOOL}],"day_summary":"txt","energy_level":"txt","warnings":[]}\n'
            + 'IMPORTANT: Inclure TOUTES les ' + validActivities.length + ' activites. Textes courts (<60 chars).\n';

        const completionText = await anthropicChat(
            "Expert Japon. JSON brut uniquement, SANS backticks ni markdown.",
            prompt, 4000);

        let result;
        try {
            result = JSON.parse(sanitizeJson(completionText));
        } catch(parseErr) {
            // Tentative de réparation : extraire le tableau optimized_activities même si JSON tronqué
            const arrMatch = completionText.match(/"optimized_activities"\s*:\s*(\[[\s\S]*)/);
            if (arrMatch) {
                try {
                    let partial = arrMatch[1];
                    // Fermer le tableau et l'objet si tronqué
                    const openBrackets = (partial.match(/\[/g)||[]).length - (partial.match(/\]/g)||[]).length;
                    const openBraces  = (partial.match(/\{/g)||[]).length - (partial.match(/\}/g)||[]).length;
                    for (let i=0; i<openBraces; i++) partial += '}';
                    for (let i=0; i<openBrackets; i++) partial += ']';
                    const repaired = `{"optimized_activities":${sanitizeJson(partial)},"day_summary":"","energy_level":"modérée","warnings":[]}`;
                    result = JSON.parse(repaired);
                    console.warn('[optimize-day] JSON réparé après troncature');
                } catch(e2) {
                    throw new Error(`JSON invalide : ${parseErr.message}`);
                }
            } else {
                throw new Error(`JSON invalide : ${parseErr.message}`);
            }
        }
        if (!result?.optimized_activities) throw new Error('Structure JSON inattendue');

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
        // ── Fallback : retourner les activités non-modifiées plutôt que d'échouer ──
        // Permet au client d'afficher un mode édition pour que l'utilisateur reprenne
        const { activities } = req.body || {};
        const validFallback = (activities || []).filter(a => a.place && a.place.name);
        if (validFallback.length > 0) {
            console.warn('[optimize-day] Fallback: retour activités originales non optimisées');
            return res.json({
                success: false,
                partial: true,
                error: e.message,
                optimized_activities: validFallback.map(a => ({
                    id: a.id,
                    time: a.time,
                    title: a.title,
                    description: a.description || '',
                    place: a.place,
                    reason: '',
                    breathing_after_minutes: 0,
                    breathing_reason: '',
                    duration_minutes: a.duration_minutes || 60,
                    time_changed: false
                })),
                day_summary: '',
                energy_level: ''
            });
        }
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
