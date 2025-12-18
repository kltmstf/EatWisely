import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import { favoriteService } from "@/app/services/favoriteService";
import { auth } from "@/app/firebase/config";
import { FontAwesome } from "@expo/vector-icons";

// --- ТИПЫ ДАННЫХ ---
type ProfileData = {
  name: string;
  description: string;
  age: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  nutritionType: string;
  allergies: string;
  dislikes: string;
  isPrivate: boolean;
  email: string;
  customNutritionType: string;
  cookingTimeLimit: string;
  isProfileFilled: boolean;
  photoURL?: string | null; // Изменено: теперь photoURL вместо avatarUri
  cloudinaryPublicId?: string; // Добавлено для Cloudinary
};

type Recipe = {
  id: string;
  name: string;
  category: string;
  calories: number;
  cookingTime: string;
  image: any;
  bookmarked: boolean;
  rating: number;
  difficulty: string;
};

type Plan = {
  id: string;
  name: string;
  description: string;
  totalCalories: number;
  duration: string;
  mealsCount: number;
  image: any;
  savedDate: string;
};

const PROFILE_STORAGE_KEY = "user_profile_data";
const PROFILE_SETUP_KEY = "profile_setup_complete";

// Размеры для карточек
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

// Функция для правильного склонения слова "минута"
const formatMinutes = (minutes: number): string => {
  const absMinutes = Math.abs(minutes);
  const lastDigit = absMinutes % 10;
  const lastTwoDigits = absMinutes % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${absMinutes} минут`;
  if (lastDigit === 1) return `${absMinutes} минута`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${absMinutes} минуты`;
  return `${absMinutes} минут`;
};

// Функция для получения названия категории по mealType
const getCategoryName = (mealType: string) => {
  if (!mealType) return "Другое";
  
  const normalizedMealType = String(mealType).trim().toLowerCase();
  
  switch (normalizedMealType) {
    case "breakfast":
    case "завтрак":
      return "Завтрак";
    case "lunch":
    case "обед":
      return "Обед";
    case "dinner":
    case "ужин":
      return "Ужин";
    case "snack":
    case "перекусы":
      return "Перекусы";
    default:
      return "Другое";
  }
};

// --- ДАННЫЕ ПО УМОЛЧАНИЮ ---
const defaultProfileData: ProfileData = {
  name: "Пользователь",
  email: "",
  description: "",
  age: "",
  height: "",
  gender: "Муж",
  weight: "",
  goal: "Поддержание веса",
  activity: "Низкий (0-1 тренировка в неделю)",
  nutritionType: "Обычное",
  customNutritionType: "",
  allergies: "",
  dislikes: "",
  isPrivate: false,
  cookingTimeLimit: "30 мин",
  isProfileFilled: false,
};

