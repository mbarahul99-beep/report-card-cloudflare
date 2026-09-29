import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup as firebaseSignInWithPopup, 
  signOut as firebaseSignOut, onAuthStateChanged as firebaseOnAuthStateChanged,
  User 
} from 'firebase/auth';

const apiKey = (import.meta.env as any)?.VITE_FIREBASE_API_KEY || "AIzaSyDyrUk7c7Yh6LfdJFzUwoeC8wqwYCRXmwc";
const authDomain = (import.meta.env as any)?.VITE_FIREBASE_AUTH_DOMAIN || "saas-report-card.firebaseapp.com";
const projectId = (import.meta.env as any)?.VITE_FIREBASE_PROJECT_ID || "saas-report-card";
const storageBucket = (import.meta.env as any)?.VITE_FIREBASE_STORAGE_BUCKET || "saas-report-card.firebasestorage.app";
const messagingSenderId = (import.meta.env as any)?.VITE_FIREBASE_MESSAGING_SENDER_ID || "470872022573";
const appId = (import.meta.env as any)?.VITE_FIREBASE_APP_ID || "1:470872022573:web:65b8c437a570d2730e22a4";

const isConfigValid = Boolean(apiKey && apiKey.trim() && !apiKey.includes('dummy') && !apiKey.includes('YOUR_'));

let app: any = null;
let auth: any = null;
let googleProvider: any = null;

try {
  const firebaseConfig = { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} catch (e) {
  console.warn("Firebase Auth init error:", e);
}

export { auth, googleProvider };
export type FirebaseUser = { uid: string; email?: string | null; displayName?: string | null };

export const signInWithPopup = async (..._args: any[]): Promise<{ user: FirebaseUser }> => {
  if (auth && googleProvider && isConfigValid) {
    try {
      const result = await firebaseSignInWithPopup(auth, googleProvider);
      return {
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName
        }
      };
    } catch (err: any) {
      console.error("Firebase Google Auth error:", err);
      throw err;
    }
  }

  // Fallback prompt if Firebase API Key environment variables are not added yet
  return new Promise<{ user: FirebaseUser }>((resolve, reject) => {
    const email = window.prompt(
      "Firebase Auth Setup Required:\n\nTo connect production Google SSO, please provide your Firebase Web App credentials.\n\nEnter your Google Account email address to sign in:",
      "mbarahul99@gmail.com"
    );
    if (email && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      resolve({
        user: {
          uid: 'google_' + cleanEmail.replace(/[^a-zA-Z0-9]/g, '_'),
          email: cleanEmail,
          displayName: cleanEmail.split('@')[0]
        }
      });
    } else {
      const err: any = new Error("auth/popup-closed-by-user");
      err.code = "auth/popup-closed-by-user";
      reject(err);
    }
  });
};

export const fbSignOut = async (): Promise<void> => {
  if (auth) {
    try {
      await firebaseSignOut(auth);
    } catch (e) {
      console.warn("Firebase signOut error:", e);
    }
  }
};

export const onAuthStateChanged = (
  _authObj: any,
  callback: (user: FirebaseUser | null) => void
) => {
  if (auth && isConfigValid) {
    return firebaseOnAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        callback({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName
        });
      } else {
        callback(null);
      }
    });
  }
  return () => {};
};
