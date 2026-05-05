import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { toast } from 'sonner';

// Configuration from environment variables for production/Vercel
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ai-studio-applet-webapp-24ad3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-3a9f682c-2499-40fd-98f5-a8c7f8371f24"
};

let app: any;
let auth: any;
let db: any;
let googleProvider: any;

const isConfigValid = firebaseConfig.apiKey && firebaseConfig.projectId;

if (isConfigValid) {
  try {
    console.log('Firebase: Initializing with Project:', firebaseConfig.projectId);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
  } catch (err) {
    console.error('Firebase: Initialization failed:', err);
  }
} else {
  console.warn('Firebase: Configuration incomplete. Cloud features disabled.');
}

export { auth, db, googleProvider };

export const signIn = async (useRedirect = false) => {
  if (!isConfigValid) {
    const errorMsg = 'Firebase configuration is incomplete. Check your .env file.';
    console.error('Firebase:', errorMsg);
    toast.error('Cloud Features Disabled', {
      description: 'Firebase API Key or Project ID is missing in .env',
      duration: 5000
    });
    return null;
  }

  if (!auth || !googleProvider) {
    const errorMsg = 'Firebase Auth or Google Provider not initialized.';
    console.error('Firebase:', errorMsg);
    toast.error('Auth Error', {
      description: errorMsg,
      duration: 5000
    });
    return null;
  }

  try {
    const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('electron');
    
    if (useRedirect || isElectron) {
      console.log('Firebase: Attempting signInWithRedirect (Desktop Optimized)...');
      return await signInWithRedirect(auth, googleProvider);
    }

    console.log('Firebase: Attempting signInWithPopup...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('Firebase: signInWithPopup successful');
    return result;
  } catch (error: any) {
    console.error('Firebase Sign-In Error:', error.code, error.message);
    
    // Categorize common errors for better UX
    let description = error.message;
    if (error.code === 'auth/popup-blocked-by-user' || error.code === 'auth/cancelled-by-user') {
      return null; // Silent cancel
    } else if (error.code === 'auth/popup-blocked') {
      description = 'Login popup was blocked by the app. Trying redirect mode...';
      toast.info('Switching to Redirect Mode', { description });
      return await signInWithRedirect(auth, googleProvider);
    } else if (error.code === 'auth/unauthorized-domain') {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
      description = `Domain "${currentHost}" is not authorized. Please add it to Authorized Domains in Firebase Console > Authentication > Settings.`;
      console.error('Firebase: Unauthorized domain detected:', currentHost);
    }

    toast.error('Sign In Failed', {
      description,
      duration: 6000
    });
    throw error;
  }
};

export const logOut = () => signOut(auth);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
