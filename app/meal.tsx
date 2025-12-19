// components/Meal.js
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
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
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
} from "firebase/auth";
import { getApps, getApp, initializeApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 💡 Убедитесь, что путь к сервису правильный
import recipeService from "../app/services/recipeService";

// --- ТИПЫ ДАННЫХ (для ясности) ---
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
    "Снять с огня, добавить фрукты и ягоды.",
  ],
  imageUrl: undefined,
});

export default function Meal() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const {
    mealName = "Ошибка Загрузки Названия",
    mealType: mealTypeParam = "Ошибка Типа Блюда",
    mealIndex = "0",
    initialBookmarked = "false",
    mealId = "",
    fromScreen = "",
    isCustom = "false",
  } = params;

  // Определяем, пришли ли мы с домашней страницы
  const isFromHome = fromScreen === "home";
  const isCustomMeal = isCustom === "true";

  // Лог для проверки переданного ID
  useEffect(() => {
    console.log("📍 MEAL.JS - Params Received:");
    console.log(`Meal ID: ${mealId || "N/A"}`);
    console.log(`Meal Name: ${mealName}`);
    console.log(`From Screen: ${fromScreen || "N/A"}`);
    console.log(`Is from Home: ${isFromHome}`);
    console.log(`Is Custom: ${isCustomMeal}`);
  }, [mealId, mealName, fromScreen, isFromHome, isCustomMeal]);

  // --- СОСТОЯНИЕ ---
  const [db, setDb] = useState<any>(null);
  const [auth, setAuth] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [liked, setLiked] = useState<boolean | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(
    initialBookmarked === "true"
  );
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
  const ratingDocPath = `artifacts/${
    typeof __app_id !== "undefined" ? __app_id : "default-app-id"
  }/users/${userId}/mealRatings/${currentMealData?.id || "fallback-id"}`;

  // --- 3. ЛОГИКА ЗАГРУЗКИ ДЕТАЛЕЙ РЕЦЕПТА (FIRESTORE) ---

  const loadRecipeDetails = useCallback(async () => {
    if (!isAuthReady || !db) {
      console.log(
        `🟡 MEAL.JS - Load Skipped. Auth Ready: ${isAuthReady}, DB: ${!!db}`
      );
      setLoading(false);
      return;
    }

    console.log(`🚀 MEAL.JS - Starting load for ID: ${mealId}`);
    setLoading(true);
    try {
      // Для кастомных рецептов используем параметры
      if (isCustomMeal) {
        console.log("📝 MEAL.JS - Custom recipe, using params data");
        setRecipeDetails({
          id: mealId as string,
          title: mealName as string,
          mealType: mealTypeParam as string,
          description: "Этот рецепт был добавлен вами в дневной рацион.",
          calories: Number(params.calories) || 300,
          proteins: Number(params.proteins) || 20,
          fats: Number(params.fats) || 10,
          carbohydrates: Number(params.carbohydrates) || 30,
          weight: (params.weight as string) || "250г",
          imageUrl: undefined,
          cookingTime: (params.cookingTime as string) || "20 минут",
          servings: "1 порция",
          difficulty: (params.difficultyLevel as string) || "Легко",
          averageRating: 0,
          totalRatings: 0,
          ingredients: ["Ингредиенты не указаны"],
          instructions: ["Инструкции не указаны"],
        } as FullRecipeData);
        setLoading(false);
        return;
      }

      const docRef = doc(db, "recipes", mealId as string);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as any;

        console.log("✅ MEAL.JS - Recipe data loaded successfully.");

        const formattedIngredients = Array.isArray(data.ingredients)
          ? data.ingredients.map(
              (item: any) => `${item.amount} ${item.unit}. ${item.name}`
            )
          : ["Ингредиенты не загружены"];

        const formattedInstructions = Array.isArray(data.steps)
          ? data.steps.map((step: any) => step.text)
          : ["Инструкции не загружены"];

        setRecipeDetails({
          id: mealId as string,
          title: data.title || "Рецепт не найден",
          mealType: data.mealType || (mealTypeParam as string),
          description: data.description || "Описание не предоставлено.",
          calories: data.calories || 0,
          proteins: data.proteins || 0,
          fats: data.fats || 0,
          carbohydrates: data.carbohydrates || 0,
          weight: data.weight || "300 гр.",
          imageUrl: data.imageUrl,
          cookingTime: data.cookingTime || "15 мин",
          servings: data.servings || "1 порция",
          difficulty: data.difficultyLevel || "Средняя",
          averageRating: data.averageRating || 0,
          totalRatings: data.ratingsCount || 0,
          ingredients: formattedIngredients,
          instructions: formattedInstructions,
        } as FullRecipeData);
      } else {
        console.warn(
          `❌ MEAL.JS - Document with ID ${mealId} NOT FOUND in /recipes collection.`
        );
        setRecipeDetails(null);
      }
    } catch (error) {
      console.error("❌ MEAL.JS - Error loading recipe details:", error);
      setRecipeDetails(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthReady, db, mealId, mealName, mealTypeParam, isCustomMeal, params]);

  // --- 2. ЛОГИКА ЗАГРУЗКИ ОЦЕНКИ (FIRESTORE) ---
  const loadRating = useCallback(async () => {
    if (!isAuthReady || !db || !userId || !currentMealData?.id) return;

    // Для кастомных рецептов не загружаем оценки
    if (isCustomMeal) return;

    try {
      const docRef = doc(db, ratingDocPath);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (typeof data.liked !== "undefined") {
          setLiked(data.liked);
        }
      }
    } catch (error) {
      console.error("Ошибка при загрузке оценки из Firestore:", error);
    }
  }, [
    isAuthReady,
    db,
    userId,
    ratingDocPath,
    currentMealData?.id,
    isCustomMeal,
  ]);

  // --- ЛОГИКА СОХРАНЕНИЯ ОЦЕНКИ ---
  const saveRating = useCallback(
    async (rating: boolean) => {
      if (!isAuthReady || !db || !userId || !currentMealData?.id) return;

      // Для кастомных рецептов не сохраняем оценки
      if (isCustomMeal) {
        setLiked(rating);
        Alert.alert("Информация", "Оценка сохранена локально");
        return;
      }

      const ratingDocRef = doc(db, ratingDocPath);
      const docSnap = await getDoc(ratingDocRef);
      const previousLikedState = docSnap.exists() ? docSnap.data().liked : null;

      if (previousLikedState === rating) {
        return;
      }

      const isFirstVote = previousLikedState === null;
      const totalRatingsDelta = isFirstVote ? 1 : 0;

      try {
        await setDoc(
          ratingDocRef,
          { liked: rating, timestamp: new Date() },
          { merge: true }
        );
        setLiked(rating);

        await recipeService.updateRecipeRatingStats(
          currentMealData.id,
          totalRatingsDelta
        );

        await loadRecipeDetails();
      } catch (error) {
        console.error("Ошибка при сохранении оценки:", error);
      }
    },
    [
      isAuthReady,
      db,
      userId,
      ratingDocPath,
      currentMealData?.id,
      loadRecipeDetails,
      isCustomMeal,
    ]
  );

  // --- ЛОГИКА СБРОСА ОЦЕНКИ ---
  const handleResetRating = async () => {
    if (!isAuthReady || !db || !userId || !currentMealData?.id) return;

    // Для кастомных рецептов просто сбрасываем локально
    if (isCustomMeal) {
      setLiked(null);
      return;
    }

    const ratingDocRef = doc(db, ratingDocPath);
    const docSnap = await getDoc(ratingDocRef);
    const previousLikedState = docSnap.exists() ? docSnap.data().liked : null;
    const hadRating = previousLikedState !== null;

    try {
      await setDoc(
        ratingDocRef,
        { liked: null, timestamp: new Date() },
        { merge: true }
      );
      setLiked(null);

      if (hadRating) {
        await recipeService.updateRecipeRatingStats(currentMealData.id, -1);

        await loadRecipeDetails();
      }
    } catch (error) {
      console.error("Ошибка при сбросе оценки в Firestore:", error);
    }
  };

  // --- ЭФФЕКТЫ ---
  useEffect(() => {
    if (isAuthReady && db && userId) {
      loadRecipeDetails();
      if (!isCustomMeal) {
        loadRating();
      }
    } else if (isAuthReady && !mealId) {
      setLoading(false);
      setRecipeDetails(
        fallbackMealData(mealName as string, mealTypeParam as string)
      );
    }
  }, [
    isAuthReady,
    db,
    userId,
    mealId,
    loadRecipeDetails,
    loadRating,
    isCustomMeal,
  ]);

  // --- ФУНКЦИИ УПРАВЛЕНИЯ СОСТОЯНИЕМ И НАВИГАЦИИ ---

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

  // Функция выбора рецепта из списка
  const handleChooseFromList = async () => {
    if (isFromHome) {
      // Сохраняем текущий mealId в AsyncStorage для возврата
      await AsyncStorage.setItem("currentMealId", mealId as string);
      await AsyncStorage.setItem("currentMealIndex", mealIndex as string);
      router.push("/select-recipe");
    }
  };

  // Функция смены рецепта
  const handleChangeMeal = async () => {
    if (isFromHome) {
      // Для кастомных рецептов показываем предупреждение
      if (isCustomMeal) {
        Alert.alert(
          "Смена рецепта",
          "Вы хотите заменить этот добавленный рецепт на другой?",
          [
            { text: "Отмена", style: "cancel" },
            {
              text: "Заменить",
              style: "destructive",
              onPress: async () => {
                await AsyncStorage.setItem("currentMealId", mealId as string);
                await AsyncStorage.setItem(
                  "currentMealIndex",
                  mealIndex as string
                );
                router.push("/select-recipe");
              },
            },
          ]
        );
      } else {
        Alert.alert(
          "Смена рецепта",
          "Этот рецепт был сгенерирован системой. Вы можете добавить новый рецепт, не заменяя этот.",
          [
            { text: "Отмена", style: "cancel" },
            {
              text: "Добавить новый",
              style: "default",
              onPress: async () => {
                await AsyncStorage.setItem(
                  "currentMealIndex",
                  mealIndex as string
                );
                router.push("/select-recipe");
              },
            },
          ]
        );
      }
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleBookmark = () => {
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
  };

  const getMealImage = () => {
    const type = currentMealData?.mealType || mealTypeParam;

    switch (type) {
      case "Завтрак":
        return require("@/assets/images/breakfast-oats.png");
      case "Обед":
        return require("@/assets/images/lunch-soup.png");
      case "Ужин":
        return require("@/assets/images/dinner-rice.png");
      case "Перекусы":
        return require("@/assets/images/snack-fruits.png");
      default:
        return require("@/assets/images/breakfast-oats.png");
    }
  };

  // --- ОБРАБОТКА ЗАГРУЗКИ И ОШИБКИ ---
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

  if (!mealId || !currentMealData) {
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

  // --- РЕНДЕРИНГ ДЕТАЛЕЙ РЕЦЕПТА ---

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Шапка с кнопкой назад и заголовком */}
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
        {/* Изображение блюда с кнопкой избранного */}
        <View style={styles.imageContainer}>
          <Image
            source={
              currentMealData.imageUrl
                ? { uri: currentMealData.imageUrl }
                : getMealImage()
            }
            style={styles.mealImage}
            resizeMode="cover"
          />
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={handleBookmark}
          >
            <Ionicons
              name={isBookmarked ? "bookmark" : "bookmark-outline"}
              size={20}
              color="#6A9AA9"
            />
          </TouchableOpacity>
        </View>

        {/* Кнопки действий под изображением - ТОЛЬКО если пришли с Home */}
        {isFromHome && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.changeMealButton}
              onPress={handleChangeMeal}
            >
              <Text style={styles.changeMealText}>
                {isCustomMeal ? "Заменить рецепт" : "Сменить блюдо"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chooseFromListButton}
              onPress={handleChooseFromList}
            >
              <Text style={styles.chooseFromListText}>Выбрать из списка</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Основная информация */}
        <View style={styles.content}>
          {/* Средний рейтинг */}
          {(currentMealData.averageRating > 0 ||
            currentMealData.totalRatings > 0) && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={20} color="#FFC107" />
              <Text style={styles.ratingText}>
                {currentMealData.averageRating.toFixed(1)}
              </Text>
              <Text style={styles.ratingLabel}>
                ({currentMealData.totalRatings} оценок)
              </Text>
            </View>
          )}
          {/* Название блюда */}
          <Text style={styles.mealName}>{currentMealData.title}</Text>

          {/* Время, Порции и Сложность */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <MaterialCommunityIcons
                name="clock-time-three-outline"
                size={28}
                color="#000000"
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
                color="#000000"
                style={styles.detailIcon}
              />
              <Text style={styles.detailText}>{currentMealData.servings}</Text>
              <Text style={styles.detailLabel}>порций</Text>
            </View>
            <View style={styles.detailItem}>
              <MaterialCommunityIcons
                name="tune"
                size={28}
                color="#000000"
                style={styles.detailIcon}
              />
              <Text style={styles.detailText}>
                {currentMealData.difficulty}
              </Text>
              <Text style={styles.detailLabel}>сложность</Text>
            </View>
          </View>

          {/* КБЖУ */}
          <View style={styles.nutritionRow}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionLabelSmall}>Вес</Text>
              <Text style={styles.nutritionValue}>
                {currentMealData.weight}
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionLabelSmall}>Ккал</Text>
              <Text style={styles.nutritionValue}>
                {currentMealData.calories}
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionLabelSmall}>Белки</Text>
              <Text style={styles.nutritionValue}>
                {currentMealData.proteins} гр
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionLabelSmall}>Жиры</Text>
              <Text style={styles.nutritionValue}>
                {currentMealData.fats} гр
              </Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionLabelSmall}>Углеводы</Text>
              <Text style={styles.nutritionValue}>
                {currentMealData.carbohydrates} гр
              </Text>
            </View>
          </View>

          {/* Описание */}
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Описание:</Text>
            <Text style={styles.descriptionText}>
              {currentMealData.description}
            </Text>
          </View>

          {/* Сообщение о выборе */}
          {liked !== null && (
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

          {/* Кнопки лайка и дизлайка */}
          {liked === null && (
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

          {/* Ингредиенты */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ингредиенты:</Text>
            {currentMealData.ingredients.map((ingredient, index) => (
              <View key={`ingredient-${index}`} style={styles.ingredientItem}>
                <Text style={styles.ingredientText}>{`• ${ingredient}`}</Text>
              </View>
            ))}
          </View>

          {/* Способ приготовления */}
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Способ приготовления:</Text>
            {currentMealData.instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// --- СТИЛИ (ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ) ---

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
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#6A9AA9",
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
  },
  mealImage: {
    width: "100%",
    height: 250,
  },
  bookmarkButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
    gap: 12,
  },
  changeMealButton: {
    flex: 1,
    backgroundColor: "#6A9AA9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  changeMealText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
    fontFamily: "Playfair Display Regular",
  },
  chooseFromListButton: {
    flex: 1,
    backgroundColor: "#C2DAE2",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000000ff",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chooseFromListText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000ff",
    fontFamily: "Playfair Display Regular",
  },
  content: {
    padding: 20,
  },
  ratingRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  ratingText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFC107",
    marginLeft: 5,
    fontFamily: "Playfair Display Regular",
  },
  ratingLabel: {
    fontSize: 12,
    color: "#6C757D",
    marginLeft: 8,
    fontFamily: "Playfair Display Regular",
  },
  mealName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 20,
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 30,
    paddingHorizontal: 0,
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
    fontFamily: "Playfair Display Regular",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  nutritionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
    paddingVertical: 15,
    paddingHorizontal: 5,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  nutritionItem: {
    alignItems: "center",
    flex: 1,
  },
  nutritionValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    marginTop: 4,
  },
  nutritionLabelSmall: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular",
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular",
  },
  descriptionText: {
    fontSize: 16,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    lineHeight: 24,
    marginBottom: 10,
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingLeft: 8,
  },
  ingredientText: {
    fontSize: 16,
    color: "#212529",
    flex: 1,
    fontFamily: "Playfair Display Regular",
    lineHeight: 22,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingLeft: 8,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6A9AA9",
    marginRight: 12,
    fontFamily: "Playfair Display Regular",
    minWidth: 24,
  },
  instructionText: {
    fontSize: 16,
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
});
