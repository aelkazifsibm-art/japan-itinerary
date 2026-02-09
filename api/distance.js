export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { origin, destination, mode = "transit" } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ error: "Missing origin or destination" });
    }

    const key = process.env.GOOGLE_DISTANCE_MATRIX_KEY;
    if (!key) {
      return res.status(500).json({ error: "Missing GOOGLE_DISTANCE_MATRIX_KEY" });
    }

    const url =
      "https://maps.googleapis.com/maps/api/distancematrix/json" +
      `?origins=${encodeURIComponent(origin)}` +
      `&destinations=${encodeURIComponent(destination)}` +
      `&mode=${encodeURIComponent(mode)}` +
      `&language=fr&region=jp` +
      `&key=${encodeURIComponent(key)}`;

    const response = await fetch(url);
    const data = await response.json();

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: "Server error",
      details: String(err)
    });
  }
}
