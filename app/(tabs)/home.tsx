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
} from "firebase/firestore";
import { getApp, getApps, initializeApp } from "firebase/app";

// 1. ИМПОРТ РЕАЛЬНОГО СЕРВИСА
import { recipeService } from "../services/recipeService";

setLogLevel("debug");

// --- ТИПИЗАЦИЯ И КОНСТАНТЫ ---

interface Meal {
  id: string; // ID рецепта из Firebase
  category: string; // mealType
  name: string; // title
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  weight: string;
  marked: boolean;
  bookmarked: boolean;
  image: any; // URL или локальный ресурс
}

// Минимальная структура рецепта, возвращаемая из сервиса
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
}

interface UserDataState {
  userName: string;
  dailyCalories: number; // Хранит целое число (1394), округление до 100 происходит только для отображения
  consumedCalories: number;
}

interface KBRUState {
  proteins: number;
  fats: number;
  carbohydrates: number;
}

// Целевое распределение калорий по приемам пищи
const MEAL_DISTRIBUTION = {
  Завтрак: 0.2,
  Обед: 0.35,
  Ужин: 0.35,
  Перекусы: 0.1,
};

// Целевое распределение КБЖУ (например: 30% Белки, 30% Жиры, 40% Углеводы)
const TARGET_KBRU_RATIOS = {
  protein: 0.3,
  fat: 0.3,
  carb: 0.4,
};

// Заглушка для изображений, если в рецепте нет imageUrl
const DEFAULT_MEAL_IMAGE = require("@/assets/images/logo.png");

// --- АЛГОРИТМ ГЕНЕРАЦИИ РАЦИОНА ---

/**
 * Генерирует суточный рацион, используя реальные рецепты из базы.
 * @param dailyCalories - Целевые калории пользователя (целое число, не округленное до 100).
 * @param recipeDatabase - Массив RecipeData из Firebase.
 * @returns Массив подобранных блюд.
 */
