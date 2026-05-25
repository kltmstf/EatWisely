// app/(tabs)/profile/my-recipes.tsx - ПОЛНАЯ ВЕРСИЯ С ПОДДЕРЖКОЙ ДРУГОГО ПОЛЬЗОВАТЕЛЯ

import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
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
  Modal,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from "react-native";
import { recipeService } from "@/app/services/recipeService";
import { userService } from "@/app/services/userService";
import { auth } from "@/app/firebase/config";

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
};

const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекусы"];
const RECIPES_PER_PAGE = 6;
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

// Функция для получения названия категории по mealType
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

// Функция для форматирования времени приготовления
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

export default function MyRecipesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = params.userId as string;
  const [targetUserName, setTargetUserName] = useState<string>("");
  
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [displayedRecipes, setDisplayedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = !targetUserId || targetUserId === currentUserId;

  // Загрузка имени пользователя
  const loadUserName = useCallback(async () => {
    if (!targetUserId || isOwnProfile) {
      setTargetUserName("");
      return;
    }
    
    try {
      const userProfile = await userService.fetchUserProfile(targetUserId);
      setTargetUserName(userProfile?.name || "пользователя");
    } catch (error) {
      console.error("Ошибка загрузки имени пользователя:", error);
      setTargetUserName("пользователя");
    }
  }, [targetUserId, isOwnProfile]);

  // Загрузка рецептов пользователя
  const loadUserRecipes = useCallback(async () => {
    if (loading && recipes.length > 0) return;

    try {
      setLoading(true);

      // Загружаем рецепты для указанного пользователя
      const userId = targetUserId || currentUserId;
      if (!userId) {
        setRecipes([]);
        return;
      }
      
      const userRecipes = await recipeService.getUserRecipes(userId);
      
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
      
      // Сортировка по дате создания (новые сначала)
      formattedRecipes.sort((a, b) => {
        const aTime = getTimestamp(a.createdAt);
        const bTime = getTimestamp(b.createdAt);
        return bTime - aTime;
      });

      setRecipes(formattedRecipes);
      setPage(0);
      setHasMore(true);
    } catch (error) {
      console.error("Ошибка загрузки рецептов:", error);
      Alert.alert("Ошибка", "Не удалось загрузить рецепты");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [targetUserId, currentUserId, loading, recipes.length]);

  // Вспомогательная функция для получения timestamp
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

  // Инициализация
  useEffect(() => {
    const init = async () => {
      await loadUserName();
      await loadUserRecipes();
    };
    init();
  }, [targetUserId]);

  // Фильтрация рецептов
  useEffect(() => {
    let filtered = [...recipes];

    // Фильтр по категории
    if (selectedCategory !== "Все") {
      filtered = filtered.filter(recipe => {
        const recipeCategory = getCategoryName(recipe.mealType);
        return recipeCategory.toLowerCase() === selectedCategory.toLowerCase();
      });
    }

    // Фильтр по поиску
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

  // Пагинация - отображаем только часть рецептов
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

  // Загрузка следующей страницы
  const loadMoreRecipes = () => {
    if (!hasMore || loadingMore) return;
    setPage(prev => prev + 1);
    setLoadingMore(true);
  };

  // Обработчик скролла
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    
    const isCloseToBottom = 
      layoutMeasurement.height + contentOffset.y >= 
      contentSize.height - paddingToBottom;

    if (isCloseToBottom && hasMore && !loadingMore && !loading) {
      loadMoreRecipes();
    }
  };

  // Форматирование даты
  const formatDate = (dateInput: any) => {
    try {
      let date: Date;
      
      if (typeof dateInput === 'string') {
        date = new Date(dateInput);
      } else if (dateInput?.seconds) {
        date = new Date(dateInput.seconds * 1000);
      } else if (typeof dateInput === 'number') {
        date = new Date(dateInput);
      } else {
        date = new Date();
      }
      
      return date.toLocaleDateString("ru-RU");
    } catch (error) {
      return "Дата неизвестна";
    }
  };

  // Обновление притягивания вниз
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserRecipes();
  }, [loadUserRecipes]);

  // Обработчик удаления рецепта (только для своих рецептов)
  const handleDeleteRecipe = async () => {
    if (!recipeToDelete) return;

    try {
      await recipeService.deleteRecipe(recipeToDelete.id);
      Alert.alert("Успешно", "Рецепт удален");
      setShowDeleteModal(false);
      setRecipeToDelete(null);
      loadUserRecipes();
    } catch (error) {
      console.error("Ошибка удаления рецепта:", error);
      Alert.alert("Ошибка", "Не удалось удалить рецепт");
    }
  };

  // Переход к редактированию рецепта (только для своих рецептов)
  const navigateToEditRecipe = (recipe: Recipe) => {
    const editData = {
      recipeId: recipe.id,
      title: recipe.title || "",
      description: recipe.description || "",
      mealType: recipe.mealType || "",
      difficulty: recipe.difficultyLevel || recipe.difficulty || "Легко",
      cookingTime: recipe.cookingTime ? String(recipe.cookingTime).replace(/\D/g, '') : "",
      calories: recipe.calories ? String(recipe.calories) : "",
      proteins: "0",
      fats: "0",
      carbohydrates: "0",
      weight: "300",
      servings: "1",
      imageUrl: recipe.imageUrl || recipe.image || recipe.langdir1 || "",
      isPublic: String(recipe.isPublic || false),
      ingredients: JSON.stringify(recipe.ingredients || []),
      instructions: JSON.stringify(recipe.instructions || []),
      isEditMode: "true",
    };

    router.push({
      pathname: "/create-recipe" as any,
      params: editData,
    });
  };

  // Открытие модального окна удаления
  const openDeleteModal = (recipe: Recipe) => {
    setRecipeToDelete(recipe);
    setShowDeleteModal(true);
  };

  // Переход к созданию нового рецепта
  const navigateToCreateRecipe = () => {
    router.push("/create-recipe");
  };

  // Переход к деталям рецепта
  const navigateToRecipeDetail = (recipe: Recipe) => {
    router.push({
      pathname: "/meal",
      params: { 
        mealId: recipe.id,
        recipeId: recipe.id,
        mealName: recipe.title,
        category: getCategoryName(recipe.mealType),
      }
    });
  };

  // Цвет для сложности
  const getDifficultyColor = (difficulty?: string) => {
    if (!difficulty) return "#6A9AA9";
    
    const lowerDifficulty = difficulty.toLowerCase();
    if (lowerDifficulty.includes("легк") || lowerDifficulty === "easy") return "#4CAF50";
    if (lowerDifficulty.includes("средн") || lowerDifficulty === "medium") return "#FF9800";
    if (lowerDifficulty.includes("сложн") || lowerDifficulty === "hard") return "#F44336";
    return "#6A9AA9";
  };

  // Получение иконки категории
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

  // Получение URL изображения
  const getImageUrl = (recipe: Recipe) => {
    return recipe.imageUrl || recipe.image || recipe.langdir1 || null;
  };

  // Сброс фильтров и скролл наверх
  const resetFiltersAndScroll = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  // Компонент загрузки внизу
  const FooterLoader = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6A9AA9" />
        <Text style={styles.footerLoaderText}>Загрузка...</Text>
      </View>
    );
  };

  // Рендер карточки рецепта
  const renderRecipeCard = (recipe: Recipe) => {
    const imageUrl = getImageUrl(recipe);
    const categoryName = getCategoryName(recipe.mealType);
    const cookingTime = formatCookingTime(recipe.cookingTime);
    const difficulty = recipe.difficultyLevel || recipe.difficulty || "Легко";
    const isOwnRecipe = recipe.userId === currentUserId;

    return (
      <View key={recipe.id} style={styles.recipeColumn}>
        <TouchableOpacity
          style={styles.recipeCard}
          onPress={() => navigateToRecipeDetail(recipe)}
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
            
            {/* Статус публичности */}
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
            
            {/* Кнопки действий (только для своих рецептов) */}
            {isOwnRecipe && (
              <View style={styles.recipeActionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigateToEditRecipe(recipe);
                  }}
                >
                  <Feather name="edit-2" size={14} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: "#FF6B6B" }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openDeleteModal(recipe);
                  }}
                >
                  <Feather name="trash-2" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
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
            <View style={styles.recipeFooter}>
              <Text style={styles.recipeDate}>
                {formatDate(recipe.createdAt)}
              </Text>
              {recipe.averageRating ? (
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={12} color="#FFD700" />
                  <Text style={styles.ratingText}>
                    {recipe.averageRating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const pageTitle = isOwnProfile 
    ? "Мои рецепты" 
    : `Рецепты ${targetUserName}`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Упрощенный заголовок */}
      <View style={styles.simpleHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.simpleHeaderText}>{pageTitle}</Text>
        {isOwnProfile && (
          <TouchableOpacity
            style={styles.addRecipeButton}
            onPress={navigateToCreateRecipe}
          >
            <Ionicons name="add-outline" size={24} color="#1a1a1a" />
          </TouchableOpacity>
        )}
        {!isOwnProfile && <View style={styles.addRecipeButton} />}
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
        {/* Поиск и фильтры */}
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

        {/* Рецепты */}
        <View style={styles.recipesSection}>
          {/* Заголовок с количеством рецептов */}
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

          {/* Сетка рецептов */}
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
                  : isOwnProfile 
                    ? "У вас пока нет рецептов" 
                    : `У ${targetUserName} пока нет рецептов`}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery || selectedCategory !== "Все"
                  ? "Попробуйте изменить параметры поиска"
                  : isOwnProfile 
                    ? "Создайте свой первый рецепт!" 
                    : ""}
              </Text>
              {isOwnProfile && (
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={navigateToCreateRecipe}
                >
                  <Ionicons name="add-circle" size={20} color="#000000" />
                  <Text style={styles.emptyStateButtonText}>Создать рецепт</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View style={styles.recipesGrid}>
                {displayedRecipes.map((recipe) => renderRecipeCard(recipe))}
              </View>
              
              {/* Индикатор загрузки */}
              <FooterLoader />
            </>
          )}
        </View>
      </ScrollView>

      {/* Кнопка создания рецепта (только для своих рецептов) */}
      {isOwnProfile && (
        <TouchableOpacity
          style={styles.fab}
          onPress={navigateToCreateRecipe}
          activeOpacity={0.8}
        >
          <View style={styles.fabContent}>
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}

      {/* Кнопка для скролла наверх */}
      {displayedRecipes.length > 4 && (
        <TouchableOpacity
          style={styles.scrollToTopButton}
          onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}
        >
          <Ionicons name="chevron-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Модальное окно удаления (только для своих рецептов) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning-outline" size={32} color="#FF6B6B" />
              <Text style={styles.modalTitle}>Удалить рецепт</Text>
              <Text style={styles.modalSubtitle}>
                Вы уверены, что хотите удалить "{recipeToDelete?.title}"?
              </Text>
              <Text style={styles.modalWarning}>
                Это действие нельзя отменить
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteRecipe}
              >
                <Text style={styles.deleteButtonText}>Удалить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 120,
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
  
  // Упрощенный заголовок
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
  addRecipeButton: {
    padding: 8,
    width: 40,
    alignItems: "flex-end",
  },
  
  // Стили поиска и фильтров
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
  recipeActionButtons: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "column",
    gap: 4,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(106, 154, 169, 0.9)",
    alignItems: "center",
    justifyContent: "center",
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
  recipeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recipeDate: {
    fontSize: 10,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    fontSize: 10,
    color: "#000000",
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
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#9BDF11",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#C2DAE2",
    gap: 8,
  },
  emptyStateButtonText: {
    color: "#000000",
    fontSize: 14,
    fontFamily: "Playfair Display Bold",
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    zIndex: 1000,
  },
  fabContent: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#9BDF11',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 12,
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
  scrollToTopButton: {
    position: 'absolute',
    bottom: 110,
    right: 28,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6A9AA9',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 999,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Playfair Display Bold",
    color: "#1a1a1a",
    marginTop: 12,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    marginBottom: 8,
  },
  modalWarning: {
    fontSize: 14,
    color: "#FF6B6B",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#6A9AA9",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
  },
  cancelButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  deleteButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
});