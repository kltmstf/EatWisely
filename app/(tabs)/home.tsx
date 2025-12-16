import { useRouter } from "expo-router";
import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
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
} from "react-native";
import { getAuth, onAuthStateChanged, Auth } from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  getDoc,
  Firestore,
  setLogLevel,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { getApp, getApps, initializeApp } from "firebase/app";
import { Ionicons, FontAwesome, MaterialIcons } from "@expo/vector-icons";

// ИМПОРТ СЕРВИСОВ
import { recipeService } from "../services/recipeService";

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
  cookingTime?: string;
  difficultyLevel?: string;
  rating?: number;
}

interface RecipeData {
  id: string;
  title: string;
  mealType: string;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  weight: string;
  imageUrl?: string;
  cookingTime?: number;
  difficultyLevel?: string;
  rating?: number;
}

interface UserDataState {
  userName: string;
  dailyCalories: number;
  consumedCalories: number;
}

interface KBRUState {
  proteins: number;
  fats: number;
  carbohydrates: number;
}

const MEAL_DISTRIBUTION = {
  Завтрак: 0.2,
  Обед: 0.35,
  Ужин: 0.35,
  Перекусы: 0.1,
};

const TARGET_KBRU_RATIOS = {
  protein: 0.3,
  fat: 0.3,
  carb: 0.4,
};

const DEFAULT_MEAL_IMAGE = require("@/assets/images/logo.png");

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 56) / 2; // (Ширина экрана - 20*2 padding - 16 gap)/2

// Функция для склонения минут
const formatMinutes = (minutes: number): string => {
  const absMinutes = Math.abs(minutes);
  const lastDigit = absMinutes % 10;
  const lastTwoDigits = absMinutes % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${absMinutes} минут`;
  if (lastDigit === 1) return `${absMinutes} минута`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${absMinutes} минуты`;
  return `${absMinutes} минут`;
};

