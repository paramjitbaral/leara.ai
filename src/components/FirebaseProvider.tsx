import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { auth, initFirebaseIfEnabled } from '../firebase';
import { useStore } from '../store';

interface FirebaseContextType {
  user: User | null;
  isAuthReady: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const isAuthReadyRef = React.useRef(false); // Used for failsafe closure safety
  const { setUser } = useStore();
  const [user, setLocalUser] = useState<User | null>(null);

  const markAuthReady = (fireuser: User | null) => {
    console.log('Marking Auth as Ready...');
    isAuthReadyRef.current = true;
    setLocalUser(fireuser);
    setUser(fireuser);
    setIsAuthReady(true);
  };

  useEffect(() => {
    let unsubscribe = () => {};
    let cancelled = false;
    const failsafe = setTimeout(() => {
      if (!isAuthReadyRef.current && !cancelled) {
        setIsAuthReady(true);
      }
    }, 10000);

    (async () => {
      try {
        // Try to load cached user first to avoid flicker
        const cachedUserStr = localStorage.getItem('leara-cached-user');
        if (cachedUserStr) {
          try {
            const cachedUser = JSON.parse(cachedUserStr);
            setUser(cachedUser);
            setLocalUser(cachedUser);
          } catch (e) {}
        }

        const initialized = await initFirebaseIfEnabled();
        if (cancelled || !initialized || !auth) {
          setIsAuthReady(true);
          return;
        }

        getRedirectResult(auth).then((result) => {
          if (result?.user && !cancelled) {
            setLocalUser(result.user);
            setUser(result.user);
          }
        }).catch(() => {});

        // We wait for the FIRST onAuthStateChanged call before marking auth as ready
        let firstCall = true;
        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (cancelled) return;

          const currentUser = useStore.getState().user;
          if (currentUser?.uid === 'local-desktop-user' && !firebaseUser) {
            if (firstCall) {
              markAuthReady(null);
              firstCall = false;
            }
            return;
          }

          setLocalUser(firebaseUser);
          setUser(firebaseUser);
          
          if (firstCall) {
            markAuthReady(firebaseUser);
            firstCall = false;
          }
        }, (err) => {
          console.error('FirebaseProvider: Auth error', err);
          if (!cancelled && firstCall) {
            markAuthReady(null);
            firstCall = false;
          }
        });
      } catch (err) {
        console.error('FirebaseProvider: Init error', err);
        if (!cancelled) setIsAuthReady(true);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      clearTimeout(failsafe);
    };
  }, [setUser]);

  return (
    <FirebaseContext.Provider value={{ user, isAuthReady }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
