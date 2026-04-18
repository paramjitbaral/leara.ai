import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { useStore } from '../store';

interface FirebaseContextType {
  user: User | null;
  isAuthReady: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const { setUser } = useStore();
  const [user, setLocalUser] = useState<User | null>(null);

  useEffect(() => {
    console.log('Setting up onAuthStateChanged listener...');
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser ? `User: ${firebaseUser.email}` : 'No user');
      setLocalUser(firebaseUser);
      setUser(firebaseUser);
      setIsAuthReady(true);
    }, (error) => {
      console.error('onAuthStateChanged error:', error);
      setIsAuthReady(true); // Still set to ready so we don't hang, but show error
    });

    return () => unsubscribe();
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
