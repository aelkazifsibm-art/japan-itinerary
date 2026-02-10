import { verifyAppCheckToken } from "./_appcheck.js";

// Optionnel: active seulement si tu as configuré App Check
if (process.env.ENFORCE_APP_CHECK === "1") {
  const ok = await verifyAppCheckToken(req);
  if (!ok) return json(res, 401, { error: "App Check required" });
}


import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw));
  });
}

function getClientIp(req) {
  // Vercel: x-forwarded-for = "ip, proxy, proxy"
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

/**
 * RATE LIMIT (in-memory)
 * Note: sur serverless, ce cache/limit peut se reset.
 * Mais ça protège déjà beaucoup en pratique + tu peux compléter avec quotas Google.
 */
const RL = new Map(); // ip -> {count, resetAt}
const WINDOW_MS = 60_000; // 1 min
const MAX_REQ_PER_WINDOW = 20; // ajuste (ex: 10, 20, 30)

/**
 * CACHE (in-memory)
 * key -> {expiresAt, value}
 */
const CACHE = new Map();
const CACHE_TTL_MS = 10 * 60_000; // 10 min
const CACHE_MAX = 500; // évite de grossir

function cacheGet(key) {
  const entry = CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    CACHE.delete(key);
    return null;
  }
  return entry.value;
}
function cacheSet(key, value) {
  if (CACHE.size > CACHE_MAX) {
    // purge simple : enlève 20 entrées arbitraires
    let i = 0;
    for (const k of CACHE.keys()) {
      CACHE.delete(k);
      if (++i >= 20) break;
    }
  }
  CACHE.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
}

function clampText(s, max = 180) {
  if (!s) return "";
  return String(s).trim().replace(/\s+/g, " ").slice(0, max);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return json(res, 405, { error: "Method Not Allowed" });

    // --- Rate limit ---
    const ip = getClientIp(req);
    const now = Date.now();
    const current = RL.get(ip);
    if (!current || now > current.resetAt) {
      RL.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      current.count += 1;
      if (current.count > MAX_REQ_PER_WINDOW) {
        return json(res, 429, { error: "Rate limit" });
      }
    }

    const raw = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(raw || "{}");
    } catch {
      return json(res, 400, { error: "Invalid JSON" });
    }

    const from = clampText(payload.from);
    const intent = clampText(payload.intent);
    const departureTime = payload.departureTime
      ? Number(payload.departureTime)
      : Math.floor(Date.now() / 1000);

    if (!from || !intent) return json(res, 400, { error: "Missing from/intent" });
    if (!process.env.OPENAI_API_KEY) return json(res, 500, { error: "Missing OPENAI_API_KEY" });
    if (!process.env.GOOGLE_MAPS_API_KEY) return json(res, 500, { error: "Missing GOOGLE_MAPS_API_KEY" });

    // --- Cache key (stable) ---
    const cacheKey = JSON.stringify({
      from,
      intent,
      // on arrondit l’heure de départ à 5 min pour améliorer le cache
      t: Math.floor(departureTime / 300) * 300
    });

    const cached = cacheGet(cacheKey);
    if (cached) return json(res, 200, cached);

    // 1) IA : intention floue -> requête Places (1 ligne)
    const ai = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Tu convertis une intention floue en un lieu réel au Japon utilisable par Google Places.\n" +
            "Réponds UNE seule ligne. Aucune explication.\n" +
            "Exemples:\n" +
            "voir les daims -> Nara Park, Nara, Japan\n" +
            "temple rouge -> Fushimi Inari Taisha, Kyoto, Japan\n" +
            "quartier animé le soir -> Dotonbori, Osaka, Japan\n" +
            "Si trop vague, réponds exactement: ❌"
        },
        { role: "user", content: intent }
      ]
    });

    const placeQuery = (ai.choices?.[0]?.message?.content || "").trim();
    if (!placeQuery || placeQuery === "❌") return json(res, 422, { error: "Unreliable intent->place" });

    // 2) Places
    const placesUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
    placesUrl.searchParams.set("input", placeQuery);
    placesUrl.searchParams.set("inputtype", "textquery");
    placesUrl.searchParams.set("fields", "place_id,geometry,name,formatted_address");
    placesUrl.searchParams.set("language", "fr");
    placesUrl.searchParams.set("region", "jp");
    placesUrl.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY);

    const placesResp = await fetch(placesUrl.toString());
    const placesJson = await placesResp.json();

    const candidate = placesJson?.candidates?.[0];
    if (!candidate?.place_id || !candidate?.geometry?.location) {
      return json(res, 422, { error: "No reliable place found" });
    }

    const { lat, lng } = candidate.geometry.location;

    // 3) Directions (TRANSIT)
    const dirUrl = new URL("https://maps.googleapis.com/maps/api/directions/json");
    dirUrl.searchParams.set("origin", from);
    dirUrl.searchParams.set("destination", `${lat},${lng}`);
    dirUrl.searchParams.set("mode", "transit");
    dirUrl.searchParams.set("departure_time", String(departureTime));
    dirUrl.searchParams.set("language", "fr");
    dirUrl.searchParams.set("region", "jp");
    dirUrl.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY);

    const dirResp = await fetch(dirUrl.toString());
    const dirJson = await dirResp.json();

    const leg = dirJson?.routes?.[0]?.legs?.[0];
    if (!leg?.duration?.value || !leg?.arrival_time?.text) {
      return json(res, 422, { error: "No reliable route found", details: dirJson?.status || "unknown" });
    }

    const totalMinutes = Math.round((leg.duration.value || 0) / 60);
    const arrival = String(leg.arrival_time.text).trim();

    const steps = Array.isArray(leg.steps) ? leg.steps : [];
    const transitSteps = steps.filter((s) => s.travel_mode === "TRANSIT");
    const walkSeconds = steps
      .filter((s) => s.travel_mode === "WALKING")
      .reduce((acc, s) => acc + (s?.duration?.value || 0), 0);

    const walkMinutes = Math.round(walkSeconds / 60);
    const transfers = Math.max(0, transitSteps.length - 1);

    const result = {
      lines: [
        `🚇 ${totalMinutes} min (${transfers} corresp.)`,
        `🚶 ${walkMinutes} min marche`,
        `⏱️ Arrivée:\n${arrival}\n✅`
      ]
    };

    cacheSet(cacheKey, result);
    return json(res, 200, result);
  } catch (e) {
    return json(res, 500, { error: "Server error", detail: String(e?.message || e) });
  }
}
