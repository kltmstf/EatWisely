import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
  Auth,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  Firestore,
  getDoc,
  setLogLevel, // Добавлен import для установки уровня логирования
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase/app"; // 💡 ИСПРАВЛЕНИЕ: Добавлены getApps и getApp

// Предполагается, что ProfileMenu находится в ../components/ProfileMenu
// В этой среде этот компонент должен быть определен в этом же файле,
// но я оставлю ваш импорт, предполагая, что вы управляете им локально.
import ProfileMenu from "../components/ProfileMenu";

// Установка уровня логирования для Firestore (полезно для отладки)
setLogLevel("debug");

// --- ТИПИЗАЦИЯ ДЛЯ ЧИТАЕМОСТИ ---

interface Meal {
  category: string;
  name: string;
  calories: number;
  weight: string;
  marked: boolean;
  bookmarked: boolean;
  image: any;
}

interface UserDataState {
  name: string;
  dailyCalories: number;
  consumedCalories: number;
}

// Шаблон данных о приемах пищи (используется для изображений и дефолтных значений)
const initialMealsTemplate: Meal[] = [
  {
    category: "Завтрак",
    name: "Овсяная каша с ягодами и медом на завтрак",
    calories: 350,
    weight: "320 гр.",
    marked: false,
    bookmarked: false,
    // В реальной React Native/Expo среде нужно использовать локальный asset
    // Здесь оставляем, как есть, предполагая, что пути корректны в вашем проекте
    image: require("@/assets/images/breakfast-oats.png"),
  },
  {
    category: "Обед",
    name: "Куриный суп с лапшой и овощами",
    calories: 250,
    weight: "400 гр.",
    marked: false,
    bookmarked: false,
    image: require("@/assets/images/lunch-soup.png"),
  },
  {
    category: "Ужин",
    name: "Рис с курицей и овощами",
    calories: 550,
    weight: "450 гр.",
    marked: false,
    bookmarked: false,
    image: require("@/assets/images/dinner-rice.png"),
  },
  {
    category: "Перекусы",
    name: "Фрукты",
    calories: 120,
    weight: "80 гр.",
    marked: false,
    bookmarked: false,
    image: require("@/assets/images/snack-fruits.png"),
  },
];

