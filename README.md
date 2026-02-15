# 🗾 My Japan Trip - v6.4 Production

Application web intelligente avec IA pour planifier votre voyage au Japon.

![Version](https://img.shields.io/badge/version-6.4-purple)
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

## ✨ Nouveautés v6.4

### 🎯 Suggestions Intégrées (RÉVOLUTION UX)

**Fini les modals !** Les suggestions sont maintenant **directement dans le planning** :

```
┌─────────────────────────────────┐
│ 💡 Suggestions d'activités    ▼│ ← Clic pour ouvrir
├─────────────────────────────────┤
│ ⛩️ Senso-ji Temple         ⭐ →│
│ 😊 Facile  🎯 Incontournable    │
├─────────────────────────────────┤
│ 🗼 Tokyo Skytree           ⭐ →│
│ 😅 Moyen   🎯 Incontournable    │
├─────────────────────────────────┤
│ 🚶 Shibuya Crossing        ⭐ →│
│ 😊 Facile  🎯 Incontournable    │
│          ↓ Scroll ↓             │
├─────────────────────────────────┤
│ ✏️ Ou ajouter manuellement      │
└─────────────────────────────────┘
```

**Ajout en 1 clic** :
1. Clic sur suggestion
2. Loader 2 secondes
3. ✅ Activité ajoutée !

### 🏷️ Badges Informatifs

**Fatigue** :
- 😊 **Facile** (vert) - Marche minimale, accessible
- 😅 **Moyen** (jaune) - Marche modérée, quelques escaliers
- 😰 **Intense** (orange) - Randonnée, nombreux escaliers

**Importance** :
- ⭐ **Star** - Visuellement marqué
- 🎯 **Incontournable** - Must-see absolu

### ✅ Swipe pour Compléter
```
Swipe gauche → Animation confetti 🎊
→ Fond vert + Checkmark ✓
→ Sauvegardé auto
```

### 🎯 Drag & Drop
```
Maintien long → Déplacer haut/bas
→ Horaires recalculés auto
```

### 👥 Alerte Affluence
```
Pic détecté → Notification orange
→ Suggestions heures alternatives
```

## 🎮 Fonctionnalités Complètes

### 🤖 Ajout Rapide IA
- Saisie libre avec fautes
- Correction automatique
- Géolocalisation auto

### ⚡ Optimisation Automatique
- Horaires d'ouverture
- Affluence optimale
- Trajets calculés
- Météo intégrée
- Horaires fixes respectés

### 🚇 Analyse Trajets
```
⏱️ 35 min    🏁 10:35
🚶 10 min + 🚇 25 min
```

### 💰 Budget Complet
- 9 catégories
- Calcul auto hébergements
- Budget total + par jour

### 🌦️ Météo Réelle
- Prévisions 7 jours
- Optimisation adaptée

## 📋 Exemple Workflow v6.4

### Planning Journée Tokyo

**1. Ouvrir suggestions**
```
Clic "💡 Suggestions d'activités"
→ Dropdown s'ouvre
→ 6 activités visibles
```

**2. Choisir activités**
```
Clic "Senso-ji Temple" (😊 Facile ⭐🎯)
→ Loader 2s
→ ✅ Ajouté à 09:00

Clic "Tokyo Skytree" (😅 Moyen ⭐🎯)
→ ✅ Ajouté à 10:30

Clic "Shibuya Crossing" (😊 Facile ⭐🎯)
→ ✅ Ajouté à 12:00
```

**3. Optimiser**
```
"3 activités flexibles. Optimiser ?"
→ Oui
→ IA analyse
→ Planning optimisé selon affluence
```

**4. Pendant voyage**
```
[✓] 09:00 Senso-ji (swipe ← fait)
    🎊 Confetti !
    
[ ] 10:30 Tokyo Skytree
    ⚠️ Forte affluence 11h-14h
    
[✓] 12:00 Shibuya
```

## 📊 Architecture

### Backend
```javascript
POST /api/quick-add-activity  // Ajout 1 clic
POST /api/optimize-day         // Optimisation
POST /api/activity-info        // Infos affluence
POST /api/route                // Itinéraires
POST /api/check-crowd          // Vérif affluence
GET  /api/weather              // Météo
```

### Frontend
- 2800+ lignes
- Tailwind CSS
- Vanilla JS
- Touch events (swipe, drag)
- Animations (confetti, pulse)
- Dropdown intégré

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

### v6.4 (Production)
- 🎯 **Suggestions intégrées dans planning**
- 📱 **Dropdown déroulant au lieu de modal**
- ⚡ **Ajout 1 clic direct**
- 🏷️ **Badges fatigue + incontournable**
- 🔄 **Auto-loader pendant ajout**
- 🎨 **UX simplifiée et intuitive**

### v6.3
- ✅ Swipe complétion
- 🎊 Animation confetti
- 🎯 Drag & drop
- 👥 Alerte affluence

### v6.2
- 🚇 Analyse trajets détaillée

### v6.1
- 💰 Budget complet

### v6.0
- 🤖 Ajout rapide IA
- ⚡ Optimisation auto
- 🌦️ Météo OpenWeather

## 🎯 Guide Utilisation

### Ajouter Activités (Nouveau !)
```
1. Planning → Zone violette en haut
2. Clic "💡 Suggestions d'activités"
3. Dropdown s'ouvre
4. Scroll les suggestions
5. Repérer badges (😊😅😰 + ⭐🎯)
6. Clic suggestion → Loader → Ajouté !
7. Répéter pour autres activités
8. Dropdown se ferme auto
```

### Planifier Selon Énergie
```
Matin (frais) :
😊 Facile → Meiji Shrine

Midi (énergique) :
😅 Moyen → Tsukiji Market

Après-midi (pic forme) :
😰 Intense → Fushimi Inari (10000 torii)

Soir (fatigué) :
😊 Facile → Shibuya Crossing
```

### Compléter Activité
```
Swipe gauche > 100px
→ Confetti 🎊
→ Vert + ✓
→ Sauvegardé
```

### Réorganiser
```
Maintien long
→ Déplacer
→ Horaires recalculés
```

## 🧪 Tests Production

### Scénarios Validés
- ✅ Dropdown suggestions (open/close)
- ✅ Ajout 1 clic avec loader
- ✅ Badges affichés (fatigue + must-see)
- ✅ Scroll suggestions (6+ items)
- ✅ Auto-close après ajout
- ✅ Proposition optimisation
- ✅ Swipe complétion
- ✅ Drag & drop
- ✅ Alerte affluence
- ✅ Budget calcul
- ✅ Météo intégration

## 💡 Métadonnées

**60+ activités** avec :
```javascript
{
  name: "Fushimi Inari",
  emoji: "⛩️",
  fatigue: "high",      // 😰 Intense
  must_see: true        // ⭐ 🎯
}
```

**10 villes** : Tokyo, Kyoto, Osaka, Nara, Hiroshima, Hakone, Nikko, Kamakura, Takayama, Kanazawa

## 📝 Avantages v6.4

✅ **Plus rapide** - 1 clic au lieu de 5
✅ **Plus visible** - Pas de modal caché
✅ **Plus informatif** - Badges directs
✅ **Plus intuitif** - UX naturelle
✅ **Plus efficace** - Moins de clics
✅ **Plus fluide** - Animations smooth

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

**Version** : 6.4 Production  
**Status** : ✅ Production Ready  
**Innovation** : Suggestions intégrées au planning  
**UX** : ⭐⭐⭐⭐⭐
