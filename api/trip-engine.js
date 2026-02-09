export default async function handler(req, res) {
    // Sécurité : Uniquement du POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { activity, city, originStation } = req.body;
    
    // On définit un point de départ par défaut si non précisé
    const startPoint = originStation || `${city} Station, Japan`;

    try {
        // --- ÉTAPE 1 : RÉCUPÉRATION DE L'ADRESSE (CLAUDE) ---
        let destination = `${activity}, ${city}, Japan`; // Valeur par défaut
        
        try {
            const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': process.env.CLAUDE_API_KEY,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: "claude-3-haiku-20240307",
                    max_tokens: 40,
                    system: "Tu es un convertisseur GPS. Format unique : Nom, Ville, Japon. Pas de texte.",
                    messages: [{ role: "user", content: `Adresse pour : ${activity} à ${city}` }]
                })
            });
            const claudeData = await claudeRes.json();
            if (claudeData.content) {
                destination = claudeData.content[0].text.split('\n')[0].trim();
            }
        } catch (e) {
            console.log("Claude Offline - Using Fallback Address");
        }

        // --- ÉTAPE 2 : CALCUL GOOGLE DIRECTIONS ---
        const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(startPoint)}&destination=${encodeURIComponent(destination)}&mode=transit&transit_mode=rail&language=fr&key=${process.env.GOOGLE_MAPS_KEY}`;
        
        const googleRes = await fetch(googleUrl);
        const gData = await googleRes.json();

        if (gData.status !== "OK") throw new Error(`Google Error: ${gData.status}`);

        const route = gData.routes[0].legs[0];

        // --- ÉTAPE 3 : PARSING DES DONNÉES ---
        let walkTime = 0;
        let transfers = 0;

        route.steps.forEach(s => {
            if (s.travel_mode === "WALKING") walkTime += Math.round(s.duration.value / 60);
            if (s.travel_mode === "TRANSIT") transfers++;
        });

        // Envoi de la réponse "clé en main"
        return res.status(200).json({
            status: "success",
            data: {
                destinationName: destination,
                duration: route.duration.text,
                walkingTime: `${walkTime} min`,
                transfers: transfers > 1 ? transfers - 1 : 0,
                arrivalTime: route.arrival_time ? route.arrival_time.text : "N/A",
                distance: route.distance.text
            }
        });

    } catch (error) {
        return res.status(500).json({ status: "error", message: error.message });
    }
}