export default async function handler(req, res) {
  const { origin, destination } = req.query;
  const apiKey = process.env.GOOGLE_DISTANCE_MATRIX_KEY;

  if (!origin || !destination) {
    return res.status(400).json({ error: "Origine ou destination manquante" });
  }

  // mode=transit : Force le calcul en transport (Train/Métro/Bus + Marche)
  // transit_mode=train|subway : On privilégie le rail (comme au Japon)
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=transit&transit_mode=train|subway&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Erreur connexion Google Maps" });
  }
}