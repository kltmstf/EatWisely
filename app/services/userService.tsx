import { 
  doc, 
  updateDoc, 
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Alert } from "react-native";
import { db, auth } from "../firebase/config";
import { 
  avatarCloudinaryService, 
  uploadUserAvatar,
  UploadResult 
} from "./cloudinaryService";

// --- ТИПЫ ДАННЫХ ---

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  description?: string;
  photoURL?: string | null;
  isProfilePrivate?: boolean;
  dietType: string[]; 
  age?: string;
  height?: string;
  weight?: string;
  gender?: string;
  goal?: string;
  activity?: string;
  allergies?: string;
  excludedIngredients?: string;
  cookingTimeLimit?: string;
  isProfileFilled?: boolean;
  cloudinaryPublicId?: string;
  targetCalories?: number;
  targetProteinGrams?: number;
  targetFatGrams?: number;
  targetCarbGrams?: number;
  updatedAt?: Timestamp;
}

// Тип для данных из формы (соответствует ProfileSettings)
export type LocalProfileData = {
  name: string;
  email: string;
  description: string;
  age: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  nutritionType: string;      // Выбранный тип для отображения в форме
  customNutritionType: string; // Кастомное значение
  allergies: string;
  dislikes: string;
  isPrivate: boolean;
  cookingTimeLimit: string;
  isProfileFilled: boolean;
  photoURL?: string;
  cloudinaryPublicId?: string;
};

type MacroTargets = {
  targetCalories: number;
  targetProteinGrams: number;
  targetFatGrams: number;
  targetCarbGrams: number;
};

class UserService {

  // --- МЕТОДЫ ПРОФИЛЯ ---

