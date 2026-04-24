// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyADa8RmjK4FP3PiIdXe5x-EnI9Kr-RWz2U",
  authDomain: "mecsbcs.firebaseapp.com",
  projectId: "mecsbcs",
  storageBucket: "mecsbcs.firebasestorage.app",
  messagingSenderId: "715591074203",
  appId: "1:715591074203:web:08a679c92802026b89613e",
  measurementId: "G-4M7HF9XPNG"
};

// Initialize Firebase only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
