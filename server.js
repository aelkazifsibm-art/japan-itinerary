const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API Keys from environment variables
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_BROWSER_KEY || process.env.GOOGLE_MAPS_SERVER_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;

// ========== GOOGLE PLACES API ==========

// Autocomplete pour les adresses d'hôtel
app.get('/api/places/autocomplete', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ predictions: [] });
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&language=fr&components=country:jp`
        );
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Places autocomplete error:', error);
        res.status(500).json({ error: 'Erreur autocomplete' });
    }
});

// Détails d'un lieu
app.get('/api/places/details', async (req, res) => {
    try {
        const placeId = req.query.place_id;
        if (!placeId) {
            return res.status(400).json({ error: 'place_id manquant' });
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_MAPS_API_KEY}&language=fr`
        );
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Places details error:', error);
        res.status(500).json({ error: 'Erreur détails lieu' });
    }
});

// ========== OPENAI API ==========

// Normaliser le texte d'une activité
app.post('/api/normalize-text', async (req, res) => {
    try {
        const { text } = req.body;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Tu es un assistant qui normalise les noms de lieux touristiques au Japon. Réponds UNIQUEMENT avec le nom normalisé, rien d\'autre.'
                    },
                    {
                        role: 'user',
                        content: `Normalise ce nom de lieu au Japon: "${text}"`
                    }
                ],
                temperature: 0.3,
                max_tokens: 100
            })
        });

        const data = await response.json();
        const normalized = data.choices[0].message.content.trim();
        
        res.json({ normalized });
    } catch (error) {
        console.error('Normalize text error:', error);
        res.status(500).json({ error: 'Erreur normalisation' });
    }
});

// Ajout rapide d'activité avec IA
app.post('/api/quick-add-activity', async (req, res) => {
    try {
        const { text, city } = req.body;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Tu es un expert du tourisme au Japon. Analyse le texte de l'utilisateur et retourne un JSON avec:
{
  "name": "nom de l'activité",
  "duration": durée en minutes (ex: 120),
  "category": "visite" | "restaurant" | "transport" | "pause",
  "mustSee": true/false (si c'est un incontournable),
  "fatigueLevel": 1-3 (1=repos, 2=modéré, 3=intense)
}`
                    },
                    {
                        role: 'user',
                        content: `Ville: ${city || 'Tokyo'}\nTexte: ${text}`
                    }
                ],
                temperature: 0.5,
                max_tokens: 200
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        // Extraire le JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const activity = JSON.parse(jsonMatch[0]);
            res.json(activity);
        } else {
            throw new Error('Pas de JSON dans la réponse');
        }
    } catch (error) {
        console.error('Quick add activity error:', error);
        res.status(500).json({ error: 'Erreur ajout activité' });
    }
});

// Optimisation du planning d'une journée
app.post('/api/optimize-day', async (req, res) => {
    try {
        const { activities, city, weather, fatigueMode } = req.body;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Tu es un expert en optimisation d'itinéraires touristiques au Japon. 
Analyse les activités et propose un ordre optimal en tenant compte:
- De la proximité géographique
- Des horaires d'ouverture
- De la fatigue (si activé)
- De la météo (si fournie)
Retourne un JSON: { "optimizedOrder": [indices des activités dans l'ordre optimal], "reasoning": "explication courte" }`
                    },
                    {
                        role: 'user',
                        content: JSON.stringify({ activities, city, weather, fatigueMode })
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            res.json(result);
        } else {
            throw new Error('Pas de JSON dans la réponse');
        }
    } catch (error) {
        console.error('Optimize day error:', error);
        res.status(500).json({ error: 'Erreur optimisation' });
    }
});

// Informations sur une activité
app.post('/api/activity-info', async (req, res) => {
    try {
        const { activityName, city } = req.body;
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Tu es un guide touristique expert du Japon. Donne des informations concises sur les lieux touristiques.
Retourne un JSON: { "description": "description courte", "tips": "conseil pratique", "duration": minutes estimés }`
                    },
                    {
                        role: 'user',
                        content: `Lieu: ${activityName}\nVille: ${city || 'Tokyo'}`
                    }
                ],
                temperature: 0.6,
                max_tokens: 300
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.trim();
        
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const info = JSON.parse(jsonMatch[0]);
            res.json(info);
        } else {
            throw new Error('Pas de JSON dans la réponse');
        }
    } catch (error) {
        console.error('Activity info error:', error);
        res.status(500).json({ error: 'Erreur infos activité' });
    }
});

// Calcul d'itinéraire
app.post('/api/route', async (req, res) => {
    try {
        const { origin, destination, mode } = req.body;
        
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode || 'transit'}&key=${GOOGLE_MAPS_API_KEY}&language=fr`
        );
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Route error:', error);
        res.status(500).json({ error: 'Erreur calcul itinéraire' });
    }
});

// ========== OPENWEATHER API ==========

app.get('/api/weather', async (req, res) => {
    try {
        const { city } = req.query;
        if (!city) {
            return res.status(400).json({ error: 'Ville manquante' });
        }

        const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},JP&appid=${OPENWEATHER_API_KEY}&units=metric&lang=fr`
        );
        
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Weather error:', error);
        res.status(500).json({ error: 'Erreur météo' });
    }
});

// ========== SERVE FRONTEND ==========

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START SERVER ==========

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});
