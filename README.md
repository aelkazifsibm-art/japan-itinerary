# 🗾 Japan Trip Planner

Une application web progressive pour planifier votre voyage au Japon avec optimisation d'itinéraire, gestion de budget et recommandations IA.

## ✨ Fonctionnalités

### 🎯 Planification Intelligente
- **Profil voyageur personnalisé** : Solo, Couple, Famille, Amis
- **Rythme adapté** : Actif, Équilibré, Détente
- **Type de voyage** : Touristique ou Authentique
- **Budget** : Économique, Moyen, Confort

### 📅 Gestion du Voyage
- Configuration des vols aller/retour
- Navigation par jour (13 jours max)
- Sélection de villes parmi 10 destinations majeures
- Gestion des hébergements par jour

### 🏨 Destinations Disponibles
- 🗼 Tokyo
- ⛩️ Kyoto
- 🏯 Osaka
- 🦌 Nara
- ☮️ Hiroshima
- 🗻 Hakone
- 🏔️ Nikko
- 🌊 Kamakura
- 🏘️ Takayama
- 🎨 Kanazawa

### 💰 Gestion de Budget
Suivi détaillé de 9 catégories :
- ✈️ Vols
- 🏨 Hébergement (auto-calculé)
- 🚄 JR Pass
- 🚇 Transports locaux
- 🍜 Repas
- 🎭 Activités
- 🛍️ Shopping
- 🛡️ Assurance
- 📦 Divers

### 🤖 Fonctionnalités IA
- **140+ suggestions d'activités** réparties sur 11 villes
- **Analyse OpenAI** des activités suggérées
- **Correction automatique** des activités ajoutées manuellement
- **Optimisation de planning** avec temps de trajet
- **Météo en temps réel** via OpenWeather API
- **Analyse de transport** (train, métro, marche)

### 🎨 Interface & UX
- **Design responsive** optimisé mobile
- **Thème violet/rose** moderne
- **Swipe-to-complete** avec confetti 🎉
- **Drag & drop** pour réorganiser
- **Navigation par onglets** : Voyage, Budget, Profil
- **FAB (Floating Action Button)** pour accès rapide config
- **Bottom navigation** toujours accessible
- **Mode Fatigue** avec alertes de surcharge
- **Badges visuels** : Tranquille, Actif, Sportif

### 📊 Optimisation Automatique
- **Temps flexible vs fixe** pour chaque activité
- **Regroupement par quartier** (ex: Shibuya, Shinjuku)
- **Calcul des temps de trajet** entre activités
- **Alertes foule** pour sites touristiques
- **Must-see tracking** pour activités incontournables

## 🚀 Installation

### Méthode 1 : Fichier unique
```bash
# Télécharger le fichier
git clone https://github.com/votre-username/japan-trip-planner.git

# Ouvrir index.html dans un navigateur
open index.html
```

### Méthode 2 : Serveur local
```bash
# Avec Python
python -m http.server 8000

# Avec Node.js
npx http-server

# Accéder à http://localhost:8000
```

### Méthode 3 : GitHub Pages
1. Fork ce repo
2. Aller dans Settings → Pages
3. Sélectionner la branche `main`
4. L'app sera disponible à `https://votre-username.github.io/japan-trip-planner`

## 🔑 Configuration API (Optionnel)

Pour activer toutes les fonctionnalités :

### OpenAI API
Pour l'analyse et correction d'activités :
```javascript
// Ligne ~2880 dans index.html
const OPENAI_API_KEY = 'votre-clé-openai';
```

### OpenWeather API
Pour la météo en temps réel :
```javascript
// Ligne ~2950 dans index.html
const OPENWEATHER_API_KEY = 'votre-clé-openweather';
```

**Note** : L'application fonctionne sans clés API, mais avec fonctionnalités réduites.

## 📱 Utilisation

### 1️⃣ Onboarding (2 étapes)
**Étape 1 - Profil** :
- Nombre de voyageurs
- Type de voyage
- Rythme souhaité
- Budget
- Accessibilité (optionnel)

**Étape 2 - Dates** :
- Vol aller : date, heure, aéroport d'arrivée
- Vol retour : aéroport de départ, date, heure

### 2️⃣ Configuration du Voyage
Cliquer sur le FAB ⚙️ en bas à droite :

**Onglet 🗺️ Voyage** :
- Navigation par jour (← JOUR X/Y →)
- Sélection de ville
- Nom et adresse de l'hôtel
- Prix par nuit (optionnel)

