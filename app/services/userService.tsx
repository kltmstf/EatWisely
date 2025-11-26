// services/userService.ts

import { doc, updateDoc, Timestamp, getDoc } from "firebase/firestore";
// 🚨 НОВЫЙ ИМПОРТ: для обновления имени пользователя
import { updateProfile } from "firebase/auth";
import { Alert } from "react-native";
import { db, auth } from "../firebase/config";

// --- ТИПЫ ДАННЫХ ---

// ⚠️ Этот тип должен совпадать с тем, что вы сохраняете в AsyncStorage (в ProfileSetup.tsx)
type LocalProfileData = {
  // Добавлены поля name и email для сохранения в базу/Auth
  name: string;
  email: string;
  description: string;
  age: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  nutritionType: string; // Локальное имя
  customNutritionType: string; // Добавлено, чтобы корректно обрабатывать "Другое"
  allergies: string;
  dislikes: string; // Локальное имя
  isPrivate: boolean; // Локальное имя
  cookingTimeLimit: string;
  isProfileFilled: boolean;
};

// Тип для результатов расчета КБЖУ
type MacroTargets = {
  targetCalories: number;
  targetProteinGrams: number;
  targetFatGrams: number;
  targetCarbGrams: number;
};

class UserService {
  /**
   * Обновляет имя пользователя (displayName) в Firebase Authentication.
   * @param newName Новое имя пользователя.
   */
  // ⭐️ НОВЫЙ МЕТОД, требуемый ProfileSettings.tsx
  async updateAuthProfileName(newName: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      console.error("User not authenticated for updating display name.");
      throw new Error("Необходима авторизация для обновления имени.");
    }

