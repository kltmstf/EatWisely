// app/select-recipe.tsx - С УЛУЧШЕННОЙ ФИЛЬТРАЦИЕЙ

import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Dimensions,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  Firestore,
  doc,
  updateDoc,
  setDoc,
  limit,
  startAfter,
  orderBy,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import {
  Feather,
  MaterialIcons,
  FontAwesome,
  Ionicons,
} from "@expo/vector-icons";
import { useAuthContext } from "@/app/contexts/AuthContext";

declare const __firebase_config: string | undefined;

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;
const RECIPES_PER_PAGE = 10;

interface Recipe {
  id: string;
  title: string;
  description: string;
  mealType: string;
  calories?: number;
  proteins?: number;
  fats?: number;
  carbohydrates?: number;
  cookingTime?: number;
  ingredientsText: string;
  isPublic: boolean;
  likedCount: number;
  saveCount: number;
  userId: string;
  imageUrl?: string;
  bookmarked: boolean;
  rating?: number;
  difficultyLevel?: string;
  difficulty?: string;
  createdAt?: any;
  totalWeight?: number;
}

const formatMinutes = (minutes: number): string => {
  const absMinutes = Math.abs(minutes);
  const lastDigit = absMinutes % 10;
  const lastTwoDigits = absMinutes % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${absMinutes} мин`;
  if (lastDigit === 1) return `${absMinutes} мин`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${absMinutes} мин`;
  return `${absMinutes} мин`;
};

const FooterLoader: React.FC<{ loading: boolean }> = ({ loading }) => {
  if (!loading) return null;
  return (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color="#6A9AA9" />
      <Text style={styles.footerLoaderText}>Загрузка...</Text>
    </View>
  );
};

const getCategoryIcon = (mealType: string) => {
  const normalizedMealType = mealType?.trim().toLowerCase() || "";
  switch (normalizedMealType) {
    case "breakfast": case "завтрак": return "sunny-outline";
    case "lunch": case "обед": return "restaurant-outline";
    case "dinner": case "ужин": return "moon-outline";
    case "snack": case "перекус": case "перекусы": return "cafe-outline";
    default: return "fast-food-outline";
  }
};

const getCategoryName = (mealType: string) => {
  const normalizedMealType = mealType?.trim().toLowerCase() || "";
  switch (normalizedMealType) {
    case "breakfast": case "завтрак": return "Завтрак";
    case "lunch": case "обед": return "Обед";
    case "dinner": case "ужин": return "Ужин";
    case "snack": case "перекус": case "перекусы": return "Перекус";
    default: return "Другое";
  }
};

const getDifficultyColor = (difficulty: string | undefined) => {
  switch (difficulty?.trim()) {
    case "Легко": return "#4CAF50";
    case "Средне": return "#FF9800";
    case "Сложно": return "#F44336";
    default: return "#6A9AA9";
  }
};

