// app/(tabs)/recipes.tsx
import { useRouter } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Image, ScrollView, StatusBar, StyleSheet, Text, TextInput,
  TouchableOpacity, View, ActivityIndicator, Dimensions, RefreshControl, Alert
} from "react-native";
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Feather, MaterialIcons, FontAwesome, Ionicons } from "@expo/vector-icons";
import { useAuthContext } from "@/app/contexts/AuthContext";
import { userService } from "@/app/services/userService";
import { recipeService, Recipe } from "@/app/services/recipeService";
import { db } from "@/app/firebase/config";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;
const RECIPES_PER_PAGE = 10;

interface RecipeWithBookmark extends Recipe { 
  bookmarked: boolean; 
}

const Avatar: React.FC<{ photoURL?: string | null; size?: number }> = ({ photoURL, size = 55 }) => (
  photoURL ? (
    <Image source={{ uri: photoURL }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: "#9BDF11" }} resizeMode="cover" />
  ) : (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#9BDF11" }}>
      <Feather name="user" size={size * 0.4} color="#6A9AA9" />
    </View>
  )
);

const formatMinutes = (minutes: number): string => {
  const lastDigit = minutes % 10, lastTwoDigits = minutes % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${minutes} минут`;
  if (lastDigit === 1) return `${minutes} минута`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${minutes} минуты`;
  return `${minutes} минут`;
};

const getCategoryIcon = (categories: string[]) => {
  const category = categories?.[0]?.toLowerCase() || "";
  if (category === "завтрак") return "sunny-outline";
  if (category === "обед") return "restaurant-outline";
  if (category === "ужин") return "moon-outline";
  if (category === "перекус" || category === "перекусы") return "cafe-outline";
  return "fast-food-outline";
};

const getDifficultyColor = (difficulty: string) => {
  const d = difficulty?.toLowerCase();
  if (d === "легко") return "#4CAF50";
  if (d === "средне") return "#FF9800";
  if (d === "сложно") return "#F44336";
  return "#6A9AA9";
};

