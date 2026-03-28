import { initializeApp, getApps } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB_8j22aPlBgIgbOA1uCcqW47t0us5AKNo",
  authDomain: "mneme-f0a0d.firebaseapp.com",
  projectId: "mneme-f0a0d",
  storageBucket: "mneme-f0a0d.firebasestorage.app",
  messagingSenderId: "9810458426",
  appId: "1:9810458426:web:a40d00b2ed64d0a3ba8203",
  measurementId: "G-NW17PTVK4V",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

// Fix "Pending promise was never set" error in Next.js
// by explicitly setting persistence to localStorage instead of indexedDB
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(console.error);
}
