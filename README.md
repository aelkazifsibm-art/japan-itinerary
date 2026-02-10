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
- **Validation Strict GPID** : Le front envoie uniquement des tokens `gpid:<place_id>` pour garantir la précision.
- **Vérification Santé API** : Un bouton "VÉRIFIER ÉTAT APIS" permet de tester instantanément si vos clés Google sont bien configurées et actives.
- **OSRM Hybride** : Utilise OSRM pour les trajets en mode "PIED" (gratuit) et Google Directions pour le mode "OPTIMAL" (Transit).
- **Intention IA** : Si vous ne connaissez pas l'adresse, décrivez votre intention (ex: "voir les daims à Nara") et l'IA trouvera le lieu pour vous.
