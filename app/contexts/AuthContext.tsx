// contexts/AuthContext.tsx
import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth'; // Предполагается, что это хук, управляющий Firebase auth state
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs, 
    deleteDoc,
    doc 
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth'; // Импорт для удаления аккаунта

// ----------------------------------------------------
// 1. ТИПЫ
// ----------------------------------------------------

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

// ----------------------------------------------------
// 2. КОНТЕКСТ И ХУК
// ----------------------------------------------------

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

// ----------------------------------------------------
// 3. ПРОВАЙДЕР
// ----------------------------------------------------

export const AuthProvider = ({ children }: AuthProviderProps) => {
    // Получаем все данные и функции из основного хука аутентификации
    const authData = useAuth();

    // Функция для удаления аккаунта пользователя
    const deleteUserAccount = async () => {
        
        // 🚨 КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ ДЛЯ ВЫЯВЛЕНИЯ ИСТОЧНИКА ВЫЗОВА
        console.log('🔄 [DEBUG] deleteUserAccount: Function STARTED.');
        console.log('--- CALL STACK TRACE START ---');
        // Создание нового Error() для получения текущего стека вызовов
        console.log(new Error().stack); 
        console.log('--- CALL STACK TRACE END ---');
        
        try {
            if (!authData.user) {
                console.warn('⚠️ [DEBUG] deleteUserAccount: User is NULL/unauthenticated. Cancelling deletion process.');
                throw new Error('Пользователь не авторизован');
            }

            const db = getFirestore();
            const userId = authData.user.uid;
            
            console.log(`🗑️ [DEBUG] deleteUserAccount: Processing user ID: ${userId}`);

            // Удаляем данные пользователя из Firestore
            if (db) {
                const deletePromises: Promise<void>[] = [];

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
                    console.log(`✅ [DEBUG] Firestore: Found ${userRecipesSnapshot.docs.length} recipes for deletion.`);
                } catch (error) {
                    console.error('Ошибка при удалении рецептов:', error);
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
                    console.log(`✅ [DEBUG] Firestore: Found ${userFavoritesSnapshot.docs.length} favorites for deletion.`);
                } catch (error) {
                    console.error('Ошибка при удалении избранного:', error);
                }

                // 3. Удаляем профиль пользователя
                try {
                    // Используем коллекцию 'users' или 'user_profiles' в зависимости от вашей БД. 
                    // Если вы используете 'user_profiles', верните его.
                    const userProfileRef = doc(db, "users", userId); 
                    deletePromises.push(deleteDoc(userProfileRef));
                    console.log(`✅ [DEBUG] Firestore: Added profile deletion from 'users' collection.`);
                } catch (error) {
                    console.error('Ошибка при удалении профиля:', error);
                }

                // Ждем завершения всех операций удаления
                if (deletePromises.length > 0) {
                    console.log(`⏳ [DEBUG] Firestore: Waiting for ${deletePromises.length} document deletions...`);
                    await Promise.all(deletePromises);
                    console.log('✅ [DEBUG] Firestore: All associated data deleted successfully.');
                }
            }
            
            // 🚨 Логирование перед вызовом deleteUser
            console.log(`🔥 [DEBUG] Auth: Calling deleteUser for UID: ${authData.user.uid}`);
            
            // Удаляем аккаунт из Firebase Authentication
            await deleteUser(authData.user);
            
            console.log('🎉 Аккаунт и все данные пользователя успешно удалены');
            
        } catch (error: any) {
            console.error('❌ Ошибка при удалении аккаунта:', error);
            
            // Более конкретные ошибки
            if (error.code === 'auth/requires-recent-login' || error.code === 'auth/admin-restricted-operation') {
                // Если сработал 'auth/admin-restricted-operation' или 'auth/requires-recent-login'
                throw new Error('Для удаления аккаунта требуется повторная аутентификация. Пожалуйста, выйдите и войдите снова, или повторно введите пароль.');
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