import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface UserProfile {
  userType?: 'regular' | 'business' | 'admin';
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: any;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Buscar perfil do usuário no Firestore
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUserProfile({ id: userDoc.id, ...userDoc.data() });
          } else {
            // Se não existe, criar documento automaticamente
            const newUserProfile = {
              email: firebaseUser.email || '',
              firstName: firebaseUser.displayName?.split(' ')[0] || '',
              lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
              profileImageUrl: firebaseUser.photoURL || '',
              userType: 'regular' as const,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            
            await setDoc(userDocRef, newUserProfile);
            setUserProfile({ id: firebaseUser.uid, ...newUserProfile });
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      } else {
        setUserProfile(null);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    userProfile,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: userProfile?.userType === 'admin',
  };
}
