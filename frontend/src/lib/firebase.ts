import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBw8JRPRAEoy2jnNOEBB6pbC_pUOj7q_8w",
  authDomain: "atlas-3e486.firebaseapp.com",
  projectId: "atlas-3e486",
  storageBucket: "atlas-3e486.firebasestorage.app",
  messagingSenderId: "697128380143",
  appId: "1:697128380143:web:b6cbc417fc14e14f979d1a",
  measurementId: "G-1G6P6WF7W3"
};

const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
};
