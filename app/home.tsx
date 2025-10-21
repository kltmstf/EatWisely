// app/home.tsx
import React, { useState } from "react";
import {
  Image,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useRouter } from "expo-router";
import BottomNav from "../components/BottomNav";
import ProfileMenu from "../components/ProfileMenu";

export default function Home() {
  const router = useRouter();
  const [meals, setMeals] = useState([
    {
      category: "Завтрак",
      name: "Овсяная каша с ягодами и медом на завтрак",
      calories: 350,
      weight: "320 гр.",
      marked: false,
      bookmarked: false,
      image: require('@/assets/images/breakfast-oats.png')
    },
    {
      category: "Обед",
      name: "Куриный суп с лапшой и овощами",
      calories: 250,
      weight: "400 гр.",
      marked: false,
      bookmarked: false,
      image: require('@/assets/images/lunch-soup.png')
    },
    {
      category: "Ужин",
      name: "Рис с курицей и овощами",
      calories: 550,
      weight: "450 гр.",
      marked: false,
      bookmarked: false,
      image: require('@/assets/images/dinner-rice.png')
    },
    {
      category: "Перекусы",
      name: "Фрукты",
      calories: 120,
      weight: "80 гр.",
      marked: false,
      bookmarked: false,
      image: require('@/assets/images/snack-fruits.png')
    }
  ]);

  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const userData = {
    name: "Пользователь",
    dailyCalories: 2000,
    consumedCalories: 910,
  };

  const toggleMeal = (index: number) => {
    console.log(`Отмечен прием пищи: ${meals[index].name}`);
    
    const updatedMeals = [...meals];
    updatedMeals[index].marked = !updatedMeals[index].marked;
    setMeals(updatedMeals);
  };

  const toggleBookmark = (index: number) => {
    console.log(`Закладка для: ${meals[index].name}`);
    
    const updatedMeals = [...meals];
    updatedMeals[index].bookmarked = !updatedMeals[index].bookmarked;
    setMeals(updatedMeals);
  };

  // Единая функция навигации
  const navigateToMealPage = (mealIndex: number) => {
    const meal = meals[mealIndex];
    console.log(`Переход на страницу: ${meal.category}`);
    
    router.push({
      pathname: "/meal",
      params: {
        mealName: meal.name,
        category: meal.category,
        mealIndex: mealIndex.toString(),
        initialBookmarked: meal.bookmarked.toString(),
      }
    });
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
              Добрый день, {userData.name}!
            </Text>
            <Text style={styles.dietText}>
              Ваш рацион на сегодня
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
          {/* Прогресс калорий */}
          <View style={styles.caloriesSection}>
            <Text style={styles.caloriesTitle}>
              Вы употребили {userData.consumedCalories} из {userData.dailyCalories} ккал
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(userData.consumedCalories / userData.dailyCalories) * 100}%` }
                ]} 
              />
            </View>
            <View style={styles.sectionDivider} />
          </View>

          {/* Приемы пищи в виде таблицы 2x2 */}
          <View style={styles.mealsSection}>
            {/* Первая строка: Завтрак и Обед */}
            <View style={styles.mealRow}>
              {/* Карточка Завтрак */}
              <View style={styles.mealColumn}>
                <TouchableOpacity 
                  style={styles.mealCategoryHeader}
                  onPress={() => navigateToMealPage(0)}
                >
                  <Text style={styles.mealCategoryTitle}>{meals[0].category}</Text>
                  <Image 
                    source={require('@/assets/images/arrow-right.png')}
                    style={styles.arrowIcon}
                  />
                </TouchableOpacity>
                <View style={styles.mealCard}>
                  <View style={styles.imageContainer}>
                    <Image 
                      source={meals[0].image}
                      style={styles.mealImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity 
                      style={styles.bookmarkButton}
                      onPress={() => toggleBookmark(0)}
                    >
                      <Image 
                        source={
                          meals[0].bookmarked 
                            ? require('@/assets/images/bookmark-filled.png')
                            : require('@/assets/images/bookmark-outline.png')
                        }
                        style={styles.bookmarkIcon}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.mealContent}>
                    <View style={styles.mealInfo}>
                      <Text 
                        style={styles.mealName}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {meals[0].name}
                      </Text>
                      <View style={styles.mealDetails}>
                        <Text style={styles.mealCalories}>{meals[0].calories} ккал</Text>
                        <Text style={styles.mealWeight}>• {meals[0].weight}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={[
                        styles.markButton,
                        meals[0].marked && styles.markButtonActive
                      ]}
                      onPress={() => toggleMeal(0)}
                    >
                      {meals[0].marked ? (
                        <Image 
                          source={require('@/assets/images/checkmark-done.png')}
                          style={styles.checkmarkIcon}
                        />
                      ) : (
                        <Text style={styles.markButtonText}>Отметить</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Карточка Обед */}
              <View style={styles.mealColumn}>
                <TouchableOpacity 
                  style={styles.mealCategoryHeader}
                  onPress={() => navigateToMealPage(1)}
                >
                  <Text style={styles.mealCategoryTitle}>{meals[1].category}</Text>
                  <Image 
                    source={require('@/assets/images/arrow-right.png')}
                    style={styles.arrowIcon}
                  />
                </TouchableOpacity>
                <View style={styles.mealCard}>
                  <View style={styles.imageContainer}>
                    <Image 
                      source={meals[1].image}
                      style={styles.mealImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity 
                      style={styles.bookmarkButton}
                      onPress={() => toggleBookmark(1)}
                    >
                      <Image 
                        source={
                          meals[1].bookmarked 
                            ? require('@/assets/images/bookmark-filled.png')
                            : require('@/assets/images/bookmark-outline.png')
                        }
                        style={styles.bookmarkIcon}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.mealContent}>
                    <View style={styles.mealInfo}>
                      <Text 
                        style={styles.mealName}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {meals[1].name}
                      </Text>
                      <View style={styles.mealDetails}>
                        <Text style={styles.mealCalories}>{meals[1].calories} ккал</Text>
                        <Text style={styles.mealWeight}>• {meals[1].weight}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={[
                        styles.markButton,
                        meals[1].marked && styles.markButtonActive
                      ]}
                      onPress={() => toggleMeal(1)}
                    >
                      {meals[1].marked ? (
                        <Image 
                          source={require('@/assets/images/checkmark-done.png')}
                          style={styles.checkmarkIcon}
                        />
                      ) : (
                        <Text style={styles.markButtonText}>Отметить</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Вторая строка: Ужин и Перекусы */}
            <View style={styles.mealRow}>
              {/* Карточка Ужин */}
              <View style={styles.mealColumn}>
                <TouchableOpacity 
                  style={styles.mealCategoryHeader}
                  onPress={() => navigateToMealPage(2)}
                >
                  <Text style={styles.mealCategoryTitle}>{meals[2].category}</Text>
                  <Image 
                    source={require('@/assets/images/arrow-right.png')}
                    style={styles.arrowIcon}
                  />
                </TouchableOpacity>
                <View style={styles.mealCard}>
                  <View style={styles.imageContainer}>
                    <Image 
                      source={meals[2].image}
                      style={styles.mealImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity 
                      style={styles.bookmarkButton}
                      onPress={() => toggleBookmark(2)}
                    >
                      <Image 
                        source={
                          meals[2].bookmarked 
                            ? require('@/assets/images/bookmark-filled.png')
                            : require('@/assets/images/bookmark-outline.png')
                        }
                        style={styles.bookmarkIcon}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.mealContent}>
                    <View style={styles.mealInfo}>
                      <Text 
                        style={styles.mealName}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {meals[2].name}
                      </Text>
                      <View style={styles.mealDetails}>
                        <Text style={styles.mealCalories}>{meals[2].calories} ккал</Text>
                        <Text style={styles.mealWeight}>• {meals[2].weight}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={[
                        styles.markButton,
                        meals[2].marked && styles.markButtonActive
                      ]}
                      onPress={() => toggleMeal(2)}
                    >
                      {meals[2].marked ? (
                        <Image 
                          source={require('@/assets/images/checkmark-done.png')}
                          style={styles.checkmarkIcon}
                        />
                      ) : (
                        <Text style={styles.markButtonText}>Отметить</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Карточка Перекусы */}
              <View style={styles.mealColumn}>
                <TouchableOpacity 
                  style={styles.mealCategoryHeader}
                  onPress={() => navigateToMealPage(3)}
                >
                  <Text style={styles.mealCategoryTitle}>{meals[3].category}</Text>
                  <Image 
                    source={require('@/assets/images/arrow-right.png')}
                    style={styles.arrowIcon}
                  />
                </TouchableOpacity>
                <View style={styles.mealCard}>
                  <View style={styles.imageContainer}>
                    <Image 
                      source={meals[3].image}
                      style={styles.mealImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity 
                      style={styles.bookmarkButton}
                      onPress={() => toggleBookmark(3)}
                    >
                      <Image 
                        source={
                          meals[3].bookmarked 
                            ? require('@/assets/images/bookmark-filled.png')
                            : require('@/assets/images/bookmark-outline.png')
                        }
                        style={styles.bookmarkIcon}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.mealContent}>
                    <View style={styles.mealInfo}>
                      <Text 
                        style={styles.mealName}
                        numberOfLines={2}
                        ellipsizeMode="tail"
                      >
                        {meals[3].name}
                      </Text>
                      <View style={styles.mealDetails}>
                        <Text style={styles.mealCalories}>{meals[3].calories} ккал</Text>
                        <Text style={styles.mealWeight}>• {meals[3].weight}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={[
                        styles.markButton,
                        meals[3].marked && styles.markButtonActive
                      ]}
                      onPress={() => toggleMeal(3)}
                    >
                      {meals[3].marked ? (
                        <Image 
                          source={require('@/assets/images/checkmark-done.png')}
                          style={styles.checkmarkIcon}
                        />
                      ) : (
                        <Text style={styles.markButtonText}>Отметить</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Нижнее меню (отдельный компонент) */}
        <BottomNav />
      </View>
    </ImageBackground>
  );
}

// Стили остаются без изменений
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
  caloriesSection: {
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    marginBottom: 1,
  },
  caloriesTitle: {
    fontSize: 16,
    color: "#000000ff",
    marginBottom: 12,
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  progressBar: {
    height: 12,
    backgroundColor: "#C2DAE2",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 20,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#9BDF11",
    borderRadius: 6,
  },
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -20,
  },
  mealsSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 20,
    paddingBottom: 20,
  },
  mealRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  mealColumn: {
    width: '48%',
  },
  mealCategoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  mealCategoryTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "Playfair Display Regular",
  },
  arrowIcon: {
    width: 16,
    height: 16,
    tintColor: "#000000",
  },
  mealCard: {
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
    height: 260,
  },
  imageContainer: {
    position: 'relative',
  },
  mealImage: {
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
  mealContent: {
    padding: 12,
    flex: 1,
    justifyContent: 'space-between',
  },
  mealInfo: {
    flex: 1,
    marginBottom: 8,
  },
  mealName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 6,
    fontFamily: "Playfair Display Regular",
    lineHeight: 18,
  },
  mealDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: 'wrap',
    marginTop: 4,
  },
  mealCalories: {
    fontSize: 12,
    color: "#000000",
    fontWeight: "normal",
    fontFamily: "Playfair Display Bold",
  },
  mealWeight: {
    fontSize: 12,
    color: "#6C757D",
    marginLeft: 45,
    fontFamily: "Playfair Display Regular",
  },
  markButton: {
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
  markButtonActive: {
    backgroundColor: "rgba(155, 223, 17, 0.6)",
  },
  markButtonText: {
    color: "#000000ff",
    fontSize: 12,
    fontWeight: "normal",
    fontFamily: "Playfair Display Regular",
  },
  checkmarkIcon: {
    width: 16,
    height: 16,
    tintColor: "#000000ff",
  },
});