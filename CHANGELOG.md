# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

## [6.7.1] - 2026-02-20

### Ajouté
- ✅ Autocomplétion d'adresse hôtel (sidebar + config)
- ✅ Connexion au backend Render pour Google Places API
- ✅ Fonction `initHotelListenersConfig()` pour autocomplete dans config

### Modifié
- `BACKEND_URL` configuré : https://japan-itinerary-7cm0.onrender.com
- Réactivation de `initHotelListeners()` pour le sidebar
- Appel API autocomplete pointe vers backend Render

### Technique
- Backend Node.js sur Render avec 4 clés API :
  - `GOOGLE_MAPS_BROWSER_KEY` - Autocomplete frontend
  - `GOOGLE_MAPS_SERVER_KEY` - Places API backend
  - `OPENAI_API_KEY` - Ajout rapide IA
  - `OPENWEATHER_API_KEY` - Météo réelle

## [6.7.0] - 2026-02-20

### Ajouté
- Navigation par jour dans l'onglet Voyage de la configuration
- Affichage du numéro de jour et de la date (ex: "JOUR 3/13 - lundi 17 mars")
- Boutons ← → pour naviguer entre les jours
- Variable `configDayIndex` pour gérer le jour indépendamment du planning
- Fonction `updateConfigDayNavigation()` pour mise à jour du header

### Modifié
- Formulaire ville/hôtel intégré directement dans l'onglet Voyage
- Retrait du bouton "Options de voyage" (remplacé par formulaire direct)
- `updateVoyageTab()` appelle maintenant `updateConfigDayNavigation()`
- `handleCityChangeConfig()` et `saveHotelInfoConfig()` utilisent `configDayIndex`

### Corrigé
- Bug "JOUR 1/NaN undefined NaN undefined" causé par mauvaise structure tripData
- Utilisation de `tripData.totalDays` au lieu de calcul manuel
- Format de date correct : `tripData.outbound.departureDate + 'T00:00:00'`

## [6.6.0] - 2026-02-20

### Ajouté
- Bottom navigation bar avec 3 onglets (Voyage, Budget, Profil)
- Onglet Profil dédié dans la configuration
- Restructuration complète de la configuration

### Modifié
- Déplacement du profil voyageur de "Profil" vers "Réglages" renommé "Profil"
- Onglet Voyage simplifié (uniquement bouton "Villes & Hôtels")
- Suppression de l'ancien onglet Profil (doublon)

### Corrigé
- FAB z-index fixé à 250 (au-dessus de config z-200)
- Empty state fixé et centré
- Responsive du formulaire onboarding (overflow, paddings réduits)

## [6.5.0] - 2026-02-19

### Ajouté
- Onboarding en 2 étapes avec swipe navigation
- Étape 1 : Profil utilisateur (voyageurs, type, rythme, budget, accessibilité)
- Étape 2 : Dates de voyage (vols aller/retour)
- Gestion du profil avec localStorage persistence
- Fonctions `selectProfile()`, `toggleAccessibility()`, `goToStep1/2()`

### Modifié
- Welcome screen transformé en container multi-step
- Indicateurs de step (● ○)
- Profile restoration au chargement

## [6.0.0] - [6.4.0]

### Ajouté
- Quick activity addition avec AI correction
- Budget manager complet (9 catégories)
- City suggestions avec fatigue/must-see metadata
- Hotel management
- Route optimization
- Swipe-to-complete avec confetti
- Drag & drop reordering
- Crowd alerts
- 140 activity suggestions

### Modifié
- Header tabs navigation
- Flexible vs fixed time system
- Automatic day optimization
- Transport analysis

## [5.0.0] - Date inconnue

### Ajouté
- Flight form initial
- Splash screen
- Bottom navigation de base
- Fonctionnalités de base du planning

---

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/)
