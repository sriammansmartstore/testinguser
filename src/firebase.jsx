// Firebase config and initialization
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDTzovF1RChmczvRXTNtY9-i-cOTI2JAuQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sri-amman-smart-store.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sri-amman-smart-store",
  storageBucket: "sri-amman-smart-store.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_PROJECT_NUMBER || "1018585256480",
  appId: "1:1018585256480:web:1312d2d636b0672098a245",
  measurementId: "G-7D1TG59XVM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { app };
