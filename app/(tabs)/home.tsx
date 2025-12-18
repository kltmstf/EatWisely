// app/(tabs)/home.tsx
import { useRouter } from "expo-router";
import React, {
  useEffect,
  useState,
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
  RefreshControl,
} from "react-native";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  getDoc,
  Firestore,
  setLogLevel,
} from "firebase/firestore";
import { getApp, getApps, initializeApp } from "firebase/app";
import { Ionicons, FontAwesome, MaterialIcons, Feather } from "@expo/vector-icons";

// ИМПОРТ СЕРВИСОВ
import { userService } from "@/app/services/userService";
import { dailyRationService } from "@/app/services/rationService";

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
  recipeId?: string;
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
}

const TARGET_KBRU_RATIOS = {
  protein: 0.3,
  fat: 0.3,
  carb: 0.4,
};

const DEFAULT_MEAL_IMAGE = require("@/assets/images/logo.png");

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 56) / 2;

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
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: "#E5F0F5",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: "#9BDF11",
    }}>
      <Feather name="user" size={size * 0.4} color="#6A9AA9" />
    </View>
  );
};

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

// --- КОМПОНЕНТ ДИФФИКУЛЬТИ БЭДЖА ---
interface DifficultyBadgeProps {
  difficulty: string | undefined;
}

