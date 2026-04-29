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
  Alert,
} from "react-native";
import { favoriteService } from "@/app/services/favoriteService";
import { rationPlanService } from "@/app/services/rationPlanService";
import { recipeService } from "@/app/services/recipeService";
import { auth } from "@/app/firebase/config";
import { FontAwesome } from "@expo/vector-icons";
import { followService } from "@/app/services/followService";
import { userService } from "@/app/services/userService";
import { useAuthContext } from "@/app/contexts/AuthContext";

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
  photoURL?: string | null;
  cloudinaryPublicId?: string;
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
  favoriteId?: string;
  originalRecipeId?: string;
  item?: any;
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
  createdAt?: number;
};

const PROFILE_STORAGE_KEY = "user_profile_data";
const PROFILE_SETUP_KEY = "profile_setup_complete";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

const formatMinutes = (minutes: number): string => {
  const absMinutes = Math.abs(minutes);
  const lastDigit = absMinutes % 10;
  const lastTwoDigits = absMinutes % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${absMinutes} минут`;
  if (lastDigit === 1) return `${absMinutes} минута`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${absMinutes} минуты`;
  return `${absMinutes} минут`;
};

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

const formatActivity = (activity: string): string => {
  if (!activity) return "-";
  
  const maxLength = 25;
  if (activity.length <= maxLength) return activity;
  
  const periodIndex = activity.indexOf('.', maxLength - 10);
  if (periodIndex !== -1 && periodIndex < maxLength + 10) {
    return activity.substring(0, periodIndex + 1);
  }
  
  const commaIndex = activity.indexOf(',', maxLength - 10);
  if (commaIndex !== -1 && commaIndex < maxLength + 10) {
    return activity.substring(0, commaIndex + 1);
  }
  
  return activity.substring(0, maxLength - 3) + '...';
};

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
  const { user, userProfile, loading: authLoading } = useAuthContext();
  const [profileData, setProfileData] = useState<ProfileData>(defaultProfileData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "saved">("profile");
  const [favoriteRecipes, setFavoriteRecipes] = useState<Recipe[]>([]);
  const [savedPlans, setSavedPlans] = useState<Plan[]>([]);
  const [myRecipesCount, setMyRecipesCount] = useState<number>(0);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [followStats, setFollowStats] = useState({
    followersCount: 0,
    followingCount: 0
  });
  const [postsCount, setPostsCount] = useState(0);
  const [followStatsLoading, setFollowStatsLoading] = useState(false);

  const getCurrentUserId = useCallback((): string | null => {
    return user?.uid || auth.currentUser?.uid || null;
  }, [user]);

  const loadFollowStats = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) return;

    try {
      setFollowStatsLoading(true);
      const [followersCount, followingCount] = await Promise.all([
        followService.getFollowersCount(userId),
        followService.getFollowingCount(userId)
      ]);
      setFollowStats({ followersCount, followingCount });
    } catch (error) {
      console.error("Ошибка загрузки статистики подписок:", error);
      setFollowStats({ followersCount: 0, followingCount: 0 });
    } finally {
      setFollowStatsLoading(false);
    }
  }, [getCurrentUserId]);

  const loadPostsCount = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setPostsCount(0);
      return;
    }

    try {
      const userRecipes = await recipeService.getUserRecipes(userId);
      setPostsCount(userRecipes?.length || 0);
    } catch (error) {
      console.error("Ошибка загрузки количества постов:", error);
      setPostsCount(0);
    }
  }, [getCurrentUserId]);

  const loadFavoritesFromDB = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setFavoriteRecipes([]);
      return;
    }

    setFavoritesLoading(true);
    try {
      const allFavorites = await favoriteService.getUserFavorites(userId);

      if (!allFavorites || allFavorites.length === 0) {
        setFavoriteRecipes([]);
        return;
      }

      const recipes: Recipe[] = [];
      let recipeCounter = 0;

      allFavorites.forEach((fav: any) => {
        if (fav.favoriteType === "recipe" && fav.item) {
          const recipeData = fav.item;
          const title = recipeData.title || recipeData.fields?.title || recipeData.name || "Рецепт без названия";
          const rawCategory = recipeData.mealType || recipeData.fields?.mealType || "other";
          const category = getCategoryName(rawCategory);

          let calories = 0;
          if (recipeData.fields?.calories !== undefined) calories = recipeData.fields.calories;
          else if (recipeData.calories !== undefined) calories = recipeData.calories;
          else if (recipeData.fields?.fscts !== undefined) calories = recipeData.fields.fscts;

          let cookingTime = "20 минут";
          const rawTime = recipeData.fields?.cookingTime || recipeData.cookingTime || recipeData.time;

          if (rawTime) {
            if (typeof rawTime === "number") {
              cookingTime = formatMinutes(rawTime);
            } else {
              cookingTime = String(rawTime);
              if (cookingTime && !cookingTime.includes("мин") && !cookingTime.includes("минут")) {
                const timeMatch = cookingTime.match(/\d+/);
                if (timeMatch) {
                  cookingTime = formatMinutes(parseInt(timeMatch[0], 10));
                } else {
                  cookingTime = `${cookingTime} минут`;
                }
              }
            }
          }

          const rating = recipeData.rating || recipeData.fields?.rating || recipeData.ratingCount || 0;

          let difficulty = "Легко";
          const rawDifficulty = recipeData.difficulty || recipeData.fields?.difficulty || recipeData.complexity || recipeData.difficultyLevel;

          if (rawDifficulty) {
            const normalizedDifficulty = String(rawDifficulty).trim();
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

          let imageUri = null;
          if (recipeData.fields?.image) imageUri = recipeData.fields.image;
          else if (recipeData.image) imageUri = recipeData.image;
          else if (recipeData.imageUrl) imageUri = recipeData.imageUrl;
          else if (recipeData.fields?.langdir1) imageUri = recipeData.fields.langdir1;

          recipeCounter++;
          const uniqueId = `recipe-${userId}-${recipeCounter}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          recipes.push({
            id: uniqueId,
            name: title,
            category: category,
            calories: calories,
            cookingTime: cookingTime,
            image: imageUri ? { uri: imageUri } : require("@/assets/images/dinner-rice.png"),
            bookmarked: true,
            rating: rating,
            difficulty: difficulty,
            favoriteId: fav.id,
            originalRecipeId: fav.recipeId,
            item: recipeData
          });
        }
      });

      setFavoriteRecipes(recipes);
    } catch (error) {
      console.error("Ошибка при загрузке избранных рецептов:", error);
      setFavoriteRecipes([]);
    } finally {
      setFavoritesLoading(false);
    }
  }, [getCurrentUserId]);

  const loadUserPlans = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      setSavedPlans([]);
      return;
    }

    setPlansLoading(true);
    try {
      const userPlans = await rationPlanService.getUserRationPlans(userId);

      if (!userPlans || userPlans.length === 0) {
        setSavedPlans([]);
        return;
      }

      const formattedPlans: Plan[] = userPlans.map((plan: any) => {
        let createdAt = Date.now();
        if (plan.createdAt) {
          if (typeof plan.createdAt === "string") {
            createdAt = new Date(plan.createdAt).getTime();
          } else if (plan.createdAt.seconds) {
            createdAt = plan.createdAt.seconds * 1000;
          } else if (typeof plan.createdAt === "number") {
            createdAt = plan.createdAt;
          }
        }

        return {
          id: plan.id || `plan-${Date.now()}`,
          name: plan.title || plan.name || "План без названия",
          description: plan.description || "Описание отсутствует",
          totalCalories: plan.totalCalories || 0,
          duration: plan.totalDuration || "0 дней",
          mealsCount: plan.mealsCount || 0,
          image: null,
          savedDate: new Date(createdAt).toLocaleDateString("ru-RU"),
          createdAt: createdAt,
        };
      });

      const sortedPlans = formattedPlans.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setSavedPlans(sortedPlans.slice(0, 3));
    } catch (error) {
      console.error("Ошибка при загрузке планов пользователя:", error);
      setSavedPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, [getCurrentUserId]);

  const loadMyRecipesCount = useCallback(async () => {
    const userId = getCurrentUserId();
    try {
      const userRecipes = await recipeService.getUserRecipes(userId || null);
      setMyRecipesCount(userRecipes?.length || 0);
    } catch (error) {
      console.error("Ошибка при загрузке моих рецептов:", error);
      setMyRecipesCount(0);
    }
  }, [getCurrentUserId]);

  const loadProfileData = useCallback(async () => {
    setLoading(true);
    try {
      const userId = getCurrentUserId();

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

      if (userId && (user || auth.currentUser)) {
        const authUser = user || auth.currentUser;

        if (!profileFromStorage.name || profileFromStorage.name === "Пользователь") {
          profileFromStorage.name = authUser?.displayName || authUser?.email?.split("@")[0] || "Пользователь";
        }

        if (!profileFromStorage.email) {
          profileFromStorage.email = authUser?.email || "";
        }

        if (authUser?.photoURL && !profileFromStorage.photoURL) {
          profileFromStorage.photoURL = authUser.photoURL;
        }

        try {
          const firestoreData = await userService.fetchUserProfile(userId);

          if (firestoreData) {
            if (firestoreData.photoURL && !profileFromStorage.photoURL) {
              profileFromStorage.photoURL = firestoreData.photoURL;
            }

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
        }
      }

      setProfileData(profileFromStorage);
      setProfileCompleted(setupStatus === "true");

      await Promise.all([
        loadFavoritesFromDB(),
        loadUserPlans(),
        loadMyRecipesCount(),
        loadFollowStats(),
        loadPostsCount(),
      ]);
    } catch (error) {
      console.error("Не удалось загрузить профиль:", error);
      setProfileData(defaultProfileData);
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId, loadFavoritesFromDB, loadUserPlans, loadMyRecipesCount, loadFollowStats, loadPostsCount, user]);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  const toggleBookmark = async (recipe: Recipe) => {
    try {
      const userId = getCurrentUserId();
      if (!userId) {
        Alert.alert("Ошибка", "Вы не авторизованы");
        return;
      }

      let firebaseRecipeId = null;

      if (recipe.originalRecipeId) {
        firebaseRecipeId = recipe.originalRecipeId;
      } else if (recipe.item?.id) {
        firebaseRecipeId = recipe.item.id;
      } else if (recipe.favoriteId) {
        const allFavorites = await favoriteService.getUserFavorites(userId);
        const targetFavorite = allFavorites.find(fav => fav.id === recipe.favoriteId);
        if (targetFavorite && targetFavorite.recipeId) {
          firebaseRecipeId = targetFavorite.recipeId;
        }
      }

      if (!firebaseRecipeId) {
        Alert.alert("Ошибка", "Не удалось определить ID рецепта");
        return;
      }

      await favoriteService.removeFromFavorites(firebaseRecipeId, "recipe", userId);
      setFavoriteRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    } catch (error) {
      console.error("Ошибка при удалении из избранного:", error);
      Alert.alert("Ошибка", "Не удалось удалить из избранного");
    }
  };

  const navigateToAllRecipes = () => {
    const userId = getCurrentUserId();
    router.push({
      pathname: "/saved-recipes",
      params: { userId: userId || '' }
    });
  };

  const navigateToAllPlans = () => {
    router.push("/saved-plans");
  };

  const handleEdit = () => {
    router.push("/profile-settings");
  };

  const handleNavigation = useCallback((path: string) => {
    router.push(path as any);
  }, [router]);

  const navigateToRecipe = (recipe: Recipe) => {
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

  const handlePlanPress = (plan: Plan) => {
    router.push({
      pathname: "/create-ration",
      params: { planId: plan.id },
    });
  };

  const handleUsePlan = (plan: Plan) => {
    Alert.alert(
      "Использовать план",
      `Хотите начать использовать план "${plan.name}"?`,
      [
        { text: "Отмена", style: "cancel" },
        { text: "Использовать", onPress: () => Alert.alert("Успешно", `План "${plan.name}" теперь активен!`) },
      ]
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    if (!difficulty) return "#6A9AA9";
    const lowerDifficulty = difficulty.toLowerCase();
    if (lowerDifficulty.includes("легк")) return "#4CAF50";
    if (lowerDifficulty.includes("средн")) return "#FF9800";
    if (lowerDifficulty.includes("сложн")) return "#F44336";
    return "#6A9AA9";
  };

  const renderMenuItem = useCallback((iconName: string, label: string, onPress: () => void) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconContainer}>
        <Ionicons name={iconName as any} size={24} color="#555" />
      </View>
      <Text style={styles.menuItemText}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  ), []);

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
    return <Ionicons name="person" size={48} color="#6A9AA9" />;
  };

  const renderRecipeCard = (recipe: Recipe) => (
    <View key={recipe.id} style={styles.recipeColumn}>
      <TouchableOpacity style={styles.recipeCard} onPress={() => navigateToRecipe(recipe)}>
        <View style={styles.imageContainer}>
          <Image source={recipe.image} style={styles.recipeImage} resizeMode="cover" />
          <View style={styles.recipeBadges}>
            {recipe.rating && recipe.rating > 0 ? (
              <View style={styles.ratingBadge}>
                <FontAwesome name="star" size={10} color="#FFD700" />
                <Text style={styles.ratingText}>{recipe.rating.toFixed(1)}</Text>
              </View>
            ) : null}
            <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(recipe.difficulty) }]}>
              <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bookmarkButton} onPress={() => toggleBookmark(recipe)}>
            <Ionicons name="bookmark" size={18} color="#6A9AA9" />
          </TouchableOpacity>
        </View>
        <View style={styles.recipeContent}>
          <View style={styles.recipeInfo}>
            <Text style={styles.recipeName} numberOfLines={2}>{recipe.name}</Text>
            <Text style={styles.recipeCategory}>{recipe.category}</Text>
            <View style={styles.recipeDetails}>
              {recipe.calories && recipe.calories > 0 ? (
                <Text style={styles.recipeCalories}>{recipe.calories} ккал</Text>
              ) : null}
              <Ionicons name="time-outline" size={12} color="#6A9AA9" style={styles.timeIcon} />
              <Text style={styles.recipeTime}>{recipe.cookingTime}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.viewButton} onPress={() => navigateToRecipe(recipe)}>
            <Text style={styles.viewButtonText}>Посмотреть</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderPlanCard = (plan: Plan) => (
    <TouchableOpacity key={plan.id} style={styles.planCard} onPress={() => handlePlanPress(plan)}>
      <View style={styles.planIconContainer}>
        <Ionicons name="calendar-outline" size={32} color="#6A9AA9" />
      </View>
      <View style={styles.planContent}>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planDescription} numberOfLines={2}>{plan.description}</Text>
        <View style={styles.planDetails}>
          <View style={styles.planDetail}>
            <Ionicons name="flame-outline" size={14} color="#FF6B6B" />
            <Text style={styles.planDetailText}>{plan.totalCalories} ккал/день</Text>
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
          <Text style={styles.planDate}>Создан: {plan.savedDate}</Text>
          <TouchableOpacity style={styles.usePlanButton} onPress={() => handleUsePlan(plan)}>
            <Text style={styles.usePlanButtonText}>Использовать</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderActivity = (item: any) => {
    const showFullActivity = item.fullValue && item.fullValue.length > 25;
    return (
      <View key={item.label} style={styles.preferenceRow}>
        <Text style={styles.preferenceLabel}>{item.label}</Text>
        <View style={styles.activityContainer}>
          <Text style={styles.preferenceValue} numberOfLines={1}>{item.value}</Text>
          {showFullActivity && (
            <TouchableOpacity style={styles.infoButton} onPress={() => Alert.alert("Уровень активности", item.fullValue)}>
              <Ionicons name="information-circle-outline" size={16} color="#6A9AA9" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const primaryInfo = useMemo(() => [
    { label: "Возраст", value: profileData.age ? `${profileData.age} лет` : "-" },
    { label: "Рост", value: profileData.height ? `${profileData.height} см` : "-" },
    { label: "Вес", value: profileData.weight ? `${profileData.weight} кг` : "-" },
    { label: "Пол", value: profileData.gender || "-" },
  ], [profileData.age, profileData.height, profileData.weight, profileData.gender]);

  const preferences = useMemo(() => [
    { label: "Цель", value: profileData.goal || "-" },
    { label: "Активность", value: formatActivity(profileData.activity) || "-", fullValue: profileData.activity },
    { label: "Тип питания", value: profileData.nutritionType || "-" },
    { label: "Аллергии", value: profileData.allergies || "Нет" },
    { label: "Нелюбимые продукты", value: profileData.dislikes || "Нет" },
  ], [profileData.goal, profileData.activity, profileData.nutritionType, profileData.allergies, profileData.dislikes]);

  const userName = profileData.name || "Пользователь";
  const profileTypeLabel = profileData.isPrivate ? "Приватный профиль" : "Публичный профиль";
  const profileTypeDescription = profileData.isPrivate
    ? "Ваш профиль и данные видны только вам."
    : "Другие пользователи могут просматривать ваши данные и рекомендации.";

  const renderProfileTab = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}><AvatarComponent /></View>
        <Text style={styles.nameText}>{userName}</Text>
        <Text style={styles.descriptionText}>{profileData.description || "Вы еще не рассказали о себе"}</Text>
        <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
          <Ionicons name="create-outline" size={18} color="#000" />
          <Text style={styles.editButtonText}>Редактировать</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitleProfile}>Тип профиля</Text>
        <View style={styles.profileTypeCard}>
          <View style={styles.profileTypeHeader}>
            <Ionicons name={profileData.isPrivate ? "lock-closed-outline" : "earth-outline"} size={22} color="#555" />
            <Text style={styles.profileTypeLabel}>{profileTypeLabel}</Text>
          </View>
          <Text style={styles.profileTypeDescription}>{profileTypeDescription}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitleProfile}>Сообщество</Text>
        <View style={styles.communityMenu}>
          {renderMenuItem("restaurant-outline", `Опубликованные рецепты (${myRecipesCount})`, () => handleNavigation("/user-recipes"))}
          {renderMenuItem("person-add-outline", `Подписки (${followStats.followingCount})`, () => handleNavigation("/following"))}
          {renderMenuItem("people-outline", `Подписчики (${followStats.followersCount})`, () => handleNavigation("/followers"))}
          {renderMenuItem("grid-outline", `Публикации (${postsCount})`, () => handleNavigation("/posts"))}
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
          {preferences.map((item, index) => {
            if (item.label === "Активность") return renderActivity(item);
            return (
              <View key={item.label} style={[styles.preferenceRow, index === preferences.length - 1 && styles.preferenceRowLast]}>
                <Text style={styles.preferenceLabel}>{item.label}</Text>
                <Text style={styles.preferenceValue} numberOfLines={1}>{item.value}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );

  const renderSavedTab = () => (
    <ScrollView style={styles.savedContainer} contentContainerStyle={styles.savedContentContainer} showsVerticalScrollIndicator={false}>
      {favoritesLoading || plansLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loaderText}>Загружаем данные...</Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader} onPress={navigateToAllRecipes}>
              <Text style={styles.sectionTitle}>Рецепты ({favoriteRecipes.length})</Text>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </TouchableOpacity>
            {favoriteRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={48} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>В избранном пока пусто</Text>
                <Text style={styles.emptyText}>Сохраняйте рецепты, нажимая на значок закладки</Text>
              </View>
            ) : (
              <View style={styles.recipesGrid}>
                {favoriteRecipes.slice(0, 4).map((recipe) => renderRecipeCard(recipe))}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <TouchableOpacity style={styles.sectionHeader} onPress={navigateToAllPlans}>
              <View style={styles.plansHeader}>
                <Text style={styles.sectionTitle}>Последние рационы ({savedPlans.length})</Text>
                <Text style={styles.subtitle}>Показаны последние 3 созданных плана</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#000" />
            </TouchableOpacity>
            {savedPlans.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>Нет созданных планов</Text>
                <Text style={styles.emptyText}>Создайте свой первый план питания!</Text>
                <TouchableOpacity style={styles.createPlanButton} onPress={() => router.push("/create-ration")}>
                  <Text style={styles.createPlanButtonText}>Создать план</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.plansList}>
                {savedPlans.map((plan) => renderPlanCard(plan))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  if (loading || authLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loaderText}>Загружаем данные...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === "profile" && styles.tabActive]} onPress={() => setActiveTab("profile")}>
          <Ionicons name="person-outline" size={20} color={activeTab === "profile" ? "#6A9AA9" : "#666"} />
          <Text style={[styles.tabText, activeTab === "profile" && styles.tabTextActive]}>Профиль</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "saved" && styles.tabActive]} onPress={() => setActiveTab("saved")}>
          <Ionicons name="bookmark-outline" size={20} color={activeTab === "saved" ? "#6A9AA9" : "#666"} />
          <Text style={[styles.tabText, activeTab === "saved" && styles.tabTextActive]}>Сохраненные</Text>
        </TouchableOpacity>
      </View>
      {activeTab === "profile" && renderProfileTab()}
      {activeTab === "saved" && renderSavedTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  tabsContainer: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#6A9AA9" },
  tabText: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular", fontWeight: "500" },
  tabTextActive: { color: "#6A9AA9", fontWeight: "600" },
  savedContainer: { flex: 1, paddingHorizontal: 16 },
  savedContentContainer: { paddingVertical: 20 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 20, color: "#212529", fontFamily: "Playfair Display Bold" },
  plansHeader: { flex: 1 },
  subtitle: { fontSize: 12, color: "#6A9AA9", fontFamily: "Playfair Display Regular", marginTop: 2 },
  recipesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  recipeColumn: { width: CARD_WIDTH, marginBottom: 16 },
  recipeCard: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5, height: 280 },
  imageContainer: { position: "relative" },
  recipeImage: { width: "100%", height: 120 },
  recipeBadges: { position: "absolute", top: 8, left: 8, flexDirection: "column", gap: 4 },
  ratingBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.9)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  ratingText: { fontSize: 10, fontWeight: "bold", color: "#000000", fontFamily: "Playfair Display Regular", marginLeft: 2 },
  difficultyBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  difficultyText: { fontSize: 9, fontWeight: "bold", color: "#FFFFFF", fontFamily: "Playfair Display Regular" },
  bookmarkButton: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255, 255, 255, 0.9)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 },
  recipeContent: { padding: 12, flex: 1, justifyContent: "space-between" },
  recipeInfo: { flex: 1, marginBottom: 8 },
  recipeName: { fontSize: 14, fontWeight: "600", color: "#212529", marginBottom: 4, fontFamily: "Playfair Display Regular", lineHeight: 18, minHeight: 36 },
  recipeCategory: { fontSize: 11, color: "#6A9AA9", fontFamily: "Playfair Display Regular", fontStyle: "italic", marginBottom: 6 },
  recipeDetails: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  recipeCalories: { fontSize: 12, color: "#000000", fontWeight: "normal", fontFamily: "Playfair Display Bold", marginRight: 8 },
  timeIcon: { marginRight: 4 },
  recipeTime: { fontSize: 12, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  viewButton: { backgroundColor: "#9BDF11", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: "center", justifyContent: "center", minHeight: 36, marginTop: 8 },
  viewButtonText: { color: "#000000ff", fontSize: 12, fontWeight: "normal", fontFamily: "Playfair Display Regular" },
  plansList: { gap: 16 },
  planCard: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", flexDirection: "row", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5, height: 140 },
  planIconContainer: { width: 80, height: "100%", backgroundColor: "#C2DAE2", justifyContent: "center", alignItems: "center" },
  planContent: { flex: 1, padding: 12, justifyContent: "space-between" },
  planName: { fontSize: 16, fontWeight: "600", color: "#212529", fontFamily: "Playfair Display Regular", marginBottom: 4 },
  planDescription: { fontSize: 12, color: "#6A9AA9", fontFamily: "Playfair Display Regular", marginBottom: 8, lineHeight: 14 },
  planDetails: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  planDetail: { flexDirection: "row", alignItems: "center", gap: 4 },
  planDetailText: { fontSize: 10, color: "#000000", fontFamily: "Playfair Display Regular" },
  planFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planDate: { fontSize: 10, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  usePlanButton: { backgroundColor: "#9BDF11", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  usePlanButtonText: { color: "#000000", fontSize: 12, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  createPlanButton: { backgroundColor: "#6A9AA9", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, marginTop: 16 },
  createPlanButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 40, backgroundColor: "#fff", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  emptyTitle: { fontSize: 16, color: "#212529", fontFamily: "Playfair Display Regular", marginTop: 12, marginBottom: 6, textAlign: "center" },
  emptyText: { fontSize: 14, color: "#6C757D", fontFamily: "Playfair Display Regular", textAlign: "center", lineHeight: 18 },
  content: { flex: 1 },
  contentContainer: { paddingBottom: 30, paddingHorizontal: 16 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
  loaderText: { marginTop: 10, fontSize: 16, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  profileCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", marginBottom: 20, marginTop: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center", marginBottom: 10, overflow: "hidden", borderWidth: 2, borderColor: "#9BDF11" },
  avatarImage: { width: "100%", height: "100%" },
  nameText: { fontSize: 22, color: "#212529", fontFamily: "Playfair Display Bold", marginBottom: 4 },
  descriptionText: { fontSize: 14, color: "#6C757D", textAlign: "center", marginBottom: 15, fontFamily: "Playfair Display Regular" },
  editButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#9BDF11", paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, gap: 5 },
  editButtonText: { fontSize: 14, color: "#000", fontFamily: "Playfair Display Regular" },
  sectionTitleProfile: { fontSize: 18, color: "#212529", marginBottom: 10, fontFamily: "Playfair Display Bold" },
  profileTypeCard: { backgroundColor: "#fff", borderRadius: 12, padding: 15, borderWidth: 1, borderColor: "#E5E7EB" },
  profileTypeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  profileTypeLabel: { fontSize: 16, color: "#212529", fontFamily: "Playfair Display Regular" },
  profileTypeDescription: { fontSize: 13, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  communityMenu: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: "#F5F7F9" },
  menuItemText: { flex: 1, fontSize: 15, color: "#212529", fontFamily: "Playfair Display Regular" },
  menuIconContainer: { marginRight: 15 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 10 },
  infoCard: { width: "48%", backgroundColor: "#fff", borderRadius: 12, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  infoLabel: { fontSize: 12, color: "#6C757D", fontFamily: "Playfair Display Regular", marginBottom: 4 },
  infoValue: { fontSize: 18, color: "#212529", fontFamily: "Playfair Display Bold" },
  preferences: { backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" },
  preferenceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: "#F5F7F9", alignItems: "center" },
  preferenceRowLast: { borderBottomWidth: 0 },
  preferenceLabel: { fontSize: 15, color: "#212529", fontFamily: "Playfair Display Regular", flex: 1 },
  preferenceValue: { fontSize: 15, color: "#212529", fontFamily: "Playfair Display Regular", flex: 1, textAlign: "right", marginLeft: 8 },
  activityContainer: { flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end" },
  infoButton: { marginLeft: 4, padding: 2 },
});