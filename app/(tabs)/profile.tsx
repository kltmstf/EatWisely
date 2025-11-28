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
} from "react-native";

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
  avatarUri?: string | null;
};

type Recipe = {
  id: number;
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
  id: number;
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

// --- ДАННЫЕ ---
const favoriteRecipes: Recipe[] = [
  {
    id: 1,
    name: "Овсяная каша с ягодами и медом",
    category: "Завтраки",
    calories: 350,
    cookingTime: "15 мин",
    image: require("@/assets/images/breakfast-oats.png"),
    bookmarked: true,
    rating: 4.8,
    difficulty: "Легко",
  },
  {
    id: 3,
    name: "Рис с курицей и овощами по-азиатски",
    category: "Основные блюда",
    calories: 450,
    cookingTime: "25 мин",
    image: require("@/assets/images/dinner-rice.png"),
    bookmarked: true,
    rating: 4.9,
    difficulty: "Средне",
  },
  {
    id: 6,
    name: "Смузи из ягод и банана",
    category: "Перекусы",
    calories: 180,
    cookingTime: "5 мин",
    image: require("@/assets/images/lunch-soup.png"),
    bookmarked: true,
    rating: 4.7,
    difficulty: "Легко",
  },
  {
    id: 7,
    name: "Тост с авокадо и яйцом пашот",
    category: "Завтраки",
    calories: 320,
    cookingTime: "10 мин",
    image: require("@/assets/images/breakfast-oats.png"),
    bookmarked: true,
    rating: 4.6,
    difficulty: "Легко",
  },
];

const savedPlans: Plan[] = [
  {
    id: 1,
    name: "План для похудения",
    description: "Сбалансированное питание на неделю",
    totalCalories: 1500,
    duration: "7 дней",
    mealsCount: 21,
    image: require("@/assets/images/breakfast-oats.png"),
    savedDate: "12.12.2023",
  },
  {
    id: 2,
    name: "Энергичное утро",
    description: "Завтраки для продуктивного дня",
    totalCalories: 1800,
    duration: "5 дней",
    mealsCount: 5,
    image: require("@/assets/images/lunch-soup.png"),
    savedDate: "10.12.2023",
  },
];

export default function ProfileScreen() {
  const router = useRouter();
  const [profileData, setProfileData] = useState<ProfileData>(defaultProfileData);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "saved">("profile");

  const [, setProfileCompleted] = useState(false);

  // --- ЛОГИКА ЗАГРУЗКИ ---
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    try {
      const [storedProfile, setupStatus] = await Promise.all([
        AsyncStorage.getItem(PROFILE_STORAGE_KEY),
        AsyncStorage.getItem(PROFILE_SETUP_KEY),
      ]);

      if (storedProfile) {
        const parsedData = JSON.parse(storedProfile);
        setProfileData({ ...defaultProfileData, ...parsedData });
      } else {
        setProfileData(defaultProfileData);
      }

      setProfileCompleted(setupStatus === "true");
    } catch (error) {
      console.error("Не удалось загрузить профиль:", error);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const toggleBookmark = (recipeId: number) => {
    console.log(`Удалено из избранного: ${recipeId}`);
  };

  const navigateToRecipe = (recipe: Recipe) => {
    console.log(`Переход к рецепту: ${recipe.name}`);
    router.push({
      pathname: "/meal",
      params: {
        mealName: recipe.name,
        category: recipe.category,
        initialBookmarked: recipe.bookmarked.toString(),
      },
    });
  };

  // --- ОБНОВЛЕННЫЕ НАВИГАЦИОННЫЕ ОБРАБОТЧИКИ ДЛЯ ПЕРЕХОДА НА ОТДЕЛЬНЫЕ СТРАНИЦЫ ---
  const navigateToAllRecipes = () => {
    router.push("/saved-recipes");
  };

  const navigateToAllPlans = () => {
    router.push("/saved-plans");
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Легко":
        return "#4CAF50";
      case "Средне":
        return "#FF9800";
      case "Сложно":
        return "#F44336";
      default:
        return "#A8C8D4";
    }
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

  // --- РЕНДЕР ВКЛАДКИ "ПРОФИЛЬ" ---
  const renderProfileTab = () => (
    <ScrollView
      style={styles.content}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* КАРТОЧКА ПРОФИЛЯ */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {profileData.avatarUri ? (
            <Image
              source={{ uri: profileData.avatarUri }}
              style={styles.avatarImage}
            />
          ) : (
            <Ionicons name="person" size={48} color="#6A9AA9" />
          )}
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

      {/* ТИП ПРОФИЛЯ */}
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

      {/* СООБЩЕСТВО */}
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

      {/* ОСНОВНЫЕ ДАННЫЕ */}
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

      {/* ПРЕДПОЧТЕНИЯ */}
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

  // --- ОБНОВЛЕННЫЙ РЕНДЕР ВКЛАДКИ "СОХРАНЕННЫЕ" ---
  const renderSavedTab = () => (
    <ScrollView
      style={styles.savedContainer}
      contentContainerStyle={styles.savedContentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* РАЗДЕЛ РЕЦЕПТОВ */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={navigateToAllRecipes}
        >
          <Text style={styles.sectionTitle}>
            рецепты ({favoriteRecipes.length})
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
            {favoriteRecipes.slice(0, 4).map((recipe) => (
              <View key={recipe.id} style={styles.recipeColumn}>
                <View style={styles.recipeCard}>
                  <View style={styles.imageContainer}>
                    <Image
                      source={recipe.image}
                      style={styles.recipeImage}
                      resizeMode="cover"
                    />
                    <View style={styles.recipeBadges}>
                      <View style={styles.ratingBadge}>
                        <Ionicons name="star" size={10} color="#FFD700" />
                        <Text style={styles.ratingText}>{recipe.rating}</Text>
                      </View>
                      <View
                        style={[
                          styles.difficultyBadge,
                          {
                            backgroundColor: getDifficultyColor(
                              recipe.difficulty
                            ),
                          },
                        ]}
                      >
                        <Text style={styles.difficultyText}>
                          {recipe.difficulty}
                        </Text>
                      </View>
                    </View>
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
                      <Text style={styles.recipeCategory}>
                        {recipe.category}
                      </Text>
                      <View style={styles.recipeDetails}>
                        <Ionicons name="flame-outline" size={12} color="#FF6B6B" />
                        <Text style={styles.recipeCalories}>
                          {recipe.calories} ккал
                        </Text>
                        <Ionicons name="time-outline" size={12} color="#6A9AA9" style={styles.timeIcon} />
                        <Text style={styles.recipeTime}>
                          {recipe.cookingTime}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.viewButton}
                      onPress={() => navigateToRecipe(recipe)}
                    >
                      <Text style={styles.viewButtonText}>Приготовить</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* РАЗДЕЛ ПЛАНОВ */}
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
    </ScrollView>
  );

  // --- ОСНОВНОЙ РЕНДЕР ---
  return (
    <View style={styles.container}>
      {/* ВКЛАДКИ */}
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

// --- ИЗНАЧАЛЬНЫЕ СТИЛИ ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  // ВКЛАДКИ
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

  // СТИЛИ ДЛЯ ВКЛАДКИ "СОХРАНЕННЫЕ"
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
    textTransform: "lowercase",
  },

  // СТИЛИ ДЛЯ РЕЦЕПТОВ
  recipesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  recipeColumn: {
    width: "48%",
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
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginLeft: 2,
    marginRight: 8,
  },
  timeIcon: {
    marginLeft: 4,
  },
  recipeTime: {
    fontSize: 12,
    color: "#6C757D",
    marginLeft: 2,
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
    color: "#000000",
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

  // Стили для renderProfileTab
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