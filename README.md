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

### 1. Configuration

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

### 2. Variables d'environnement

Configurer dans Render Dashboard → Environment :

| Variable | Description | Obligatoire |
|----------|-------------|-------------|
| `GOOGLE_MAPS_BROWSER_KEY` | Clé Google Maps (Browser) | ✅ Oui |
| `GOOGLE_MAPS_SERVER_KEY` | Clé Google Maps (Server) | ✅ Oui |
| `OPENAI_API_KEY` | Clé OpenAI (GPT-4o-mini) | ✅ Oui |
| `OPENWEATHER_API_KEY` | Clé OpenWeather | ✅ Oui |

### 3. Structure du projet

```
japan-itinerary/
├── server.js              # Serveur Express avec APIs
├── package.json           # Dépendances Node.js
├── public/
│   └── index.html         # Application frontend
├── .gitignore
└── README.md
```

### 4. Déploiement

1. **Fork ce repo** ou clone-le
2. **Connecte à Render** via GitHub
3. **Configure les variables d'environnement**
4. **Deploy !**

L'app sera accessible sur : `https://votre-app.onrender.com`

## 📡 Endpoints API

### Google Places
```
GET  /api/places/autocomplete?q={query}
GET  /api/places/details?place_id={id}
```

### OpenAI - Intelligence Artificielle
```
POST /api/normalize-text          # Normalise les noms de lieux
POST /api/quick-add-activity      # Ajoute une activité avec IA
POST /api/optimize-day            # Optimise l'ordre des activités
POST /api/activity-info           # Infos enrichies sur un lieu
```

### Google Maps
```
POST /api/route                   # Calcul d'itinéraire
```

### Météo
```
GET  /api/weather?city={ville}
```

## 🛠️ Développement Local

### Installation

```bash
# Cloner le repo
git clone https://github.com/votre-username/japan-itinerary.git
cd japan-itinerary

# Installer les dépendances
npm install

# Créer un fichier .env
cp .env.example .env
# Puis éditer .env avec vos clés API

# Lancer le serveur
npm start
```

L'app sera accessible sur `http://localhost:3000`

### Mode développement (avec auto-reload)

```bash
npm run dev
```

## 🎯 Utilisation

### 1. Premier lancement
1. **Splash screen** animé (1.5s)
2. **Onboarding en 2 étapes** :
   - Profil voyageur (préférences)
   - Dates de voyage (vols)

### 2. Planning
- **Jour par jour** - Navigue avec ← →
- **Ajoute des activités** :
  - Via suggestions (140+ activités)
  - Manuellement avec correction IA
- **Glisse-dépose** pour réorganiser
- **Swipe → pour compléter** une activité

### 3. Configuration (FAB ⚙️)
- **🗺️ Voyage** - Villes & hôtels par jour
- **💰 Budget** - Gestionnaire complet
- **👤 Profil** - Modifier préférences + dates

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

### Frontend
- HTML5
- Tailwind CSS
- Vanilla JavaScript
- LocalStorage (persistance)

### Backend
- Node.js 18+
- Express.js
- CORS

### APIs Externes
- OpenAI GPT-4o-mini
- Google Maps API
- Google Places API
- OpenWeather API

## 📝 Changelog

### v6.5 - Navigation Restructurée (Février 2025)
- ✅ Bottom navigation (Voyage/Budget/Profil)
- ✅ FAB pour accès rapide config
- ✅ Navigation par jour dans config
- ✅ Dates corrigées (tripData.outbound/return)
- ✅ Profil intégré dans Réglages
- ✅ UX optimisée mobile

### v6.4 - Suggestions Intégrées (Février 2025)
- ✅ 140 activités (vs 90)
- ✅ Dropdown intégré
- ✅ Bouton manuel fixe

### v6.0 - Onboarding & Profil (Février 2025)
- ✅ Profil voyageur (5 catégories)
- ✅ Onboarding 2 étapes
- ✅ Swipe entre étapes

### v5.0 - Base Fonctionnelle (Février 2025)
- ✅ Planning jour par jour
- ✅ Villes & hôtels
- ✅ Budget (9 catégories)
- ✅ Suggestions d'activités

## 📄 License

MIT License - Utilisation libre

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Crée une branche (`git checkout -b feature/AmazingFeature`)
3. Commit tes changements (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvre une Pull Request

## 💬 Support

Des questions ? Ouvre une [issue](https://github.com/votre-username/japan-itinerary/issues)

---

Made with 🌸 by Claude & You
