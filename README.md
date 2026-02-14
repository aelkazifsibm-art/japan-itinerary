# 🗾 My Japan Trip - Production Ready

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-6.1.1-blue)
![Status](https://img.shields.io/badge/status-production-green)
![License](https://img.shields.io/badge/license-MIT-green)

## ⚡ Installation

```bash
git clone https://github.com/VOTRE_USERNAME/my-japan-trip.git
cd my-japan-trip
npm install
cp .env.example .env
# Éditer .env avec vos 4 clés API
npm start
```

## 🔑 Clés API Requises

| API | Usage | Coût | Lien |
|-----|-------|------|------|
| **OpenAI** | IA (ajout rapide, optimisation) | ~10€/mois | [platform.openai.com](https://platform.openai.com) |
| **Google Maps Browser** | Autocomplete frontend | Gratuit | [console.cloud.google.com](https://console.cloud.google.com) |
| **Google Maps Server** | Places API backend | Gratuit | Même projet |
| **OpenWeather** | Météo réelle | **GRATUIT** | [openweathermap.org](https://openweathermap.org) |

## ✨ Fonctionnalités Principales

### 🤖 Ajout Rapide Intelligent
- Saisie libre avec fautes acceptées
- Correction automatique IA
- Géolocalisation automatique
- Validation en 2 clics

### ⚡ Optimisation Automatique
- Analyse horaires d'ouverture
- Évite l'affluence
- Optimise les trajets
- Intègre la météo réelle
- Respecte horaires fixés

### 💰 Gestionnaire de Budget
- 9 catégories de dépenses
- Calcul automatique hébergements
- Budget total + par jour
- Répartition détaillée

### 🌦️ Météo Réelle
- Prévisions 7 jours OpenWeather
- Optimisation adaptée pluie/beau temps
- Suggestions indoor/outdoor

### 📱 Interface Moderne
- 4 onglets : Route, IA, Budget, Config
- Design épuré et intuitif
- Mobile-first responsive

## 🎮 Guide Rapide

### 1. Configuration Initiale
```
Ville : Tokyo
Hôtel : Hotel Gracery (60€/nuit)
Budget : Vols 800€, Repas moyen
```

### 2. Ajout Activités
```
Clic suggestion "Senso-ji Temple"
→ Flexible ✓
→ Ajouter
```

### 3. Optimisation
```
"Optimiser la journée ?"
→ IA analyse tout
→ Valider planning
```

## 📊 Architecture

### Backend
```javascript
POST /api/quick-add-activity  // Ajout rapide
POST /api/optimize-day         // Optimisation (conserve toutes données)
POST /api/activity-info        // Infos détaillées
POST /api/route                // Itinéraires
GET  /api/weather              // Météo
```

### Frontend
- 2334 lignes
- Tailwind CSS
- Vanilla JS
- LocalStorage

## 🌐 Déploiement Render.com

### Variables d'Environnement
```env
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxx
OPENWEATHER_API_KEY=xxxxx
```

### Configuration
```
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

## 💰 Coûts Estimés

| Service | Coût |
|---------|------|
| Render.com | 0€ |
| OpenAI | ~10€/mois |
| Google Maps | 0€ |
| OpenWeather | 0€ |
| **TOTAL** | **~10€/mois** |

## 🐛 Bugs Corrigés (v6.1.1)

### Critical Fixes
- ✅ **Activités disparaissent après optimisation**
  - Backend : Conservation données complètes (place, title, description)
  - Frontend : Logique remplacement corrigée
- ✅ Loading bloqué après validation
- ✅ Bouton reste en loading
- ✅ Suggestions ouvrent modal vide

### Improvements
- Modal ultra-simplifié (2 clics)
- Radio buttons visuels
- Interface épurée

## 📈 Changelog

### v6.1.1 (Production)
- 🐛 **FIX CRITIQUE** : Activités conservées après optimisation
- 🔧 Backend fusionne données IA + originales
- ✅ Tests validés

### v6.1
- 💰 Gestionnaire budget complet
- 🎯 Modal simplifié

### v6.0
- 🤖 Ajout rapide IA
- ⚡ Optimisation auto
- 🌦️ Météo OpenWeather

## 🎯 Budget Voyage (14 jours)

**Économique (~1800€)**
- Vols : 600€
- Hébergement : 560€
- JR Pass 14j : 450€
- Quotidien : 190€

**Moyen (~2500€)**
- Vols : 800€
- Hébergement : 840€
- JR Pass 14j : 450€
- Quotidien : 410€

**Confort (~3500€)**
- Vols : 1000€
- Hébergement : 1400€
- JR Pass 14j : 450€
- Quotidien : 650€

## 🧪 Tests de Production

### Checklist
- ✅ Ajout activité
- ✅ Optimisation (données conservées)
- ✅ Budget calcul auto
- ✅ Météo chargement
- ✅ Cache trajets
- ✅ Sauvegarde localStorage

### Scénario Complet Testé
```
1. Ajout 3 activités flexibles
2. Optimisation IA
3. Validation
4. ✅ Toutes activités présentes
5. ✅ Horaires optimisés
6. ✅ Trajets calculés
```

## 📝 Licence

MIT License

## 🙏 Technologies

- OpenAI GPT-4o-mini
- Google Maps Platform
- OpenWeather API 3.0
- Node.js + Express
- Tailwind CSS

## 📞 Support

Ouvrir une issue sur GitHub

---

**Bon voyage au Japon !** 🗾🌸

**Version** : 6.1.1 Production  
**Status** : ✅ Production Ready  
**Bugs** : 0 Critical  
**Tests** : Passed
