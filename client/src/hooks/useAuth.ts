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
            console.log('[useAuth] Perfil encontrado:', userDoc.data());
            setUserProfile({ id: userDoc.id, ...userDoc.data() });
          } else {
            // Se não existe, criar documento automaticamente
            console.log('[useAuth] Criando novo perfil para:', firebaseUser.email);
            const newUserProfile = {
              email: firebaseUser.email || '',
              firstName: firebaseUser.displayName?.split(' ')[0] || '',
              lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
              profileImageUrl: firebaseUser.photoURL || '',
              userType: 'regular' as const,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            try {
              await setDoc(userDocRef, newUserProfile);
              console.log('[useAuth] Perfil criado com sucesso');
              setUserProfile({ id: firebaseUser.uid, ...newUserProfile });
            } catch (createError: any) {
              console.error('[useAuth] Erro ao criar perfil:', createError);
              // Se falhar ao criar, usar dados básicos do Firebase Auth
              setUserProfile({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                firstName: firebaseUser.displayName?.split(' ')[0] || '',
                lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
                profileImageUrl: firebaseUser.photoURL || '',
                userType: 'regular' as const,
              });
            }
          }
        } catch (error: any) {
          console.error('[useAuth] Error fetching user profile:', error);
          // Em caso de erro, usar dados básicos do Firebase Auth
          setUserProfile({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            firstName: firebaseUser.displayName?.split(' ')[0] || '',
            lastName: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
            profileImageUrl: firebaseUser.photoURL || '',
            userType: 'regular' as const,
          });
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
