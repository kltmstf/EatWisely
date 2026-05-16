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
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { getApps, getApp, initializeApp } from "firebase/app";

import recipeService from "../app/services/recipeService";
import { favoriteService } from "../app/services/favoriteService";
import { rationPlanService } from "../app/services/rationPlanService";

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

declare const __app_id: string | undefined;
declare const __firebase_config: string | undefined;
declare const __initial_auth_token: string | undefined;

const getCategoryIcon = (category: string | undefined) => {
  const normalizedCategory = String(category || "").trim().toLowerCase();
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

const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const color = getDifficultyColor(difficulty);
  return (
    <View style={[styles.difficultyBadge, { backgroundColor: color }]}>
      <Text style={styles.difficultyText}>{difficulty}</Text>
    </View>
  );
};

const fallbackMealData = (mealName: string, mealType: string): FullRecipeData => ({
  id: "fallback",
  title: mealName,
  mealType: mealType,
  description: "Это стандартный, зарезервированный рецепт, используемый в качестве запасного варианта.",
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
  ingredients: ["300 мл. молока", "1 банан", "100 гр. овсянки", "1 ст. ложка меда", "100 гр. ягод"],
  instructions: ["Разогреть молоко", "Добавить овсянку и мед", "Снять с огня, добавить фрукты"],
  imageUrl: undefined,
});

