import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  StatusBar 
} from "react-native";

export default function Home() {
  const userData = {
    name: "Алексей",
    date: "3 марта, пп",
    time: "17:31",
    dailyCalories: 2000,
    consumedCalories: 910,
    meals: [
      {
        category: "Завтрак",
        name: "Овсяная каша",
        calories: 190,
        weight: "150 гр.",
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
        calories: 350,
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
    // В будущем здесь будет логика отметки приема пищи
    console.log(`Отмечен прием пищи: ${userData.meals[index].name}`);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Шапка с датой и временем */}
      <View style={styles.header}>
        <Text style={styles.dateText}>{userData.date}</Text>
        <Text style={styles.timeText}>{userData.time}</Text>
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
            Вы употребили {userData.consumedCalories} ккал из {userData.dailyCalories} ккал
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

        {/* Приемы пищи */}
        <View style={styles.mealsSection}>
          {/* Завтрак */}
          <View style={styles.mealCategory}>
            <Text style={styles.mealCategoryTitle}>Завтрак →</Text>
            <View style={styles.mealCard}>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{userData.meals[0].name}</Text>
                <Text style={styles.mealCalories}>{userData.meals[0].calories} ккал</Text>
                <Text style={styles.mealWeight}>{userData.meals[0].weight}</Text>
              </View>
              <TouchableOpacity 
                style={styles.markButton}
                onPress={() => toggleMeal(0)}
              >
                <Text style={styles.markButtonText}>Отметить</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Обед */}
          <View style={styles.mealCategory}>
            <Text style={styles.mealCategoryTitle}>Обед →</Text>
            <View style={styles.mealCard}>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{userData.meals[1].name}</Text>
                <Text style={styles.mealCalories}>{userData.meals[1].calories} ккал</Text>
                <Text style={styles.mealWeight}>{userData.meals[1].weight}</Text>
              </View>
              <TouchableOpacity 
                style={styles.markButton}
                onPress={() => toggleMeal(1)}
              >
                <Text style={styles.markButtonText}>Отметить</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Ужин */}
          <View style={styles.mealCategory}>
            <Text style={styles.mealCategoryTitle}>Ужин →</Text>
            <View style={styles.mealCard}>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{userData.meals[2].name}</Text>
                <Text style={styles.mealCalories}>{userData.meals[2].calories} ккал</Text>
                <Text style={styles.mealWeight}>{userData.meals[2].weight}</Text>
              </View>
              <TouchableOpacity 
                style={styles.markButton}
                onPress={() => toggleMeal(2)}
              >
                <Text style={styles.markButtonText}>Отметить</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Перекусы */}
          <View style={styles.mealCategory}>
            <Text style={styles.mealCategoryTitle}>Перекусы →</Text>
            <View style={styles.mealCard}>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{userData.meals[3].name}</Text>
                <Text style={styles.mealCalories}>{userData.meals[3].calories} ккал</Text>
                <Text style={styles.mealWeight}>{userData.meals[3].weight}</Text>
              </View>
              <TouchableOpacity 
                style={styles.markButton}
                onPress={() => toggleMeal(3)}
              >
                <Text style={styles.markButtonText}>Отметить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
  },
  dateText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#495057",
  },
  timeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
  },
  scrollView: {
    flex: 1,
  },
  greetingSection: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    marginBottom: 1,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#212529",
    marginBottom: 8,
  },
  dietText: {
    fontSize: 18,
    color: "#6C757D",
    fontWeight: "500",
  },
  caloriesSection: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    marginBottom: 1,
  },
  caloriesTitle: {
    fontSize: 16,
    color: "#495057",
    marginBottom: 12,
    fontWeight: "500",
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
    backgroundColor: "#FFFFFF",
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
  },
  mealCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 12,
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 4,
  },
  mealCalories: {
    fontSize: 14,
    color: "#9BDF11",
    fontWeight: "500",
    marginBottom: 2,
  },
  mealWeight: {
    fontSize: 14,
    color: "#6C757D",
  },
  markButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 12,
  },
  markButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});