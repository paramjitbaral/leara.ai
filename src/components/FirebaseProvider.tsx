import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { auth } from '../firebase';
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
    if (!auth) {
      console.log('Firebase Auth not available, skipping listener...');
      setIsAuthReady(true);
      return;
    }

    console.log('Setting up Firebase Auth listeners...');
    
    // 1. Check for redirect results (immediate)
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        console.log('Redirect result found:', result.user.email);
        setLocalUser(result.user);
        setUser(result.user);
      }
    }).catch(err => {
      console.error('Redirect result error:', err);
    });

    // 2. Main auth state listener
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? `User: ${firebaseUser.email}` : 'No user');
      
      // Prevent Firebase from overriding manual Local Mode login
      const currentUser = useStore.getState().user;
      if (currentUser?.uid === 'local-desktop-user' && !firebaseUser) {
        console.log('Blocking Firebase logout override as we are in Local Mode');
        setIsAuthReady(true);
        return;
      }

      setLocalUser(firebaseUser);
      setUser(firebaseUser);
      markAuthReady(firebaseUser);
    }, (error) => {
      console.error('onAuthStateChanged error:', error);
      markAuthReady(null); 
    });

    // Failsafe: If auth hasn't responded in 10 seconds, it's likely a config error
    const failsafe = setTimeout(() => {
      if (!isAuthReadyRef.current) {
        console.warn('Auth system timed out. Please check your network or Firebase configuration.');
        setIsAuthReady(true);
      }
    }, 10000);

    return () => {
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
