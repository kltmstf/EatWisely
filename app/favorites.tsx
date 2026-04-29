import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useState, useCallback } from "react";
import {
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { favoriteService } from "@/app/services/favoriteService";
import { useAuthContext } from "@/app/contexts/AuthContext";
import { auth } from "@/app/firebase/config";

type RecipeDetail = {
  id: string;
  name: string;
  category: string;
  calories: number;
  cookingTime: string;
  image: any;
  rating: number;
  difficulty: string;
  realRecipeId: string;
};

type PlanDetail = {
  id: string;
  name: string;
  description: string;
  totalCalories: number;
  duration: string;
  mealsCount: number;
  image: any;
  savedDate: string;
  realPlanId: string;
};

type FavoriteItem = {
  id: string;
  userId: string;
  favoriteType: "recipe" | "ration";
  recipeId?: string;
  rationPlanId?: string;
  createdAt: any;
  item?: {
    id: string;
    name?: string;
    category?: string;
    calories?: number;
    cookingTime?: string;
    image?: string;
    rating?: number;
    difficulty?: string;
    description?: string;
    totalCalories?: number;
    duration?: string;
    mealsCount?: number;
  };
};

function isRecipeDetail(item: RecipeDetail | PlanDetail): item is RecipeDetail {
  return (item as RecipeDetail).category !== undefined;
}

function isPlanDetail(item: RecipeDetail | PlanDetail): item is PlanDetail {
  return (item as PlanDetail).description !== undefined;
}

export default function SavedScreen() {
  const router = useRouter();
  const { userId: paramUserId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [activeTab, setActiveTab] = useState<"recipes" | "plans">("recipes");
  const [recipesData, setRecipesData] = useState<RecipeDetail[]>([]);
  const [plansData, setPlansData] = useState<PlanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const categories = [
    "Все", "Завтраки", "Обед", "Ужин", "Перекусы", "Супы", "Салаты", "Десерты",
  ];

  // УСИЛЕННАЯ функция получения userId
  const getCurrentUserId = (): string | null => {
    // 1. Из параметров навигации
    if (paramUserId && paramUserId !== 'undefined' && paramUserId !== 'null') {
      console.log("✅ userId из параметров:", paramUserId);
      return paramUserId;
    }
    // 2. Из контекста
    if (user?.uid) {
      console.log("✅ userId из контекста:", user.uid);
      return user.uid;
    }
    // 3. Напрямую из auth
    const directUserId = auth.currentUser?.uid;
    if (directUserId) {
      console.log("✅ userId напрямую из auth:", directUserId);
      return directUserId;
    }
    
    console.log("❌ userId не найден нигде!");
    return null;
  };

  const normalizeFirestoreData = (
    item: any,
    type: "recipe" | "ration",
    favoriteId: string,
    realId: string
  ): RecipeDetail | PlanDetail => {
    if (type === "recipe") {
      return {
        id: `${favoriteId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: item.name || item.title || "Рецепт без названия",
        category: item.category || item.categoryId || "Без категории",
        calories: item.calories || item.calorie || 0,
        cookingTime: item.cookingTime || item.time || "0 мин",
        image: item.image || item.imageUrl
          ? { uri: item.image || item.imageUrl }
          : require("@/assets/images/dinner-rice.png"),
        rating: item.rating || item.averageRating || 0,
        difficulty: item.difficulty || "Легко",
        realRecipeId: realId,
      } as RecipeDetail;
    } else {
      return {
        id: `${favoriteId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        name: item.name || item.title || "План без названия",
        description: item.description || item.desc || "Описание отсутствует",
        totalCalories: item.totalCalories || item.dailyCalories || 0,
        duration: item.duration || item.days || "0 дней",
        mealsCount: item.mealsCount || item.mealsPerDay || 0,
        image: item.image || item.imageUrl
          ? { uri: item.image || item.imageUrl }
          : require("@/assets/images/dinner-rice.png"),
        savedDate: item.createdAt && item.createdAt.seconds
          ? new Date(item.createdAt.seconds * 1000).toLocaleDateString("ru-RU")
          : new Date().toLocaleDateString("ru-RU"),
        realPlanId: realId,
      } as PlanDetail;
    }
  };

  const loadFavorites = useCallback(async () => {
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.log("❌ Нет userId для загрузки избранного");
      setError("Для просмотра избранного необходимо авторизоваться");
      setLoading(false);
      return;
    }

    console.log("🔄 Загрузка избранного для пользователя:", userId);
    
    setLoading(true);
    setError(null);
    
    try {
      const allFavorites = await favoriteService.getUserFavorites(userId);

      if (!allFavorites || allFavorites.length === 0) {
        setRecipesData([]);
        setPlansData([]);
        return;
      }

      const recipesList: RecipeDetail[] = [];
      const plansList: PlanDetail[] = [];

      (allFavorites as FavoriteItem[]).forEach((fav: FavoriteItem) => {
        if (!fav.item) return;

        if (fav.favoriteType === "recipe" && fav.recipeId) {
          const normalizedItem = normalizeFirestoreData(fav.item, "recipe", fav.id, fav.recipeId);
          if (isRecipeDetail(normalizedItem)) recipesList.push(normalizedItem);
        } else if (fav.favoriteType === "ration" && fav.rationPlanId) {
          const normalizedItem = normalizeFirestoreData(fav.item, "ration", fav.id, fav.rationPlanId);
          if (isPlanDetail(normalizedItem)) plansList.push(normalizedItem);
        }
      });
      
      setRecipesData(recipesList);
      setPlansData(plansList);
    } catch (e: any) {
      console.error("Ошибка загрузки:", e);
      setError("Не удалось загрузить сохраненные данные");
    } finally {
      setLoading(false);
    }
  }, [paramUserId, user]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const filteredRecipes = recipesData.filter((recipe) => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Все" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // ИСПРАВЛЕННЫЙ обработчик удаления - принудительно получаем userId заново
  const handleRemoveRecipe = async (recipe: RecipeDetail) => {
    try {
      // ПРИНУДИТЕЛЬНО получаем userId заново при каждом удалении
      let userId = getCurrentUserId();
      
      // Если нет, пробуем еще раз напрямую из auth
      if (!userId) {
        console.log("⚠️ userId не найден, пробуем получить заново...");
        userId = auth.currentUser?.uid || null;
      }
      
      console.log(`🗑️ УДАЛЕНИЕ: recipeId=${recipe.realRecipeId}, userId=${userId}`);
      
      if (!userId) {
        Alert.alert("Ошибка", "Не удалось определить пользователя. Пожалуйста, перезайдите в аккаунт.");
        return;
      }

      await favoriteService.removeFromFavorites(recipe.realRecipeId, "recipe", userId);
      setRecipesData((prev) => prev.filter((r) => r.id !== recipe.id));
      Alert.alert("Успешно", "Рецепт удален из избранного");
    } catch (error: any) {
      console.error("Ошибка при удалении:", error);
      Alert.alert("Ошибка", error.message || "Не удалось удалить из избранного");
    }
  };

  const handleRemovePlan = async (plan: PlanDetail) => {
    try {
      let userId = getCurrentUserId();
      
      if (!userId) {
        userId = auth.currentUser?.uid || null;
      }
      
      if (!userId) {
        Alert.alert("Ошибка", "Не удалось определить пользователя");
        return;
      }

      await favoriteService.removeFromFavorites(plan.realPlanId, "ration", userId);
      setPlansData((prev) => prev.filter((p) => p.id !== plan.id));
      Alert.alert("Успешно", "План удален из избранного");
    } catch (error: any) {
      Alert.alert("Ошибка", error.message || "Не удалось удалить из избранного");
    }
  };

  const navigateToRecipe = (recipe: RecipeDetail) => {
    router.push({
      pathname: "/meal",
      params: {
        mealId: recipe.realRecipeId,
        mealName: recipe.name,
        category: recipe.category,
      },
    });
  };

  const navigateToPlan = (plan: PlanDetail) => {
    console.log(`Переход к плану: ${plan.name}`);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Легко": return "#4CAF50";
      case "Средне": return "#FF9800";
      case "Сложно": return "#F44336";
      default: return "#6A9AA9";
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Сохраненное</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </View>
    );
  }

  if (error && recipesData.length === 0 && plansData.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Сохраненное</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="warning-outline" size={48} color="#F44336" />
          <Text style={styles.emptyTitle}>Ошибка</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity style={styles.clearFiltersButton} onPress={loadFavorites}>
            <Text style={styles.clearFiltersText}>Повторить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Сохраненное</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === "recipes" && styles.tabActive]} onPress={() => setActiveTab("recipes")}>
          <Ionicons name="restaurant-outline" size={20} color={activeTab === "recipes" ? "#6A9AA9" : "#666"} />
          <Text style={[styles.tabText, activeTab === "recipes" && styles.tabTextActive]}>Рецепты ({recipesData.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === "plans" && styles.tabActive]} onPress={() => setActiveTab("plans")}>
          <Ionicons name="calendar-outline" size={20} color={activeTab === "plans" ? "#6A9AA9" : "#666"} />
          <Text style={[styles.tabText, activeTab === "plans" && styles.tabTextActive]}>Планы ({plansData.length})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {activeTab === "recipes" && (
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <View style={styles.searchInputContainer}>
                <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Поиск..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.sectionDivider} />
          </View>
        )}

        {activeTab === "recipes" ? (
          <View style={styles.recipesSection}>
            {filteredRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={64} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>Нет сохраненных рецептов</Text>
                <Text style={styles.emptyText}>
                  {searchQuery || selectedCategory !== "Все" ? "Попробуйте другие фильтры" : "Сохраняйте рецепты, нажимая на значок закладки"}
                </Text>
                {(searchQuery || selectedCategory !== "Все") && (
                  <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                    <Text style={styles.clearFiltersText}>Сбросить фильтры</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={styles.recipesGrid}>
                {filteredRecipes.map((recipe) => (
                  <View key={recipe.id} style={styles.recipeColumn}>
                    <TouchableOpacity style={styles.recipeCard} onPress={() => navigateToRecipe(recipe)}>
                      <View style={styles.imageContainer}>
                        <Image source={recipe.image} style={styles.recipeImage} resizeMode="cover" />
                        <View style={styles.recipeBadges}>
                          <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={10} color="#FFD700" />
                            <Text style={styles.ratingText}>{recipe.rating.toFixed(1)}</Text>
                          </View>
                          <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(recipe.difficulty) }]}>
                            <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                          </View>
                        </View>
                        <TouchableOpacity style={styles.bookmarkButton} onPress={(e) => { e.stopPropagation(); handleRemoveRecipe(recipe); }}>
                          <Ionicons name="bookmark" size={18} color="#6A9AA9" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.recipeContent}>
                        <Text style={styles.recipeName} numberOfLines={2}>{recipe.name}</Text>
                        <Text style={styles.recipeCategory}>{recipe.category}</Text>
                        <View style={styles.recipeDetails}>
                          <Ionicons name="flame-outline" size={12} color="#FF6B6B" />
                          <Text style={styles.recipeCalories}>{recipe.calories} ккал</Text>
                          <Ionicons name="time-outline" size={12} color="#6A9AA9" style={styles.timeIcon} />
                          <Text style={styles.recipeTime}>{recipe.cookingTime}</Text>
                        </View>
                        <View style={styles.viewButton}>
                          <Text style={styles.viewButtonText}>Приготовить</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.plansSection}>
            {plansData.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>Нет сохраненных планов</Text>
                <Text style={styles.emptyText}>Сохраняйте планы питания для быстрого доступа</Text>
              </View>
            ) : (
              <View style={styles.plansList}>
                {plansData.map((plan) => (
                  <TouchableOpacity key={plan.id} style={styles.planCard} onPress={() => navigateToPlan(plan)}>
                    <Image source={plan.image} style={styles.planImage} resizeMode="cover" />
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
                        <Text style={styles.planDate}>Сохранено: {plan.savedDate}</Text>
                        <TouchableOpacity style={styles.usePlanButton} onPress={(e) => { e.stopPropagation(); handleRemovePlan(plan); }}>
                          <Ionicons name="bookmark" size={16} color="#000" />
                          <Text style={styles.usePlanButtonText}>Удалить</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: "#FFFFFF", borderBottomWidth: 2, borderBottomColor: "#6A9AA9" },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 24, color: "#1a1a1a", fontFamily: "System", textAlign: "center" },
  tabsContainer: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, gap: 8 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#6A9AA9" },
  tabText: { fontSize: 14, color: "#666", fontFamily: "System", fontWeight: "500" },
  tabTextActive: { color: "#6A9AA9", fontWeight: "600" },
  scrollView: { flex: 1 },
  searchSection: { backgroundColor: "#FFFFFF", padding: 15, marginBottom: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  searchInputContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 30, borderWidth: 2, borderColor: "#6A9AA9", paddingHorizontal: 15, paddingVertical: 6 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#000", paddingVertical: 4, fontFamily: "System" },
  categoriesContainer: { marginBottom: 12 },
  categoryButton: { backgroundColor: "white", borderWidth: 2, borderColor: "#6A9AA9", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  categoryButtonActive: { backgroundColor: "#9BDF11", borderColor: "#9BDF11" },
  categoryText: { fontSize: 14, color: "#000000", fontFamily: "System", fontWeight: "600" },
  categoryTextActive: { color: "#000000" },
  sectionDivider: { height: 2, backgroundColor: "#C2DAE2", marginHorizontal: -15, marginTop: 12 },
  recipesSection: { backgroundColor: "#FFFFFF", padding: 15, paddingBottom: 20 },
  recipesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  recipeColumn: { width: "48%", marginBottom: 16 },
  recipeCard: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5, height: 280 },
  imageContainer: { position: "relative" },
  recipeImage: { width: "100%", height: 120 },
  recipeBadges: { position: "absolute", top: 8, left: 8, flexDirection: "column", gap: 4 },
  ratingBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255, 255, 255, 0.9)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  ratingText: { fontSize: 10, fontWeight: "bold", color: "#000000", fontFamily: "System", marginLeft: 2 },
  difficultyBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  difficultyText: { fontSize: 9, fontWeight: "bold", color: "#FFFFFF", fontFamily: "System" },
  bookmarkButton: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255, 255, 255, 0.9)", alignItems: "center", justifyContent: "center" },
  recipeContent: { padding: 12, flex: 1, justifyContent: "space-between" },
  recipeName: { fontSize: 14, fontWeight: "600", color: "#212529", marginBottom: 4, fontFamily: "System" },
  recipeCategory: { fontSize: 11, color: "#6A9AA9", fontFamily: "System", fontStyle: "italic", marginBottom: 6 },
  recipeDetails: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  recipeCalories: { fontSize: 12, color: "#000000", marginLeft: 2, marginRight: 8 },
  timeIcon: { marginLeft: 4 },
  recipeTime: { fontSize: 12, color: "#6C757D", marginLeft: 2 },
  viewButton: { backgroundColor: "#9BDF11", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: "center", marginTop: 8 },
  viewButtonText: { color: "#000000", fontSize: 12 },
  plansSection: { backgroundColor: "#FFFFFF", padding: 15, paddingBottom: 20 },
  plansList: { gap: 16 },
  planCard: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", flexDirection: "row", height: 140 },
  planImage: { width: 120, height: "100%" },
  planContent: { flex: 1, padding: 12, justifyContent: "space-between" },
  planName: { fontSize: 16, fontWeight: "600", color: "#212529", marginBottom: 4 },
  planDescription: { fontSize: 12, color: "#6A9AA9", marginBottom: 8 },
  planDetails: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  planDetail: { flexDirection: "row", alignItems: "center", gap: 4 },
  planDetailText: { fontSize: 10, color: "#000000" },
  planFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planDate: { fontSize: 10, color: "#6C757D" },
  usePlanButton: { backgroundColor: "#9BDF11", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, flexDirection: "row", alignItems: "center", gap: 4 },
  usePlanButtonText: { color: "#000000", fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#000000", marginTop: 16, marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 14, color: "#6C757D", textAlign: "center", marginBottom: 20 },
  clearFiltersButton: { backgroundColor: "#9BDF11", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  clearFiltersText: { color: "#000000", fontSize: 16, fontWeight: "600" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#6C757D" },
});