const generateDailyPlan = (
  dailyCalories: number,
  recipeDatabase: RecipeData[]
): Meal[] => {
  const plannedMeals: Meal[] = [];
  const categories = Object.keys(MEAL_DISTRIBUTION);

  categories.forEach((category) => {
    // Используем Math.round(dailyCalories) для расчета целевых калорий на прием пищи
    const targetCalories =
      Math.round(dailyCalories) *
      (MEAL_DISTRIBUTION[category as keyof typeof MEAL_DISTRIBUTION] || 0);

    // Фильтруем рецепты по типу приема пищи
    const mealsInCategory = recipeDatabase.filter(
      (m) => m.mealType === category
    );

    if (mealsInCategory.length === 0) {
      // Добавляем заглушку, если рецептов нет
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

    // Алгоритм выбора: ищем блюдо, калорийность которого ближе всего к целевой
    const bestMatch = mealsInCategory.reduce((best, current) => {
      const currentDiff = Math.abs(current.calories - targetCalories);
      const bestDiff = Math.abs(best.calories - targetCalories);
      // Если разница одинакова, выбираем случайное, чтобы избежать повторяемости
      if (currentDiff === bestDiff) {
        return Math.random() > 0.5 ? current : best;
      }
      return currentDiff < bestDiff ? current : best;
    }, mealsInCategory[0]);

    if (bestMatch) {
      plannedMeals.push({
        id: bestMatch.id,
        category: bestMatch.mealType, // Используем mealType как category
        name: bestMatch.title, // Используем title как name
        calories: Math.round(bestMatch.calories), // Округляем калории рецепта
        proteins: Math.round(bestMatch.proteins), // Округляем БЖУ рецепта
        fats: Math.round(bestMatch.fats),
        carbohydrates: Math.round(bestMatch.carbohydrates),
        weight: bestMatch.weight || "300 гр.",
        marked: false,
        bookmarked: false,
        // Если есть imageUrl, используем его, иначе - заглушку
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

  // --- СОСТОЯНИЕ FIREBASE ---
  const [db, setDb] = useState<Firestore | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appId] = useState(() =>
    typeof __app_id !== "undefined" ? __app_id : "default-app-id"
  );

  // --- НОВЫЕ СОСТОЯНИЯ ---
  const [recipeDatabase, setRecipeDatabase] = useState<RecipeData[]>([]); // База рецептов из Firebase

  // --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
  const [meals, setMeals] = useState<Meal[]>([]);

  
  const mealsRef = useRef(meals);
  useEffect(() => {
    mealsRef.current = meals;
  }, [meals]);
  // 🛑 КОНЕЦ ИСПРАВЛЕНИЯ Ref

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
  // Добавлено состояние для целевого КБЖУ (для отображения в прогресс-баре)
  const [targetKBRU, setTargetKBRU] = useState<KBRUState>({
    proteins: 0,
    fats: 0,
    carbohydrates: 0,
  });

  // Скорректировано условие загрузки: достаточно, что аутентификация и база инициализированы.
  const loading = !isAuthReady || !db || recipeDatabase.length === 0;

  // 1. Инициализация Firebase и Отслеживание Аутентификации (ДОБАВЛЕНО ЛОГИРОВАНИЕ)
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
          // 🚀 ЛОГ 1: УСПЕШНАЯ АУТЕНТИФИКАЦИЯ
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

  // 2. ЗАГРУЗКА РЕЦЕПТОВ ДЛЯ ПЛАНИРОВЩИКА (ДОБАВЛЕНО ЛОГИРОВАНИЕ)
  useEffect(() => {
    // Загрузка происходит, как только userId становится доступен (после isAuthReady)
    if (!userId) {
      setRecipeDatabase([]);
      return;
    }

    const loadRecipes = async () => {
      try {
        const recipes = await recipeService.getRecipesForPlanner();
        setRecipeDatabase(recipes as RecipeData[]);
        // 🚀 ЛОГ 2: КОЛИЧЕСТВО ЗАГРУЖЕННЫХ РЕЦЕПТОВ
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

  // 3. Расчет плана и КБЖУ на основе ЦЕЛЕВЫХ КАЛОРИЙ и БАЗЫ РЕЦЕПТОВ (useMemo)
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

  // 4. Установка КБЖУ и Плана в локальный стейт
  useEffect(() => {
    // 1. Расчет Целевого КБЖУ в граммах (для отображения)
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

    // 2. Установка фактического КБЖУ из сгенерированного плана
    setRecommendedKBRU(generatedPlan.totalKBRU);
    // 3. Установка сгенерированного плана
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

  // 6. Прослушивание ежедневного журнала (ОБНОВЛЕНО: теперь берет ID из Firebase)
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
            // 🛑 ОБНОВЛЕНИЕ: Берем ID рецепта из Firebase, если он там есть
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

  // 7. НОВЫЙ useEffect: СОХРАНЕНИЕ СГЕНЕРИРОВАННОГО ПЛАНА В FIREBASE (ОДИН РАЗ В ДЕНЬ) (ОБНОВЛЕНО: добавлено ID)
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
              // 🛑 ОБНОВЛЕНИЕ: ДОБАВЛЯЕМ ID РЕЦЕПТА!
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
        // Ошибка 403 (Permission Denied) будет поймана здесь!
        console.error(
          "❌ SAVE: FATAL ERROR checking or saving generated plan to Firebase:",
          error
        );
      }
    };
    checkAndSavePlan();
  }, [db, userId, appId, generatedPlan.plan.length]);

  // 8. Обновление логики Firebase для динамического рациона (ОБНОВЛЕНО: useRef и удалена зависимость meals)
  const updateMealStateInFirebase = useCallback(
    async (index: number, field: "marked" | "bookmarked", value: boolean) => {
      if (!db || !userId) return;

      const dailyLogDocRef = doc(
        db,
        `artifacts/${appId}/users/${userId}/ration_plan_days/today`
      );

      // 🛑 ИСПОЛЬЗУЕМ Ref: Получаем актуальное состояние meals
      const currentMeals = mealsRef.current;

      // Локальный расчет нового состояния meals
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
        // 🛑 ОБНОВЛЕНИЕ: ДОБАВЛЯЕМ ID РЕЦЕПТА!
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
        // Ошибка 403 (Permission Denied) или "Document Does Not Exist" будет поймана здесь!
        console.error(
          "❌ UPDATE: Error updating meal state in Firebase:",
          error
        );
      }
      // 🛑 ИСПРАВЛЕНИЕ: Удалена зависимость meals, используется mealsRef
    },
    [db, userId, appId]
  );

  const toggleMeal = (index: number) => {
    const newValue = !meals[index].marked;
    updateMealStateInFirebase(index, "marked", newValue);
  };

  const toggleBookmark = (index: number) => {
    const newValue = !meals[index].bookmarked;
    updateMealStateInFirebase(index, "bookmarked", newValue);
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

  // Цель для прогресс-бара
  const dailyTargetForDisplay = Math.round(userData.dailyCalories / 100) * 100;
  const progressPercentage =
    (userData.consumedCalories / dailyTargetForDisplay) * 100;

  // Расчет оставшихся калорий
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
            {/* Отображаем полное имя */}
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
              {
                // ОКРУГЛЕНИЕ ЦЕЛИ до ближайшей СОТНИ для отображения
                dailyTargetForDisplay
              }{" "}
              ккал
            </Text>

            {/* Секция с оставшимися калориями */}
            <View style={styles.remainingCaloriesContainer}>
              <Text style={styles.remainingCaloriesLabel}>Осталось:</Text>
              <Text style={styles.remainingCaloriesValue}>
                {/* Остаток округляется до ближайшей сотни для лучшей читаемости */}
                {Math.round(remainingCalories / 100) * 100} ккал
              </Text>
            </View>

            {/* Прогресс-бар */}
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, progressPercentage)}%` },
                ]}
              />
            </View>

            {/* Отображение КБЖУ (РАЗДЕЛЕННЫЕ ПЛАН И ЦЕЛЬ) */}
            <View style={styles.kbruContainer}>
              {/* HEADER ROW */}
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

              {/* PLAN ROW */}
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

              {/* TARGET ROW */}
              <View style={[styles.kbruRow, styles.targetKBRURow]}>
                <Text
                  style={[
                    styles.kbruLabel,
                    { flex: 1, textAlign: "left", fontWeight: "bold" },
                  ]}
                >
                  Цель (Ваша норма)
                </Text>
                <Text style={[styles.kbruValue, { fontWeight: "bold" }]}>
                  {targetKBRU.proteins}
                </Text>
                <Text style={[styles.kbruValue, { fontWeight: "bold" }]}>
                  {targetKBRU.fats}
                </Text>
                <Text style={[styles.kbruValue, { fontWeight: "bold" }]}>
                  {targetKBRU.carbohydrates}
                </Text>
              </View>
            </View>

            <View style={styles.sectionDivider} />
          </View>

          {/* Приемы пищи в виде таблицы 2x2 (ДИНАМИЧЕСКИЙ РАЦИОН) */}
          <View style={styles.mealsSection}>
            {[0, 2].map((startIndex, rowIndex) => (
              <View key={rowIndex} style={styles.mealRow}>
                {meals
                  .slice(startIndex, startIndex + 2)
                  .map((meal, indexInRow) => {
                    const mealIndex = startIndex + indexInRow;
                    return (
                      <View key={mealIndex} style={styles.mealColumn}>
                        <TouchableOpacity
                          style={styles.mealCategoryHeader}
                          onPress={() => navigateToMealPage(mealIndex)}
                        >
                          <Text style={styles.mealCategoryTitle}>
                            {meal.category}
                          </Text>
                          <Image
                            source={require("@/assets/images/arrow-right.png")}
                            style={styles.arrowIcon}
                          />
                        </TouchableOpacity>
                        <View style={styles.mealCard}>
                          <View style={styles.imageContainer}>
                            <Image
                              source={meal.image}
                              style={styles.mealImage}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={styles.bookmarkButton}
                              onPress={() => toggleBookmark(mealIndex)}
                            >
                              <Image
                                source={
                                  meal.bookmarked
                                    ? require("@/assets/images/bookmark-filled.png")
                                    : require("@/assets/images/bookmark-outline.png")
                                }
                                style={styles.bookmarkIcon}
                              />
                            </TouchableOpacity>
                          </View>
                          <View style={styles.mealContent}>
                            <View style={styles.mealInfo}>
                              <Text
                                style={styles.mealName}
                                numberOfLines={2}
                                ellipsizeMode="tail"
                              >
                                {meal.name}
                              </Text>
                              <View style={styles.mealDetails}>
                                <Text style={styles.mealCalories}>
                                  {meal.calories} ккал
                                </Text>
                                <Text style={styles.mealWeight}>
                                  • {meal.weight}
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
                        </View>
                      </View>
                    );
                  })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ... (Стили остаются без изменений) ...
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
    fontWeight: "500",
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
    fontWeight: "bold",
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
    backgroundColor: "#DDEEF4", // Небольшой акцент для Цели
    borderRadius: 8,
    marginHorizontal: -1, // Смещаем, чтобы перекрыть родительский бордюр
    paddingHorizontal: 6,
  },
  kbruHeader: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    fontWeight: "bold",
    textAlign: "center",
    width: "23%",
  },
  kbruLabel: {
    fontSize: 14,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    fontWeight: "500",
    width: "23%",
  },
  kbruValue: {
    fontSize: 14,
    fontWeight: "bold",
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
  mealRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  mealColumn: {
    width: "48%",
  },
  mealCategoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  mealCategoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "Playfair Display Regular",
  },
  arrowIcon: {
    width: 16,
    height: 16,
    tintColor: "#000000",
  },
  mealCard: {
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
    borderWidth: 1,
    borderColor: "#A8C8D4",
    height: 260,
  },
  imageContainer: {
    position: "relative",
  },
  mealImage: {
    width: "100%",
    height: 120,
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
  bookmarkIcon: {
    width: 18,
    height: 18,
    tintColor: "#6A9AA9",
  },
  mealContent: {
    padding: 12,
    flex: 1,
    justifyContent: "space-between",
  },
  mealInfo: {
    flex: 1,
    marginBottom: 8,
  },
  mealName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 6,
    fontFamily: "Playfair Display Regular",
    lineHeight: 18,
  },
  mealDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 4,
  },
  mealCalories: {
    fontSize: 12,
    color: "#000000",
    fontWeight: "normal",
    fontFamily: "Playfair Display Bold",
  },
  mealWeight: {
    fontSize: 12,
    color: "#6C757D",
    marginLeft: 45,
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
    fontWeight: "normal",
    fontFamily: "Playfair Display Regular",
  },
  checkmarkIcon: {
    width: 16,
    height: 16,
    tintColor: "#000000ff",
  },
});
