// hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
// Предполагаем, что этот сервис может возвращать неполный профиль
import { authService } from '@/app/services/authService'; 

// --- 1. ОБНОВЛЕННЫЕ ИНТЕРФЕЙСЫ ---

interface DietaryPreferences {
    cuisines: string[];
    excludedIngredients: string[];
    cookingTimeLimit: number;
}

// Исправлено: Сделано DietaryPreferences необязательным, чтобы решить TS2345, 
// если authService.getUserProfile возвращает неполные данные.
interface UserProfile {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    // ДОБАВЛЕНО: Поле name для отображения (объединенное имя)
    name?: string; 
    // ИСПРАВЛЕНО TS2345: Сделано необязательным
    dietaryPreferences?: DietaryPreferences; 
    createdAt: Date;
    updatedAt: Date;
}

// Изменено: Теперь бэкенд ожидает name, сформированное на фронтенде
interface UserRegistrationData {
    firstName: string;
    lastName?: string;
    name: string; // <-- ДОБАВЛЕНО
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    error: string | null;
    signIn: (email: string, password: string) => Promise<void>;
    // Изменено: signUp принимает только firstName и lastName, а name формируется внутри
    signUp: (email: string, password: string, userData: { firstName: string; lastName?: string }) => Promise<void>;
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
                            // Приведение типа, чтобы соответствовать ожидаемой структуре UserProfile
                            const profile = await authService.getUserProfile(firebaseUser.uid) as UserProfile; 
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
            setError(null); 
            await authService.signIn(email, password);
        } catch (error: any) {
            // Устанавливаем ошибку здесь, чтобы она была доступна в контексте
            setError(error.message); 
            throw error; 
        } finally {
            setLoading(false);
        }
    };

    // --- 2. ИЗМЕНЕННАЯ ФУНКЦИЯ SIGN UP ---

    const signUp = async (
        email: string, 
        password: string, 
        { firstName, lastName }: { firstName: string; lastName?: string }
    ): Promise<void> => {
        try {
            setLoading(true);
            setError(null);

            // 🌟 ФОРМИРОВАНИЕ ПОЛЯ NAME 🌟
            const trimmedFirstName = firstName.trim();
            const trimmedLastName = lastName ? lastName.trim() : '';
            // Объединяем, удаляя лишние пробелы (например, если нет фамилии)
            const fullName = `${trimmedFirstName} ${trimmedLastName}`.trim(); 

            const registrationData: UserRegistrationData = {
                firstName: trimmedFirstName,
                lastName: trimmedLastName || undefined, // undefined, если пустая строка
                name: fullName, // <-- ОБЯЗАТЕЛЬНОЕ ПОЛЕ
            };

            await authService.signUp(email, password, registrationData);
            
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