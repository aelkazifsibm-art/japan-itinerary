# 🗾 My Japan Trip - Application de Planning de Voyage

Application web complète pour planifier votre voyage au Japon avec intelligence artificielle.

## 🌟 Fonctionnalités

### ✈️ Gestion du Voyage
- Configuration des vols (aller/retour)
- Calcul automatique du nombre de jours
- Navigation par jour avec swipe horizontal

### 📍 Organisation par Ville
- Sélection de ville par jour
- 10 villes disponibles (Tokyo, Kyoto, Osaka, Nara, etc.)
- Suggestions d'activités personnalisées par ville (50+ activités)

### 🏨 Gestion des Hébergements
- Recherche d'hôtel avec validation Google Places
- Prix par nuit avec conversion de devises
- Calcul du budget total
- Optimisation des trajets depuis l'hôtel

### 🎯 Options Intelligentes
- **Mode Fatigue** : Adaptation pour des activités plus relaxantes
- **Adaptation Météo** : Suggestions selon les conditions météo
- Activable/désactivable par jour

### 🗺️ Calcul d'Itinéraires
- Hybride Google Places + OSRM (gratuit)
- Calcul précis des temps de trajet
- Stations de transit à proximité
- Navigation optimisée

### 🤖 Intelligence Artificielle
- Normalisation des titres d'activités
- Suggestions automatiques de lieux
- Validation stricte avec Google Place ID

## 🚀 Déploiement sur Render.com

### Prérequis
1. Compte GitHub
2. Compte Render.com
3. Clés API :
   - OpenAI API Key
   - Google Maps Browser Key
   - Google Maps Server Key

### Étapes de Déploiement

#### 1. Créer un Repository GitHub
```bash
git init
git add .
git commit -m "Initial commit - My Japan Trip"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/my-japan-trip.git
git push -u origin main
```

#### 2. Configurer Render.com

1. Connectez-vous sur [Render.com](https://render.com)
2. Cliquez sur "New +" → "Web Service"
3. Connectez votre repository GitHub
4. Configuration :
   - **Name** : `my-japan-trip`
   - **Region** : Choisir la plus proche
   - **Branch** : `main`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : `Free`

#### 3. Variables d'Environnement

Dans Render.com, allez dans "Environment" et ajoutez :

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
PORT=3000
```

#### 4. Déployer
Cliquez sur "Create Web Service" et attendez le déploiement (2-3 minutes).

Votre app sera disponible sur : `https://my-japan-trip.onrender.com`

## 🔑 Obtenir les Clés API

### OpenAI API Key
1. Allez sur [platform.openai.com](https://platform.openai.com)
2. Créez un compte
3. Allez dans "API Keys"
4. Créez une nouvelle clé

### Google Maps API Keys

#### Google Maps Browser Key (pour le frontend)
1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Créez un projet
3. Activez les APIs :
   - Maps JavaScript API
   - Places API
4. Créez une clé API
5. **Restrictions** : HTTP referrers (votre domaine Render)

#### Google Maps Server Key (pour le backend)
1. Même projet Google Cloud
2. Créez une **autre** clé API
3. Activez les APIs :
   - Places API
   - Directions API
4. **Restrictions** : Aucune ou IP du serveur

## 📦 Installation Locale

```bash
# 1. Cloner le projet
git clone https://github.com/VOTRE_USERNAME/my-japan-trip.git
cd my-japan-trip

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos clés

# 4. Lancer l'application
npm start

# L'app sera disponible sur http://localhost:3000
```

## 🛠️ Technologies Utilisées

### Backend
- **Node.js** + Express
- **OpenAI API** (GPT-4o-mini)
- **Google Places API**
- **OSRM** (calcul de distance gratuit)

### Frontend
- **HTML5** + **TailwindCSS**
- **Vanilla JavaScript**
- **LocalStorage** pour la persistance
- **Google Fonts** (Poppins)

## 📱 Fonctionnement

### Structure des Données (LocalStorage)

```javascript
// Informations de voyage
japan_trip_info_v5 = {
  outbound: {
    departureDate: "2024-03-15",
    departureTime: "08:00",
    arrivalAirport: "NRT"
  },
  return: {
    departureAirport: "KIX",
    departureDate: "2024-03-25",
    departureTime: "18:00"
  },
  totalDays: 10
}

// Activités
japan_trip_v5 = [{
  id: 1234567890,
  dayIndex: 0,
  time: "09:00",
  title: "Temple Senso-ji",
  description: "Visite du temple",
  place: { place_id, name, lat, lng }
}]

// Villes par jour
japan_day_cities_v5 = {
  "0": "tokyo",
  "1": "kyoto"
}

// Hôtels par jour
japan_day_hotels_v5 = {
  "0": {
    name: "Hotel Gracery",
    place: {...},
    price: 15000,
    currency: "JPY"
  }
}

// Modes par jour
japan_day_modes_v5 = {
  "0": {
    fatigue: false,
    weather: true
  }
}
```

## 🎨 Interface

### Écran d'accueil
- Logo animé (splash screen 1.5s)
- Formulaire de vol simplifié
- Calcul automatique du nombre de jours

### Header
- Logo 🗾 My Japan Trip
- Bouton Options (⚙️)
- Bouton Ajouter Activité

### Planning
- Tuiles de suggestions par ville
- Cartes d'activités
- Blocs de navigation (temps de trajet)
- Trajet depuis l'hôtel

### Options (Sidebar plein écran)
- Sélection de ville
- Gestion d'hébergement
- Mode Fatigue / Météo
- Résumé du voyage avec budget

### Navigation (Barre du bas)
- Boutons ← →
- Jour X/Y + Date
- Cliquable + Swipe horizontal

## 🐛 Dépannage

### Erreur "Missing env"
- Vérifiez que toutes les variables d'environnement sont définies dans Render

### Erreur Google Places
- Vérifiez que les APIs sont activées dans Google Cloud Console
- Vérifiez que la facturation est activée

### L'app ne démarre pas
- Vérifiez les logs dans Render.com
- Vérifiez que `npm install` s'est bien exécuté

## 📄 Licence

MIT License - Libre d'utilisation

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## 📞 Support

Pour toute question, ouvrez une issue sur GitHub.

---

Bon voyage au Japon ! 🗾🌸