export default function Home() {
  const router = useRouter();
  // --- СОСТОЯНИЕ FIREBASE ---
  const [db, setDb] = useState<Firestore | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [appId] = useState(() =>
    typeof __app_id !== "undefined" ? __app_id : "default-app-id"
  );

  // --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
  const [meals, setMeals] = useState<Meal[]>(initialMealsTemplate);
  const [userData, setUserData] = useState<UserDataState>({
    name: "Пользователь",
    dailyCalories: 2000,
    consumedCalories: 0,
  });
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const loading = !isAuthReady || !db;

  // 1. Инициализация Firebase и Аутентификация
  useEffect(() => {
    try {
      const firebaseConfig =
        typeof __firebase_config !== "undefined"
          ? JSON.parse(__firebase_config as string)
          : {};
      // 💡 ИСПРАВЛЕНИЕ: Безопасная инициализация:
      // Проверяем, инициализировано ли приложение. Если нет, инициализируем.
      // Это решает ошибку "Firebase App named '[DEFAULT]' already exists".
      const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);

      setAuth(authInstance);
      setDb(dbInstance);

      const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Анонимный вход, если токен не предоставлен
          const token =
            typeof __initial_auth_token !== "undefined"
              ? __initial_auth_token
              : null;
          if (token) {
            await signInWithCustomToken(authInstance, token);
          } else {
            await signInAnonymously(authInstance);
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Ошибка инициализации Firebase:", error);
      setIsAuthReady(true); // Завершить загрузку, даже если ошибка
    }
  }, []); // Пустой массив зависимостей гарантирует, что эффект сработает только один раз

  // 2. Прослушивание данных пользователя (Имя, Цели)
  useEffect(() => {
    if (!db || !userId) return;

    const userDocRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/profile/data`
    );

    const unsubscribe = onSnapshot(
      userDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as {
            name?: string;
            dailyCalories?: number;
          };
          setUserData((prev) => ({
            ...prev,
            name: data.name || "Пользователь",
            dailyCalories: data.dailyCalories || 2000,
          }));
        } else {
          // Инициализация данных, если документ не существует
          await setDoc(
            userDocRef,
            { name: "Пользователь", dailyCalories: 2000, initialized: true },
            { merge: true }
          ).catch((err) =>
            console.error("Error setting default user profile:", err)
          );
        }
      },
      (error) => {
        console.error("Error listening to user profile:", error);
      }
    );

    return () => unsubscribe();
  }, [db, userId, appId]);

  // 3. Прослушивание ежедневного журнала (Consumed Calories, Marked/Bookmarked status)
  useEffect(() => {
    if (!db || !userId) return;

    const dailyLogDocRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/daily_logs/today`
    );

    const unsubscribe = onSnapshot(
      dailyLogDocRef,
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as {
            consumedCalories?: number;
            meals?: {
              category: string;
              marked: boolean;
              bookmarked: boolean;
            }[];
          };
          // Обновление потребленных калорий
          setUserData((prev) => ({
            ...prev,
            consumedCalories: data.consumedCalories || 0,
          }));

          // Объединение состояния Firebase с локальным шаблоном (для сохранения изображений)
          if (data.meals) {
            setMeals((prevMeals) =>
              prevMeals.map((templateMeal) => {
                const firebaseState = data.meals!.find(
                  (fm) => fm.category === templateMeal.category
                );
                return {
                  ...templateMeal,
                  marked: firebaseState?.marked ?? templateMeal.marked,
                  bookmarked:
                    firebaseState?.bookmarked ?? templateMeal.bookmarked,
                };
              })
            );
          }
        } else {
          // Инициализация журнала (это также создаст документ)
          const initialLogData = {
            consumedCalories: 0,
            meals: initialMealsTemplate.map((m) => ({
              category: m.category,
              marked: false,
              bookmarked: false,
            })),
          };
          await setDoc(dailyLogDocRef, initialLogData).catch((err) =>
            console.error("Error setting default daily log:", err)
          );
        }
      },
      (error) => {
        console.error("Error listening to daily log:", error);
      }
    );

    return () => unsubscribe();
  }, [db, userId, appId]);

  // --- ФУНКЦИИ ОБНОВЛЕНИЯ FIREBASE ---

  const updateMealStateInFirebase = async (
    index: number,
    field: "marked" | "bookmarked",
    value: boolean
  ) => {
    if (!db || !userId) return;

    const dailyLogDocRef = doc(
      db,
      `artifacts/${appId}/users/${userId}/daily_logs/today`
    );

    // Создаем новый массив meals для обновления
    const updatedMealsArray = meals.map((meal, i) => {
      const newMeal = {
        category: meal.category,
        marked: meal.marked,
        bookmarked: meal.bookmarked,
      };
      if (i === index) {
        newMeal[field] = value;
      }
      return newMeal;
    });
    // Пересчет потребленных калорий на основе нового состояния
    const newConsumedCalories = updatedMealsArray
      .filter((m) => m.marked)
      .reduce((sum, m) => {
        const template = initialMealsTemplate.find(
          (t) => t.category === m.category
        );
        return sum + (template?.calories || 0);
      }, 0);

    try {
      await updateDoc(dailyLogDocRef, {
        meals: updatedMealsArray,
        consumedCalories: newConsumedCalories,
      });
    } catch (error) {
      console.error("Error updating meal state in Firebase:", error);
    }
  };

  const toggleMeal = (index: number) => {
    const newValue = !meals[index].marked;
    updateMealStateInFirebase(index, "marked", newValue);
  };

  const toggleBookmark = (index: number) => {
    const newValue = !meals[index].bookmarked;
    updateMealStateInFirebase(index, "bookmarked", newValue);
  };

  // --- ФУНКЦИИ UI ---

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
      },
    });
  };

  const handleProfileMenu = () => {
    setProfileMenuVisible(!profileMenuVisible);
  };

  // --- ЛОАДЕР ---
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>Загрузка данных...</Text>
      </View>
    );
  }

  const progressPercentage =
    (userData.consumedCalories / userData.dailyCalories) * 100;

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Верхнее меню с приветствием */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>
              Добрый день, {userData.name}!
            </Text>
            <Text style={styles.dietText}>Ваш рацион на сегодня</Text>
          </View>
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfileMenu}
          >
            <Image
              source={require("@/assets/images/people-icon.png")}
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>

        {/* Компонент меню профиля */}
        <ProfileMenu
          visible={profileMenuVisible}
          onClose={() => setProfileMenuVisible(false)}
          userName={userData.name}
        />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Прогресс калорий */}
          <View style={styles.caloriesSection}>
            <Text style={styles.caloriesTitle}>
              Вы употребили {userData.consumedCalories} из{" "}
              {userData.dailyCalories} ккал
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, progressPercentage)}%` },
                ]}
              />
            </View>
            <View style={styles.sectionDivider} />
          </View>

          {/* Приемы пищи в виде таблицы 2x2 */}
          <View style={styles.mealsSection}>
            {[0, 2].map((startIndex, rowIndex) => (
              <View key={rowIndex} style={styles.mealRow}>
                {meals
                  .slice(startIndex, startIndex + 2)
                  .map((meal, indexInRow) => {
                    const mealIndex = startIndex + indexInRow;
                    return (
                      <View key={mealIndex} style={styles.mealColumn}>
                        <TouchableOpacity
                          style={styles.mealCategoryHeader}
                          onPress={() => navigateToMealPage(mealIndex)}
                        >
                          <Text style={styles.mealCategoryTitle}>
                            {meal.category}
                          </Text>
                          <Image
                            source={require("@/assets/images/arrow-right.png")}
                            style={styles.arrowIcon}
                          />
                        </TouchableOpacity>
                        <View style={styles.mealCard}>
                          <View style={styles.imageContainer}>
                            <Image
                              source={meal.image}
                              style={styles.mealImage}
                              resizeMode="cover"
                            />
                            <TouchableOpacity
                              style={styles.bookmarkButton}
                              onPress={() => toggleBookmark(mealIndex)}
                            >
                              <Image
                                source={
                                  meal.bookmarked
                                    ? require("@/assets/images/bookmark-filled.png")
                                    : require("@/assets/images/bookmark-outline.png")
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
                                {meal.name}
                              </Text>
                              <View style={styles.mealDetails}>
                                <Text style={styles.mealCalories}>
                                  {meal.calories} ккал
                                </Text>
                                <Text style={styles.mealWeight}>
                                  • {meal.weight}
                                </Text>
                              </View>
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.markButton,
                                meal.marked && styles.markButtonActive,
                              ]}
                              onPress={() => toggleMeal(mealIndex)}
                            >
                              {meal.marked ? (
                                <Image
                                  source={require("@/assets/images/checkmark-done.png")}
                                  style={styles.checkmarkIcon}
                                />
                              ) : (
                                <Text style={styles.markButtonText}>
                                  Отметить
                                </Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f8f8",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6A9AA9",
  },
  rootContainer: {
    flex: 1,
    backgroundColor: '#ffffff', // Белый фон
  },
  container: {
    flex: 1,
    paddingTop: 40, // Для учета StatusBar
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 0,
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
    width: "48%",
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
    position: "relative",
  },
  mealImage: {
    width: "100%",
    height: 120,
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
  bookmarkIcon: {
    width: 18,
    height: 18,
    tintColor: "#6A9AA9",
  },
  mealContent: {
    padding: 12,
    flex: 1,
    justifyContent: "space-between",
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
    flexWrap: "wrap",
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
    borderColor: "#C2DAE2",
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
