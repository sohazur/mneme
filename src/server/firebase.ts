import admin from "firebase-admin";
import type { firestore } from "firebase-admin";
import type { Auth } from "firebase-admin/auth";

if (!admin.apps.length) {
    // Uses Application Default Credentials (ADC).
    // Run `gcloud auth application-default login` to authenticate locally.
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "mneme-f0a0d",
    });
}

export const db: firestore.Firestore = admin.firestore();
export const auth: Auth = admin.auth();
