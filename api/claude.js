export default async function handler(req, res) {
  try {
    const { prompt } = req.query;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 15,
        system: "Tu es un assistant de recherche Google Maps. Tu réponds UNIQUEMENT le nom du lieu et la ville. Pas de phrases. Pas d'explications. Pas de ponctuation.",
        messages: [{ role: "user", content: `Donne l'adresse pour : ${prompt}` }]
      })
    });

    const data = await response.json();
    // On extrait le texte et on nettoie les résidus
    const textClean = data.content[0].text.split('\n')[0].replace(/[".]/g, "").trim();
    
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ result: textClean });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}