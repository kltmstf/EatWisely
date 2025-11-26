// services/authService.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  UserCredential,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  DocumentSnapshot,
  Timestamp, // <-- 1. Импорт Timestamp
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

// --- ИНТЕРФЕЙС 1: Как хранится в Firestore (с Timestamp) ---
interface FirestoreProfile {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  // --- ПОЛЯ ПРОФИЛЯ ---
  description: string;
  age: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  dietType: string;
  allergies: string;
  excludedIngredients: string;
  cookingTimeLimit: string;
  isProfilePrivate: boolean;
  isProfileFilled: boolean;

  // ⭐️ НОВЫЕ ПОЛЯ ДЛЯ КБЖУ (в БД храним как number)
  targetCalories: number;
  targetProteinGrams: number;
  targetFatGrams: number;
  targetCarbGrams: number;

  // --- ДАТЫ: Тип Timestamp для чтения из БД ---
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// --- ИНТЕРФЕЙС 2: Как возвращается в приложение (с Date) ---
// Используем Omit, чтобы исключить Timestamp поля и заменить их на Date
interface ClientProfile
  extends Omit<FirestoreProfile, "createdAt" | "updatedAt"> {
  createdAt: Date; // <-- Тип Date для приложения
  updatedAt: Date; // <-- Тип Date для приложения
}

interface UserRegistrationData {
  firstName: string;
  lastName?: string;
}

class AuthService {
  private auth = auth;
  private db = db;

