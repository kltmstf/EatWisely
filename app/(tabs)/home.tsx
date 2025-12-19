// app/(tabs)/home.tsx
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  Modal,
} from "react-native";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  getDoc,
  Firestore,
  setLogLevel,
  setDoc,
} from "firebase/firestore";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  Ionicons,
  FontAwesome,
  MaterialIcons,
  Feather,
} from "@expo/vector-icons";

// ИМПОРТ СЕРВИСОВ
import { userService } from "@/app/services/userService";
import { dailyRationService } from "@/app/services/rationService";
import { favoriteService } from "@/app/services/favoriteService";
import { rationPlanService } from "@/app/services/rationPlanService";

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
  difficultyLevel?: string;
  rating?: number;
  recipeId?: string;
  isCustom?: boolean;
  canBeRemoved?: boolean;
  imageUrl?: string;
  addedAt?: string;
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
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
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
  if (typeof time === 'number') {
    return time;
  }
  if (typeof time === 'string') {
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

// --- КОМПОНЕНТ HOME ---

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [db, setDb] = useState<Firestore | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [originalMeals, setOriginalMeals] = useState<Meal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState<string | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingRecipe, setPendingRecipe] = useState<any>(null);

  // Новые состояния для контроля сохранения
  const [hasSavedToday, setHasSavedToday] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaveDate, setLastSaveDate] = useState<string | null>(null);
  const [lastPlanDate, setLastPlanDate] = useState<string | null>(null);

  const mealsRef = useRef(meals);
  useEffect(() => {
    mealsRef.current = meals;
  }, [meals]);

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

  const [userProfileLoading, setUserProfileLoading] = useState(false);
  const [userSettingsChanged, setUserSettingsChanged] = useState(false);

  const loading = !isAuthReady || !db;

  // Функция проверки, сохранял ли пользователь уже сегодня
  const checkTodaySave = useCallback(
    async (userId: string) => {
      if (!db) return;

      try {
        const today = new Date().toISOString().split("T")[0];
        const userDoc = await getDoc(doc(db, `users/${userId}`));

        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfileData;
          const lastSave = data.lastDailyPlanSave;

          if (lastSave === today) {
            setHasSavedToday(true);
          }
          setLastSaveDate(lastSave || null);
        }
      } catch (error) {
        console.error("Ошибка проверки сохранения:", error);
      }
    },
    [db]
  );

  // Функция для проверки существования плана в БД
  const checkIfPlanExists = useCallback(async (userId: string, date: Date): Promise<boolean> => {
    if (!db) return false;
    
    try {
      const dateStr = date.toISOString().split('T')[0];
      const planId = `${userId}_${dateStr}`;
      
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      
      return planSnap.exists();
    } catch (error) {
      console.error("Error checking if plan exists:", error);
      return false;
    }
  }, [db]);

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

  // Проверка параметров для добавления рецепта
  useEffect(() => {
    if (params.selectedRecipe) {
      try {
        const recipeData = JSON.parse(params.selectedRecipe as string);
        
        // Если у рецепта уже есть категория, добавляем сразу
        if (recipeData.category) {
          addRecipeToPlan(recipeData, recipeData.category);
        } else {
          // Если нет категории, показываем выбор
          setPendingRecipe(recipeData);
          setShowCategoryModal(true);
        }

        // Очищаем параметры
        setTimeout(() => {
          router.setParams({ selectedRecipe: undefined });
        }, 100);
      } catch (error) {
        console.error("Ошибка парсинга выбранного рецепта:", error);
      }
    }
  }, [params.selectedRecipe, router]);

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

      const unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          setUserId(user.uid);

          const photoURL = await loadUserProfilePhoto(user.uid);
          setUserData((prev) => ({
            ...prev,
            photoURL: photoURL,
          }));

          // Проверяем, сохранял ли пользователь уже сегодня
          await checkTodaySave(user.uid);

          console.log("✅ AUTH: User authenticated. UID:", user.uid);
        } else {
          setUserId(null);
          setUserData((prev) => ({
            ...prev,
            userName: "Пользователь",
            dailyCalories: 2000,
            photoURL: null,
          }));
          setHasSavedToday(false);
          setLastSaveDate(null);
          console.log("⚠️ AUTH: User is NOT authenticated.");
        }
        setIsAuthReady(true);
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error("❌ INIT: Ошибка инициализации Firebase:", error);
      setIsAuthReady(true);
    }
  }, [loadUserProfilePhoto, checkTodaySave]);

  // Функция для добавления рецепта в рацион
  const addRecipeToPlan = useCallback(
    async (recipeData: any, category?: string) => {
      if (!userId) {
        Alert.alert("Ошибка", "Пользователь не авторизован");
        return;
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Используем категорию из рецепта или переданную, или по умолчанию
        const finalCategory = category || recipeData.category || recipeData.mealType || "Обед";
        
        // Проверяем по recipeId и имени
        const existingMeal = meals.find(
          (meal) =>
            (meal.recipeId && meal.recipeId === recipeData.id) ||
            (meal.name === recipeData.title && 
             meal.category === finalCategory &&
             meal.isCustom)
        );

        if (existingMeal) {
          Alert.alert(
            "Внимание",
            "Этот рецепт уже добавлен в ваш рацион на сегодня"
          );
          return;
        }

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
          bookmarked: false,
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

        // Сохраняем в базу данных
        await dailyRationService.addCustomMealToPlan(userId, new Date(), {
          id: newMeal.id,
          recipeId: newMeal.recipeId || null,
          category: newMeal.category,
          name: newMeal.name,
          calories: newMeal.calories,
          proteins: newMeal.proteins,
          fats: newMeal.fats,
          carbohydrates: newMeal.carbohydrates,
          weight: newMeal.weight,
          cookingTime: newMeal.cookingTime,
          difficultyLevel: newMeal.difficultyLevel || "Легко",
          rating: newMeal.rating || 0,
          imageUrl: newMeal.imageUrl || null,
          marked: false,
          bookmarked: false,
          isCustom: true,
          canBeRemoved: true,
          addedAt: newMeal.addedAt,
        });

        // Обновляем локальное состояние
        setMeals((prev) => {
          const updated = [...prev, newMeal];

          // Обновляем КБЖУ
          setRecommendedKBRU((prevKBRU) => ({
            proteins: prevKBRU.proteins + newMeal.proteins,
            fats: prevKBRU.fats + newMeal.fats,
            carbohydrates: prevKBRU.carbohydrates + newMeal.carbohydrates,
          }));

          // Обновляем статистику калорий
          setUserData((prev) => ({
            ...prev,
            consumedCalories: prev.consumedCalories + newMeal.calories,
          }));

          return updated;
        });

        Alert.alert("Успех", "Рецепт добавлен в рацион!");
        setPendingRecipe(null);
        setShowCategoryModal(false);
      } catch (error) {
        console.error("Ошибка добавления рецепта:", error);
        Alert.alert("Ошибка", "Не удалось добавить рецепт");
      }
    },
    [userId, meals]
  );

  // Функция для удаления кастомного рецепта
  const removeMeal = useCallback(
    async (mealId: string) => {
      const mealToRemove = meals.find((meal) => meal.id === mealId);
      if (!mealToRemove || !userId) return;

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
                  // Удаляем из базы данных
                  await dailyRationService.removeCustomMealFromPlan(
                    userId,
                    new Date(),
                    mealId
                  );

                  // Обновляем локальное состояние
                  setMeals((prev) => prev.filter((meal) => meal.id !== mealId));

                  // Вычитаем калории и КБЖУ
                  if (mealToRemove.marked) {
                    setUserData((prev) => ({
                      ...prev,
                      consumedCalories:
                        prev.consumedCalories - mealToRemove.calories,
                    }));
                  }

                  // Обновляем КБЖУ
                  setRecommendedKBRU((prev) => ({
                    proteins: prev.proteins - mealToRemove.proteins,
                    fats: prev.fats - mealToRemove.fats,
                    carbohydrates:
                      prev.carbohydrates - mealToRemove.carbohydrates,
                  }));

                  Alert.alert("Успех", "Рецепт удален из рациона");
                } catch (error) {
                  console.error("Ошибка удаления рецепта:", error);
                  Alert.alert("Ошибка", "Не удалось удалить рецепт");
                }
              },
            },
          ]
        );
      } else {
        Alert.alert("Ошибка", "Сгенерированные рецепты нельзя удалить");
      }
    },
    [meals, userId]
  );

  // 2. Загрузка ежедневного плана
  const loadDailyPlan = useCallback(
    async (forceRegenerate = false) => {
      if (!userId) {
        console.log("⚠️ No user ID, skipping plan load");
        return;
      }

      try {
        setIsGeneratingPlan(true);

        const today = new Date().toISOString().split('T')[0];
        
        // Проверяем, изменился ли день
        if (lastPlanDate !== today) {
          console.log(`🔄 Day changed from ${lastPlanDate} to ${today}`);
          dailyRationService.clearCache();
          setLastPlanDate(today);
        }

        // Флаги для отслеживания состояния
        let plan = null;
        let isNewPlan = false;
        let shouldCreateDefaultMeals = false;

        // 1. Проверяем, нужно ли регенерировать из-за настроек
        const shouldRegenerate = forceRegenerate || userSettingsChanged;

        if (shouldRegenerate) {
          console.log("🔄 User settings changed, creating new plan");
          plan = await dailyRationService.createNewPlanWithUserSettings(userId);
          setUserSettingsChanged(false);
          isNewPlan = true;
        } else {
          // 2. Пытаемся получить существующий план
          try {
            plan = await dailyRationService.getOrGenerateDailyPlan(userId);
            console.log("✅ Existing plan loaded from DB or cache");
          } catch (error) {
            console.log("⚠️ Error loading plan, checking DB directly:", error);
            
            // Пытаемся получить план напрямую из БД
            const dateStr = today;
            const planId = `${userId}_${dateStr}`;
            
            if (db) {
              const planRef = doc(db, 'ration_plan_days', planId);
              const planSnap = await getDoc(planRef);
              
              if (planSnap.exists()) {
                console.log("✅ Plan found directly in DB");
                const data = planSnap.data();
                const meals = data.meals || [];
                const customMeals = data.customMeals || [];
                const allMeals = [...meals, ...customMeals];
                
                plan = {
                  id: planId,
                  userId,
                  date: data.date || dateStr,
                  dayOfWeek: data.dayOfWeek || '',
                  userTargets: data.userTargets || { dailyCalories: 2000, dietType: 'Обычное' },
                  meals: allMeals,
                  customMeals: customMeals,
                  stats: data.stats || {
                    totalCalories: allMeals.reduce((sum: number, meal: any) => sum + (meal.calories || 0), 0),
                    totalProteins: allMeals.reduce((sum: number, meal: any) => sum + (meal.proteins || 0), 0),
                    totalFats: allMeals.reduce((sum: number, meal: any) => sum + (meal.fats || 0), 0),
                    totalCarbs: allMeals.reduce((sum: number, meal: any) => sum + (meal.carbohydrates || 0), 0),
                    totalCookingTime: allMeals.reduce((sum: number, meal: any) => sum + (meal.cookingTime || 0), 0),
                    completedMeals: allMeals.filter((meal: any) => meal.marked).length,
                    totalMeals: allMeals.length
                  },
                  timestamps: data.timestamps || {
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  }
                };
              } else {
                console.log("⚠️ No plan in DB, will check if we should create default");
                shouldCreateDefaultMeals = true;
              }
            } else {
              shouldCreateDefaultMeals = true;
            }
          }
        }

        // 3. Если плана нет и мы должны создать стандартные рецепты (только для нового дня)
        if (!plan && shouldCreateDefaultMeals && !hasSavedToday) {
          console.log("⚠️ Creating default meals for new day");
          const defaultMeals: Meal[] = [
            {
              id: "default-breakfast-1",
              category: "Завтрак",
              name: "Овсяная каша с фрукты",
              calories: 350,
              proteins: 12,
              fats: 8,
              carbohydrates: 58,
              weight: "250г",
              marked: false,
              bookmarked: false,
              cookingTime: 15,
              difficultyLevel: "Легко",
              rating: 4.5,
              image: DEFAULT_MEAL_IMAGE,
              isCustom: false,
              canBeRemoved: false,
            },
            {
              id: "default-lunch-1",
              category: "Обед",
              name: "Куриная грудка с овощами",
              calories: 450,
              proteins: 35,
              fats: 12,
              carbohydrates: 40,
              weight: "300г",
              marked: false,
              bookmarked: false,
              cookingTime: 30,
              difficultyLevel: "Легко",
              rating: 4.7,
              image: DEFAULT_MEAL_IMAGE,
              isCustom: false,
              canBeRemoved: false,
            },
            {
              id: "default-dinner-1",
              category: "Ужин",
              name: "Запеченная рыба с салатом",
              calories: 400,
              proteins: 30,
              fats: 15,
              carbohydrates: 25,
              weight: "280г",
              marked: false,
              bookmarked: false,
              cookingTime: 25,
              difficultyLevel: "Средне",
              rating: 4.6,
              image: DEFAULT_MEAL_IMAGE,
              isCustom: false,
              canBeRemoved: false,
            },
            {
              id: "default-snack-1",
              category: "Перекусы",
              name: "Йогурт с орехами и мёдом",
              calories: 200,
              proteins: 10,
              fats: 12,
              carbohydrates: 15,
              weight: "150г",
              marked: false,
              bookmarked: false,
              cookingTime: 5,
              difficultyLevel: "Легко",
              rating: 4.3,
              image: DEFAULT_MEAL_IMAGE,
              isCustom: false,
              canBeRemoved: false,
            },
          ];
          
          plan = { meals: defaultMeals };
          isNewPlan = true;
        }

        // 4. Если плана все еще нет, значит пользователь уже сохранял сегодня
        // и мы просто показываем пустой рацион
        if (!plan) {
          console.log("✅ No plan to load - user might have cleared or not created one yet");
          setMeals([]);
          setRecommendedKBRU({ proteins: 0, fats: 0, carbohydrates: 0 });
          setUserData(prev => ({ ...prev, consumedCalories: 0 }));
          return;
        }

        // Преобразуем план в формат для отображения
        const formattedMeals: Meal[] = plan.meals.map(
          (meal: any, index: number) => {
            const carbsValue = meal.carbohydrates || meal.carbs || 0;
            const isCustom = meal.isCustom || false;
            
            // ✅ ВАЖНО: Сохраняем оригинальный ID из плана
            const mealId = meal.id || `meal-${index}`;

            const baseMeal = {
              id: mealId,
              category: meal.category || "Обед",
              name: meal.name || "Рецепт",
              calories: meal.calories || 350,
              proteins: meal.proteins || 20,
              fats: meal.fats || 10,
              carbohydrates: carbsValue,
              weight: meal.weight || "250г",
              marked: meal.marked || false,
              bookmarked: meal.bookmarked || false,
              cookingTime: parseCookingTime(meal.cookingTime),
              difficultyLevel: meal.difficultyLevel || "Легко",
              rating: meal.rating || 0,
              recipeId: meal.recipeId || mealId,
              image: meal.imageUrl
                ? { uri: meal.imageUrl }
                : DEFAULT_MEAL_IMAGE,
              imageUrl: meal.imageUrl || null,
              isCustom: isCustom,
              canBeRemoved: meal.canBeRemoved || isCustom,
              addedAt: meal.addedAt || new Date().toISOString(),
            };

            return baseMeal;
          }
        );

        // Удаляем дубликаты по ID
        const uniqueMeals = formattedMeals.reduce((acc: Meal[], current) => {
          const exists = acc.find(meal => meal.id === current.id);
          if (!exists) {
            acc.push(current);
          }
          return acc;
        }, []);

        setMeals(uniqueMeals);

        // Сохраняем оригинальную версию только если это новый план
        if (isNewPlan && originalMeals.length === 0) {
          setOriginalMeals([...uniqueMeals]);
        } else if (!isNewPlan && originalMeals.length === 0) {
          // Если это загрузка существующего плана, тоже сохраняем как оригинал
          setOriginalMeals([...uniqueMeals]);
        }

        // Обновляем потребленные калории и КБЖУ
        const consumed = uniqueMeals
          .filter((meal) => meal.marked)
          .reduce((sum, meal) => sum + meal.calories, 0);

        const totalKBRU = uniqueMeals.reduce(
          (acc, meal) => ({
            proteins: acc.proteins + meal.proteins,
            fats: acc.fats + meal.fats,
            carbohydrates: acc.carbohydrates + meal.carbohydrates,
          }),
          { proteins: 0, fats: 0, carbohydrates: 0 }
        );

        setRecommendedKBRU(totalKBRU);
        setUserData((prev) => ({ ...prev, consumedCalories: consumed }));

        console.log("✅ Daily plan loaded:", {
          meals: uniqueMeals.length,
          isNewPlan,
          date: today,
          hasSavedToday,
        });
        
        // Если это новый план и мы его создали, автоматически сохраняем в БД
        if (isNewPlan && plan && plan.meals && plan.meals.length > 0) {
          console.log("💾 Auto-saving new plan to DB");
          try {
            await dailyRationService.savePlan({
              id: `${userId}_${today}`,
              userId,
              date: today,
              dayOfWeek: new Date().toLocaleDateString('ru-RU', { weekday: 'long' }),
              userTargets: {
                dailyCalories: userData.dailyCalories,
                dietType: 'Обычное'
              },
              meals: uniqueMeals.filter(m => !m.isCustom),
              customMeals: uniqueMeals.filter(m => m.isCustom),
              stats: {
                totalCalories: totalKBRU.proteins * 4 + totalKBRU.fats * 9 + totalKBRU.carbohydrates * 4,
                totalProteins: totalKBRU.proteins,
                totalFats: totalKBRU.fats,
                totalCarbs: totalKBRU.carbohydrates,
                totalCookingTime: uniqueMeals.reduce((sum, meal) => sum + meal.cookingTime, 0),
                completedMeals: uniqueMeals.filter(m => m.marked).length,
                totalMeals: uniqueMeals.length
              },
              timestamps: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            });
          } catch (error) {
            console.error("❌ Error auto-saving plan:", error);
          }
        }

      } catch (error) {
        console.error("❌ Critical error loading plan:", error);
        Alert.alert(
          "Ошибка",
          "Не удалось загрузить рацион. Попробуйте обновить."
        );
      } finally {
        setIsGeneratingPlan(false);
        setIsRefreshing(false);
      }
    },
    [userId, userSettingsChanged, lastPlanDate, db, originalMeals, hasSavedToday, userData.dailyCalories]
  );

  // Загружаем план только при готовности аутентификации
  useEffect(() => {
    if (isAuthReady && userId) {
      loadDailyPlan();
    }
  }, [isAuthReady, userId]);

  // Проверяем изменения в рационе
  useEffect(() => {
    if (originalMeals.length > 0 && meals.length > 0) {
      // Простая проверка на изменения
      const hasChanges = 
        meals.length !== originalMeals.length ||
        meals.some((meal, index) => {
          const originalMeal = originalMeals[index];
          if (!originalMeal) return true;
          return (
            meal.id !== originalMeal.id ||
            meal.marked !== originalMeal.marked ||
            meal.bookmarked !== originalMeal.bookmarked ||
            meal.isCustom !== originalMeal.isCustom ||
            meal.name !== originalMeal.name
          );
        });
      
      setHasUnsavedChanges(hasChanges);
      
      // Если есть изменения и ранее был сохранен, разблокируем кнопку
      if (hasChanges && hasSavedToday) {
        console.log("🔄 Рацион изменен, сбрасываем флаг сохранения");
        setHasSavedToday(false);
      }
    }
  }, [meals, originalMeals, hasSavedToday]);

  // 3. Загрузка данных пользователя с улучшенной логикой
  useEffect(() => {
    if (!db || !userId) return;

    const userDocRef = doc(db, `users/${userId}`);

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
            data.dailyCalories || data.targetCalories || 2000
          );

          const photoURL = data.photoURL || null;

          // Обновляем дату последнего сохранения
          const lastSave = data.lastDailyPlanSave;
          const today = new Date().toISOString().split("T")[0];
          
          if (lastSave === today) {
            setHasSavedToday(true);
          } else {
            setHasSavedToday(false);
          }
          setLastSaveDate(lastSave || null);

          // Сравниваем с текущими значениями
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

          // Проверяем, изменились ли ключевые параметры пользователя
          // Только если изменения значительные, отмечаем нужду в регенерации
          const caloriesChanged = Math.abs(currentCalories - oldCalories) > 100;
          const proteinsChanged = Math.abs(newTargetProteins - oldTargetProteins) > 10;
          const fatsChanged = Math.abs(newTargetFats - oldTargetFats) > 10;
          const carbsChanged = Math.abs(newTargetCarbs - oldTargetCarbs) > 10;

          if (caloriesChanged || proteinsChanged || fatsChanged || carbsChanged) {
            console.log(
              "🔄 User settings changed significantly, will regenerate on next refresh",
              { caloriesChanged, proteinsChanged, fatsChanged, carbsChanged }
            );
            setUserSettingsChanged(true);
          }
        }
      },
      (error) => {
        console.error("❌ PROFILE: Error listening to user profile:", error);
      }
    );

    return () => unsubscribeProfile();
  }, [db, userId]);

  // 4. Расчет целевого КБЖУ
  useEffect(() => {
    const dailyCalories = userData.dailyCalories;

    const targetProteins = Math.round(
      (dailyCalories * TARGET_KBRU_RATIOS.protein) / 4
    );
    const targetFats = Math.round((dailyCalories * TARGET_KBRU_RATIOS.fat) / 9);
    const targetCarbs = Math.round(
      (dailyCalories * TARGET_KBRU_RATIOS.carb) / 4
    );

    setTargetKBRU({
      proteins: targetProteins,
      fats: targetFats,
      carbohydrates: targetCarbs,
    });
  }, [userData.dailyCalories]);

  // 5. Функция обновления состояния приема пищи
  const updateMealState = useCallback(
    async (mealId: string, updates: Partial<Meal>) => {
      if (!userId || !db) return;

      try {
        const mealIndex = meals.findIndex((m) => m.id === mealId);
        if (mealIndex === -1) return;

        const updatedMeals = [...meals];
        updatedMeals[mealIndex] = { ...updatedMeals[mealIndex], ...updates };
        setMeals(updatedMeals);

        const newConsumedCalories = updatedMeals
          .filter((meal) => meal.marked)
          .reduce((sum, meal) => sum + meal.calories, 0);

        setUserData((prev) => ({
          ...prev,
          consumedCalories: newConsumedCalories,
        }));

        if (updates.marked !== undefined) {
          await dailyRationService.updateMealStatus(
            userId,
            new Date(),
            mealId,
            { marked: updates.marked }
          );
        }
      } catch (error) {
        console.error("❌ Error updating meal state:", error);
      }
    },
    [userId, db, meals]
  );

  // Оптимизированная функция для избранного
  const toggleRecipeFavorite = useCallback(
    async (mealId: string, recipeId?: string) => {
      if (!userId || isUpdatingBookmark) {
        return;
      }

      const actualRecipeId = recipeId || mealId;
      if (!actualRecipeId) return;

      setIsUpdatingBookmark(mealId);

      try {
        // Оптимистичное обновление UI
        const mealIndex = meals.findIndex((m) => m.id === mealId);
        if (mealIndex === -1) return;

        const isCurrentlyBookmarked = meals[mealIndex].bookmarked;
        const updatedMeals = [...meals];
        updatedMeals[mealIndex] = {
          ...updatedMeals[mealIndex],
          bookmarked: !isCurrentlyBookmarked,
        };
        setMeals(updatedMeals);

        // Асинхронно обновляем в базе
        setTimeout(async () => {
          try {
            if (isCurrentlyBookmarked) {
              await favoriteService.removeFromFavorites(
                actualRecipeId,
                "recipe",
                userId
              );
            } else {
              await favoriteService.addToFavorites(
                actualRecipeId,
                "recipe",
                userId
              );
            }
          } catch (error) {
            console.error("Ошибка обновления избранного:", error);
            // Откатываем изменения при ошибке
            const revertedMeals = [...updatedMeals];
            revertedMeals[mealIndex] = {
              ...revertedMeals[mealIndex],
              bookmarked: isCurrentlyBookmarked,
            };
            setMeals(revertedMeals);
          } finally {
            setIsUpdatingBookmark(null);
          }
        }, 0);
      } catch (error) {
        console.error("Ошибка обновления избранного:", error);
        setIsUpdatingBookmark(null);
      }
    },
    [userId, meals, isUpdatingBookmark]
  );

  // Функция для сохранения дневного рациона как шаблона
  const saveDailyPlanAsTemplate = useCallback(async () => {
    if (!userId || meals.length === 0) {
      Alert.alert("Ошибка", "Нет данных для сохранения");
      return;
    }

    try {
      setIsSaving(true);

      const today = new Date().toISOString().split("T")[0];
      const templateData: any = {
        title: `Рацион на ${today}`,
        description: `Сохраненный дневной рацион от ${new Date().toLocaleDateString(
          "ru-RU"
        )}`,
        type: "daily",
        days: [
          {
            day: 1,
            meals: meals.map((meal) => ({
              id: meal.id,
              recipeId: meal.recipeId || meal.id,
              name: meal.name,
              category: meal.category,
              calories: meal.calories,
              proteins: meal.proteins,
              fats: meal.fats,
              carbohydrates: meal.carbohydrates,
              weight: meal.weight,
              cookingTime: meal.cookingTime,
              difficultyLevel: meal.difficultyLevel || "Легко",
              imageUrl: meal.image?.uri || null,
              bookmarked: meal.bookmarked,
              marked: meal.marked,
              isCustom: meal.isCustom || false,
            })),
            stats: {
              totalCalories: meals.reduce(
                (sum, meal) => sum + meal.calories,
                0
              ),
              totalProteins: meals.reduce(
                (sum, meal) => sum + meal.proteins,
                0
              ),
              totalFats: meals.reduce((sum, meal) => sum + meal.fats, 0),
              totalCarbs: meals.reduce(
                (sum, meal) => sum + meal.carbohydrates,
                0
              ),
              totalCookingTime: meals.reduce((sum, meal) => {
                return sum + (meal.cookingTime || 20);
              }, 0),
            },
          },
        ],
        isTemplate: true,
        isDailyPlan: true,
        originalDate: today,
        category: "Общее",
        totalCalories: meals.reduce((sum, meal) => sum + meal.calories, 0),
        totalDuration: "1 день",
        mealsCount: meals.length,
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Проверяем, сохранял ли пользователь уже сегодня
      if (hasSavedToday && lastSaveDate === today && !hasUnsavedChanges) {
        // Предлагаем обновить существующий шаблон
        Alert.alert(
          "Обновить сохраненный рацион?",
          "Вы уже сохраняли рацион сегодня. Хотите обновить существующий шаблон новыми изменениями?",
          [
            {
              text: "Отмена",
              style: "cancel",
            },
            {
              text: "Обновить",
              onPress: async () => {
                try {
                  // Здесь нужно найти ID существующего шаблона и обновить его
                  // Пока просто создаем новый с пометкой "Обновленный"
                  const templateId = await rationPlanService.createRationPlan(
                    userId,
                    {
                      ...templateData,
                      title: `Рацион на ${today} (Обновленный)`,
                    }
                  );

                  if (db) {
                    await setDoc(
                      doc(db, `users/${userId}`),
                      {
                        lastDailyPlanSave: today,
                        lastDailyPlanUpdate: new Date().toISOString(),
                      },
                      { merge: true }
                    );
                  }

                  setHasSavedToday(true);
                  setOriginalMeals([...meals]);

                  Alert.alert(
                    "Успех!",
                    "Дневной рацион обновлен. Вы можете найти его в разделе 'Мои планы'.",
                    [
                      {
                        text: "Продолжить",
                        style: "default",
                      },
                      {
                        text: "Посмотреть",
                        onPress: () => router.push("/saved-plans"),
                      },
                    ]
                  );
                } catch (error: any) {
                  console.error("Ошибка обновления шаблона:", error);
                  Alert.alert("Ошибка", error.message || "Не удалось обновить шаблон");
                }
              },
            },
            {
              text: "Сохранить как новый",
              onPress: async () => {
                try {
                  const templateId = await rationPlanService.createRationPlan(
                    userId,
                    {
                      ...templateData,
                      title: `Рацион на ${today} (Измененный)`,
                    }
                  );

                  if (db) {
                    await setDoc(
                      doc(db, `users/${userId}`),
                      {
                        lastDailyPlanSave: today,
                      },
                      { merge: true }
                    );
                  }

                  setHasSavedToday(true);
                  setLastSaveDate(today);
                  setOriginalMeals([...meals]);

                  Alert.alert(
                    "Успех!",
                    "Новый вариант дневного рациона сохранен. Вы можете найти его в разделе 'Мои планы'.",
                    [
                      {
                        text: "Продолжить",
                        style: "default",
                      },
                      {
                        text: "Посмотреть",
                        onPress: () => router.push("/saved-plans"),
                      },
                    ]
                  );
                } catch (error: any) {
                  console.error("Ошибка сохранения шаблона:", error);
                  Alert.alert("Ошибка", error.message || "Не удалось сохранить шаблон");
                }
              },
            },
          ]
        );
      } else {
        // Первое сохранение сегодня или есть изменения
        const templateId = await rationPlanService.createRationPlan(
          userId,
          templateData
        );

        if (db) {
          await setDoc(
            doc(db, `users/${userId}`),
            {
              lastDailyPlanSave: today,
            },
            { merge: true }
          );
        }

        setHasSavedToday(true);
        setLastSaveDate(today);
        setOriginalMeals([...meals]);

        Alert.alert(
          "Успех!",
          "Дневной рацион сохранен как шаблон. Вы можете найти его в разделе 'Мои планы'.",
          [
            {
              text: "Продолжить",
              style: "default",
            },
            {
              text: "Посмотреть",
              onPress: () => router.push("/saved-plans"),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error("Ошибка сохранения шаблона:", error);
      Alert.alert("Ошибка", error.message || "Не удалось сохранить шаблон");
    } finally {
      setIsSaving(false);
    }
  }, [userId, meals, hasSavedToday, lastSaveDate, hasUnsavedChanges, db, router]);

  // 6. Обработчики UI
  const handleToggleMeal = useCallback(
    (mealId: string) => {
      const meal = meals.find((m) => m.id === mealId);
      if (meal) {
        updateMealState(mealId, { marked: !meal.marked });
      }
    },
    [meals, updateMealState]
  );

  const handleToggleBookmark = useCallback(
    (mealId: string) => {
      const meal = meals.find((m) => m.id === mealId);
      if (meal) {
        toggleRecipeFavorite(mealId, meal.recipeId);
      }
    },
    [meals, toggleRecipeFavorite]
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
    } as any;

    router.push({
      pathname: "/meal",
      params,
    });
  };

  const navigateToProfile = () => {
    if (userId) {
      router.push("/profile");
    }
  };

  const handleAddRecipePress = () => {
    setShowAddRecipeModal(true);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // При обновлении загружаем существующий план, НЕ создаем новый
    loadDailyPlan(false); // false = не регенерировать, просто загрузить
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

  // Модальное окно выбора категории
  const CategoryModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showCategoryModal}
      onRequestClose={() => {
        setShowCategoryModal(false);
        setPendingRecipe(null);
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Выберите категорию</Text>
            <TouchableOpacity
              onPress={() => {
                setShowCategoryModal(false);
                setPendingRecipe(null);
              }}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.categoryModalContent}>
            <Text style={styles.modalText}>
              Выберите категорию для рецепта "
              {pendingRecipe?.title || "Новый рецепт"}"
            </Text>

            {["Завтрак", "Обед", "Ужин", "Перекусы"].map((category) => (
              <TouchableOpacity
                key={category}
                style={styles.categoryOption}
                onPress={() => addRecipeToPlan(pendingRecipe, category)}
              >
                <Ionicons
                  name={getCategoryIcon(category) as any}
                  size={24}
                  color="#6A9AA9"
                />
                <Text style={styles.categoryOptionText}>{category}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  // 8. Обработка пустого состояния
  if (loading || isGeneratingPlan) {
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
    (userData.consumedCalories / dailyTargetForDisplay) * 100
  );
  const remainingCalories = Math.max(
    0,
    dailyTargetForDisplay - userData.consumedCalories
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

            {/* Кнопка сохранения дневного рациона как шаблона */}
            <TouchableOpacity
              style={[
                styles.saveDailyPlanButton,
                hasSavedToday && !hasUnsavedChanges && styles.saveDailyPlanButtonDisabled,
                isSaving && styles.saveDailyPlanButtonSaving,
                hasUnsavedChanges && styles.saveDailyPlanButtonChanged,
              ]}
              onPress={saveDailyPlanAsTemplate}
              activeOpacity={0.7}
              disabled={(hasSavedToday && !hasUnsavedChanges) || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#6A9AA9" />
              ) : (
                <>
                  <Ionicons
                    name={
                      hasSavedToday && !hasUnsavedChanges 
                        ? "checkmark-circle" 
                        : hasUnsavedChanges 
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
                      hasSavedToday && !hasUnsavedChanges && styles.saveDailyPlanTextDisabled,
                      hasUnsavedChanges && styles.saveDailyPlanTextChanged,
                    ]}
                  >
                    {hasSavedToday && !hasUnsavedChanges
                      ? "Сохранено сегодня"
                      : hasUnsavedChanges
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

          {/* Заголовок приемов пищи с кнопкой добавления рецепта справа */}
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

          {/* Приемы пищи */}
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

                      {/* Бэдж сложности в ВЕРХНЕМ ЛЕВОМ углу */}
                      <DifficultyBadge difficulty={meal.difficultyLevel} />

                      {/* Кнопка избранного в ВЕРХНЕМ ПРАВОМ углу */}
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
                          color={meal.bookmarked ? "#6A9AA9" : "#6A9AA9"}
                        />
                      </TouchableOpacity>

                      {/* Кнопка удаления для кастомных рецептов - ВНИЗУ СПРАВА */}
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

                      {/* Рейтинг в ВЕРХНЕМ ЛЕВОМ углу (под бэджем сложности) */}
                      {meal.rating && meal.rating > 0 ? (
                        <View style={styles.ratingBadge}>
                          <FontAwesome name="star" size={10} color="#FFD700" />
                          <Text style={styles.ratingText}>
                            {meal.rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : null}

                      {/* Индикатор кастомного рецепта - ВНИЗУ СЛЕВА */}
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

      {/* Модальное окно добавления рецепта */}
      <AddRecipeModal />

      {/* Модальное окно выбора категории */}
      <CategoryModal />
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
  // Стили для модального окна
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
  categoryModalContent: {
    padding: 20,
    alignItems: "center",
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    width: "100%",
  },
  categoryOptionText: {
    fontSize: 16,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Regular",
    marginLeft: 12,
    flex: 1,
  },
});