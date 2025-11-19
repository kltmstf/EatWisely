import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Image,
    ImageBackground,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import ProfileMenu from "../components/ProfileMenu";

export default function Favorites() {
  const router = useRouter();
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");

  const categories = ["Все", "Завтраки", "Обед", "Ужин", "Перекусы", "Супы", "Салаты", "Десерты"];

  const favoriteRecipes = [
    {
      id: 1,
      name: "Овсяная каша с ягодами и медом",
      category: "Завтраки",
      calories: 350,
      cookingTime: "15 мин",
      image: require('@/assets/images/breakfast-oats.png'),
      bookmarked: true,
      rating: 4.8,
      difficulty: "Легко"
    },
    {
      id: 3,
      name: "Рис с курицей и овощами по-азиатски",
      category: "Основные блюда",
      calories: 450,
      cookingTime: "25 мин",
      image: require('@/assets/images/dinner-rice.png'),
      bookmarked: true,
      rating: 4.9,
      difficulty: "Средне"
    },
    {
      id: 6,
      name: "Смузи из ягод и банана",
      category: "Напитки",
      calories: 180,
      cookingTime: "5 мин",
      image: require('@/assets/images/lunch-soup.png'),
      bookmarked: true,
      rating: 4.7,
      difficulty: "Легко"
    },
    {
      id: 7,
      name: "Тост с авокадо и яйцом пашот",
      category: "Завтраки",
      calories: 320,
      cookingTime: "10 мин",
      image: require('@/assets/images/breakfast-oats.png'),
      bookmarked: true,
      rating: 4.6,
      difficulty: "Легко"
    },
    {
      id: 8,
      name: "Греческий салат с фетой",
      category: "Салаты",
      calories: 280,
      cookingTime: "15 мин",
      image: require('@/assets/images/snack-fruits.png'),
      bookmarked: true,
      rating: 4.5,
      difficulty: "Легко"
    },
    {
      id: 9,
      name: "Лосось в медово-соевом соусе",
      category: "Основные блюда",
      calories: 380,
      cookingTime: "20 мин",
      image: require('@/assets/images/dinner-rice.png'),
      bookmarked: true,
      rating: 4.9,
      difficulty: "Средне"
    },
    {
      id: 10,
      name: "Шоколадный брауни без сахара",
      category: "Десерты",
      calories: 220,
      cookingTime: "30 мин",
      image: require('@/assets/images/breakfast-oats.png'),
      bookmarked: true,
      rating: 4.8,
      difficulty: "Средне"
    },
    {
      id: 11,
      name: "Овощной крем-суп",
      category: "Супы",
      calories: 190,
      cookingTime: "25 мин",
      image: require('@/assets/images/lunch-soup.png'),
      bookmarked: true,
      rating: 4.4,
      difficulty: "Легко"
    }
  ];

  const userData = {
    name: "Пользователь"
  };

  const filteredRecipes = favoriteRecipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Все" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleBookmark = (recipeId: number) => {
    console.log(`Удалено из избранного: ${recipeId}`);
    // Здесь будет логика удаления из избранного
  };

  const handleProfileMenu = () => {
    setProfileMenuVisible(!profileMenuVisible);
  };

  const handleMenuAction = (action: string) => {
    console.log(`Выбрано действие: ${action}`);
    switch (action) {
      case 'settings':
        console.log('Переход в настройки профиля');
        break;
      case 'logout':
        console.log('Выход из аккаунта');
        break;
      case 'help':
        console.log('Переход в справку/поддержку');
        break;
    }
  };

  const navigateToRecipe = (recipe: any) => {
    console.log(`Переход к рецепту: ${recipe.name}`);
    router.push({
      pathname: "/meal",
      params: {
        mealName: recipe.name,
        category: recipe.category,
        initialBookmarked: recipe.bookmarked.toString(),
      }
    });
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
            <Text style={styles.greetingText}>
              Избранное, {userData.name}!
            </Text>
            <Text style={styles.dietText}>
              Ваши сохраненные рецепты
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
          </TouchableOpacity>
        </View>

        {/* Компонент меню профиля */}
        <ProfileMenu
          visible={profileMenuVisible}
          onClose={() => setProfileMenuVisible(false)}
          onMenuAction={handleMenuAction}
          userName={userData.name}
          userImage={require('@/assets/images/people-icon.png')}
        />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Поиск и фильтры */}
          <View style={styles.searchSection}>
            {/* Заголовок фильтров */}
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>Категории</Text>
              {(searchQuery || selectedCategory !== "Все") && (
                <TouchableOpacity 
                  style={styles.clearButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.clearButtonText}>Сбросить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Фильтры по категориям */}
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
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Поиск в избранном..."
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            <View style={styles.sectionDivider} />
          </View>

          {/* Статистика избранного */}
          {filteredRecipes.length > 0 && (
            <View style={styles.statsSection}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{filteredRecipes.length}</Text>
                <Text style={styles.statLabel}>рецептов</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {Math.round(filteredRecipes.reduce((sum, recipe) => sum + recipe.calories, 0) / filteredRecipes.length)}
                </Text>
                <Text style={styles.statLabel}>средняя калорийность</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {Math.max(...filteredRecipes.map(r => r.rating))}
                </Text>
                <Text style={styles.statLabel}>макс. рейтинг</Text>
              </View>
            </View>
          )}

          {/* Избранные рецепты */}
          <View style={styles.recipesSection}>
            {filteredRecipes.length === 0 ? (
              <View style={styles.emptyState}>
                <Image 
                  source={require('@/assets/images/bookmark-outline.png')}
                  style={styles.emptyIcon}
                />
                <Text style={styles.emptyTitle}>В избранном пока пусто</Text>
                <Text style={styles.emptyText}>
                  {searchQuery || selectedCategory !== "Все" 
                    ? "Попробуйте изменить параметры поиска" 
                    : "Добавляйте рецепты, нажимая на значок закладки"
                  }
                </Text>
                {(searchQuery || selectedCategory !== "Все") && (
                  <TouchableOpacity 
                    style={styles.clearFiltersButton}
                    onPress={clearFilters}
                  >
                    <Text style={styles.clearFiltersText}>Показать все избранное</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.recipesTitle}>
                  {filteredRecipes.length} рецептов в избранном
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
                          <View style={styles.recipeBadges}>
                            <View style={styles.ratingBadge}>
                              <Image 
                                source={require('@/assets/images/thumbs-up-icon.png')}
                                style={styles.starIcon}
                              />
                              <Text style={styles.ratingText}>{recipe.rating}</Text>
                            </View>
                            <View style={[
                              styles.difficultyBadge,
                              { backgroundColor: getDifficultyColor(recipe.difficulty) }
                            ]}>
                              <Text style={styles.difficultyText}>{recipe.difficulty}</Text>
                            </View>
                          </View>
                          <TouchableOpacity 
                            style={styles.bookmarkButton}
                            onPress={() => toggleBookmark(recipe.id)}
                          >
                            <Image 
                              source={require('@/assets/images/bookmark-filled.png')}
                              style={styles.bookmarkIcon}
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
                            <View style={styles.recipeDetails}>
                              <Text style={styles.recipeCalories}>{recipe.calories} ккал</Text>
                              <Text style={styles.recipeTime}>• {recipe.cookingTime}</Text>
                            </View>
                            <Text style={styles.recipeCategory}>{recipe.category}</Text>
                          </View>
                          <TouchableOpacity 
                            style={styles.viewButton}
                            onPress={() => navigateToRecipe(recipe)}
                          >
                            <Text style={styles.viewButtonText}>Приготовить</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>

      
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  headerTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: "normal",
    color: "#000000ff",
    marginBottom: 4,
    fontFamily: "Playfair Display Bold",
  },
  dietText: {
    fontSize: 16,
    color: "#6C757D",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  profileButton: {
    width: 55,
    height: 55,
    borderRadius: 20,
    overflow: "hidden",
    marginLeft: 16,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 20,
    marginBottom: 1,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Playfair Display Regular',
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Playfair Display Regular',
  },
  categoriesContainer: {
    marginBottom: 16,
    maxHeight: 40,
  },
  categoriesContent: {
    paddingRight: 10,
  },
  categoryButton: {
    backgroundColor: "white",
    borderWidth: 1,
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
  searchContainer: {
    marginBottom: 0,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffffff',
    borderRadius: 30,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 8,
    fontFamily: 'Playfair Display Regular',
  },
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -20,
    marginTop: 16,
  },
  statsSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Playfair Display Bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6C757D',
    fontFamily: 'Playfair Display Regular',
    textAlign: 'center',
  },
  recipesSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 20,
    paddingBottom: 20,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    marginBottom: 20,
    tintColor: '#6A9AA9',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Playfair Display Bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6C757D',
    fontFamily: 'Playfair Display Regular',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  clearFiltersButton: {
    backgroundColor: '#9BDF11',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  clearFiltersText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Playfair Display Regular',
  },
  recipesTitle: {
    fontSize: 16,
    color: "#000000ff",
    marginBottom: 16,
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
    borderWidth: 1,
    borderColor: "#A8C8D4",
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  starIcon: {
    width: 12,
    height: 12,
    marginRight: 4,
    tintColor: '#FFD700',
  },
  ratingText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'Playfair Display Regular',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 10,
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
  bookmarkIcon: {
    width: 18,
    height: 18,
    tintColor: "#6A9AA9",
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
    marginBottom: 6,
    fontFamily: "Playfair Display Regular",
    lineHeight: 18,
    minHeight: 36,
  },
  recipeDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  recipeCalories: {
    fontSize: 12,
    color: "#000000",
    fontWeight: "normal",
    fontFamily: "Playfair Display Bold",
  },
  recipeTime: {
    fontSize: 12,
    color: "#6C757D",
    marginLeft: 4,
    fontFamily: "Playfair Display Regular",
  },
  recipeCategory: {
    fontSize: 11,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    fontStyle: 'italic',
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
    borderWidth: 2,
    borderColor: '#C2DAE2',
  },
  viewButtonText: {
    color: "#000000ff",
    fontSize: 12,
    fontWeight: "normal",
    fontFamily: "Playfair Display Regular",
  },
});