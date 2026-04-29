// app/meal.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "react-native";
import { Ionicons, Feather, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import { getApps, getApp, initializeApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";

import recipeService from "../app/services/recipeService";
import { favoriteService } from "../app/services/favoriteService";

// --- ТИПЫ ДАННЫХ ---
interface FullRecipeData {
  id: string;
  title: string;
  mealType: string;
  description: string;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  weight: string;
  cookingTime: string;
  servings: string;
  difficulty: string;
  averageRating: number;
  totalRatings: number;
  ingredients: string[];
  instructions: string[];
  imageUrl?: string;
}

// Декларация глобальных переменных
declare const __app_id: string | undefined;
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;

// Функция для получения иконки по категории
const getCategoryIcon = (category: string | undefined) => {
  const normalizedCategory = String(category || "")
    .trim()
    .toLowerCase();

  switch (normalizedCategory) {
    case "завтрак":
    case "breakfast":
      return { name: "sunny-outline", color: "#FFB74D" };
    case "обед":
    case "lunch":
      return { name: "restaurant-outline", color: "#4CAF50" };
    case "ужин":
    case "dinner":
      return { name: "moon-outline", color: "#5C6BC0" };
    case "перекусы":
    case "snack":
      return { name: "cafe-outline", color: "#FF9800" };
    default:
      return { name: "fast-food-outline", color: "#9C27B0" };
  }
};

// Функция для цвета сложности
const getDifficultyColor = (difficulty: string | undefined) => {
  if (!difficulty) return "#6A9AA9";

  switch (difficulty.trim()) {
    case "Легко":
    case "Легкая":
      return "#4CAF50";
    case "Средне":
    case "Средняя":
      return "#FF9800";
    case "Сложно":
    case "Сложная":
      return "#F44336";
    default:
      return "#6A9AA9";
  }
};

// Компонент бэджа сложности
const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const color = getDifficultyColor(difficulty);
  
  return (
    <View style={[styles.difficultyBadge, { backgroundColor: color }]}>
      <Text style={styles.difficultyText}>{difficulty}</Text>
    </View>
  );
};

const fallbackMealData = (
  mealName: string,
  mealType: string
): FullRecipeData => ({
  id: "fallback",
  title: mealName,
  mealType: mealType,
  description:
    "Это стандартный, зарезервированный рецепт, используемый в качестве запасного варианта. Он содержит основные питательные вещества и прост в приготовлении.",
  calories: 450,
  proteins: 15,
  fats: 10,
  carbohydrates: 70,
  weight: "300 гр.",
  cookingTime: "10 мин",
  servings: "1 чел.",
  difficulty: "Легкая",
  averageRating: 4.5,
  totalRatings: 53,
  ingredients: [
    "300 мл. молока",
    "1 банан",
    "100 гр. овсянки",
    "1 ст. ложка меда",
    "100 гр. ягод (на ваш вкус)",
  ],
  instructions: [
    "Разогреть молоко на среднем огне.",
    "Добавить овсянку и мед. Перемешивать до загустения.",
    "Снять с огне, добавить фрукты и ягоды.",
  ],
  imageUrl: undefined,
});

export default function Meal() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Получаем параметры и преобразуем их в строки
  const mealName = Array.isArray(params.mealName) ? params.mealName[0] : params.mealName || "Ошибка Загрузки Названия";
  const mealTypeParam = Array.isArray(params.mealType) ? params.mealType[0] : params.mealType || "Ошибка Типа Блюда";
  const category = Array.isArray(params.category) ? params.category[0] : params.category || mealTypeParam;
  const mealIndex = Array.isArray(params.mealIndex) ? params.mealIndex[0] : params.mealIndex || "0";
  const mealId = Array.isArray(params.mealId) ? params.mealId[0] : params.mealId || "";
  const fromScreen = Array.isArray(params.fromScreen) ? params.fromScreen[0] : params.fromScreen || "";
  const isCustom = Array.isArray(params.isCustom) ? params.isCustom[0] : params.isCustom || "false";
  const recipeId = Array.isArray(params.recipeId) ? params.recipeId[0] : params.recipeId || "";
  const difficultyLevel = Array.isArray(params.difficultyLevel) ? params.difficultyLevel[0] : params.difficultyLevel || "Легко";
  const rating = Array.isArray(params.rating) ? params.rating[0] : params.rating || "0";
  const imageUrl = Array.isArray(params.imageUrl) ? params.imageUrl[0] : params.imageUrl || "";
  const calories = Array.isArray(params.calories) ? params.calories[0] : params.calories || "300";
  const proteins = Array.isArray(params.proteins) ? params.proteins[0] : params.proteins || "20";
  const fats = Array.isArray(params.fats) ? params.fats[0] : params.fats || "10";
  const carbohydrates = Array.isArray(params.carbohydrates) ? params.carbohydrates[0] : params.carbohydrates || "30";
  const weight = Array.isArray(params.weight) ? params.weight[0] : params.weight || "250г";
  const cookingTime = Array.isArray(params.cookingTime) ? params.cookingTime[0] : params.cookingTime || "20 минут";

  // Определяем, пришли ли мы с домашней страницы
  const isFromHome = fromScreen === "home";
  const isCustomMeal = isCustom === "true";

  // Реф для предотвращения повторной загрузки
  const hasLoadedRef = useRef(false);

  // Лог для проверки переданного ID
  useEffect(() => {
    console.log("📍 MEAL.JS - Params Received:");
    console.log(`Meal ID: ${mealId || "N/A"}`);
    console.log(`Recipe ID: ${recipeId || "N/A"}`);
    console.log(`Meal Name: ${mealName}`);
    console.log(`Category: ${category}`);
    console.log(`Meal Type: ${mealTypeParam}`);
    console.log(`From Screen: ${fromScreen || "N/A"}`);
    console.log(`Is from Home: ${isFromHome}`);
    console.log(`Is Custom: ${isCustomMeal}`);
    console.log(`Image URL: ${imageUrl || "No image"}`);
  }, []);

  // --- СОСТОЯНИЕ ---
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoadingBookmark, setIsLoadingBookmark] = useState(true);
  const [recipeDetails, setRecipeDetails] = useState<FullRecipeData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  // --- 1. ИНИЦИАЛИЗАЦИЯ FIREBASE И АУТЕНТИФИКАЦИЯ ---
  useEffect(() => {
    const initFirebase = async () => {
      try {
        const firebaseConfig =
          typeof __firebase_config !== "undefined"
            ? JSON.parse(__firebase_config as string)
            : {};

        const app = !getApps().length
          ? initializeApp(firebaseConfig)
          : getApp();
        const authInstance = getAuth(app);
        const firestoreInstance = getFirestore(app);
        setDb(firestoreInstance);
        setAuth(authInstance);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            setUserId(user.uid);
          } else {
            if (typeof __initial_auth_token !== "undefined") {
              await signInWithCustomToken(authInstance, __initial_auth_token);
            } else {
              await signInAnonymously(authInstance);
            }
            const currentUserId =
              authInstance.currentUser?.uid || crypto.randomUUID();
            setUserId(currentUserId);
          }
          setIsAuthReady(true);
          console.log(
            `👤 MEAL.JS - Auth Ready. User ID: ${
              authInstance.currentUser?.uid || "N/A"
            }`
          );
        });
        return () => unsubscribe();
      } catch (error) {
        console.error("Firebase initialization failed:", error);
      }
    };
    initFirebase();
  }, []);

  const currentMealData: FullRecipeData | null = recipeDetails;

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ФОРМАТИРОВАНИЯ ---

  const formatIngredients = (ingredientsData: any): string[] => {
    console.log("🔧 Форматирование ингредиентов, полученные данные:", ingredientsData);
    
    if (!ingredientsData) {
      console.log("🔧 Нет данных об ингредиентах");
      return ["Ингредиенты не указаны"];
    }
    
    if (typeof ingredientsData === 'string') {
      console.log("🔧 Ингредиенты получены как строка, пытаемся распарсить JSON");
      try {
        const parsed = JSON.parse(ingredientsData);
        console.log("🔧 Успешно распарсили JSON:", parsed);
        return formatIngredients(parsed);
      } catch (error) {
        console.log("🔧 Не удалось распарсить как JSON, используем как есть");
        return [ingredientsData];
      }
    }
    
    if (Array.isArray(ingredientsData)) {
      console.log("🔧 Ингредиенты получены как массив, длина:", ingredientsData.length);
      
      if (ingredientsData.length === 0) {
        console.log("🔧 Массив ингредиентов пуст");
        return ["Ингредиенты не указаны"];
      }
      
      const firstItem = ingredientsData[0];
      console.log("🔧 Тип первого элемента:", typeof firstItem);
      
      if (typeof firstItem === 'string') {
        console.log("🔧 Это массив строк, используем как есть");
        return ingredientsData.filter((item: string) => item && item.trim() !== '');
      }
      
      if (typeof firstItem === 'object' && firstItem !== null) {
        console.log("🔧 Это массив объектов, преобразуем в строки");
        return ingredientsData.map((item: any, index: number) => {
          if (item.amount && item.name) {
            const result = `${item.amount} ${item.unit || ''} ${item.name}`.trim();
            console.log(`🔧 Ингредиент ${index + 1}: ${result}`);
            return result;
          } else if (item.text) {
            console.log(`🔧 Ингредиент ${index + 1}: ${item.text}`);
            return item.text;
          } else if (item.quantity && item.ingredient) {
            const result = `${item.quantity} ${item.unit || ''} ${item.ingredient}`.trim();
            console.log(`🔧 Ингредиент ${index + 1}: ${result}`);
            return result;
          } else if (item.name) {
            console.log(`🔧 Ингредиент ${index + 1}: ${item.name}`);
            return item.name;
          } else {
            const result = JSON.stringify(item);
            console.log(`🔧 Ингредиент ${index + 1} (неизвестный формат): ${result}`);
            return result;
          }
        }).filter((item: string) => item && item.trim() !== '');
      }
    }
    
    console.log("🔧 Неизвестный формат ингредиентов:", typeof ingredientsData);
    return ["Ингредиенты не загружены"];
  };

  const formatSteps = (stepsData: any): string[] => {
    console.log("🔧 Форматирование шагов, полученные данные:", stepsData);
    
    if (!stepsData) {
      console.log("🔧 Нет данных о шагах");
      return ["Инструкции не указаны"];
    }
    
    if (typeof stepsData === 'string') {
      console.log("🔧 Шаги получены как строка, пытаемся распарсить JSON");
      try {
        const parsed = JSON.parse(stepsData);
        console.log("🔧 Успешно распарсили JSON:", parsed);
        return formatSteps(parsed);
      } catch (error) {
        console.log("🔧 Не удалось распарсить как JSON, используем как есть");
        return [stepsData];
      }
    }
    
    if (Array.isArray(stepsData)) {
      console.log("🔧 Шаги получены как массив, длина:", stepsData.length);
      
      if (stepsData.length === 0) {
        console.log("🔧 Массив шагов пуст");
        return ["Инструкции не указаны"];
      }
      
      const firstItem = stepsData[0];
      console.log("🔧 Тип первого элемента:", typeof firstItem);
      
      if (typeof firstItem === 'string') {
        console.log("🔧 Это массив строк, используем как есть");
        return stepsData.filter((item: string) => item && item.trim() !== '');
      }
      
      if (typeof firstItem === 'object' && firstItem !== null) {
        console.log("🔧 Это массив объектов, преобразуем в строки");
        return stepsData.map((item: any, index: number) => {
          if (item.text) {
            console.log(`🔧 Шаг ${index + 1}: ${item.text}`);
            return item.text;
          } else if (item.description) {
            console.log(`🔧 Шаг ${index + 1}: ${item.description}`);
            return item.description;
          } else if (item.step) {
            console.log(`🔧 Шаг ${index + 1}: ${item.step}`);
            return item.step;
          } else if (item.instruction) {
            console.log(`🔧 Шаг ${index + 1}: ${item.instruction}`);
            return item.instruction;
          } else {
            const result = JSON.stringify(item);
            console.log(`🔧 Шаг ${index + 1} (неизвестный формат): ${result}`);
            return result;
          }
        }).filter((item: string) => item && item.trim() !== '');
      }
    }
    
    console.log("🔧 Неизвестный формат шагов:", typeof stepsData);
    return ["Инструкции не загружены"];
  };

  // --- ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ПУТИ К ОЦЕНКЕ ---
  const getRatingDocPath = useCallback((recipeId: string) => {
    const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";
    return `artifacts/${appId}/users/${userId}/mealRatings/${recipeId}`;
  }, [userId]);

  // --- 2. ЛОГИКА ЗАГРУЗКИ ОЦЕНКИ ---
  const loadRating = useCallback(async () => {
    if (!isAuthReady || !db || !userId || !currentMealData?.id) {
      console.log("⚠️ Пропускаем загрузку оценки:", {
        isAuthReady,
        hasDb: !!db,
        userId,
        hasMealId: !!currentMealData?.id
      });
      return;
    }

    if (isCustomMeal) {
      console.log("📝 Кастомный рецепт, пропускаем загрузку оценки");
      return;
    }

    try {
      const ratingDocPath = getRatingDocPath(currentMealData.id);
      const docRef = doc(db, ratingDocPath);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (typeof data.liked !== "undefined") {
          console.log("📖 Загружена сохраненная оценка:", data.liked);
          setLiked(data.liked);
        } else {
          setLiked(null);
        }
      } else {
        console.log("📖 Нет сохраненной оценки для этого рецепта");
        setLiked(null);
      }
    } catch (error) {
      console.error("❌ Ошибка при загрузке оценки из Firestore:", error);
      setLiked(null);
    }
  }, [isAuthReady, db, userId, currentMealData?.id, isCustomMeal, getRatingDocPath]);

  // --- 3. ЛОГИКА ЗАГРУЗКИ СТАТУСА ИЗБРАННОГО ---
  const loadBookmarkStatus = useCallback(async () => {
    if (!isAuthReady || !userId || !currentMealData?.id) {
      return;
    }

    if (isCustomMeal) {
      setIsLoadingBookmark(false);
      setIsBookmarked(false);
      return;
    }

    try {
      setIsLoadingBookmark(true);
      const actualRecipeId = recipeId || mealId || currentMealData.id;
      const isFav = await favoriteService.isInFavorites(actualRecipeId, 'recipe', userId);
      setIsBookmarked(isFav);
      console.log(`📖 Статус избранного для ${actualRecipeId}: ${isFav}`);
    } catch (error) {
      console.error("Ошибка загрузки статуса избранного:", error);
      setIsBookmarked(false);
    } finally {
      setIsLoadingBookmark(false);
    }
  }, [isAuthReady, userId, currentMealData?.id, isCustomMeal, recipeId, mealId]);

  // --- 4. ЛОГИКА ЗАГРУЗКИ ДЕТАЛЕЙ РЕЦЕПТА ---
  const loadRecipeDetails = useCallback(async () => {
    if (hasLoadedRef.current) {
      console.log("🔄 MEAL.JS - Already loaded, skipping");
      return;
    }

    if (!isAuthReady || !db) {
      console.log(
        `🟡 MEAL.JS - Load Skipped. Auth Ready: ${isAuthReady}, DB: ${!!db}`
      );
      setLoading(false);
      return;
    }

    console.log(`🚀 MEAL.JS - Starting load for ID: ${mealId}`);
    hasLoadedRef.current = true;
    setLoading(true);
    
    try {
      if (isCustomMeal) {
        console.log("📝 MEAL.JS - Custom recipe, using params data");
        setRecipeDetails({
          id: mealId,
          title: mealName,
          mealType: mealTypeParam || category || "Обед",
          description: "Этот рецепт был добавлен вами в дневной рацион. Вы можете добавить описание, ингредиенты и инструкции в разделе 'Мои рецепты'.",
          calories: Number(calories) || 300,
          proteins: Number(proteins) || 20,
          fats: Number(fats) || 10,
          carbohydrates: Number(carbohydrates) || 30,
          weight: weight || "250г",
          imageUrl: imageUrl || undefined,
          cookingTime: cookingTime || "20 минут",
          servings: "1 порция",
          difficulty: difficultyLevel || "Легко",
          averageRating: Number(rating) || 0,
          totalRatings: 0,
          ingredients: [
            "Ингредиенты не указаны",
            "Для просмотра полного списка ингредиентов перейдите в 'Мои рецепты'"
          ],
          instructions: [
            "Инструкции не указаны",
            "Для просмотра способа приготовления перейдите в 'Мои рецепты'"
          ],
        } as FullRecipeData);
        setLoading(false);
        return;
      }

      const actualRecipeId = recipeId || mealId;
      
      if (!actualRecipeId || actualRecipeId === "undefined" || actualRecipeId === "null") {
        console.warn("❌ MEAL.JS - No valid recipe ID provided");
        setRecipeDetails(
          fallbackMealData(mealName, mealTypeParam || category || "Обед")
        );
        setLoading(false);
        return;
      }

      console.log(`🔍 MEAL.JS - Loading recipe from Firestore with ID: ${actualRecipeId}`);
      const docRef = doc(db, "recipes", actualRecipeId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as any;

        console.log("✅ MEAL.JS - Recipe data loaded successfully from Firestore");
        
        const formattedIngredients = formatIngredients(data.ingredients);
        const formattedInstructions = formatSteps(data.steps);
        
        console.log("✅ Отформатированные ингредиенты:", formattedIngredients);
        console.log("✅ Отформатированные шаги:", formattedInstructions);

        setRecipeDetails({
          id: actualRecipeId,
          title: data.title || mealName || "Рецепт не найден",
          mealType: data.mealType || mealTypeParam || category || "Обед",
          description: data.description || "Описание не предоставлено.",
          calories: data.calories || Number(calories) || 0,
          proteins: data.proteins || Number(proteins) || 0,
          fats: data.fats || Number(fats) || 0,
          carbohydrates: data.carbohydrates || Number(carbohydrates) || 0,
          weight: data.weight || weight || "300 гр.",
          imageUrl: data.imageUrl || imageUrl || undefined,
          cookingTime: data.cookingTime || cookingTime || "15 мин",
          servings: data.servings || "1 порция",
          difficulty: data.difficultyLevel || difficultyLevel || "Средняя",
          averageRating: data.averageRating || Number(rating) || 0,
          totalRatings: data.ratingsCount || data.totalRatings || 0,
          ingredients: formattedIngredients,
          instructions: formattedInstructions,
        } as FullRecipeData);
      } else {
        console.warn(
          `❌ MEAL.JS - Document with ID ${actualRecipeId} NOT FOUND in /recipes collection.`
        );
        setRecipeDetails(
          fallbackMealData(mealName, mealTypeParam || category || "Обед")
        );
      }
    } catch (error) {
      console.error("❌ MEAL.JS - Error loading recipe details:", error);
      setRecipeDetails(
        fallbackMealData(mealName, mealTypeParam || category || "Обед")
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthReady, db, mealId, recipeId, mealName, mealTypeParam, category, isCustomMeal, imageUrl, difficultyLevel, rating, calories, proteins, fats, carbohydrates, weight, cookingTime]);

  useEffect(() => {
    return () => {
      hasLoadedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthReady && db && userId) {
      loadRecipeDetails();
    } else if (isAuthReady && (!mealId || !recipeId)) {
      setLoading(false);
      setRecipeDetails(
        fallbackMealData(mealName, mealTypeParam || category || "Обед")
      );
    }
  }, [isAuthReady, db, userId]);

  // Загружаем оценку после загрузки деталей рецепта
  useEffect(() => {
    if (currentMealData?.id && !isCustomMeal) {
      loadRating();
    }
  }, [currentMealData?.id, isCustomMeal, loadRating]);

  // Загружаем статус избранного после загрузки деталей рецепта
  useEffect(() => {
    if (currentMealData?.id && !isCustomMeal && isAuthReady) {
      loadBookmarkStatus();
    } else if (isCustomMeal) {
      setIsLoadingBookmark(false);
      setIsBookmarked(false);
    }
  }, [currentMealData?.id, isCustomMeal, isAuthReady, loadBookmarkStatus]);

  // --- ФУНКЦИЯ СОХРАНЕНИЯ ОЦЕНКИ ---
  const saveRating = useCallback(
    async (rating: boolean) => {
      if (!isAuthReady || !db || !userId || !currentMealData?.id) {
        console.log("❌ Не удалось сохранить оценку:", {
          isAuthReady,
          hasDb: !!db,
          userId,
          hasMealId: !!currentMealData?.id
        });
        Alert.alert("Ошибка", "Не удалось сохранить оценку. Попробуйте позже.");
        return;
      }

      if (isCustomMeal) {
        setLiked(rating);
        Alert.alert("Информация", "Оценка сохранена локально");
        return;
      }

      const ratingDocPath = getRatingDocPath(currentMealData.id);
      const ratingDocRef = doc(db, ratingDocPath);
      
      try {
        const docSnap = await getDoc(ratingDocRef);
        const previousLikedState = docSnap.exists() ? docSnap.data().liked : null;

        if (previousLikedState === rating) {
          console.log("Оценка уже установлена:", rating);
          return;
        }

        const isFirstVote = previousLikedState === null;
        const totalRatingsDelta = isFirstVote ? 1 : 0;

        console.log("💾 Сохранение оценки:", {
          userId,
          recipeId: currentMealData.id,
          rating,
          docPath: ratingDocPath,
          isFirstVote,
          totalRatingsDelta
        });

        await setDoc(
          ratingDocRef,
          { liked: rating, timestamp: new Date() },
          { merge: true }
        );
        setLiked(rating);

        if (!isCustomMeal && totalRatingsDelta !== 0) {
          await recipeService.updateRecipeRatingStats(
            currentMealData.id,
            totalRatingsDelta
          );
          // Перезагружаем детали для обновления рейтинга
          await loadRecipeDetails();
        }
        
        console.log("✅ Оценка успешно сохранена:", rating);
      } catch (error) {
        console.error("❌ Ошибка при сохранении оценки:", error);
        Alert.alert("Ошибка", "Не удалось сохранить оценку. Попробуйте позже.");
      }
    },
    [isAuthReady, db, userId, currentMealData?.id, isCustomMeal, getRatingDocPath, loadRecipeDetails]
  );

  // --- ФУНКЦИЯ СБРОСА ОЦЕНКИ ---
  const handleResetRating = useCallback(async () => {
    if (!isAuthReady || !db || !userId || !currentMealData?.id) {
      console.log("❌ Не удалось сбросить оценку");
      Alert.alert("Ошибка", "Не удалось сбросить оценку. Попробуйте позже.");
      return;
    }

    if (isCustomMeal) {
      setLiked(null);
      return;
    }

    const ratingDocPath = getRatingDocPath(currentMealData.id);
    const ratingDocRef = doc(db, ratingDocPath);
    
    try {
      const docSnap = await getDoc(ratingDocRef);
      const previousLikedState = docSnap.exists() ? docSnap.data().liked : null;
      const hadRating = previousLikedState !== null;

      console.log("🔄 Сброс оценки:", {
        userId,
        recipeId: currentMealData.id,
        previousLikedState,
        hadRating,
        docPath: ratingDocPath
      });

      await setDoc(
        ratingDocRef,
        { liked: null, timestamp: new Date() },
        { merge: true }
      );
      setLiked(null);

      if (hadRating && !isCustomMeal) {
        await recipeService.updateRecipeRatingStats(currentMealData.id, -1);
        // Перезагружаем детали для обновления рейтинга
        await loadRecipeDetails();
      }
      
      console.log("✅ Оценка успешно сброшена");
    } catch (error) {
      console.error("❌ Ошибка при сбросе оценки:", error);
      Alert.alert("Ошибка", "Не удалось сбросить оценку. Попробуйте позже.");
    }
  }, [isAuthReady, db, userId, currentMealData?.id, isCustomMeal, getRatingDocPath, loadRecipeDetails]);

  // --- НОВАЯ ФУНКЦИЯ ДЛЯ ИЗБРАННОГО ---
  const handleBookmark = useCallback(async () => {
    if (!isAuthReady || !userId) {
      Alert.alert("Ошибка", "Вы не авторизованы");
      return;
    }

    if (isCustomMeal) {
      Alert.alert("Информация", "Пользовательские рецепты нельзя добавлять в избранное");
      return;
    }

    const actualRecipeId = recipeId || mealId || currentMealData?.id;
    
    if (!actualRecipeId) {
      Alert.alert("Ошибка", "ID рецепта не найден");
      return;
    }

    try {
      if (isBookmarked) {
        await favoriteService.removeFromFavorites(actualRecipeId, 'recipe', userId);
        setIsBookmarked(false);
        Alert.alert("Успешно", "Рецепт удален из избранного");
      } else {
        await favoriteService.addToFavorites(actualRecipeId, 'recipe', userId);
        setIsBookmarked(true);
        Alert.alert("Успешно", "Рецепт добавлен в избранное");
      }
    } catch (error) {
      console.error("Ошибка при изменении статуса избранного:", error);
      Alert.alert("Ошибка", "Не удалось изменить статус избранного");
    }
  }, [isAuthReady, userId, isBookmarked, currentMealData?.id, recipeId, mealId, isCustomMeal]);

  // --- НОВАЯ ФУНКЦИЯ ДЛЯ ВЫБОРА ИСТОЧНИКА РЕЦЕПТА ---
  const handleReplaceMeal = () => {
    Alert.alert(
      "Заменить рецепт",
      "Откуда вы хотите выбрать новый рецепт?",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Из всех рецептов",
          onPress: () => {
            router.push({
              pathname: "/select-recipe",
              params: {
                mealIndex: mealIndex,
                currentMealId: mealId,
                currentMealCategory: category,
                isReplacement: "true",
                isCustomReplacement: isCustomMeal ? "true" : "false"
              }
            });
          }
        },
        {
          text: "Из моих рецептов",
          onPress: () => {
            router.push({
              pathname: "/select-user-recipes",
              params: {
                mealIndex: mealIndex,
                currentMealId: mealId,
                currentMealCategory: category,
                isReplacement: "true",
                isCustomReplacement: isCustomMeal ? "true" : "false"
              }
            });
          }
        }
      ]
    );
  };

  const handleNavigationBack = useCallback(
    (
      shouldRerender: boolean = false,
      newBookmarkedState: boolean = isBookmarked
    ) => {
      router.replace({
        pathname: "/",
        params: {
          rerenderDailyPlan: shouldRerender ? "true" : "false",
          mealIndexToUpdate: mealIndex,
          newBookmarkedState: newBookmarkedState ? "true" : "false",
        },
      });
    },
    [router, isBookmarked, mealIndex]
  );

  const handleLike = async () => {
    await saveRating(true);
  };

  const handleDislike = async () => {
    await saveRating(false);
  };

  const handleBack = () => {
    router.back();
  };

  const getMealIcon = () => {
    const type = currentMealData?.mealType || mealTypeParam || category;
    const iconInfo = getCategoryIcon(type);
    
    return (
      <Ionicons 
        name={iconInfo.name as any} 
        size={80} 
        color={iconInfo.color} 
      />
    );
  };

  if (loading || !isAuthReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>Загрузка рецепта...</Text>
        {!isAuthReady && (
          <Text style={styles.loadingText}>Инициализация базы данных...</Text>
        )}
      </View>
    );
  }

  if (!currentMealData) {
    return (
      <View style={styles.loadingContainer}>
        <Feather name="alert-triangle" size={30} color="#DC3545" />
        <Text style={[styles.loadingText, { color: "#DC3545", marginTop: 15 }]}>
          ⚠️ Рецепт не найден
        </Text>
        <Text style={styles.loadingText}>
          Проверьте логи в консоли, чтобы узнать, был ли передан Meal ID и
          существует ли документ в Firestore.
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 20,
            padding: 10,
            backgroundColor: "#6A9AA9",
            borderRadius: 8,
          }}
          onPress={() => router.back()}
        >
          <Text
            style={{ color: "white", fontFamily: "Playfair Display Regular" }}
          >
            Вернуться назад
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Feather name="arrow-left" size={24} color="#000000" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            Ваш {currentMealData.mealType.toLowerCase()} на сегодня
            {isCustomMeal && " (Добавлен вами)"}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageContainer}>
          {currentMealData.imageUrl ? (
            <Image
              source={{ uri: currentMealData.imageUrl }}
              style={styles.mealImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.mealImagePlaceholder}>
              {getMealIcon()}
              <Text style={styles.mealTypeText}>{currentMealData.mealType}</Text>
            </View>
          )}
          
          <View style={styles.difficultyBadgeContainer}>
            <DifficultyBadge difficulty={currentMealData.difficulty} />
          </View>
          
          {currentMealData.averageRating > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingBadgeText}>
                {currentMealData.averageRating.toFixed(1)}
              </Text>
            </View>
          )}
          
          {!isCustomMeal && (
            <TouchableOpacity
              style={styles.bookmarkButton}
              onPress={handleBookmark}
              disabled={isLoadingBookmark}
            >
              {isLoadingBookmark ? (
                <ActivityIndicator size="small" color="#6A9AA9" />
              ) : (
                <Ionicons
                  name={isBookmarked ? "bookmark" : "bookmark-outline"}
                  size={24}
                  color="#6A9AA9"
                />
              )}
            </TouchableOpacity>
          )}
          
          {isCustomMeal && (
            <View style={styles.customBadge}>
              <Ionicons name="add-circle" size={12} color="#FFFFFF" />
              <Text style={styles.customBadgeText}>Добавлен вами</Text>
            </View>
          )}
        </View>

        {isFromHome && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.replaceMealButton}
              onPress={handleReplaceMeal}
            >
              <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
              <Text style={styles.replaceMealText}>Заменить рецепт</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.mealName}>{currentMealData.title}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <MaterialIcons
                name="access-time"
                size={28}
                color="#6A9AA9"
                style={styles.detailIcon}
              />
              <Text style={styles.detailText}>
                {currentMealData.cookingTime}
              </Text>
              <Text style={styles.detailLabel}>время</Text>
            </View>

            <View style={styles.detailItem}>
              <Ionicons
                name="people-outline"
                size={28}
                color="#6A9AA9"
                style={styles.detailIcon}
              />
              <Text style={styles.detailText}>{currentMealData.servings}</Text>
              <Text style={styles.detailLabel}>порций</Text>
            </View>
            
            <View style={styles.detailItem}>
              <MaterialIcons
                name="restaurant"
                size={28}
                color="#6A9AA9"
                style={styles.detailIcon}
              />
              <Text style={styles.detailText}>{currentMealData.weight}</Text>
              <Text style={styles.detailLabel}>вес</Text>
            </View>
          </View>

          <View style={styles.nutritionContainer}>
            <View style={styles.nutritionRow}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionLabelSmall}>Ккал</Text>
                <Text style={styles.nutritionValue}>
                  {currentMealData.calories}
                </Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionLabelSmall}>Белки</Text>
                <Text style={styles.nutritionValue}>
                  {currentMealData.proteins} г
                </Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionLabelSmall}>Жиры</Text>
                <Text style={styles.nutritionValue}>
                  {currentMealData.fats} г
                </Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionLabelSmall}>Углеводы</Text>
                <Text style={styles.nutritionValue}>
                  {currentMealData.carbohydrates} г
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Описание</Text>
            <Text style={styles.descriptionText}>
              {currentMealData.description}
            </Text>
          </View>

          {liked !== null && !isCustomMeal && (
            <View style={styles.feedbackMessage}>
              <Text style={styles.feedbackText}>
                {liked
                  ? "Рады, что вам понравилось! Это блюдо появится в вашем рационе чаще."
                  : "Жаль, что вам не понравилось. Мы предложим другой вариант."}
              </Text>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetRating}
              >
                <Text style={styles.resetButtonText}>Изменить оценку</Text>
              </TouchableOpacity>
            </View>
          )}

          {liked === null && !isCustomMeal && (
            <View style={styles.likeSection}>
              <Text style={styles.likeQuestion}>
                Вам понравилось это блюдо?
              </Text>
              <View style={styles.likeButtonsContainer}>
                <TouchableOpacity
                  style={[styles.likeButton, styles.dislikeButton]}
                  onPress={handleDislike}
                >
                  <Ionicons
                    name="thumbs-down"
                    size={20}
                    color="white"
                    style={styles.likeIcon}
                  />
                  <Text style={styles.likeText}>Не нравится</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.likeButton, styles.likeButtonActive]}
                  onPress={handleLike}
                >
                  <Ionicons
                    name="thumbs-up"
                    size={20}
                    color="white"
                    style={styles.likeIcon}
                  />
                  <Text style={styles.likeText}>Нравится</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ингредиенты</Text>
            <View style={styles.ingredientsContainer}>
              {currentMealData.ingredients.length > 0 ? (
                currentMealData.ingredients.map((ingredient, index) => (
                  <View key={`ingredient-${index}`} style={styles.ingredientItem}>
                    <Ionicons name="ellipse" size={8} color="#6A9AA9" style={styles.ingredientBullet} />
                    <Text style={styles.ingredientText}>{ingredient}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>Ингредиенты не указаны</Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Способ приготовления</Text>
            {currentMealData.instructions.length > 0 ? (
              currentMealData.instructions.map((instruction, index) => (
                <View key={`instruction-${index}`} style={styles.instructionItem}>
                  <View style={styles.stepNumberContainer}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                  </View>
                  <Text style={styles.instructionText}>{instruction}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>Инструкции не указаны</Text>
            )}
          </View>
          
          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
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
    textAlign: "center",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    maxWidth: "80%",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: "relative",
    height: 220,
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#C2DAE2",
  },
  mealImage: {
    width: "100%",
    height: "100%",
  },
  mealImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 20,
    backgroundColor: "#E5F0F5",
  },
  mealTypeText: {
    fontSize: 18,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Bold",
    marginTop: 10,
    textAlign: "center",
  },
  difficultyBadgeContainer: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 10,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  difficultyText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: "Playfair Display Bold",
  },
  ratingBadge: {
    position: "absolute",
    top: 20,
    right: 70,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    zIndex: 10,
  },
  ratingBadgeText: {
    fontSize: 12,
    color: "#000000",
    fontFamily: "Playfair Display Bold",
    marginLeft: 4,
  },
  bookmarkButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 10,
  },
  customBadge: {
    position: "absolute",
    bottom: 20,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(155, 223, 17, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    zIndex: 10,
  },
  customBadgeText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: "Playfair Display Bold",
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  replaceMealButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6A9AA9",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  replaceMealText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    fontFamily: "Playfair Display Regular",
  },
  content: {
    padding: 20,
  },
  mealName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 20,
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  detailItem: {
    alignItems: "center",
    flex: 1,
  },
  detailIcon: {
    marginBottom: 8,
  },
  detailText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "Playfair Display Bold",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  nutritionContainer: {
    backgroundColor: "#F7F7F7",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000000",
    fontFamily: "Playfair Display Bold",
    marginTop: 6,
  },
  nutritionLabelSmall: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
    fontFamily: "Playfair Display Bold",
  },
  descriptionText: {
    fontSize: 16,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    lineHeight: 24,
    textAlign: "justify",
  },
  ingredientsContainer: {
    backgroundColor: "#F8F9FA",
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  ingredientBullet: {
    marginTop: 6,
    marginRight: 10,
  },
  ingredientText: {
    fontSize: 15,
    color: "#212529",
    flex: 1,
    fontFamily: "Playfair Display Regular",
    lineHeight: 22,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  stepNumberContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#6A9AA9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    fontFamily: "Playfair Display Bold",
  },
  instructionText: {
    fontSize: 15,
    color: "#000000ff",
    flex: 1,
    fontFamily: "Playfair Display Regular",
    lineHeight: 22,
  },
  feedbackMessage: {
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#9BDF11",
    alignItems: "center",
  },
  feedbackText: {
    fontSize: 14,
    color: "#000000ff",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  resetButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#6A9AA9",
    backgroundColor: "transparent",
  },
  resetButtonText: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  likeSection: {
    alignItems: "center",
    marginBottom: 30,
    padding: 20,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
  },
  likeQuestion: {
    fontSize: 16,
    color: "#212529",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  likeButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 120,
    justifyContent: "center",
  },
  likeButtonActive: {
    backgroundColor: "#9BDF11",
  },
  dislikeButton: {
    backgroundColor: "#DC3545",
  },
  likeIcon: {
    marginRight: 8,
  },
  likeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    fontFamily: "Playfair Display Regular",
  },
  noDataText: {
    fontSize: 14,
    color: "#999",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    fontStyle: "italic",
    padding: 10,
  },
  bottomSpacer: {
    height: 40,
  },
});