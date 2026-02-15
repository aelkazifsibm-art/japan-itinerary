# 🚀 Modifications v6.3 - Drag & Drop + Affluence + Suggestions + Swipe Complete

## 1. 🎨 Couleur Violette (Purple)

### Modifier toutes les références de couleur primary en purple

```javascript
// Changer:
border-primary → border-purple-500
bg-primary → bg-purple-500
text-primary → text-purple-700

// Exemples:
class="border-2 border-primary" → class="border-2 border-purple-500"
class="bg-primary" → class="bg-gradient-to-r from-purple-500 to-pink-500"
```

## 2. 💡 Suggestions Intégrées dans le Modal

### Ajouter après le titre du modal (ligne 595):

```html
<!-- Suggestions intégrées -->
<div id="modal-suggestions" class="hidden">
    <div class="text-sm font-bold text-purple-600 mb-2 flex justify-between items-center">
        <span>💡 Suggestions</span>
        <button onclick="closeSuggestionsInModal()" class="text-xs text-gray-400">Masquer</button>
    </div>
    <div id="modal-suggestions-grid" class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto mb-4">
        <!-- Rempli dynamiquement -->
    </div>
</div>
```

### Fonction pour afficher suggestions:

```javascript
function openModalWithSuggestions() {
    openModal();
    const city = dayCities[currentDayIndex];
    if (city && citySuggestions[city]) {
        const suggestionsDiv = document.getElementById('modal-suggestions');
        const grid = document.getElementById('modal-suggestions-grid');
        
        grid.innerHTML = citySuggestions[city].map(sug => `
            <div onclick="selectSuggestionInModal('${sug.name.replace(/'/g, "\\'")}')" 
                 class="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-3 cursor-pointer hover:shadow-lg transition-all">
                <div class="text-2xl mb-1 text-center">${sug.icon}</div>
                <div class="text-xs font-bold text-center text-purple-700">${sug.name}</div>
            </div>
        `).join('');
        
        suggestionsDiv.classList.remove('hidden');
    }
}

function selectSuggestionInModal(name) {
    document.getElementById('quick-activity-input').value = name;
    document.getElementById('modal-suggestions').classList.add('hidden');
}

function closeSuggestionsInModal() {
    document.getElementById('modal-suggestions').classList.add('hidden');
}
```

## 3. 🎯 Drag & Drop des Activités

### Modifier renderPlanning pour ajouter attributs drag:

```javascript
// Dans la création de l'activité card, ajouter:
<div 
    class="draggable ..."
    draggable="true"
    data-activity-id="${activity.id}"
    ondragstart="handleDragStart(event)"
    ondragend="handleDragEnd(event)"
    ondragover="handleDragOver(event)"
    ondrop="handleDrop(event)"
>
```

### Fonctions Drag & Drop:

```javascript
let draggedActivityId = null;

function handleDragStart(event) {
    draggedActivityId = event.target.dataset.activityId;
    event.target.classList.add('dragging');
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
}

function handleDragOver(event) {
    event.preventDefault();
    const target = event.target.closest('.draggable');
    if (target && target.dataset.activityId !== draggedActivityId) {
        target.classList.add('drag-over');
    }
}

function handleDrop(event) {
    event.preventDefault();
    const targetElement = event.target.closest('.draggable');
    if (!targetElement || !draggedActivityId) return;
    
    const targetActivityId = parseInt(targetElement.dataset.activityId);
    const draggedActivity = activities.find(a => a.id === parseInt(draggedActivityId));
    const targetActivity = activities.find(a => a.id === targetActivityId);
    
    if (!draggedActivity || !targetActivity) return;
    
    // Échanger les heures
    const tempTime = draggedActivity.time;
    draggedActivity.time = targetActivity.time;
    targetActivity.time = tempTime;
    
    // Recalculer les heures suivantes
    recalculateTimesAfterDrag(currentDayIndex);
    
    // Sauvegarder et rafraîchir
    localStorage.setItem('japan_trip_v5', JSON.stringify(activities));
    renderPlanning();
}

function recalculateTimesAfterDrag(dayIndex) {
    const dayActivities = activities
        .filter(a => a.dayIndex === dayIndex)
        .sort((a, b) => a.time.localeCompare(b.time));
    
    // Recalculer avec espacement de 1h30 + trajet
    for (let i = 1; i < dayActivities.length; i++) {
        const prev = dayActivities[i - 1];
        const current = dayActivities[i];
        
        const [hours, minutes] = prev.time.split(':').map(Number);
        let nextTime = new Date();
        nextTime.setHours(hours, minutes, 0);
        nextTime.setMinutes(nextTime.getMinutes() + 90); // 1h30 par activité
        
        current.time = `${String(nextTime.getHours()).padStart(2, '0')}:${String(nextTime.getMinutes()).padStart(2, '0')}`;
    }
}
```

