import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, inMemoryPersistence } from "firebase/auth";

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

// Initialize with memory persistence to suppress the Expo warning
// Note: To persist logins across app restarts, you need AsyncStorage and a Native Development Build.
export const auth = initializeAuth(app, {
  persistence: inMemoryPersistence
});
