# 🗾 Japan Trip Planner v6.7.1

Application web progressive pour planifier votre voyage au Japon avec IA.

![Version](https://img.shields.io/badge/version-6.7.1-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## ⚡ Installation Express

### Frontend Seul (Ce Repository)
```bash
# Ouvrir directement dans le navigateur
open index.html

# Ou avec un serveur local
python -m http.server 8000
# → http://localhost:8000
```

## 🔗 Backend Configuration

Le frontend est configuré pour se connecter à :
```javascript
const BACKEND_URL = 'https://japan-itinerary-7cm0.onrender.com'
```

**Important** : Ce frontend nécessite un backend Node.js déployé sur Render avec 4 clés API configurées.

### Endpoints Backend Requis

1. `GET /api/places/autocomplete?q=...` - Autocomplétion adresse
2. `GET /api/places/details?place_id=...` - Détails lieu
3. `POST /api/quick-add-activity` - Ajout rapide IA
4. `POST /api/optimize-day` - Optimisation planning
5. `POST /api/activity-info` - Infos activité
6. `GET /api/weather?city=...&date=...` - Météo temps réel

### Variables d'Environnement Backend

```env
GOOGLE_MAPS_BROWSER_KEY=AIzaSy...
GOOGLE_MAPS_SERVER_KEY=AIzaSy...
OPENAI_API_KEY=sk-proj-...
OPENWEATHER_API_KEY=...
```

## ✨ Fonctionnalités

### Core (Sans Backend)
- ✅ Onboarding profil + dates
- ✅ Navigation par jour
- ✅ 140+ suggestions activités
- ✅ Gestion budget
- ✅ Drag & drop, swipe

### Avancées (Avec Backend)
- ✅ Autocomplétion adresse hôtel
- ✅ Ajout rapide IA
- ✅ Optimisation auto planning
- ✅ Météo temps réel

## 📱 Utilisation

1. **Onboarding** : Profil → Dates
2. **Planning** : Ajout activités par jour
3. **Config (FAB ⚙️)** : Villes/hôtels, budget, profil

## 🐛 Dépannage

**Autocomplétion ne fonctionne pas**
→ Vérifier backend accessible + GOOGLE_MAPS_SERVER_KEY

**Backend "Service Unavailable"**
→ Render free tier dort après 15min, première requête le réveille (30-60s)

## 📝 Licence

MIT License

---

**Bon voyage au Japon !** 🗾🌸