## 4. 👥 Alerte Affluence

### Backend - Nouvel endpoint:

```javascript
app.post("/api/check-crowd", async (req, res) => {
    try {
        const { place_id, time } = req.body;
        
        // Obtenir les données Google Places
        const serverKey = mustEnv("GOOGLE_MAPS_SERVER_KEY");
        const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        detailsUrl.searchParams.set("place_id", place_id);
        detailsUrl.searchParams.set("fields", "name,opening_hours");
        detailsUrl.searchParams.set("key", serverKey);
        
        const detailsRes = await fetchJson(detailsUrl.toString());
        const place = detailsRes.json?.result;
        
        // Demander à l'IA d'analyser l'affluence
        const [hour] = time.split(':');
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{
                role: "user",
                content: `Pour le lieu "${place?.name || 'ce lieu'}" au Japon à ${hour}h, quel est le niveau d'affluence typique ?
                
                Retourne JSON:
                {
                    "level": "low|medium|high",
                    "message": "Court message explicatif",
                    "better_times": ["09:00", "15:00"]
                }`
            }],
            response_format: { type: "json_object" }
        });
        
        const crowd = JSON.parse(completion.choices[0].message.content);
        res.json({ success: true, crowd });
        
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
```

### Frontend - Vérification affluence:

```javascript
async function checkCrowdLevel(activity) {
    try {
        const response = await fetch('/api/check-crowd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                place_id: activity.place.place_id,
                time: activity.time
            })
        });
        
        const data = await response.json();
        if (data.success && data.crowd.level === 'high') {
            showCrowdWarning(activity, data.crowd);
        }
    } catch (e) {
        console.error('Crowd check error:', e);
    }
}

function showCrowdWarning(activity, crowdData) {
    const warning = document.createElement('div');
    warning.className = 'fixed top-20 right-4 bg-orange-500 text-white p-4 rounded-xl shadow-2xl z-[150] crowd-warning max-w-sm';
    warning.innerHTML = `
        <div class="flex items-start gap-3">
            <span class="text-2xl">⚠️</span>
            <div class="flex-1">
                <div class="font-bold mb-1">${activity.title}</div>
                <div class="text-sm opacity-90">${crowdData.message}</div>
                ${crowdData.better_times ? `
                    <div class="text-xs mt-2">
                        💡 Meilleurs créneaux: ${crowdData.better_times.join(', ')}
                    </div>
                ` : ''}
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="text-white text-xl">×</button>
        </div>
    `;
    
    document.body.appendChild(warning);
    
    // Auto-dismiss après 8 secondes
    setTimeout(() => warning.remove(), 8000);
}

// Appeler dans renderPlanning pour chaque activité
async function renderPlanning() {
    // ... code existant ...
    
    // Vérifier affluence pour chaque activité
    dayActivities.forEach(activity => {
        setTimeout(() => checkCrowdLevel(activity), 500);
    });
}
```

## 5. 📱 Bouton "+" modifié

