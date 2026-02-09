export default async function handler(req, res) {
  try {
    const { prompt } = req.query;

    if (!process.env.CLAUDE_API_KEY) {
      throw new Error("Clé API manquante");
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 40, // On coupe la parole si c'est trop long
        system: `Tu es un moteur de recherche d'adresses pour le Japon.
        MISSION : Convertir une activité ou un lieu vague en l'ADRESSE EXACTE ou la GARE la plus proche pour Google Maps.
        
        RÈGLES ABSOLUES :
        1. Réponds UNIQUEMENT le lieu précis + Ville + Japon.
        2. PAS de phrases, PAS de politesse.
        3. Si c'est une activité (ex: "Voir les daims"), donne le lieu (ex: "Nara Park").
        4. Si c'est un déplacement, donne la GARE (ex: "Shinjuku Station").

        EXEMPLES :
        Input: "Voir les daims à Nara" -> Output: Nara Park, Nara, Japan
        Input: "Manger au marché à Osaka" -> Output: Kuromon Ichiba Market, Osaka, Japan
        Input: "Prendre le train à Saitama" -> Output: Saitama-Shintoshin Station, Saitama, Japan
        Input: "Aller à Shibuya" -> Output: Shibuya Station, Tokyo, Japan`,
        messages: [{ role: "user", content: `Convertis en adresse de recherche : ${prompt}` }]
      })
    });

    const data = await response.json();
    
    // NETTOYAGE CHIRURGICAL : On garde uniquement la première ligne
    // On enlève les points finaux et les guillemets éventuels
    let cleanAddress = data.content[0].text.split('\n')[0].replace(/[".]/g, "").trim();
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ result: cleanAddress });

  } catch (err) {
    console.error("Erreur API Claude:", err);
    return res.status(500).json({ error: "Erreur interne IA" });
  }
}