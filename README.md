# 🗾 My Japan Trip - Version 6.0 Final

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-6.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-green)

## 🆕 Version 6.0 - Révolution IA

### ✨ Ajout Rapide Intelligent

**Fini la saisie fastidieuse !**

```
Vous tapez: "temple doré kyoto"
   ↓
IA analyse et corrige: "Kinkaku-ji Temple"
   ↓
Géolocalisation automatique
   ↓
Activité ajoutée ✅
```

**Fonctionnalités** :
- ✅ Saisie libre avec fautes acceptées
- ✅ Correction automatique par IA
- ✅ Recherche Google Places automatique
- ✅ Horaire flexible ou fixe au choix

### 🤖 Optimisation Automatique

**L'IA organise votre journée parfaite**

**Analyse** :
- ⏰ Horaires d'ouverture
- 👥 Niveaux d'affluence
- 🗺️ Distances et trajets
- 🌦️ Conditions météo
- 🔒 Respect des horaires fixés

**Résultat** :
```
Planning avant:
- Temple (flexible)
- Skytree (flexible)  
- Restaurant 14h (fixé)
- Shopping (flexible)

Planning après optimisation:
✅ 06:30 Temple (lever soleil, 0 foule)
✅ 09:00 Skytree (ouverture, peu de monde)
✅ 14:00 Restaurant (respecté)
✅ 18:00 Shopping (meilleur moment)
```

### 📋 Système de Planning Intelligent

**2 Types d'Activités** :

1. **Flexible** (⏰ jaune)
   - Horaire défini par l'IA
   - Optimisé automatiquement
   - Modifiable

2. **Fixé** (🔒 vert)
   - Horaire choisi par vous
   - Jamais modifié par l'IA
   - Prioritaire

## 🚀 Fonctionnalités Complètes

### Interface Moderne

#### Header à Onglets
- **🗺️ Route** : Planning + Ajout rapide
- **🎯 IA** : Modes Fatigue/Météo
- **⚙️ Config** : Paramètres

#### Suggestions Intelligentes
- Menu déroulant par ville
- 50+ activités pré-configurées
- 10 villes japonaises

### Gestion Avancée

#### Hébergements
- Recherche automatique
- Prix avec budget total
- Trajet depuis l'hôtel optimisé

#### Activités Cliquables
- **Clic** → Infos IA complètes
- Affluence en temps réel
- Horaires recommandés
- Règles à respecter
- Lien Google Maps

### Performance

#### Cache Intelligent
- Trajets sauvegardés
- Chargement instantané
- 90% plus rapide

#### Temps de Trajet
```
⏱️ Durée: 1h15    🏁 Arrivée: 14:30
```

## 📱 Installation

### Prérequis

- Node.js ≥ 18
- npm ou yarn
- 3 clés API

### Installation Locale

```bash
# 1. Cloner
git clone https://github.com/VOTRE_USERNAME/my-japan-trip.git
cd my-japan-trip

# 2. Installer
npm install

# 3. Configurer
cp .env.example .env
# Éditer .env avec vos clés

# 4. Lancer
npm start

# → http://localhost:3000
```

## 🔑 Clés API Requises

### OpenAI (NOUVELLE UTILISATION)

**Utilisée pour** :
- Ajout rapide (correction + analyse)
- Optimisation du planning
- Infos sur les activités