export default function Meal() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const mealName = Array.isArray(params.mealName) ? params.mealName[0] : params.mealName || "";
  const mealTypeParam = Array.isArray(params.mealType) ? params.mealType[0] : params.mealType || "";
  const category = Array.isArray(params.category) ? params.category[0] : params.category || mealTypeParam;
  const mealIndex = Array.isArray(params.mealIndex) ? params.mealIndex[0] : params.mealIndex || "";
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

  const isFromHome = fromScreen === "home";
  const isCustomMeal = isCustom === "true";
  const hasLoadedRef = useRef(false);

  const [db, setDb] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoadingBookmark, setIsLoadingBookmark] = useState(true);
  const [recipeDetails, setRecipeDetails] = useState<FullRecipeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReplacing, setIsReplacing] = useState(false);
  const [pendingReplaceData, setPendingReplaceData] = useState<any>(null);

  // Инициализация Firebase
  useEffect(() => {
    const initFirebase = async () => {
      try {
        const firebaseConfig = typeof __firebase_config !== "undefined"
          ? JSON.parse(__firebase_config as string)
          : {};
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const authInstance = getAuth(app);
        const firestoreInstance = getFirestore(app);
        setDb(firestoreInstance);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
          if (user) {
            setUserId(user.uid);
            setCurrentUser(user);
            setIsAuthReady(true);
            console.log("✅ User authenticated:", user.uid);
          } else {
            if (typeof __initial_auth_token !== "undefined") {
              await signInWithCustomToken(authInstance, __initial_auth_token);
            } else {
              await signInAnonymously(authInstance);
            }
            const currentUserId = authInstance.currentUser?.uid || null;
            setUserId(currentUserId);
            setCurrentUser(authInstance.currentUser);
            setIsAuthReady(true);
            console.log("✅ User authenticated (anonymous):", currentUserId);
          }
        });
        return () => unsubscribe();
      } catch (error) {
        console.error("Firebase initialization failed:", error);
      }
    };
    initFirebase();
  }, []);

  // Обработка отложенной замены после авторизации
  useEffect(() => {
    if (isAuthReady && pendingReplaceData && currentUser?.uid) {
      console.log("🔄 Processing pending replacement after auth");
      const data = pendingReplaceData;
      setPendingReplaceData(null);
      performReplaceMeal(data);
    }
  }, [isAuthReady, currentUser, pendingReplaceData]);

  const formatIngredients = (ingredientsData: any): string[] => {
    if (!ingredientsData) return ["Ингредиенты не указаны"];
    if (typeof ingredientsData === 'string') {
      try {
        return formatIngredients(JSON.parse(ingredientsData));
      } catch {
        return [ingredientsData];
      }
    }
    if (Array.isArray(ingredientsData)) {
      if (ingredientsData.length === 0) return ["Ингредиенты не указаны"];
      if (typeof ingredientsData[0] === 'string') {
        return ingredientsData.filter(item => item && item.trim() !== '');
      }
      return ingredientsData.map(item => item.text || item.name || JSON.stringify(item)).filter(i => i);
    }
    return ["Ингредиенты не указаны"];
  };

  const formatSteps = (stepsData: any): string[] => {
    if (!stepsData) return ["Инструкции не указаны"];
    if (typeof stepsData === 'string') {
      try {
        return formatSteps(JSON.parse(stepsData));
      } catch {
        return [stepsData];
      }
    }
    if (Array.isArray(stepsData)) {
      if (stepsData.length === 0) return ["Инструкции не указаны"];
      if (typeof stepsData[0] === 'string') {
        return stepsData.filter(item => item && item.trim() !== '');
      }
      return stepsData.map(item => item.text || item.description || item.step || JSON.stringify(item)).filter(i => i);
    }
    return ["Инструкции не указаны"];
  };

  const loadRecipeDetails = useCallback(async () => {
    if (hasLoadedRef.current) return;
    if (!isAuthReady || !db) {
      setLoading(false);
      return;
    }

    hasLoadedRef.current = true;
    setLoading(true);

    try {
      if (isCustomMeal) {
        setRecipeDetails({
          id: mealId,
          title: mealName,
          mealType: mealTypeParam || category || "Обед",
          description: "Этот рецепт был добавлен вами в дневной рацион.",
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
          ingredients: ["Ингредиенты не указаны"],
          instructions: ["Инструкции не указаны"],
        });
        setLoading(false);
        return;
      }

      const actualRecipeId = recipeId || mealId;
      if (!actualRecipeId || actualRecipeId === "undefined" || actualRecipeId === "null") {
        setRecipeDetails(fallbackMealData(mealName, mealTypeParam || category || "Обед"));
        setLoading(false);
        return;
      }

      const docRef = doc(db, "recipes", actualRecipeId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setRecipeDetails({
          id: actualRecipeId,
          title: data.title || mealName,
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
          totalRatings: data.ratingsCount || 0,
          ingredients: formatIngredients(data.ingredients),
          instructions: formatSteps(data.steps || data.instructions),
        });
      } else {
        setRecipeDetails(fallbackMealData(mealName, mealTypeParam || category || "Обед"));
      }
    } catch (error) {
      console.error("Error loading recipe:", error);
      setRecipeDetails(fallbackMealData(mealName, mealTypeParam || category || "Обед"));
    } finally {
      setLoading(false);
    }
  }, [isAuthReady, db, mealId, recipeId, mealName, mealTypeParam, category, isCustomMeal, calories, proteins, fats, carbohydrates, weight, cookingTime, difficultyLevel, rating, imageUrl]);

  useEffect(() => {
    if (isAuthReady && db) {
      loadRecipeDetails();
    }
  }, [isAuthReady, db, loadRecipeDetails]);

  useEffect(() => {
    return () => {
      hasLoadedRef.current = false;
    };
  }, []);

  // Загрузка статуса избранного
  useEffect(() => {
    const loadBookmark = async () => {
      if (!isAuthReady || !userId || !recipeDetails?.id || isCustomMeal) {
        setIsLoadingBookmark(false);
        return;
      }
      try {
        const actualId = recipeId || mealId || recipeDetails.id;
        const isFav = await favoriteService.isInFavorites(actualId, 'recipe', userId);
        setIsBookmarked(isFav);
      } catch (error) {
        console.error("Error loading bookmark:", error);
      } finally {
        setIsLoadingBookmark(false);
      }
    };
    loadBookmark();
  }, [isAuthReady, userId, recipeDetails?.id, isCustomMeal, recipeId, mealId]);

  const handleBookmark = async () => {
    if (!isAuthReady || !userId || !recipeDetails?.id || isCustomMeal) {
      Alert.alert("Ошибка", "Нельзя добавить в избранное");
      return;
    }
    const actualId = recipeId || mealId || recipeDetails.id;
    try {
      if (isBookmarked) {
        await favoriteService.removeFromFavorites(actualId, 'recipe', userId);
        setIsBookmarked(false);
        Alert.alert("Успех", "Рецепт удален из избранного");
      } else {
        await favoriteService.addToFavorites(actualId, 'recipe', userId);
        setIsBookmarked(true);
        Alert.alert("Успех", "Рецепт добавлен в избранное");
      }
    } catch (error) {
      console.error("Error bookmarking:", error);
      Alert.alert("Ошибка", "Не удалось изменить статус избранного");
    }
  };

  // Функция замены блюда (основная логика)
  const performReplaceMeal = useCallback(async (newRecipeData: any) => {
    if (!currentUser?.uid) {
      Alert.alert("Ошибка", "Пользователь не авторизован");
      return;
    }
    if (!db) {
      Alert.alert("Ошибка", "База данных не инициализирована");
      return;
    }

    try {
      setIsReplacing(true);
      const todayStr = new Date().toISOString().split('T')[0];
      const planRef = doc(db, 'users', currentUser.uid, 'daily_plans', todayStr);
      const planSnap = await getDoc(planRef);

      if (!planSnap.exists()) {
        Alert.alert("Ошибка", "План на сегодня не найден");
        return;
      }

      const planData = planSnap.data();
      const currentMeals = planData.meals || [];
      const mealIndexNum = parseInt(mealIndex, 10);

      if (isNaN(mealIndexNum) || mealIndexNum >= currentMeals.length) {
        Alert.alert("Ошибка", "Прием пищи не найден");
        return;
      }

      const newMeal = {
        id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: newRecipeData.category || newRecipeData.mealType || category,
        name: newRecipeData.title,
        calories: newRecipeData.calories || 0,
        proteins: newRecipeData.proteins || 0,
        fats: newRecipeData.fats || 0,
        carbohydrates: newRecipeData.carbohydrates || 0,
        weight: newRecipeData.weight || "250г",
        marked: false,
        cookingTime: typeof newRecipeData.cookingTime === 'number' ? newRecipeData.cookingTime : 20,
        difficultyLevel: newRecipeData.difficultyLevel || "Легко",
        rating: newRecipeData.rating || 0,
        recipeId: newRecipeData.id,
        isCustom: false,
        canBeRemoved: true,
        imageUrl: newRecipeData.imageUrl || null,
        addedAt: new Date().toISOString()
      };

      const updatedMeals = [...currentMeals];
      updatedMeals[mealIndexNum] = newMeal;

      await setDoc(planRef, { meals: updatedMeals, updatedAt: new Date().toISOString() }, { merge: true });

      // Обновляем активный план
      try {
        const activePlan = await rationPlanService.getActivePlanForToday(currentUser.uid);
        if (activePlan && activePlan.id) {
          const activePlanRef = doc(db, 'ration_plans', activePlan.id);
          await setDoc(activePlanRef, {
            'days.0.meals': updatedMeals,
            'days.0.stats': {
              totalCalories: updatedMeals.reduce((s, m) => s + (m.calories || 0), 0),
              totalProteins: updatedMeals.reduce((s, m) => s + (m.proteins || 0), 0),
              totalFats: updatedMeals.reduce((s, m) => s + (m.fats || 0), 0),
              totalCarbs: updatedMeals.reduce((s, m) => s + (m.carbohydrates || 0), 0),
              totalCookingTime: updatedMeals.reduce((s, m) => s + (m.cookingTime || 0), 0)
            },
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (error) {
        console.error("Error updating active plan:", error);
      }

      Alert.alert("Успех", "Рецепт успешно заменен!");
      router.push({ pathname: "/", params: { refreshHome: Date.now().toString() } });
    } catch (error) {
      console.error("Error replacing meal:", error);
      Alert.alert("Ошибка", "Не удалось заменить рецепт");
    } finally {
      setIsReplacing(false);
    }
  }, [currentUser, db, mealIndex, category, router]);

  // Обертка для замены с проверкой авторизации
  const confirmReplaceMeal = useCallback((newRecipeData: any) => {
    if (!isAuthReady || !currentUser?.uid) {
      // Если еще не авторизованы, сохраняем данные для отложенной замены
      console.log("⏳ Waiting for auth to complete...");
      setPendingReplaceData(newRecipeData);
      Alert.alert("Информация", "Пожалуйста, подождите, идет авторизация...");
    } else {
      performReplaceMeal(newRecipeData);
    }
  }, [isAuthReady, currentUser, performReplaceMeal]);

  // Обработка возврата с выбора рецепта
  useEffect(() => {
    const { selectedRecipe, returnTo } = params;
    if (selectedRecipe && returnTo === "meal") {
      try {
        const recipeData = JSON.parse(selectedRecipe as string);
        console.log("📦 Received recipe for replacement:", recipeData.title);
        confirmReplaceMeal(recipeData);
        setTimeout(() => {
          router.setParams({ selectedRecipe: undefined, returnTo: undefined });
        }, 100);
      } catch (error) {
        console.error("Error parsing recipe:", error);
        Alert.alert("Ошибка", "Не удалось обработать выбранный рецепт");
      }
    }
  }, [params.selectedRecipe, params.returnTo, confirmReplaceMeal, router]);

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
                isCustomReplacement: isCustomMeal ? "true" : "false",
                returnTo: "meal"
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
                isCustomReplacement: isCustomMeal ? "true" : "false",
                returnTo: "meal"
              }
            });
          }
        }
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  // Функции для оценок
  const handleLike = async () => {
    setLiked(true);
    Alert.alert("Спасибо", "Спасибо за вашу оценку!");
  };

  const handleDislike = async () => {
    setLiked(false);
    Alert.alert("Спасибо", "Спасибо за вашу оценку!");
  };

  const currentMealData = recipeDetails;

  if (loading || (!isAuthReady && !pendingReplaceData) || isReplacing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>
          {isReplacing ? "Замена рецепта..." : "Загрузка рецепта..."}
        </Text>
      </View>
    );
  }

  if (!currentMealData) {
    return (
      <View style={styles.loadingContainer}>
        <Feather name="alert-triangle" size={30} color="#DC3545" />
        <Text style={[styles.loadingText, { color: "#DC3545", marginTop: 15 }]}>Рецепт не найден</Text>
        <TouchableOpacity style={{ marginTop: 20, padding: 10, backgroundColor: "#6A9AA9", borderRadius: 8 }} onPress={() => router.back()}>
          <Text style={{ color: "white" }}>Вернуться назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const iconInfo = getCategoryIcon(currentMealData.mealType);

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

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          {currentMealData.imageUrl ? (
            <Image source={{ uri: currentMealData.imageUrl }} style={styles.mealImage} resizeMode="cover" />
          ) : (
            <View style={styles.mealImagePlaceholder}>
              <Ionicons name={iconInfo.name as any} size={80} color={iconInfo.color} />
              <Text style={styles.mealTypeText}>{currentMealData.mealType}</Text>
            </View>
          )}
          <View style={styles.difficultyBadgeContainer}>
            <DifficultyBadge difficulty={currentMealData.difficulty} />
          </View>
          {currentMealData.averageRating > 0 && (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={12} color="#FFD700" />
              <Text style={styles.ratingBadgeText}>{currentMealData.averageRating.toFixed(1)}</Text>
            </View>
          )}
          {!isCustomMeal && (
            <TouchableOpacity style={styles.bookmarkButton} onPress={handleBookmark} disabled={isLoadingBookmark}>
              {isLoadingBookmark ? (
                <ActivityIndicator size="small" color="#6A9AA9" />
              ) : (
                <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={24} color="#6A9AA9" />
              )}
            </TouchableOpacity>
          )}
        </View>

        {mealIndex && mealIndex !== "" && !isNaN(parseInt(mealIndex, 10)) && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.replaceMealButton} onPress={handleReplaceMeal}>
              <Ionicons name="swap-horizontal" size={20} color="#FFFFFF" />
              <Text style={styles.replaceMealText}>Заменить рецепт</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.mealName}>{currentMealData.title}</Text>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <MaterialIcons name="access-time" size={28} color="#6A9AA9" />
              <Text style={styles.detailText}>{currentMealData.cookingTime} мин.</Text>
              <Text style={styles.detailLabel}>время</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={28} color="#6A9AA9" />
              <Text style={styles.detailText}>{currentMealData.servings}</Text>
              <Text style={styles.detailLabel}>порций</Text>
            </View>
            <View style={styles.detailItem}>
              <MaterialIcons name="restaurant" size={28} color="#6A9AA9" />
              <Text style={styles.detailText}>{currentMealData.weight}</Text>
              <Text style={styles.detailLabel}>вес</Text>
            </View>
          </View>

          <View style={styles.nutritionContainer}>
            <View style={styles.nutritionRow}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionLabelSmall}>Ккал</Text>
                <Text style={styles.nutritionValue}>{currentMealData.calories}</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionLabelSmall}>Белки</Text>
                <Text style={styles.nutritionValue}>{currentMealData.proteins} г</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionLabelSmall}>Жиры</Text>
                <Text style={styles.nutritionValue}>{currentMealData.fats} г</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionLabelSmall}>Углеводы</Text>
                <Text style={styles.nutritionValue}>{currentMealData.carbohydrates} г</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Описание</Text>
            <Text style={styles.descriptionText}>{currentMealData.description}</Text>
          </View>

          {liked === null && !isCustomMeal && (
            <View style={styles.likeSection}>
              <Text style={styles.likeQuestion}>Вам понравилось это блюдо?</Text>
              <View style={styles.likeButtonsContainer}>
                <TouchableOpacity style={[styles.likeButton, styles.dislikeButton]} onPress={handleDislike}>
                  <Ionicons name="thumbs-down" size={20} color="white" />
                  <Text style={styles.likeText}>Не нравится</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.likeButton, styles.likeButtonActive]} onPress={handleLike}>
                  <Ionicons name="thumbs-up" size={20} color="white" />
                  <Text style={styles.likeText}>Нравится</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ингредиенты</Text>
            <View style={styles.ingredientsContainer}>
              {currentMealData.ingredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <Ionicons name="ellipse" size={8} color="#6A9AA9" style={styles.ingredientBullet} />
                  <Text style={styles.ingredientText}>{ingredient}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Способ приготовления</Text>
            {currentMealData.instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <View style={styles.stepNumberContainer}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f8f8" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Regular", textAlign: "center", paddingHorizontal: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  backButton: { padding: 8 },
  headerTitleContainer: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#000000", fontFamily: "Playfair Display Regular", textAlign: "center", maxWidth: "80%" },
  placeholder: { width: 40 },
  imageContainer: { position: "relative", height: 220, backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#C2DAE2" },
  mealImage: { width: "100%", height: "100%" },
  mealImagePlaceholder: { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", backgroundColor: "#E5F0F5" },
  mealTypeText: { fontSize: 18, color: "#6A9AA9", fontFamily: "Playfair Display Bold", marginTop: 10, textAlign: "center" },
  difficultyBadgeContainer: { position: "absolute", top: 20, left: 20, zIndex: 10 },
  difficultyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 },
  difficultyText: { fontSize: 12, color: "#FFFFFF", fontFamily: "Playfair Display Bold" },
  ratingBadge: { position: "absolute", top: 20, right: 70, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0", zIndex: 10 },
  ratingBadgeText: { fontSize: 12, color: "#000000", fontFamily: "Playfair Display Bold", marginLeft: 4 },
  bookmarkButton: { position: "absolute", top: 16, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, zIndex: 10 },
  actionButtons: { flexDirection: "row", justifyContent: "center", paddingHorizontal: 20, paddingVertical: 16, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#E9ECEF" },
  replaceMealButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#6A9AA9", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  replaceMealText: { fontSize: 14, fontWeight: "600", color: "white", fontFamily: "Playfair Display Regular" },
  content: { padding: 20 },
  mealName: { fontSize: 24, fontWeight: "600", color: "#000000", marginBottom: 20, fontFamily: "Playfair Display Bold", textAlign: "center" },
  detailsRow: { flexDirection: "row", justifyContent: "space-around", marginBottom: 24, paddingHorizontal: 10 },
  detailItem: { alignItems: "center", flex: 1 },
  detailText: { fontSize: 16, fontWeight: "600", color: "#000000", fontFamily: "Playfair Display Bold", marginBottom: 4 },
  detailLabel: { fontSize: 12, color: "#6C757D", fontFamily: "Playfair Display Regular", textAlign: "center" },
  nutritionContainer: { backgroundColor: "#F7F7F7", borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: "#E0E0E0" },
  nutritionRow: { flexDirection: "row", justifyContent: "space-between" },
  nutritionItem: { alignItems: "center", flex: 1 },
  nutritionValue: { fontSize: 18, fontWeight: "700", color: "#000000", fontFamily: "Playfair Display Bold", marginTop: 6 },
  nutritionLabelSmall: { fontSize: 12, fontWeight: "600", color: "#6C757D", fontFamily: "Playfair Display Regular", textTransform: "uppercase" },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 20, fontWeight: "600", color: "#000000", marginBottom: 16, fontFamily: "Playfair Display Bold" },
  descriptionText: { fontSize: 16, color: "#212529", fontFamily: "Playfair Display Regular", lineHeight: 24 },
  ingredientsContainer: { backgroundColor: "#F8F9FA", borderRadius: 10, padding: 16, borderWidth: 1, borderColor: "#E9ECEF" },
  ingredientItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  ingredientBullet: { marginTop: 6, marginRight: 10 },
  ingredientText: { fontSize: 15, color: "#212529", flex: 1, fontFamily: "Playfair Display Regular", lineHeight: 22 },
  instructionItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#E9ECEF" },
  stepNumberContainer: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#6A9AA9", alignItems: "center", justifyContent: "center", marginRight: 12, marginTop: 2 },
  stepNumber: { fontSize: 14, fontWeight: "600", color: "#FFFFFF", fontFamily: "Playfair Display Bold" },
  instructionText: { fontSize: 15, color: "#000000", flex: 1, fontFamily: "Playfair Display Regular", lineHeight: 22 },
  likeSection: { alignItems: "center", marginBottom: 30, padding: 20, backgroundColor: "#F8F9FA", borderRadius: 12 },
  likeQuestion: { fontSize: 16, color: "#212529", marginBottom: 16, fontFamily: "Playfair Display Regular", textAlign: "center" },
  likeButtonsContainer: { flexDirection: "row", justifyContent: "center", gap: 12 },
  likeButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5, minWidth: 120, justifyContent: "center" },
  likeButtonActive: { backgroundColor: "#9BDF11" },
  dislikeButton: { backgroundColor: "#DC3545" },
  likeText: { fontSize: 14, fontWeight: "600", color: "white", fontFamily: "Playfair Display Regular", marginLeft: 8 },
  bottomSpacer: { height: 40 },
});