// app/(tabs)/home.tsx
import {
  Feather,
  FontAwesome,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import {
  doc,
  Firestore,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  setLogLevel,
  updateDoc,
} from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ИМПОРТ СЕРВИСОВ
import { favoriteService } from "@/app/services/favoriteService";
import { rationPlanService } from "@/app/services/rationPlanService";
import { dailyRationService } from "@/app/services/rationService";
import { userService } from "@/app/services/userService";

setLogLevel("debug");

// --- ТИПИЗАЦИЯ И КОНСТАНТЫ ---

interface Meal {
  id: string;
  category: string;
  name: string;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  weight: string;
  marked: boolean;
  bookmarked: boolean;
  image: any;
  cookingTime: number;
  difficultyLevel: string;
  rating?: number;
  recipeId: string | null;
  isCustom?: boolean;
  canBeRemoved?: boolean;
  imageUrl?: string;
  addedAt?: string;
  originalPlanId?: string;
}

interface UserDataState {
  userName: string;
  dailyCalories: number;
  consumedCalories: number;
  photoURL: string | null;
  targetProteins: number;
  targetFats: number;
  targetCarbs: number;
}

interface KBRUState {
  proteins: number;
  fats: number;
  carbohydrates: number;
}

interface UserProfileData {
  firstName?: string;
  lastName?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  dailyCalories?: number;
  targetCalories?: number;
  targetProteinGrams?: number;
  targetFatGrams?: number;
  targetCarbGrams?: number;
  photoURL?: string;
  lastDailyPlanSave?: string;
}

const TARGET_KBRU_RATIOS = {
  protein: 0.3,
  fat: 0.3,
  carb: 0.4,
};

const DEFAULT_MEAL_IMAGE = require("@/assets/images/logo.png");

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 56) / 2;

// --- ФУНКЦИЯ ДЛЯ ГЕНЕРАЦИИ УНИКАЛЬНОГО ID ---
const generateUniqueId = (): string => {
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// --- КОМПОНЕНТ АВАТАРА ---
interface AvatarProps {
  photoURL?: string | null;
  size?: number;
}

const Avatar: React.FC<AvatarProps> = ({ photoURL, size = 55 }) => {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: "#9BDF11",
        }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#E5F0F5",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#9BDF11",
      }}
    >
      <Feather name="user" size={size * 0.4} color="#6A9AA9" />
    </View>
  );
};

// Функция для преобразования времени в число
const parseCookingTime = (time: any): number => {
  if (typeof time === "number") {
    return time;
  }
  if (typeof time === "string") {
    const timeMatch = time.match(/\d+/);
    return timeMatch ? parseInt(timeMatch[0], 10) : 20;
  }
  return 20;
};

// Функция для склонения минут
const formatMinutes = (minutes: number | string | undefined): string => {
  let numMinutes: number;

  if (typeof minutes === "string") {
    numMinutes = parseCookingTime(minutes);
  } else if (typeof minutes === "number") {
    numMinutes = minutes;
  } else {
    numMinutes = 20;
  }

  const absMinutes = Math.abs(numMinutes);
  const lastDigit = absMinutes % 10;
  const lastTwoDigits = absMinutes % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${absMinutes} минут`;
  if (lastDigit === 1) return `${absMinutes} минута`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${absMinutes} минуты`;
  return `${absMinutes} минут`;
};

// Функция для цвета сложности
const getDifficultyColor = (difficulty: string | undefined) => {
  if (!difficulty) return "#6A9AA9";

  switch (difficulty.trim()) {
    case "Легко":
      return "#4CAF50";
    case "Средне":
      return "#FF9800";
    case "Сложно":
      return "#F44336";
    default:
      return "#6A9AA9";
  }
};

// Функция для получения иконки по категории
const getCategoryIcon = (category: string | undefined) => {
  const normalizedCategory = String(category || "")
    .trim()
    .toLowerCase();

  switch (normalizedCategory) {
    case "завтрак":
    case "breakfast":
      return "sunny-outline";
    case "обед":
    case "lunch":
      return "restaurant-outline";
    case "ужин":
    case "dinner":
      return "moon-outline";
    case "перекусы":
    case "snack":
      return "cafe-outline";
    default:
      return "fast-food-outline";
  }
};

// Функция форматирования даты
const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "сегодня";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "вчера";
    } else {
      return date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      });
    }
  } catch (error) {
    return dateString;
  }
};

// --- КОМПОНЕНТ ДИФФИКУЛЬТИ БЭДЖА ---
interface DifficultyBadgeProps {
  difficulty: string | undefined;
}

const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({ difficulty }) => {
  const difficultyText = difficulty || "Легко";
  const color = getDifficultyColor(difficultyText);

  return (
    <View style={[styles.difficultyBadge, { backgroundColor: color }]}>
      <Text style={styles.difficultyText}>{difficultyText}</Text>
    </View>
  );
};

// --- Вспомогательные функции ---

// Функция для получения хэша массива блюд (без bookmarked)
const getMealsHash = (mealsArray: Meal[]): string => {
  return mealsArray
    .map((m) => `${m.id}:${m.name}:${m.marked}:${m.isCustom}`)
    .join("|");
};

// Функция для сравнения массивов блюд (игнорируя bookmarked)
const arraysEqual = (a: Meal[], b: Meal[]): boolean => {
  if (a.length !== b.length) return false;

  return a.every((meal, index) => {
    const bMeal = b[index];
    if (!bMeal) return false;

    // Сравниваем ВСЕ поля КРОМЕ bookmarked
    return (
      meal.id === bMeal.id &&
      meal.marked === bMeal.marked &&
      meal.isCustom === bMeal.isCustom &&
      meal.name === bMeal.name &&
      meal.category === bMeal.category &&
      meal.calories === bMeal.calories &&
      meal.proteins === bMeal.proteins &&
      meal.fats === bMeal.fats &&
      meal.carbohydrates === bMeal.carbohydrates &&
      meal.recipeId === bMeal.recipeId
    );
  });
};

// Функция для загрузки статуса избранного для всех рецептов
const loadFavoritesStatus = async (
  userId: string,
  mealsList: Meal[],
): Promise<Meal[]> => {
  if (!userId || mealsList.length === 0) return mealsList;

  try {
    // ИСПРАВЛЕНО: убираем второй аргумент
    const favorites = await favoriteService.getUserFavorites(userId);
    // ИСПРАВЛЕНО: используем item?.id вместо itemId
    const favoriteIds = new Set(
      favorites.map((fav) => fav.item?.id).filter((id) => id),
    );

    // Обновляем статус bookmarked для каждого блюда
    return mealsList.map((meal) => ({
      ...meal,
      bookmarked: meal.recipeId ? favoriteIds.has(meal.recipeId) : false,
    }));
  } catch (error) {
    console.error("Ошибка загрузки статуса избранного:", error);
    return mealsList;
  }
};

