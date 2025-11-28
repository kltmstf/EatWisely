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
} from "react-native";
// Убедитесь, что пути импорта верные для вашего проекта
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

// Тип данных, приходящих из сервиса
type FavoriteItem = {
  id: string;
  userId: string;
  favoriteType: "recipe" | "ration";
  createdAt: any;
  recipeId?: string;
  rationPlanId?: string;
  item: RecipeDetail; // Предполагаем, что сервис возвращает вложенный объект item
};

// Интерфейс контекста хука (для типизации useFavorites)
interface FavoritesContextType {
  favoriteRecipeIds: string[];
  favoriteRationIds: string[];
  loading: boolean;
  isFavorite: (id: string, type: "recipe" | "ration") => boolean;
  toggleFavorite: (id: string, type: "recipe" | "ration") => Promise<void>;
  loadFavorites: () => Promise<void>;
}

const categories = ["Все", "Завтраки", "Обед", "Ужин", "Перекусы", "Салаты"];

export default function SavedRecipesScreen() {
  const router = useRouter();

  // Приводим результат хука к интерфейсу, чтобы TS понимал структуру
  const {
    isFavorite,
    toggleFavorite,
    loading: favoritesLoading,
    favoriteRecipeIds,
  } = useFavorites() as FavoritesContextType;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [recipesData, setRecipesData] = useState<RecipeDetail[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // --- ЗАГРУЗКА ДАННЫХ ИЗ БД ---
  useEffect(() => {
    let isMounted = true;

    const loadRecipeDetails = async () => {
      // Если хук еще инициализируется, ждем
      if (favoritesLoading) return;

      setDataLoading(true);
      try {
        // Принудительно указываем тип возвращаемого значения сервиса
        // Используем 'as unknown' как промежуточный шаг, если типы сильно не совпадают
        const allFavorites =
          (await favoriteService.getUserFavorites()) as unknown as FavoriteItem[];

        if (isMounted) {
          // Фильтруем и преобразуем данные
          const favoriteRecipes: RecipeDetail[] = allFavorites
            .filter((fav) => fav.favoriteType === "recipe" && fav.item)
            .map((fav) => ({
              id: fav.item.id,
              name: fav.item.name || "Без названия",
              category: fav.item.category || "Другое",
              calories: fav.item.calories || 0,
              cookingTime: fav.item.cookingTime || "0 мин",
              // Проверка на наличие изображения
              image: fav.item.image
                ? { uri: fav.item.image }
                : require("@/assets/images/dinner-rice.png"),
              rating: fav.item.rating || 0,
              difficulty: fav.item.difficulty || "Легко",
            }));

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
  }, [favoritesLoading, favoriteRecipeIds]); // Перезагружаем при изменении списка ID

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
      // Вызываем метод сервиса
      await toggleFavorite(recipeId, "recipe");
      // Оптимистичное обновление: сразу удаляем из локального стейта
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
    switch (difficulty) {
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

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
  };

  const isLoading = favoritesLoading || dataLoading;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Сохраненные рецепты",
          headerBackTitle: "Назад",
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
      >
        {/* Поиск и категории */}
        <View style={styles.searchSection}>
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
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
                <>
                  <Text style={styles.recipesTitle}>
                    {filteredRecipes.length} рецептов найдено
                  </Text>

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
                              <View style={styles.ratingBadge}>
                                <FontAwesome
                                  name="star"
                                  size={10}
                                  color="#FFD700"
                                />
                                <Text style={styles.ratingText}>
                                  {recipe.rating}
                                </Text>
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

                            {/* Кнопка закладки (Удаление) */}
                            <TouchableOpacity
                              style={styles.bookmarkButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                toggleBookmarkHandler(recipe.id);
                              }}
                            >
                              <Ionicons
                                name="bookmark" // Всегда закрашенная, так как это страница "Сохраненные"
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
                                <Text style={styles.recipeCalories}>
                                  {recipe.calories} ккал
                                </Text>
                                <MaterialIcons
                                  name="access-time"
                                  size={12}
                                  color="#6A9AA9"
                                  style={styles.timeIcon}
                                />
                                <Text style={styles.recipeTime}>
                                  {recipe.cookingTime}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.viewButton}>
                              <Text style={styles.viewButtonText}>
                                Приготовить
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </>
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
    fontSize: 24,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
  },
  scrollContainer: {
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
    marginBottom: 12,
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
  recipesTitle: {
    fontSize: 16,
    color: "#000000ff",
    marginBottom: 12,
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
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
