import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  StatusBar,
  Image,
  ImageBackground
} from "react-native";
import BottomNav from "../components/BottomNav";

export default function Home() {
  const userData = {
    name: "Алексей",
    dailyCalories: 2000,
    consumedCalories: 910,
    meals: [
      {
        category: "Завтрак",
        name: "Овсяная каша с ягодами",
        calories: 350,
        weight: "320 гр.",
        marked: false
      },
      {
        category: "Обед",
        name: "Куриный суп",
        calories: 250,
        weight: "400 гр.",
        marked: false
      },
      {
        category: "Ужин",
        name: "Рис с курицей и овощами",
        calories: 550,
        weight: "450 гр.",
        marked: false
      },
      {
        category: "Перекусы",
        name: "Фрукты",
        calories: 120,
        weight: "80 гр.",
        marked: false
      }
    ]
  };

  const toggleMeal = (index: number) => {
    console.log(`Отмечен прием пищи: ${userData.meals[index].name}`);
  };

  return (
    <ImageBackground 
      source={require('@/assets/images/background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Верхнее меню (только для Home) */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>3 марта, пн</Text>
            <Text style={styles.timeText}>17:31</Text>
          </View>
          
          <TouchableOpacity style={styles.profileButton}>
            <Image 
              source={require('@/assets/images/people-icon.png')}
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Приветствие */}
          <View style={styles.greetingSection}>
            <Text style={styles.greetingText}>
              Добрый день, {userData.name}!
            </Text>
            <Text style={styles.dietText}>
              Ваш рацион на сегодня
            </Text>
          </View>

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
          </View>

          {/* Приемы пищи в виде карточек */}
          <View style={styles.mealsSection}>
            {userData.meals.map((meal, index) => (
              <View key={index} style={styles.mealCategory}>
                <Text style={styles.mealCategoryTitle}>{meal.category} →</Text>
                <View style={styles.mealCard}>
                  <View style={styles.mealContent}>
                    <View style={styles.mealInfo}>
                      <Text style={styles.mealName}>{meal.name}</Text>
                      <View style={styles.mealDetails}>
                        <Text style={styles.mealCalories}>{meal.calories} ккал</Text>
                        <Text style={styles.mealWeight}>• {meal.weight}</Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={styles.markButton}
                      onPress={() => toggleMeal(index)}
                    >
                      <Text style={styles.markButtonText}>Отметить</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Нижнее меню (отдельный компонент) */}
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
    backgroundColor: 'rgba(248, 249, 250, 0.95)',
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  dateText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#495057",
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
  timeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 30,
  },
  scrollView: {
    flex: 1,
  },
  greetingSection: {
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 1,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: "normal",
    color: "#212529",
    marginBottom: 8,
    fontFamily: "Playfair Display Bold", // Шрифт как на других страницах
  },
  dietText: {
    fontSize: 18,
    color: "#6C757D",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
  caloriesSection: {
    padding: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    marginBottom: 1,
  },
  caloriesTitle: {
    fontSize: 16,
    color: "#495057",
    marginBottom: 12,
    fontWeight: "500",
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E9ECEF",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#9BDF11",
    borderRadius: 4,
  },
  mealsSection: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingBottom: 20,
  },
  mealCategory: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F9FA",
  },
  mealCategoryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
  mealCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 0,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#F1F3F4",
  },
  mealContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 8,
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
  mealDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  mealCalories: {
    fontSize: 14,
    color: "#9BDF11",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
  mealWeight: {
    fontSize: 14,
    color: "#6C757D",
    marginLeft: 8,
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
  markButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 12,
    minWidth: 100,
    alignItems: "center",
  },
  markButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular", // Шрифт как на других страницах
  },
});