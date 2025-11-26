// contexts/AuthContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc,
  doc 
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';

// Определяем тип для контекста
interface AuthContextType {
  user: any;
  userProfile: any;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, userData: any) => Promise<void>;
  signOut: () => Promise<void>;
  deleteUserAccount: () => Promise<void>;
  clearError: () => void;
  isAuthenticated: boolean;
}

// Создаем контекст
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Создаем хук для использования контекста
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const authData = useAuth();

  // Функция для удаления аккаунта пользователя
  const deleteUserAccount = async () => {
    try {
      if (!authData.user) {
        throw new Error('Пользователь не авторизован');
      }

      const db = getFirestore();
      const userId = authData.user.uid;

      // Удаляем данные пользователя из Firestore
      if (db) {
        const deletePromises = [];

        // 1. Удаляем рецепты пользователя
        try {
          const userRecipesQuery = query(
            collection(db, "recipes"),
            where("userId", "==", userId)
          );
          const userRecipesSnapshot = await getDocs(userRecipesQuery);
          
          userRecipesSnapshot.docs.forEach(doc => {
            deletePromises.push(deleteDoc(doc.ref));
          });
        } catch (error) {
          console.log('Ошибка при удалении рецептов:', error);
        }

        // 2. Удаляем избранное пользователя
        try {
          const userFavoritesQuery = query(
            collection(db, "user_favorites"),
            where("userId", "==", userId)
          );
          const userFavoritesSnapshot = await getDocs(userFavoritesQuery);
          
          userFavoritesSnapshot.docs.forEach(doc => {
            deletePromises.push(deleteDoc(doc.ref));
          });
        } catch (error) {
          console.log('Ошибка при удалении избранного:', error);
        }

        // 3. Удаляем профиль пользователя
        try {
          const userProfileRef = doc(db, "user_profiles", userId);
          deletePromises.push(deleteDoc(userProfileRef));
        } catch (error) {
          console.log('Ошибка при удалении профиля:', error);
        }

        // Ждем завершения всех операций удаления
        if (deletePromises.length > 0) {
          await Promise.all(deletePromises);
        }
      }

      // Удаляем аккаунт из Firebase Authentication
      await deleteUser(authData.user);
      
      console.log('Аккаунт и все данные пользователя успешно удалены');
      
    } catch (error: any) {
      console.error('Ошибка при удалении аккаунта:', error);
      
      // Более конкретные ошибки
      if (error.code === 'auth/requires-recent-login') {
        throw new Error('Для удаления аккаунта требуется повторная аутентификация. Пожалуйста, войдите снова.');
      } else if (error.code === 'auth/network-request-failed') {
        throw new Error('Проблемы с сетью. Проверьте подключение к интернету.');
      } else {
        throw new Error('Не удалось удалить аккаунт. Попробуйте позже.');
      }
    }
  };

  // Объединяем данные из useAuth с новой функцией
  const value = {
    ...authData,
    deleteUserAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};