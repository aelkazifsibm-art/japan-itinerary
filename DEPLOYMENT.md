# 🚀 GUIDE DE DÉPLOIEMENT RAPIDE

## Étape 1 : Préparer GitHub

```bash
# Dans le dossier du projet
git init
git add .
git commit -m "First commit"
git branch -M main

# Créer un repo sur GitHub, puis :
git remote add origin https://github.com/VOTRE_USERNAME/my-japan-trip.git
git push -u origin main
```

## Étape 2 : Déployer sur Render.com

1. Aller sur https://render.com
2. Se connecter avec GitHub
3. Cliquer "New +" → "Web Service"
4. Sélectionner votre repo `my-japan-trip`
5. Configuration :
   - Name: `my-japan-trip`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: `Free`

## Étape 3 : Ajouter les Variables d'Environnement

Dans Render → Environment :

```
OPENAI_API_KEY=sk-...
GOOGLE_MAPS_BROWSER_KEY=AIzaSy...
GOOGLE_MAPS_SERVER_KEY=AIzaSy...
```

## Étape 4 : Déployer

Cliquer sur "Create Web Service"

⏱️ Temps : ~2-3 minutes

✅ Votre app sera sur : https://VOTRE_APP.onrender.com

---

## 🔑 Obtenir les Clés API (si vous ne les avez pas)

### OpenAI
1. https://platform.openai.com
2. API Keys → Create new key
3. Copier la clé (commence par `sk-`)

### Google Maps (2 clés différentes)

#### Clé 1 : Browser Key
1. https://console.cloud.google.com
2. Créer un projet
3. APIs & Services → Enable APIs
   - Maps JavaScript API
   - Places API
4. Credentials → Create API Key
5. Restrict key → HTTP referrers → Ajouter `*.onrender.com/*`

#### Clé 2 : Server Key
1. Même projet
2. Create API Key (nouvelle clé)
3. Enable APIs
   - Places API
   - Directions API
4. Pas de restriction OU restriction par IP

---

## ⚠️ IMPORTANT

- **2 clés Google différentes** : Une pour browser, une pour serveur
- **Activer la facturation Google Cloud** (carte requise mais reste gratuit dans les limites)
- **Render.com Free Tier** : L'app dort après 15 min d'inactivité (redémarre en 30s au premier accès)

---

## 🎉 C'est tout !

Votre app de planning Japon est en ligne ! 🗾
