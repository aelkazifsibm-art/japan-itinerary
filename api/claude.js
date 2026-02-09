export default async function handler(req, res) {
  try {
    const { prompt } = req.query;
    const key = process.env.CLAUDE_API_KEY; // Assure-toi que c'est le nom exact sur Vercel

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}