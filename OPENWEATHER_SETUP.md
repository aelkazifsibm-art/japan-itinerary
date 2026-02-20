# 🌦️ Configuration OpenWeather API

## Obtenir votre clé API OpenWeather

### 1. Créer un compte

1. Aller sur [openweathermap.org](https://openweathermap.org/)
2. Cliquer sur **Sign Up**
3. Remplir le formulaire
4. Confirmer votre email

### 2. Obtenir la clé API

1. Se connecter sur [home.openweathermap.org](https://home.openweathermap.org/)
2. Aller dans **API keys**
3. Votre clé par défaut est déjà créée
4. Ou créer une nouvelle clé → **Generate**
5. Copier la clé (format : `abc123def456...`)

### 3. Activer One Call API 3.0

⚠️ **IMPORTANT** : L'app utilise **One Call API 3.0**

1. Aller sur [openweathermap.org/api](https://openweathermap.org/api)
2. Trouver **One Call API 3.0**
3. Cliquer **Subscribe**
4. Choisir le plan **Free** :
   - 1000 calls/jour
   - Gratuit
5. Entrer les informations de carte (requise mais pas de débit)

### 4. Ajouter la clé dans .env

```env
OPENWEATHER_API_KEY=abc123def456...
```

### 5. Redémarrer l'app

```bash
npm start
```

## 💰 Coûts

### Plan Free (Recommandé)
- **1000 appels/jour** gratuits
- Largement suffisant pour usage personnel
- Carte requise mais **pas de débit automatique**

### Utilisation typique
- 1 appel par activation météo
- ~10-20 appels/jour en voyage
- **0€/mois** dans les limites

## 🧪 Tester

1. Activer le mode météo (onglet 🎯 IA)
2. Message de confirmation s'affiche
3. Météo récupérée pour la ville du jour

## 🔍 Données Récupérées

```json
{
  "current": {
    "temp": 18,
    "humidity": 65,
    "description": "nuageux",
    "is_raining": false
  },
  "daily": [{
    "temp_max": 22,
    "temp_min": 15,
    "rain_probability": 30,
    "is_rainy": false
  }]
}
```

## ✨ Utilisation dans l'App

### Mode Météo Activé

L'IA utilisera ces données pour :
- ✅ Privilégier intérieur si pluie prévue
- ✅ Suggérer extérieur si beau temps
- ✅ Adapter les horaires selon température
- ✅ Éviter activités extérieures si forte pluie

### Exemple

```
Météo : 80% pluie

Planning suggéré :
✅ 09:00 Musée (intérieur)
✅ 11:00 Centre commercial (couvert)
✅ 14:00 Temple (pause pluie)
✅ 18:00 Restaurant (intérieur)
```

## 🐛 Dépannage

### "Invalid API key"
→ Vérifier que la clé est correcte dans .env

### "403 Forbidden"
→ Activer One Call API 3.0 dans votre compte

### "Quota exceeded"
→ Limite gratuite dépassée (1000/jour)

### Météo ne se charge pas
→ Vérifier les logs serveur
→ Vérifier qu'une ville est sélectionnée

## 📚 Documentation

- [OpenWeather Docs](https://openweathermap.org/api/one-call-3)
- [One Call API 3.0](https://openweathermap.org/api/one-call-3)

---

**Note** : Sans cette clé, le mode météo affichera un message d'erreur mais l'app fonctionnera normalement (optimisation sans données météo).
