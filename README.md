# Japon Route App 🇯🇵 — Version Mobile

Application optimisée pour le terrain au Japon, transformant une intention floue en itinéraire réel avec gestion du cache local.

## 🚀 Fonctionnalités Mobiles
- **Navigation par Onglets** : Accès rapide entre l'itinéraire du jour et l'historique des trajets.
- **Stratégie de Cache Local** : Chaque trajet calculé est enregistré dans le `localStorage`.
- **Mode Offline Partiel** : Les trajets déjà consultés restent accessibles même sans connexion internet.
- **Affichage Minimaliste** : Focus sur l'essentiel (Temps de transport, marche, heure d'arrivée).

## 🛠️ Installation & Lancement
1. `npm install`
2. Configurez votre `.env` (OpenAI + Google Maps API Key).
3. `vercel dev` pour le développement local.

## 🏗️ Architecture
- **Frontend** : HTML/JS pur avec navigation par onglets et gestion du `localStorage`.
- **Backend** : Vercel Serverless Function (`/api/route`) gérant l'IA et les API Google.
- **Sécurité** : Clés API protégées côté serveur.

## 📱 Utilisation Mobile
Une fois l'application chargée, effectuez vos recherches. Les résultats s'afficheront avec un badge "CACHÉ" s'ils proviennent du stockage local, garantissant une fluidité totale lors de vos déplacements.