export default function SelectRecipeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [db, setDb] = useState<Firestore | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [displayedRecipes, setDisplayedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [pendingRecipeForWeight, setPendingRecipeForWeight] = useState<any>(null);
  const [selectedWeight, setSelectedWeight] = useState("250");

  const { user } = useAuthContext();
  const userId = user?.uid || null;

  const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекус"];
  const scrollViewRef = useRef<ScrollView>(null);
  const isInitialLoadDone = useRef(false);
  const isComponentMounted = useRef(true);
  const currentPageRef = useRef<number>(0);
  const filteredRecipesRef = useRef<Recipe[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const isReplacement = params.isReplacement === "true";
  const mealIndex = params.mealIndex;
  const currentMealId = params.currentMealId;
  const currentMealCategory = params.currentMealCategory;
  const isCustomReplacement = params.isCustomReplacement === "true";

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfig = typeof __firebase_config !== "undefined" ? JSON.parse(__firebase_config as string) : {};
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
        const dbInstance = getFirestore(app);
        setDb(dbInstance);
      } catch (error) {
        console.error("Ошибка инициализации Firebase:", error);
      }
    };
    initializeFirebase();
    return () => { isComponentMounted.current = false; };
  }, []);

  // Функция фильтрации рецептов
  const filterRecipes = useCallback((recipesToFilter: Recipe[]) => {
    let filtered = recipesToFilter;
    
    // Фильтр по категории
    if (selectedCategory !== "Все") {
      filtered = filtered.filter(recipe => 
        getCategoryName(recipe.mealType) === selectedCategory
      );
    }
    
    // Фильтр по поисковому запросу
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(recipe =>
        recipe.title.toLowerCase().includes(queryLower) ||
        recipe.description.toLowerCase().includes(queryLower)
      );
    }
    
    return filtered;
  }, [selectedCategory, searchQuery]);

  // Функция обновления отображаемых рецептов с пагинацией
  const updateDisplayedRecipes = useCallback((filtered: Recipe[], loadMore: boolean = false) => {
    if (loadMore) {
      const startIndex = (currentPageRef.current + 1) * RECIPES_PER_PAGE;
      const endIndex = Math.min(startIndex + RECIPES_PER_PAGE, filtered.length);
      const newRecipes = filtered.slice(startIndex, endIndex);
      
      if (newRecipes.length > 0) {
        setDisplayedRecipes(prev => [...prev, ...newRecipes]);
        currentPageRef.current++;
      }
      
      if (endIndex >= filtered.length) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } else {
      const paginated = filtered.slice(0, RECIPES_PER_PAGE);
      setDisplayedRecipes(paginated);
      currentPageRef.current = 0;
      setHasMore(paginated.length < filtered.length);
    }
    
    setTotalCount(filtered.length);
    filteredRecipesRef.current = filtered;
  }, []);

  // Загрузка всех рецептов из Firebase
  const loadAllRecipes = useCallback(async () => {
    if (!db || !isComponentMounted.current) return;

    try {
      setLoading(true);
      
      const recipesQuery = query(
        collection(db, "recipes"),
        where("isPublic", "==", true),
        orderBy("createdAt", "desc")
      );

      const recipesSnapshot = await getDocs(recipesQuery);
      
      let userFavorites: string[] = [];
      if (userId) {
        try {
          const favoritesSnapshot = await getDocs(
            query(collection(db, "user_favorites"), where("userId", "==", userId), where("active", "==", true))
          );
          userFavorites = favoritesSnapshot.docs.map(doc => doc.data().recipeId);
        } catch (error) {
          console.error("Ошибка загрузки избранного:", error);
          userFavorites = [];
        }
      }

      const loadedRecipes: Recipe[] = recipesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: String(data.title || "Без названия"),
          description: String(data.description || ""),
          mealType: String(data.mealType || data.categories?.[0] || "other"),
          calories: Number(data.calories || data.nutritionPer100g?.calories || 0),
          proteins: Number(data.proteins || data.nutritionPer100g?.protein || 0),
          fats: Number(data.fats || data.nutritionPer100g?.fat || 0),
          carbohydrates: Number(data.carbohydrates || data.nutritionPer100g?.carbs || 0),
          cookingTime: Number(data.cookingTime || 20),
          ingredientsText: String(data.ingredientsText || ""),
          isPublic: Boolean(data.isPublic || false),
          likedCount: Number(data.likedCount || 0),
          saveCount: Number(data.saveCount || 0),
          userId: String(data.userId || ""),
          imageUrl: data.image || data.imageUrl || "",
          bookmarked: userFavorites.includes(doc.id),
          rating: Number(data.averageRating || 0),
          difficultyLevel: String(data.difficultyLevel || data.difficulty || "Легко"),
          createdAt: data.createdAt,
          totalWeight: Number(data.totalWeight || 250),
        };
      });

      setAllRecipes(loadedRecipes);
      const filtered = filterRecipes(loadedRecipes);
      updateDisplayedRecipes(filtered, false);
      isInitialLoadDone.current = true;
    } catch (error) { 
      console.error("Ошибка загрузки:", error); 
    } finally { 
      setLoading(false); 
    }
  }, [db, userId, filterRecipes, updateDisplayedRecipes]);

  // Debounced загрузка при изменении фильтров
  useEffect(() => {
    if (!isInitialLoadDone.current || loading) return;
    
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const filtered = filterRecipes(allRecipes);
      updateDisplayedRecipes(filtered, false);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 300);
    
    return () => { 
      if (timerRef.current) clearTimeout(timerRef.current); 
    };
  }, [searchQuery, selectedCategory, allRecipes, filterRecipes, updateDisplayedRecipes, loading]);

  useEffect(() => { 
    if (db && !isInitialLoadDone.current) {
      loadAllRecipes(); 
    }
  }, [db, loadAllRecipes]);

  const onRefresh = useCallback(async () => {
    if (!db || refreshing) return;
    setRefreshing(true);
    isInitialLoadDone.current = false;
    await loadAllRecipes();
    setRefreshing(false);
  }, [db, loadAllRecipes, refreshing]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    
    if (isCloseToBottom && !loadingMore && hasMore && !loading && !refreshing && isInitialLoadDone.current) {
      setLoadingMore(true);
      const filtered = filterRecipes(allRecipes);
      updateDisplayedRecipes(filtered, true);
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, refreshing, filterRecipes, updateDisplayedRecipes, allRecipes]);

  const toggleBookmark = async (recipeId: string) => {
    if (!db || !userId || isUpdating) return;
    setIsUpdating(true);
    try {
      const recipe = allRecipes.find(r => r.id === recipeId);
      if (!recipe) return;
      const isCurrentlyBookmarked = recipe.bookmarked;
      
      // Обновляем состояние в allRecipes и displayedRecipes
      setAllRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, bookmarked: !isCurrentlyBookmarked } : r));
      setDisplayedRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, bookmarked: !isCurrentlyBookmarked } : r));
      
      if (isCurrentlyBookmarked) {
        const favoriteQuery = query(collection(db, "user_favorites"), where("userId", "==", userId), where("recipeId", "==", recipeId));
        const favoriteSnapshot = await getDocs(favoriteQuery);
        favoriteSnapshot.forEach(async (doc) => { await updateDoc(doc.ref, { active: false }); });
      } else {
        await setDoc(doc(db, "user_favorites", `${userId}_${recipeId}`), { userId, recipeId, createdAt: new Date(), active: true }, { merge: true });
      }
    } catch (error) { 
      console.error("Ошибка закладки:", error); 
      setAllRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, bookmarked: !r.bookmarked } : r));
      setDisplayedRecipes(prev => prev.map(r => r.id === recipeId ? { ...r, bookmarked: !r.bookmarked } : r));
    } finally { 
      setIsUpdating(false); 
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
    const filtered = filterRecipes(allRecipes);
    updateDisplayedRecipes(filtered, false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleRecipePress = (recipe: Recipe) => {
    router.push({
      pathname: "/meal",
      params: {
        mealId: recipe.id,
        recipeId: recipe.id,
        mealName: recipe.title,
        category: getCategoryName(recipe.mealType),
        mealType: recipe.mealType,
        calories: (recipe.calories || 0).toString(),
        proteins: (recipe.proteins || 0).toString(),
        fats: (recipe.fats || 0).toString(),
        carbohydrates: (recipe.carbohydrates || 0).toString(),
        cookingTime: (recipe.cookingTime || 20).toString(),
        difficultyLevel: recipe.difficultyLevel || "Легко",
        rating: (recipe.rating || 0).toString(),
        imageUrl: recipe.imageUrl || "",
        isCustom: "false",
        fromScreen: "select-recipe"
      }
    });
  };

  const openWeightModal = (recipe: Recipe) => {
    const recipeData = {
      id: recipe.id,
      title: recipe.title,
      calories: recipe.calories || 300,
      proteins: recipe.proteins || 20,
      fats: recipe.fats || 10,
      carbohydrates: recipe.carbohydrates || 30,
      cookingTime: recipe.cookingTime || 20,
      difficultyLevel: recipe.difficultyLevel || "Легко",
      imageUrl: recipe.imageUrl,
      mealType: recipe.mealType,
      category: getCategoryName(recipe.mealType),
      rating: recipe.rating || 0,
      isCustom: false,
      caloriesPer100g: recipe.calories || 300,
      totalWeight: recipe.totalWeight || 250
    };
    setPendingRecipeForWeight(recipeData);
    setSelectedWeight((recipe.totalWeight || 250).toString());
    setShowWeightModal(true);
  };

  const confirmWithWeight = () => {
    if (!pendingRecipeForWeight) return;
    const weightNum = parseInt(selectedWeight);
    if (isNaN(weightNum) || weightNum < 50 || weightNum > 1000) {
      Alert.alert("Ошибка", "Введите вес от 50 до 1000 грамм");
      return;
    }
    const caloriesPer100g = pendingRecipeForWeight.caloriesPer100g || pendingRecipeForWeight.calories || 0;
    const proteinsPer100g = pendingRecipeForWeight.proteins || 0;
    const fatsPer100g = pendingRecipeForWeight.fats || 0;
    const carbsPer100g = pendingRecipeForWeight.carbohydrates || 0;
    const calculatedCalories = Math.round((caloriesPer100g * weightNum) / 100);
    const calculatedProteins = Math.round((proteinsPer100g * weightNum) / 100);
    const calculatedFats = Math.round((fatsPer100g * weightNum) / 100);
    const calculatedCarbs = Math.round((carbsPer100g * weightNum) / 100);
    const recipeWithWeight = {
      ...pendingRecipeForWeight,
      calories: calculatedCalories,
      proteins: calculatedProteins,
      fats: calculatedFats,
      carbohydrates: calculatedCarbs,
      weight: `${weightNum}г`,
      totalWeight: weightNum
    };
    setShowWeightModal(false);
    if (isReplacement) {
      router.push({
        pathname: "/home",
        params: {
          replaceMeal: JSON.stringify({
            index: parseInt(mealIndex as string),
            meal: {
              id: currentMealId || `meal-${Date.now()}`,
              category: recipeWithWeight.category,
              name: recipeWithWeight.title,
              calories: recipeWithWeight.calories,
              proteins: recipeWithWeight.proteins,
              fats: recipeWithWeight.fats,
              carbohydrates: recipeWithWeight.carbohydrates,
              weight: recipeWithWeight.weight,
              marked: false,
              bookmarked: false,
              cookingTime: recipeWithWeight.cookingTime,
              difficultyLevel: recipeWithWeight.difficultyLevel,
              rating: recipeWithWeight.rating,
              recipeId: recipeWithWeight.id,
              isCustom: false,
              canBeRemoved: true,
              imageUrl: recipeWithWeight.imageUrl,
              addedAt: new Date().toISOString()
            }
          }),
          refreshHome: Date.now().toString()
        }
      });
    } else {
      router.push({
        pathname: "/home",
        params: {
          selectedRecipe: JSON.stringify(recipeWithWeight),
          refreshHome: Date.now().toString()
        }
      });
    }
  };

  if (loading && !refreshing && displayedRecipes.length === 0) {
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingText}>{isReplacement ? "Заменить рецепт" : "Выберите рецепт"}</Text>
          <Text style={styles.dietText}>
            {isReplacement ? "Выберите новый рецепт для замены" : "Нажмите на рецепт для просмотра или на кнопку для добавления"}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6A9AA9"]} tintColor="#6A9AA9" />}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.searchSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>{category}</Text>
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
              {totalCount > 0 ? `${displayedRecipes.length} из ${totalCount}` : `${displayedRecipes.length} рецептов`}
            </Text>
            <TouchableOpacity onPress={resetFilters}>
              <Feather name="refresh-ccw" size={16} color="#6A9AA9" />
            </TouchableOpacity>
          </View>

          <View style={styles.recipesGrid}>
            {displayedRecipes.map((recipe) => {
              const safeTitle = String(recipe.title || "Без названия");
              const safeCategory = String(getCategoryName(recipe.mealType) || "Другое");
              const safeCalories = (recipe.calories && recipe.calories > 0) ? `${recipe.calories} ккал/100г` : null;
              const safeTime = String(formatMinutes(recipe.cookingTime || 0));
              const safeDifficulty = String(recipe.difficultyLevel || "Легко");
              const safeRating = (recipe.rating && recipe.rating > 0) ? recipe.rating.toFixed(1) : null;
              const safeId = String(recipe.id);
              
              return (
                <View key={safeId} style={styles.recipeColumn}>
                  <TouchableOpacity 
                    style={styles.recipeCard} 
                    onPress={() => handleRecipePress(recipe)} 
                    activeOpacity={0.7}
                  >
                    <View style={styles.imageContainer}>
                      {recipe.imageUrl && recipe.imageUrl.length > 5 ? (
                        <Image source={{ uri: recipe.imageUrl }} style={styles.recipeImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.recipeImagePlaceholder}>
                          <Ionicons name={getCategoryIcon(recipe.mealType) as any} size={32} color="#6A9AA9" />
                        </View>
                      )}
                      <View style={styles.recipeBadges}>
                        {safeRating !== null && (
                          <View style={styles.ratingBadge}>
                            <FontAwesome name="star" size={10} color="#FFD700" />
                            <Text style={styles.ratingText}>{safeRating}</Text>
                          </View>
                        )}
                        <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(recipe.difficultyLevel) }]}>
                          <Text style={styles.difficultyText}>{safeDifficulty}</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={styles.bookmarkButton} 
                        onPress={(e) => { 
                          e.stopPropagation(); 
                          toggleBookmark(recipe.id); 
                        }} 
                        disabled={isUpdating}
                      >
                        <Ionicons name={recipe.bookmarked ? "bookmark" : "bookmark-outline"} size={18} color="#6A9AA9" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.recipeContent}>
                      <View style={styles.recipeInfo}>
                        <Text style={styles.recipeName} numberOfLines={2}>{safeTitle}</Text>
                        <Text style={styles.recipeCategory}>{safeCategory}</Text>
                        <View style={styles.recipeDetails}>
                          {safeCalories !== null && (
                            <Text style={styles.recipeCalories}>{safeCalories}</Text>
                          )}
                          <MaterialIcons name="access-time" size={12} color="#6A9AA9" style={styles.timeIcon} />
                          <Text style={styles.recipeTime}>{safeTime}</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={styles.selectButton} 
                        onPress={(e) => { 
                          e.stopPropagation(); 
                          openWeightModal(recipe); 
                        }}
                      >
                        <Text style={styles.selectButtonText}>{isReplacement ? "Заменить" : "Добавить"}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <FooterLoader loading={loadingMore} />
          
          {displayedRecipes.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={64} color="#C2DAE2" />
              <Text style={styles.emptyStateText}>Рецепты не найдены</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery !== "" || selectedCategory !== "Все" ? "Попробуйте изменить параметры поиска" : "Публичных рецептов пока нет"}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showWeightModal} transparent animationType="fade" onRequestClose={() => setShowWeightModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.weightModalContainer}>
            <View style={styles.weightModalHeader}>
              <Text style={styles.weightModalTitle}>Выберите вес порции</Text>
              <TouchableOpacity onPress={() => setShowWeightModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.weightModalContent}>
              <Text style={styles.weightModalText}>{pendingRecipeForWeight?.title || ""}</Text>
              <Text style={styles.weightModalSubtext}>Калорийность: {pendingRecipeForWeight?.caloriesPer100g || 0} ккал на 100г</Text>
              <View style={styles.weightInputContainer}>
                <TextInput 
                  style={styles.weightInput} 
                  value={selectedWeight} 
                  onChangeText={setSelectedWeight} 
                  keyboardType="numeric" 
                  placeholder="Вес в граммах" 
                  placeholderTextColor="#999" 
                />
                <Text style={styles.weightUnit}>гр</Text>
              </View>
              <Text style={styles.weightHint}>КБЖУ будут автоматически пересчитаны под выбранный вес</Text>
              <View style={styles.weightModalButtons}>
                <TouchableOpacity 
                  style={[styles.weightModalButton, styles.weightModalButtonCancel]} 
                  onPress={() => setShowWeightModal(false)}
                >
                  <Text style={styles.weightModalButtonCancelText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.weightModalButton, styles.weightModalButtonSave]} 
                  onPress={confirmWithWeight}
                >
                  <Text style={styles.weightModalButtonSaveText}>Добавить</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Regular" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  emptyState: { alignItems: "center", padding: 40, marginTop: 40 },
  emptyStateText: { fontSize: 18, color: "#6C757D", fontFamily: "Playfair Display Regular", marginBottom: 8, marginTop: 16 },
  emptyStateSubtext: { fontSize: 14, color: "#6C757D", fontFamily: "Playfair Display Regular", textAlign: "center", marginBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: "#FFFFFF", borderBottomWidth: 2, borderBottomColor: "#6A9AA9" },
  backButton: { padding: 8, marginRight: 10 },
  headerTextContainer: { flex: 1, marginRight: 15 },
  greetingText: { fontSize: 24, color: "#1a1a1a", marginBottom: 4, fontFamily: "Playfair Display Bold" },
  dietText: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular" },
  searchSection: { backgroundColor: "#FFFFFF", padding: 15, marginBottom: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInputContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 30, borderWidth: 2, borderColor: "#6A9AA9", paddingHorizontal: 15, paddingVertical: 6 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#000", paddingVertical: 4, fontFamily: "Playfair Display Regular" },
  clearFilterButton: { padding: 4, marginLeft: 8 },
  categoriesContainer: { marginBottom: 12 },
  categoryButton: { backgroundColor: "white", borderWidth: 2, borderColor: "#6A9AA9", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  categoryButtonActive: { backgroundColor: "#9BDF11", borderColor: "#9BDF11" },
  categoryText: { fontSize: 14, color: "#000000", fontFamily: "Playfair Display Regular", fontWeight: "600" },
  categoryTextActive: { color: "#000000" },
  sectionDivider: { height: 2, backgroundColor: "#6A9AA9", marginHorizontal: -15, marginTop: 12 },
  recipesSection: { backgroundColor: "#FFFFFF", padding: 15, paddingBottom: 20 },
  recipesHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  recipesTitle: { fontSize: 16, color: "#000000ff", fontWeight: "500", fontFamily: "Playfair Display Regular" },
  resetButton: { padding: 8 },
  recipesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  recipeColumn: { width: CARD_WIDTH, marginBottom: 16 },
  recipeCard: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5, minHeight: 280 },
  imageContainer: { position: "relative", height: 120, backgroundColor: "#F8F8F8", justifyContent: "center", alignItems: "center" },
  recipeImage: { width: "100%", height: "100%" },
  recipeBadges: { position: "absolute", top: 8, left: 8, flexDirection: "column", gap: 4 },
  ratingBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  ratingText: { fontSize: 10, fontWeight: "bold", color: "#000000", fontFamily: "Playfair Display Regular", marginLeft: 2 },
  difficultyBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  difficultyText: { fontSize: 9, fontWeight: "bold", color: "#FFFFFF", fontFamily: "Playfair Display Regular" },
  bookmarkButton: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 },
  recipeContent: { padding: 12, flex: 1, justifyContent: "space-between" },
  recipeInfo: { flex: 1, marginBottom: 8 },
  recipeName: { fontSize: 14, fontWeight: "600", color: "#212529", marginBottom: 4, fontFamily: "Playfair Display Regular", lineHeight: 18, minHeight: 36 },
  recipeCategory: { fontSize: 11, color: "#6A9AA9", fontFamily: "Playfair Display Regular", fontStyle: "italic", marginBottom: 6 },
  recipeDetails: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  recipeCalories: { fontSize: 12, color: "#000000", fontWeight: "normal", fontFamily: "Playfair Display Bold", marginRight: 8 },
  timeIcon: { marginRight: 4 },
  recipeTime: { fontSize: 12, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  selectButton: { backgroundColor: "#9BDF11", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: "center", justifyContent: "center", minHeight: 36, marginTop: 8 },
  selectButtonText: { color: "#000000ff", fontSize: 12, fontWeight: "normal", fontFamily: "Playfair Display Regular" },
  footerLoader: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 20, gap: 10 },
  footerLoaderText: { fontSize: 14, color: "#6A9AA9", fontFamily: "Playfair Display Regular" },
  recipeImagePlaceholder: { width: "100%", height: "100%", backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  weightModalContainer: { backgroundColor: "#FFF", borderRadius: 20, width: "85%", overflow: "hidden" },
  weightModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  weightModalTitle: { fontSize: 16, fontFamily: "Playfair Display Bold", color: "#1a1a1a" },
  weightModalContent: { padding: 20 },
  weightModalText: { fontSize: 16, fontFamily: "Playfair Display Bold", color: "#1a1a1a", marginBottom: 8 },
  weightModalSubtext: { fontSize: 13, color: "#666", fontFamily: "Playfair Display Regular", marginBottom: 16 },
  weightInputContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#C2DAE2", borderRadius: 12, backgroundColor: "#F5F5F5", marginBottom: 12 },
  weightInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: "Playfair Display Regular", color: "#333" },
  weightUnit: { paddingHorizontal: 12, fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Bold" },
  weightHint: { fontSize: 12, color: "#999", fontFamily: "Playfair Display Regular", marginBottom: 20, textAlign: "center" },
  weightModalButtons: { flexDirection: "row", gap: 12 },
  weightModalButton: { flex: 1, paddingVertical: 12, borderRadius: 25, alignItems: "center" },
  weightModalButtonCancel: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#6A9AA9" },
  weightModalButtonCancelText: { color: "#6A9AA9", fontSize: 14, fontFamily: "Playfair Display Bold" },
  weightModalButtonSave: { backgroundColor: "#6A9AA9" },
  weightModalButtonSaveText: { color: "#FFF", fontSize: 14, fontFamily: "Playfair Display Bold" },
});