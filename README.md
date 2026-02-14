# 🗾 My Japan Trip - Version 5.2

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-5.2-blue)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Fonctionnalités

### 🎯 Dernières Nouveautés (v5.2)

#### Bouton Flottant (FAB)
- **Déplaçable** : Positionnez-le où vous voulez
- **Menu en arc** : Long press → 4 options en demi-cercle
- **Accès rapide** : Options, IA, Suggestions, Budget

#### Organisation par Onglets
- **🗺️ Route** : Planning et ajout d'activités
- **🎯 IA** : Modes Fatigue & Météo (accès direct)
- **⚙️ Config** : Paramètres et modification des dates

#### Suggestions Intelligentes
- **Menu déroulant** : Clic pour afficher/masquer
- **50+ activités** par ville
- **10 villes japonaises**

### 🤖 Intelligence Artificielle

#### Activités Cliquables
- **Clic sur activité** → Analyse complète :
  - 👥 Niveau d'affluence en temps réel
  - ⏰ Horaires recommandés (moins de foule)
  - ⚠️ Règles à respecter
  - 💡 Conseils personnalisés
- **Lien Google Maps** direct

#### Modes IA par Jour
- **😴 Mode Fatigue** : Activités plus relaxantes
- **🌦️ Adaptation Météo** : Suggestions selon la pluie

### 🏨 Gestion Complète

#### Hébergements
- Recherche avec Google Places
- Prix par nuit (¥, €, $)
- **Budget total** calculé automatiquement
- **Trajet optimisé** depuis l'hôtel

#### Villes & Suggestions
- 10 villes : Tokyo, Kyoto, Osaka, Nara, Hiroshima, Hakone, Nikko, Kamakura, Takayama, Kanazawa
- 50+ suggestions d'activités pré-configurées
- Tuiles visuelles avec émojis

### ⚡ Performance

#### Cache Intelligent
- **Trajets sauvegardés** : Même origine + destination = instantané
- Badge "CACHE" sur trajets déjà calculés
- **90% plus rapide** sur visites répétées

#### Navigation Optimisée
- Swipe horizontal entre jours
- Calcul hybride : Google Places + OSRM
- Temps de trajet réalistes

## 🚀 Installation & Déploiement

### Prérequis

- Node.js ≥ 18
- npm ou yarn
- 3 clés API (voir ci-dessous)

### Installation Locale

```bash
# 1. Cloner le repo
git clone https://github.com/VOTRE_USERNAME/my-japan-trip.git
cd my-japan-trip

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés API

# 4. Lancer l'application
npm start

# L'app sera disponible sur http://localhost:3000
```

### Déploiement sur Render.com

#### 1. Préparer GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

#### 2. Configurer Render.com