**Obtenir** :
1. [platform.openai.com](https://platform.openai.com)
2. API Keys → Create new
3. Budget : 10$/mois recommandé

### Google Maps (2 clés)

**Browser Key** (Frontend) :
- Maps JavaScript API
- Places API
- Restriction : HTTP referrers

**Server Key** (Backend) :
- Places API  
- Directions API
- Pas de restriction

## 🌐 Déploiement Render.com

### Configuration

```bash
Build Command: npm install
Start Command: npm start
Instance Type: Free
```

### Variables d'Environnement

```env
OPENAI_API_KEY=sk-proj-xxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxx
```

### URL

`https://VOTRE_APP.onrender.com`

## 📊 Architecture

### Backend (Node.js + Express)

**Nouveaux Endpoints** :

```javascript
POST /api/quick-add-activity
// Analyse description libre
// Retourne activité structurée

POST /api/optimize-day  
// Optimise planning du jour
// Retourne proposition IA

POST /api/activity-info
// Infos détaillées lieu
// Affluence, horaires, règles

POST /api/route
// Calcul itinéraire hybride
// Google Places + OSRM
```

### Frontend

**Structure** :
```
index.html
├─ Header (onglets)
├─ Planning (activités + trajets)
├─ Modal Ajout Rapide ✨
├─ Modal Optimisation 🤖
├─ Sidebar Options
└─ Modals Infos
```

### Stockage (LocalStorage)

```javascript
japan_trip_v5           // Activités
japan_day_cities_v5     // Villes
japan_day_hotels_v5     // Hôtels
japan_day_modes_v5      // Modes IA
japan_route_cache       // Cache trajets
```

## 🎮 Guide d'Utilisation

### Scénario Complet

**Jour 1 : Kyoto**

1. **Ajout Rapide**
```
Taper:
- "temple doré"
- "bambouseraie"
- "restaurant ramen 12h30" (fixé)
- "quartier geishas"

→ 4 activités ajoutées en 2 min
```

2. **Optimisation**
```
Message: "Optimiser la journée ?"
→ Cliquer Oui

IA propose:
✅ 06:30 Bambouseraie Arashiyama
   💡 Lever soleil, pas de touristes
   
✅ 09:00 Kinkaku-ji (Temple doré)
   💡 Ouverture, peu de foule
   
✅ 12:30 Restaurant Ramen
   ✅ Respecté (fixé par vous)
   
✅ 18:30 Gion (Quartier geishas)
   💡 Meilleure ambiance le soir
```

3. **Validation**
```
Vérifier les propositions
→ Cliquer "✅ Valider"
→ Planning optimisé appliqué
```

4. **Résultat**
```
Planning final:
- Trajets calculés
- Heures optimales
- Budget hôtel affiché
- Mode hors-ligne prêt
```

## 💡 Astuces

### Ajout Ultra-Rapide

```
Au lieu de remplir 5 champs:
→ Juste écrire l'activité
→ IA fait le reste
```

### Horaires Mixtes

```
Shopping flexible ✓
Dîner 19h fixé ✓
→ IA optimise autour du dîner
```

### Optimisation Partielle

```
Matin flexible
14h Rendez-vous fixé
Soir flexible
→ IA optimise matin + soir
```

## 🐛 Dépannage

### "Quick add failed"
→ Vérifier clé OpenAI + crédit

### Optimisation ne se lance pas
→ Au moins 1 activité flexible requise

### Activité mal géolocalisée
→ Utiliser mode manuel + recherche précise

## 💰 Coûts

### Render.com
- Free : Gratuit (dort après 15min)
- Hobby : 7$/mois (toujours actif)

### OpenAI
- Ajout rapide : ~0.01$ / activité
- Optimisation : ~0.10$ / jour
- **Budget** : 10$/mois confortable

### Google Maps
- Free tier : $200/mois crédit
- Usage typique : <$5/mois

**Total estimé** : 10-15$/mois

## 📈 Nouveautés v6.0

### Ajoutées
- ✨ Ajout rapide IA
- 🤖 Optimisation planning
- ⏰ Activités flexibles/fixes
- 📊 Affichage durée + arrivée
- 🎯 Suggestion horaire intelligente
- 🧹 Nettoyage interface (FAB retiré)

### Améliorées
- Modal ajout (2 modes)
- Calcul temps de trajet
- Gestion des horaires
- Backend (3 endpoints)

### Corrigées
- Swipe dans Options
- Doublons IA dans sidebar
- Cache des trajets
- Format temps (min + heures)

## 📄 Changelog

### v6.0 (Février 2026)
- 🚀 Ajout rapide intelligent
- 🤖 Optimisation automatique IA
- ⏰ Système flexible/fixe
- 📊 Temps de trajet amélioré

### v5.2 (Février 2026)
- Onglets header
- Suggestions déroulantes
- Fix swipe Options

### v5.1 (Février 2026)
- Cache trajets
- Activités cliquables
- Infos IA détaillées

### v5.0 (Février 2026)
- Version initiale
- Configuration voyage
- 10 villes + 50 suggestions
- Hébergements + budget

## 🤝 Contribution

Les contributions sont bienvenues !

```bash
git checkout -b feature/AmazingFeature
git commit -m 'Add AmazingFeature'
git push origin feature/AmazingFeature
```

Puis ouvrir une Pull Request.

## 📝 Licence

MIT License - Libre d'utilisation

## 🙏 Remerciements

- OpenAI pour GPT-4o-mini
- Google Maps Platform
- OSRM (Open Source Routing)
- Tailwind CSS

---

**Bon voyage au Japon !** 🗾🌸

Créé avec ❤️ pour simplifier la vie des voyageurs
