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
        max_tokens: 20, 
        // Le secret est ici : on lui donne un rôle de base de données
        system: "Tu es une API de géolocalisation. Tu ne parles pas. Tu réponds UNIQUEMENT par : Nom du lieu, Ville, Code Postal, Japan. Si tu fais une phrase, le système plante.",
        messages: [
          { role: "user", content: `Lieu: ${prompt}` },
          { role: "assistant", content: "Résultat:" } // On pré-remplit le début de sa réponse pour le guider
        ]
      })
    });

    const data = await response.json();
    let text = data.content[0].text.trim();
    
    // On nettoie tout ce qui n'est pas l'adresse
    text = text.split('\n')[0].replace("Résultat:", "").trim();

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ result: text });
  } catch (err) {
    return res.status(500).json({ error: "Erreur serveur" });
  }
}