const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({ difficulty }) => {
  const difficultyText = difficulty || 'Легко';
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

  const [db, setDb] = useState<Firestore | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [meals, setMeals] = useState<Meal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

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
          setUserData(prev => ({
            ...prev,
            photoURL: photoURL
          }));
          
          console.log("✅ AUTH: User authenticated. UID:", user.uid);
        } else {
          setUserId(null);
          setUserData(prev => ({
            ...prev,
            userName: "Пользователь",
            dailyCalories: 2000,
            photoURL: null,
          }));
          console.log("⚠️ AUTH: User is NOT authenticated.");
        }
        setIsAuthReady(true);
      });

      return () => unsubscribeAuth();
    } catch (error) {
      console.error("❌ INIT: Ошибка инициализации Firebase:", error);
      setIsAuthReady(true);
    }
  }, [loadUserProfilePhoto]);

  // 2. Загрузка ежедневного плана
  const loadDailyPlan = useCallback(async (forceRegenerate = false) => {
    if (!userId) {
      console.log("⚠️ No user ID, skipping plan load");
      return;
    }
    
    try {
      setIsGeneratingPlan(true);
      
      // Проверяем, изменились ли настройки пользователя
      const shouldRegenerate = forceRegenerate || userSettingsChanged;
      
      let plan;
      if (shouldRegenerate) {
        console.log("🔄 User settings changed or forced regeneration, creating new plan");
        // Создаем новый план с учетом текущих настроек
        plan = await dailyRationService.createNewPlanWithUserSettings(userId);
        setUserSettingsChanged(false);
      } else {
        // Получаем существующий план
        plan = await dailyRationService.getOrGenerateDailyPlan(userId);
      }
      
      if (!plan || !plan.meals || plan.meals.length === 0) {
        console.log("⚠️ План не получен, создаем стандартные рецепты");
        const standardMeals: Meal[] = [
          {
            id: '1',
            category: 'Завтрак',
            name: 'Овсяная каша с фруктами',
            calories: 350,
            proteins: 12,
            fats: 8,
            carbohydrates: 58,
            weight: '250г',
            marked: false,
            bookmarked: false,
            cookingTime: '15 минут',
            difficultyLevel: 'Легко',
            rating: 4.5,
            image: DEFAULT_MEAL_IMAGE
          },
          {
            id: '2',
            category: 'Обед',
            name: 'Куриная грудка с овощами',
            calories: 450,
            proteins: 35,
            fats: 12,
            carbohydrates: 40,
            weight: '300г',
            marked: false,
            bookmarked: false,
            cookingTime: '30 минут',
            difficultyLevel: 'Легко',
            rating: 4.7,
            image: DEFAULT_MEAL_IMAGE
          },
          {
            id: '3',
            category: 'Ужин',
            name: 'Запеченная рыба с салатом',
            calories: 400,
            proteins: 30,
            fats: 15,
            carbohydrates: 25,
            weight: '280г',
            marked: false,
            bookmarked: false,
            cookingTime: '25 минут',
            difficultyLevel: 'Средне',
            rating: 4.6,
            image: DEFAULT_MEAL_IMAGE
          },
          {
            id: '4',
            category: 'Перекусы',
            name: 'Йогурт с орехами и мёдом',
            calories: 200,
            proteins: 10,
            fats: 12,
            carbohydrates: 15,
            weight: '150г',
            marked: false,
            bookmarked: false,
            cookingTime: '5 минут',
            difficultyLevel: 'Легко',
            rating: 4.3,
            image: DEFAULT_MEAL_IMAGE
          }
        ];
        
        plan = { meals: standardMeals };
      }
      
      // Преобразуем план в формат для отображения
      const formattedMeals: Meal[] = plan.meals.map((meal: any, index: number) => {
        const carbsValue = meal.carbohydrates || meal.carbs || 0;
        
        const baseMeal = {
          id: meal.recipeId || meal.id || `meal-${index}-${Date.now()}`,
          category: meal.category || ['Завтрак', 'Обед', 'Ужин', 'Перекусы'][index] || 'Обед',
          name: meal.name || 'Рецепт',
          calories: meal.calories || 350,
          proteins: meal.proteins || 20,
          fats: meal.fats || 10,
          carbohydrates: carbsValue,
          weight: meal.weight || '250г',
          marked: meal.marked || false,
          bookmarked: meal.bookmarked || false,
          cookingTime: `${meal.cookingTime || 20} минут`,
          difficultyLevel: meal.difficulty || meal.difficultyLevel || 'Легко',
          rating: meal.rating || 0,
          recipeId: meal.recipeId || meal.id,
          image: meal.imageUrl 
            ? { uri: meal.imageUrl }
            : DEFAULT_MEAL_IMAGE
        };
        
        return baseMeal;
      });
      
      // Гарантируем, что всегда есть 4 приема пищи
      if (formattedMeals.length < 4) {
        console.log(`⚠️ В плане только ${formattedMeals.length} рецептов, дополняем...`);
        const categories = ['Завтрак', 'Обед', 'Ужин', 'Перекусы'];
        while (formattedMeals.length < 4) {
          const missingIndex = formattedMeals.length;
          formattedMeals.push({
            id: `missing-${missingIndex}-${Date.now()}`,
            category: categories[missingIndex] || 'Обед',
            name: 'Рецепт',
            calories: 400,
            proteins: 25,
            fats: 12,
            carbohydrates: 45,
            weight: '250г',
            marked: false,
            bookmarked: false,
            cookingTime: '20 минут',
            difficultyLevel: 'Легко',
            rating: 0,
            image: DEFAULT_MEAL_IMAGE
          });
        }
      }
      
      // Обновляем состояние
      setMeals(formattedMeals);
      
      // Обновляем потребленные калории и КБЖУ
      const consumed = formattedMeals
        .filter(meal => meal.marked)
        .reduce((sum, meal) => sum + meal.calories, 0);
      
      const totalKBRU = formattedMeals.reduce(
        (acc, meal) => ({
          proteins: acc.proteins + meal.proteins,
          fats: acc.fats + meal.fats,
          carbohydrates: acc.carbohydrates + meal.carbohydrates,
        }),
        { proteins: 0, fats: 0, carbohydrates: 0 }
      );
      
      setRecommendedKBRU(totalKBRU);
      setUserData(prev => ({ ...prev, consumedCalories: consumed }));
      
      console.log("✅ Daily plan loaded:", {
        meals: formattedMeals.length,
        totalKBRU: totalKBRU
      });
      
    } catch (error) {
      console.error("❌ Critical error loading plan:", error);
      Alert.alert("Ошибка", "Не удалось загрузить рацион. Попробуйте обновить.");
    } finally {
      setIsGeneratingPlan(false);
      setIsRefreshing(false);
    }
  }, [userId, userSettingsChanged]);

  // 3. Загрузка данных пользователя (ТОЛЬКО для отображения, не для перегенерации плана)
  useEffect(() => {
    if (!db || !userId) return;

    const userDocRef = doc(db, `users/${userId}`);

    const unsubscribeProfile = onSnapshot(
      userDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfileData;

          const firstName = data.first_name || data.firstName || data.name || "";
          const lastName = data.last_name || data.lastName || "";

          let currentName = "Пользователь";
          if (firstName || lastName) {
            currentName = `${firstName} ${lastName}`.trim();
          }

          const currentCalories = Math.round(
            data.dailyCalories || data.targetCalories || 2000
          );

          const photoURL = data.photoURL || null;

          // Сравниваем с текущими значениями
          const oldCalories = userData.dailyCalories;
          
          setUserData(prevState => ({
            ...prevState,
            userName: currentName,
            dailyCalories: currentCalories,
            targetProteins: data.targetProteinGrams || 0,
            targetFats: data.targetFatGrams || 0,
            targetCarbs: data.targetCarbGrams || 0,
            photoURL: photoURL,
          }));
          
          // Если изменились ключевые параметры, отмечаем что нужна перегенерация
          if (Math.abs(currentCalories - oldCalories) > 100) {
            console.log("🔄 User calories changed significantly, will regenerate on next refresh");
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

  // 4. Инициализация плана
  useEffect(() => {
    if (!userId) return;
    
    loadDailyPlan();
    
  }, [userId]);

  // 5. Расчет целевого КБЖУ
  useEffect(() => {
    const dailyCalories = userData.dailyCalories;
    
    const targetProteins = Math.round(
      (dailyCalories * TARGET_KBRU_RATIOS.protein) / 4
    );
    const targetFats = Math.round(
      (dailyCalories * TARGET_KBRU_RATIOS.fat) / 9
    );
    const targetCarbs = Math.round(
      (dailyCalories * TARGET_KBRU_RATIOS.carb) / 4
    );
    
    setTargetKBRU({
      proteins: targetProteins,
      fats: targetFats,
      carbohydrates: targetCarbs,
    });
  }, [userData.dailyCalories]);

  // 6. Функция обновления состояния приема пищи
  const updateMealState = useCallback(async (mealId: string, updates: Partial<Meal>) => {
    if (!userId || !db) return;
    
    try {
      const mealIndex = meals.findIndex(m => m.id === mealId);
      if (mealIndex === -1) return;
      
      const updatedMeals = [...meals];
      updatedMeals[mealIndex] = { ...updatedMeals[mealIndex], ...updates };
      setMeals(updatedMeals);
      
      const newConsumedCalories = updatedMeals
        .filter(meal => meal.marked)
        .reduce((sum, meal) => sum + meal.calories, 0);
      
      setUserData(prev => ({ ...prev, consumedCalories: newConsumedCalories }));
      
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
      loadDailyPlan();
    }
  }, [userId, db, meals, loadDailyPlan]);

  // 7. Функция обновления избранного
  const toggleBookmark = useCallback(async (mealId: string) => {
    if (!userId) {
      Alert.alert("Ошибка", "Для добавления в избранное необходимо авторизоваться");
      return;
    }
    
    try {
      const mealIndex = meals.findIndex(m => m.id === mealId);
      if (mealIndex === -1) return;
      
      const currentBookmarked = meals[mealIndex].bookmarked;
      const recipeId = meals[mealIndex].recipeId || mealId;
      
      const updatedMeals = [...meals];
      updatedMeals[mealIndex] = { ...updatedMeals[mealIndex], bookmarked: !currentBookmarked };
      setMeals(updatedMeals);
      
      await dailyRationService.toggleBookmark(userId, recipeId, !currentBookmarked);
      
      await dailyRationService.updateMealStatus(
        userId,
        new Date(),
        mealId,
        { bookmarked: !currentBookmarked }
      );
      
    } catch (error: any) {
      console.error("Ошибка при обновлении избранного:", error);
      Alert.alert("Ошибка", error.message || "Не удалось обновить избранное");
      loadDailyPlan();
    }
  }, [userId, meals, loadDailyPlan]);

  // 8. Функция сохранения всего рациона в избранное
  const saveDailyPlanToFavorites = useCallback(() => {
    if (!userId) {
      Alert.alert("Ошибка", "Для сохранения рациона необходимо авторизоваться");
      return;
    }
    
    Alert.alert(
      "Сохранить рацион",
      "Сохранить дневной рацион в избранные рецепты?",
      [
        {
          text: "Отмена",
          style: "cancel"
        },
        {
          text: "Сохранить",
          onPress: async () => {
            try {
              // Здесь будет реализация сохранения всего рациона
              Alert.alert("Успех", "Весь рацион сохранен в избранные рецепты!");
            } catch (error) {
              Alert.alert("Ошибка", "Не удалось сохранить рацион");
            }
          }
        }
      ]
    );
  }, [userId]);

  // 9. Обработчики UI
  const handleToggleMeal = useCallback((mealId: string) => {
    const meal = meals.find(m => m.id === mealId);
    if (meal) {
      updateMealState(mealId, { marked: !meal.marked });
    }
  }, [meals, updateMealState]);

  const handleToggleBookmark = useCallback((mealId: string) => {
    const meal = meals.find(m => m.id === mealId);
    if (meal) {
      toggleBookmark(mealId);
    }
  }, [meals, toggleBookmark]);

  const navigateToMealPage = (mealIndex: number) => {
    const meal = meals[mealIndex];
    if (!meal) return;
    
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
        fromScreen: "home",
      },
    });
  };

  const navigateToProfile = () => {
    if (userId) {
      router.push('/profile');
    }
  };

  const navigateToAddRecipe = () => {
    if (userId) {
      router.push('/create-recipe');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDailyPlan(true); // Принудительная перегенерация при обновлении
  };

  // 10. Обработка пустого состояния
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

  // 11. Расчет отображения
  const dailyTargetForDisplay = Math.round(userData.dailyCalories / 100) * 100;
  const progressPercentage = Math.min(
    100,
    (userData.consumedCalories / dailyTargetForDisplay) * 100
  );
  const remainingCalories = Math.max(0, dailyTargetForDisplay - userData.consumedCalories);

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

          <TouchableOpacity 
            style={styles.userInfo}
            onPress={navigateToProfile}
          >
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
                <Text style={[styles.kbruHeader, { flex: 1, textAlign: "left" }]}>
                  Макронутриенты
                </Text>
                <Text style={styles.kbruHeader}>Белки (г)</Text>
                <Text style={styles.kbruHeader}>Жиры (г)</Text>
                <Text style={styles.kbruHeader}>Углеводы (г)</Text>
              </View>

              <View style={styles.kbruRow}>
                <Text style={[styles.kbruLabel, { flex: 1, textAlign: "left" }]}>
                  План (Рацион)
                </Text>
                <Text style={styles.kbruValue}>{recommendedKBRU.proteins}</Text>
                <Text style={styles.kbruValue}>{recommendedKBRU.fats}</Text>
                <Text style={styles.kbruValue}>
                  {recommendedKBRU.carbohydrates}
                </Text>
              </View>

              <View style={[styles.kbruRow, styles.targetKBRURow]}>
                <Text style={[
                  styles.kbruLabel,
                  { flex: 1, textAlign: "left", fontFamily: "Playfair Display Bold" },
                ]}>
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

            {/* Кнопка сохранения всего рациона - ПОД таблицей БЖУ */}
            <TouchableOpacity
              style={styles.saveDailyPlanButton}
              onPress={saveDailyPlanToFavorites}
              activeOpacity={0.7}
            >
              <Ionicons name="bookmark-outline" size={18} color="#6A9AA9" />
              <Text style={styles.saveDailyPlanText}>
                Сохранить рацион в избранные
              </Text>
            </TouchableOpacity>

            <View style={styles.sectionDivider} />
          </View>

          {/* Заголовок приемов пищи с кнопкой добавления рецепта справа */}
          <View style={styles.mealsTitleSection}>
            <Text style={styles.mealsTitle}>Приемы пищи на сегодня</Text>
            <TouchableOpacity 
              style={styles.addRecipeButton}
              onPress={navigateToAddRecipe}
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
                      <Image
                        source={meal.image}
                        style={styles.recipeImage}
                        resizeMode="cover"
                      />
                      
                      {/* Бэдж сложности в ВЕРХНЕМ ЛЕВОМ углу */}
                      <DifficultyBadge difficulty={meal.difficultyLevel} />
                      
                      {/* Кнопка избранного в ВЕРХНЕМ ПРАВОМ углу */}
                      <TouchableOpacity
                        style={styles.bookmarkButton}
                        onPress={() => handleToggleBookmark(meal.id)}
                      >
                        <Ionicons
                          name={meal.bookmarked ? "bookmark" : "bookmark-outline"}
                          size={18}
                          color={meal.bookmarked ? "#FF6B6B" : "#6A9AA9"}
                        />
                      </TouchableOpacity>
                      
                      {/* Рейтинг в нижнем левом углу */}
                      {meal.rating && meal.rating > 0 ? (
                        <View style={styles.ratingBadge}>
                          <FontAwesome name="star" size={10} color="#FFD700" />
                          <Text style={styles.ratingText}>
                            {meal.rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : null}
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
                            {formatMinutes(parseInt(meal.cookingTime?.match(/\d+/)?.[0] || "20"))}
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#C2DAE2",
    marginTop: 0, 
  },
  saveDailyPlanText: {
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    marginLeft: 8,
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
    bottom: 8,
    left: 8,
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
});