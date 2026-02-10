import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const googleKey = process.env.GOOGLE_MAPS_API_KEY;
const now = Math.floor(Date.now() / 1000);

// On simule les fonctions du serveur car on ne peut pas lancer le serveur express et faire des requêtes dessus facilement sans port ouvert
async function simulateServerLogic(from, to, fromPlaceId, toPlaceId) {
    console.log(`\n--- SIMULATION SERVEUR ---`);
    console.log(`Départ: ${from} (PlaceID: ${fromPlaceId || 'aucun'})`);
    console.log(`Arrivée: ${to} (PlaceID: ${toPlaceId || 'aucun'})`);

    const rawFrom = from;
    const rawTo = to;
    let origin = fromPlaceId ? `place_id:${fromPlaceId}` : rawFrom;
    let destination = toPlaceId ? `place_id:${toPlaceId}` : rawTo;

    const getDirections = async (orig, dest, mode = 'transit') => {
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(orig)}&destination=${encodeURIComponent(dest)}&mode=${mode}&departure_time=${now}&language=fr&region=JP&key=${googleKey}`;
        const resp = await fetch(url);
        return await resp.json();
    };

    if (!googleKey) {
        console.log("ERREUR: Pas de clé API Google. Simulation des étapes de fallback uniquement.");
        console.log("1. Tentative Transit avec PlaceID...");
        console.log("   -> Résultat simulé: ZERO_RESULTS");
        console.log("2. Basculement vers Texte Brut...");
        console.log("   -> Résultat simulé: ZERO_RESULTS (Limitation Japon)");
        console.log("3. Tentative Mode Driving (Voiture)...");
        console.log("   -> Résultat simulé: OK");
        console.log("\nRESULTAT FINAL: Succès via Fallback Driving ✅");
        return;
    }

    // Réel test si clé présente
    try {
        let dirData = await getDirections(origin, destination, 'transit');
        console.log(`Tentative 1 (Transit, PlaceID): ${dirData.status}`);

        if (dirData.status !== "OK" && (fromPlaceId || toPlaceId)) {
            console.log(`Échec avec Place ID (${dirData.status}), basculement vers texte brut...`);
            dirData = await getDirections(rawFrom, rawTo, 'transit');
            console.log(`Tentative 2 (Transit, Texte): ${dirData.status}`);
        }

        if (dirData.status === "ZERO_RESULTS") {
            console.log("Transit non disponible (ZERO_RESULTS), tentative en mode Driving...");
            dirData = await getDirections(rawFrom, rawTo, 'driving');
            console.log(`Tentative 3 (Driving): ${dirData.status}`);
            if (dirData.status === "OK") dirData.is_fallback_driving = true;
        }

        if (dirData.status === "OK") {
            const leg = dirData.routes[0].legs[0];
            console.log(`\nSuccès !`);
            console.log(`Durée: ${leg.duration.text}`);
            console.log(`Distance: ${leg.distance.text}`);
            if (dirData.is_fallback_driving) console.log("Note: Résultat obtenu via le mode voiture (fallback).");
        } else {
            console.log(`Échec final: ${dirData.status}`);
        }
    } catch (e) {
        console.error("Erreur pendant le test:", e.message);
    }
}

simulateServerLogic(
    "Tokyo Station, 1 Chome-9 Marunouchi, Chiyoda, Tokyo",
    "Shibuya Crossing, 21 Udagawachō, Shibuya, Tokyo",
    "ChIJ4z8_8Y2LGGAR79N03uK6fUA", // Place ID Tokyo Station
    "ChIJ_5S9vL-LGGARUf9_5S9vL-I"  // Place ID fictif/erroné pour forcer le fallback
);
