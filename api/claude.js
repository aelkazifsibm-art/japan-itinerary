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
        model: "claude-opus-4-6",
        max_tokens: 60,
        system:
          "Tu es un robot de géolocalisation. Tu ne parles pas. Tu réponds UNIQUEMENT par UNE ligne au format : Nom Officiel du Lieu, Code Postal, Quartier, Ville, Japan. AUCUNE phrase.",
        messages: [
          { role: "user", content: "Trouve l'adresse exacte pour Maps de : " + prompt },
          { role: "assistant", content: "Résultat:" }
        ]
      })
    });

    const data = await response.json();
    const text = (data?.content?.[0]?.text || "").replace("Résultat:", "").trim();
    const clean = text.split("\n")[0].trim();

    return res.status(200).json({ result: clean });
  } catch (e) {
    return res.status(500).json({ error: "server error", details: String(e) });
  }
}
