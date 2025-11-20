// services/authService.ts
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  UserCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, DocumentSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

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

class AuthService {
  private auth = auth;
  private db = db;

  // Регистрация нового пользователя
  async signUp(email: string, password: string, userData: UserRegistrationData): Promise<void> {
    try {
      console.log('🔄 Starting sign up process...');
      
      const userCredential: UserCredential = await createUserWithEmailAndPassword(
        this.auth, 
        email, 
        password
      );
      
      const user: User = userCredential.user;
      console.log('✅ User created in Auth:', user.uid);

      // Создаем профиль пользователя в Firestore
      const userProfile: UserProfile = {
        id: user.uid,
        email: email,
        firstName: userData.firstName,
        lastName: userData.lastName || '',
        dietaryPreferences: {
          cuisines: [],
          excludedIngredients: [],
          cookingTimeLimit: 60
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(this.db, 'users', user.uid), userProfile);
      console.log('✅ User profile created in Firestore');

      if (userData.firstName) {
        await updateProfile(user, {
          displayName: `${userData.firstName} ${userData.lastName || ''}`.trim()
        });
      }

      console.log('🎉 Sign up completed successfully');
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Вход пользователя
  async signIn(email: string, password: string): Promise<void> {
  try {
    console.log('🔄 Signing in...', email);
    await signInWithEmailAndPassword(this.auth, email, password);
    console.log('✅ Sign in successful');
  } catch (error: any) {
    console.error('❌ Sign in error:', error.code, error.message);
    throw new Error(this.getErrorMessage(error.code));
  }
}

  // Выход
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      console.log('✅ Sign out successful');
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      throw new Error('Ошибка при выходе из системы');
    }
  }

  // Получить профиль пользователя
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(this.db, 'users', userId);
      const docSnap: DocumentSnapshot = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('✅ User profile found');
        return {
          id: docSnap.id,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          dietaryPreferences: data.dietaryPreferences,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        } as UserProfile;
      } else {
        console.log('❌ User profile not found in Firestore');
        throw new Error('PROFILE_NOT_FOUND');
      }
    } catch (error: any) {
      console.error('❌ Get user profile error:', error);
      if (error.message === 'PROFILE_NOT_FOUND') {
        throw new Error('Профиль пользователя не найден. Пожалуйста, зарегистрируйтесь заново.');
      }
      throw new Error('Ошибка при загрузке профиля пользователя');
    }
  }

  // Слушатель изменения состояния аутентификации
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    console.log('🔄 Setting up auth state listener...');
    return onAuthStateChanged(this.auth, callback);
  }

  // Получить текущего пользователя
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  // Восстановление пароля
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email);
      console.log('✅ Password reset email sent');
    } catch (error: any) {
      console.error('❌ Password reset error:', error);
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Преобразование кодов ошибок в понятные сообщения
  private getErrorMessage(errorCode: string): string {
  const errorMessages: { [key: string]: string } = {
    'auth/email-already-in-use': 'Этот email уже используется. Попробуйте войти или восстановить пароль.',
    'auth/invalid-email': 'Неверный формат email. Проверьте правильность написания.',
    'auth/weak-password': 'Пароль должен содержать минимум 6 символов.',
    'auth/user-not-found': 'Пользователь с таким email не найден. Проверьте email или зарегистрируйтесь.',
    'auth/wrong-password': 'Неверный пароль. Проверьте правильность ввода или восстановите пароль.',
    'auth/invalid-credential': 'Неверный email или пароль. Проверьте правильность введенных данных.',
    'auth/too-many-requests': 'Слишком много попыток. Попробуйте позже.',
    'auth/network-request-failed': 'Ошибка сети. Проверьте подключение к интернету.',
    'auth/user-disabled': 'Аккаунт заблокирован. Обратитесь в поддержку.',
    'auth/operation-not-allowed': 'Этот метод входа не разрешен. Обратитесь к администратору.'
  };

  // Логируем неизвестные коды ошибок для отладки
  if (!errorMessages[errorCode]) {
    console.log('⚠️ Unknown Firebase error code:', errorCode);
    return `Ошибка авторизации. Пожалуйста, попробуйте снова. (${errorCode})`;
  }

  return errorMessages[errorCode];
}
}

export const authService = new AuthService();
export default authService;