  // Регистрация нового пользователя
  async signUp(
    email: string,
    password: string,
    userData: UserRegistrationData
  ): Promise<void> {
    try {
      console.log("🔄 Starting sign up process...");

      const userCredential: UserCredential =
        await createUserWithEmailAndPassword(this.auth, email, password);

      const user: User = userCredential.user;
      console.log("✅ User created in Auth:", user.uid);

      // 2. Создаем объект, который соответствует структуре Firestore.
      const userProfile = {
        id: user.uid,
        email: email,
        firstName: userData.firstName,
        lastName: userData.lastName || "",
        // Устанавливаем разумные значения по умолчанию
        description: "",
        age: "",
        height: "",
        gender: "Муж",
        weight: "",
        goal: "Поддержание веса",
        activity: "Низкий (0-1 тренировка в неделю)",
        dietType: "Обычное",
        allergies: "",
        excludedIngredients: "",
        cookingTimeLimit: "60", // Дефолтное время готовки
        isProfilePrivate: false, // Дефолтная приватность
        isProfileFilled: false, // Профиль не заполнен на этом этапе

        // ⭐️ Инициализируем новые поля КБЖУ нулями (0)
        targetCalories: 0,
        targetProteinGrams: 0,
        targetFatGrams: 0,
        targetCarbGrams: 0,

        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(this.db, "users", user.uid), userProfile);
      console.log("✅ User profile created in Firestore (NEW SCHEMA)");

      if (userData.firstName) {
        await updateProfile(user, {
          displayName: `${userData.firstName} ${
            userData.lastName || ""
          }`.trim(),
        });
      }

      console.log("🎉 Sign up completed successfully");
    } catch (error: any) {
      console.error("❌ Sign up error:", error);

      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Вход пользователя
  async signIn(email: string, password: string): Promise<void> {
    try {
      console.log("🔄 Signing in...", email);
      console.log("🔧 Auth instance:", this.auth?.app?.name);
      console.log("🔧 Project ID:", this.auth?.app?.options?.projectId);

      const result = await signInWithEmailAndPassword(
        this.auth,
        email,
        password
      );
      console.log("✅ Sign in successful", result.user.uid);
    } catch (error: any) {
      console.error("❌ FULL Sign in error:", {
        code: error.code,
        message: error.message,
        stack: error.stack,
      });

      const isAuthError =
        error.code === "auth/invalid-credential" ||
        error.code === "auth/user-not-found" ||
        error.code === "auth/wrong-password";

      if (isAuthError) {
        console.warn("⚠️ Login failed: Invalid credentials");
      }

      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Выход
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      console.log("✅ Sign out successful");
    } catch (error: any) {
      console.error("❌ Sign out error:", error);
      throw new Error("Ошибка при выходе из системы");
    }
  }

  // --- ОБНОВЛЕННЫЙ МЕТОД getUserProfile ---
  // 3. Возвращаем ClientProfile
  async getUserProfile(userId: string): Promise<ClientProfile | null> {
    try {
      const docRef = doc(this.db, "users", userId);
      const docSnap: DocumentSnapshot = await getDoc(docRef);

      if (docSnap.exists()) {
        // 4. Читаем данные как FirestoreProfile (с Timestamp)
        const data = docSnap.data() as FirestoreProfile;
        console.log("✅ User profile found");

        // Преобразовываем Timestamp в Date при возврате
        return {
          id: docSnap.id,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName || "",

          description: data.description || "",
          age: data.age || "",
          height: data.height || "",
          gender: data.gender || "Муж",
          weight: data.weight || "",
          goal: data.goal || "Поддержание веса",
          activity: data.activity || "Низкий (0-1 тренировка в неделю)",

          dietType: data.dietType || "Обычное",
          allergies: data.allergies || "",
          excludedIngredients: data.excludedIngredients || "",
          cookingTimeLimit: data.cookingTimeLimit || "60",
          isProfilePrivate: data.isProfilePrivate || false,
          isProfileFilled: data.isProfileFilled || false,

          // ⭐️ Читаем новые поля КБЖУ (используем 0 как дефолт, если поля еще не существуют)
          targetCalories: data.targetCalories || 0,
          targetProteinGrams: data.targetProteinGrams || 0,
          targetFatGrams: data.targetFatGrams || 0,
          targetCarbGrams: data.targetCarbGrams || 0,

          // 5. Используем .toDate() для преобразования Timestamp в Date
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as ClientProfile; // 6. Утверждаем тип возвращаемого объекта
      } else {
        console.log("❌ User profile not found in Firestore");
        throw new Error("PROFILE_NOT_FOUND");
      }
    } catch (error: any) {
      console.error("❌ Get user profile error:", error);
      if (error.message === "PROFILE_NOT_FOUND") {
        throw new Error(
          "Профиль пользователя не найден. Пожалуйста, зарегистрируйтесь заново."
        );
      }
      throw new Error("Ошибка при загрузке профиля пользователя");
    }
  }

  // Слушатель изменения состояния аутентификации
  onAuthStateChange(callback: (user: User | null) => void): () => void {
    console.log("🔄 Setting up auth state listener...");
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
      console.log("✅ Password reset email sent");
    } catch (error: any) {
      console.error("❌ Password reset error:", error);
      throw new Error(this.getErrorMessage(error.code));
    }
  }

  // Преобразование кодов ошибок в понятные сообщения
  private getErrorMessage(errorCode: string): string {
    const INVALID_CREDENTIALS_MSG =
      "Неверный email или пароль. Проверьте правильность введенных данных.";

    const errorMessages: { [key: string]: string } = {
      "auth/email-already-in-use":
        "Этот email уже используется. Попробуйте войти или восстановить пароль.",
      "auth/invalid-email":
        "Неверный формат email. Проверьте правильность написания.",
      "auth/weak-password": "Пароль должен содержать минимум 6 символов.",
      "auth/user-not-found": INVALID_CREDENTIALS_MSG,
      "auth/wrong-password": INVALID_CREDENTIALS_MSG,
      "auth/invalid-credential": INVALID_CREDENTIALS_MSG,
      "auth/too-many-requests": "Слишком много попыток. Попробуйте позже.",
      "auth/network-request-failed":
        "Ошибка сети. Проверьте подключение к интернету.",
      "auth/user-disabled": "Аккаунт заблокирован. Обратитесь в поддержку.",
      "auth/operation-not-allowed":
        "Этот метод входа не разрешен. Обратитесь к администратору.",
    };

    if (!errorMessages[errorCode]) {
      console.log("⚠️ Unknown Firebase error code:", errorCode);
      return `Ошибка авторизации. Пожалуйста, попробуйте снова. (${errorCode})`;
    }

    return errorMessages[errorCode];
  }
}

export const authService = new AuthService();
export default authService;