  async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) return null;
      const userData = userDoc.data();
      return { 
        id: userDoc.id, 
        dietType: userData.dietType || ["Обычное"], 
        ...userData 
      } as UserProfile;
    } catch (error) {
      console.error("Ошибка получения пользователя:", error);
      return null;
    }
  }

  async fetchUserProfile(userId: string): Promise<any | null> {
    try {
      const docSnap = await getDoc(doc(db, "users", userId));
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error("Ошибка загрузки профиля:", error);
      return null;
    }
  }

  async updateAuthProfileName(newName: string): Promise<void> {
    if (!auth.currentUser) throw new Error("Не авторизован");
    await updateProfile(auth.currentUser, { displayName: newName });
  }

  async searchUsers(searchTerm: string, limitCount: number = 10): Promise<UserProfile[]> {
    try {
      const usersRef = collection(db, 'users');
      const nameQuery = query(
        usersRef, 
        where('name', '>=', searchTerm), 
        where('name', '<=', searchTerm + '\uf8ff'), 
        orderBy('name'), 
        limit(limitCount)
      );
      const snapshot = await getDocs(nameQuery);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
    } catch (error) {
      console.error("Ошибка поиска пользователей:", error);
      return [];
    }
  }

  // --- РАБОТА С ФОТО ---

  async uploadProfilePhoto(imageUri: string, userId: string): Promise<UploadResult> {
    try {
      const result = await uploadUserAvatar(userId, imageUri);
      if (result.success && result.url) {
        await updateDoc(doc(db, "users", userId), { 
          photoURL: result.url, 
          cloudinaryPublicId: result.publicId,
          updatedAt: Timestamp.now()
        });
      }
      return result;
    } catch (error) {
      console.error("Ошибка загрузки фото:", error);
      return { success: false, error: "Не удалось загрузить фото" };
    }
  }

  async deleteProfilePhoto(userId: string, publicId?: string): Promise<void> {
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: null });
      }
      
      // Удаляем из Firestore
      await updateDoc(doc(db, "users", userId), { 
        photoURL: null, 
        cloudinaryPublicId: null, 
        updatedAt: Timestamp.now() 
      });
    } catch (error) {
      console.error("Ошибка удаления фото:", error);
      throw error;
    }
  }

  // --- СОХРАНЕНИЕ И КБЖУ ---

  async saveProfileToFirestore(profileData: LocalProfileData): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error("Не авторизован");

    // Обработка типа питания
    let dietTypeArray: string[] = [];
    
    // Если выбран пункт "Другое" и есть кастомное значение
    if (profileData.nutritionType === "Другое" && profileData.customNutritionType) {
      // Разбиваем кастомное значение по запятым (поддерживаем несколько тегов)
      dietTypeArray = profileData.customNutritionType
        .split(",")
        .map(item => item.trim())
        .filter(item => item !== "");
    } else if (profileData.nutritionType && profileData.nutritionType !== "Другое") {
      // Если выбран стандартный тип питания
      dietTypeArray = [profileData.nutritionType];
    }
    
    // Если массив пуст, ставим значение по умолчанию
    if (dietTypeArray.length === 0) {
      dietTypeArray = ["Обычное"];
    }

    // Рассчитываем макросы
    const macroTargets = this.calculateTargetMacros(profileData);

    // Подготавливаем данные для Firestore
    const firestoreData = {
      name: profileData.name || "Пользователь",
      email: profileData.email || user.email || "",
      description: profileData.description || "",
      age: profileData.age || null,
      height: profileData.height || null,
      gender: profileData.gender || null,
      weight: profileData.weight || null,
      goal: profileData.goal || null,
      activity: profileData.activity || null,
      dietType: dietTypeArray,
      allergies: profileData.allergies || null,
      excludedIngredients: profileData.dislikes || null,
      isProfilePrivate: profileData.isPrivate || false,
      cookingTimeLimit: profileData.cookingTimeLimit || "30 минут",
      isProfileFilled: profileData.isProfileFilled || true,
      photoURL: profileData.photoURL || null,
      cloudinaryPublicId: profileData.cloudinaryPublicId || null,
      targetCalories: macroTargets.targetCalories,
      targetProteinGrams: macroTargets.targetProteinGrams,
      targetFatGrams: macroTargets.targetFatGrams,
      targetCarbGrams: macroTargets.targetCarbGrams,
      updatedAt: Timestamp.now(),
    };

    // Обновляем документ пользователя
    await updateDoc(doc(db, "users", user.uid), firestoreData);
  }

  private getActivityMultiplier(activity: string): number {
    switch (activity) {
      case "Низкий (0-1 тренировка в неделю)": 
        return 1.2;
      case "Умеренный (2-3 тренировки в неделю)": 
        return 1.55;
      case "Интенсивный (3 и более тренировки в неделю)": 
        return 1.725;
      default: 
        return 1.2;
    }
  }

  private calculateTargetMacros(profileData: LocalProfileData): MacroTargets {
    const age = parseInt(profileData.age, 10);
    const height = parseInt(profileData.height, 10);
    const weight = parseInt(profileData.weight, 10);
    
    if (isNaN(age) || isNaN(height) || isNaN(weight)) {
      return { 
        targetCalories: 0, 
        targetProteinGrams: 0, 
        targetFatGrams: 0, 
        targetCarbGrams: 0 
      };
    }

    // Расчет BMR по формуле Миффлина-Сан Жеора
    let bmr = profileData.gender === "Муж" 
      ? 10 * weight + 6.25 * height - 5 * age + 5 
      : 10 * weight + 6.25 * height - 5 * age - 161;

    // Учет активности
    const tdee = bmr * this.getActivityMultiplier(profileData.activity);
    
    // Корректировка под цель
    let targetCalories = profileData.goal === "Похудение" 
      ? tdee - 500 
      : profileData.goal === "Набор веса" 
        ? tdee + 300 
        : tdee;
    
    // Минимальные значения калорий
    targetCalories = Math.max(profileData.gender === "Жен" ? 1200 : 1500, targetCalories);

    // Расчет макросов
    const proteinPerKg = this.getActivityMultiplier(profileData.activity) > 1.5 ? 2.0 : 1.5;
    const targetProteinGrams = Math.round(weight * proteinPerKg);
    const targetFatGrams = Math.round((targetCalories * 0.25) / 9);
    const targetCarbGrams = Math.max(0, Math.round((targetCalories - targetProteinGrams * 4 - targetFatGrams * 9) / 4));

    return { 
      targetCalories: Math.round(targetCalories), 
      targetProteinGrams, 
      targetFatGrams, 
      targetCarbGrams 
    };
  }
}

export const userService = new UserService();