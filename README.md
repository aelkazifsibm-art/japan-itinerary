# 🗾 My Japan Trip - v6.2 Production

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-6.2-blue)
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
# → http://localhost:3000
```

## 🔑 4 Clés API

| API | Usage | Coût |
|-----|-------|------|
| **OpenAI** | IA (ajout rapide, optimisation) | ~10€/mois |
| **Google Maps Browser** | Autocomplete frontend | Gratuit |
| **Google Maps Server** | Places API backend | Gratuit |
| **OpenWeather** | Météo réelle | **GRATUIT** |

## ✨ Fonctionnalités v6.2

### 🤖 Ajout Rapide Ultra-Simplifié
```
Clic suggestion → Activité pré-remplie
→ Flexible/Fixe → Ajouter ✅
```

### ⚡ Optimisation Intelligente
- Horaires d'ouverture
- Affluence optimale
- Trajets calculés
- Météo intégrée
- Horaires fixés respectés

### 🚇 Analyse Trajets Détaillée (NOUVEAU)
**Affichage intelligent** :
```
⏱️ 35 min    🏁 10:35
🚶 10 min + 🚇 25 min
```

Distingue automatiquement :
- 🚶 Temps de marche
- 🚇 Temps de transport (métro/train/bus)

### 💰 Gestionnaire Budget Complet
- 9 catégories de dépenses
- Calcul auto hébergements
- Budget total + par jour
- Répartition visuelle

### 🌦️ Météo Réelle
- Prévisions 7 jours
- Optimisation adaptée
- Suggestions pluie/beau temps

### 📱 Interface 4 Onglets
- **🗺️ Route** : Planning + Ajout
- **🎯 IA** : Modes Fatigue/Météo
- **💰 Budget** : Gestionnaire
- **⚙️ Config** : Paramètres

## 🎮 Exemple d'Utilisation

### Planning Journée Tokyo

**Activités** :
```
09:00 Senso-ji Temple
      ⏱️ 25 min    🏁 09:25
      🚶 5 min + 🚇 20 min

09:30 Tokyo Skytree
      ⏱️ 40 min    🏁 11:10
      🚶 8 min + 🚇 32 min

12:00 Shibuya Crossing
      ⏱️ 15 min    🏁 13:15
      🚶 15 min

13:30 Harajuku
```

**Budget** :
```
Vols : 800€
Hébergements : 840€ (auto)
JR Pass 14j : 450€
Transports : 210€
Repas : 700€
Total : 3000€ (214€/jour)
```

## 📊 Architecture

### Backend (5 Endpoints)
```javascript
POST /api/quick-add-activity  // Ajout rapide
POST /api/optimize-day         // Optimisation complète
POST /api/activity-info        // Infos détaillées
POST /api/route                // Itinéraires détaillés
GET  /api/weather              // Météo OpenWeather
```

### Frontend
- 2380+ lignes
- Tailwind CSS
- Vanilla JavaScript
- LocalStorage
- Analyse intelligente trajets

## 🌐 Déploiement Render.com

### Variables
```env
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxx
OPENWEATHER_API_KEY=xxxxx
```

### Config
```
Build: npm install
Start: npm start
Instance: Free
```

## 💰 Coûts

| Service | Prix |
|---------|------|
| Render.com | 0€ |
| OpenAI | ~10€/mois |
| Google Maps | 0€ |
| OpenWeather | 0€ |
| **TOTAL** | **~10€/mois** |

## 📈 Changelog

### v6.2 (Production)
- 🚇 **Analyse trajets détaillée**
  - Distinction marche/transport
  - Affichage : 🚶 X min + 🚇 Y min
- 🎯 Affichage ultra-compact
- ✅ Tous bugs corrigés

### v6.1.1
- 🐛 Fix critique : Activités disparaissent
- 🔧 Backend conserve données complètes

### v6.1
- 💰 Gestionnaire budget
- 🎯 Modal simplifié

### v6.0
- 🤖 Ajout rapide IA
- ⚡ Optimisation auto
- 🌦️ Météo OpenWeather

## 🎯 Budget Estimé (14 jours)

**Économique (~1800€)** :
- Vols : 600€
- Hébergement : 560€ (40€/nuit)
- JR Pass 14j : 450€
- Quotidien : 190€

**Moyen (~2500€)** :
- Vols : 800€
- Hébergement : 840€ (60€/nuit)
- JR Pass 14j : 450€
- Quotidien : 410€

**Confort (~3500€)** :
- Vols : 1000€
- Hébergement : 1400€ (100€/nuit)
- JR Pass 14j : 450€
- Quotidien : 650€

## 🧪 Tests Production

### Scénarios Validés
- ✅ Ajout activités (rapide + manuel)
- ✅ Optimisation (données conservées)
- ✅ Analyse trajets (marche + transport)
- ✅ Budget (calcul auto)
- ✅ Météo (intégration)
- ✅ Cache (performance)

### Test Complet
```
1. Ajouter 3 activités
2. Optimiser
3. Valider
→ ✅ Activités présentes
→ ✅ Horaires optimisés
→ ✅ Trajets analysés (🚶 + 🚇)
→ ✅ Budget calculé
```

## 🐛 Dépannage

### Trajets non analysés
```
→ Vérifier cache trajet
→ Rafraîchir la page
→ Recalculer le trajet
```

### Budget incorrect
```
→ Vérifier hôtels ajoutés
→ Rafraîchir onglet Budget
```

### Optimisation échoue
```
→ Au moins 1 activité flexible
→ Vérifier clé OpenAI
```

## 📝 Licence

MIT License

## 🙏 Technologies

- OpenAI GPT-4o-mini
- Google Maps Platform
- OpenWeather API 3.0
- Node.js + Express
- Tailwind CSS

---

**Bon voyage au Japon !** 🗾🌸

**Version** : 6.2 Production  
**Status** : ✅ Production Ready  
**Features** : Analyse trajets détaillée  
**Tests** : ✅ Passed