export default function ProfileScreen() {
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData>(defaultProfileData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "saved">("profile");
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [savedPlans, setSavedPlans] = useState<Plan[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);

  // --- ФУНКЦИЯ ЗАГРУЗКИ ИЗБРАННОГО ИЗ БД ---
  const loadFavoritesFromDB = useCallback(async () => {
    if (!auth.currentUser) {
      console.log("Пользователь не авторизован, пропускаем загрузку избранного");
      setFavoriteRecipes([]);
      setSavedPlans([]);
      return;
    }

    setFavoritesLoading(true);
    try {
      console.log("Загрузка избранного для профиля...");
      
      const allFavorites = await favoriteService.getUserFavorites();
      console.log("Получено избранных:", allFavorites?.length || 0);

      if (!allFavorites || allFavorites.length === 0) {
        console.log("Избранное пустое");
        setFavoriteRecipes([]);
        setSavedPlans([]);
        return;
      }

      const recipes: Recipe[] = [];
      const plans: Plan[] = [];

      allFavorites.forEach((fav: any) => {
        if (fav.favoriteType === 'recipe' && fav.item) {
          const recipeData = fav.item;
          
          // Название рецепта
          const title = recipeData.title || recipeData.fields?.title || recipeData.name || "Рецепт без названия";
          
          // Категория - получаем из mealType или fields
          const rawCategory = recipeData.mealType || recipeData.fields?.mealType || "other";
          const category = getCategoryName(rawCategory);
          
          // Калории
          let calories = 0;
          if (recipeData.fields?.calories !== undefined) calories = recipeData.fields.calories;
          else if (recipeData.calories !== undefined) calories = recipeData.calories;
          else if (recipeData.fields?.fscts !== undefined) calories = recipeData.fields.fscts;
          
          // Время приготовления - безопасное получение и форматирование
          let cookingTime = "20 минут";
          
          // Пробуем получить время из разных источников
          const rawTime = recipeData.fields?.cookingTime || recipeData.cookingTime || recipeData.time;
          
          if (rawTime) {
            // Если это число, форматируем его
            if (typeof rawTime === 'number') {
              cookingTime = formatMinutes(rawTime);
            } else {
              // Если это строка, используем как есть
              cookingTime = String(rawTime);
              // Добавляем "минут" если нужно
              if (cookingTime && !cookingTime.includes("мин") && !cookingTime.includes("минут")) {
                // Пытаемся извлечь только число из строки
                const timeMatch = cookingTime.match(/\d+/);
                if (timeMatch) {
                  cookingTime = formatMinutes(parseInt(timeMatch[0], 10));
                } else {
                  cookingTime = `${cookingTime} минут`;
                }
              }
            }
          }
          
          // Рейтинг
          const rating = recipeData.rating || recipeData.fields?.rating || recipeData.ratingCount || 0;
          
          // Сложность приготовления - из разных полей
          let difficulty = "Легко";
          const rawDifficulty = recipeData.difficulty || recipeData.fields?.difficulty || recipeData.complexity || recipeData.difficultyLevel;
          
          if (rawDifficulty) {
            const normalizedDifficulty = String(rawDifficulty).trim();
            // Проверяем разные варианты написания
            if (normalizedDifficulty.toLowerCase().includes("легк") || normalizedDifficulty === "Easy") {
              difficulty = "Легко";
            } else if (normalizedDifficulty.toLowerCase().includes("средн") || normalizedDifficulty === "Medium") {
              difficulty = "Средне";
            } else if (normalizedDifficulty.toLowerCase().includes("сложн") || normalizedDifficulty === "Hard") {
              difficulty = "Сложно";
            } else {
              difficulty = normalizedDifficulty;
            }
          }
          
          // Изображение
          let imageUri = null;
          if (recipeData.fields?.image) imageUri = recipeData.fields.image;
          else if (recipeData.image) imageUri = recipeData.image;
          else if (recipeData.imageUrl) imageUri = recipeData.imageUrl;
          else if (recipeData.fields?.langdir1) imageUri = recipeData.fields.langdir1;
          
          const recipe: Recipe = {
            id: recipeData.id || `recipe-${Date.now()}`,
            name: title,
            category: category,
            calories: calories,
            cookingTime: cookingTime,
            image: imageUri 
              ? { uri: imageUri }
              : require("@/assets/images/dinner-rice.png"),
            bookmarked: true,
            rating: rating,
            difficulty: difficulty
          };
          
          recipes.push(recipe);
          
        } else if (fav.favoriteType === 'ration' && fav.item) {
          const planData = fav.item;
          const plan: Plan = {
            id: planData.id || `plan-${Date.now()}`,
            name: planData.name || planData.title || "План без названия",
            description: planData.description || planData.fields?.description || "Описание отсутствует",
            totalCalories: planData.totalCalories || planData.fields?.totalCalories || 0,
            duration: planData.duration || planData.fields?.duration || "0 дней",
            mealsCount: planData.mealsCount || planData.fields?.mealsCount || 0,
            image: planData.image || planData.fields?.image 
              ? { uri: planData.image || planData.fields?.image }
              : require("@/assets/images/dinner-rice.png"),
            savedDate: fav.createdAt && fav.createdAt.seconds
              ? new Date(fav.createdAt.seconds * 1000).toLocaleDateString("ru-RU")
              : new Date().toLocaleDateString("ru-RU")
          };
          plans.push(plan);
        }
      });

      console.log(`Загружено ${recipes.length} рецептов и ${plans.length} планов`);
      setFavoriteRecipes(recipes);
      setSavedPlans(plans);
    } catch (error) {
      console.error("Ошибка при загрузке избранного:", error);
      setFavoriteRecipes([]);
      setSavedPlans([]);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  // --- ЛОГИКА ЗАГРУЗКИ ПРОФИЛЯ ---
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Загружаем данные из AsyncStorage
      const [storedProfile, setupStatus] = await Promise.all([
        AsyncStorage.getItem(PROFILE_STORAGE_KEY),
        AsyncStorage.getItem(PROFILE_SETUP_KEY),
      ]);

      let profileFromStorage: ProfileData = defaultProfileData;
      
      if (storedProfile) {
        try {
          const parsedData = JSON.parse(storedProfile);
          profileFromStorage = { ...defaultProfileData, ...parsedData };
        } catch (parseError) {
          console.error("Ошибка парсинга профиля из AsyncStorage:", parseError);
        }
      }

      // 2. Пробуем загрузить фото из Firebase Auth (если пользователь авторизован)
      if (auth.currentUser) {
        const authUser = auth.currentUser;
        
        // Получаем имя из Auth, если его нет в хранилище
        if (!profileFromStorage.name || profileFromStorage.name === "Пользователь") {
          profileFromStorage.name = authUser.displayName || 
                                   authUser.email?.split('@')[0] || 
                                   "Пользователь";
        }
        
        // Получаем email из Auth, если его нет в хранилище
        if (!profileFromStorage.email) {
          profileFromStorage.email = authUser.email || "";
        }
        
        // Получаем фото из Firebase Auth (приоритет 1)
        if (authUser.photoURL && !profileFromStorage.photoURL) {
          profileFromStorage.photoURL = authUser.photoURL;
        }
        
        // 3. Пробуем загрузить из Firestore через userService (приоритет 2)
        try {
          // Импортируем userService внутри функции
          const { userService } = require("@/app/services/userService");
          const firestoreData = await userService.fetchUserProfile(authUser.uid);
          
          if (firestoreData) {
            // Обновляем фото из Firestore, если есть
            if (firestoreData.photoURL && !profileFromStorage.photoURL) {
              profileFromStorage.photoURL = firestoreData.photoURL;
            }
            
            // Обновляем другие данные из Firestore
            profileFromStorage = {
              ...profileFromStorage,
              name: firestoreData.name || profileFromStorage.name,
              email: firestoreData.email || profileFromStorage.email,
              description: firestoreData.description || profileFromStorage.description,
              age: firestoreData.age || profileFromStorage.age,
              height: firestoreData.height || profileFromStorage.height,
              gender: firestoreData.gender || profileFromStorage.gender,
              weight: firestoreData.weight || profileFromStorage.weight,
              goal: firestoreData.goal || profileFromStorage.goal,
              activity: firestoreData.activity || profileFromStorage.activity,
              nutritionType: firestoreData.dietType || firestoreData.nutritionType || profileFromStorage.nutritionType,
              allergies: firestoreData.allergies || profileFromStorage.allergies,
              dislikes: firestoreData.excludedIngredients || firestoreData.dislikes || profileFromStorage.dislikes,
              isPrivate: firestoreData.isProfilePrivate ?? profileFromStorage.isPrivate,
              cookingTimeLimit: firestoreData.cookingTimeLimit || profileFromStorage.cookingTimeLimit,
              isProfileFilled: firestoreData.isProfileFilled ?? profileFromStorage.isProfileFilled,
              cloudinaryPublicId: firestoreData.cloudinaryPublicId || profileFromStorage.cloudinaryPublicId,
            };
          }
        } catch (firestoreError) {
          console.error("Ошибка загрузки профиля из Firestore:", firestoreError);
          // Продолжаем с данными из AsyncStorage
        }
      }

      setProfileData(profileFromStorage);
      setProfileCompleted(setupStatus === "true");
      
      // 4. Загружаем избранное
      await loadFavoritesFromDB();
      
    } catch (error) {
      console.error("Не удалось загрузить профиль:", error);
      setProfileData(defaultProfileData);
    } finally {
      setLoading(false);
    }
  }, [loadFavoritesFromDB]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  // --- РАССЧИТЫВАЕМЫЕ ЗНАЧЕНИЯ ---
  const primaryInfo = useMemo(
    () => [
      {
        label: "Возраст",
        value: profileData.age ? `${profileData.age} лет` : "-",
      },
      {
        label: "Рост",
        value: profileData.height ? `${profileData.height} см` : "-",
      },
      {
        label: "Вес",
        value: profileData.weight ? `${profileData.weight} кг` : "-",
      },
      { label: "Пол", value: profileData.gender || "-" },
    ],
    [
      profileData.age,
      profileData.height,
      profileData.weight,
      profileData.gender,
    ]
  );

  const preferences = useMemo(
    () => [
      { label: "Цель", value: profileData.goal || "-" },
      { label: "Активность", value: profileData.activity || "-" },
      { label: "Тип питания", value: profileData.nutritionType || "-" },
      { label: "Аллергии", value: profileData.allergies || "Нет" },
      { label: "Нелюбимые продукты", value: profileData.dislikes || "Нет" },
    ],
    [
      profileData.goal,
      profileData.activity,
      profileData.nutritionType,
      profileData.allergies,
      profileData.dislikes,
    ]
  );

  const userName = profileData.name || "Пользователь";

  const profileTypeLabel = profileData.isPrivate
    ? "Приватный профиль"
    : "Публичный профиль";
  const profileTypeDescription = profileData.isPrivate
    ? "Ваш профиль и данные видны только вам."
    : "Другие пользователи могут просматривать ваши данные и рекомендации.";

  // --- ОБРАБОТЧИКИ ---
  const handleEdit = () => {
    router.push("/profile-settings");
  };

  const handleNavigationStub = (path: string) => {
    console.log(`Navigating to: ${path}`);
  };

  const toggleBookmark = async (recipeId: string) => {
    try {
      console.log(`Удаление рецепта ${recipeId} из избранного...`);
      await favoriteService.removeFromFavorites(recipeId, 'recipe');
      
      setFavoriteRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
      console.log(`Рецепт ${recipeId} удален из избранного`);
    } catch (error) {
      console.error("Ошибка при удалении из избранного:", error);
    }
  };

  const navigateToRecipe = (recipe: Recipe) => {
    console.log(`Переход к рецепту: ${recipe.name}`);
    router.push({
      pathname: "/meal",
      params: {
        mealId: recipe.id,
        mealName: recipe.name,
        category: recipe.category,
        initialBookmarked: recipe.bookmarked.toString(),
      },
    });
  };

  const navigateToAllRecipes = () => {
    router.push("/saved-recipes");
  };

  const navigateToAllPlans = () => {
    router.push("/saved-plans");
  };

  const getDifficultyColor = (difficulty: string) => {
    if (!difficulty) return "#6A9AA9";
    
    const lowerDifficulty = difficulty.toLowerCase();
    if (lowerDifficulty.includes("легк")) return "#4CAF50";
    if (lowerDifficulty.includes("средн")) return "#FF9800";
    if (lowerDifficulty.includes("сложн")) return "#F44336";
    return "#6A9AA9";
  };

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
  const renderMenuItem = (
    iconName: string,
    label: string,
    onPress: () => void
  ) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconContainer}>
        <Ionicons name={iconName as any} size={24} color="#555" />
      </View>
      <Text style={styles.menuItemText}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  // --- КОМПОНЕНТ АВАТАРА С ФОТО ИЛИ ЗАГЛУШКОЙ ---
  const AvatarComponent = () => {
    if (profileData.photoURL) {
      return (
        <Image
          source={{ uri: profileData.photoURL }}
          style={styles.avatarImage}
          resizeMode="cover"
        />
      );
    }
    
    // Заглушка, если фото нет
    return (
      <Ionicons name="person" size={48} color="#6A9AA9" />
    );
  };

  // --- РЕНДЕР КАРТОЧКИ РЕЦЕПТА ---
  const renderRecipeCard = (recipe: Recipe) => (
    <View key={recipe.id} style={styles.recipeColumn}>
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => navigateToRecipe(recipe)}
      >
        <View style={styles.imageContainer}>
          <Image
            source={recipe.image}
            style={styles.recipeImage}
            resizeMode="cover"
          />
          {/* Бейджи рейтинга и сложности */}
          <View style={styles.recipeBadges}>
            {recipe.rating && recipe.rating > 0 ? (
              <View style={styles.ratingBadge}>
                <FontAwesome name="star" size={10} color="#FFD700" />
                <Text style={styles.ratingText}>
                  {recipe.rating.toFixed(1)}
                </Text>
              </View>
            ) : null}
            <View
              style={[
                styles.difficultyBadge,
                {
                  backgroundColor: getDifficultyColor(recipe.difficulty),
                },
              ]}
            >
              <Text style={styles.difficultyText}>
                {recipe.difficulty}
              </Text>
            </View>
          </View>
          {/* Кнопка закладки */}
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={() => toggleBookmark(recipe.id)}
          >
            <Ionicons
              name="bookmark"
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
              {recipe.name}
            </Text>
            {/* Категория */}
            <Text style={styles.recipeCategory}>
              {recipe.category}
            </Text>
            <View style={styles.recipeDetails}>
              {/* Калории */}
              {recipe.calories && recipe.calories > 0 ? (
                <Text style={styles.recipeCalories}>
                  {recipe.calories} ккал
                </Text>
              ) : null}
              <Ionicons
                name="time-outline"
                size={12}
                color="#6A9AA9"
                style={styles.timeIcon}
              />
              <Text style={styles.recipeTime}>
                {recipe.cookingTime}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => navigateToRecipe(recipe)}
          >
            <Text style={styles.viewButtonText}>Посмотреть</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );

  // --- РЕНДЕР ВКЛАДКИ "ПРОФИЛЬ" ---
  const renderProfileTab = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <AvatarComponent />
        </View>
        <Text style={styles.nameText}>{userName}</Text>
        <Text style={styles.descriptionText}>
          {profileData.description || "Вы еще не рассказали о себе"}
        </Text>
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Ionicons name="create-outline" size={18} color="#000" />
          <Text style={styles.editButtonText}>Редактировать</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitleProfile}>Тип профиля</Text>
        <View style={styles.profileTypeCard}>
          <View style={styles.profileTypeHeader}>
            <Ionicons
              name={
                profileData.isPrivate ? "lock-closed-outline" : "earth-outline"
              }
              size={22}
              color="#555"
            />
            <Text style={styles.profileTypeLabel}>{profileTypeLabel}</Text>
          </View>
          <Text style={styles.profileTypeDescription}>
            {profileTypeDescription}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitleProfile}>Сообщество</Text>
        <View style={styles.communityMenu}>
          {renderMenuItem(
            "restaurant-outline",
            "Опубликованные рецепты (12)",
            () => handleNavigationStub("/my-recipes")
          )}
          {renderMenuItem("people-outline", "Подписки (8)", () =>
            handleNavigationStub("/following")
          )}
          {renderMenuItem("person-add-outline", "Подписчики (55)", () =>
            handleNavigationStub("/followers")
          )}
          {renderMenuItem("grid-outline", "Публикации (4)", () =>
            handleNavigationStub("/posts")
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitleProfile}>Основные данные</Text>
        <View style={styles.infoGrid}>
          {primaryInfo.map((item) => (
            <View key={item.label} style={styles.infoCard}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitleProfile}>Предпочтения</Text>
        <View style={styles.preferences}>
          {preferences.map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.preferenceRow,
                index === preferences.length - 1 && styles.preferenceRowLast,
              ]}
            >
              <Text style={styles.preferenceLabel}>{item.label}</Text>
              <Text style={styles.preferenceValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  // --- РЕНДЕР ВКЛАДКИ "СОХРАНЕННЫЕ" ---
  const renderSavedTab = () => (
    <ScrollView
      style={styles.savedContainer}
      contentContainerStyle={styles.savedContentContainer}
      showsVerticalScrollIndicator={false}
    >
      {favoritesLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loaderText}>Загружаем избранное...</Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={navigateToAllRecipes}
            >
              <Text style={styles.sectionTitle}>
                Рецепты ({favoriteRecipes.length})
              </Text>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </TouchableOpacity>

            {favoriteRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={48} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>В сохраненных пока пусто</Text>
                <Text style={styles.emptyText}>
                  Сохраняйте рецепты, нажимая на значок закладки
                </Text>
              </View>
            ) : (
              <View style={styles.recipesGrid}>
                {favoriteRecipes.slice(0, 4).map((recipe) => renderRecipeCard(recipe))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={navigateToAllPlans}
            >
              <Text style={styles.sectionTitle}>Рационы ({savedPlans.length})</Text>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </TouchableOpacity>

            {savedPlans.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>Нет сохраненных планов</Text>
                <Text style={styles.emptyText}>
                  Сохраняйте понравившиеся планы питания
                </Text>
              </View>
            ) : (
              <View style={styles.plansList}>
                {savedPlans.slice(0, 2).map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.planCard}
                    onPress={() => console.log("View Plan")}
                  >
                    <Image
                      source={plan.image}
                      style={styles.planImage}
                      resizeMode="cover"
                    />
                    <View style={styles.planContent}>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.planDescription}>{plan.description}</Text>
                      <View style={styles.planDetails}>
                        <View style={styles.planDetail}>
                          <Ionicons
                            name="flame-outline"
                            size={14}
                            color="#FF6B6B"
                          />
                          <Text style={styles.planDetailText}>
                            {plan.totalCalories} ккал/день
                          </Text>
                        </View>
                        <View style={styles.planDetail}>
                          <Ionicons name="time-outline" size={14} color="#6A9AA9" />
                          <Text style={styles.planDetailText}>{plan.duration}</Text>
                        </View>
                        <View style={styles.planDetail}>
                          <Ionicons name="restaurant-outline" size={14} color="#9BDF11" />
                          <Text style={styles.planDetailText}>{plan.mealsCount} приёмов</Text>
                        </View>
                      </View>
                      <View style={styles.planFooter}>
                        <Text style={styles.planDate}>
                          Сохранено: {plan.savedDate}
                        </Text>
                        <TouchableOpacity style={styles.usePlanButton}>
                          <Text style={styles.usePlanButtonText}>Использовать</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "profile" && styles.tabActive]}
          onPress={() => setActiveTab("profile")}
        >
          <Ionicons
            name="person-outline"
            size={20}
            color={activeTab === "profile" ? "#6A9AA9" : "#666"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "profile" && styles.tabTextActive,
            ]}
          >
            Профиль
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "saved" && styles.tabActive]}
          onPress={() => setActiveTab("saved")}
        >
          <Ionicons
            name="bookmark-outline"
            size={20}
            color={activeTab === "saved" ? "#6A9AA9" : "#666"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "saved" && styles.tabTextActive,
            ]}
          >
            Сохраненные
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loaderText}>Загружаем данные...</Text>
        </View>
      ) : (
        <>
          {activeTab === "profile" && renderProfileTab()}
          {activeTab === "saved" && renderSavedTab()}
        </>
      )}
    </View>
  );
}

