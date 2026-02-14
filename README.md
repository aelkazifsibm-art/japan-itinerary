# 🗾 My Japan Trip - Application Intelligente de Planning de Voyage

Application web complète avec IA pour planifier votre voyage au Japon.

## 🆕 Nouvelles Fonctionnalités

### 🎯 Activités Intelligentes (OpenAI)
- **Clic sur activité** → Analyse complète :
  - 👥 Niveau d'affluence à l'heure prévue
  - ⏰ Horaires recommandés (moins de monde)
  - ⚠️ Règles à respecter
  - 💡 Conseils personnalisés
- **Lien Google Maps** direct pour navigation
- Optimisation automatique des horaires

### ⚡ Performance
- **Cache des trajets** : Les itinéraires sont sauvegardés
- Si même origine + destination → Chargement instantané
- Badge "CACHE" sur les trajets déjà calculés

### 📱 UX Améliorée
- **Swipe dans Options** corrigé (plus de décalage)
- Navigation fluide entre les jours
- Prévention du scroll horizontal indésirable

## 🌟 Fonctionnalités Complètes

### ✈️ Configuration Voyage
- Formulaire de vol simplifié
- Calcul automatique de la durée
- Navigation par jour avec swipe

### 📍 Organisation par Ville
- 10 villes japonaises
- 50+ suggestions d'activités
- Tuiles visuelles par ville

### 🏨 Hébergements
- Recherche avec Google Places
- Prix + Budget total
- Optimisation trajets depuis l'hôtel

### 🤖 Intelligence Artificielle
- **GPT-4o-mini** pour analyse des activités
- Normalisation des titres
- Suggestions contextuelles
- Optimisation horaires selon affluence

### 🗺️ Calcul d'Itinéraires
- Cache intelligent
- Google Places + OSRM
- Temps de trajet réalistes
- Navigation optimisée

### 🎯 Options Intelligentes
- Mode Fatigue (activités relaxantes)
- Adaptation Météo
- Configurable par jour

## 🚀 Déploiement Render.com

### Variables d'Environnement Requises

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
PORT=3000
```

### Commandes

```bash
# Build
npm install

# Start
npm start

# Dev (local)
node server.js
```

### Étapes Render.com

1. **New Web Service** → Connecter GitHub
2. **Build Command** : `npm install`
3. **Start Command** : `npm start`
4. **Environment** : Ajouter les 3 clés API
5. Deploy → ~2-3 minutes

## 🔑 APIs Utilisées

### OpenAI API
- **Usage** : Analyse des activités, affluence, règles
- **Modèle** : gpt-4o-mini
- **Endpoint** : `/api/activity-info`

### Google Maps API
- **Browser Key** : Autocomplete, validation frontend
- **Server Key** : Places API, calculs backend

### OSRM
- **Usage** : Calcul de distance (gratuit)
- **Public** : router.project-osrm.org

## 📊 Endpoints Backend

### POST `/api/normalize-text`
Normalise les titres d'activités via IA

### POST `/api/places/autocomplete`
Suggestions de lieux (Google Places)

### POST `/api/places/details`
Détails d'un lieu (coordonnées, adresse)

### POST `/api/route`
Calcul d'itinéraire hybride

### POST `/api/activity-info` ✨ NOUVEAU
Analyse complète d'une activité :
```json
{
  "place_name": "Senso-ji Temple",
  "place_address": "2 Chome-3-1 Asakusa, Tokyo",
  "visit_time": "09:00"
}
```

Retourne :
```json
{
  "crowd_level": "low|medium|high",
  "best_times": ["09:00-10:00", "15:00-16:00"],
  "rules": ["Pas de photos flash", "Tenue respectueuse"],
  "tips": "Arrivez tôt pour éviter la foule"
}
```

## 💾 Cache & Performance

### Cache des Trajets
```javascript
// Clé : "place_id_origine-place_id_destination"
routeCache = {
  "ChIJxxx-ChIJyyy": {
    summary: "15 min à pied",
    details: "Instructions...",
    arrival: "10:15",
    total_minutes: 15
  }
}
```

### LocalStorage (6 clés)
- `japan_trip_info_v5` - Infos voyage
- `japan_trip_v5` - Activités
- `japan_day_cities_v5` - Villes par jour
- `japan_day_hotels_v5` - Hôtels
- `japan_day_modes_v5` - Modes (Fatigue/Météo)
- `japan_route_cache` - Cache trajets

## 🎨 Interface

### Activités Cliquables
- **Hover** : Ombre + curseur pointer
- **Clic** : Modal avec infos IA
- **Badges** :
  - 🗺️ Itinéraire (lien Google Maps)
  - ℹ️ Plus d'infos (modal)

### Modal Informations
- 👥 Affluence (vert/jaune/rouge)
- ⏰ Horaires recommandés
- ⚠️ Règles à respecter
- 💡 Conseil personnalisé
- 🗺️ Bouton Google Maps

## 🛠️ Technologies

- **Backend** : Node.js + Express
- **IA** : OpenAI GPT-4o-mini
- **Maps** : Google Places API + OSRM
- **Frontend** : HTML5 + Tailwind + Vanilla JS
- **Storage** : LocalStorage + Cache intelligent

## 📱 Mobile-First

- Design responsive
- Swipe gestures optimisés
- Touch-friendly
- Prévention scroll horizontal

## 🐛 Corrections V5.1

✅ Cache des trajets implémenté
✅ Swipe Options corrigé (pas de décalage)
✅ Activités cliquables avec infos IA
✅ Optimisation horaires selon affluence
✅ Lien Google Maps direct

## 📄 Licence

MIT - Libre d'utilisation

---

**Version** : 5.1 - Intelligent Edition
**Date** : Février 2026