### Remplacer le bouton d'ajout:

```html
<button onclick="openModalWithSuggestions()" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2">
    <span class="text-2xl">+</span>
    <span>AJOUTER UNE ACTIVITÉ</span>
</button>
```

## 6. 🎨 Thème Violet Global

### Tailwind config classes à utiliser:
```
primary → purple-500
primary-dark → purple-700
primary-light → purple-100
gradient → from-purple-500 to-pink-500
```

## Résumé des Modifications

✅ Couleur violette partout
✅ Suggestions dans le modal
✅ Drag & drop avec touch support
✅ Recalcul automatique des horaires
✅ Alerte affluence en temps réel
✅ **Swipe pour marquer comme fait** (NOUVEAU)
✅ **Animation confetti** (NOUVEAU)
✅ Animations fluides
✅ UX améliorée

## 6. ✅ Swipe pour Compléter (NOUVEAU)

### Fonctionnalité

Swipe vers la gauche sur une activité pour la marquer comme "faite" :
- ✅ Background vert dégradé
- ✅ Checkmark en haut à droite
- ✅ Animation confetti (30 particules)
- ✅ Sauvegarde dans localStorage

### Initialisation dans renderPlanning

```javascript
// Après la création de chaque card activité, ajouter:
setTimeout(() => {
    const element = document.querySelector(`[data-activity-id="${activity.id}"]`);
    if (element) {
        initActivitySwipe(element, activity.id);
        
        // Si déjà complétée, appliquer le style
        if (isActivityCompleted(activity.id)) {
            element.classList.add('activity-completed');
        }
    }
}, 100);
```

### Ajouter l'indicateur de swipe dans la card

```html
<div class="activity-card ... relative" data-activity-id="${activity.id}">
    <!-- Contenu existant -->
    
    <!-- Indicateur swipe -->
    <div class="swipe-indicator">
        <span>✓</span>
    </div>
</div>
```

### Bouton pour "défaire"

```html
<!-- Si activité complétée, ajouter bouton -->
${isActivityCompleted(activity.id) ? `
    <button 
        onclick="uncompleteActivity(${activity.id}); event.stopPropagation();" 
        class="absolute top-2 right-2 bg-white bg-opacity-90 rounded-full w-8 h-8 flex items-center justify-center text-green-600 hover:bg-opacity-100 z-10"
    >
        ↺
    </button>
` : ''}
```

### Animation Confetti Détaillée

```javascript
// La fonction createConfetti crée 30 particules avec:
// - Couleurs variées (or, rose, cyan, rouge, vert, violet)
// - Positions aléatoires autour du point central
// - Rotation pendant la chute (0-720°)
// - Formes variées (cercles et rectangles)
// - Durée aléatoire 1-3 secondes
// - Auto-suppression après animation
```

### Expérience Utilisateur

```
État normal:
┌────────────────────┐
│ 09:00 Senso-ji     │
│ Temple Asakusa     │
└────────────────────┘

Swipe en cours:
┌────────────────────┐──┐
│ 09:00 Senso-ji     │✓ │
│ Temple Asakusa   ←─┘  │
└────────────────────────┘

Complété:
┌────────────────────┐
│ 09:00 Senso-ji   ✓ │  🎊
│ Temple Asakusa     │ ✨🎉
└────────────────────┘  🌟
(fond vert + confetti)
```

### LocalStorage

```javascript
// Nouvelle clé:
japan_completed_v1: [123, 456, 789]
// Array des IDs d'activités complétées
```

### Double-tap pour défaire (optionnel)

```javascript
let lastTap = 0;

element.addEventListener('touchend', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    
    if (tapLength < 300 && tapLength > 0) {
        // Double tap détecté
        if (isActivityCompleted(activityId)) {
            uncompleteActivity(activityId);
        }
    }
    
    lastTap = currentTime;
});
```

Ces modifications transforment l'app en v6.3 !
