// app/select-user-recipes.tsx
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from "react-native";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { recipeService } from "@/app/services/recipeService";

// Типы данных
type Recipe = {
  id: string;
  title: string;
  description?: string;
  mealType?: string;
  category?: string;
  calories?: number;
  cookingTime?: string | number;
  difficultyLevel?: string;
  difficulty?: string;
  ingredients?: string[];
  instructions?: string[];
  image?: string;
  imageUrl?: string;
  langdir1?: string;
  createdAt: any;
  updatedAt: any;
  userId: string;
  isPublic?: boolean;
  likesCount?: number;
  savesCount?: number;
  averageRating?: number;
  rating?: number; 
};

const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекусы"];
const RECIPES_PER_PAGE = 6;
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

const getCategoryName = (mealType?: string): string => {
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

const formatCookingTime = (time: any): string => {
  if (!time) return "20 мин";
  
  if (typeof time === 'number') {
    const minutes = Math.abs(time);
    const lastDigit = minutes % 10;
    const lastTwoDigits = minutes % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${minutes} минут`;
    if (lastDigit === 1) return `${minutes} минута`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${minutes} минуты`;
    return `${minutes} минут`;
  }
  
  const strTime = String(time);
  return strTime;
};

export default function SelectMyRecipeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [displayedRecipes, setDisplayedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  // Получаем параметры для замены рецепта
  const isReplacement = params.isReplacement === "true";
  const mealIndex = params.mealIndex;
  const currentMealId = params.currentMealId;
  const currentMealCategory = params.currentMealCategory;
  const isCustomReplacement = params.isCustomReplacement === "true";

  // Загрузка рецептов пользователя
  const loadUserRecipes = useCallback(async (loadMore = false) => {
    if (loadMore && loadingMore) return;
    if (!loadMore && loading && recipes.length > 0) return;

    try {
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const userRecipes = await recipeService.getUserRecipes();
      
      const formattedRecipes: Recipe[] = userRecipes.map((recipe: any) => ({
        id: recipe.id,
        title: recipe.title || "Без названия",
        description: recipe.description || "",
        mealType: recipe.mealType,
        category: getCategoryName(recipe.mealType),
        calories: recipe.calories || 0,
        cookingTime: recipe.cookingTime,
        difficultyLevel: recipe.difficultyLevel || recipe.difficulty || "Легко",
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        image: recipe.image,
        imageUrl: recipe.imageUrl,
        langdir1: recipe.langdir1,
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
        userId: recipe.userId,
        isPublic: recipe.isPublic || false,
        likesCount: recipe.likesCount || 0,
        savesCount: recipe.savesCount || 0,
        averageRating: recipe.averageRating || 0,
      }));
      
      formattedRecipes.sort((a, b) => {
        const aTime = getTimestamp(a.createdAt);
        const bTime = getTimestamp(b.createdAt);
        return bTime - aTime;
      });

      setRecipes(formattedRecipes);
      
      if (!loadMore) {
        setPage(0);
        setHasMore(true);
      }
    } catch (error) {
      console.error("Ошибка загрузки рецептов:", error);
      Alert.alert("Ошибка", "Не удалось загрузить рецепты");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [loading, loadingMore, recipes.length]);

  useEffect(() => {
    loadUserRecipes();
  }, []);

  useEffect(() => {
    let filtered = [...recipes];

    if (selectedCategory !== "Все") {
      filtered = filtered.filter(recipe => {
        const recipeCategory = getCategoryName(recipe.mealType);
        return recipeCategory.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(recipe =>
        recipe.title?.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query)
      );
    }

    setFilteredRecipes(filtered);
    setPage(0);
    setHasMore(filtered.length > RECIPES_PER_PAGE);
  }, [recipes, selectedCategory, searchQuery]);

  useEffect(() => {
    const startIndex = 0;
    const endIndex = (page + 1) * RECIPES_PER_PAGE;
    const newDisplayed = filteredRecipes.slice(startIndex, endIndex);
    
    setDisplayedRecipes(newDisplayed);
    
    if (endIndex >= filteredRecipes.length) {
      setHasMore(false);
    } else {
      setHasMore(true);
    }
  }, [filteredRecipes, page]);

  const loadMoreRecipes = () => {
    if (!hasMore || loadingMore) return;
    setPage(prev => prev + 1);
    setLoadingMore(true);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    
    const isCloseToBottom = 
      layoutMeasurement.height + contentOffset.y >= 
      contentSize.height - paddingToBottom;

    if (isCloseToBottom && hasMore && !loadingMore) {
      loadMoreRecipes();
    }
  };

  const getTimestamp = (dateInput: any): number => {
    if (!dateInput) return 0;
    
    if (typeof dateInput === 'string') {
      return new Date(dateInput).getTime();
    } else if (dateInput?.seconds) {
      return dateInput.seconds * 1000;
    } else if (typeof dateInput === 'number') {
      return dateInput;
    }
    
    return 0;
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserRecipes();
  }, [loadUserRecipes]);

  const getDifficultyColor = (difficulty?: string) => {
    if (!difficulty) return "#6A9AA9";
    
    const lowerDifficulty = difficulty.toLowerCase();
    if (lowerDifficulty.includes("легк") || lowerDifficulty === "easy") return "#4CAF50";
    if (lowerDifficulty.includes("средн") || lowerDifficulty === "medium") return "#FF9800";
    if (lowerDifficulty.includes("сложн") || lowerDifficulty === "hard") return "#F44336";
    return "#6A9AA9";
  };

  const getCategoryIcon = (mealType?: string) => {
    const category = getCategoryName(mealType);
    switch (category.toLowerCase()) {
      case "завтрак":
        return "sunny-outline";
      case "обед":
        return "restaurant-outline";
      case "ужин":
        return "moon-outline";
      case "перекусы":
        return "cafe-outline";
      default:
        return "fast-food-outline";
    }
  };

  const getImageUrl = (recipe: Recipe) => {
    return recipe.imageUrl || recipe.image || recipe.langdir1 || null;
  };

  const resetFiltersAndScroll = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  // --- ФУНКЦИЯ ВЫБОРА РЕЦЕПТА ДЛЯ ЗАМЕНЫ ---
  const handleSelectRecipe = (recipe: Recipe) => {
    if (isReplacement) {
      // Переходим на страницу meal с параметрами для замены
      router.push({
        pathname: "/meal",
        params: {
          selectedRecipe: JSON.stringify({
            id: recipe.id,
            title: recipe.title,
            calories: recipe.calories || 300,
            proteins: 0,
            fats: 0,
            carbohydrates: 0,
            cookingTime: recipe.cookingTime || 20,
            difficultyLevel: recipe.difficultyLevel || recipe.difficulty || "Легко",
            imageUrl: recipe.imageUrl,
            mealType: recipe.mealType,
            category: getCategoryName(recipe.mealType),
            weight: "250г",
            rating: recipe.rating || 0
          }),
          returnTo: "meal",
          mealIndex: mealIndex,
          currentMealId: currentMealId,
          currentMealCategory: currentMealCategory,
          isReplacement: "true",
          isCustomReplacement: isCustomReplacement ? "true" : "false",
          isFromUserRecipes: "true"
        }
      });
    } else {
      // Обычное добавление на главную
      router.push({
        pathname: "/",
        params: {
          selectedRecipe: JSON.stringify({
            id: recipe.id,
            title: recipe.title,
            calories: recipe.calories || 300,
            proteins: 0,
            fats: 0,
            carbohydrates: 0,
            cookingTime: recipe.cookingTime || 20,
            difficultyLevel: recipe.difficultyLevel || recipe.difficulty || "Легко",
            imageUrl: recipe.imageUrl,
            mealType: recipe.mealType,
            weight: "250г",
            rating: recipe.rating || 0
          })
        }
      });
    }
  };

  const FooterLoader = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6A9AA9" />
        <Text style={styles.footerLoaderText}>Загрузка...</Text>
      </View>
    );
  };

  const renderRecipeCard = (recipe: Recipe) => {
    const imageUrl = getImageUrl(recipe);
    const categoryName = getCategoryName(recipe.mealType);
    const cookingTime = formatCookingTime(recipe.cookingTime);
    const difficulty = recipe.difficultyLevel || recipe.difficulty || "Легко";

    return (
      <View key={recipe.id} style={styles.recipeColumn}>
        <TouchableOpacity
          style={styles.recipeCard}
          onPress={() => handleSelectRecipe(recipe)}
        >
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.recipeImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.recipeImagePlaceholder}>
                <Ionicons 
                  name={getCategoryIcon(recipe.mealType)} 
                  size={32} 
                  color="#6A9AA9" 
                />
              </View>
            )}
            
            <View style={styles.recipeBadges}>
              <View style={[
                styles.difficultyBadge,
                { backgroundColor: getDifficultyColor(difficulty) }
              ]}>
                <Text style={styles.difficultyText}>
                  {difficulty}
                </Text>
              </View>
              {recipe.isPublic && (
                <View style={styles.publicBadge}>
                  <Ionicons name="earth" size={10} color="#FFFFFF" />
                </View>
              )}
            </View>
          </View>

          <View style={styles.recipeContent}>
            <View style={styles.recipeInfo}>
              <Text
                style={styles.recipeName}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {recipe.title}
              </Text>
              <Text style={styles.recipeCategory}>
                {categoryName}
              </Text>
              <View style={styles.recipeDetails}>
                {recipe.calories && recipe.calories > 0 ? (
                  <Text style={styles.recipeCalories}>
                    {recipe.calories} ккал
                  </Text>
                ) : null}
                <MaterialIcons
                  name="access-time"
                  size={12}
                  color="#6A9AA9"
                  style={styles.timeIcon}
                />
                <Text style={styles.recipeTime}>
                  {cookingTime}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => handleSelectRecipe(recipe)}
            >
              <Text style={styles.selectButtonText}>
                {isReplacement ? "Заменить" : "Выбрать"}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.simpleHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.simpleHeaderText}>
          {isReplacement ? "Заменить рецепт" : "Выберите рецепт"}
        </Text>
        <View style={styles.addRecipePlaceholder} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#6A9AA9"]}
            tintColor="#6A9AA9"
          />
        }
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.searchSection}>
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
              {(searchQuery || selectedCategory !== "Все") && (
                <TouchableOpacity
                  onPress={resetFiltersAndScroll}
                  style={styles.clearFilterButton}
                >
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
              {filteredRecipes.length} рецептов
            </Text>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={resetFiltersAndScroll}
            >
              <Feather name="refresh-ccw" size={16} color="#6A9AA9" />
            </TouchableOpacity>
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6A9AA9" />
              <Text style={styles.loadingText}>Загрузка рецептов...</Text>
            </View>
          ) : displayedRecipes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={64} color="#C2DAE2" />
              <Text style={styles.emptyStateText}>
                {searchQuery || selectedCategory !== "Все" 
                  ? "Рецепты не найдены" 
                  : "У вас пока нет рецептов"}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery || selectedCategory !== "Все"
                  ? "Попробуйте изменить параметры поиска"
                  : "Создайте свой первый рецепт!"}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.recipesGrid}>
                {displayedRecipes.map((recipe) => renderRecipeCard(recipe))}
              </View>
              
              <FooterLoader />
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
    position: 'relative',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  
  simpleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 8,
  },
  simpleHeaderText: {
    fontSize: 18,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
    flex: 1,
  },
  addRecipePlaceholder: {
    width: 40,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipesTitle: {
    fontSize: 16,
    color: "#000000ff",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  resetButton: {
    padding: 8,
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
    height: 260,
  },
  imageContainer: {
    position: "relative",
    height: 120,
    backgroundColor: "#F8F8F8",
    justifyContent: 'center',
    alignItems: 'center',
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
  publicBadge: {
    backgroundColor: "rgba(74, 144, 226, 0.9)",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
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
  selectButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    marginTop: 8,
  },
  selectButtonText: {
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
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  footerLoaderText: {
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
});