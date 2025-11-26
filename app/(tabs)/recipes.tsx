// app/recipes.tsx
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
    Image,
    ImageBackground,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator
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
  setDoc
} from "firebase/firestore";
import { getApps, initializeApp } from "firebase/app";
import ProfileMenu from "../components/ProfileMenu";
import { Feather, MaterialIcons, FontAwesome, Ionicons } from "@expo/vector-icons";
import { useAuthContext } from '@/app/contexts/AuthContext'; // Импортируем контекст

interface Recipe {
  id: string;
  title: string;
  description: string;
  mealType: string;
  calories?: number;
  cookingTime?: string;
  ingredientsText: string;
  isPublic: boolean;
  likedCount: number;
  saveCount: number;
  userId: string;
  image: any;
  bookmarked: boolean;
  rating?: number;
  difficulty?: string;
}

export default function Recipes() {
  const router = useRouter();
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [db, setDb] = useState<Firestore | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // ИСПРАВЛЕНИЕ: Используем AuthContext вместо локального состояния
  const { user } = useAuthContext();
  const isAuthenticated = !!user;
  const userId = user?.uid || null;
  const userName = user?.displayName || user?.email || "Пользователь";

  const categories = ["Все", "Завтраки", "Обед", "Ужин", "Перекусы"];

  // Инициализация Firebase (только база данных)
  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        const firebaseConfig = typeof __firebase_config !== "undefined"
          ? JSON.parse(__firebase_config as string)
          : {};

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
        const dbInstance = getFirestore(app);
        setDb(dbInstance);
      } catch (error) {
        console.error("Ошибка инициализации Firebase:", error);
      }
    };

    initializeFirebase();
  }, []);

  // Функция для получения цвета сложности
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

  // Функция для получения названия категории на русском
  const getCategoryName = (mealType: string) => {
    switch (mealType) {
      case 'breakfast':
        return 'Завтраки';
      case 'lunch':
        return 'Обед';
      case 'dinner':
        return 'Ужин';
      case 'snack':
        return 'Перекусы';
      default:
        return 'Другое';
    }
  };

  // Загрузка рецептов из Firestore
  useEffect(() => {
    if (!db) return;

    const loadRecipes = async () => {
      try {
        setLoading(true);
        console.log("Загрузка рецептов из Firestore...");

        // Загружаем все публичные рецепты
        const recipesQuery = query(
          collection(db, "recipes"),
          where("isPublic", "==", true)
        );

        const recipesSnapshot = await getDocs(recipesQuery);
        const loadedRecipes: Recipe[] = [];

        // Загружаем избранное пользователя
        let userFavorites: string[] = [];
        if (userId) {
          const favoritesQuery = query(
            collection(db, "user_favorites"),
            where("userId", "==", userId),
            where("active", "==", true)
          );
          const favoritesSnapshot = await getDocs(favoritesQuery);
          userFavorites = favoritesSnapshot.docs.map(doc => doc.data().recipeId);
        }

        for (const doc of recipesSnapshot.docs) {
          const data = doc.data();
          
          // Определяем изображение по типу блюда
          let imageSource;
          switch (data.mealType) {
            case 'breakfast':
              imageSource = require('@/assets/images/breakfast-oats.png');
              break;
            case 'lunch':
              imageSource = require('@/assets/images/lunch-soup.png');
              break;
            case 'dinner':
              imageSource = require('@/assets/images/dinner-rice.png');
              break;
            default:
              imageSource = require('@/assets/images/snack-fruits.png');
          }

          // Вычисляем калории
          const estimatedCalories = data.calories || 
            (data.mealType === 'breakfast' ? 350 :
             data.mealType === 'lunch' ? 450 :
             data.mealType === 'dinner' ? 550 : 120);

          // Вычисляем время приготовления
          const estimatedTime = data.cookingTime?.lait ? 
            `${data.cookingTime.lait} мин` : "20 мин";

          // Генерируем случайный рейтинг и сложность для демонстрации
          const randomRating = parseFloat((4 + Math.random()).toFixed(1));
          const difficulties = ["Легко", "Средне", "Сложно"];
          const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

          loadedRecipes.push({
            id: doc.id,
            title: data.title || "Без названия",
            description: data.description || "",
            mealType: data.mealType || "other",
            calories: estimatedCalories,
            cookingTime: estimatedTime,
            ingredientsText: data.ingredientsText || "",
            isPublic: data.isPublic || false,
            likedCount: data.likedCount || 0,
            saveCount: data.saveCount || 0,
            userId: data.userId || "",
            image: imageSource,
            bookmarked: userFavorites.includes(doc.id),
            rating: randomRating,
            difficulty: randomDifficulty
          });
        }

        console.log(`Загружено ${loadedRecipes.length} рецептов`);
        setRecipes(loadedRecipes);
      } catch (error) {
        console.error("Ошибка загрузки рецептов:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecipes();
  }, [db, userId]);

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Все" || 
      (selectedCategory === "Завтраки" && recipe.mealType === "breakfast") ||
      (selectedCategory === "Обед" && recipe.mealType === "lunch") ||
      (selectedCategory === "Ужин" && recipe.mealType === "dinner") ||
      (selectedCategory === "Перекусы" && (recipe.mealType === "snack" || !["breakfast", "lunch", "dinner"].includes(recipe.mealType)));
    
    return matchesSearch && matchesCategory;
  });

  const toggleBookmark = async (recipeId: string) => {
    if (!db || !userId || isUpdating) return;

    setIsUpdating(true);
    try {
      const recipe = recipes.find(r => r.id === recipeId);
      if (!recipe) return;

      const isCurrentlyBookmarked = recipe.bookmarked;
      
      // Обновляем локальное состояние
      setRecipes(prev => prev.map(r => 
        r.id === recipeId ? { ...r, bookmarked: !isCurrentlyBookmarked } : r
      ));

      // Обновляем в Firestore
      if (isCurrentlyBookmarked) {
        // Удаляем из избранного
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
        // Добавляем в избранное
        await setDoc(doc(db, "user_favorites", `${userId}_${recipeId}`), {
          userId: userId,
          recipeId: recipeId,
          createdAt: new Date(),
          active: true
        }, { merge: true });
      }

      console.log(`Рецепт ${recipeId} ${isCurrentlyBookmarked ? 'удален из' : 'добавлен в'} избранное`);
    } catch (error) {
      console.error("Ошибка обновления закладки:", error);
      // Откатываем локальное состояние в случае ошибки
      setRecipes(prev => prev.map(r => 
        r.id === recipeId ? { ...r, bookmarked: !r.bookmarked } : r
      ));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleProfileMenu = () => {
    setProfileMenuVisible(!profileMenuVisible);
  };

  const navigateToRecipe = (recipe: Recipe) => {
    console.log(`Переход к рецепту: ${recipe.title}`);
    router.push({
      pathname: "/meal",
      params: {
        mealName: recipe.title,
        category: recipe.mealType,
        initialBookmarked: recipe.bookmarked.toString(),
        recipeId: recipe.id
      }
    });
  };

  if (loading) {
    return (
      <ImageBackground 
        source={require('@/assets/images/background.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loadingText}>Загрузка рецептов...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground 
      source={require('@/assets/images/background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Верхнее меню с приветствием */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>Рецепты</Text>
            <Text style={styles.dietText}>
              {isAuthenticated 
                ? `Найдите идеальное блюдо для себя, ${userName}`
                : "Войдите для сохранения рецептов"}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={handleProfileMenu}
          >
            <Image 
              source={require('@/assets/images/people-icon.png')}
              style={styles.profileImage}
            />
            {/* ИСПРАВЛЕННАЯ ЛОГИКА ОТОБРАЖЕНИЯ ГОСТЯ */}
            {!isAuthenticated && (
              <View style={styles.guestBadge}>
                <Text style={styles.guestBadgeText}>Гость</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Компонент меню профиля с передачей состояния аутентификации */}
        <ProfileMenu
          visible={profileMenuVisible}
          onClose={() => setProfileMenuVisible(false)}
          userName={userName}
        />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
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
                    selectedCategory === category && styles.categoryButtonActive
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === category && styles.categoryTextActive
                  ]}>
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
                  <View style={styles.recipeCard}>
                    <View style={styles.imageContainer}>
                      <Image 
                        source={recipe.image}
                        style={styles.recipeImage}
                        resizeMode="cover"
                      />
                      {/* Бейджи рейтинга и сложности */}
                      <View style={styles.recipeBadges}>
                        <View style={styles.ratingBadge}>
                          <FontAwesome name="star" size={10} color="#FFD700" />
                          <Text style={styles.ratingText}>{recipe.rating}</Text>
                        </View>
                        <View style={[
                          styles.difficultyBadge,
                          { backgroundColor: getDifficultyColor(recipe.difficulty || "Легко") }
                        ]}>
                          <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                        </View>
                      </View>
                      {/* Кнопка закладки */}
                      <TouchableOpacity 
                        style={[
                          styles.bookmarkButton,
                          !isAuthenticated && styles.bookmarkButtonDisabled
                        ]}
                        onPress={() => toggleBookmark(recipe.id)}
                        disabled={isUpdating || !isAuthenticated}
                      >
                        <Ionicons 
                          name={recipe.bookmarked ? "bookmark" : "bookmark-outline"}
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
                          <MaterialIcons name="local-fire-department" size={12} color="#FF6B6B" />
                          <Text style={styles.recipeCalories}>{recipe.calories} ккал</Text>
                          <MaterialIcons name="access-time" size={12} color="#6A9AA9" style={styles.timeIcon} />
                          <Text style={styles.recipeTime}>{recipe.cookingTime}</Text>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={styles.viewButton}
                        onPress={() => navigateToRecipe(recipe)}
                      >
                        <Text style={styles.viewButtonText}>Посмотреть</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
    </ImageBackground>
  );
}

// Стили остаются без изменений...
const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6A9AA9',
    fontFamily: 'Playfair Display Regular',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#6C757D',
    fontFamily: 'Playfair Display Regular',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6C757D',
    fontFamily: 'Playfair Display Regular',
    textAlign: 'center',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  headerTextContainer: {
    flex: 1,
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
    marginRight: 20,
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: "hidden",
  },
  guestBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF6B6B",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  guestBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Playfair Display Bold",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
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
    backgroundColor: "#ffffffff",
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
    backgroundColor: "rgba(255, 255, 255, 0.95)",
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recipeColumn: {
    width: '48%',
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
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: 120,
  },
  recipeBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
    gap: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Playfair Display Regular',
    marginLeft: 2,
  },
  difficultyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Playfair Display Regular',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  bookmarkButtonDisabled: {
    opacity: 0.5,
  },
  recipeContent: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
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
    fontStyle: 'italic',
    marginBottom: 6,
  },
  recipeDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: 'wrap',
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
});