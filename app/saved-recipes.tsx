import {
  Ionicons,
  Feather,
  MaterialIcons,
  FontAwesome,
} from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
} from "react-native";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/app/firebase/config";
import { useAuthContext } from "@/app/contexts/AuthContext";
import { favoriteService } from "@/app/services/favoriteService";

// --- ТИПЫ ДАННЫХ ---
type RecipeDetail = {
  id: string;
  name: string;
  category: string;
  calories: number;
  cookingTime: string;
  image: any;
  rating: number;
  difficulty: string;
  realRecipeId?: string;
  cookingTimeMinutes?: number;
  difficultyLevel?: string;
  favoriteId?: string;
};

// Размеры для карточек
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекус"];

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
    case "перекус":
    case "перекусы":
      return "Перекус";
    default:
      return "Другое";
  }
};

// Функция для получения иконки категории
const getCategoryIcon = (category: string) => {
  const normalizedCategory = category?.toLowerCase() || "";
  if (normalizedCategory === "завтрак") return "sunny-outline";
  if (normalizedCategory === "обед") return "restaurant-outline";
  if (normalizedCategory === "ужин") return "moon-outline";
  if (normalizedCategory === "перекус") return "cafe-outline";
  return "fast-food-outline";
};

// Функция для получения уровня сложности
const getDifficultyLevel = (difficulty: string) => {
  if (!difficulty) return "Легко";
  const normalized = difficulty.toLowerCase();
  if (normalized.includes("легк")) return "Легко";
  if (normalized.includes("средн")) return "Средне";
  if (normalized.includes("сложн")) return "Сложно";
  return difficulty;
};

const getDifficultyColor = (difficulty: string) => {
  if (!difficulty) return "#6A9AA9";
  
  const lowerDifficulty = difficulty.toLowerCase();
  if (lowerDifficulty.includes("легк")) return "#4CAF50";
  if (lowerDifficulty.includes("средн")) return "#FF9800";
  if (lowerDifficulty.includes("сложн")) return "#F44336";
  return "#6A9AA9";
};

