# Japan Route Engine — Pro (Google & OSRM Hybrid)

Cette version utilise un système de validation strict pour les adresses Google et intègre OSRM pour les calculs de distance à pied gratuits.

## 🚀 Configuration des Clés Google (Important)
Pour que le système fonctionne, vous devez configurer **deux clés API** différentes dans votre fichier `.env` :

1.  **GOOGLE_MAPS_BROWSER_KEY** :
    - Utilisée pour l'Autocomplete dans le navigateur.
    - **APIs à activer** : Maps JavaScript API, Places API.
    - **Restriction recommandée** : Referrers HTTP (votre domaine).
2.  **GOOGLE_MAPS_SERVER_KEY** :
    - Utilisée par le serveur pour valider les lieux et calculer les itinéraires Transit.
    - **APIs à activer** : Places API, Directions API.
    - **Restriction recommandée** : Aucune ou restriction par IP du serveur.

## 🛠️ Installation
1. `npm install`
2. Créez votre fichier `.env` à partir de `.env.example`.
3. `npm start`

## ✨ Fonctionnalités
- **Moteur Hybride Indépendant** : Cette version ne dépend plus du mode "Transit" de Google (souvent bloqué sur les comptes gratuits au Japon). Elle combine l'IA pour la logique de transport et OSRM pour les distances à pied.
- **Validation Strict GPID** : Utilise Google Places (qui fonctionne sur tous les comptes) pour garantir la précision des lieux.
- **Vérification Santé API** : Un bouton "VÉRIFIER ÉTAT APIS" permet de valider que votre clé Google Places est bien active.
- **OSRM Gratuit** : Utilise OSRM pour tous les calculs de marche à pied, économisant vos crédits Google.
- **Intention IA** : Décrivez votre intention (ex: "voir les daims à Nara") et l'IA trouvera le lieu et l'itinéraire pour vous.
