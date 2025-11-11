// app/recipes.tsx
import React, { useState } from "react";
import {
  Image,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { useRouter } from "expo-router";
import BottomNav from "../components/BottomNav";
import ProfileMenu from "../components/ProfileMenu";

export default function Recipes() {
  const router = useRouter();
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");

  const categories = ["Все", "Завтраки", "Обед", "Ужин", "Перекусы",];

  const recipes = [
    {
      id: 1,
      name: "Овсяная каша с ягодами",
      category: "Завтраки",
      calories: 350,
      cookingTime: "15 мин",
      image: require('@/assets/images/breakfast-oats.png'),
      bookmarked: false
    },
    {
      id: 2,
      name: "Куриный суп с лапшой",
      category: "Супы",
      calories: 250,
      cookingTime: "30 мин",
      image: require('@/assets/images/lunch-soup.png'),
      bookmarked: false
    },
    {
      id: 3,
      name: "Рис с курицей и овощами",
      category: "Основные блюда",
      calories: 450,
      cookingTime: "25 мин",
      image: require('@/assets/images/dinner-rice.png'),
      bookmarked: true
    },
    {
      id: 4,
      name: "Фруктовый салат",
      category: "Салаты",
      calories: 120,
      cookingTime: "10 мин",
      image: require('@/assets/images/snack-fruits.png'),
      bookmarked: false
    },
    {
      id: 5,
      name: "Шоколадный мусс",
      category: "Десерты",
      calories: 280,
      cookingTime: "20 мин",
      image: require('@/assets/images/breakfast-oats.png'),
      bookmarked: false
    },
    {
      id: 6,
      name: "Смузи из ягод",
      category: "Напитки",
      calories: 180,
      cookingTime: "5 мин",
      image: require('@/assets/images/lunch-soup.png'),
      bookmarked: true
    }
  ];

  const userData = {
    name: "Пользователь"
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "Все" || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleBookmark = (recipeId: number) => {
    console.log(`Закладка для рецепта: ${recipeId}`);
    // Здесь будет логика переключения закладки
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
              Рецепты, {userData.name}!
            </Text>
            <Text style={styles.dietText}>
              Найдите идеальное блюдо для себя
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
    {/* Категории - ПЕРЕМЕСТИТЕ НАД ПОИСКОМ */}
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

    {/* Поле поиска - ПЕРЕМЕСТИТЕ ПОД КАТЕГОРИИ */}
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
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
    {filteredRecipes.map((recipe, index) => (
      <View key={recipe.id} style={styles.recipeColumn}>
        <View style={styles.recipeCard}>
          <View style={styles.imageContainer}>
            <Image 
              source={recipe.image}
              style={styles.recipeImage}
              resizeMode="cover"
            />
            <TouchableOpacity 
              style={styles.bookmarkButton}
              onPress={() => toggleBookmark(recipe.id)}
            >
              <Image 
                source={
                  recipe.bookmarked 
                    ? require('@/assets/images/bookmark-filled.png')
                    : require('@/assets/images/bookmark-outline.png')
                }
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
</View>
        </ScrollView>

        {/* Нижнее меню */}
        <BottomNav />
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
  contentContainer: {
    flex: 1,
  },
  bottomNavContainer: {
    // Фиксированное положение для нижней навигации
  },
  scrollContent: {
    flexGrow: 1,
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
  searchContainer: {
    marginBottom: 16,
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
  searchIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    tintColor: '#000',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 8,
    fontFamily: 'Playfair Display Regular',
  },
  categoriesContainer: {
    marginBottom: 16,
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
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -20,
  },
  recipesSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 20,
    paddingBottom: 20,
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
    height: 260, // Немного уменьшил высоту
  },
  imageContainer: {
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: 120,
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
    marginTop: 4,
    marginBottom: 8
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
    marginLeft: 40,
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