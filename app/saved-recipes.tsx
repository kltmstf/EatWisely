// app/saved-recipes.tsx
import {
  Ionicons,
  Feather,
  MaterialIcons,
  FontAwesome,
} from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo, useEffect } from "react";
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
} from "react-native";

import { useFavorites } from "@/app/hooks/useFavorites";
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
};

// Размеры для карточек
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

const categories = ["Все", "Завтраки", "Обед", "Ужин", "Перекусы", "Салаты"];

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
    case "breakfast":
      return "Завтрак";
    case "lunch":
    case "обед":
    case "ocheq":
    case "dceq":
    case "ocеq":
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

export default function SavedRecipesScreen() {
  const router = useRouter();

  // Используем хук без строгой типизации
  const favoritesContext = useFavorites() as any;
  const isFavorite = favoritesContext?.isFavorite || (() => false);
  const toggleFavorite = favoritesContext?.toggleFavorite || (async () => {});
  const favoritesLoading = favoritesContext?.loading || false;
  const favoriteRecipeIds = favoritesContext?.favoriteRecipeIds || [];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [recipesData, setRecipesData] = useState<RecipeDetail[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // --- ЗАГРУЗКА ДАННЫХ ИЗ БД ---
  useEffect(() => {
    let isMounted = true;

    const loadRecipeDetails = async () => {
      if (favoritesLoading) return;

      setDataLoading(true);
      try {
        const allFavorites = await favoriteService.getUserFavorites();

        if (isMounted) {
          // Фильтруем и преобразуем данные с правильным маппингом полей
          const favoriteRecipes: RecipeDetail[] = allFavorites
            .filter((fav: any) => fav.favoriteType === 'recipe' && fav.item)
            .map((fav: any) => {
              const recipeData = fav.item;
              
              // Получаем значения из разных возможных мест хранения данных
              const title = recipeData.title || recipeData.name || recipeData.fields?.title || "Рецепт без названия";
              
              // Категория - получаем из mealType или fields
              const rawCategory = recipeData.mealType || recipeData.fields?.mealType || "other";
              const category = getCategoryName(rawCategory);
              
              // Калории
              let calories = 0;
              if (recipeData.fields?.calories !== undefined) calories = recipeData.fields.calories;
              else if (recipeData.calories !== undefined) calories = recipeData.calories;
              else if (recipeData.fields?.fscts !== undefined) calories = recipeData.fields.fscts;
              
              // Время приготовления
              let cookingTime = "20 минут";
              const rawTime = recipeData.fields?.cookingTime || recipeData.cookingTime || recipeData.time;
              
              if (rawTime) {
                if (typeof rawTime === 'number') {
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
              
              // Рейтинг
              const rating = recipeData.rating || recipeData.fields?.rating || recipeData.ratingCount || 0;
              
              // Сложность приготовления
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
              
              // Изображение
              let imageUri = null;
              if (recipeData.fields?.image) imageUri = recipeData.fields.image;
              else if (recipeData.image) imageUri = recipeData.image;
              else if (recipeData.imageUrl) imageUri = recipeData.imageUrl;
              else if (recipeData.fields?.langdir1) imageUri = recipeData.fields.langdir1;

              return {
                id: recipeData.id || `recipe-${Date.now()}`,
                name: title,
                category: category,
                calories: calories,
                cookingTime: cookingTime,
                image: imageUri 
                  ? { uri: imageUri }
                  : require("@/assets/images/dinner-rice.png"),
                rating: rating,
                difficulty: difficulty
              };
            });

          setRecipesData(favoriteRecipes);
        }
      } catch (error) {
        console.error("Ошибка загрузки рецептов:", error);
      } finally {
        if (isMounted) {
          setDataLoading(false);
        }
      }
    };

    loadRecipeDetails();

    return () => {
      isMounted = false;
    };
  }, [favoritesLoading, favoriteRecipeIds]);

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
  const toggleBookmarkHandler = async (recipeId: string) => {
    try {
      // Удаляем через сервис напрямую
      await favoriteService.removeFromFavorites(recipeId, 'recipe');
      // Оптимистичное обновление
      setRecipesData((prev) => prev.filter((item) => item.id !== recipeId));
    } catch (error) {
      console.error("Ошибка при удалении:", error);
      Alert.alert("Ошибка", "Не удалось удалить рецепт.");
    }
  };

  const navigateToRecipe = (recipe: RecipeDetail) => {
    router.push({
      pathname: "/meal",
      params: {
        mealId: recipe.id,
        mealName: recipe.name,
        category: recipe.category,
      },
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    if (!difficulty) return "#6A9AA9";
    
    const lowerDifficulty = difficulty.toLowerCase();
    if (lowerDifficulty.includes("легк")) return "#4CAF50";
    if (lowerDifficulty.includes("средн")) return "#FF9800";
    if (lowerDifficulty.includes("сложн")) return "#F44336";
    return "#6A9AA9";
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
  };

  const isLoading = favoritesLoading || dataLoading;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Сохраненные рецепты</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Фильтры и поиск */}
        <View style={styles.filtersSection}>
          {/* Категории над поиском */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
            contentContainerStyle={styles.categoriesContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Строка поиска под фильтрами */}
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Feather
                name="search"
                size={16}
                color="#666"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Поиск рецептов..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
          <View style={styles.sectionDivider} />
        </View>

        {/* Список рецептов */}
        <View style={styles.recipesSection}>
          {isLoading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#9BDF11" />
              <Text style={styles.loadingText}>Загрузка избранных...</Text>
            </View>
          ) : (
            <>
              {/* Заголовок по центру с меньшим шрифтом */}
              <Text style={styles.recipesTitle}>
                {filteredRecipes.length} рецептов найдено
              </Text>

              {filteredRecipes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="bookmark-outline" size={64} color="#C2DAE2" />
                  <Text style={styles.emptyTitle}>Рецепты не найдены</Text>
                  <Text style={styles.emptyText}>
                    {searchQuery || selectedCategory !== "Все"
                      ? "Попробуйте изменить параметры поиска"
                      : "У вас пока нет сохраненных рецептов"}
                  </Text>
                  {(searchQuery || selectedCategory !== "Все") && (
                    <TouchableOpacity
                      style={styles.clearFiltersButton}
                      onPress={clearFilters}
                    >
                      <Text style={styles.clearFiltersText}>
                        Показать все рецепты
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.recipesGrid}>
                  {filteredRecipes.map((recipe) => (
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
                          <View style={styles.recipeBadges}>
                            {recipe.rating && recipe.rating > 0 ? (
                              <View style={styles.ratingBadge}>
                                <FontAwesome
                                  name="star"
                                  size={10}
                                  color="#FFD700"
                                />
                                <Text style={styles.ratingText}>
                                  {recipe.rating.toFixed(1)}
                                </Text>
                              </View>
                            ) : null}
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

                          {/* Кнопка закладки (Удаление) */}
                          <TouchableOpacity
                            style={styles.bookmarkButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              toggleBookmarkHandler(recipe.id);
                            }}
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
                            <Text style={styles.viewButtonText}>
                              Приготовить
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
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
    fontSize: 20, // Уменьшенный шрифт
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  filtersSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoriesContent: {
    paddingHorizontal: 4,
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
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -16,
    marginTop: 12,
  },
  recipesSection: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },
  recipesTitle: {
    fontSize: 18, // Уменьшенный шрифт
    color: "#212529",
    fontFamily: "Playfair Display Bold",
    textAlign: "center", // По центру
    marginBottom: 20,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    marginBottom: 20,
  },
  clearFiltersButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  clearFiltersText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
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
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
});