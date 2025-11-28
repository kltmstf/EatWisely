import { useRouter, useFocusEffect } from "expo-router";
import React, { useState, useEffect, useCallback } from "react";
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
  Alert,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";

// Предполагаемые импорты (должны быть доступны в среде Expo)
import { favoriteService } from "@/app/services/favoriteService";
import { useFavorites } from "@/app/hooks/useFavorites";

// Типы данных
type RecipeDetail = {
  id: string;
  name: string;
  category: string;
  calories: number;
  cookingTime: string;
  image: any; // Используем 'any' для совместимости с require/uri
  rating: number;
  difficulty: string;
};

type PlanDetail = {
  id: string;
  name: string;
  description: string;
  totalCalories: number;
  duration: string;
  mealsCount: number;
  image: any;
  savedDate: string;
};

type FavoriteItem = {
  id: string;
  userId: string;
  favoriteType: "recipe" | "ration";
  recipeId?: string;
  rationPlanId?: string;
  createdAt: string;
  item?: {
    id: string;
    name?: string;
    category?: string;
    calories?: number;
    cookingTime?: string;
    image?: string;
    rating?: number;
    difficulty?: string;
    description?: string;
    totalCalories?: number;
    duration?: string;
    mealsCount?: number;
  };
};

export default function SavedScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [activeTab, setActiveTab] = useState<"recipes" | "plans">("recipes");
  const [recipesData, setRecipesData] = useState<RecipeDetail[]>([]);
  const [plansData, setPlansData] = useState<PlanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Предполагаем, что useFavorites корректно работает с favoriteService
  const { toggleFavorite } = useFavorites();

  const categories = [
    "Все",
    "Завтраки",
    "Обед",
    "Ужин",
    "Перекусы",
    "Супы",
    "Салаты",
    "Десерты",
  ];

  // Функция для загрузки данных из БД, обернутая в useCallback
  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Теперь service.getUserFavorites() возвращает ТОЛЬКО избранное текущего пользователя
      const allFavorites = (await favoriteService.getUserFavorites()) as
        | FavoriteItem[]
        | null;

      if (!allFavorites) {
        // Если пользователь не авторизован или произошла ошибка в сервисе, allFavorites может быть null
        setRecipesData([]);
        setPlansData([]);
        return;
      }

      // Используем Map для устранения дубликатов по настоящему item ID и гарантируем наличие item
      const uniqueRecipes = new Map<string, RecipeDetail>();
      const uniquePlans = new Map<string, PlanDetail>();

      allFavorites.forEach((fav) => {
        // Пропускаем элементы, для которых не удалось получить данные (item === undefined)
        if (!fav.item) return;

        let itemId = fav.item.id; // Используем item.id, который был обогащен в сервисе

        if (fav.favoriteType === "recipe") {
          if (itemId && !uniqueRecipes.has(itemId)) {
            uniqueRecipes.set(itemId, {
              id: itemId,
              // Используем оператор объединения нулей (??) для безопасных значений
              name: fav.item.name ?? "Рецепт без имени",
              category: fav.item.category ?? "Нет категории",
              calories: fav.item.calories ?? 0,
              cookingTime: fav.item.cookingTime ?? "0 мин",
              // Используем image как uri, если это строка, иначе - заглушка
              image: fav.item.image
                ? { uri: fav.item.image }
                : require("@/assets/images/dinner-rice.png"),
              rating: fav.item.rating ?? 0,
              difficulty: fav.item.difficulty ?? "Легко",
            });
          }
        } else if (fav.favoriteType === "ration") {
          if (itemId && !uniquePlans.has(itemId)) {
            uniquePlans.set(itemId, {
              id: itemId,
              name: fav.item.name ?? "План без названия",
              description: fav.item.description ?? "Описание отсутствует",
              totalCalories: fav.item.totalCalories ?? 0,
              duration: fav.item.duration ?? "0 дней",
              mealsCount: fav.item.mealsCount ?? 0,
              image: fav.item.image
                ? { uri: fav.item.image }
                : require("@/assets/images/dinner-rice.png"),
              // Предполагаем, что fav.createdAt - строка даты/времени
              savedDate: new Date(fav.createdAt).toLocaleDateString("ru-RU"),
            });
          }
        }
      });

      setRecipesData(Array.from(uniqueRecipes.values()));
      setPlansData(Array.from(uniquePlans.values()));
    } catch (e: any) {
      // Улучшенная обработка ошибок для случаев, когда сервис бросает ошибку
      const errorMessage = e?.message || "Неизвестная ошибка загрузки данных.";
      console.error("Ошибка при загрузке избранного:", e);
      setError(
        errorMessage.includes("authenticated")
          ? "Для просмотра избранного необходимо авторизоваться."
          : "Не удалось загрузить сохраненные данные"
      );
      setRecipesData([]);
      setPlansData([]);
    } finally {
      setLoading(false);
    }
  }, []); // Пустой массив зависимостей, так как loadFavorites не использует внешних state/props

  // Используем useFocusEffect для перезагрузки данных при фокусе экрана
  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      // Опционально: можно вернуть функцию очистки, если бы были подписки на события
      return () => {};
    }, [loadFavorites])
  );

  // Фильтрация рецептов
  const filteredRecipes = recipesData.filter((recipe) => {
    const matchesSearch = recipe.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "Все" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Обработчик удаления из избранного
  const handleToggleFavorite = async (
    itemId: string,
    favoriteType: "recipe" | "ration"
  ) => {
    try {
      // toggleFavorite в useFavorites должен вызывать service.removeFromFavorites
      //await toggleFavorite(itemId, favoriteType);

      // Обновляем локальное состояние для мгновенного отклика UI
      if (favoriteType === "recipe") {
        setRecipesData((prev) => prev.filter((recipe) => recipe.id !== itemId));
      } else {
        setPlansData((prev) => prev.filter((plan) => plan.id !== itemId));
      }
    } catch (error) {
      console.error("Ошибка при удалении из избранного:", error);
      Alert.alert("Ошибка", "Не удалось удалить из избранного");
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

  const navigateToPlan = (plan: PlanDetail) => {
    console.log(`Переход к плану: ${plan.name}`);
    // Здесь должна быть реальная навигация, например:
    // router.push({
    // pathname: "/plan-details",
    // params: { planId: plan.id }
    // });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
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

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Сохраненное</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </View>
    );
  }

  // Обработка ошибок и пустого состояния
  if (error && recipesData.length === 0 && plansData.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Сохраненное</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Ionicons name="warning-outline" size={48} color="#F44336" />
          <Text style={styles.emptyTitle}>Произошла ошибка</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={loadFavorites}
          >
            <Text style={styles.clearFiltersText}>Повторить попытку</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Заголовок */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Сохраненное</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Вкладки */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "recipes" && styles.tabActive]}
          onPress={() => setActiveTab("recipes")}
        >
          <Ionicons
            name="restaurant-outline"
            size={20}
            color={activeTab === "recipes" ? "#6A9AA9" : "#666"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "recipes" && styles.tabTextActive,
            ]}
          >
            Рецепты ({recipesData.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === "plans" && styles.tabActive]}
          onPress={() => setActiveTab("plans")}
        >
          <Ionicons
            name="calendar-outline"
            size={20}
            color={activeTab === "plans" ? "#6A9AA9" : "#666"}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === "plans" && styles.tabTextActive,
            ]}
          >
            Планы ({plansData.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Поиск и фильтры - показываются только для Рецептов */}
        {activeTab === "recipes" && (
          <View style={styles.searchSection}>
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
                  placeholder="Поиск..."
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* Фильтры по категориям */}
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
                    selectedCategory === category &&
                      styles.categoryButtonActive,
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      selectedCategory === category &&
                        styles.categoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.sectionDivider} />
          </View>
        )}

        {/* Контент в зависимости от вкладки */}
        {activeTab === "recipes" ? (
          <View style={styles.recipesSection}>
            {filteredRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={64} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>В сохраненных пока пусто</Text>
                <Text style={styles.emptyText}>
                  {searchQuery || selectedCategory !== "Все"
                    ? "Попробуйте изменить параметры поиска или сбросить фильтры."
                    : "Сохраняйте рецепты, нажимая на значок закладки."}
                </Text>
                {(searchQuery || selectedCategory !== "Все") && (
                  <TouchableOpacity
                    style={styles.clearFiltersButton}
                    onPress={clearFilters}
                  >
                    <Text style={styles.clearFiltersText}>Показать все</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {/* Сетка рецептов 2x2 */}
                <View style={styles.recipesGrid}>
                  {filteredRecipes.map((recipe) => (
                    <View key={recipe.id} style={styles.recipeColumn}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => navigateToRecipe(recipe)}
                        style={styles.recipeCard}
                      >
                        <View style={styles.imageContainer}>
                          <Image
                            source={recipe.image}
                            style={styles.recipeImage}
                            resizeMode="cover"
                          />
                          <View style={styles.recipeBadges}>
                            <View style={styles.ratingBadge}>
                              <Ionicons name="star" size={10} color="#FFD700" />
                              <Text style={styles.ratingText}>
                                {recipe.rating.toFixed(1)}
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
                          {/* Кнопка удаления из избранного (заполненная закладка) */}
                          <TouchableOpacity
                            style={styles.bookmarkButton}
                            onPress={(e) => {
                              // Предотвращаем срабатывание navigateToRecipe
                              e.stopPropagation();
                              handleToggleFavorite(recipe.id, "recipe");
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
                              <Ionicons
                                name="flame-outline"
                                size={12}
                                color="#FF6B6B"
                              />
                              <Text style={styles.recipeCalories}>
                                {recipe.calories} ккал
                              </Text>
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
          </View>
        ) : (
          <View style={styles.plansSection}>
            {plansData.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>Нет сохраненных планов</Text>
                <Text style={styles.emptyText}>
                  Сохраняйте понравившиеся планы питания для быстрого доступа
                </Text>
              </View>
            ) : (
              <View style={styles.plansList}>
                {plansData.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.planCard}
                    onPress={() => navigateToPlan(plan)}
                  >
                    <Image
                      source={plan.image}
                      style={styles.planImage}
                      resizeMode="cover"
                    />
                    <View style={styles.planContent}>
                      <View>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.planDescription} numberOfLines={2}>
                          {plan.description}
                        </Text>
                      </View>
                      <View style={styles.planDetails}>
                        <View style={styles.planDetail}>
                          <Ionicons
                            name="flame-outline"
                            size={14}
                            color="#FF6B6B"
                          />
                          <Text style={styles.planDetailText}>
                            {plan.totalCalories} ккал/день
                          </Text>
                        </View>
                        <View style={styles.planDetail}>
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color="#6A9AA9"
                          />
                          <Text style={styles.planDetailText}>
                            {plan.duration}
                          </Text>
                        </View>
                        <View style={styles.planDetail}>
                          <Ionicons
                            name="restaurant-outline"
                            size={14}
                            color="#9BDF11"
                          />
                          <Text style={styles.planDetailText}>
                            {plan.mealsCount} приёмов
                          </Text>
                        </View>
                      </View>
                      <View style={styles.planFooter}>
                        <Text style={styles.planDate}>
                          Сохранено: {plan.savedDate}
                        </Text>
                        <TouchableOpacity
                          style={styles.usePlanButton}
                          onPress={(e) => {
                            e.stopPropagation(); // Предотвращаем срабатывание navigateToPlan
                            handleToggleFavorite(plan.id, "ration");
                          }}
                        >
                          {/* ИСПРАВЛЕНО: используем заполненную иконку, показывающую, что элемент сохранен и будет удален */}
                          <Ionicons
                            name="bookmark"
                            size={16}
                            color="#000"
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.usePlanButtonText}>Удалить</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Добавляем недостающие стили
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
    // В реальном приложении нужно убедиться, что этот шрифт загружен
    fontFamily: "System", // Заменено на System для безопасности, если шрифт не импортирован
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "System", // Заменено
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#6A9AA9",
    fontWeight: "600",
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
    fontFamily: "System", // Заменено
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
    fontFamily: "System", // Заменено
    fontWeight: "600",
  },
  categoryTextActive: {
    color: "#000000",
  },
  sectionDivider: {
    height: 2,
    backgroundColor: "#C2DAE2",
    marginHorizontal: -15,
    marginTop: 12,
  },
  recipesSection: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    paddingBottom: 20,
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
    shadowOffset: { width: 0, height: 2 },
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
    fontFamily: "System", // Заменено
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
    fontFamily: "System", // Заменено
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
    fontFamily: "System", // Заменено
    lineHeight: 18,
    minHeight: 36,
  },
  recipeCategory: {
    fontSize: 11,
    color: "#6A9AA9",
    fontFamily: "System", // Заменено
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
    fontFamily: "System", // Заменено
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
    fontFamily: "System", // Заменено
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
    color: "#000000",
    fontSize: 12,
    fontWeight: "normal",
    fontFamily: "System", // Заменено
  },
  plansSection: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    paddingBottom: 20,
  },
  plansList: {
    gap: 16,
  },
  planCard: {
    backgroundColor: "#C2DAE2",
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    height: 140,
  },
  planImage: {
    width: 120,
    height: "100%",
  },
  planContent: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  planName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "System", // Заменено
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "System", // Заменено
    marginBottom: 8,
  },
  planDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  planDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  planDetailText: {
    fontSize: 10,
    color: "#000000",
    fontFamily: "System", // Заменено
  },
  planFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planDate: {
    fontSize: 10,
    color: "#6C757D",
    fontFamily: "System", // Заменено
  },
  usePlanButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  usePlanButtonText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "System", // Заменено
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "System", // Заменено
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "System", // Заменено
    textAlign: "center",
    lineHeight: 20,
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
    fontFamily: "System", // Заменено
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6C757D",
    fontFamily: "System", // Заменено
  },
});