1. Créer un compte sur [render.com](https://render.com)
2. **New Web Service** → Connecter votre repo GitHub
3. Configuration :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free

#### 3. Variables d'Environnement

Dans Render → Environment, ajouter :

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
```

#### 4. Déployer

Cliquer sur **"Create Web Service"**

⏱️ Temps de déploiement : ~2-3 minutes

✅ URL de votre app : `https://VOTRE_APP.onrender.com`

## 🔑 Obtenir les Clés API

### OpenAI API Key

1. Aller sur [platform.openai.com](https://platform.openai.com)
2. Créer un compte
3. **API Keys** → **Create new secret key**
4. Copier la clé (commence par `sk-proj-`)
5. Budget conseillé : 5$/mois

**Coût** : ~0.50$ pour 1000 analyses d'activités

### Google Maps API Keys

⚠️ **2 clés différentes requises**

#### Clé 1 : Browser Key (Frontend)

1. [Google Cloud Console](https://console.cloud.google.com)
2. Créer un projet
3. **APIs & Services** → **Enable APIs** :
   - Maps JavaScript API
   - Places API
4. **Credentials** → **Create API Key**
5. **Restrict Key** → **HTTP referrers**
   - Ajouter : `*.onrender.com/*`
   - Ajouter : `localhost:*` (pour dev local)

#### Clé 2 : Server Key (Backend)

1. Même projet Google Cloud
2. **Create API Key** (nouvelle clé)
3. **Enable APIs** :
   - Places API
   - Directions API
4. **Pas de restriction** OU restriction par IP

⚠️ **Activer la facturation** Google Cloud (carte requise mais reste gratuit dans les limites)

## 📊 Architecture

### Backend (Node.js + Express)

```
server.js
├─ /api/normalize-text      → Normalisation IA des titres
├─ /api/places/autocomplete → Suggestions de lieux
├─ /api/places/details      → Détails d'un lieu
├─ /api/route               → Calcul d'itinéraire hybride
└─ /api/activity-info       → Analyse IA d'activité
```

### Frontend (HTML + Tailwind + Vanilla JS)

```
public/index.html
├─ Header avec onglets (Route, IA, Config)
├─ Planning (activités + trajets)
├─ Sidebar Options (plein écran)
├─ FAB (bouton flottant déplaçable)
├─ Modal activités
└─ Modal infos IA
```

### Stockage (LocalStorage - 7 clés)

```javascript
japan_trip_info_v5         // Infos voyage (vols, dates)
japan_trip_v5              // Activités
japan_day_cities_v5        // Villes par jour
japan_day_hotels_v5        // Hébergements
japan_day_modes_v5         // Modes (Fatigue/Météo)
japan_route_cache          // Cache des trajets
fab_position               // Position du FAB
```

## 🎨 Technologies

- **Backend** : Node.js 18+, Express 4.21
- **IA** : OpenAI GPT-4o-mini
- **Maps** : Google Places API + OSRM (gratuit)
- **Frontend** : HTML5, Tailwind CSS, Vanilla JS
- **Storage** : LocalStorage + Cache intelligent
- **Fonts** : Google Fonts (Poppins)

## 📱 Fonctionnalités Détaillées

### Interface

#### Header à Onglets
- **Route** : Planning + Ajout activité
- **IA** : Toggles Fatigue/Météo
- **Config** : Paramètres

#### Bouton Flottant (FAB)
- Déplaçable (drag & drop)
- Long press → Menu en arc
- 4 raccourcis rapides

#### Suggestions Déroulantes
- Clic pour ouvrir/fermer
- Économie d'espace
- Animation fluide

### Planning

#### Activités Intelligentes
- **Clic** → Modal avec infos IA
- Lien Google Maps
- Badge "Itinéraire" + "Plus d'infos"

#### Trajets Optimisés
- Cache automatique
- Calcul depuis l'hôtel
- Temps réalistes

### Options (Sidebar)

#### Organisation par Sections
1. 📍 Ville du jour
2. 🎯 Options intelligentes (Fatigue/Météo)
3. 🏨 Hébergement (nom, adresse, prix)
4. 📅 Résumé + Budget total

#### Navigation
- Boutons ← → (pas de swipe)
- Pas de décalage horizontal
- Contenu scrollable

## 💰 Coûts Estimés

### Render.com
- **Free tier** : Gratuit
- Limites : App dort après 15 min d'inactivité

### OpenAI
- **GPT-4o-mini** : $0.150 / 1M tokens
- Usage typique : ~5$/mois

### Google Maps
- **Free tier** : $200 crédit/mois
- Largement suffisant usage personnel

**Total** : ~5$/mois (principalement OpenAI)

## 🐛 Dépannage

### "Missing env variables"
→ Vérifier les 3 clés dans Render → Environment

### Modal infos ne s'ouvre pas
→ Vérifier crédit OpenAI sur platform.openai.com

### Swipe ne fonctionne pas
→ Tester sur mobile (pas desktop avec souris)

### Trajets ne se cachent pas
→ Vider LocalStorage : `localStorage.clear()`

## 📄 Changelog

### v5.2 (Février 2026)
- ✨ Bouton flottant (FAB) déplaçable avec menu en arc
- ✨ Header à onglets (Route, IA, Config)
- ✨ Suggestions en menu déroulant
- 🐛 Fix swipe dans Options (retiré)
- 🐛 Fix overflow horizontal

### v5.1 (Février 2026)
- ✨ Cache intelligent des trajets
- ✨ Activités cliquables avec infos IA
- ✨ Optimisation horaires selon affluence
- 🐛 Fix swipe dans Options

### v5.0 (Février 2026)
- 🎉 Version initiale
- Configuration voyage (vols)
- 10 villes + 50+ suggestions
- Hébergements avec budget
- Modes Fatigue & Météo

## 📝 Licence

MIT License - Libre d'utilisation

## 🤝 Contribution

Les contributions sont bienvenues !

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit (`git commit -m 'Add AmazingFeature'`)
4. Push (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📞 Support

Pour toute question :
- Ouvrir une issue sur GitHub
- Email : [votre-email]

---

**Bon voyage au Japon !** 🗾🌸

Développé avec ❤️ pour les voyageurs
