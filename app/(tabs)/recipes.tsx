// app/recipes.tsx
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
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
} from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import {
  Feather,
  MaterialIcons,
  FontAwesome,
  Ionicons,
} from "@expo/vector-icons";
import { useAuthContext } from "@/app/contexts/AuthContext";

// --- Утилиты ---
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2; // (Ширина экрана - 30*2 padding - 8 gap)/2

// --- Интерфейс данных (оставлен без изменений) ---
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
}

// --- Функция для правильного склонения слова "минута" (НОВАЯ) ---
const formatMinutes = (minutes: number): string => {
  const absMinutes = Math.abs(minutes);
  const lastDigit = absMinutes % 10;
  const lastTwoDigits = absMinutes % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${absMinutes} минут`;
  if (lastDigit === 1) return `${absMinutes} минута`;
  if (lastDigit >= 2 && lastDigit <= 4) return `${absMinutes} минуты`;
  return `${absMinutes} минут`;
};

// --- Основной компонент ---
export default function Recipes() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [db, setDb] = useState<Firestore | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const { user } = useAuthContext();
  const userId = user?.uid || null;
  const userName = user?.displayName || user?.email || "Пользователь";

  const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекусы"];

  // --- 1. Инициализация Firebase ---
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
  }, []);

  // --- 2. Вспомогательные функции ---
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

  // --- 3. Логика загрузки рецептов ---
  useEffect(() => {
    if (!db) return;

    const loadRecipes = async () => {
      try {
        setLoading(true);

        const recipesQuery = query(
          collection(db, "recipes"),
          where("isPublic", "==", true)
        );

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

        const userFavorites = favoritesSnapshot.docs.map(
          (doc) => doc.data().recipeId
        );

        const loadedRecipes: Recipe[] = recipesSnapshot.docs.map((doc) => {
          const data = doc.data();
          const recipeId = doc.id;
          const rawImageUrl = data.image || data.imageUrl || null;

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
            imageUrl: String(rawImageUrl || ""),
            bookmarked: userFavorites.includes(recipeId),
            rating: Number(data.rating) || 0,
            difficultyLevel: String(data.difficultyLevel || "Легко"),
          };
        });

        setRecipes(loadedRecipes);
      } catch (error) {
        console.error("Ошибка загрузки рецептов:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecipes();
  }, [db, userId]);

  // --- 4. Логика фильтрации ---
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

  // --- 5. Логика переключения закладки (оставлена для удобства) ---
  const toggleBookmark = async (recipeId: string) => {
    if (!db || !userId || isUpdating) return;

    setIsUpdating(true);
    try {
      const recipe = recipes.find((r) => r.id === recipeId);
      if (!recipe) return;

      const isCurrentlyBookmarked = recipe.bookmarked;

      // Оптимистическое обновление UI
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipeId ? { ...r, bookmarked: !isCurrentlyBookmarked } : r
        )
      );

      // Обновление Firestore
      if (isCurrentlyBookmarked) {
        // Удаление закладки (установка active: false)
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
        // Добавление закладки
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
      // Откат UI в случае ошибки
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === recipeId ? { ...r, bookmarked: !r.bookmarked } : r
        )
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // --- 6. КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Упрощенная навигация ---
  const navigateToRecipe = (recipe: Recipe) => {
    router.push({
      pathname: "/meal",
      params: {
        mealId: recipe.id,   
        mealName: recipe.title, 
        mealType: recipe.mealType, 

        initialBookmarked: 'false',
      },
    });
  };
  // ---------------------------------------------------

  if (loading) {
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

      {/* Верхнее меню */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.greetingText}>Рецепты</Text>
          <Text style={styles.dietText}>Найдите идеальное блюдо для себя</Text>
        </View>

        <View style={styles.userInfo}>
          <Image
            source={require("@/assets/images/people-icon.png")}
            style={styles.profileImage}
          />
          <Text style={styles.userName} numberOfLines={1}>
            {userName}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Поиск и фильтры */}
        <View style={styles.searchSection}>
          {/* Категории */}
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

          {/* Поле поиска */}
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

        {/* Рецепты */}
        <View style={styles.recipesSection}>
          <Text style={styles.recipesTitle}>
            {filteredRecipes.length} рецептов найдено
          </Text>

          {/* Сетка рецептов 2x2 */}
          <View style={styles.recipesGrid}>
            {filteredRecipes.map((recipe) => (
              <View key={recipe.id} style={styles.recipeColumn}>
                <TouchableOpacity
                  style={styles.recipeCard}
                  onPress={() => navigateToRecipe(recipe)}
                >
                  <View style={styles.imageContainer}>
                    {/* --- Отображение сетевого изображения --- */}
                    <Image
                      source={
                        recipe.imageUrl && recipe.imageUrl.length > 5
                          ? { uri: recipe.imageUrl }
                          : require("@/assets/images/default-recipe.png")
                      }
                      style={styles.recipeImage}
                      resizeMode="cover"
                    />
                    {/* Бейджи рейтинга и сложности */}
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
                    {/* Кнопка закладки */}
                    <TouchableOpacity
                      style={styles.bookmarkButton}
                      onPress={() => toggleBookmark(recipe.id)}
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
                      {/* Категория */}
                      <Text style={styles.recipeCategory}>
                        {getCategoryName(recipe.mealType)}
                      </Text>
                      <View style={styles.recipeDetails}>
                        {/* Калории */}
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
                      style={styles.viewButton}
                      onPress={() => navigateToRecipe(recipe)}
                    >
                      <Text style={styles.viewButtonText}>Посмотреть</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {filteredRecipes.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Рецепты не найдены</Text>
              <Text style={styles.emptyStateSubtext}>
                Попробуйте изменить параметры поиска
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
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
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
  profileImage: {
    width: 55,
    height: 55,
    borderRadius: 25,
  },
  userName: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginTop: 4,
    textAlign: "center",
  },
  scrollView: {
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
});
