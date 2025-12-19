// services/userService.ts

import { 
  doc, 
  updateDoc, 
  Timestamp, 
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
  orderBy
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

// Тип для профиля пользователя
export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  description?: string;
  photoURL?: string | null;
  isProfilePrivate?: boolean;
  followersCount?: number;
  followingCount?: number;
  // Дополнительные поля
  age?: string;
  height?: string;
  weight?: string;
  gender?: string;
  goal?: string;
  activity?: string;
  dietType?: string;
  allergies?: string;
  excludedIngredients?: string;
  cookingTimeLimit?: string;
  isProfileFilled?: boolean;
  cloudinaryPublicId?: string;
  // Расчетные поля
  targetCalories?: number;
  targetProteinGrams?: number;
  targetFatGrams?: number;
  targetCarbGrams?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Тип для локального профиля (из AsyncStorage)
type LocalProfileData = {
  name: string;
  email: string;
  description: string;
  age: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  nutritionType: string;
  customNutritionType: string;
  allergies: string;
  dislikes: string;
  isPrivate: boolean;
  cookingTimeLimit: string;
  isProfileFilled: boolean;
  photoURL?: string;
  cloudinaryPublicId?: string;
};

// Тип для результатов расчета КБЖУ
type MacroTargets = {
  targetCalories: number;
  targetProteinGrams: number;
  targetFatGrams: number;
  targetCarbGrams: number;
};

class UserService {
  // ==================== МЕТОДЫ ДЛЯ РАБОТЫ С ПРОФИЛЯМИ ====================

  /**
   * Получить профиль пользователя по ID
   */
  async getUserById(userId: string): Promise<UserProfile | null> {
    try {
      console.log("Загрузка профиля пользователя с ID:", userId);
      
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (!userDoc.exists()) {
        console.log('Пользователь не найден в Firestore:', userId);
        return null;
      }

      const userData = userDoc.data();
      
      // Форматируем данные пользователя
      const userProfile: UserProfile = {
        id: userDoc.id,
        name: userData.name || 'Пользователь',
        email: userData.email || '',
        description: userData.description || '',
        photoURL: userData.photoURL || null,
        isProfilePrivate: userData.isProfilePrivate ?? true,
        followersCount: userData.followersCount || 0,
        followingCount: userData.followingCount || 0,
        age: userData.age || '',
        height: userData.height || '',
        weight: userData.weight || '',
        gender: userData.gender || 'Муж',
        goal: userData.goal || 'Поддержание веса',
        activity: userData.activity || 'Низкий (0-1 тренировка в неделю)',
        dietType: userData.dietType || 'Обычное',
        allergies: userData.allergies || '',
        excludedIngredients: userData.excludedIngredients || '',
        cookingTimeLimit: userData.cookingTimeLimit || '30 мин',
        isProfileFilled: userData.isProfileFilled ?? false,
        cloudinaryPublicId: userData.cloudinaryPublicId,
        targetCalories: userData.targetCalories || 0,
        targetProteinGrams: userData.targetProteinGrams || 0,
        targetFatGrams: userData.targetFatGrams || 0,
        targetCarbGrams: userData.targetCarbGrams || 0,
        createdAt: userData.createdAt,
        updatedAt: userData.updatedAt
      };

      console.log("✅ Профиль пользователя загружен:", userProfile.name);
      return userProfile;
    } catch (error) {
      console.error('❌ Ошибка загрузки профиля пользователя:', error);
      throw error;
    }
  }

  /**
   * Получить нескольких пользователей по ID
   */
  async getUsersByIds(userIds: string[]): Promise<UserProfile[]> {
    try {
      if (!userIds.length) return [];
      
      console.log("Загрузка пользователей с IDs:", userIds);
      
      const usersPromises = userIds.map(userId => this.getUserById(userId));
      const users = await Promise.all(usersPromises);
      
      return users.filter((user): user is UserProfile => user !== null);
    } catch (error) {
      console.error('❌ Ошибка загрузки пользователей:', error);
      return [];
    }
  }

  /**
   * Поиск пользователей по имени или email
   */
  async searchUsers(searchTerm: string, limitCount: number = 10): Promise<UserProfile[]> {
    try {
      if (!searchTerm.trim()) return [];
      
      console.log("Поиск пользователей по запросу:", searchTerm);
      
      const usersRef = collection(db, 'users');
      
      // Ищем по имени
      const nameQuery = query(
        usersRef,
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        orderBy('name'),
        limit(limitCount)
      );
      
      // Ищем по email
      const emailQuery = query(
        usersRef,
        where('email', '>=', searchTerm),
        where('email', '<=', searchTerm + '\uf8ff'),
        orderBy('email'),
        limit(limitCount)
      );
      
      const [nameSnapshot, emailSnapshot] = await Promise.all([
        getDocs(nameQuery),
        getDocs(emailQuery)
      ]);
      
      // Объединяем результаты и убираем дубликаты
      const usersMap = new Map<string, UserProfile>();
      
      [...nameSnapshot.docs, ...emailSnapshot.docs].forEach(doc => {
        const userData = doc.data();
        const userProfile: UserProfile = {
          id: doc.id,
          name: userData.name || 'Пользователь',
          email: userData.email || '',
          description: userData.description || '',
          photoURL: userData.photoURL || null,
          isProfilePrivate: userData.isProfilePrivate ?? true,
          followersCount: userData.followersCount || 0,
          followingCount: userData.followingCount || 0
        };
        usersMap.set(doc.id, userProfile);
      });
      
      const users = Array.from(usersMap.values());
      console.log("✅ Найдено пользователей:", users.length);
      return users;
    } catch (error) {
      console.error('❌ Ошибка поиска пользователей:', error);
      return [];
    }
  }

  /**
   * Получить публичных пользователей (рекомендации)
   */
  async getPublicUsers(limitCount: number = 10): Promise<UserProfile[]> {
    try {
      console.log("Загрузка публичных пользователей");
      
      const usersRef = collection(db, 'users');
      const publicUsersQuery = query(
        usersRef,
        where('isProfilePrivate', '==', false),
        orderBy('followersCount', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(publicUsersQuery);
      const users: UserProfile[] = [];
      
      snapshot.docs.forEach(doc => {
        const userData = doc.data();
        users.push({
          id: doc.id,
          name: userData.name || 'Пользователь',
          email: userData.email || '',
          description: userData.description || '',
          photoURL: userData.photoURL || null,
          isProfilePrivate: userData.isProfilePrivate ?? true,
          followersCount: userData.followersCount || 0,
          followingCount: userData.followingCount || 0
        });
      });
      
      console.log("✅ Загружено публичных пользователей:", users.length);
      return users;
    } catch (error) {
      console.error('❌ Ошибка загрузки публичных пользователей:', error);
      return [];
    }
  }

  /**
   * Обновить статус приватности профиля
   */
  async updateProfilePrivacy(isPrivate: boolean): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Пользователь не авторизован");
      
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        isProfilePrivate: isPrivate,
        updatedAt: Timestamp.now()
      });
      
      console.log("✅ Статус приватности обновлен:", isPrivate);
    } catch (error) {
      console.error("❌ Ошибка обновления приватности:", error);
      throw error;
    }
  }

  // ==================== СУЩЕСТВУЮЩИЕ МЕТОДЫ ====================

  /**
   * Загружает фото профиля в Cloudinary и обновляет ссылку в профиле
   */
  async uploadProfilePhoto(imageUri: string, userId: string): Promise<UploadResult> {
    try {
      console.log("Starting profile photo upload to Cloudinary for user:", userId);
      
      const result = await uploadUserAvatar(userId, imageUri);
      
      if (result.success && result.url && result.publicId) {
        console.log("✅ Cloudinary upload successful:", result.url);
        
        // Обновляем фото в Firebase Auth
        const user = auth.currentUser;
        if (user) {
          await updateProfile(user, { 
            photoURL: result.url 
          });
          console.log("✅ Firebase Auth photoURL updated");
        }
        
        // Обновляем фото в Firestore
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
          photoURL: result.url,
          cloudinaryPublicId: result.publicId,
          updatedAt: Timestamp.now()
        });
        
        console.log("✅ Firestore profile photo updated");
        
        return result;
      } else {
        throw new Error(result.error || "Не удалось загрузить фото");
      }
    } catch (error) {
      console.error("❌ Error uploading profile photo to Cloudinary:", error);
      Alert.alert("Ошибка", "Не удалось загрузить фото профиля");
      throw error;
    }
  }
  
  /**
   * Удаляет фото профиля из Cloudinary и обновляет профиль
   */
  async deleteProfilePhoto(userId: string, publicId?: string): Promise<void> {
    try {
      console.log("Deleting profile photo from Cloudinary for user:", userId);
      
      // Обновляем Firebase Auth
      const user = auth.currentUser;
      if (user) {
        await updateProfile(user, { photoURL: null });
        console.log("✅ Firebase Auth photoURL cleared");
      }
      
      // Обновляем Firestore
      const userDocRef = doc(db, "users", userId);
      await updateDoc(userDocRef, {
        photoURL: null,
        cloudinaryPublicId: null,
        updatedAt: Timestamp.now()
      });
      
      console.log("✅ Firestore profile photo cleared");
      
    } catch (error) {
      console.error("❌ Error deleting profile photo:", error);
      Alert.alert("Ошибка", "Не удалось удалить фото профиля");
      throw error;
    }
  }
  
  /**
   * Получает URL аватара с определенным размером из Cloudinary
   */
  getAvatarUrl(publicId: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    try {
      return avatarCloudinaryService.getUserAvatarUrl(publicId, size);
    } catch (error) {
      console.error("Error getting Cloudinary avatar URL:", error);
      return `https://res.cloudinary.com/${avatarCloudinaryService['cloudName']}/image/upload/${publicId}`;
    }
  }
  
  /**
   * Проверяет конфигурацию Cloudinary для аватаров
   */
  checkCloudinaryConfig(): { isValid: boolean; message: string } {
    const config = avatarCloudinaryService.checkConfig();
    return {
      isValid: config.isValid,
      message: config.message
    };
  }

  /**
   * Обновляет имя пользователя (displayName) в Firebase Authentication.
   */
  async updateAuthProfileName(newName: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      console.error("User not authenticated for updating display name.");
      throw new Error("Необходима авторизация для обновления имени.");
    }

    try {
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

  // --- МЕТОДЫ РАСЧЕТА ---

  /**
   * Преобразование уровня активности в коэффициент метаболизма
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

    // 1. Расчет базового метаболизма (BMR)
    let bmr: number;
    if (gender === "Муж") {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // 2. Расчет суточной нормы калорий (TDEE)
    const activityMultiplier = this.getActivityMultiplier(profileData.activity);
    let tdee = bmr * activityMultiplier;

    // 3. Корректировка TDEE с учетом цели
    let targetCalories: number;
    switch (goal) {
      case "Похудение":
        targetCalories = tdee - 500;
        break;
      case "Набор веса":
        targetCalories = tdee + 300;
        break;
      case "Поддержание веса":
      default:
        targetCalories = tdee;
        break;
    }

    const minCalories = gender === "Жен" ? 1200 : 1500;
    targetCalories = Math.max(minCalories, targetCalories);

    // 4. Расчет макронутриентов
    const proteinPerKg = activityMultiplier > 1.5 ? 2.0 : 1.5;
    let targetProteinGrams = Math.round(weight * proteinPerKg);

    const fatCalories = targetCalories * 0.25;
    let targetFatGrams = Math.round(fatCalories / 9);

    const remainingCalories =
      targetCalories - targetProteinGrams * 4 - targetFatGrams * 9;
    let targetCarbGrams = Math.round(remainingCalories / 4);

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
   */
  async saveProfileToFirestore(profileData: LocalProfileData): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      console.error("User not authenticated for profile save.");
      throw new Error("Необходима авторизация для сохранения профиля.");
    }

    const userDocRef = doc(db, "users", user.uid);

    // 1. Расчет КБЖУ
    const macroTargets = this.calculateTargetMacros(profileData);
    console.log("Calculated Macro Targets:", macroTargets);

    // 2. Сборка объекта для Firestore
    const firestoreData = {
      name: profileData.name,
      email: profileData.email,
      description: profileData.description,
      age: profileData.age,
      height: profileData.height,
      gender: profileData.gender,
      weight: profileData.weight,
      goal: profileData.goal,
      activity: profileData.activity,
      dietType: profileData.nutritionType,
      allergies: profileData.allergies,
      excludedIngredients: profileData.dislikes,
      cookingTimeLimit: profileData.cookingTimeLimit,
      isProfilePrivate: profileData.isPrivate,
      isProfileFilled: profileData.isProfileFilled,
      photoURL: profileData.photoURL || null,
      cloudinaryPublicId: profileData.cloudinaryPublicId || null,
      targetCalories: macroTargets.targetCalories,
      targetProteinGrams: macroTargets.targetProteinGrams,
      targetFatGrams: macroTargets.targetFatGrams,
      targetCarbGrams: macroTargets.targetCarbGrams,
      updatedAt: Timestamp.now(),
    };

    try {
      await updateDoc(userDocRef, firestoreData);
      console.log("✅ Profile data and macros successfully updated in Firestore.");
    } catch (error) {
      console.error("❌ Error updating profile in Firestore:", error);
      Alert.alert("Ошибка сохранения", "Не удалось сохранить профиль в облаке.");
      throw new Error("Не удалось сохранить профиль в базу данных.");
    }
  }
}

export const userService = new UserService();