// app/select-recipe.tsx
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
import { userService } from "@/app/services/userService";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// --- Константы ---
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;
const RECIPES_PER_PAGE = 10;

// --- Интерфейс данных ---
interface Recipe {
  id: string;
  title: string;
  description: string;
  mealType: string;
  calories?: number;
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
}

// --- КОМПОНЕНТ АВАТАРА ---
interface AvatarProps {
  photoURL?: string | null;
  size?: number;
}

const Avatar: React.FC<AvatarProps> = ({ photoURL, size = 55 }) => {
  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: "#9BDF11",
        }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#E5F0F5",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#9BDF11",
      }}
    >
      <Feather name="user" size={size * 0.4} color="#6A9AA9" />
    </View>
  );
};

const formatMinutes = (minutes: number): string => {
  const absMinutes = Math.abs(minutes);
  const lastDigit = absMinutes % 10;
  const lastTwoDigits = absMinutes % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${absMinutes} минут`;
  if (lastDigit === 1) return `${absMinutes} минута`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${absMinutes} минуты`;
  return `${absMinutes} минут`;
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
  const normalizedMealType = mealType.trim().toLowerCase();

  switch (normalizedMealType) {
    case "breakfast":
    case "завтрак":
      return "sunny-outline";
    case "lunch":
    case "обед":
      return "restaurant-outline";
    case "dinner":
    case "ужин":
      return "moon-outline";
    case "snack":
    case "перекусы":
      return "cafe-outline";
    default:
      return "fast-food-outline";
  }
};