export default function SavedRecipesScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [recipesData, setRecipesData] = useState<RecipeDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // --- ЗАГРУЗКА ИЗБРАННЫХ РЕЦЕПТОВ ---
  const loadFavorites = useCallback(async () => {
    const userId = user?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const favoritesQuery = query(
        collection(db, "user_favorites"),
        where("userId", "==", userId),
        where("active", "==", true)
      );
      const favoritesSnapshot = await getDocs(favoritesQuery);
      
      if (favoritesSnapshot.empty) {
        setRecipesData([]);
        setLoading(false);
        return;
      }

      const recipes: RecipeDetail[] = [];
      
      for (const favDoc of favoritesSnapshot.docs) {
        const favData = favDoc.data();
        const recipeId = favData.recipeId;
        
        if (!recipeId) continue;
        
        try {
          const recipeRef = doc(db, "recipes", recipeId);
          const recipeDoc = await getDoc(recipeRef);
          
          if (recipeDoc.exists()) {
            const recipeData = recipeDoc.data();
            const title = recipeData.title || "Рецепт без названия";
            const rawCategory = recipeData.mealType || recipeData.categories?.[0] || "other";
            const category = getCategoryName(rawCategory);
            
            const calories = recipeData.nutritionPer100g?.calories || recipeData.caloriesPer100g || recipeData.calories || 0;
            
            let cookingTimeValue = 20;
            const rawTime = recipeData.prepTime || recipeData.cookingTime;
            if (rawTime) {
              if (typeof rawTime === "number") {
                cookingTimeValue = rawTime;
              } else {
                const parsed = parseInt(rawTime, 10);
                cookingTimeValue = isNaN(parsed) ? 20 : parsed;
              }
            }
            const cookingTime = formatMinutes(cookingTimeValue);
            
            const rating = recipeData.averageRating || recipeData.rating || 0;
            
            let difficulty = "Легко";
            const rawDifficulty = recipeData.difficulty || recipeData.difficultyLevel;
            if (rawDifficulty) {
              const normalizedDifficulty = String(rawDifficulty).trim();
              if (normalizedDifficulty.toLowerCase().includes("легк")) {
                difficulty = "Легко";
              } else if (normalizedDifficulty.toLowerCase().includes("средн")) {
                difficulty = "Средне";
              } else if (normalizedDifficulty.toLowerCase().includes("сложн")) {
                difficulty = "Сложно";
              } else {
                difficulty = normalizedDifficulty;
              }
            }
            
            let imageUri = recipeData.imageUrl || recipeData.image;
            
            recipes.push({
              id: favDoc.id,
              name: title,
              category: category,
              calories: calories,
              cookingTime: cookingTime,
              cookingTimeMinutes: cookingTimeValue,
              image: imageUri ? { uri: imageUri } : null,
              rating: rating,
              difficulty: difficulty,
              difficultyLevel: difficulty,
              realRecipeId: recipeId,
              favoriteId: favDoc.id
            });
          }
        } catch (recipeError) {
          console.error(`Ошибка загрузки рецепта ${recipeId}:`, recipeError);
        }
      }
      
      setRecipesData(recipes);
    } catch (error) {
      console.error("Ошибка при загрузке избранных рецептов:", error);
      setRecipesData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // --- ФИЛЬТРАЦИЯ ---
  const filteredRecipes = useMemo(() => {
    return recipesData.filter((recipe) => {
      const matchesSearch = recipe.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "Все" || recipe.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, recipesData]);

  // --- УДАЛЕНИЕ ИЗ ИЗБРАННОГО ---
  const removeFromFavorites = async (recipe: RecipeDetail) => {
    const userId = user?.uid;
    if (!userId) {
      Alert.alert("Ошибка", "Вы не авторизованы");
      return;
    }

    try {
      const recipeIdToRemove = recipe.realRecipeId || recipe.id;
      await favoriteService.removeFromFavorites(recipeIdToRemove, 'recipe', userId);
      setRecipesData((prev) => prev.filter((item) => item.id !== recipe.id));
      Alert.alert("Успешно", "Рецепт удален из избранного");
    } catch (error) {
      console.error("Ошибка при удалении:", error);
      Alert.alert("Ошибка", "Не удалось удалить рецепт.");
    }
  };

  const navigateToRecipe = (recipe: RecipeDetail) => {
    router.push({
      pathname: "/meal",
      params: {
        mealId: recipe.realRecipeId || recipe.id,
        mealName: recipe.name,
        mealType: recipe.category,
        initialBookmarked: "true"
      }
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>Загрузка избранных рецептов...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Сохраненные рецепты</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6A9AA9"]} tintColor="#6A9AA9" />
        }
      >
        <View style={styles.searchSection}>
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

          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Поиск рецептов..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {(searchQuery !== "" || selectedCategory !== "Все") && (
                <TouchableOpacity onPress={resetFilters} style={styles.clearFilterButton}>
                  <Feather name="x" size={16} color="#666" />
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.sectionDivider} />
        </View>

        <View style={styles.recipesSection}>
          <View style={styles.recipesHeader}>
            <Text style={styles.recipesTitle}>
              {recipesData.length > 0 ? `${filteredRecipes.length} из ${recipesData.length}` : `${filteredRecipes.length} рецептов`}
            </Text>
            <TouchableOpacity onPress={resetFilters}>
              <Feather name="refresh-ccw" size={16} color="#6A9AA9" />
            </TouchableOpacity>
          </View>

          <View style={styles.recipesGrid}>
            {filteredRecipes.map((recipe) => (
              <View key={recipe.id} style={styles.recipeColumn}>
                <TouchableOpacity style={styles.recipeCard} onPress={() => navigateToRecipe(recipe)} activeOpacity={0.8}>
                  <View style={styles.imageContainer}>
                    {recipe.image && recipe.image.uri && recipe.image.uri.length > 5 ? (
                      <Image source={{ uri: recipe.image.uri }} style={styles.recipeImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.recipeImagePlaceholder}>
                        <Ionicons name={getCategoryIcon(recipe.category) as any} size={32} color="#6A9AA9" />
                      </View>
                    )}
                    <View style={styles.recipeBadges}>
                      {(recipe.rating ?? 0) > 0 && (
                        <View style={styles.ratingBadge}>
                          <FontAwesome name="star" size={10} color="#FFD700" />
                          <Text style={styles.ratingText}>{recipe.rating.toFixed(1)}</Text>
                        </View>
                      )}
                      <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(recipe.difficulty) }]}>
                        <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.bookmarkButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        removeFromFavorites(recipe);
                      }}
                    >
                      <Ionicons name="bookmark" size={18} color="#6A9AA9" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recipeContent}>
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeName} numberOfLines={2}>
                        {recipe.name}
                      </Text>
                      <Text style={styles.recipeCategory}>{recipe.category}</Text>
                      <View style={styles.recipeDetails}>
                        {recipe.calories > 0 && (
                          <Text style={styles.recipeCalories}>{recipe.calories} ккал</Text>
                        )}
                        <MaterialIcons name="access-time" size={12} color="#6A9AA9" style={styles.timeIcon} />
                        <Text style={styles.recipeTime}>{recipe.cookingTime}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.viewButton} onPress={() => navigateToRecipe(recipe)}>
                      <Text style={styles.viewButtonText}>Посмотреть</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {filteredRecipes.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="bookmark-outline" size={64} color="#C2DAE2" />
              <Text style={styles.emptyStateText}>Рецепты не найдены</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery !== "" || selectedCategory !== "Все"
                  ? "Попробуйте изменить параметры поиска"
                  : "У вас пока нет сохраненных рецептов"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
    flex: 1,
  },
  searchSection: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    marginBottom: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#6A9AA9",
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#000",
    paddingVertical: 4,
    fontFamily: "Playfair Display Regular",
  },
  clearFilterButton: {
    padding: 4,
    marginLeft: 8,
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoryButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  categoryText: {
    fontSize: 14,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    fontWeight: "600",
  },
  categoryTextActive: {
    color: "#000000",
  },
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -15,
    marginTop: 12,
  },
  recipesSection: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    paddingBottom: 20,
  },
  recipesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  recipesTitle: {
    fontSize: 16,
    color: "#000000ff",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    height: 280,
  },
  imageContainer: {
    position: "relative",
    height: 120,
    backgroundColor: "#F8F8F8",
    justifyContent: "center",
    alignItems: "center",
  },
  recipeImage: {
    width: "100%",
    height: "100%",
  },
  recipeImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
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
    backgroundColor: "rgba(255,255,255,0.9)",
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
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
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
  emptyState: {
    alignItems: "center",
    padding: 40,
    marginTop: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    marginBottom: 24,
  },
});