export default async function handler(req, res) {
  try {
    const { origin, destination } = req.query;
    if (!origin || !destination) {
      return res.status(400).json({ error: "Missing origin/destination" });
    }

    const key = process.env.GOOGLE_MAPS_KEY;
    if (!key) return res.status(500).json({ error: "Missing GOOGLE_MAPS_KEY" });

    const url =
      "https://maps.googleapis.com/maps/api/directions/json" +
      `?origin=${encodeURIComponent(origin)}` +
      `&destination=${encodeURIComponent(destination)}` +
      `&mode=transit` +
      `&transit_mode=rail` + // rail = train+tram+subway :contentReference[oaicite:6]{index=6}
      `&language=fr&region=jp` +
      `&key=${encodeURIComponent(key)}`;

    const r = await fetch(url);
    const data = await r.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
