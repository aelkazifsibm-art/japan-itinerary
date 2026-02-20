# 🗾 Japan Itinerary - Planificateur de Voyage IA

Application web complète pour planifier votre voyage au Japon avec intelligence artificielle.

![Version](https://img.shields.io/badge/version-6.5-purple)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Fonctionnalités

### 🎯 Planification Intelligente
- **Planning jour par jour** avec navigation fluide
- **140+ suggestions d'activités** pour 10 villes japonaises
- **Optimisation IA** du parcours quotidien
- **Mode Fatigue** - Adaptation selon votre énergie
- **Météo en temps réel** - Optimisation selon la météo

### 🏨 Gestion Complète
- **Villes par jour** avec sélection guidée
- **Hébergements** avec autocomplete Google Places
- **Budget détaillé** (9 catégories : vols, hôtels, JR Pass, etc.)
- **Calcul d'itinéraires** entre activités

### 👤 Personnalisation
- **Profil voyageur** (Solo/Couple/Famille/Amis)
- **Type de voyage** (Touristique/Authentique)
- **Rythme** (Actif/Équilibré/Détente)
- **Budget** (Économique/Moyen/Confort)
- **Accessibilité** (Options pour handicaps visuels/moteurs)

### 🎨 UX Moderne
- **Interface responsive** - Optimisée mobile & desktop
- **Bottom navigation** - Ergonomie une main
- **FAB (Floating Action Button)** - Accès rapide config
- **Animations fluides** - Swipe, drag & drop
- **Thème violet/rose** - Design japonais moderne

## 🚀 Déploiement sur Render

### Étape 1 : Préparer le Repo

```bash
# Cloner ou télécharger ce repo
git clone https://github.com/votre-username/japan-itinerary.git
cd japan-itinerary
```

### Étape 2 : Créer un Web Service sur Render

1. Connecte-toi sur [Render](https://render.com)
2. **New** → **Web Service**
3. Connecte ton repo GitHub ou upload manuellement
4. Configuration :
   - **Name** : `japan-itinerary` (ou autre)
   - **Environment** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`

### Étape 3 : Variables d'Environnement

Dans **Environment** sur Render, ajoute :

| Variable | Valeur | Où l'obtenir |
|----------|--------|--------------|
| `GOOGLE_MAPS_BROWSER_KEY` | Ta clé Google Maps | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_MAPS_SERVER_KEY` | Ta clé Google Maps Server | [Google Cloud Console](https://console.cloud.google.com) |
| `OPENAI_API_KEY` | Ta clé OpenAI | [OpenAI Platform](https://platform.openai.com) |
| `OPENWEATHER_API_KEY` | Ta clé OpenWeather | [OpenWeather](https://openweathermap.org/api) |

### Étape 4 : Deploy

Clique sur **Create Web Service** et attends le déploiement (2-3 minutes).

Ton app sera accessible sur : `https://ton-app.onrender.com` 🎉

## 📁 Structure du Projet

```
japan-itinerary/
├── server.js              # Backend Express avec 8 APIs
├── package.json           # Dépendances Node.js
├── public/
│   └── index.html         # Frontend complet (213 KB)
├── .env.example           # Template variables d'environnement
├── .gitignore
├── LICENSE
└── README.md
```

## 📡 Endpoints API

### Google Places
```http
GET  /api/places/autocomplete?q={query}
GET  /api/places/details?place_id={id}
```

### OpenAI - Intelligence Artificielle
```http
POST /api/normalize-text          # Normalise les noms de lieux
POST /api/quick-add-activity      # Ajoute une activité avec IA
POST /api/optimize-day            # Optimise l'ordre des activités
POST /api/activity-info           # Infos enrichies sur un lieu
```

### Google Maps
```http
POST /api/route                   # Calcul d'itinéraire
```

### Météo
```http
GET  /api/weather?city={ville}    # Météo temps réel
```

## 🛠️ Développement Local

```bash
# Installer les dépendances
npm install

# Créer un fichier .env
cp .env.example .env
# Éditer .env avec tes clés API

# Lancer le serveur
npm start
```

L'app sera accessible sur `http://localhost:3000`

### Mode développement (avec auto-reload)

```bash
npm run dev
```

## 🌸 Villes Supportées

- 🗼 **Tokyo** (20 activités)
- ⛩️ **Kyoto** (20 activités)
- 🏯 **Osaka** (16 activités)
- 🦌 **Nara** (12 activités)
- ☮️ **Hiroshima** (12 activités)
- 🗻 **Hakone** (12 activités)
- 🏔️ **Nikko** (12 activités)
- 🌊 **Kamakura** (12 activités)
- 🏘️ **Takayama** (12 activités)
- 🎨 **Kanazawa** (12 activités)

## 🔧 Technologies

- **Frontend** : HTML5, Tailwind CSS, Vanilla JS
- **Backend** : Node.js 18+, Express.js
- **APIs** : OpenAI GPT-4o-mini, Google Maps/Places, OpenWeather

## 📝 Changelog

### v6.5 - Février 2025
✅ Navigation par jour dans config  
✅ Dates corrigées (tripData.outbound/return)  
✅ Bottom nav (Voyage/Budget/Profil)  
✅ FAB pour accès rapide  
✅ 140 activités suggérées  

## 📄 License

MIT License - Utilisation libre

---

Made with 🌸 by Claude
