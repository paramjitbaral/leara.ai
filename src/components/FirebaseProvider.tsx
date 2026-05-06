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

        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (cancelled) return;

          const currentUser = useStore.getState().user;
          if (currentUser?.uid === 'local-desktop-user' && !firebaseUser) {
            setIsAuthReady(true);
            return;
          }

          setLocalUser(firebaseUser);
          setUser(firebaseUser);
          markAuthReady(firebaseUser);
        }, () => {
          if (!cancelled) markAuthReady(null);
        });
      } finally {
        if (!cancelled) {
          setIsAuthReady(true);
        }
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
