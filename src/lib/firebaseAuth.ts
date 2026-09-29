import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup as firebaseSignInWithPopup, 
  signOut as firebaseSignOut, onAuthStateChanged as firebaseOnAuthStateChanged,
  User 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: (import.meta.env as any)?.VITE_FIREBASE_API_KEY || "AIzaSyD-dummy-key-for-auth",
  authDomain: (import.meta.env as any)?.VITE_FIREBASE_AUTH_DOMAIN || "d1-report-card.firebaseapp.com",
  projectId: (import.meta.env as any)?.VITE_FIREBASE_PROJECT_ID || "d1-report-card",
  storageBucket: (import.meta.env as any)?.VITE_FIREBASE_STORAGE_BUCKET || "d1-report-card.appspot.com",
  messagingSenderId: (import.meta.env as any)?.VITE_FIREBASE_MESSAGING_SENDER_ID || "108394829102",
  appId: (import.meta.env as any)?.VITE_FIREBASE_APP_ID || "1:108394829102:web:a1b2c3d4e5f6"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export type FirebaseUser = { uid: string; email?: string | null; displayName?: string | null };

export const signInWithPopup = async (..._args: any[]): Promise<{ user: FirebaseUser }> => {
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
};

export const fbSignOut = async (..._args: any[]): Promise<void> => {
  await firebaseSignOut(auth);
};

export const onAuthStateChanged = (
  _auth: any,
  callback: (user: FirebaseUser | null) => void
) => {
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
};
