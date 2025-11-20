// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { authService } from '@/app/services/authService';

// Определяем типы прямо здесь
interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  dietaryPreferences: {
    cuisines: string[];
    excludedIngredients: string[];
    cookingTimeLimit: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface UserRegistrationData {
  firstName: string;
  lastName?: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: UserRegistrationData) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
}

export const useAuth = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => {
    setError(null);
  };

  useEffect(() => {
    console.log('🔄 Setting up auth listener...');
    
    try {
      const unsubscribe = authService.onAuthStateChange(async (firebaseUser: User | null) => {
        try {
          setLoading(true);
          setError(null);
          console.log('🔄 Auth state changed:', firebaseUser?.email);

          if (firebaseUser) {
            setUser(firebaseUser);
            
            try {
              const profile = await authService.getUserProfile(firebaseUser.uid);
              setUserProfile(profile);
              console.log('✅ User profile loaded successfully');
            } catch (profileError: any) {
              console.error('❌ Error loading user profile:', profileError);
              
              setUserProfile(null);
              
              if (profileError.message.includes('Профиль пользователя не найден')) {
                setError(profileError.message + ' Рекомендуем выйти и зарегистрироваться заново.');
              } else {
                setError('Ошибка загрузки профиля: ' + profileError.message);
              }
            }
          } else {
            setUser(null);
            setUserProfile(null);
            console.log('👤 No user logged in');
          }
        } catch (error: any) {
          console.error('❌ Auth state change error:', error);
          setError(error.message);
        } finally {
          setLoading(false);
        }
      });

      return () => {
        console.log('🧹 Cleaning up auth listener');
        unsubscribe();
      };
    } catch (error: any) {
      console.error('❌ Failed to set up auth listener:', error);
      setError('Не удалось инициализировать систему аутентификации');
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
  try {
    setLoading(true);
    setError(null); // Очищаем ошибки
    await authService.signIn(email, password);
  } catch (error: any) {
    throw error; // Просто пробрасываем ошибку
  } finally {
    setLoading(false);
  }
};

  const signUp = async (email: string, password: string, userData: UserRegistrationData): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await authService.signUp(email, password, userData);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await authService.signOut();
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    userProfile,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
    isAuthenticated: !!user
  };
};