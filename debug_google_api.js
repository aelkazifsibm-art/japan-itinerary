import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const key = process.env.GOOGLE_MAPS_SERVER_KEY;

if (!key || key.includes('votre_cle')) {
    console.error("❌ Erreur : GOOGLE_MAPS_SERVER_KEY n'est pas configurée dans le fichier .env");
    process.exit(1);
}

async function testDirections() {
    console.log("--- Diagnostic Google Directions API ---");
    console.log("Clé utilisée : " + key.substring(0, 8) + "...");
    
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=Tokyo&destination=Osaka&mode=transit&key=${key}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        console.log("\nStatut Google : " + data.status);
        
        if (data.status === "OK") {
            console.log("✅ Succès ! L'API Directions fonctionne correctement.");
            console.log("Itinéraire trouvé : " + data.routes[0].summary);
        } else if (data.status === "REQUEST_DENIED") {
            console.log("❌ Accès refusé. Vérifiez que 'Directions API' est activée et que le billing est OK.");
            console.log("Message Google : " + (data.error_message || "Aucun message d'erreur supplémentaire."));
        } else if (data.status === "NOT_FOUND") {
            console.log("❓ NOT_FOUND. Google ne trouve pas l'itinéraire. Essayez avec 'driving' au lieu de 'transit' pour tester.");
        } else {
            console.log("⚠️ Autre statut : " + data.status);
            if (data.error_message) console.log("Message : " + data.error_message);
        }
    } catch (error) {
        console.error("❌ Erreur réseau : " + error.message);
    }
}

testDirections();
