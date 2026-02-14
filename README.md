# 🗾 My Japan Trip - v6.1 Final

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-6.1-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-green)

## ⚡ Installation Rapide

```bash
git clone https://github.com/VOTRE_USERNAME/my-japan-trip.git
cd my-japan-trip
npm install
cp .env.example .env
# Éditer .env avec vos 4 clés API
npm start
# → http://localhost:3000
```

## 🔑 4 Clés API

| API | Usage | Coût |
|-----|-------|------|
| **OpenAI** | Ajout rapide, optimisation | ~10€/mois |
| **Google Maps Browser** | Autocomplete | Gratuit |
| **Google Maps Server** | Places API | Gratuit |
| **OpenWeather** | Météo réelle | **GRATUIT** |

## ✨ Fonctionnalités v6.1

### 🤖 Ajout Rapide Ultra-Simplifié

**Clic sur suggestion** → Activité pré-remplie → Choix flexible/fixe → **Valider** ✅

```
Senso-ji Temple
[ ⏰ Flexible ]  [ 🔒 Fixé ]
[✅ Ajouter]
```

### ⚡ Optimisation Automatique

L'IA organise votre journée selon :
- ⏰ Horaires d'ouverture
- 👥 Affluence
- 🗺️ Distances
- 🌦️ **Météo réelle**
- 🔒 Vos horaires fixés

### 💰 Gestionnaire de Budget

**Nouveau !** Onglet Budget complet :

| Catégorie | Type |
|-----------|------|
| ✈️ Vols | Manuel |
| 🏨 Hébergement | **Auto-calculé** |
| 🚄 JR Pass | 7/14/21 jours |
| 🚇 Transports | Par jour |
| 🍜 Repas | Éco/Moyen/Confort/Luxe |
| 🎫 Activités | Par jour |
| 🛍️ Shopping | Par jour |
| 🏥 Assurance | Manuel |
| 💳 Divers | Manuel |

**Affichage** :
```
Budget Total : 2450 €
Budget/jour : 175 €
```

### 🌦️ Météo Réelle

- Prévisions 7 jours
- Optimisation adaptée
- Suggestions indoor si pluie

### 📱 Interface 4 Onglets

- **🗺️ Route** : Planning + Ajout
- **🎯 IA** : Modes Fatigue/Météo
- **💰 Budget** : Gestionnaire complet
- **⚙️ Config** : Paramètres

## 🎮 Guide Utilisation

### 1. Configuration Budget

```
Onglet 💰 Budget
→ Vols : 800€
→ JR Pass : 14 jours
→ Repas : Moyen (50€/j)
→ Total affiché automatiquement
```

### 2. Planification

```
Onglet 🗺️ Route
→ Clic suggestion "Temple Senso-ji"
→ Sélectionner "Flexible"
→ Ajouter
```

### 3. Optimisation

```
Ajouter 3-4 activités flexibles
→ "Optimiser la journée ?"
→ IA analyse tout
→ Valider le planning proposé
```

## 📊 Architecture

### Backend (5 Endpoints)

```javascript
POST /api/quick-add-activity  // Ajout rapide
POST /api/optimize-day         // Optimisation
POST /api/activity-info        // Infos détaillées
POST /api/route                // Itinéraires
GET  /api/weather              // Météo
```

### Frontend

- 2100+ lignes HTML/JS/CSS
- Tailwind CSS
- Vanilla JavaScript
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
Build: npm install
Start: npm start
Instance: Free
```

## 💰 Coûts

| Service | Coût/mois |
|---------|-----------|
| Render.com | 0€ |
| OpenAI | ~10€ |
| Google Maps | 0€ |
| OpenWeather | 0€ |
| **TOTAL** | **~10€** |

## 🆕 Nouveautés v6.1

### Ajouté
- 💰 **Onglet Budget complet**
- 📊 Calcul automatique hébergements
- 🎯 Modal ajout ultra-simplifié
- 🔘 Radio buttons visuels

### Amélioré
- UX suggestions (2 clics)
- Interface épurée
- Pas de texte superflu

### Corrigé
- ✅ Loading bloqué
- ✅ Bouton en loading
- ✅ Suggestions vides

## 📈 Changelog

### v6.1 (Février 2026)
- 💰 Gestionnaire budget
- 🎯 Modal simplifié
- 📊 Auto-calcul hébergements

### v6.0
- 🤖 Ajout rapide IA
- ⚡ Optimisation auto
- 🌦️ Météo OpenWeather

### v5.0
- 🎉 Version initiale

## 🎯 Budget Voyage Estimé

### 14 jours au Japon

**Économique** (~1800€) :
- Vols : 600€
- Hébergement : 560€ (40€/nuit)
- JR Pass : 450€
- Transports : 140€
- Repas : 350€
- Reste : 200€

**Moyen** (~2500€) :
- Vols : 800€
- Hébergement : 840€ (60€/nuit)
- JR Pass : 450€
- Transports : 210€
- Repas : 700€
- Reste : 500€

**Confort** (~3500€) :
- Vols : 1000€
- Hébergement : 1400€ (100€/nuit)
- JR Pass : 450€
- Transports : 280€
- Repas : 1120€
- Reste : 750€

## 🐛 Dépannage

### Budget ne se calcule pas
```
→ Sélectionner ville d'abord
→ Ajouter au moins 1 hôtel
→ Rafraîchir l'onglet
```

### Quick add échoue
```
→ Vérifier clé OpenAI
→ Vérifier crédit
```

### Météo ne charge pas
```
→ Activer One Call API 3.0
→ Voir OPENWEATHER_SETUP.md
```

## 📝 Licence

MIT License

## 🙏 Technologies

- OpenAI GPT-4o-mini
- Google Maps Platform
- OpenWeather API 3.0
- OSRM
- Tailwind CSS
- Node.js + Express

---

**Bon voyage au Japon !** 🗾🌸

**Version** : 6.1 Final  
**Status** : Production Ready ✅