**Onglet 💰 Budget** :
- Saisie des montants par catégorie
- Calcul automatique du total
- Breakdown détaillé

**Onglet 👤 Profil** :
- Affichage du profil actuel
- Modification des préférences
- Modification dates/vols
- Réinitialisation

### 3️⃣ Ajout d'Activités
**Options** :
- ➕ Bouton manuel (en bas de chaque jour)
- 💡 Suggestions IA (140+ activités)
- 🔍 Recherche par ville/type

**Édition** :
- Modifier nom, quartier, temps
- Ajouter des notes
- Marquer comme "Must-see"
- Définir temps flexible/fixe

### 4️⃣ Gestion du Planning
- ✅ **Swipe droite** : Compléter (avec confetti)
- 🗑️ **Swipe gauche** : Supprimer
- 🔄 **Drag & drop** : Réorganiser
- 🤖 **Optimiser** : Réorganisation automatique

## 💾 Stockage

Toutes les données sont sauvegardées localement dans le navigateur :
- `localStorage` : Profil, dates, villes, hôtels, budget
- Pas de serveur requis
- Aucune donnée envoyée en ligne (sauf appels API)

**Données stockées** :
- `japan_user_profile` : Profil voyageur
- `japan_trip_info_v5` : Vols et dates
- `japan_day_cities_v5` : Villes par jour
- `japan_day_hotels_v5` : Hôtels par jour
- `japan_activities_v7` : Toutes les activités
- `japan_budget` : Budget complet

## 🏗️ Architecture

### Fichier unique HTML
- **HTML** : Structure de l'app
- **CSS** : Tailwind CSS inline
- **JavaScript** : ~3900 lignes vanilla JS

### Composants Principaux
```
┌─ Welcome Screen (Onboarding)
│  ├─ Étape 1 : Profil
│  └─ Étape 2 : Dates
│
├─ Planning Screen
│  ├─ Header avec titre
│  ├─ Navigation jour (Jour X/Y)
│  ├─ Liste activités par jour
│  └─ Empty state
│
├─ Configuration Screen (FAB)
│  ├─ Onglet Voyage
│  ├─ Onglet Budget
│  └─ Onglet Profil
│
└─ Sidebar Options
   ├─ Mode Fatigue
   ├─ Quick Add
   └─ Suggestions IA
```

## 🛠️ Technologies

- **HTML5** : Structure sémantique
- **Tailwind CSS** : Design system
- **Vanilla JavaScript** : Logique métier
- **OpenAI API** : Analyse et suggestions
- **OpenWeather API** : Données météo
- **LocalStorage** : Persistence

## 📈 Versions

### v6.7 (Actuelle)
- ✅ Navigation par jour dans config
- ✅ Formulaire ville/hôtel intégré
- ✅ Bottom nav toujours accessible
- ✅ Bug fixes dates et totalDays

### v6.6
- Bottom navigation bar
- User profile tab
- Restructuration 4 onglets

### v6.5
- Onboarding 2 étapes
- Profile management
- FAB implementation

### v6.0-6.4
- Quick activity addition
- AI corrections
- Budget manager
- City suggestions

### v5.0
- Flight form
- Splash screen
- Base functionality

## 🐛 Bugs Connus

- [ ] Suggestions adresse hôtel non implémentées dans config
- [ ] Mode Nuit placeholder (non fonctionnel)
- [ ] Copier hôtel précédent non implémenté

## 🗺️ Roadmap

### Court terme
- [ ] Autocomplete adresses hôtel
- [ ] Bouton "Copier hôtel d'hier"
- [ ] Export PDF du planning
- [ ] Partage du voyage

### Moyen terme
- [ ] Mode hors-ligne (PWA)
- [ ] Multi-langue (EN, FR, JP)
- [ ] Dark mode fonctionnel
- [ ] Import/Export JSON

### Long terme
- [ ] Synchronisation cloud
- [ ] Collaboration multi-users
- [ ] Cartes interactives
- [ ] Calcul de budget optimisé

## 🤝 Contribution

Les contributions sont les bienvenues ! Voici comment participer :

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 License

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👤 Auteur

Créé avec ❤️ par Claude & Human

## 🙏 Remerciements

- OpenAI pour l'API GPT
- OpenWeather pour les données météo
- Tailwind CSS pour le framework design
- Communauté open-source

## 📧 Contact

Pour toute question ou suggestion :
- 📫 Issues GitHub
- 💬 Discussions GitHub

---

**Bon voyage au Japon ! 🗾✨**
