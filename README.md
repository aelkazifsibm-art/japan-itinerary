# 🗾 My Japan Trip - v6.0 Ultimate

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-6.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Installation Express

```bash
# 1. Cloner
git clone https://github.com/VOTRE_USERNAME/my-japan-trip.git
cd my-japan-trip

# 2. Installer
npm install

# 3. Configurer
cp .env.example .env
# Éditer .env avec vos 4 clés API

# 4. Lancer
npm start
# → http://localhost:3000
```

## 🔑 4 Clés API Requises

| API | Usage | Coût | Guide |
|-----|-------|------|-------|
| **OpenAI** | Ajout rapide, optimisation IA | ~10€/mois | [platform.openai.com](https://platform.openai.com) |
| **Google Maps Browser** | Autocomplete frontend | Gratuit | [console.cloud.google.com](https://console.cloud.google.com) |
| **Google Maps Server** | Places API backend | Gratuit | Même projet Google |
| **OpenWeather** | Météo réelle | **GRATUIT** | [OPENWEATHER_SETUP.md](OPENWEATHER_SETUP.md) |

## ✨ Fonctionnalités v6.0

### 🤖 Ajout Rapide Intelligent

**Fini la saisie fastidieuse !**

```
Vous : "temple doré kyoto"
   ↓
IA : Corrige → "Kinkaku-ji Temple"
   ↓
Google Places : Géolocalise automatiquement
   ↓
✅ Activité créée !
```

**Depuis les suggestions** :
```
Clic sur "Temple Senso-ji"
   ↓
Modal pré-rempli avec la suggestion
   ↓
Vérifier → Clic "Analyser"
   ↓
✅ 2 clics seulement !
```

### ⚡ Optimisation Automatique

L'IA organise votre journée parfaite en analysant :

- ⏰ Horaires d'ouverture
- 👥 Niveaux d'affluence
- 🗺️ Distances entre lieux
- 🌦️ **Météo réelle** (OpenWeather)
- 🔒 Respect des horaires fixés par vous

**Exemple** :
```
Avant :
- Temple (flexible)
- Skytree (flexible)
- Restaurant 14h (fixé)
- Shopping (flexible)

Après optimisation IA :
✅ 06:30 Temple (lever soleil, 0 foule)
✅ 09:00 Skytree (ouverture, peu monde)
✅ 14:00 Restaurant (respecté)
✅ 18:00 Shopping (meilleur moment)
💡 Adapté selon météo
```

### 🌦️ Météo Réelle

**Activation** : Onglet 🎯 IA → Toggle Météo

**Si pluie** :
```
🌧️ 80% de pluie détectée

Optimisation suggère :
✅ Musées (intérieur)
✅ Centres commerciaux
✅ Restaurants
❌ Parcs, temples extérieurs
```

**Si beau temps** :
```
☀️ 22°C, ensoleillé

Optimisation suggère :
✅ Temples
✅ Jardins
✅ Balades extérieures
```

### 📋 Activités Flexibles/Fixes

**2 Modes** :

| Type | Badge | Horaire | Optimisation |
|------|-------|---------|--------------|
| **Flexible** ⏰ | Jaune | Défini par IA | Oui |
| **Fixé** 🔒 | Vert | Choisi par vous | Jamais modifié |

### 📱 Interface Moderne

#### Header à Onglets
- **🗺️ Route** : Planning + Ajout rapide
- **🎯 IA** : Modes Fatigue/Météo
- **⚙️ Config** : Paramètres

#### Suggestions Intelligentes
- Clic → Pré-remplissage automatique
- 50+ activités par ville
- 10 villes japonaises

#### Activités Cliquables
- Clic activité → Infos IA complètes
- Affluence, horaires, règles
- Lien Google Maps direct

#### Cache Intelligent
- Trajets sauvegardés
- 90% plus rapide
- Format : **Durée + Arrivée**

## 🎮 Guide Utilisation Complète

### Scénario : Journée à Kyoto

**1. Configuration**
```
Ville : Kyoto
Météo : Activée
Hôtel : Hotel Gracery
```

**2. Ajout Suggestions (Rapide)**
```
Clic "Temple Senso-ji" → Pré-rempli
Clic "Forêt bambou" → Pré-rempli
Taper "restaurant ramen 12h30" → Manuel
Clic "Quartier geishas" → Pré-rempli

→ 4 activités en 2 min ✅
```

**3. Optimisation**
```
Message : "3 activités flexibles, optimiser ?"
→ Clic Oui

IA analyse :
- Horaires ouverture
- Affluence
- Météo : Beau temps ☀️
- Trajets

Propose :
✅ 05:30 Forêt bambou (lever soleil)
✅ 09:00 Temple (ouverture, 0 foule)
✅ 12:30 Restaurant (respecté)
✅ 18:30 Geishas (ambiance soir)
```

**4. Validation**
```
Vérifier → Valider
→ Planning optimisé ✅
→ Trajets calculés ✅
→ Budget affiché ✅
```

## 📊 Architecture

### Backend (Node.js + Express)

**5 Endpoints principaux** :

```javascript
POST /api/quick-add-activity
// Ajout rapide avec IA
// Corrige + géolocalise

POST /api/optimize-day
// Optimise planning jour
// Analyse complète IA

POST /api/activity-info
// Infos lieu détaillées
// Affluence, règles, conseils

POST /api/route
// Calcul itinéraire
// Google + OSRM

GET /api/weather
// Météo OpenWeather
// Prévisions 7 jours
```

### Frontend

**Technologies** :
- HTML5 (2000+ lignes)
- Tailwind CSS
- Vanilla JavaScript
- LocalStorage

**Structure** :
```
Header (onglets)
├─ Modal Ajout Rapide ✨
├─ Modal Optimisation 🤖
├─ Planning (activités + trajets)
├─ Sidebar Options
└─ Modals Infos
```

## 🌐 Déploiement Render.com

### Configuration

```yaml
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

### Variables d'Environnement

```env
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxx
OPENWEATHER_API_KEY=xxxxx
```

**Important** : Toutes les 4 clés sont **obligatoires**

### Après Déploiement

URL : `https://VOTRE_APP.onrender.com`

## 💰 Coûts Mensuels

| Service | Plan | Coût |
|---------|------|------|
| Render.com | Free | 0€ |
| OpenAI | Usage | ~10€ |
| Google Maps | Free tier | 0€ |
| **OpenWeather** | **Free** | **0€** |
| **TOTAL** | | **~10€** |

### Détails OpenWeather
- 1000 appels/jour gratuits
- Carte requise (vérification)
- Pas de débit automatique
- Guide : [OPENWEATHER_SETUP.md](OPENWEATHER_SETUP.md)

## 🐛 Dépannage

### Quick add ne fonctionne pas
```
→ Vérifier clé OpenAI
→ Vérifier crédit OpenAI
→ Logs Render : "Missing OpenAI key"
```

### Météo ne charge pas
```
→ Vérifier clé OpenWeather
→ Activer One Call API 3.0
→ Sélectionner une ville d'abord
```

### Optimisation échoue
```
→ Au moins 1 activité flexible requise
→ Ville sélectionnée
→ Vérifier logs backend
```

### Loading reste bloqué
```
→ Bug corrigé en v6.0
→ Rafraîchir la page
→ Vider cache si besoin
```

### Suggestion ne pré-remplit pas
```
→ Bug corrigé en v6.0
→ Redéployer sur Render
```

## 📈 Changelog Complet

### v6.0 - Ultimate (Février 2026)

**Ajouté** :
- 🚀 Ajout rapide intelligent IA
- 🤖 Optimisation automatique planning
- 🌦️ Météo réelle OpenWeather
- ⏰ Système activités flexibles/fixes
- 📊 Temps trajet (durée + arrivée)
- 💡 Suggestions pré-remplies

**Corrigé** :
- 🐛 Loading bloqué après optimisation
- 🐛 Bouton "Analyser" reste en loading
- 🐛 Suggestions ouvrent modal vide
- 🧹 FAB retiré (ne fonctionnait pas)
- 🧹 Doublons IA dans sidebar

**Amélioré** :
- UX suggestions (2 clics)
- Messages contextuels
- Gestion erreurs
- Performance cache

### v5.2
- Onglets header
- Suggestions déroulantes

### v5.1
- Cache trajets
- Activités cliquables

### v5.0
- Version initiale
- 10 villes + 50 suggestions

## 🤝 Contribution

```bash
git checkout -b feature/NouvelleFeature
git commit -m 'Ajout NouvelleFeature'
git push origin feature/NouvelleFeature
```

Ouvrir une Pull Request sur GitHub.

## 📝 Licence

MIT License - Utilisation libre

## 🙏 Technologies

- **OpenAI** GPT-4o-mini
- **Google Maps** Platform
- **OpenWeather** One Call API 3.0
- **OSRM** (routing gratuit)
- **Tailwind CSS**
- **Node.js** 18+ + Express

## 📞 Support

Ouvrir une issue sur GitHub pour toute question.

## 🎯 Roadmap Future

- [ ] Export PDF du planning
- [ ] Mode PWA (offline)
- [ ] Multi-langues (EN, JP)
- [ ] Intégration JR Pass
- [ ] Suggestions restaurants Michelin
- [ ] Partage planning (QR code)

---

**Bon voyage au Japon !** 🗾🌸

Développé avec ❤️ pour simplifier la vie des voyageurs

**Version** : 6.0 Ultimate  
**Date** : Février 2026  
**Status** : Production Ready ✅