// --- СТИЛИ ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#6A9AA9",
    fontWeight: "600",
  },

  savedContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  savedContentContainer: {
    paddingVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 20,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
  },

  // СТИЛИ ДЛЯ РЕЦЕПТОВ
  recipesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
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
    fontWeight: "bold",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    marginLeft: 2,
  },
  difficultyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Playfair Display Regular",
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
    fontWeight: "600",
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
    fontWeight: "normal",
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
  viewButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    marginTop: 8,
  },
  viewButtonText: {
    color: "#000000ff",
    fontSize: 12,
    fontWeight: "normal",
    fontFamily: "Playfair Display Regular",
  },

  // СТИЛИ ДЛЯ ПЛАНОВ
  plansList: {
    gap: 16,
  },
  planCard: {
    backgroundColor: "#C2DAE2",
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    height: 140,
  },
  planImage: {
    width: 120,
    height: "100%",
  },
  planContent: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  planName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
  },
  planDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  planDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  planDetailText: {
    fontSize: 10,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
  },
  planFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planDate: {
    fontSize: 10,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
  usePlanButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  usePlanButtonText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },

  // ОБЩИЕ СТИЛИ
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyTitle: {
    fontSize: 16,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    lineHeight: 18,
  },

  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#9BDF11",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  nameText: {
    fontSize: 22,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    marginBottom: 15,
    fontFamily: "Playfair Display Regular",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9BDF11",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  editButtonText: {
    fontSize: 14,
    color: "#000",
    fontFamily: "Playfair Display Regular",
  },
  sectionTitleProfile: {
    fontSize: 18,
    color: "#212529",
    marginBottom: 10,
    fontFamily: "Playfair Display Bold",
  },
  profileTypeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  profileTypeLabel: {
    fontSize: 16,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
  },
  profileTypeDescription: {
    fontSize: 13,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
  communityMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7F9",
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
  },
  menuIconContainer: {
    marginRight: 15,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  infoCard: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoLabel: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
  },
  preferences: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  preferenceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7F9",
  },
  preferenceRowLast: {
    borderBottomWidth: 0,
  },
  preferenceLabel: {
    fontSize: 15,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
  },
  preferenceValue: {
    fontSize: 15,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
  },
});