// Функция для цвета сложности
const getDifficultyColor = (difficulty: string | undefined) => {
  switch (difficulty?.trim()) {
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

// --- АЛГОРИТМ ГЕНЕРАЦИИ РАЦИОНА ---

const generateDailyPlan = (
  dailyCalories: number,
  recipeDatabase: RecipeData[]
): Meal[] => {
  const plannedMeals: Meal[] = [];
  const categories = Object.keys(MEAL_DISTRIBUTION);

  categories.forEach((category) => {
    const targetCalories =
      Math.round(dailyCalories) *
      (MEAL_DISTRIBUTION[category as keyof typeof MEAL_DISTRIBUTION] || 0);

    const mealsInCategory = recipeDatabase.filter(
      (m) => m.mealType === category
    );

    if (mealsInCategory.length === 0) {
      plannedMeals.push({
        id: "default-" + category,
        category: category,
        name: "Рецепты не найдены",
        calories: 0,
        proteins: 0,
        fats: 0,
        carbohydrates: 0,
        weight: "0 гр.",
        marked: false,
        bookmarked: false,
        image: DEFAULT_MEAL_IMAGE,
      });
      return;
    }

    const bestMatch = mealsInCategory.reduce((best, current) => {
      const currentDiff = Math.abs(current.calories - targetCalories);
      const bestDiff = Math.abs(best.calories - targetCalories);
      if (currentDiff === bestDiff) {
        return Math.random() > 0.5 ? current : best;
      }
      return currentDiff < bestDiff ? current : best;
    }, mealsInCategory[0]);

    if (bestMatch) {

  const difficultyValue = bestMatch.difficultyLevel || "Легко";
  
  plannedMeals.push({
    id: bestMatch.id,
    category: bestMatch.mealType,
    name: bestMatch.title,
    calories: Math.round(bestMatch.calories),
    proteins: Math.round(bestMatch.proteins),
    fats: Math.round(bestMatch.fats),
    carbohydrates: Math.round(bestMatch.carbohydrates),
    weight: bestMatch.weight || "300 гр.",
    marked: false,
    bookmarked: false,
    cookingTime: bestMatch.cookingTime ? `${bestMatch.cookingTime} минут` : "20 минут",
    difficultyLevel: difficultyValue, 
    rating: bestMatch.rating || 0,
    image: bestMatch.imageUrl
      ? { uri: bestMatch.imageUrl }
      : DEFAULT_MEAL_IMAGE,
  });
}
  });

  return plannedMeals;
};

// --- КОМПОНЕНТ HOME ---

export default function Home() {
  const router = useRouter();

  const [db, setDb] = useState<Firestore | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appId] = useState(() =>
    typeof __app_id !== "undefined" ? __app_id : "default-app-id"
  );

  const [recipeDatabase, setRecipeDatabase] = useState<RecipeData[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);

  const mealsRef = useRef(meals);
  useEffect(() => {
    mealsRef.current = meals;
  }, [meals]);

  const [userData, setUserData] = useState<UserDataState>({
    userName: "Пользователь",
    dailyCalories: 2000,
    consumedCalories: 0,
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

  const loading = !isAuthReady || !db || recipeDatabase.length === 0;

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
          console.log("✅ AUTH: User authenticated. UID:", user.uid);
        } else {
          setUserId(null);
          userData.dailyCalories = 2000;
          setUserData((prev) => ({
            ...prev,
            userName: "Пользователь",
            dailyCalories: 2000,
          }));
          console.log("⚠️ AUTH: User is NOT authenticated (UID is null).");
        }
        setIsAuthReady(true);
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error("❌ INIT: Ошибка инициализации Firebase:", error);
      setIsAuthReady(true);
    }
  }, []);

  // 2. Загрузка рецептов
  useEffect(() => {
    if (!userId) {
      setRecipeDatabase([]);
      return;
    }

    const loadRecipes = async () => {
      try {
        const recipes = await recipeService.getRecipesForPlanner();
        setRecipeDatabase(recipes as RecipeData[]);
        console.log(`✅ RECIPES: Loaded ${recipes.length} recipes.`);
      } catch (error) {
        console.error(
          "❌ RECIPES: Ошибка загрузки рецептов для планировщика:",
          error
        );
        setRecipeDatabase([]);
      }
    };

    loadRecipes();
  }, [userId]);

  // 3. Расчет плана
  const generatedPlan = useMemo(() => {
    if (recipeDatabase.length === 0) {
      return {
        plan: [],
        totalKBRU: { proteins: 0, fats: 0, carbohydrates: 0 },
      };
    }

    const plan = generateDailyPlan(userData.dailyCalories, recipeDatabase);

    const totalKBRU = plan.reduce(
      (acc, meal) => ({
        proteins: acc.proteins + meal.proteins,
        fats: acc.fats + meal.fats,
        carbohydrates: acc.carbohydrates + meal.carbohydrates,
      }),
      { proteins: 0, fats: 0, carbohydrates: 0 }
    );

    return { plan, totalKBRU };
  }, [userData.dailyCalories, recipeDatabase]);

  // 4. Установка КБЖУ и плана
  useEffect(() => {
    const dailyCaloriesRoundedToNearestHundred =
      Math.round(userData.dailyCalories / 100) * 100;

    const targetProteins = Math.round(
      (dailyCaloriesRoundedToNearestHundred * TARGET_KBRU_RATIOS.protein) / 4
    );
    const targetFats = Math.round(
      (dailyCaloriesRoundedToNearestHundred * TARGET_KBRU_RATIOS.fat) / 9
    );
    const targetCarbs = Math.round(
      (dailyCaloriesRoundedToNearestHundred * TARGET_KBRU_RATIOS.carb) / 4
    );

    setTargetKBRU({
      proteins: targetProteins,
      fats: targetFats,
      carbohydrates: targetCarbs,
    });

    setRecommendedKBRU(generatedPlan.totalKBRU);
    setMeals(generatedPlan.plan);
  }, [userData.dailyCalories, generatedPlan]);

  // 5. Прослушивание данных пользователя
  useEffect(() => {
    if (!db || !userId) {
      return;
    }

    const userDocRef = doc(db, `users/${userId}`);

    const unsubscribeProfile = onSnapshot(
      userDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as any;

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

          setUserData((prev) => ({
            ...prev,
            userName: currentName,
            dailyCalories: currentCalories,
          }));
        } else {
          const defaultData = {
            firstName: "Пользователь",
            dailyCalories: 2000,
            initialized: true,
          };

          await setDoc(userDocRef, defaultData, { merge: true }).catch((err) =>
            console.error(
              "❌ PROFILE: Error setting default user profile:",
              err
            )
          );
          setUserData((prev) => ({
            ...prev,
            userName: defaultData.firstName,
            dailyCalories: defaultData.dailyCalories,
          }));
        }
      },
      (error) => {
        console.error("❌ PROFILE: Error listening to user profile:", error);
        setUserData((prev) => ({
          ...prev,
          userName: "Ошибка",
          dailyCalories: 2000,
        }));
      }
    );

    return () => unsubscribeProfile();
  }, [db, userId]);

  // 6. Прослушивание ежедневного журнала
  useEffect(() => {
    if (!db || !userId || generatedPlan.plan.length === 0) {
      setUserData((prev) => ({ ...prev, consumedCalories: 0 }));
      return;
    }

    const dailyLogDocRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/ration_plan_days/today`
    );

    const unsubscribeLog = onSnapshot(
      dailyLogDocRef,
      async (docSnap) => {
        const firebaseMealsState = docSnap.exists()
          ? docSnap.data()?.meals || []
          : [];
        let newConsumedCalories = 0;
        const currentGeneratedPlan = generatedPlan.plan;

        const updatedMeals = currentGeneratedPlan.map((currentMeal) => {
          const firebaseState = firebaseMealsState.find(
            (fm: any) => fm.category === currentMeal.category
          );

          const marked = firebaseState?.marked ?? false;

          if (marked) {
            newConsumedCalories += currentMeal.calories;
          }

          return {
            ...currentMeal,
            id: firebaseState?.id || currentMeal.id,
            marked: marked,
            bookmarked: firebaseState?.bookmarked ?? false,
          };
        });

        const roundedConsumedCalories = Math.round(newConsumedCalories);

        setMeals(updatedMeals);
        setUserData((prev) => ({
          ...prev,
          consumedCalories: roundedConsumedCalories,
        }));
      },
      (error) => {
        console.error("❌ LOG LISTEN: Error listening to daily log:", error);
      }
    );

    return () => unsubscribeLog();
  }, [db, userId, appId, generatedPlan]);

  // 7. Сохранение сгенерированного плана
  useEffect(() => {
    if (!db || !userId || generatedPlan.plan.length === 0) {
      if (generatedPlan.plan.length === 0 && userId) {
        console.log(
          "⚠️ PLAN INIT: Plan generation skipped. No recipes available."
        );
      }
      return;
    }

    const dailyLogDocRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/ration_plan_days/today`
    );

    const checkAndSavePlan = async () => {
      try {
        const docSnap = await getDoc(dailyLogDocRef);

        console.log("🔍 PLAN INIT: Checking path:", dailyLogDocRef.path);

        if (docSnap.exists()) {
          console.log(
            `🔍 PLAN INIT: Document exists. Initialized flag: ${
              docSnap.data()?.initialized
            }`
          );
        } else {
          console.log(
            "🔍 PLAN INIT: Document does NOT exist. Proceeding to save."
          );
        }

        if (!docSnap.exists() || docSnap.data()?.initialized !== true) {
          console.log("🔥 SAVE: Attempting to save generated plan (setDoc)...");

          const initialLogData = {
            consumedCalories: 0,
            meals: generatedPlan.plan.map((m) => ({
              id: m.id,
              category: m.category,
              marked: m.marked,
              bookmarked: m.bookmarked,
            })),
            initialized: true,
            createdAt: new Date().toISOString(),
          };
          await setDoc(dailyLogDocRef, initialLogData);
          console.log(
            "✅ SAVE: Generated plan successfully saved to Firestore."
          );
        } else {
          console.log(
            "💡 PLAN INIT: Plan already initialized for today. Skipping setDoc."
          );
        }
      } catch (error) {
        console.error(
          "❌ SAVE: FATAL ERROR checking or saving generated plan to Firebase:",
          error
        );
      }
    };
    checkAndSavePlan();
  }, [db, userId, appId, generatedPlan.plan.length]);

  // 8. Обновление состояния в Firebase
  const updateMealStateInFirebase = useCallback(
    async (index: number, field: "marked" | "bookmarked", value: boolean) => {
      if (!db || !userId) return;

      const dailyLogDocRef = doc(
        db,
        `artifacts/${appId}/users/${userId}/ration_plan_days/today`
      );

      const currentMeals = mealsRef.current;

      const updatedMealsArrayForCalc = currentMeals.map((meal, i) => {
        if (i === index) {
          return { ...meal, [field]: value };
        }
        return meal;
      });

      const newConsumedCalories = updatedMealsArrayForCalc
        .filter((m) => m.marked)
        .reduce((sum, m) => sum + m.calories, 0);

      const newConsumedCaloriesRounded = Math.round(newConsumedCalories);

      const firebaseUpdateArray = updatedMealsArrayForCalc.map((m) => ({
        id: m.id,
        category: m.category,
        marked: m.marked,
        bookmarked: m.bookmarked,
      }));

      try {
        console.log(
          `🔄 UPDATE: Attempting to update log (${field}: ${value}). Calories: ${newConsumedCaloriesRounded}`
        );
        await updateDoc(dailyLogDocRef, {
          meals: firebaseUpdateArray,
          consumedCalories: newConsumedCaloriesRounded,
        });
        console.log("✅ UPDATE: Log successfully updated.");
      } catch (error) {
        console.error(
          "❌ UPDATE: Error updating meal state in Firebase:",
          error
        );
      }
    },
    [db, userId, appId]
  );

  const toggleMeal = (index: number) => {
    const newValue = !meals[index].marked;
    updateMealStateInFirebase(index, "marked", newValue);
  };

  // ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ ИЗБРАННОГО (как на странице Recipes)
  const toggleBookmark = async (index: number) => {
    if (!userId) {
      Alert.alert("Ошибка", "Для добавления в избранное необходимо авторизоваться");
      return;
    }

    const meal = meals[index];
    const newValue = !meal.bookmarked;
    
    try {
      // 1. Обновляем локальное состояние
      const updatedMeals = [...meals];
      updatedMeals[index] = { ...updatedMeals[index], bookmarked: newValue };
      setMeals(updatedMeals);

      // 2. Обновляем в Firebase (как на странице Recipes)
      if (newValue) {
        // Добавление закладки - используем подход из Recipes
        if (!db) throw new Error("База данных не инициализирована");
        
        await setDoc(
          doc(db, "user_favorites", `${userId}_${meal.id}`),
          {
            userId: userId,
            recipeId: meal.id,
            favoriteType: 'recipe', // Добавляем поле для совместимости
            createdAt: new Date(),
            active: true,
          },
          { merge: true }
        );
        console.log(`✅ Рецепт "${meal.name}" (ID: ${meal.id}) добавлен в избранное`);
      } else {
        // Удаление закладки - используем подход из Recipes
        if (!db) throw new Error("База данных не инициализирована");
        
        const favoriteQuery = query(
          collection(db, "user_favorites"),
          where("userId", "==", userId),
          where("recipeId", "==", meal.id)
        );
        
        const favoriteSnapshot = await getDocs(favoriteQuery);
        if (!favoriteSnapshot.empty) {
          favoriteSnapshot.forEach(async (doc) => {
            await updateDoc(doc.ref, { active: false });
          });
          console.log(`❌ Рецепт "${meal.name}" (ID: ${meal.id}) удален из избранного`);
        }
      }

      // 3. Также обновляем в daily log
      updateMealStateInFirebase(index, "bookmarked", newValue);

    } catch (error: any) {
      console.error("Ошибка при обновлении избранного:", error);
      
      // Откатываем локальное состояние при ошибке
      const rollbackMeals = [...meals];
      rollbackMeals[index] = { ...rollbackMeals[index], bookmarked: !newValue };
      setMeals(rollbackMeals);
      
      Alert.alert("Ошибка", error.message || "Не удалось обновить избранное");
    }
  };

  const navigateToMealPage = (mealIndex: number) => {
    const meal = meals[mealIndex];
    router.push({
      pathname: "/meal",
      params: {
        mealId: meal.id,
        mealName: meal.name,
        category: meal.category,
        mealIndex: mealIndex.toString(),
        initialBookmarked: meal.bookmarked.toString(),
        calories: meal.calories.toString(),
        proteins: meal.proteins.toString(),
        fats: meal.fats.toString(),
        carbohydrates: meal.carbohydrates.toString(),
        weight: meal.weight,
        cookingTime: meal.cookingTime || "20 минут",
        difficultyLevel: meal.difficultyLevel || "Легко",
        rating: meal.rating?.toString() || "0",
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>
          Загрузка рецептов и генерация рациона...
        </Text>
      </View>
    );
  }

  const dailyTargetForDisplay = Math.round(userData.dailyCalories / 100) * 100;
  const progressPercentage =
    (userData.consumedCalories / dailyTargetForDisplay) * 100;

  const remainingCalories = userData.dailyCalories - userData.consumedCalories;

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

          <View style={styles.userInfo}>
            <Image
              source={require("@/assets/images/people-icon.png")}
              style={styles.profileImage}
            />
            <Text style={styles.userName}>
              {userData.userName || "Пользователь"}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Прогресс калорий и КБЖУ */}
          <View style={styles.caloriesSection}>
            <Text style={styles.caloriesTitle}>
              Цель на день:{" "}
              {dailyTargetForDisplay} ккал
            </Text>

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
                  { width: `${Math.min(100, progressPercentage)}%` },
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
                    { flex: 1, textAlign: "left", fontFamily: "Playfair Display Bold" },
                  ]}
                >
                  Цель (Ваша норма)
                </Text>
                <Text style={[styles.kbruValue, { fontFamily: "Playfair Display Bold" }]}>
                  {targetKBRU.proteins}
                </Text>
                <Text style={[styles.kbruValue, { fontFamily: "Playfair Display Bold" }]}>
                  {targetKBRU.fats}
                </Text>
                <Text style={[styles.kbruValue, { fontFamily: "Playfair Display Bold" }]}>
                  {targetKBRU.carbohydrates}
                </Text>
              </View>
            </View>

            <View style={styles.sectionDivider} />
          </View>

          {/* Приемы пищи - ОБНОВЛЕННАЯ ВЕРСИЯ (как на странице Recipes) */}
          <View style={styles.mealsSection}>
            <View style={styles.recipesGrid}>
              {meals.map((meal, mealIndex) => (
                <View key={mealIndex} style={styles.recipeColumn}>
                  <TouchableOpacity
                    style={styles.recipeCard}
                    onPress={() => navigateToMealPage(mealIndex)}
                  >
                    <View style={styles.imageContainer}>
                      <Image
                        source={meal.image}
                        style={styles.recipeImage}
                        resizeMode="cover"
                      />
                      
                      {/* Бейджи рейтинга и сложности как в Recipes */}
                      <View style={styles.recipeBadges}>
                        {meal.rating && meal.rating > 0 ? (
                          <View style={styles.ratingBadge}>
                            <FontAwesome name="star" size={10} color="#FFD700" />
                            <Text style={styles.ratingText}>
                              {meal.rating.toFixed(1)}
                            </Text>
                          </View>
                        ) : null}
                        <View
                          style={[
                            styles.difficultyBadge,
                            {
                              backgroundColor: getDifficultyColor(meal.difficultyLevel),
                            },
                          ]}
                        >
                          <Text style={styles.difficultyText}>
                            {meal.difficultyLevel || "Легко"}
                          </Text>
                        </View>
                      </View>
                      
                      {/* Кнопка закладки */}
                      <TouchableOpacity
                        style={styles.bookmarkButton}
                        onPress={() => toggleBookmark(mealIndex)}
                      >
                        <Ionicons
                          name={meal.bookmarked ? "bookmark" : "bookmark-outline"}
                          size={18}
                          color="#6A9AA9"
                        />
                      </TouchableOpacity>
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
                        
                        {/* Категория */}
                        <Text style={styles.recipeCategory}>
                          {meal.category}
                        </Text>
                        
                        <View style={styles.recipeDetails}>
                          {/* Калории */}
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
                            {formatMinutes(parseInt(meal.cookingTime?.match(/\d+/)?.[0] || "20"))}
                          </Text>
                        </View>
                      </View>
                      
                      <TouchableOpacity
                        style={[
                          styles.markButton,
                          meal.marked && styles.markButtonActive,
                        ]}
                        onPress={() => toggleMeal(mealIndex)}
                      >
                        {meal.marked ? (
                          <Image
                            source={require("@/assets/images/checkmark-done.png")}
                            style={styles.checkmarkIcon}
                          />
                        ) : (
                          <Text style={styles.markButtonText}>
                            Отметить
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
  profileImage: {
    width: 55,
    height: 55,
    borderRadius: 25,
  },
  userName: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginTop: 4,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  caloriesSection: {
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginBottom: 1,
  },
  caloriesTitle: {
    fontSize: 16,
    color: "#000000ff",
    marginBottom: 12,
    fontFamily: "Playfair Display Regular",
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
  mealsSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 20,
    paddingBottom: 20,
  },
  // Новые стили для карточек как в Recipes
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    height: 280,
    borderWidth: 1,
    borderColor: "#A8C8D4",
  },
  imageContainer: {
    position: "relative",
  },
  recipeImage: {
    width: "100%",
    height: 120,
  },
  recipeBadges: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "column",
    gap: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratingText: {
    fontSize: 10,
    color: "#000000",
    fontFamily: "Playfair Display Bold",
    marginLeft: 2,
  },
  difficultyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 9,
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
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
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
});