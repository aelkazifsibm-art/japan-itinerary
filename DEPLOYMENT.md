# 🚀 Guide de Déploiement - My Japan Trip

## 📋 Checklist Pré-Déploiement

- [ ] Clés API obtenues (OpenAI + 2x Google Maps)
- [ ] Compte Render.com créé
- [ ] Repository GitHub créé
- [ ] Code poussé sur GitHub

## 🔑 Étape 1 : Obtenir les Clés API

### OpenAI API Key

1. **Créer un compte** : [platform.openai.com](https://platform.openai.com)
2. **Ajouter 5$ de crédit** (carte requise)
3. **API Keys** → **Create new secret key**
4. **Copier** la clé (commence par `sk-proj-`)
5. ⚠️ **La sauvegarder** (ne sera plus affichée)

### Google Maps - Clé Browser

1. **Console** : [console.cloud.google.com](https://console.cloud.google.com)
2. **Créer un projet** : "My Japan Trip"
3. **Activer la facturation** (carte requise)
4. **APIs & Services** → **Library**
5. **Activer** :
   - Maps JavaScript API
   - Places API
6. **Credentials** → **Create API Key**
7. **Restreindre** :
   - Application restrictions : **HTTP referrers**
   - Add : `*.onrender.com/*`
   - Add : `localhost:*`
8. **Copier** la clé

### Google Maps - Clé Server

1. **Même projet** Google Cloud
2. **Credentials** → **Create API Key** (nouvelle)
3. **Activer** :
   - Places API
   - Directions API
4. **Restrictions** : Aucune OU IP only
5. **Copier** la clé

⚠️ **Vous devez avoir 3 clés au total**

## 📦 Étape 2 : Préparer GitHub

### Initialiser Git

```bash
cd my-japan-trip
git init
git add .
git commit -m "🎉 Initial commit - My Japan Trip v5.2"
git branch -M main
```

### Créer le Repository

1. Aller sur [github.com](https://github.com)
2. **New repository**
3. Nom : `my-japan-trip`
4. Description : "🗾 Application intelligente de planning de voyage au Japon"
5. **Public** ou **Private**
6. Ne pas initialiser (pas de README, .gitignore)
7. **Create repository**

### Pousser le Code

```bash
git remote add origin https://github.com/VOTRE_USERNAME/my-japan-trip.git
git push -u origin main
```

✅ Code maintenant sur GitHub

## 🌐 Étape 3 : Déployer sur Render

### Créer le Service

1. **Se connecter** : [render.com](https://render.com)
2. **New +** → **Web Service**
3. **Connect GitHub** → Autoriser l'accès
4. **Sélectionner** `my-japan-trip`

### Configuration

```
Name:              my-japan-trip
Region:            Frankfurt (ou plus proche)
Branch:            main
Root Directory:    (laisser vide)
Runtime:           Node
Build Command:     npm install
Start Command:     npm start
Instance Type:     Free
```

⚠️ **Ne pas cliquer sur "Create Web Service" encore !**

### Variables d'Environnement

Cliquer sur **"Advanced"** → **Add Environment Variable**

Ajouter les 3 clés :

```env
OPENAI_API_KEY
sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxx

GOOGLE_MAPS_BROWSER_KEY
AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxx

GOOGLE_MAPS_SERVER_KEY
AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Déployer

1. **Create Web Service**
2. Attendre ~2-3 minutes
3. Logs s'affichent en temps réel

### Vérification

```
✅ Serveur prêt sur http://localhost:3000
```

✅ **Votre app est en ligne !**

URL : `https://my-japan-trip-xxxx.onrender.com`

## 🧪 Étape 4 : Tester l'Application

### Tests de Base

1. **Accéder** à votre URL Render
2. **Splash screen** apparaît (logo 🗾)
3. **Formulaire de vol** s'affiche
4. **Remplir** :
   - Date départ : Demain
   - Aéroport arrivée : Tokyo (NRT)
   - Date retour : Dans 10 jours
   - Aéroport départ : Tokyo (NRT)
5. **Cliquer** "Commencer mon planning"

### Tests Avancés

#### Test 1 : Ajouter une Activité
1. Onglet **Route**
2. **+ AJOUTER UNE ACTIVITÉ**
3. Titre : "Temple Senso-ji"
4. Heure : 09:00
5. Destination : "Senso-ji Temple Tokyo"
6. **Valider** suggestion Google
7. **ENREGISTRER**

✅ Activité apparaît dans le planning

#### Test 2 : Options IA
1. Ouvrir **Options** (bouton ⚙️ ou FAB 🎯)
2. Choisir ville : Tokyo
3. Activer **Mode Fatigue**
4. Activer **Météo**
5. Fermer Options

✅ Badges "Mode activé" apparaissent

#### Test 3 : Infos Intelligentes
1. **Cliquer** sur l'activité
2. Modal s'ouvre avec :
   - Affluence
   - Horaires recommandés
   - Règles
   - Conseil

✅ Modal fonctionne → OpenAI OK

#### Test 4 : Hôtel
1. Options → Hébergement
2. Nom : "Hotel Gracery Shinjuku"
3. Adresse : Chercher "Hotel Gracery"
4. Sélectionner suggestion
5. Prix : 15000 ¥
6. **Enregistrer**

✅ Hôtel sauvegardé + Budget mis à jour

#### Test 5 : Cache des Trajets
1. Ajouter 2 activités
2. Noter le temps de calcul du trajet
3. Supprimer la 2ème activité
4. Rajouter la même
5. Badge **CACHE** apparaît

✅ Cache fonctionne (instantané)

## 🐛 Résolution de Problèmes

### App ne démarre pas

**Logs** :
```
Error: Missing env variables
```

**Solution** :
1. Render → Environment
2. Vérifier les 3 clés sont présentes
3. Redéployer (Manual Deploy)

### Modal infos ne s'ouvre pas

**Cause** : Clé OpenAI invalide ou crédit épuisé

**Solution** :
1. [platform.openai.com/usage](https://platform.openai.com/usage)
2. Vérifier le crédit
3. Vérifier la clé dans Render

### Google Maps ne fonctionne pas

**Cause** : APIs pas activées

**Solution** :
1. Google Cloud Console
2. APIs & Services → Library
3. Activer :
   - Maps JavaScript API
   - Places API
   - Directions API
4. Attendre 2-3 minutes

### App dort après 15 min

**Normal** sur le Free Tier

**Comportement** :
- Inactive 15 min → App dort
- Première visite → Redémarre en ~30s

**Solution** :
- Upgrade vers plan payant ($7/mois)
- OU accepter le délai initial

## 🔄 Mises à Jour

### Déployer une Nouvelle Version

```bash
# 1. Faire les modifications
# 2. Commit
git add .
git commit -m "✨ Nouvelle fonctionnalité"

# 3. Push
git push origin main
```

**Render détecte automatiquement** et redéploie (~2 min)

### Rollback

Dans Render :
1. **Manual Deploy**
2. Sélectionner un commit précédent
3. **Deploy**

## 📊 Monitoring

### Logs en Direct

Render Dashboard → **Logs**

```
2024-02-15 10:23:45 ✅ Serveur prêt
2024-02-15 10:24:12 POST /api/activity-info
```

### Métriques

- **CPU** : Doit rester < 50%
- **Memory** : Doit rester < 512MB
- **Response Time** : < 1s

## 💡 Optimisations

### Performance

1. **Cache activé** ✅
2. **Compression** : Ajouter `compression` middleware
3. **CDN** : Utiliser pour assets statiques

### Sécurité

1. **HTTPS** : Automatique sur Render ✅
2. **Rate Limiting** : À ajouter si besoin
3. **CORS** : Configuré pour domaine Render

## 🎉 C'est Terminé !

Votre application est maintenant :
- ✅ **En ligne** sur Render
- ✅ **Accessible** via HTTPS
- ✅ **Sauvegardée** sur GitHub
- ✅ **Testée** et fonctionnelle

**URL de votre app** : `https://VOTRE_APP.onrender.com`

Partagez-la et bon voyage au Japon ! 🗾🌸

---

**Besoin d'aide ?** Ouvrez une issue sur GitHub
