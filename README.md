# 🗾 My Japan Trip - v6.3 Final

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-6.3-purple)
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
| **OpenAI** | IA (ajout, optimisation, affluence) | ~10€/mois |
| **Google Maps Browser** | Autocomplete frontend | Gratuit |
| **Google Maps Server** | Places API backend | Gratuit |
| **OpenWeather** | Météo réelle | **GRATUIT** |

## ✨ Fonctionnalités v6.3

### 💡 Suggestions Intelligentes (NOUVEAU)

**Scroll vertical** avec badges informatifs :
```
⛩️ Senso-ji Temple    ⭐
😊 Facile  🎯 Incontournable

🗼 Tokyo Skytree      ⭐
😅 Moyen   🎯 Incontournable
```

**Badges** :
- 😊 **Facile** (vert) - Marche minimale
- 😅 **Moyen** (jaune) - Marche modérée  
- 😰 **Intense** (orange) - Randonnée, escaliers
- 🎯 **Incontournable** (violet) - Must-see
- ⭐ **Star** - Visuellement marqué

### ✅ Swipe pour Compléter
```
Swipe gauche → Animation confetti 🎊
→ Fond vert + Checkmark ✓
→ Sauvegardé auto
```

### 🎯 Drag & Drop
```
Maintien long → Déplacer haut/bas
→ Horaires recalculés
→ Sauvegarde auto
```

### 👥 Alerte Affluence
```
Pic détecté → Notification orange
→ Suggestions heures alternatives
→ Auto-dismiss 8s
```

### 🎨 Thème Violet
```
Primary: Purple (#8b5cf6)
Gradients: Purple → Pink
```

## 🎮 Fonctionnalités Complètes

### 🤖 Ajout Rapide IA
- Saisie libre
- Correction auto
- Géolocalisation
- 2 clics

### ⚡ Optimisation Automatique
- Horaires ouverture
- Affluence
- Trajets
- Météo
- Horaires fixes respectés

### 🚇 Analyse Trajets
```
⏱️ 35 min    🏁 10:35
🚶 10 min + 🚇 25 min
```

### 💰 Budget
- 9 catégories
- Calcul auto hébergements
- Total + par jour

### 🌦️ Météo Réelle
- Prévisions 7 jours
- Optimisation adaptée

### 📱 Interface
- **🗺️ Route** : Planning
- **🎯 IA** : Modes
- **💰 Budget** : Gestionnaire
- **⚙️ Config** : Paramètres

## 📋 Exemple Journée Tokyo

### Suggestions avec Infos
```
Modal → Suggestions scrollables

⛩️ Senso-ji Temple    ⭐
😊 Facile  🎯 Incontournable

🚶 Shibuya Crossing   ⭐
😊 Facile  🎯 Incontournable

🗼 Tokyo Skytree      ⭐
😅 Moyen   🎯 Incontournable

⛩️ Meiji Shrine       ⭐
😊 Facile  🎯 Incontournable

🐟 Tsukiji Market
😅 Moyen

🎮 Akihabara
😅 Moyen
```

### Planning Optimisé
```
[✓] 09:00 Senso-ji (complété)
    ⏱️ 25 min    🏁 09:25
    🚶 5 min + 🚇 20 min

[ ] 09:30 Tokyo Skytree
    ⚠️ Forte affluence 11h-14h

[✓] 12:00 Shibuya

[ ] 13:30 Meiji Shrine
```

### Actions
- 👆 Clic suggestion → Pré-rempli
- ✅ Swipe gauche → Marquer fait
- 🔄 Maintien long → Réorganiser
- 👁️ Clic activité → Détails

## 📊 Architecture

### Backend
```javascript
POST /api/quick-add-activity  // Ajout rapide
POST /api/optimize-day         // Optimisation
POST /api/activity-info        // Infos affluence
POST /api/route                // Itinéraires
POST /api/check-crowd          // Vérif affluence
GET  /api/weather              // Météo
```

### Frontend
- 2650+ lignes
- Tailwind CSS
- Vanilla JS
- Touch events
- Animations (confetti, pulse)

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

### v6.3 Final
- 💡 **Suggestions scroll vertical**
- 🏷️ **Badges fatigue (😊😅😰)**
- ⭐ **Badge incontournable**
- ✅ Swipe complétion
- 🎊 Animation confetti
- 🎯 Drag & drop
- 👥 Alerte affluence
- 🎨 Thème violet

### v6.2
- 🚇 Analyse trajets

### v6.1
- 💰 Budget complet

### v6.0
- 🤖 Ajout rapide IA
- ⚡ Optimisation auto

## 🎯 Guide Utilisation

### Choisir Activités
```
1. Clic "+ AJOUTER"
2. Voir suggestions (scroll)
3. Repérer ⭐ incontournables
4. Vérifier 😊😅😰 fatigue
5. Clic suggestion
6. Flexible/Fixé
7. Ajouter
```

### Planifier Selon Énergie
```
Matin :
😊 Facile (Meiji Shrine)

Midi :
😅 Moyen (Tsukiji Market)

Après-midi :
😰 Intense (Fushimi Inari - 10000 torii)

Soir :
😊 Facile (Shibuya)
```

### Marquer Complété
```
1. Swipe gauche > 100px
2. Confetti 🎊
3. Fond vert
4. Checkmark ✓
5. Auto-save
```

### Réorganiser
```
1. Maintien long
2. Déplacer haut/bas
3. Relâcher
4. Horaires recalculés
5. Auto-save
```

## 📝 Guide Développeur

**Voir** : `MODIFICATIONS_V6.3.md`

Contient code pour :
- Swipe complétion
- Drag & drop
- Alerte affluence
- Suggestions badges
- Thème violet

## 🧪 Tests

### Scénarios Validés
- ✅ Suggestions scroll
- ✅ Badges fatigue/incontournable
- ✅ Swipe complétion
- ✅ Confetti (30 particules)
- ✅ Drag & drop
- ✅ Recalcul horaires
- ✅ Alerte affluence
- ✅ Optimisation IA
- ✅ Budget
- ✅ Météo

## 💡 Métadonnées Suggestions

**50+ activités** avec :
- Niveau fatigue (low/medium/high)
- Incontournable (true/false)
- Emoji + Image
- Requête Google Places

**Exemples** :
```javascript
{
  name: "Fushimi Inari",
  emoji: "⛩️",
  fatigue: "high",      // Escaliers 10000 torii
  must_see: true        // Iconique
}

{
  name: "Kinkaku-ji",
  emoji: "🏯",
  fatigue: "low",       // Jardin plat
  must_see: true        // Temple d'or
}
```

## 📝 Licence

MIT License

## 🙏 Technologies

- OpenAI GPT-4o-mini
- Google Maps Platform
- OpenWeather API 3.0
- Node.js + Express
- Tailwind CSS
- Touch Events API

---

**Bon voyage au Japon !** 🗾🌸

**Version** : 6.3 Final  
**Status** : ✅ Production Ready  
**Features** : Suggestions + Swipe + Drag + Affluence  
**UX** : ⭐⭐⭐⭐⭐