// --- Основной компонент ---
export default function SelectRecipeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [db, setDb] = useState<Firestore | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastVisible, setLastVisible] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const { user } = useAuthContext();
  const userId = user?.uid || null;
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);

  const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекусы"];
  const scrollViewRef = useRef<ScrollView>(null);

  const isInitialLoadDone = useRef(false);
  const isComponentMounted = useRef(true);

  // Получаем параметры для замены рецепта
  const isReplacement = params.isReplacement === "true";
  const mealIndex = params.mealIndex;
  const currentMealId = params.currentMealId;
  const currentMealCategory = params.currentMealCategory;
  const isCustomReplacement = params.isCustomReplacement === "true";

  // --- Инициализация Firebase ---
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfig =
          typeof __firebase_config !== "undefined"
            ? JSON.parse(__firebase_config as string)
            : {};

        const app = !getApps().length
          ? initializeApp(firebaseConfig)
          : getApps()[0];
        const dbInstance = getFirestore(app);
        setDb(dbInstance);
      } catch (error) {
        console.error("Ошибка инициализации Firebase:", error);
      }
    };

    initializeFirebase();

    return () => {
      isComponentMounted.current = false;
    };
  }, []);

  // --- Загрузка фото профиля ---
  useEffect(() => {
    if (!userId) return;

    const loadPhoto = async () => {
      try {
        const profileData = await userService.fetchUserProfile(userId);
        if (profileData?.photoURL) {
          setUserPhotoURL(profileData.photoURL);
          return;
        }

        const auth = getAuth();
        if (auth.currentUser?.photoURL) {
          setUserPhotoURL(auth.currentUser.photoURL);
        }
      } catch (error) {
        console.error("Ошибка загрузки фото профиля:", error);
      }
    };

    loadPhoto();
  }, [userId]);

  // --- Вспомогательные функции ---
  const getDifficultyColor = (difficulty: string | undefined) => {
    switch (difficulty?.trim()) {
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

  const getCategoryName = (mealType: string) => {
    const normalizedMealType = mealType.trim().toLowerCase();

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

  // --- Основная функция загрузки рецептов ---
  const loadRecipes = useCallback(
    async (loadMore = false) => {
      if (!db || !isComponentMounted.current) {
        return;
      }

      if (loadMore && loadingMore) {
        return;
      }
      if (!loadMore && loading && isInitialLoadDone.current) {
        return;
      }

      try {
        if (loadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setHasMore(true);
          if (!loadMore) {
            setLastVisible(null);
          }
        }

        let recipesQuery = query(
          collection(db, "recipes"),
          where("isPublic", "==", true),
          orderBy("createdAt", "desc"),
          limit(RECIPES_PER_PAGE)
        );

        if (loadMore && lastVisible) {
          recipesQuery = query(recipesQuery, startAfter(lastVisible));
        }

        const [recipesSnapshot, favoritesSnapshot] = await Promise.all([
          getDocs(recipesQuery),
          userId
            ? getDocs(
                query(
                  collection(db, "user_favorites"),
                  where("userId", "==", userId),
                  where("active", "==", true)
                )
              )
            : { docs: [] },
        ]);

        const newLastVisible =
          recipesSnapshot.docs[recipesSnapshot.docs.length - 1] || null;
        setLastVisible(newLastVisible);

        if (recipesSnapshot.docs.length < RECIPES_PER_PAGE) {
          setHasMore(false);
        } else {
          console.log("Еще есть данные для загрузки");
        }

        const userFavorites = favoritesSnapshot.docs.map(
          (doc) => doc.data().recipeId
        );

        const loadedRecipes: Recipe[] = recipesSnapshot.docs.map((doc) => {
          const data = doc.data();
          const recipeId = doc.id;

          return {
            id: recipeId,
            title: String(data.title || "Без названия"),
            description: String(data.description || ""),
            mealType: String(data.mealType || "other"),
            calories: Number(data.calories) || 0,
            cookingTime: Number(data.cookingTime) || 20,
            ingredientsText: String(data.ingredientsText || ""),
            isPublic: Boolean(data.isPublic || false),
            likedCount: Number(data.likedCount) || 0,
            saveCount: Number(data.saveCount) || 0,
            userId: String(data.userId || ""),
            imageUrl: String(data.image || data.imageUrl || ""),
            bookmarked: userFavorites.includes(recipeId),
            rating: Number(data.rating) || 0,
            difficultyLevel: String(data.difficultyLevel || "Легко"),
            createdAt: data.createdAt,
          };
        });

        if (loadMore) {
          setRecipes((prev) => [...prev, ...loadedRecipes]);
        } else {
          setRecipes(loadedRecipes);
          isInitialLoadDone.current = true;
        }

        if (!loadMore) {
          try {
            const countQuery = query(
              collection(db, "recipes"),
              where("isPublic", "==", true)
            );
            const countSnapshot = await getDocs(countQuery);
            setTotalCount(countSnapshot.size);
          } catch (countError) {
            console.error("Ошибка подсчета общего количества:", countError);
          }
        }
      } catch (error) {
        console.error("Ошибка загрузки рецептов:", error);
        if (!loadMore) {
          isInitialLoadDone.current = false;
        }
      } finally {
        if (loadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [db, userId, lastVisible, loading, loadingMore]
  );

  useEffect(() => {
    if (db && !isInitialLoadDone.current) {
      loadRecipes();
    }
  }, [db, loadRecipes]);

  const onRefresh = useCallback(async () => {
    if (!db || refreshing) return;

    setRefreshing(true);
    isInitialLoadDone.current = false;
    await loadRecipes();
    setRefreshing(false);
  }, [db, loadRecipes, refreshing]);

  const filteredRecipes = recipes.filter((recipe) => {
    const matchesSearch =
      recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      recipe.description.toLowerCase().includes(searchQuery.toLowerCase());

    const normalizedMealType = recipe.mealType.trim().toLowerCase();
    const matchesCategory =
      selectedCategory === "Все" ||
      getCategoryName(normalizedMealType) === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleScroll = useCallback(
    (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;
      const paddingToBottom = 100;

      const isCloseToBottom =
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom;

      if (
        isCloseToBottom &&
        !loadingMore &&
        hasMore &&
        db &&
        !loading &&
        !refreshing &&
        isInitialLoadDone.current
      ) {
        loadRecipes(true);
      }
    },
    [loadingMore, hasMore, db, loading, refreshing, loadRecipes]
  );

  const toggleBookmark = async (recipeId: string) => {
    if (!db || !userId || isUpdating) return;

    setIsUpdating(true);
    try {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return;

      const isCurrentlyBookmarked = recipe.bookmarked;

      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipeId ? { ...r, bookmarked: !isCurrentlyBookmarked } : r
        )
      );

      if (isCurrentlyBookmarked) {
        const favoriteQuery = query(
          collection(db, "user_favorites"),
          where("userId", "==", userId),
          where("recipeId", "==", recipeId)
        );
        const favoriteSnapshot = await getDocs(favoriteQuery);
        favoriteSnapshot.forEach(async (doc) => {
          await updateDoc(doc.ref, { active: false });
        });
      } else {
        await setDoc(
          doc(db, "user_favorites", `${userId}_${recipeId}`),
          {
            userId: userId,
            recipeId: recipeId,
            createdAt: new Date(),
            active: true,
          },
          { merge: true }
        );
      }
    } catch (error) {
      console.error("Ошибка обновления закладки:", error);
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipeId ? { ...r, bookmarked: !r.bookmarked } : r
        )
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const navigateToProfile = () => {
    if (userId) {
      router.back();
    }
  };

  const resetFiltersAndScroll = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const resetAllData = () => {
    isInitialLoadDone.current = false;
    setRecipes([]);
    setLastVisible(null);
    setHasMore(true);
    if (db) {
      loadRecipes();
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
            difficultyLevel: recipe.difficultyLevel || "Легко",
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
          isCustomReplacement: isCustomReplacement ? "true" : "false"
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
            difficultyLevel: recipe.difficultyLevel || "Легко",
            imageUrl: recipe.imageUrl,
            mealType: recipe.mealType,
            weight: "250г",
            rating: recipe.rating || 0
          })
        }
      });
    }
  };

  if (loading && !refreshing) {
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
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingText}>
            {isReplacement ? "Заменить рецепт" : "Выберите рецепт"}
          </Text>
          <Text style={styles.dietText}>
            {isReplacement 
              ? "Выберите новый рецепт для замены" 
              : "Добавьте в дневной рацион"}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Avatar photoURL={userPhotoURL} size={55} />
        </View>
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
              {filteredRecipes.length} из {totalCount} рецептов
            </Text>
            <TouchableOpacity style={styles.resetButton} onPress={resetAllData}>
              <Feather name="refresh-ccw" size={16} color="#6A9AA9" />
            </TouchableOpacity>
          </View>

          <View style={styles.recipesGrid}>
            {filteredRecipes.map((recipe) => (
              <View key={recipe.id} style={styles.recipeColumn}>
                <TouchableOpacity
                  style={styles.recipeCard}
                  onPress={() => handleSelectRecipe(recipe)}
                >
                  <View style={styles.imageContainer}>
                    {recipe.imageUrl && recipe.imageUrl.length > 5 ? (
                      <Image
                        source={{ uri: recipe.imageUrl }}
                        style={styles.recipeImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.recipeImagePlaceholder}>
                        <Ionicons
                          name={getCategoryIcon(recipe.mealType) as any}
                          size={32}
                          color="#6A9AA9"
                        />
                      </View>
                    )}
                    <View style={styles.recipeBadges}>
                      {recipe.rating && recipe.rating > 0 ? (
                        <View style={styles.ratingBadge}>
                          <FontAwesome name="star" size={10} color="#FFD700" />
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
                              recipe.difficultyLevel
                            ),
                          },
                        ]}
                      >
                        <Text style={styles.difficultyText}>
                          {recipe.difficultyLevel}
                        </Text>
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
                      <Ionicons
                        name={
                          recipe.bookmarked ? "bookmark" : "bookmark-outline"
                        }
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
                        {recipe.title}
                      </Text>
                      <Text style={styles.recipeCategory}>
                        {getCategoryName(recipe.mealType)}
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
                          {formatMinutes(recipe.cookingTime || 0)}
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
            ))}
          </View>

          <FooterLoader loading={loadingMore} />

          {filteredRecipes.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={64} color="#C2DAE2" />
              <Text style={styles.emptyStateText}>Рецепты не найдены</Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery || selectedCategory !== "Все"
                  ? "Попробуйте изменить параметры поиска"
                  : "Публичных рецептов пока нет"}
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
    position: "relative",
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 15,
  },
  greetingText: {
    fontSize: 24,
    color: "#1a1a1a",
    marginBottom: 4,
    fontFamily: "Playfair Display Bold",
  },
  dietText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Playfair Display Regular",
  },
  userInfo: {
    alignItems: "center",
    minWidth: 60,
  },
  userName: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginTop: 4,
    textAlign: "center",
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
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
  },
  footerLoaderText: {
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  recipeImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
  },
});