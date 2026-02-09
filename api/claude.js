export default async function handler(req, res) {
  try {
    const { prompt } = req.query;
    if (!prompt) return res.status(400).json({ error: "missing prompt" });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
     body: JSON.stringify({
  model: "claude-3-haiku-20240307",
  max_tokens: 60,
  temperature: 0,
  system: [
    {
      type: "text",
      text: "Tu es un robot de géolocalisation. Tu ne parles pas. Tu réponds UNIQUEMENT par UNE ligne au format : Nom Officiel du Lieu, Code Postal, Quartier, Ville, Japan. AUCUNE phrase. AUCUN commentaire."
    }
  ],
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Trouve l'adresse exacte pour Maps de : " + prompt }
      ]
    },
    {
      role: "assistant",
      content: [
        { type: "text", text: "Résultat:" }
      ]
    }
  ]
})

