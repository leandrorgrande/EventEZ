import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuração do Firebase
// Project: eventu-1b077 (Project Number: 680153461859)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "eventu-1b077.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "eventu-1b077",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "eventu-1b077.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "680153461859",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:680153461859:web:44d7be8e955eb8bea37456",
  measurementId: "G-SV69PNDMV7"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar serviços
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Funções auxiliares de autenticação
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Google Maps API Key
export const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyAv1QPfxhhYJ-a7czQhXPILtUI3Qz16UAg";

export default app;
