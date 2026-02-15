# 🗾 My Japan Trip - v6.3 Ultimate

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

## ✨ Nouveautés v6.3

### ✅ Swipe pour Compléter
**Swipe gauche** sur une activité pour la marquer comme "faite" :
```
Swipe → Animation confetti 🎊
→ Fond vert + Checkmark ✓
→ Sauvegardé automatiquement
```

### 🎯 Drag & Drop Activités
**Maintien long** pour réorganiser :
- Déplacer haut/bas
- Horaires recalculés automatiquement
- Animation fluide

### 👥 Alerte Affluence
**Notification intelligente** :
- Détection pics touristiques
- Suggestions heures alternatives
- Animation pulse orange
- Auto-dismiss 8 secondes

### 💡 Suggestions Intégrées
**Dans le modal d'ajout** :
- Grid 2 colonnes
- Clic direct → Pré-remplissage
- Bouton masquer

### 🎨 Thème Violet
**Design cohérent** :
- Couleur principale : Purple
- Dégradés Purple → Pink
- Interface moderne

## 🎮 Fonctionnalités Complètes

### 🤖 Ajout Rapide IA
- Saisie libre avec fautes
- Correction automatique
- Géolocalisation auto
- 2 clics pour ajouter

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

### 📱 Interface 4 Onglets
- **🗺️ Route** : Planning
- **🎯 IA** : Modes
- **💰 Budget** : Gestionnaire
- **⚙️ Config** : Paramètres

## 🎯 Exemple Complet

### Journée à Tokyo

**Activités** :
```
[✓] 09:00 Senso-ji Temple (vert + ✓)
    ⏱️ 25 min    🏁 09:25
    🚶 5 min + 🚇 20 min

[ ] 09:30 Tokyo Skytree
    ⏱️ 40 min    🏁 11:10
    🚶 8 min + 🚇 32 min
    ⚠️ Forte affluence 11h-14h

[✓] 12:00 Shibuya (complété)

[ ] 13:30 Harajuku
```

**Actions** :
- ✅ Swipe gauche → Marquer fait
- 🔄 Maintien long → Réorganiser
- 👆 Clic → Voir détails

## 📊 Architecture

### Backend
```javascript
POST /api/quick-add-activity  // Ajout rapide
POST /api/optimize-day         // Optimisation
POST /api/activity-info        // Infos + affluence
POST /api/route                // Itinéraires
POST /api/check-crowd          // Vérif affluence (NOUVEAU)
GET  /api/weather              // Météo
```

### Frontend
- 2500+ lignes
- Tailwind CSS
- Vanilla JS
- Touch events (swipe, drag)
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

### v6.3 (Ultimate)
- ✅ **Swipe pour marquer fait**
- 🎊 **Animation confetti**
- 🎯 **Drag & drop activités**
- 👥 **Alerte affluence intelligente**
- 💡 **Suggestions dans modal**
- 🎨 **Thème violet/pink**

### v6.2
- 🚇 Analyse trajets détaillée
- 🎯 Affichage compact

### v6.1.1
- 🐛 Fix activités disparaissent
- 🔧 Conservation données

### v6.0
- 🤖 Ajout rapide IA
- ⚡ Optimisation auto
- 🌦️ Météo OpenWeather

## 🎯 Guide v6.3

### Marquer Activité Faite
```
1. Swipe gauche sur l'activité
2. Animation confetti 🎊
3. Fond devient vert
4. Checkmark ✓ apparaît
5. Sauvegardé auto
```

### Réorganiser Activités
```
1. Maintien long sur activité
2. Déplacer haut ou bas
3. Relâcher
4. Horaires recalculés
5. Sauvegardé auto
```

### Gérer Affluence
```
Si pic détecté:
→ Notification orange
→ Message explicatif
→ Suggestions heures
→ Auto-dismiss 8s
```

## 📝 Guide Développeur

**Voir** : `MODIFICATIONS_V6.3.md`

Contient le code complet pour :
- Swipe complétion
- Drag & drop
- Alerte affluence
- Suggestions modal
- Thème violet

## 🧪 Tests

### Scénarios Validés
- ✅ Ajout activités
- ✅ Swipe complétion (gauche)
- ✅ Animation confetti (30 particules)
- ✅ Drag & drop (haut/bas)
- ✅ Recalcul horaires
- ✅ Alerte affluence
- ✅ Optimisation IA
- ✅ Budget calcul
- ✅ Météo intégration

## 💡 Astuces

**Swipe** :
- Swipe > 100px pour valider
- Swipe < 100px → Retour

**Drag** :
- Maintien 500ms pour activer
- Déplacer doucement

**Défaire** :
- Bouton ↺ en haut à droite
- Ou double-tap (optionnel)

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

**Version** : 6.3 Ultimate  
**Status** : ✅ Production Ready  
**Features** : Swipe + Drag + Affluence  
**UX** : ⭐⭐⭐⭐⭐
