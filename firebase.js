import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDkdTjUEqX3gA6sJemzDndAM7S-VdlhgTc",
  authDomain: "ambulance-app-17004.firebaseapp.com",
  projectId: "ambulance-app-17004",
  storageBucket: "ambulance-app-17004.firebasestorage.app",
  messagingSenderId: "178451016323",
  appId: "1:178451016323:web:0286aa9fa120af177409b6",
  measurementId: "G-DGHYQ14PPP"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);