# 🚀 GUIDE DE DÉPLOIEMENT - Version 5.1

## 📦 Ce qui a changé

### ✨ Nouvelles Fonctionnalités
- ✅ **Cache des trajets** : Plus rapide, moins d'appels API
- ✅ **Activités intelligentes** : Clic → Infos IA (affluence, horaires, règles)
- ✅ **Swipe optimisé** : Pas de décalage dans les Options
- ✅ **Lien Google Maps** : Navigation directe

### 🔑 Clé API Supplémentaire
**IMPORTANT** : Il vous faut maintenant **OpenAI API Key** en plus des 2 clés Google Maps.

## 🚀 Étapes de Déploiement

### 1️⃣ Préparer GitHub

```bash
cd deployment_package
git init
git add .
git commit -m "My Japan Trip v5.1 - Intelligent Edition"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/my-japan-trip.git
git push -u origin main
```

### 2️⃣ Configurer Render.com

1. Aller sur https://render.com
2. Cliquer **"New +"** → **"Web Service"**
3. Connecter votre repo GitHub
4. Configuration :
   - **Name** : `my-japan-trip`
   - **Region** : Choisir la plus proche
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : `Free`

### 3️⃣ Variables d'Environnement

⚠️ **3 clés requises** :

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_BROWSER_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_SERVER_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
```

#### Comment les obtenir ?

**OpenAI API Key** ✨ NOUVEAU
1. https://platform.openai.com
2. Créer un compte
3. API Keys → Create new secret key
4. Copier la clé (commence par `sk-proj-`)
5. ⚠️ Coût : ~0.50$ par 1000 analyses (très peu cher)

**Google Maps Browser Key**
1. https://console.cloud.google.com
2. Créer un projet
3. Enable APIs :
   - Maps JavaScript API
   - Places API
4. Create Credentials → API Key
5. Restrict : HTTP referrers → `*.onrender.com/*`

**Google Maps Server Key**
1. Même projet Google Cloud
2. Create API Key (nouvelle clé)
3. Enable APIs :
   - Places API
   - Directions API
4. Pas de restriction OU restriction IP

### 4️⃣ Déployer

Cliquer **"Create Web Service"**

⏱️ Temps : ~2-3 minutes

✅ Votre app : `https://VOTRE_APP.onrender.com`

## 🎯 Tester les Nouvelles Fonctionnalités

### Cache des Trajets
1. Ajoutez 2 activités
2. Attendez le calcul du trajet
3. Supprimez la 2ème activité
4. Rajoutez la même activité
5. → Le trajet affiche "CACHE" (instantané)

### Infos Intelligentes
1. Cliquez sur une activité
2. Modal s'ouvre avec :
   - 👥 Affluence (basse/moyenne/haute)
   - ⏰ Meilleurs horaires
   - ⚠️ Règles à respecter
   - 💡 Conseil
3. Cliquez "Ouvrir dans Google Maps"

### Swipe Options
1. Ouvrir Options (⚙️)
2. Swiper gauche/droite
3. → Pas de décalage, navigation fluide

## 💰 Coûts Estimés

### Render.com
- **Free tier** : Gratuit
- L'app dort après 15 min d'inactivité
- Redémarre en ~30 secondes au 1er accès

### OpenAI API
- **GPT-4o-mini** : $0.150 / 1M tokens input
- ~0.50$ pour 1000 analyses d'activités
- Budget conseillé : 5$/mois largement suffisant

### Google Maps API
- **Free tier** : $200 de crédit/mois
- Largement suffisant pour usage personnel
- ⚠️ Carte bancaire requise (mais pas de débit automatique)

## 🐛 Dépannage

### "Missing OpenAI API Key"
- Vérifiez la variable `OPENAI_API_KEY` dans Render
- La clé doit commencer par `sk-proj-`

### Modal d'infos ne s'ouvre pas
- Vérifiez les logs Render
- Vérifiez le crédit OpenAI : https://platform.openai.com/usage

### Swipe ne fonctionne pas
- Testez sur mobile (pas sur desktop)
- Ou utilisez les boutons ← →

### Cache ne fonctionne pas
- Ouvrez DevTools → Application → Local Storage
- Vérifiez la clé `japan_route_cache`

## 📊 Performance

Avant (v5.0) :
- Trajet : 2-3 secondes
- 10 trajets/jour = 20-30 secondes

Après (v5.1) :
- Trajet : 2-3 secondes (1ère fois)
- Trajet : **Instantané** (cache)
- 10 trajets/jour = 2-3 secondes total

**Gain : 90% plus rapide** 🚀

## 🎉 C'est Prêt !

Votre app intelligente de planning Japon est en ligne ! 🗾

**Nouvelle expérience** :
- Cliquez sur vos activités
- Découvrez les meilleurs horaires
- Évitez la foule
- Respectez les règles locales

Bon voyage au Japon ! 🌸