// --- КОМПОНЕНТ HOME ---

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [db, setDb] = useState<Firestore | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [originalMeals, setOriginalMeals] = useState<Meal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState<string | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);

  // Новые состояния для контроля сохранения
  const [hasSavedToday, setHasSavedToday] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveDate, setLastSaveDate] = useState<string | null>(null);
  const [lastPlanDate, setLastPlanDate] = useState<string | null>(null);
  const [todayPlanId, setTodayPlanId] = useState<string | null>(null);
  const [userProfileLoading, setUserProfileLoading] = useState(false);
  const [userSettingsChanged, setUserSettingsChanged] = useState(false);

  // Флаги для контроля загрузки
  const [isPlanLoading, setIsPlanLoading] = useState(true);

  // Рефы для контроля состояния
  const shouldUpdateFromListenerRef = useRef(true);
  const lastMealsUpdateRef = useRef<string>("");
  const hasInitialLoadRef = useRef(false);

  const [userData, setUserData] = useState<UserDataState>({
    userName: "Пользователь",
    dailyCalories: 2000,
    consumedCalories: 0,
    photoURL: null,
    targetProteins: 0,
    targetFats: 0,
    targetCarbs: 0,
  });

  const [recommendedKBRU, setRecommendedKBRU] = useState<KBRUState>({
    proteins: 0,
    fats: 0,
    carbohydrates: 0,
  });

  const [targetKBRU, setTargetKBRU] = useState<KBRUState>({
    proteins: 0,
    fats: 0,
    carbohydrates: 0,
  });

  const loading = !isAuthReady || !db || !userId;

  // Функция для получения сегодняшней даты в формате YYYY-MM-DD
  const getTodayDate = useCallback(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Функция для проверки, новый ли день
  const checkIfNewDay = useCallback(() => {
    const today = getTodayDate();
    return !lastPlanDate || lastPlanDate !== today;
  }, [lastPlanDate, getTodayDate]);

  // Функция проверки, сохранял ли пользователь уже сегодня
  const checkTodaySave = useCallback(
    async (userId: string) => {
      if (!db) return;

      try {
        const today = getTodayDate();
        const userDoc = await getDoc(doc(db, `users/${userId}`));

        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfileData;
          const lastSave = data.lastDailyPlanSave;

          if (lastSave === today) {
            setHasSavedToday(true);
          } else {
            setHasSavedToday(false);
            setHasUnsavedChanges(false);
          }
          setLastSaveDate(lastSave || null);
        }
      } catch (error) {
        console.error("Ошибка проверки сохранения:", error);
      }
    },
    [db, getTodayDate],
  );

  // Упрощенная функция добавления рецепта
  const addRecipeToPlan = useCallback(
    async (recipeData: any) => {
      console.log("➕ Adding recipe to plan:", recipeData.title);

      if (!currentUser || !db) {
        Alert.alert("Ошибка", "Пользователь не авторизован");
        return;
      }

      try {
        const today = getTodayDate();
        const finalCategory =
          recipeData.category || recipeData.mealType || "Обед";
        const planId = `${currentUser.uid}_${today}`;

        if (!todayPlanId) {
          setTodayPlanId(planId);
        }

        // Проверяем существование рецепта
        const existingMeal = meals.find(
          (meal) =>
            (meal.recipeId && meal.recipeId === recipeData.id) ||
            (meal.name === recipeData.title &&
              meal.category === finalCategory &&
              meal.isCustom),
        );

        if (existingMeal) {
          Alert.alert("Внимание", "Этот рецепт уже добавлен в ваш рацион");
          return;
        }

        // ИСПРАВЛЕНО: проверяем статус избранного для нового рецепта
        let isBookmarked = false;
        if (recipeData.id && currentUser) {
          const favorites = await favoriteService.getUserFavorites(
            currentUser.uid,
          );
          isBookmarked = favorites.some(
            (fav) => fav.item?.id === recipeData.id,
          );
        }

        // Создаем новое блюдо
        const mealId = generateUniqueId();
        const newMeal: Meal = {
          id: mealId,
          category: finalCategory,
          name: recipeData.title || recipeData.name || "Новый рецепт",
          calories: recipeData.calories || 300,
          proteins: recipeData.proteins || 20,
          fats: recipeData.fats || 10,
          carbohydrates: recipeData.carbohydrates || recipeData.carbs || 30,
          weight: recipeData.weight || "250г",
          marked: false,
          bookmarked: isBookmarked,
          cookingTime: parseCookingTime(recipeData.cookingTime),
          difficultyLevel:
            recipeData.difficultyLevel || recipeData.difficulty || "Легко",
          rating: recipeData.rating || 0,
          recipeId: recipeData.id || recipeData.recipeId || null,
          image: recipeData.imageUrl
            ? { uri: recipeData.imageUrl }
            : DEFAULT_MEAL_IMAGE,
          imageUrl: recipeData.imageUrl || null,
          isCustom: true,
          canBeRemoved: true,
          addedAt: new Date().toISOString(),
        };

        // 1. Сначала обновляем локальное состояние
        const updatedMeals = [...meals, newMeal];
        setMeals(updatedMeals);
        setOriginalMeals(JSON.parse(JSON.stringify(updatedMeals)));

        // Обновляем статистику
        setRecommendedKBRU((prevKBRU) => ({
          proteins: prevKBRU.proteins + newMeal.proteins,
          fats: prevKBRU.fats + newMeal.fats,
          carbohydrates: prevKBRU.carbohydrates + newMeal.carbohydrates,
        }));

        // 2. Временно отключаем обновления из слушателя
        shouldUpdateFromListenerRef.current = false;
        lastMealsUpdateRef.current = getMealsHash(updatedMeals);

        // 3. Затем обновляем в базе данных
        const planRef = doc(db, "ration_plan_days", planId);
        const planSnap = await getDoc(planRef);

        const mealDataForDb = {
          id: newMeal.id,
          recipeId: newMeal.recipeId,
          category: newMeal.category,
          name: newMeal.name,
          calories: newMeal.calories,
          proteins: newMeal.proteins,
          fats: newMeal.fats,
          carbohydrates: newMeal.carbohydrates,
          weight: newMeal.weight,
          cookingTime: newMeal.cookingTime,
          difficultyLevel: newMeal.difficultyLevel,
          rating: newMeal.rating,
          imageUrl: newMeal.imageUrl,
          marked: newMeal.marked,
          bookmarked: newMeal.bookmarked,
          isCustom: true,
          canBeRemoved: true,
          addedAt: newMeal.addedAt,
        };

        if (planSnap.exists()) {
          const currentData = planSnap.data();
          const currentCustomMeals = currentData.customMeals || [];

          await updateDoc(planRef, {
            customMeals: [...currentCustomMeals, mealDataForDb],
            "timestamps.updatedAt": new Date().toISOString(),
          });
        } else {
          const userProfile = await userService.fetchUserProfile(
            currentUser.uid,
          );

          await setDoc(planRef, {
            id: planId,
            userId: currentUser.uid,
            date: today,
            dayOfWeek: new Date().toLocaleDateString("ru-RU", {
              weekday: "long",
            }),
            userTargets: {
              dailyCalories: userData.dailyCalories,
              dietType: userProfile?.dietType || "Обычное",
            },
            meals: [],
            customMeals: [mealDataForDb],
            stats: {
              totalCalories: newMeal.calories,
              totalProteins: newMeal.proteins,
              totalFats: newMeal.fats,
              totalCarbs: newMeal.carbohydrates,
              totalCookingTime: newMeal.cookingTime,
              completedMeals: 0,
              totalMeals: 1,
            },
            timestamps: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          });
        }

        setHasUnsavedChanges(true);
        Alert.alert("Успех", "Рецепт добавлен в рацион!");
      } catch (error) {
        console.error("❌ Error adding recipe:", error);
        Alert.alert("Ошибка", "Не удалось добавить рецепт");
        setMeals(meals);
        setOriginalMeals(JSON.parse(JSON.stringify(meals)));
      } finally {
        setTimeout(() => {
          shouldUpdateFromListenerRef.current = true;
        }, 2000);
      }
    },
    [currentUser, db, meals, todayPlanId, userData.dailyCalories, getTodayDate],
  );

  // Функция для замены рецепта
  const handleReplaceRecipe = useCallback(
    async (replaceData: any) => {
      if (!currentUser || !db) return;

      try {
        const today = getTodayDate();
        const planId = `${currentUser.uid}_${today}`;

        const mealIndex = parseInt(replaceData.mealIndex || "0");
        const currentMealId = replaceData.currentMealId;

        const mealToReplace = meals.find((meal) => meal.id === currentMealId);
        if (!mealToReplace) {
          Alert.alert("Ошибка", "Рецепт для замены не найден");
          return;
        }

        // ИСПРАВЛЕНО: проверяем статус избранного для нового рецепта
        let isBookmarked = false;
        if (replaceData.recipeId && currentUser) {
          const favorites = await favoriteService.getUserFavorites(
            currentUser.uid,
          );
          isBookmarked = favorites.some(
            (fav) => fav.item?.id === replaceData.recipeId,
          );
        }

        // Создаем новый рецепт
        const newMealId = generateUniqueId();
        const newMeal: Meal = {
          id: newMealId,
          category: replaceData.category || mealToReplace.category,
          name: replaceData.title || "Новый рецепт",
          calories: replaceData.calories || 300,
          proteins: replaceData.proteins || 0,
          fats: replaceData.fats || 0,
          carbohydrates: replaceData.carbohydrates || 0,
          weight: replaceData.weight || "250г",
          marked: false,
          bookmarked: isBookmarked,
          cookingTime: parseCookingTime(replaceData.cookingTime),
          difficultyLevel: replaceData.difficultyLevel || "Легко",
          rating: replaceData.rating || 0,
          recipeId: replaceData.recipeId || null,
          image: replaceData.imageUrl
            ? { uri: replaceData.imageUrl }
            : DEFAULT_MEAL_IMAGE,
          imageUrl: replaceData.imageUrl || null,
          isCustom: true,
          canBeRemoved: true,
          addedAt: new Date().toISOString(),
        };

        // 1. Обновляем локальное состояние
        const updatedMeals = [...meals];
        if (mealIndex >= 0 && mealIndex < updatedMeals.length) {
          updatedMeals[mealIndex] = newMeal;
        } else {
          const replaceIndex = updatedMeals.findIndex(
            (m) => m.id === currentMealId,
          );
          if (replaceIndex !== -1) {
            updatedMeals[replaceIndex] = newMeal;
          } else {
            updatedMeals.push(newMeal);
          }
        }

        setMeals(updatedMeals);
        setOriginalMeals(JSON.parse(JSON.stringify(updatedMeals)));

        const consumed = updatedMeals
          .filter((meal) => meal.marked)
          .reduce((sum, meal) => sum + meal.calories, 0);

        const totalKBRU = updatedMeals.reduce(
          (acc, meal) => ({
            proteins: acc.proteins + meal.proteins,
            fats: acc.fats + meal.fats,
            carbohydrates: acc.carbohydrates + meal.carbohydrates,
          }),
          { proteins: 0, fats: 0, carbohydrates: 0 },
        );

        setRecommendedKBRU(totalKBRU);
        setUserData((prev) => ({ ...prev, consumedCalories: consumed }));

        shouldUpdateFromListenerRef.current = false;
        lastMealsUpdateRef.current = getMealsHash(updatedMeals);

        const planRef = doc(db, "ration_plan_days", planId);
        const planSnap = await getDoc(planRef);

        if (planSnap.exists()) {
          const planData = planSnap.data();
          const currentCustomMeals = planData.customMeals || [];

          const updatedCustomMeals = currentCustomMeals.filter(
            (meal: any) => meal.id !== currentMealId,
          );

          const mealDataForDb = {
            id: newMeal.id,
            recipeId: newMeal.recipeId,
            category: newMeal.category,
            name: newMeal.name,
            calories: newMeal.calories,
            proteins: newMeal.proteins,
            fats: newMeal.fats,
            carbohydrates: newMeal.carbohydrates,
            weight: newMeal.weight,
            cookingTime: newMeal.cookingTime,
            difficultyLevel: newMeal.difficultyLevel,
            rating: newMeal.rating,
            imageUrl: newMeal.imageUrl,
            marked: newMeal.marked,
            bookmarked: newMeal.bookmarked,
            isCustom: true,
            canBeRemoved: true,
            addedAt: newMeal.addedAt,
          };

          await updateDoc(planRef, {
            customMeals: [...updatedCustomMeals, mealDataForDb],
            "timestamps.updatedAt": new Date().toISOString(),
          });
        }

        setHasUnsavedChanges(true);
        Alert.alert("Успех", "Рецепт успешно заменен!");
      } catch (error) {
        console.error("❌ Error replacing recipe:", error);
        Alert.alert("Ошибка", "Не удалось заменить рецепт");
      } finally {
        setTimeout(() => {
          shouldUpdateFromListenerRef.current = true;
        }, 2000);
      }
    },
    [currentUser, db, meals, getTodayDate],
  );

  // 1. Инициализация Firebase
  useEffect(() => {
    try {
      const firebaseConfig =
        typeof __firebase_config !== "undefined"
          ? JSON.parse(__firebase_config as string)
          : {};
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);

      setDb(dbInstance);
      console.log("✅ Firebase initialized, DB set");

      const unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
        console.log(
          "🔄 Auth state changed:",
          user ? "User logged in" : "No user",
        );
        if (user) {
          setUserId(user.uid);
          setCurrentUser(user);

          console.log("✅ User authenticated. UID:", user.uid);

          const photoURL = await loadUserProfilePhoto(user.uid);
          setUserData((prev) => ({
            ...prev,
            photoURL: photoURL,
          }));

          await checkTodaySave(user.uid);
        } else {
          setUserId(null);
          setCurrentUser(null);
          setUserData((prev) => ({
            ...prev,
            userName: "Пользователь",
            dailyCalories: 2000,
            photoURL: null,
          }));
          setHasSavedToday(false);
          setHasUnsavedChanges(false);
          setLastSaveDate(null);
          console.log("⚠️ User is NOT authenticated.");
        }
        setIsAuthReady(true);
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error("❌ INIT: Ошибка инициализации Firebase:", error);
      setIsAuthReady(true);
    }
  }, []);

  // Функция для загрузки фото профиля
  const loadUserProfilePhoto = useCallback(async (userId: string) => {
    if (!userId) return null;

    try {
      setUserProfileLoading(true);
      const profileData = await userService.fetchUserProfile(userId);
      if (profileData?.photoURL) {
        return profileData.photoURL;
      }

      const auth = getAuth();
      return auth.currentUser?.photoURL || null;
    } catch (error) {
      console.error("Ошибка загрузки фото профиля:", error);
      return null;
    } finally {
      setUserProfileLoading(false);
    }
  }, []);

  // Функция для загрузки плана
  const loadDailyPlan = useCallback(async () => {
    if (!currentUser || !db) {
      console.log("⚠️ No user or DB, skipping plan load");
      return;
    }

    console.log("🔄 Loading daily plan...");
    setIsPlanLoading(true);
    setIsGeneratingPlan(true);

    try {
      const today = getTodayDate();
      const planId = `${currentUser.uid}_${today}`;
      setTodayPlanId(planId);

      const planRef = doc(db, "ration_plan_days", planId);
      const planSnap = await getDoc(planRef);

      if (planSnap.exists()) {
        console.log("📋 Existing plan found");
        const data = planSnap.data();

        if (data.date) {
          setLastPlanDate(data.date);
        }

        const mealsData = data.meals || [];
        const customMeals = data.customMeals || [];
        const allMeals = [...mealsData, ...customMeals];

        let formattedMeals: Meal[] = allMeals.map(
          (meal: any, index: number) => {
            const carbsValue = meal.carbohydrates || meal.carbs || 0;
            const isCustom = meal.isCustom || false;

            return {
              id: meal.id || `meal-${index}`,
              category: meal.category || "Обед",
              name: meal.name || "Рецепт",
              calories: meal.calories || 350,
              proteins: meal.proteins || 20,
              fats: meal.fats || 10,
              carbohydrates: carbsValue,
              weight: meal.weight || "250г",
              marked: meal.marked || false,
              bookmarked: false,
              cookingTime: parseCookingTime(meal.cookingTime),
              difficultyLevel: meal.difficultyLevel || "Легко",
              rating: meal.rating || 0,
              recipeId: meal.recipeId || null,
              image: meal.imageUrl
                ? { uri: meal.imageUrl }
                : DEFAULT_MEAL_IMAGE,
              imageUrl: meal.imageUrl || null,
              isCustom: isCustom,
              canBeRemoved: meal.canBeRemoved || isCustom,
              addedAt: meal.addedAt || new Date().toISOString(),
              originalPlanId: !isCustom
                ? meal.id || `meal-${index}`
                : undefined,
            };
          },
        );

        // ИСПРАВЛЕНО: загружаем статусы избранного для всех рецептов
        formattedMeals = await loadFavoritesStatus(
          currentUser.uid,
          formattedMeals,
        );

        setMeals(formattedMeals);
        setOriginalMeals(JSON.parse(JSON.stringify(formattedMeals)));

        lastMealsUpdateRef.current = getMealsHash(formattedMeals);

        const consumed = formattedMeals
          .filter((meal) => meal.marked)
          .reduce((sum, meal) => sum + meal.calories, 0);

        const totalKBRU = formattedMeals.reduce(
          (acc, meal) => ({
            proteins: acc.proteins + meal.proteins,
            fats: acc.fats + meal.fats,
            carbohydrates: acc.carbohydrates + meal.carbohydrates,
          }),
          { proteins: 0, fats: 0, carbohydrates: 0 },
        );

        setRecommendedKBRU(totalKBRU);
        setUserData((prev) => ({ ...prev, consumedCalories: consumed }));

        if (data.date === today) {
          setHasSavedToday(true);
        } else {
          setHasSavedToday(false);
          setHasUnsavedChanges(false);
        }

        console.log("✅ Plan loaded successfully");
      } else {
        const isNewDay = checkIfNewDay();

        if (isNewDay && !hasSavedToday) {
          console.log("🆕 Creating new plan for new day");

          const newPlan =
            await dailyRationService.createNewPlanWithUserSettings(
              currentUser.uid,
            );

          if (newPlan) {
            const allPlanMeals = [
              ...(newPlan.meals || []),
              ...(newPlan.customMeals || []),
            ];

            let formattedMeals: Meal[] = allPlanMeals.map(
              (meal: any, index: number) => {
                const carbsValue = meal.carbohydrates || meal.carbs || 0;
                const isCustom = meal.isCustom || false;

                return {
                  id: meal.id || `meal-${index}`,
                  category: meal.category || "Обед",
                  name: meal.name || "Рецепт",
                  calories: meal.calories || 350,
                  proteins: meal.proteins || 20,
                  fats: meal.fats || 10,
                  carbohydrates: carbsValue,
                  weight: meal.weight || "250г",
                  marked: meal.marked || false,
                  bookmarked: false,
                  cookingTime: parseCookingTime(meal.cookingTime),
                  difficultyLevel: meal.difficultyLevel || "Легко",
                  rating: meal.rating || 0,
                  recipeId: meal.recipeId || null,
                  image: meal.imageUrl
                    ? { uri: meal.imageUrl }
                    : DEFAULT_MEAL_IMAGE,
                  imageUrl: meal.imageUrl || null,
                  isCustom: isCustom,
                  canBeRemoved: meal.canBeRemoved || isCustom,
                  addedAt: meal.addedAt || new Date().toISOString(),
                  originalPlanId: !isCustom
                    ? meal.id || `meal-${index}`
                    : undefined,
                };
              },
            );

            // ИСПРАВЛЕНО: загружаем статусы избранного
            formattedMeals = await loadFavoritesStatus(
              currentUser.uid,
              formattedMeals,
            );

            setMeals(formattedMeals);
            setOriginalMeals(JSON.parse(JSON.stringify(formattedMeals)));
            setLastPlanDate(today);

            lastMealsUpdateRef.current = getMealsHash(formattedMeals);

            const consumed = formattedMeals
              .filter((meal) => meal.marked)
              .reduce((sum, meal) => sum + meal.calories, 0);

            const totalKBRU = formattedMeals.reduce(
              (acc, meal) => ({
                proteins: acc.proteins + meal.proteins,
                fats: acc.fats + meal.fats,
                carbohydrates: acc.carbohydrates + meal.carbohydrates,
              }),
              { proteins: 0, fats: 0, carbohydrates: 0 },
            );

            setRecommendedKBRU(totalKBRU);
            setUserData((prev) => ({ ...prev, consumedCalories: consumed }));

            setHasSavedToday(false);
            setHasUnsavedChanges(false);
          }
        } else {
          console.log("📭 No plan exists, showing empty");
          setMeals([]);
          setOriginalMeals([]);
          setRecommendedKBRU({ proteins: 0, fats: 0, carbohydrates: 0 });
          setUserData((prev) => ({ ...prev, consumedCalories: 0 }));
          lastMealsUpdateRef.current = "";
          setHasSavedToday(false);
          setHasUnsavedChanges(false);
        }
      }
    } catch (error) {
      console.error("❌ Error loading plan:", error);
      Alert.alert("Ошибка", "Не удалось загрузить рацион");
    } finally {
      setIsPlanLoading(false);
      setIsGeneratingPlan(false);
    }
  }, [currentUser, db, checkIfNewDay, hasSavedToday, getTodayDate]);

  // Инициализация загрузки плана
  useEffect(() => {
    if (isAuthReady && currentUser && db && !hasInitialLoadRef.current) {
      console.log("🚀 Initial plan load");
      hasInitialLoadRef.current = true;
      loadDailyPlan();
    }
  }, [isAuthReady, currentUser, db, loadDailyPlan]);

  // Проверка параметров для добавления рецепта
  useEffect(() => {
    if (params.selectedRecipe && currentUser && db) {
      try {
        const recipeData = JSON.parse(params.selectedRecipe as string);
        console.log("📥 Received recipe to add:", recipeData.title);

        addRecipeToPlan(recipeData);

        setTimeout(() => {
          router.setParams({ selectedRecipe: undefined });
        }, 100);
      } catch (error) {
        console.error("Ошибка парсинга выбранного рецепта:", error);
      }
    }
  }, [params.selectedRecipe, currentUser, db, router, addRecipeToPlan]);

  // Обработка замены рецепта
  useEffect(() => {
    if (params.replaceRecipe && currentUser && db) {
      try {
        const replaceData = JSON.parse(params.replaceRecipe as string);
        console.log("🔄 Received recipe to replace:", replaceData.title);

        handleReplaceRecipe(replaceData);

        setTimeout(() => {
          router.setParams({ replaceRecipe: undefined });
        }, 100);
      } catch (error) {
        console.error("Ошибка парсинга данных замены рецепта:", error);
      }
    }
  }, [params.replaceRecipe, currentUser, db, router, handleReplaceRecipe]);

  // 2. Слушатель изменений плана в реальном времени
  useEffect(() => {
    if (!currentUser || !db || !todayPlanId) {
      return;
    }

    console.log("👂 Setting up real-time plan listener for:", todayPlanId);
    const planRef = doc(db, "ration_plan_days", todayPlanId);

    const unsubscribePlan = onSnapshot(
      planRef,
      async (docSnap) => {
        if (!docSnap.exists()) {
          console.log("📭 No plan document found");
          return;
        }

        if (!shouldUpdateFromListenerRef.current) {
          console.log(
            "⏸️ Skipping listener update - manual update in progress",
          );
          return;
        }

        console.log("📡 Real-time plan update received");
        const data = docSnap.data();
        const mealsData = data.meals || [];
        const customMeals = data.customMeals || [];
        const allMeals = [...mealsData, ...customMeals];

        let formattedMeals: Meal[] = allMeals.map(
          (meal: any, index: number) => {
            const carbsValue = meal.carbohydrates || meal.carbs || 0;
            const isCustom = meal.isCustom || false;

            return {
              id: meal.id || `meal-${index}`,
              category: meal.category || "Обед",
              name: meal.name || "Рецепт",
              calories: meal.calories || 350,
              proteins: meal.proteins || 20,
              fats: meal.fats || 10,
              carbohydrates: carbsValue,
              weight: meal.weight || "250г",
              marked: meal.marked || false,
              bookmarked: false,
              cookingTime: parseCookingTime(meal.cookingTime),
              difficultyLevel: meal.difficultyLevel || "Легко",
              rating: meal.rating || 0,
              recipeId: meal.recipeId || null,
              image: meal.imageUrl
                ? { uri: meal.imageUrl }
                : DEFAULT_MEAL_IMAGE,
              imageUrl: meal.imageUrl || null,
              isCustom: isCustom,
              canBeRemoved: meal.canBeRemoved || isCustom,
              addedAt: meal.addedAt || new Date().toISOString(),
              originalPlanId: !isCustom
                ? meal.id || `meal-${index}`
                : undefined,
            };
          },
        );

        // ИСПРАВЛЕНО: загружаем актуальные статусы избранного
        formattedMeals = await loadFavoritesStatus(
          currentUser.uid,
          formattedMeals,
        );

        const currentHash = getMealsHash(formattedMeals);

        if (currentHash !== lastMealsUpdateRef.current) {
          console.log("🔄 Updating meals from real-time listener");
          lastMealsUpdateRef.current = currentHash;

          setMeals(formattedMeals);
          setOriginalMeals(JSON.parse(JSON.stringify(formattedMeals)));

          const consumed = formattedMeals
            .filter((meal) => meal.marked)
            .reduce((sum, meal) => sum + meal.calories, 0);

          const totalKBRU = formattedMeals.reduce(
            (acc, meal) => ({
              proteins: acc.proteins + meal.proteins,
              fats: acc.fats + meal.fats,
              carbohydrates: acc.carbohydrates + meal.carbohydrates,
            }),
            { proteins: 0, fats: 0, carbohydrates: 0 },
          );

          setRecommendedKBRU(totalKBRU);
          setUserData((prev) => ({ ...prev, consumedCalories: consumed }));
        } else {
          console.log("✅ No changes detected, skipping update");
        }
      },
      (error) => {
        console.error("❌ Error in plan listener:", error);
      },
    );

    return () => unsubscribePlan();
  }, [currentUser, db, todayPlanId]);

  // 3. Загрузка данных пользователя
  useEffect(() => {
    if (!db || !currentUser) return;

    const userDocRef = doc(db, `users/${currentUser.uid}`);

    const unsubscribeProfile = onSnapshot(
      userDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfileData;

          const firstName =
            data.first_name || data.firstName || data.name || "";
          const lastName = data.last_name || data.lastName || "";

          let currentName = "Пользователь";
          if (firstName || lastName) {
            currentName = `${firstName} ${lastName}`.trim();
          }

          const currentCalories = Math.round(
            data.dailyCalories || data.targetCalories || 2000,
          );

          const photoURL = data.photoURL || null;

          const lastSave = data.lastDailyPlanSave;
          const today = getTodayDate();

          if (lastSave === today) {
            setHasSavedToday(true);
          } else {
            setHasSavedToday(false);
            setHasUnsavedChanges(false);
          }
          setLastSaveDate(lastSave || null);

          const oldCalories = userData.dailyCalories;
          const oldTargetProteins = userData.targetProteins;
          const oldTargetFats = userData.targetFats;
          const oldTargetCarbs = userData.targetCarbs;

          const newTargetProteins = data.targetProteinGrams || 0;
          const newTargetFats = data.targetFatGrams || 0;
          const newTargetCarbs = data.targetCarbGrams || 0;

          setUserData((prevState) => ({
            ...prevState,
            userName: currentName,
            dailyCalories: currentCalories,
            targetProteins: newTargetProteins,
            targetFats: newTargetFats,
            targetCarbs: newTargetCarbs,
            photoURL: photoURL,
          }));

          const caloriesChanged = Math.abs(currentCalories - oldCalories) > 100;
          const proteinsChanged =
            Math.abs(newTargetProteins - oldTargetProteins) > 10;
          const fatsChanged = Math.abs(newTargetFats - oldTargetFats) > 10;
          const carbsChanged = Math.abs(newTargetCarbs - oldTargetCarbs) > 10;

          if (
            caloriesChanged ||
            proteinsChanged ||
            fatsChanged ||
            carbsChanged
          ) {
            console.log("🔄 User settings changed significantly", {
              caloriesChanged,
              proteinsChanged,
              fatsChanged,
              carbsChanged,
            });
            setUserSettingsChanged(true);
            loadDailyPlan();
          }
        }
      },
      (error) => {
        console.error("❌ PROFILE: Error listening to user profile:", error);
      },
    );

    return () => unsubscribeProfile();
  }, [db, currentUser, getTodayDate, loadDailyPlan]);

  // 4. Расчет целевого КБЖУ
  useEffect(() => {
    const dailyCalories = userData.dailyCalories;

    const targetProteins = Math.round(
      (dailyCalories * TARGET_KBRU_RATIOS.protein) / 4,
    );
    const targetFats = Math.round((dailyCalories * TARGET_KBRU_RATIOS.fat) / 9);
    const targetCarbs = Math.round(
      (dailyCalories * TARGET_KBRU_RATIOS.carb) / 4,
    );

    setTargetKBRU({
      proteins: targetProteins,
      fats: targetFats,
      carbohydrates: targetCarbs,
    });
  }, [userData.dailyCalories]);

  // Функция для удаления кастомного рецепта
  const removeMeal = useCallback(
    async (mealId: string) => {
      const mealToRemove = meals.find((meal) => meal.id === mealId);
      if (!mealToRemove || !currentUser || !db) return;

      if (mealToRemove.canBeRemoved) {
        Alert.alert(
          "Удалить рецепт",
          `Удалить "${mealToRemove.name}" из рациона?`,
          [
            { text: "Отмена", style: "cancel" },
            {
              text: "Удалить",
              style: "destructive",
              onPress: async () => {
                try {
                  const today = getTodayDate();
                  const planId = `${currentUser.uid}_${today}`;

                  const updatedMeals = meals.filter(
                    (meal) => meal.id !== mealId,
                  );
                  setMeals(updatedMeals);
                  setOriginalMeals(JSON.parse(JSON.stringify(updatedMeals)));

                  if (mealToRemove.marked) {
                    setUserData((prev) => ({
                      ...prev,
                      consumedCalories:
                        prev.consumedCalories - mealToRemove.calories,
                    }));
                  }

                  setRecommendedKBRU((prev) => ({
                    proteins: prev.proteins - mealToRemove.proteins,
                    fats: prev.fats - mealToRemove.fats,
                    carbohydrates:
                      prev.carbohydrates - mealToRemove.carbohydrates,
                  }));

                  shouldUpdateFromListenerRef.current = false;
                  lastMealsUpdateRef.current = getMealsHash(updatedMeals);

                  const planRef = doc(db, "ration_plan_days", planId);
                  const planSnap = await getDoc(planRef);

                  if (planSnap.exists()) {
                    const planData = planSnap.data();
                    const currentCustomMeals = planData.customMeals || [];

                    const updatedCustomMeals = currentCustomMeals.filter(
                      (meal: any) => meal.id !== mealId,
                    );

                    await updateDoc(planRef, {
                      customMeals: updatedCustomMeals,
                      "timestamps.updatedAt": new Date().toISOString(),
                    });
                  }

                  setHasUnsavedChanges(true);
                  Alert.alert("Успех", "Рецепт удален из рациона");
                } catch (error) {
                  console.error("Ошибка удаления рецепта:", error);
                  Alert.alert("Ошибка", "Не удалось удалить рецепт");
                } finally {
                  setTimeout(() => {
                    shouldUpdateFromListenerRef.current = true;
                  }, 2000);
                }
              },
            },
          ],
        );
      } else {
        Alert.alert("Ошибка", "Сгенерированные рецепты нельзя удалить");
      }
    },
    [meals, currentUser, db, getTodayDate],
  );

  // 5. Функция обновления состояния приема пищи
  const updateMealState = useCallback(
    async (mealId: string, updates: Partial<Meal>) => {
      if (!currentUser || !db) return;

      try {
        const mealIndex = meals.findIndex((m) => m.id === mealId);
        if (mealIndex === -1) return;

        const updatedMeals = [...meals];
        updatedMeals[mealIndex] = { ...updatedMeals[mealIndex], ...updates };
        setMeals(updatedMeals);
        setOriginalMeals(JSON.parse(JSON.stringify(updatedMeals)));

        const newConsumedCalories = updatedMeals
          .filter((meal) => meal.marked)
          .reduce((sum, meal) => sum + meal.calories, 0);

        setUserData((prev) => ({
          ...prev,
          consumedCalories: newConsumedCalories,
        }));

        if (updates.marked !== undefined) {
          shouldUpdateFromListenerRef.current = false;
          lastMealsUpdateRef.current = getMealsHash(updatedMeals);

          try {
            const today = getTodayDate();
            const planId = `${currentUser.uid}_${today}`;
            const meal = meals[mealIndex];
            const planRef = doc(db, "ration_plan_days", planId);
            const planSnap = await getDoc(planRef);

            if (planSnap.exists()) {
              const planData = planSnap.data();

              if (meal.isCustom) {
                const customMeals = planData.customMeals || [];
                const updatedCustomMeals = customMeals.map(
                  (customMeal: any) => {
                    if (customMeal.id === mealId) {
                      return { ...customMeal, marked: updates.marked };
                    }
                    return customMeal;
                  },
                );

                await updateDoc(planRef, {
                  customMeals: updatedCustomMeals,
                  "timestamps.updatedAt": new Date().toISOString(),
                });
              } else {
                const planMeals = planData.meals || [];
                const updatedPlanMeals = planMeals.map((planMeal: any) => {
                  if (
                    planMeal.id === mealId ||
                    planMeal.id === meal.originalPlanId
                  ) {
                    return { ...planMeal, marked: updates.marked };
                  }
                  return planMeal;
                });

                await updateDoc(planRef, {
                  meals: updatedPlanMeals,
                  "timestamps.updatedAt": new Date().toISOString(),
                });
              }
            }
          } catch (error) {
            console.error("❌ Error updating meal in DB:", error);
          } finally {
            setTimeout(() => {
              shouldUpdateFromListenerRef.current = true;
            }, 2000);
          }
        }

        setHasUnsavedChanges(true);
      } catch (error) {
        console.error("❌ Error updating meal state:", error);
      }
    },
    [currentUser, db, meals, getTodayDate],
  );

  // Оптимизированная функция для избранного
  const toggleRecipeFavorite = useCallback(
    async (mealId: string, recipeId?: string | null) => {
      if (!currentUser || isUpdatingBookmark || !recipeId) {
        return;
      }

      setIsUpdatingBookmark(mealId);

      try {
        const mealIndex = meals.findIndex((m) => m.id === mealId);
        if (mealIndex === -1) return;

        const isCurrentlyBookmarked = meals[mealIndex].bookmarked;

        // Оптимистичное обновление UI
        const updatedMeals = [...meals];
        updatedMeals[mealIndex] = {
          ...updatedMeals[mealIndex],
          bookmarked: !isCurrentlyBookmarked,
        };
        setMeals(updatedMeals);

        // НЕ обновляем originalMeals, чтобы не триггерить сохранение

        // ИСПРАВЛЕНО: обновляем в базе данных
        if (isCurrentlyBookmarked) {
          await favoriteService.removeFromFavorites(
            recipeId,
            "recipe",
            currentUser.uid,
          );
        } else {
          await favoriteService.addToFavorites(
            recipeId,
            "recipe",
            currentUser.uid,
          );
        }

        // Обновляем статус в originalMeals после успешного сохранения в БД
        const updatedOriginalMeals = [...originalMeals];
        const originalIndex = updatedOriginalMeals.findIndex(
          (m) => m.id === mealId,
        );
        if (originalIndex !== -1) {
          updatedOriginalMeals[originalIndex] = {
            ...updatedOriginalMeals[originalIndex],
            bookmarked: !isCurrentlyBookmarked,
          };
          setOriginalMeals(updatedOriginalMeals);
        }
      } catch (error) {
        console.error("Ошибка обновления избранного:", error);
        // Откатываем изменения при ошибке
        const revertedMeals = [...meals];
        const mealIndex = revertedMeals.findIndex((m) => m.id === mealId);
        if (mealIndex !== -1) {
          revertedMeals[mealIndex] = {
            ...revertedMeals[mealIndex],
            bookmarked: !revertedMeals[mealIndex].bookmarked,
          };
          setMeals(revertedMeals);
        }
      } finally {
        setIsUpdatingBookmark(null);
      }
    },
    [currentUser, meals, originalMeals, isUpdatingBookmark],
  );

  // Функция сохранения плана как шаблона
  const saveDailyPlanAsTemplate = useCallback(async () => {
    if (!currentUser || meals.length === 0) {
      Alert.alert("Ошибка", "Нет данных для сохранения");
      return;
    }

    try {
      setIsSaving(true);
      const today = getTodayDate();

      const templateData = {
        title: `Рацион на ${today}`,
        description: `Дневной рацион от ${new Date().toLocaleDateString("ru-RU")}`,
        meals: meals.map((meal) => ({
          id: meal.id,
          recipeId: meal.recipeId,
          name: meal.name,
          category: meal.category,
          calories: meal.calories,
          proteins: meal.proteins,
          fats: meal.fats,
          carbohydrates: meal.carbohydrates,
          weight: meal.weight,
          cookingTime: meal.cookingTime,
          difficultyLevel: meal.difficultyLevel,
          imageUrl: meal.imageUrl,
          isCustom: meal.isCustom,
          marked: meal.marked,
        })),
        stats: {
          totalCalories: meals.reduce((sum, meal) => sum + meal.calories, 0),
          totalProteins: meals.reduce((sum, meal) => sum + meal.proteins, 0),
          totalFats: meals.reduce((sum, meal) => sum + meal.fats, 0),
          totalCarbs: meals.reduce((sum, meal) => sum + meal.carbohydrates, 0),
          totalCookingTime: meals.reduce(
            (sum, meal) => sum + (meal.cookingTime || 0),
            0,
          ),
        },
        date: today,
        createdAt: new Date().toISOString(),
      };

      if (db) {
        await setDoc(
          doc(db, `users/${currentUser.uid}`),
          {
            lastDailyPlanSave: today,
          },
          { merge: true },
        );
      }

      await rationPlanService.createRationPlan(currentUser.uid, templateData);

      setHasSavedToday(true);
      setLastSaveDate(today);
      setHasUnsavedChanges(false);

      setOriginalMeals(JSON.parse(JSON.stringify(meals)));

      Alert.alert("Успех!", "Дневной рацион сохранен как шаблон.", [
        { text: "Продолжить", style: "default" },
        {
          text: "Посмотреть",
          onPress: () => router.push("/saved-plans"),
        },
      ]);
    } catch (error: any) {
      console.error("❌ Error saving template:", error);
      Alert.alert("Ошибка", error.message || "Не удалось сохранить шаблон");
    } finally {
      setIsSaving(false);
    }
  }, [currentUser, meals, db, router, getTodayDate]);

  // Проверка изменений в рационе (игнорируя bookmarked)
  useEffect(() => {
    if (originalMeals.length > 0 && meals.length > 0) {
      const hasChanges = !arraysEqual(meals, originalMeals);
      setHasUnsavedChanges(hasChanges);

      if (hasChanges && hasSavedToday) {
        console.log("🔄 Есть несохраненные изменения, можно обновить шаблон");
      }
    } else if (meals.length > 0 && originalMeals.length === 0) {
      setHasUnsavedChanges(true);
    } else if (meals.length === 0 && originalMeals.length === 0) {
      setHasUnsavedChanges(false);
    }
  }, [meals, originalMeals, hasSavedToday]);

  // 6. Обработчики UI
  const handleToggleMeal = useCallback(
    (mealId: string) => {
      const meal = meals.find((m) => m.id === mealId);
      if (meal) {
        updateMealState(mealId, { marked: !meal.marked });
      }
    },
    [meals, updateMealState],
  );

  const handleToggleBookmark = useCallback(
    (mealId: string) => {
      const meal = meals.find((m) => m.id === mealId);
      if (meal) {
        toggleRecipeFavorite(mealId, meal.recipeId);
      }
    },
    [meals, toggleRecipeFavorite],
  );

  const navigateToMealPage = (mealIndex: number) => {
    const meal = meals[mealIndex];
    if (!meal) return;

    const params: Record<string, string | number | null | undefined> = {
      mealId: meal.id,
      recipeId: meal.recipeId || meal.id || null,
      mealName: meal.name,
      category: meal.category,
      mealIndex: mealIndex.toString(),
      initialBookmarked: meal.bookmarked.toString(),
      calories: meal.calories.toString(),
      proteins: meal.proteins.toString(),
      fats: meal.fats.toString(),
      carbohydrates: meal.carbohydrates.toString(),
      weight: meal.weight,
      cookingTime: meal.cookingTime.toString(),
      difficultyLevel: meal.difficultyLevel || "Легко",
      rating: meal.rating?.toString() || "0",
      fromScreen: "home",
      isCustom: meal.isCustom?.toString() || "false",
      imageUrl: meal.imageUrl || undefined,
    } as any;

    router.push({
      pathname: "/meal",
      params,
    });
  };

  const navigateToProfile = () => {
    if (currentUser) {
      router.push("/profile");
    }
  };

  const handleAddRecipePress = () => {
    setShowAddRecipeModal(true);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDailyPlan();
    setIsRefreshing(false);
  };

  // 7. Компонент модального окна добавления рецепта
  const AddRecipeModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showAddRecipeModal}
      onRequestClose={() => setShowAddRecipeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Добавить рецепт в рацион</Text>
            <TouchableOpacity
              onPress={() => setShowAddRecipeModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>
              Выберите, как вы хотите добавить рецепт:
            </Text>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowAddRecipeModal(false);
                router.push("/select-recipe");
              }}
            >
              <Ionicons name="search" size={24} color="#6A9AA9" />
              <Text style={styles.modalOptionText}>Выбрать из рецептов</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowAddRecipeModal(false);
                router.push("/create-recipe");
              }}
            >
              <Ionicons name="add-circle" size={24} color="#9BDF11" />
              <Text style={styles.modalOptionText}>Создать новый рецепт</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowAddRecipeModal(false);
                router.push("/select-user-recipes");
              }}
            >
              <Ionicons name="book" size={24} color="#FF9800" />
              <Text style={styles.modalOptionText}>Из моих рецептов</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // 8. Обработка пустого состояния
  if (loading || isPlanLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>
          {isGeneratingPlan ? "Генерируем ваш рацион..." : "Загрузка..."}
        </Text>
      </View>
    );
  }

  // 9. Расчет отображения
  const dailyTargetForDisplay = Math.round(userData.dailyCalories / 100) * 100;
  const progressPercentage = Math.min(
    100,
    (userData.consumedCalories / dailyTargetForDisplay) * 100,
  );
  const remainingCalories = Math.max(
    0,
    dailyTargetForDisplay - userData.consumedCalories,
  );

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>Рацион</Text>
            <Text style={styles.dietText}>
              Ваш рацион на день,{" "}
              {userData.userName.split(" ")[0] || "Пользователь"}!
            </Text>
          </View>

          <TouchableOpacity style={styles.userInfo} onPress={navigateToProfile}>
            {userProfileLoading ? (
              <View style={styles.avatarLoading}>
                <ActivityIndicator size="small" color="#6A9AA9" />
              </View>
            ) : (
              <Avatar photoURL={userData.photoURL} size={55} />
            )}
            <Text style={styles.userName}>
              {userData.userName || "Пользователь"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={["#6A9AA9"]}
              tintColor="#6A9AA9"
            />
          }
        >
          {/* Прогресс калорий и КБЖУ */}
          <View style={styles.caloriesSection}>
            <View style={styles.caloriesHeader}>
              <Text style={styles.caloriesTitle}>
                Цель на день: {dailyTargetForDisplay} ккал
              </Text>
            </View>

            <View style={styles.remainingCaloriesContainer}>
              <Text style={styles.remainingCaloriesLabel}>Осталось:</Text>
              <Text style={styles.remainingCaloriesValue}>
                {Math.round(remainingCalories / 100) * 100} ккал
              </Text>
            </View>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progressPercentage}%` },
                ]}
              />
            </View>

            <View style={styles.kbruContainer}>
              <View style={styles.kbruRow}>
                <Text
                  style={[styles.kbruHeader, { flex: 1, textAlign: "left" }]}
                >
                  Макронутриенты
                </Text>
                <Text style={styles.kbruHeader}>Белки (г)</Text>
                <Text style={styles.kbruHeader}>Жиры (г)</Text>
                <Text style={styles.kbruHeader}>Углеводы (г)</Text>
              </View>

              <View style={styles.kbruRow}>
                <Text
                  style={[styles.kbruLabel, { flex: 1, textAlign: "left" }]}
                >
                  План (Рацион)
                </Text>
                <Text style={styles.kbruValue}>{recommendedKBRU.proteins}</Text>
                <Text style={styles.kbruValue}>{recommendedKBRU.fats}</Text>
                <Text style={styles.kbruValue}>
                  {recommendedKBRU.carbohydrates}
                </Text>
              </View>

              <View style={[styles.kbruRow, styles.targetKBRURow]}>
                <Text
                  style={[
                    styles.kbruLabel,
                    {
                      flex: 1,
                      textAlign: "left",
                      fontFamily: "Playfair Display Bold",
                    },
                  ]}
                >
                  Цель (Ваша норма)
                </Text>
                <Text
                  style={[
                    styles.kbruValue,
                    { fontFamily: "Playfair Display Bold" },
                  ]}
                >
                  {targetKBRU.proteins}
                </Text>
                <Text
                  style={[
                    styles.kbruValue,
                    { fontFamily: "Playfair Display Bold" },
                  ]}
                >
                  {targetKBRU.fats}
                </Text>
                <Text
                  style={[
                    styles.kbruValue,
                    { fontFamily: "Playfair Display Bold" },
                  ]}
                >
                  {targetKBRU.carbohydrates}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.saveDailyPlanButton,
                hasSavedToday &&
                  !hasUnsavedChanges &&
                  styles.saveDailyPlanButtonDisabled,
                isSaving && styles.saveDailyPlanButtonSaving,
                hasUnsavedChanges && styles.saveDailyPlanButtonChanged,
              ]}
              onPress={saveDailyPlanAsTemplate}
              activeOpacity={0.7}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#6A9AA9" />
              ) : (
                <>
                  <Ionicons
                    name={
                      hasSavedToday && !hasUnsavedChanges
                        ? "checkmark-circle"
                        : hasSavedToday && hasUnsavedChanges
                          ? "refresh-outline"
                          : "copy-outline"
                    }
                    size={18}
                    color={
                      hasSavedToday && !hasUnsavedChanges
                        ? "#4CAF50"
                        : hasUnsavedChanges
                          ? "#FF9800"
                          : "#6A9AA9"
                    }
                  />
                  <Text
                    style={[
                      styles.saveDailyPlanText,
                      hasSavedToday &&
                        !hasUnsavedChanges &&
                        styles.saveDailyPlanTextDisabled,
                      hasUnsavedChanges && styles.saveDailyPlanTextChanged,
                    ]}
                  >
                    {hasSavedToday && !hasUnsavedChanges
                      ? "Сохранено сегодня"
                      : hasSavedToday && hasUnsavedChanges
                        ? "Обновить шаблон"
                        : "Сохранить как шаблон"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {lastSaveDate && hasSavedToday && (
              <Text style={styles.lastSaveInfo}>
                Последнее сохранение: {formatDate(lastSaveDate)}
                {hasUnsavedChanges && " • Есть несохраненные изменения"}
              </Text>
            )}

            <View style={styles.sectionDivider} />
          </View>

          <View style={styles.mealsTitleSection}>
            <Text style={styles.mealsTitle}>
              Приемы пищи на сегодня ({meals.length})
            </Text>
            <TouchableOpacity
              style={styles.addRecipeButton}
              onPress={handleAddRecipePress}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color="#6A9AA9" />
              <Text style={styles.addRecipeText}>Добавить рецепт</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mealsSection}>
            <View style={styles.recipesGrid}>
              {meals.map((meal, mealIndex) => (
                <View key={meal.id} style={styles.recipeColumn}>
                  <TouchableOpacity
                    style={styles.recipeCard}
                    onPress={() => navigateToMealPage(mealIndex)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.imageContainer}>
                      {meal.image?.uri ? (
                        <Image
                          source={meal.image}
                          style={styles.recipeImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.recipeImagePlaceholder}>
                          <Ionicons
                            name={getCategoryIcon(meal.category) as any}
                            size={32}
                            color="#6A9AA9"
                          />
                        </View>
                      )}

                      <DifficultyBadge difficulty={meal.difficultyLevel} />

                      <TouchableOpacity
                        style={styles.bookmarkButton}
                        onPress={() => handleToggleBookmark(meal.id)}
                        disabled={isUpdatingBookmark === meal.id}
                      >
                        <Ionicons
                          name={
                            meal.bookmarked ? "bookmark" : "bookmark-outline"
                          }
                          size={18}
                          color={meal.bookmarked ? "#FFD700" : "#6A9AA9"}
                        />
                      </TouchableOpacity>

                      {meal.canBeRemoved && (
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            removeMeal(meal.id);
                          }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={16}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                      )}

                      {meal.rating && meal.rating > 0 ? (
                        <View style={styles.ratingBadge}>
                          <FontAwesome name="star" size={10} color="#FFD700" />
                          <Text style={styles.ratingText}>
                            {meal.rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : null}

                      {meal.isCustom && (
                        <View style={styles.customBadge}>
                          <Ionicons
                            name="add-circle"
                            size={10}
                            color="#FFFFFF"
                          />
                          <Text style={styles.customBadgeText}>Добавлен</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.recipeContent}>
                      <View style={styles.recipeInfo}>
                        <Text
                          style={styles.recipeName}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {meal.name}
                        </Text>

                        <Text style={styles.recipeCategory}>
                          {meal.category}
                        </Text>

                        <View style={styles.recipeDetails}>
                          <Text style={styles.recipeCalories}>
                            {meal.calories} ккал
                          </Text>

                          <MaterialIcons
                            name="access-time"
                            size={12}
                            color="#6A9AA9"
                            style={styles.timeIcon}
                          />
                          <Text style={styles.recipeTime}>
                            {formatMinutes(meal.cookingTime)}
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.markButton,
                          meal.marked && styles.markButtonActive,
                        ]}
                        onPress={() => handleToggleMeal(meal.id)}
                      >
                        {meal.marked ? (
                          <Image
                            source={require("@/assets/images/checkmark-done.png")}
                            style={styles.checkmarkIcon}
                          />
                        ) : (
                          <Text style={styles.markButtonText}>
                            Отметить прием
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      <AddRecipeModal />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  rootContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 15,
  },
  greetingText: {
    fontSize: 24,
    color: "#1a1a1a",
    marginBottom: 4,
    fontFamily: "Playfair Display Bold",
  },
  dietText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Playfair Display Regular",
  },
  userInfo: {
    alignItems: "center",
    minWidth: 60,
  },
  userName: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginTop: 4,
    textAlign: "center",
  },
  avatarLoading: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#9BDF11",
  },
  scrollView: {
    flex: 1,
  },
  caloriesSection: {
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginBottom: 1,
  },
  caloriesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  caloriesTitle: {
    fontSize: 16,
    color: "#000000ff",
    fontFamily: "Playfair Display Regular",
    flex: 1,
  },
  remainingCaloriesContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  remainingCaloriesLabel: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Playfair Display Regular",
  },
  remainingCaloriesValue: {
    fontSize: 18,
    color: "#9BDF11",
    fontFamily: "Playfair Display Bold",
  },
  progressBar: {
    height: 12,
    backgroundColor: "#C2DAE2",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#9BDF11",
    borderRadius: 6,
  },
  saveDailyPlanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5F0F5",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#C2DAE2",
    marginTop: 0,
  },
  saveDailyPlanButtonChanged: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FFB74D",
  },
  saveDailyPlanButtonDisabled: {
    backgroundColor: "#F0F0F0",
    borderColor: "#D0D0D0",
  },
  saveDailyPlanButtonSaving: {
    opacity: 0.7,
  },
  saveDailyPlanText: {
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    marginLeft: 8,
  },
  saveDailyPlanTextDisabled: {
    color: "#888",
  },
  saveDailyPlanTextChanged: {
    color: "#FF9800",
    fontFamily: "Playfair Display Bold",
  },
  lastSaveInfo: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Playfair Display Italic",
    textAlign: "center",
    marginBottom: 10,
  },
  kbruContainer: {
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: "#C2DAE2",
    borderRadius: 8,
    backgroundColor: "#F7F7F7",
    marginBottom: 20,
  },
  kbruRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  targetKBRURow: {
    borderBottomWidth: 0,
    backgroundColor: "#DDEEF4",
    borderRadius: 8,
    marginHorizontal: -1,
    paddingHorizontal: 6,
  },
  kbruHeader: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
    width: "23%",
  },
  kbruLabel: {
    fontSize: 14,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    width: "23%",
  },
  kbruValue: {
    fontSize: 14,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
    width: "23%",
  },
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -20,
  },
  mealsTitleSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  mealsTitle: {
    fontSize: 20,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    flex: 1,
  },
  addRecipeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#E5F0F5",
    borderWidth: 1,
    borderColor: "#C2DAE2",
    marginLeft: 12,
  },
  addRecipeText: {
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    marginLeft: 6,
  },
  mealsSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  recipesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
  },
  recipeColumn: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  recipeCard: {
    backgroundColor: "#C2DAE2",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    height: 300,
    borderWidth: 1,
    borderColor: "#A8C8D4",
  },
  imageContainer: {
    position: "relative",
    height: 140,
  },
  recipeImage: {
    width: "100%",
    height: "100%",
  },
  recipeImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButton: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 107, 107, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  customBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(155, 223, 17, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  customBadgeText: {
    fontSize: 9,
    color: "#FFFFFF",
    fontFamily: "Playfair Display Bold",
    marginLeft: 2,
  },
  difficultyBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  difficultyText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontFamily: "Playfair Display Bold",
  },
  bookmarkButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  ratingBadge: {
    position: "absolute",
    top: 35,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  ratingText: {
    fontSize: 10,
    color: "#000000",
    fontFamily: "Playfair Display Bold",
    marginLeft: 2,
  },
  recipeContent: {
    padding: 12,
    flex: 1,
    justifyContent: "space-between",
  },
  recipeInfo: {
    flex: 1,
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 14,
    color: "#212529",
    marginBottom: 4,
    fontFamily: "Playfair Display Regular",
    lineHeight: 18,
    minHeight: 36,
  },
  recipeCategory: {
    fontSize: 11,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    fontStyle: "italic",
    marginBottom: 6,
  },
  recipeDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
  },
  recipeCalories: {
    fontSize: 12,
    color: "#000000",
    fontFamily: "Playfair Display Bold",
    marginRight: 8,
  },
  timeIcon: {
    marginRight: 4,
  },
  recipeTime: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginRight: 12,
  },
  markButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#C2DAE2",
  },
  markButtonActive: {
    backgroundColor: "rgba(155, 223, 17, 0.6)",
  },
  markButtonText: {
    color: "#000000ff",
    fontSize: 12,
    fontFamily: "Playfair Display Regular",
  },
  checkmarkIcon: {
    width: 16,
    height: 16,
    tintColor: "#000000ff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "90%",
    maxHeight: "70%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Playfair Display Bold",
    color: "#1a1a1a",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginBottom: 20,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Regular",
    marginLeft: 12,
    flex: 1,
  },
});
