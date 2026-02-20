# 🗾 Japan Trip Planner

Application web progressive pour planifier votre voyage au Japon avec intelligence artificielle.

![Version](https://img.shields.io/badge/version-6.7.1-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-green)

## 📁 Structure

```
japan-trip-planner/
├── server.js          # Backend Node.js + Express
├── package.json       # Dépendances npm
├── .env.example       # Template clés API
├── .gitignore
├── README.md
└── public/
    └── index.html     # Frontend (application web)
```

## 🚀 Déploiement sur Render.com

### 1. Configuration Render

**New Web Service**
- Repository : Connecter votre repo GitHub
- Build Command : `npm install`
- Start Command : `npm start`
- Instance Type : Free

### 2. Variables d'Environnement

Configurer dans Render Dashboard → Environment :

```env
GOOGLE_MAPS_BROWSER_KEY=AIzaSy...    # Clé Google Maps (restriction HTTP referrers)
GOOGLE_MAPS_SERVER_KEY=AIzaSy...     # Clé Google Maps (restriction IP ou aucune)
OPENAI_API_KEY=sk-proj-...           # Clé OpenAI
OPENWEATHER_API_KEY=...              # Clé OpenWeather
```

### 3. Déployer

Render déploiera automatiquement :
- Backend : API REST sur `https://votre-app.onrender.com/api/*`
- Frontend : Application web sur `https://votre-app.onrender.com/`

✅ **Tout fonctionne automatiquement** !

## 🔑 Obtenir les Clés API

### Google Maps (2 clés)
1. [Google Cloud Console](https://console.cloud.google.com)
2. Créer un projet
3. Activer **Places API** et **Maps JavaScript API**
4. Créer 2 clés :
   - **Browser Key** : Restriction "HTTP referrers" → `*.onrender.com/*`
   - **Server Key** : Restriction "IP addresses" ou aucune

### OpenAI
1. [OpenAI Platform](https://platform.openai.com)
2. Créer clé API
3. Modèle : GPT-4o-mini (~10€/mois)

### OpenWeather
1. [OpenWeather](https://openweathermap.org)
2. Créer compte
3. Activer "One Call API 3.0"
4. Gratuit (1000 appels/jour)

## ✨ Fonctionnalités

### Core
- 📋 Onboarding (profil + dates)
- 📅 Planning jour par jour (13 jours max)
- 🏙️ 10 villes japonaises
- 🎯 140+ suggestions d'activités
- 💰 Budget manager (9 catégories)
- 🎨 Interface responsive mobile-first
- 💾 Sauvegarde localStorage

### Avancées (Requiert Backend)
- 🏨 Autocomplétion adresse hôtel (Google Places)
- 🤖 Ajout rapide activité avec IA (OpenAI)
- ⚡ Optimisation automatique planning
- ℹ️ Infos détaillées lieux
- 🌤️ Météo temps réel (OpenWeather)

## 💻 Développement Local

```bash
# 1. Installer dépendances
npm install

# 2. Créer fichier .env
cp .env.example .env

# 3. Éditer .env avec vos 4 clés API
nano .env

# 4. Lancer serveur
npm start

# 5. Accéder à l'app
# → http://localhost:3000
```

## 📡 Endpoints API

### Google Places
```
GET /api/places/autocomplete?q=Hotel+Gracery
GET /api/places/details?place_id=ChIJ...
```

### OpenAI
```
POST /api/quick-add-activity       # Ajout rapide avec IA
POST /api/optimize-day              # Optimisation planning
POST /api/activity-info             # Infos lieu détaillées
```

### Météo
```
GET /api/weather?city=tokyo&date=2026-03-15
```

### Route
```
POST /api/route                     # Calcul itinéraire
```

## 📱 Utilisation

### 1. Onboarding
- **Étape 1** : Profil (voyageurs, type, rythme, budget)
- **Étape 2** : Vols (dates, heures, aéroports)

### 2. Planning
- Navigation jour par jour
- Ajout manuel ou suggestions IA
- Drag & drop pour réorganiser
- Swipe pour compléter/supprimer

### 3. Configuration (FAB ⚙️)
- **Voyage** : Villes & hôtels par jour
- **Budget** : 9 catégories auto-calculées
- **Profil** : Modifier préférences

## 📊 Coûts Mensuels

| Service | Plan | Coût |
|---------|------|------|
| Render.com | Free | 0€ |
| Google Maps | Free tier | 0€ (28K requêtes/mois) |
| OpenAI | Usage | ~10€ |
| OpenWeather | Free | 0€ (1K/jour) |
| **TOTAL** | | **~10€/mois** |

## 🐛 Dépannage

### Backend ne démarre pas
```
→ Vérifier logs Render
→ Vérifier les 4 variables d'environnement
→ Vérifier package.json (type: "module")
```

### "Service Unavailable" après 15min
```
→ Render Free tier dort après 15min d'inactivité
→ Première requête réveille (30-60 secondes)
→ Puis fonctionne normalement
```

### Autocomplétion ne marche pas
```
→ Vérifier GOOGLE_MAPS_SERVER_KEY dans Render
→ Vérifier Places API activée (console.cloud.google.com)
→ Vérifier restrictions clé API
```

### Erreur OpenAI
```
→ Vérifier OPENAI_API_KEY
→ Vérifier crédit disponible
→ Mode dégradé : saisie manuelle fonctionne
```

## 🏗️ Architecture

### Frontend (`public/index.html`)
- HTML5 monopage (4000+ lignes)
- Tailwind CSS (via CDN)
- Vanilla JavaScript
- LocalStorage

### Backend (`server.js`)
- Node.js 18+ + Express
- 6 endpoints API REST
- Proxy vers Google Maps, OpenAI, OpenWeather
- CORS configuré

### Flux de Données
```
User → Frontend → Backend → API externe → Backend → Frontend → User
```

## 📝 Licence

MIT License

## 🙏 Technologies

- Node.js + Express
- OpenAI GPT-4o-mini
- Google Maps Platform
- OpenWeather One Call API
- Tailwind CSS
- OSRM (routing gratuit)

## 🔗 Liens Utiles

- [Render Documentation](https://render.com/docs)
- [Google Maps Places API](https://developers.google.com/maps/documentation/places)
- [OpenAI API](https://platform.openai.com/docs)
- [OpenWeather API](https://openweathermap.org/api)

## 📧 Support

Ouvrir une issue sur GitHub pour toute question.

---

**Bon voyage au Japon !** 🗾🌸

Développé avec ❤️ pour simplifier la vie des voyageurs

**Version** : 6.7.1  
**Status** : Production Ready ✅