export default function Recipes() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Все");
  const [recipes, setRecipes] = useState<RecipeWithBookmark[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);

  const { user } = useAuthContext();
  const userId = user?.uid || null;
  const userName = user?.displayName || user?.email || "Пользователь";
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);

  const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекус"];
  const scrollViewRef = useRef<ScrollView>(null);
  const currentPageRef = useRef<number>(0);
  const allRecipesRef = useRef<Recipe[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!userId) return;
    userService.fetchUserProfile(userId).then(profileData => {
      if (profileData?.photoURL) setUserPhotoURL(profileData.photoURL);
    }).catch(console.error);
  }, [userId]);

  // Загрузка избранных рецептов (оригинальная версия)
  const loadBookmarks = useCallback(async (): Promise<Set<string>> => {
    if (!userId) return new Set();
    try {
      const favoritesQuery = query(
        collection(db, "user_favorites"),
        where("userId", "==", userId),
        where("active", "==", true)
      );
      const favoritesSnapshot = await getDocs(favoritesQuery);
      return new Set(favoritesSnapshot.docs.map(doc => doc.data().recipeId));
    } catch (error) {
      console.error("Ошибка загрузки избранного:", error);
      return new Set();
    }
  }, [userId]);

  // Основная функция загрузки рецептов
  const loadRecipes = useCallback(async (loadMore: boolean = false) => {
    if (loadingMore || (loadMore && !hasMore)) return;
    
    if (!loadMore) {
      setLoading(true);
      currentPageRef.current = 0;
    } else {
      setLoadingMore(true);
    }

    try {
      // Загружаем все рецепты сначала (оптимизировано для демонстрации)
      let fetchedRecipes: Recipe[] = [];
      
      if (searchQuery.trim()) {
        fetchedRecipes = await recipeService.searchRecipes(searchQuery.trim(), {
          categories: selectedCategory !== "Все" ? [selectedCategory] : undefined,
        });
      } else if (selectedCategory !== "Все") {
        fetchedRecipes = await recipeService.getRecipesByCategory(selectedCategory);
      } else {
        fetchedRecipes = await recipeService.getAllRecipes();
      }

      // Сохраняем все рецепты
      allRecipesRef.current = fetchedRecipes;
      setTotalCount(fetchedRecipes.length);
      
      // Загружаем избранное
      const bookmarkedIds = await loadBookmarks();
      
      // Добавляем информацию об избранном
      const recipesWithBookmarks = fetchedRecipes.map(recipe => ({
        ...recipe,
        bookmarked: bookmarkedIds.has(recipe.id!)
      }));

      // Пагинация
      const startIndex = loadMore ? (currentPageRef.current + 1) * RECIPES_PER_PAGE : 0;
      const endIndex = Math.min(startIndex + RECIPES_PER_PAGE, recipesWithBookmarks.length);
      const paginatedRecipes = recipesWithBookmarks.slice(startIndex, endIndex);

      if (loadMore) {
        setRecipes(prev => [...prev, ...paginatedRecipes]);
        if (endIndex >= recipesWithBookmarks.length) {
          setHasMore(false);
        } else {
          currentPageRef.current++;
        }
      } else {
        setRecipes(paginatedRecipes);
        setHasMore(endIndex < recipesWithBookmarks.length);
        if (endIndex < recipesWithBookmarks.length) {
          currentPageRef.current = 0;
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки рецептов:", error);
      Alert.alert("Ошибка", "Не удалось загрузить рецепты");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCategory, searchQuery, loadingMore, hasMore, loadBookmarks]);

  // Первоначальная загрузка
  useEffect(() => {
    loadRecipes(false);
  }, []);

  // Debounced загрузка при изменении фильтров
  useEffect(() => {
    if (!loading && !loadingMore) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        loadRecipes(false);
      }, 500);
    }
    return () => { 
      if (timerRef.current) clearTimeout(timerRef.current); 
    };
  }, [searchQuery, selectedCategory]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadRecipes(false);
    setRefreshing(false);
  }, [loadRecipes, refreshing]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    
    if (isCloseToBottom && !loadingMore && hasMore && !loading && !refreshing) {
      console.log("Загружаем еще рецепты...");
      loadRecipes(true);
    }
  }, [loadingMore, hasMore, loading, refreshing, loadRecipes]);

  // Оригинальная функция переключения закладки
  const toggleBookmark = async (recipeId: string) => {
    if (!userId) {
      Alert.alert("Вход required", "Войдите чтобы сохранять рецепты");
      return;
    }
    
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    const isCurrentlyBookmarked = recipe.bookmarked;
    
    // Оптимистичное обновление UI
    setRecipes(prev =>
      prev.map(r =>
        r.id === recipeId ? { ...r, bookmarked: !isCurrentlyBookmarked } : r
      )
    );

    try {
      const favoriteId = `${userId}_${recipeId}`;
      const favoriteRef = doc(db, "user_favorites", favoriteId);

      if (isCurrentlyBookmarked) {
        await deleteDoc(favoriteRef);
        console.log("🗑️ Рецепт удален из избранного");
      } else {
        await setDoc(favoriteRef, {
          userId: userId,
          recipeId: recipeId,
          createdAt: new Date(),
          active: true,
        });
        console.log("⭐ Рецепт добавлен в избранное");
      }
    } catch (error) {
      console.error("Ошибка обновления закладки:", error);
      // Откатываем изменения при ошибке
      setRecipes(prev =>
        prev.map(r =>
          r.id === recipeId ? { ...r, bookmarked: isCurrentlyBookmarked } : r
        )
      );
      Alert.alert("Ошибка", "Не удалось сохранить рецепт");
    }
  };

  const navigateToRecipe = (recipe: RecipeWithBookmark) => router.push({ 
    pathname: "/meal", 
    params: { 
      mealId: recipe.id, 
      mealName: recipe.title, 
      mealType: recipe.categories?.[0] || "other", 
      initialBookmarked: recipe.bookmarked.toString() 
    } 
  });
  
  const navigateToCreateRecipe = () => router.push("/create-recipe");
  const navigateToProfile = () => userId && router.push("/profile");

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
    setHasMore(true);
    currentPageRef.current = 0;
    loadRecipes(false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const getCalories = (recipe: Recipe) => Math.round(recipe.nutritionPer100g?.calories || recipe.calories || 0);
  const getPrepTime = (recipe: Recipe) => recipe.prepTime || 20;
  const getDifficulty = (recipe: Recipe) => recipe.difficulty || "Легко";
  const getImageUrl = (recipe: Recipe) => recipe.imageUrl || (recipe as any).image;

  if (loading && recipes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>Загрузка рецептов...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingText}>Рецепты</Text>
          <Text style={styles.dietText}>Найдите идеальное блюдо для себя</Text>
        </View>
        <TouchableOpacity style={styles.userInfo} onPress={navigateToProfile}>
          <Avatar photoURL={userPhotoURL} size={55} />
          <Text style={styles.userName}>{userName}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6A9AA9"]} tintColor="#6A9AA9" />}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.searchSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
            {categories.map(category => (
              <TouchableOpacity key={category} style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]} onPress={() => setSelectedCategory(category)}>
                <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>{category}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
              <TextInput style={styles.searchInput} placeholder="Поиск рецептов..." placeholderTextColor="#666" value={searchQuery} onChangeText={setSearchQuery} />
              {(searchQuery || selectedCategory !== "Все") && (
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
            <Text style={styles.recipesTitle}>{totalCount > 0 ? `${recipes.length} из ${totalCount}` : `${recipes.length} рецептов`}</Text>
            <TouchableOpacity onPress={resetFilters}>
              <Feather name="refresh-ccw" size={16} color="#6A9AA9" />
            </TouchableOpacity>
          </View>

          <View style={styles.recipesGrid}>
            {recipes.map((recipe, index) => (
              <View key={recipe.id || index} style={styles.recipeColumn}>
                <TouchableOpacity style={styles.recipeCard} onPress={() => navigateToRecipe(recipe)} activeOpacity={0.8}>
                  <View style={styles.imageContainer}>
                    {getImageUrl(recipe) && getImageUrl(recipe)!.length > 5 ? (
                      <Image source={{ uri: getImageUrl(recipe) }} style={styles.recipeImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.recipeImagePlaceholder}>
                        <Ionicons name={getCategoryIcon(recipe.categories || []) as any} size={32} color="#6A9AA9" />
                      </View>
                    )}
                    <View style={styles.recipeBadges}>
                      {(recipe.averageRating ?? 0) > 0 && (
                        <View style={styles.ratingBadge}>
                          <FontAwesome name="star" size={10} color="#FFD700" />
                          <Text style={styles.ratingText}>{(recipe.averageRating ?? 0).toFixed(1)}</Text>
                        </View>
                      )}
                      <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(getDifficulty(recipe)) }]}>
                        <Text style={styles.difficultyText}>{getDifficulty(recipe)}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.bookmarkButton} onPress={() => toggleBookmark(recipe.id!)}>
                      <Ionicons name={recipe.bookmarked ? "bookmark" : "bookmark-outline"} size={18} color="#6A9AA9" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recipeContent}>
                    <View style={styles.recipeInfo}>
                      <Text style={styles.recipeName} numberOfLines={2}>{recipe.title}</Text>
                      <Text style={styles.recipeCategory}>{recipe.categories?.[0] || "Другое"}</Text>
                      <View style={styles.recipeDetails}>
                        {getCalories(recipe) > 0 && <Text style={styles.recipeCalories}>{getCalories(recipe)} ккал</Text>}
                        <MaterialIcons name="access-time" size={12} color="#6A9AA9" style={styles.timeIcon} />
                        <Text style={styles.recipeTime}>{formatMinutes(getPrepTime(recipe))}</Text>
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

          {loadingMore && (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#6A9AA9" />
              <Text style={styles.footerLoaderText}>Загрузка еще...</Text>
            </View>
          )}

          {recipes.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={64} color="#C2DAE2" />
              <Text style={styles.emptyStateText}>Рецепты не найдены</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery || selectedCategory !== "Все" ? "Попробуйте изменить параметры поиска" : "Будьте первым, кто создаст рецепт!"}
              </Text>
              <TouchableOpacity style={styles.emptyStateButton} onPress={navigateToCreateRecipe}>
                <Ionicons name="add-circle" size={20} color="#000000" />
                <Text style={styles.emptyStateButtonText}>Создать рецепт</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={navigateToCreateRecipe} activeOpacity={0.8}>
        <View style={styles.fabContent}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {recipes.length > 8 && (
        <TouchableOpacity style={styles.scrollToTopButton} onPress={() => scrollViewRef.current?.scrollTo({ y: 0, animated: true })}>
          <Ionicons name="chevron-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Regular" },
  scrollContent: { paddingBottom: 120 },
  emptyState: { alignItems: "center", padding: 40, marginTop: 40 },
  emptyStateText: { fontSize: 18, color: "#6C757D", fontFamily: "Playfair Display Regular", marginBottom: 8, marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, color: "#6C757D", fontFamily: "Playfair Display Regular", textAlign: "center", marginBottom: 24 },
  emptyStateButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#9BDF11", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25, borderWidth: 2, borderColor: "#C2DAE2", gap: 8 },
  emptyStateButtonText: { color: "#000", fontSize: 14, fontFamily: "Playfair Display Bold" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: "#FFF", borderBottomWidth: 2, borderBottomColor: "#6A9AA9" },
  headerTextContainer: { flex: 1, marginRight: 15 },
  greetingText: { fontSize: 24, color: "#1a1a1a", marginBottom: 4, fontFamily: "Playfair Display Bold" },
  dietText: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular" },
  userInfo: { alignItems: "center", minWidth: 60 },
  userName: { fontSize: 12, color: "#666", fontFamily: "Playfair Display Regular", marginTop: 4, textAlign: "center" },
  searchSection: { backgroundColor: "#FFF", padding: 15, marginBottom: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInputContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 30, borderWidth: 2, borderColor: "#6A9AA9", paddingHorizontal: 15, paddingVertical: 6 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#000", paddingVertical: 4, fontFamily: "Playfair Display Regular" },
  clearFilterButton: { padding: 4, marginLeft: 8 },
  categoriesContainer: { marginBottom: 12 },
  categoryButton: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#6A9AA9", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  categoryButtonActive: { backgroundColor: "#9BDF11", borderColor: "#9BDF11" },
  categoryText: { fontSize: 14, color: "#000", fontFamily: "Playfair Display Regular", fontWeight: "600" },
  categoryTextActive: { color: "#000" },
  sectionDivider: { height: 2, backgroundColor: "#6A9AA9", marginHorizontal: -15, marginTop: 12 },
  recipesSection: { backgroundColor: "#FFF", padding: 15, paddingBottom: 20 },
  recipesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  recipesTitle: { fontSize: 16, color: "#000", fontWeight: "500", fontFamily: "Playfair Display Regular" },
  recipesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  recipeColumn: { width: CARD_WIDTH, marginBottom: 16 },
  recipeCard: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5, height: 280 },
  imageContainer: { position: "relative", height: 120, backgroundColor: "#F8F8F8", justifyContent: "center", alignItems: "center" },
  recipeImage: { width: "100%", height: "100%" },
  recipeImagePlaceholder: { width: "100%", height: "100%", backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center" },
  recipeBadges: { position: "absolute", top: 8, left: 8, flexDirection: "column", gap: 4 },
  ratingBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  ratingText: { fontSize: 10, fontWeight: "bold", color: "#000", fontFamily: "Playfair Display Regular", marginLeft: 2 },
  difficultyBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  difficultyText: { fontSize: 9, fontWeight: "bold", color: "#FFF", fontFamily: "Playfair Display Regular" },
  bookmarkButton: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 },
  recipeContent: { padding: 12, flex: 1, justifyContent: "space-between" },
  recipeInfo: { flex: 1, marginBottom: 8 },
  recipeName: { fontSize: 14, fontWeight: "600", color: "#212529", marginBottom: 4, fontFamily: "Playfair Display Regular", lineHeight: 18, minHeight: 36 },
  recipeCategory: { fontSize: 11, color: "#6A9AA9", fontFamily: "Playfair Display Regular", fontStyle: "italic", marginBottom: 6 },
  recipeDetails: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  recipeCalories: { fontSize: 12, color: "#000", fontWeight: "normal", fontFamily: "Playfair Display Bold", marginRight: 8 },
  timeIcon: { marginRight: 4 },
  recipeTime: { fontSize: 12, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  viewButton: { backgroundColor: "#9BDF11", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: "center", justifyContent: "center", minHeight: 36, marginTop: 8 },
  viewButtonText: { color: "#000", fontSize: 12, fontWeight: "normal", fontFamily: "Playfair Display Regular" },
  fab: { position: "absolute", bottom: 30, right: 20, zIndex: 1000 },
  fabContent: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#9BDF11", justifyContent: "center", alignItems: "center", borderWidth: 3, borderColor: "#FFF", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 12 },
  footerLoader: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 20, gap: 10 },
  footerLoaderText: { fontSize: 14, color: "#6A9AA9", fontFamily: "Playfair Display Regular" },
  scrollToTopButton: { position: "absolute", bottom: 110, right: 28, width: 40, height: 40, borderRadius: 20, backgroundColor: "#6A9AA9", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5, zIndex: 999 },
});