export default async function handler(req, res) {
  const { origin, destination } = req.query;
  const apiKey = process.env.GOOGLE_DISTANCE_MATRIX_KEY;

  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=transit&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Erreur Google Maps" });
  }
}