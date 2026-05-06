import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged, signInWithCredential } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { toast } from 'sonner';

// For offline-first desktop mode we avoid inlining any Firebase secrets into the renderer bundle.
// The renderer will call `/api/firebase-config` to learn whether cloud features are enabled.
let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

export async function initFirebaseIfEnabled() {
  try {
    const resp = await fetch('/api/firebase-config');
    const cfg = await resp.json();
    if (!cfg || !cfg.enabled || !cfg.apiKey || !cfg.projectId) {
      if (import.meta.env.DEV) console.debug('Firebase: Runtime config missing');
      return false;
    }

    const firebaseConfig = {
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
      firestoreDatabaseId: cfg.firestoreDatabaseId,
    };

    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    if (import.meta.env.DEV) console.debug('Firebase: Initialized');
    return true;
  } catch (err) {
    console.error('Firebase: Initialization failed');
    return false;
  }
}

export { auth, db, googleProvider };

export const signIn = async (useRedirect = false) => {
  if (!auth || !googleProvider) {
    await initFirebaseIfEnabled();
  }

  if (!auth || !googleProvider) {
    if (import.meta.env.DEV) console.debug('Firebase: Auth unavailable, staying in local mode');
    return null;
  }

  try {
    const isElectron = typeof window !== 'undefined' && 
      (window.navigator.userAgent.toLowerCase().includes('electron') || 
       (window as any).require && (window as any).require('electron'));
    
    if (isElectron) {
      if (import.meta.env.DEV) console.debug('Firebase: Delegating login to Electron main process...');
      try {
        const electron = (window as any).electron;
        if (electron?.ipcRenderer) {
          electron.ipcRenderer.send('login-with-google');
        } else {
          // Fallback if bridge is not available (e.g. running in browser)
          const { ipcRenderer } = (window as any).require('electron');
          ipcRenderer.send('login-with-google');
        }
        return null;
      } catch (e) {
        console.warn('Firebase: ipcRenderer delegation failed, falling back to redirect...', e);
        return await signInWithRedirect(auth, googleProvider);
      }
    }

    if (useRedirect) {
      if (import.meta.env.DEV) console.debug('Firebase: Attempting signInWithRedirect...');
      return await signInWithRedirect(auth, googleProvider);
    }

    if (import.meta.env.DEV) console.debug('Firebase: Attempting signInWithPopup...');
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error: any) {
    console.error('Firebase Sign-In Error: ', error?.code || '', error?.message || '');
    
    let description = error.message;
    if (error.code === 'auth/popup-blocked-by-user' || error.code === 'auth/cancelled-by-user') {
      return null;
    } else if (error.code === 'auth/popup-blocked') {
      description = 'Login popup was blocked. Trying redirect mode...';
      toast.info('Switching Mode', { description });
      return await signInWithRedirect(auth, googleProvider);
    } else if (error.code === 'auth/unauthorized-domain') {
      description = 'Domain not authorized. Please ensure localhost is added to your Firebase Console.';
    }

    toast.error('Sign In Failed', { description, duration: 6000 });
    throw error;
  }
};

export const completeExternalSignIn = async (credentialData: string) => {
  try {
    const { idToken, accessToken } = JSON.parse(decodeURIComponent(credentialData));
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    const result = await signInWithCredential(auth, credential);
    if (import.meta.env.DEV) console.debug('Firebase: Successfully signed in with external credential');
    return result;
  } catch (error) {
    console.error('Firebase: Error completing external sign in:', error);
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
  console.error('Firestore Error:', errInfo.error);
  throw new Error(errInfo.error);
}
