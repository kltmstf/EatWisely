// app/meal.tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Meal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Получаем данные из параметров навигации
  const { 
    mealName = "Овсянка с ягодами", 
    category = "Завтрак",
    mealIndex = "0",
    initialBookmarked = "false"
  } = params;

  const [liked, setLiked] = useState<boolean | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Загружаем начальное состояние избранного из параметров
  useEffect(() => {
    setIsBookmarked(initialBookmarked === "true");
  }, [initialBookmarked]);

  // Статические данные
  const mealData = {
    name: mealName as string,
    category: category as string,
    cookingTime: "10 мин",
    servings: "1 чел.",
    ingredients: [
      "300 мл. молока",
      "1 банан", 
      "100 гр. овсянки",
      "1 ст. ложка меда",
      "100 гр. ягод (на ваш вкус)"
    ],
    instructions: [
      "Разогреть молоко на среднем огне.",
      "Добавить овсянку и мед. Перемешивать до загустения.",
      "Снять с огня, добавить фрукты и ягоды."
    ]
  };

  // Ключи для хранения в AsyncStorage
  const ratingKey = `meal_rating_${category}_${mealName}`;
  const bookmarkKey = `meal_bookmark_${category}_${mealName}`;

  // Загружаем оценку и избранное при монтировании
  useEffect(() => {
    loadRating();
    loadBookmark();
  }, []);

  // Функция загрузки оценки
  const loadRating = async () => {
    try {
      const savedRating = await AsyncStorage.getItem(ratingKey);
      if (savedRating !== null) {
        setLiked(JSON.parse(savedRating));
      }
    } catch (error) {
      console.log('Ошибка при загрузке оценки:', error);
    }
  };

  // Функция загрузки избранного
  const loadBookmark = async () => {
    try {
      const savedBookmark = await AsyncStorage.getItem(bookmarkKey);
      if (savedBookmark !== null) {
        const bookmarkState = JSON.parse(savedBookmark);
        setIsBookmarked(bookmarkState);
      }
    } catch (error) {
      console.log('Ошибка при загрузке избранного:', error);
    }
  };

  // Функция сохранения оценки
  const saveRating = async (rating: boolean) => {
    try {
      await AsyncStorage.setItem(ratingKey, JSON.stringify(rating));
    } catch (error) {
      console.log('Ошибка при сохранении оценки:', error);
    }
  };

  // Функция сохранения избранного
  const saveBookmark = async (bookmarked: boolean) => {
    try {
      await AsyncStorage.setItem(bookmarkKey, JSON.stringify(bookmarked));
      
      // Здесь можно добавить вызов API для синхронизации с сервером
      // или использовать глобальное состояние
      console.log(`Блюдо "${mealData.name}" ${bookmarked ? 'добавлено в' : 'удалено из'} избранное`);
      
    } catch (error) {
      console.log('Ошибка при сохранении избранного:', error);
    }
  };

  // Получаем правильное изображение
  const getMealImage = () => {
    switch(category) {
      case "Завтрак":
        return require('@/assets/images/breakfast-oats.png');
      case "Обед":
        return require('@/assets/images/lunch-soup.png');
      case "Ужин":
        return require('@/assets/images/dinner-rice.png');
      case "Перекусы":
        return require('@/assets/images/snack-fruits.png');
      default:
        return require('@/assets/images/breakfast-oats.png');
    }
  };

  const handleLike = async () => {
    console.log("Понравилось блюдо");
    setLiked(true);
    await saveRating(true);
  };

  const handleDislike = async () => {
    console.log("Не понравилось блюдо");
    setLiked(false);
    await saveRating(false);
  };

  const handleBack = () => {
    router.back();
  };

  const handleBookmark = async () => {
    const newBookmarkState = !isBookmarked;
    setIsBookmarked(newBookmarkState);
    await saveBookmark(newBookmarkState);
    
    // Можно добавить здесь вызов для обновления состояния на главной странице
    // через глобальное состояние или callback
  };

  const handleChangeMeal = () => {
    console.log("Смена блюда");
  };

  const handleChooseFromList = () => {
    console.log("Выбор из списка блюд");
  };

  // Функция для сброса оценки
  const handleResetRating = async () => {
    try {
      await AsyncStorage.removeItem(ratingKey);
      setLiked(null);
      console.log("Оценка сброшена");
    } catch (error) {
      console.log('Ошибка при сбросе оценки:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Шапка с кнопкой назад и заголовком */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Image 
            source={require('@/assets/images/back-icon.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Ваш {mealData.category.toLowerCase()} на сегодня</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Изображение блюда с кнопкой избранного */}
        <View style={styles.imageContainer}>
          <Image 
            source={getMealImage()}
            style={styles.mealImage}
            resizeMode="cover"
          />
          <TouchableOpacity 
            style={styles.bookmarkButton}
            onPress={handleBookmark}
          >
            <Image 
              source={
                isBookmarked 
                  ? require('@/assets/images/bookmark-filled.png')
                  : require('@/assets/images/bookmark-outline.png')
              }
              style={styles.bookmarkIcon}
            />
          </TouchableOpacity>
        </View>

        {/* Кнопки действий под изображением */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.changeMealButton}
            onPress={handleChangeMeal}
          >
            <Text style={styles.changeMealText}>Сменить блюдо</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.chooseFromListButton}
            onPress={handleChooseFromList}
          >
            <Text style={styles.chooseFromListText}>Выбрать из списка</Text>
          </TouchableOpacity>
        </View>

        {/* Основная информация */}
        <View style={styles.content}>
          {/* Название блюда */}
          <Text style={styles.mealName}>{mealData.name}</Text>
          
          {/* Время и порции */}
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Image 
                source={require('@/assets/images/time-icon.png')}
                style={styles.detailIcon}
              />
              <Text style={styles.detailText}>{mealData.cookingTime}</Text>
              <Text style={styles.detailLabel}>время приготовления</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Image 
                source={require('@/assets/images/happy-icon.png')}
                style={styles.detailIcon}
              />
              <Text style={styles.detailText}>{mealData.servings}</Text>
              <Text style={styles.detailLabel}>количество порций</Text>
            </View>
          </View>

          {/* Сообщение о выборе */}
          {liked !== null && (
            <View style={styles.feedbackMessage}>
              <Text style={styles.feedbackText}>
                {liked 
                  ? "Рады, что вам понравилось! Это блюдо появится в вашем рационе чаще." 
                  : "Жаль, что вам не понравилось. Мы предложим другой вариант."}
              </Text>
              <TouchableOpacity 
                style={styles.resetButton}
                onPress={handleResetRating}
              >
                <Text style={styles.resetButtonText}>Изменить оценку</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Кнопки лайка и дизлайка */}
          {liked === null && (
            <View style={styles.likeSection}>
              <Text style={styles.likeQuestion}>Вам понравилось это блюдо?</Text>
              <View style={styles.likeButtonsContainer}>
                <TouchableOpacity 
                  style={[styles.likeButton, styles.dislikeButton]} 
                  onPress={handleDislike}
                >
                  <Image 
                    source={require('@/assets/images/thumbs-down-icon.png')}
                    style={styles.likeIcon}
                  />
                  <Text style={styles.likeText}>Не нравится</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.likeButton, styles.likeButtonActive]} 
                  onPress={handleLike}
                >
                  <Image 
                    source={require('@/assets/images/thumbs-up-icon.png')}
                    style={styles.likeIcon}
                  />
                  <Text style={styles.likeText}>Нравится</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Ингредиенты */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ингредиенты:</Text>
              {mealData.ingredients.map((ingredient, index) => (
                <View key={`ingredient-${index}`} style={styles.ingredientItem}>
                  <Text style={styles.ingredientText}>{`• ${ingredient}`}</Text>
          </View>
            ))}
          </View>

          {/* Способ приготовления */}
          <View style={styles.section}>
            <Text style={styles.sectionSubtitle}>Способ приготовления:</Text>
            {mealData.instructions.map((instruction, index) => (
              <View key={index} style={styles.instructionItem}>
                <Text style={styles.stepNumber}>{index + 1}.</Text>
                <Text style={styles.instructionText}>{instruction}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: "#6A9AA9",
  },
  backButton: {
    padding: 8,
  },
  backIcon: {
    width: 35,
    height: 15,
    tintColor: "#000000",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    maxWidth: "80%",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  mealImage: {
    width: "100%",
    height: 250,
  },
  bookmarkButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  bookmarkIcon: {
    width: 20,
    height: 20,
    tintColor: "#6A9AA9",
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E9ECEF",
    gap: 12,
  },
  changeMealButton: {
    flex: 1,
    backgroundColor: "#6A9AA9",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  changeMealText: {
    fontSize: 14,
    fontWeight: "600",
    color: "black",
    fontFamily: "Playfair Display Regular",
  },
  chooseFromListButton: {
    flex: 1,
    backgroundColor: "#C2DAE2",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000000ff",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chooseFromListText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000ff",
    fontFamily: "Playfair Display Regular",
  },
  content: {
    padding: 20,
  },
  mealName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 20,
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  detailItem: {
    alignItems: "center",
  },
  detailIcon: {
    width: 24,
    height: 24,
    tintColor: "#000000",
    marginBottom: 8,
  },
  detailText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular",
  },
  sectionSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular",
  },
  ingredientItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingLeft: 8,
  },
  ingredientText: {
    fontSize: 16,
    color: "#212529",
    flex: 1,
    fontFamily: "Playfair Display Regular",
    lineHeight: 22,
  },
  instructionItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingLeft: 8,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6A9AA9",
    marginRight: 12,
    fontFamily: "Playfair Display Regular",
    minWidth: 24,
  },
  instructionText: {
    fontSize: 16,
    color: "#000000ff",
    flex: 1,
    fontFamily: "Playfair Display Regular",
    lineHeight: 22,
  },
  feedbackMessage: {
    backgroundColor: "#F8F9FA",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#9BDF11",
    alignItems: "center",
  },
  feedbackText: {
    fontSize: 14,
    color: "#000000ff",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 12,
  },
  resetButton: {
    backgroundColor: "#6A9AA9",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 12,
    color: "white",
    fontFamily: "Playfair Display Regular",
  },
  likeSection: {
    alignItems: "center",
    marginBottom: 30,
    padding: 20,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
  },
  likeQuestion: {
    fontSize: 16,
    color: "#212529",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  likeButtonsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 120,
    justifyContent: "center",
  },
  likeButtonActive: {
    backgroundColor: "#9BDF11",
  },
  dislikeButton: {
    backgroundColor: "#DC3545",
  },
  likeIcon: {
    width: 20,
    height: 20,
    tintColor: "#000000",
    marginRight: 8,
  },
  likeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
  },
});