# 🗾 My Japan Trip - v6.0 Final

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-6.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Déploiement Rapide

```bash
# 1. Cloner
git clone https://github.com/VOTRE_USERNAME/my-japan-trip.git
cd my-japan-trip

# 2. Installer
npm install

# 3. Configurer les 4 clés API
cp .env.example .env
# Éditer .env

# 4. Lancer
npm start
```

## 🔑 4 Clés API Requises

### 1. OpenAI (IA)
- **Usage** : Ajout rapide, optimisation, infos activités
- **Obtenir** : [platform.openai.com](https://platform.openai.com)
- **Coût** : ~10$/mois

### 2. Google Maps Browser (Frontend)
- **Usage** : Autocomplete, validation lieux
- **Obtenir** : [console.cloud.google.com](https://console.cloud.google.com)
- **Restriction** : HTTP referrers

### 3. Google Maps Server (Backend)
- **Usage** : Places API, recherche
- **Obtenir** : Même projet Google Cloud
- **Restriction** : Aucune ou IP

### 4. OpenWeather (Météo) 🆕
- **Usage** : Prévisions météo réelles
- **Obtenir** : [openweathermap.org](https://openweathermap.org)
- **Coût** : GRATUIT (1000 appels/jour)
- **Guide** : Voir [OPENWEATHER_SETUP.md](OPENWEATHER_SETUP.md)

## ✨ Fonctionnalités v6.0

### 🤖 Ajout Rapide Intelligent

**Avant** : Remplir 5 champs manuellement
**Après** : Juste écrire l'activité !

```
Vous tapez : "temple doré kyoto"
   ↓
IA corrige : "Kinkaku-ji Temple"
   ↓
Google Places : Géolocalisation auto
   ↓
Activité créée ✅
```

### ⚡ Optimisation Automatique

L'IA analyse et organise votre journée :

**Critères d'optimisation** :
- ⏰ Horaires d'ouverture
- 👥 Niveaux d'affluence
- 🗺️ Distances entre lieux
- 🌦️ **Météo réelle** (OpenWeather)
- 🔒 Respect horaires fixés

**Résultat** :
```
Avant :
- Temple (flexible)
- Skytree (flexible)
- Resto 14h (fixé)

Après optimisation :
✅ 06:30 Temple (lever soleil, 0 foule)
✅ 09:00 Skytree (ouverture, peu monde)
✅ 14:00 Resto (respecté)
💡 Planning optimisé selon météo
```

### 🌦️ Météo Réelle Intégrée

**Activation** :
1. Onglet 🎯 IA → Toggle Météo
2. API OpenWeather appelée
3. Notification affichée

**Si pluie prévue** :
```
🌧️ 80% de pluie détectée

Suggestions IA :
✅ Musées (intérieur)
✅ Centres commerciaux
✅ Restaurants couverts
❌ Parcs extérieurs
```

**Si beau temps** :
```
☀️ Beau temps prévu !

Suggestions IA :
✅ Temples
✅ Jardins
✅ Balades
```

### 📋 Système Activités Flexibles/Fixes

**2 Types** :

1. **Flexible** ⏰
   - Horaire optimisé par IA
   - Badge jaune
   - Modifiable

2. **Fixé** 🔒
   - Horaire choisi par vous
   - Badge vert
   - Jamais modifié par IA

## 🎯 Interface

### Header à Onglets
- **🗺️ Route** : Planning + Ajout rapide
- **🎯 IA** : Modes Fatigue/Météo (toggles directs)
- **⚙️ Config** : Paramètres + Modifier dates

### Planning Intelligent
- Suggestions déroulantes par ville
- Activités cliquables (infos IA)
- Trajets avec cache (90% plus rapide)
- Temps : **Durée + Arrivée**

### Hébergements
- Recherche automatique
- Prix + Budget total
- Trajet depuis hôtel optimisé

## 📊 Architecture

### Backend (Node.js + Express)

**Endpoints** :
```javascript
POST /api/quick-add-activity  // Ajout rapide IA
POST /api/optimize-day         // Optimisation planning
POST /api/activity-info        // Infos lieu détaillées
POST /api/route                // Calcul itinéraire
GET  /api/weather              // Météo OpenWeather 🆕
```

### Frontend

**Technologies** :
- HTML5 + Tailwind CSS
- Vanilla JavaScript
- LocalStorage (persistance)

**Structure** :
```
index.html (2000+ lignes)
├─ Header (onglets)
├─ Modal Ajout Rapide
├─ Modal Optimisation
├─ Planning (activités + trajets)
├─ Sidebar Options
└─ Modals Infos
```

## 🌐 Déploiement Render.com

### Configuration

**Build Command** : `npm install`
**Start Command** : `npm start`
**Instance Type** : Free

### Variables d'Environnement

```env
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxx
OPENWEATHER_API_KEY=xxxxx
```

### Après Déploiement

URL : `https://VOTRE_APP.onrender.com`

## 💡 Guide Utilisation

### Scénario Complet : Journée à Kyoto

**1. Configuration** :
```
- Sélectionner ville : Kyoto
- Activer météo (si pluie prévue)
```

**2. Ajout Rapide** :
```
Taper dans le modal :
- "temple doré"
- "forêt bambou"
- "restaurant ramen 12h30" (fixé)
- "quartier geishas"

→ 4 activités en 2 min ✅
```

**3. Optimisation** :
```
Cliquer "Optimiser"

IA propose :
✅ 06:30 Forêt de bambou
   💡 Lever soleil, pas de touristes
   
✅ 09:00 Temple doré
   💡 Ouverture, peu de foule
   
✅ 12:30 Restaurant ramen
   🔒 Respecté (fixé par vous)
   
✅ 18:30 Quartier geishas
   💡 Meilleure ambiance soir
   🌦️ Pas de pluie prévue
```

**4. Validation** :
```
Vérifier → Valider
→ Planning optimisé appliqué
→ Trajets calculés
→ Prêt ! 🎉
```

## 💰 Coûts Mensuels

| Service | Plan | Coût |
|---------|------|------|
| Render.com | Free | 0€ |
| OpenAI | Usage | ~10€ |
| Google Maps | Free tier | 0€ |
| **OpenWeather** | **Free** | **0€** ✅ |
| **TOTAL** | | **~10€** |

## 🐛 Dépannage

### Quick add ne fonctionne pas
→ Vérifier clé OpenAI + crédit

### Météo ne se charge pas
→ Vérifier clé OpenWeather
→ Activer One Call API 3.0
→ Voir [OPENWEATHER_SETUP.md](OPENWEATHER_SETUP.md)

### Optimisation échoue
→ Au moins 1 activité flexible requise
→ Ville sélectionnée

### Bouton reste en loading
→ Bug corrigé en v6.0
→ Rafraîchir la page

## 📈 Changelog

### v6.0 (Février 2026)
- 🚀 Ajout rapide intelligent
- 🤖 Optimisation automatique
- 🌦️ **Météo réelle OpenWeather**
- ⏰ Système flexible/fixe
- 📊 Temps trajet amélioré
- 🐛 Fix bouton loading
- 🧹 Interface épurée

### v5.2
- Onglets header
- Suggestions déroulantes

### v5.1
- Cache trajets
- Activités cliquables

### v5.0
- Version initiale

## 🤝 Contribution

```bash
git checkout -b feature/AmazingFeature
git commit -m 'Add AmazingFeature'
git push origin feature/AmazingFeature
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
- **Node.js** + Express

## 📞 Support

Ouvrir une issue sur GitHub pour toute question.

---

**Bon voyage au Japon !** 🗾🌸

Développé avec ❤️ pour simplifier la vie des voyageurs
