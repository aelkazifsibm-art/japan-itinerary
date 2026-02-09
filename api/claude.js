export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const key = process.env.CLAUDE_API_KEY;
    if (!key) return res.status(500).json({ error: "Missing CLAUDE_API_KEY on Vercel" });

    // --- lire le body (req.body parfois vide selon config) ---
    let body = req.body;
    if (!body) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString("utf8");
      body = raw ? JSON.parse(raw) : {};
    }

    const prompt = (body?.prompt ?? "").toString().trim();
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt (empty)" });
    }

    // --- payload officiel Anthropics: messages[*].content = array de blocks ---
    const payload = {
      model: "claude-3-haiku-20240307",
      max_tokens: 60,
      temperature: 0,
      system: [
        {
          type: "text",
          text:
            "Tu es un robot de géolocalisation. Tu ne parles pas. Tu réponds UNIQUEMENT par UNE ligne au format : Nom Officiel du Lieu, Code Postal, Quartier, Ville, Japan. AUCUNE phrase. AUCUN commentaire."
        }
      ],
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "Trouve l'adresse exacte pour Maps de : " + prompt }]
        }
      ]
    };

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json();

    if (!r.ok) {
      // IMPORTANT: on renvoie aussi le payload envoyé (sans la clé) pour debug
      return res.status(r.status).json({
        error: "Anthropic error",
        anthropic: data,
        sent: payload
      });
    }

    const text = (data?.content?.[0]?.text || "").trim();
    const clean = text.split("\n")[0].trim();

    // Marqueur de version pour vérifier que Vercel sert bien le bon fichier
    return res.status(200).json({ result: clean, v: "claude_api_v2" });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
