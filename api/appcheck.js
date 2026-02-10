import admin from "firebase-admin";

let app;
function getAdminApp() {
  if (app) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");

  const serviceAccount = JSON.parse(raw);

  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  return app;
}

export async function verifyAppCheckToken(req) {
  const token =
    req.headers["x-firebase-appcheck"] ||
    req.headers["x-firebase-app-check"] ||
    req.headers["x-app-check"];

  if (!token || typeof token !== "string") return false;

  getAdminApp();
  const decoded = await admin.appCheck().verifyToken(token);
  return !!decoded;
}