    try {
      // Используем функцию updateProfile из Firebase Auth SDK
      await updateProfile(user, { displayName: newName });
      console.log("✅ Firebase Auth display name updated successfully.");
    } catch (error) {
      console.error("❌ Failed to update Firebase Auth display name:", error);
      Alert.alert(
        "Ошибка обновления имени",
        "Не удалось обновить имя пользователя в системе авторизации."
      );
      throw new Error("Не удалось обновить имя пользователя в Auth.");
    }
  }

  /**
   * Загружает данные профиля из Firestore.
   * @param userId UID пользователя.
   * @returns Объект данных профиля из Firestore или null.
   */
  async fetchUserProfile(userId: string): Promise<any | null> {
    try {
      const userDocRef = doc(db, "users", userId);
      const docSnap = await getDoc(userDocRef);
      if (docSnap.exists()) {
        console.log("✅ Profile data loaded from Firestore.");
        return docSnap.data();
      } else {
        return null;
      }
    } catch (error) {
      console.error("❌ Error fetching profile from Firestore:", error);
      return null;
    }
  }

  // --- МЕТОДЫ РАСЧЕТА (Без изменений) ---

  /**
   * Преобразование уровня активности в коэффициент метаболизма (PAL - Physical Activity Level).
   * @param activity Уровень активности из профиля.
   */
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

  /**
   * 🧠 Расчет целевых КБЖУ на основе формулы Миффлина-Сан Жеора.
   * @param profileData Данные профиля пользователя.
   * @returns Объект с рассчитанными целевыми макросами.
   */
  private calculateTargetMacros(profileData: LocalProfileData): MacroTargets {
    const age = parseInt(profileData.age, 10);
    const height = parseInt(profileData.height, 10);
    const weight = parseInt(profileData.weight, 10);
    const gender = profileData.gender;
    const goal = profileData.goal;

    if (isNaN(age) || isNaN(height) || isNaN(weight) || weight <= 0) {
      console.warn("Missing or invalid physical data for macro calculation.");
      return {
        targetCalories: 0,
        targetProteinGrams: 0,
        targetFatGrams: 0,
        targetCarbGrams: 0,
      };
    }

    // 1. Расчет базового метаболизма (BMR) по формуле Миффлина-Сан Жеора
    let bmr: number;
    if (gender === "Муж") {
      // Мужчины: BMR = 10 * вес (кг) + 6.25 * рост (см) - 5 * возраст (лет) + 5
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      // Женщины
      // Женщины: BMR = 10 * вес (кг) + 6.25 * рост (см) - 5 * возраст (лет) - 161
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // 2. Расчет суточной нормы калорий (TDEE) с учетом активности
    const activityMultiplier = this.getActivityMultiplier(profileData.activity);
    let tdee = bmr * activityMultiplier;

    // 3. Корректировка TDEE с учетом цели
    let targetCalories: number;
    switch (goal) {
      case "Похудение":
        targetCalories = tdee - 500; // Дефицит 500 ккал
        break;
      case "Набор веса":
        targetCalories = tdee + 300; // Профицит 300 ккал
        break;
      case "Поддержание веса":
      default:
        targetCalories = tdee;
        break;
    }

    const minCalories = gender === "Жен" ? 1200 : 1500;
    targetCalories = Math.max(minCalories, targetCalories);

    // 4. Расчет макронутриентов
    // Белки: 1.5-2.2 г на кг веса
    const proteinPerKg = activityMultiplier > 1.5 ? 2.0 : 1.5;
    let targetProteinGrams = Math.round(weight * proteinPerKg);

    // Жиры: 25% от калорий
    const fatCalories = targetCalories * 0.25;
    let targetFatGrams = Math.round(fatCalories / 9); // 1 грамм жира = 9 ккал

    // Углеводы: оставшиеся калории
    const remainingCalories =
      targetCalories - targetProteinGrams * 4 - targetFatGrams * 9;
    let targetCarbGrams = Math.round(remainingCalories / 4); // 1 грамм углеводов = 4 ккал

    targetCarbGrams = Math.max(0, targetCarbGrams);

    return {
      targetCalories: Math.round(targetCalories),
      targetProteinGrams,
      targetFatGrams,
      targetCarbGrams,
    };
  }

  /**
   * Сохраняет данные профиля в Firestore, преобразуя локальные имена полей в имена БД,
   * и **добавляет рассчитанные КБЖУ**.
   * @param profileData Объект профиля, сохраненный локально.
   */
  async saveProfileToFirestore(profileData: LocalProfileData): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      console.error("User not authenticated for profile save.");
      throw new Error("Необходима авторизация для сохранения профиля.");
    }

    const userDocRef = doc(db, "users", user.uid);

    // ⭐️ 1. Расчет КБЖУ
    const macroTargets = this.calculateTargetMacros(profileData);
    console.log("Calculated Macro Targets:", macroTargets);

    // 2. Сборка объекта для Firestore, включая расчетные данные
    const firestoreData = {
      // Имя и email добавляем в документ Firestore для удобства отображения/поиска
      name: profileData.name,
      email: profileData.email,
      description: profileData.description,

      age: profileData.age,
      height: profileData.height,
      gender: profileData.gender,
      weight: profileData.weight,
      goal: profileData.goal,
      activity: profileData.activity,

      // ⭐️ ПЕРЕИМЕНОВАННЫЕ И ТЕХНИЧЕСКИЕ ПОЛЯ:
      // В Firestore сохраняем объединенный nutritionType (включая "Другое: ...")
      dietType: profileData.nutritionType,
      allergies: profileData.allergies,
      excludedIngredients: profileData.dislikes,
      cookingTimeLimit: profileData.cookingTimeLimit,
      isProfilePrivate: profileData.isPrivate,
      isProfileFilled: profileData.isProfileFilled,

      // ⭐️ РЕЗУЛЬТАТЫ РАСЧЕТА КБЖУ
      targetCalories: macroTargets.targetCalories,
      targetProteinGrams: macroTargets.targetProteinGrams,
      targetFatGrams: macroTargets.targetFatGrams,
      targetCarbGrams: macroTargets.targetCarbGrams,

      updatedAt: Timestamp.now(),
    };

    try {
      await updateDoc(userDocRef, firestoreData);
      console.log(
        "✅ Profile data and macros successfully updated in Firestore."
      );
    } catch (error) {
      console.error("❌ Error updating profile in Firestore:", error);
      Alert.alert(
        "Ошибка сохранения",
        "Не удалось сохранить профиль в облаке."
      );
      throw new Error("Не удалось сохранить профиль в базу данных.");
    }
  }
}

export const userService = new UserService();
