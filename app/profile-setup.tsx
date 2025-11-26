import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ⭐️ НОВЫЙ ИМПОРТ: Импортируем наш сервис для работы с пользователями и БД
import { userService } from "../app/services/userService";

// --- ТИПЫ ДАННЫХ ---
export type ProfileData = {
  name: string;
  description: string;
  email: string; // Email пользователя
  customNutritionType: string;
  age: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  nutritionType: string;
  allergies: string;
  dislikes: string; // Соответствует excludedIngredients в БД
  isPrivate: boolean; // Соответствует isProfilePrivate в БД
  // НОВОЕ ПОЛЕ: Максимальное время готовки (в минутах)
  cookingTimeLimit: string;
  // НОВОЕ ПОЛЕ: Статус заполнения профиля
  isProfileFilled: boolean;
};

// Тип для выбранных опций, которые требуют немедленного обновления UI
type SelectedOptions = Pick<
  ProfileData,
  "gender" | "goal" | "activity" | "nutritionType" | "cookingTimeLimit"
>;

const PROFILE_STORAGE_KEY = "user_profile_data";

// 💡 Заглушка для получения данных аутентификации.
// В реальном приложении это должен быть контекст или хук useAuth.
const useAuthInfo = () => {
  // TODO: Замените на реальный код, получающий имя и email из Firebase Auth
  const userDisplayName = "Ваше Имя";
  const userEmail = "auth.user@example.com";
  return { name: userDisplayName, email: userEmail };
};

export default function ProfileSetup() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  // Получаем данные аутентификации пользователя для полей name и email
  const { name: authName, email: authEmail } = useAuthInfo();

  // useRef для основных данных
  const profileDataRef = useRef<ProfileData>({
    // ✅ ИСПРАВЛЕНО: Добавлены name, email и customNutritionType для соответствия типу ProfileData
    name: authName, // Заполняется из Auth
    email: authEmail, // Заполняется из Auth
    customNutritionType: "",
    // ------------------------------------------------------------------------
    description: "",
    age: "",
    height: "",
    gender: "Муж",
    weight: "",
    goal: "Поддержание веса",
    activity: "Низкий (0-1 тренировка в неделю)",
    nutritionType: "Обычное",
    allergies: "",
    dislikes: "",
    isPrivate: false,
    // НОВОЕ: Значение по умолчанию "60" минут
    cookingTimeLimit: "60",
    // НОВОЕ: Изначально профиль не заполнен
    isProfileFilled: false,
  });

  // useRef для пользовательского ввода "Другое"
  const customNutritionRef = useRef("");

  // useState для опций, чтобы обеспечить мгновенное визуальное обновление выбора
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({
    gender: "Муж",
    goal: "Поддержание веса",
    activity: "Низкий (0-1 тренировка в неделю)",
    nutritionType: "Обычное",
    cookingTimeLimit: "60", // ЗНАЧЕНИЕ ПО УМОЛЧАНИЮ
  });

  const goals = ["Похудение", "Поддержание веса", "Набор веса"];
  const activityLevels = [
    "Низкий (0-1 тренировка в неделю)",
    "Умеренный (2-3 тренировки в неделю)",
    "Интенсивный (3 и более тренировки в неделю)",
  ];
  const nutritionTypes = ["Обычное", "Вегетарианское", "Веганское", "Другое"];
  const genders = ["Муж", "Жен"];

  // ⭐️ НОВЫЙ МАССИВ: Диапазоны времени готовки
  const cookingTimes = ["15 минут", "30 минут", "45 минут", "60+ минут"];
  // Значения для сохранения в БД (соответствуют порядку в cookingTimes)
  const cookingTimeValues = ["15", "30", "45", "60+"];

  const steps = [
    { title: "Основная информация", description: "Расскажите немного о себе" },
    {
      title: "Физические данные",
      description: "Помогите нам лучше понять ваши потребности",
    },
    { title: "Цели и активность", description: "Что вы хотите достичь?" },
    {
      title: "Питание",
      description:
        "Ваши предпочтения в еде. Оставьте поля пустыми, если нет ограничений.",
    },
  ];

  /**
   * Сохраняет данные профиля в AsyncStorage и устанавливает статус заполнения.
   * @param isFilled - true, если пользователь нажал "Завершить", false, если "Пропустить".
   */
  const saveProfileData = async (isFilled: boolean) => {
    try {
      const currentSelectedType = selectedOptions.nutritionType; // Используем selectedOptions для актуального типа
      const customValue = customNutritionRef.current;

      // ⭐️ ВАЖНО: Устанавливаем name и email в ref перед сохранением (если они были получены после инициализации)
      // В данном случае, они уже установлены из useAuthInfo при инициализации.
      // Финальная корректировка Ref перед сохранением
      if (currentSelectedType === "Другое" && customValue.trim()) {
        profileDataRef.current.nutritionType = `Другое: ${customValue.trim()}`;
      } else if (currentSelectedType === "Другое" && !customValue.trim()) {
        profileDataRef.current.nutritionType = "Другое";
      }
      // Сохраняем пользовательское значение в отдельное поле для возможности редактирования
      profileDataRef.current.customNutritionType = customValue.trim();

      // НОВОЕ: Устанавливаем статус заполнения профиля
      profileDataRef.current.isProfileFilled = isFilled;

      // 1. ЛОКАЛЬНОЕ СОХРАНЕНИЕ
      await AsyncStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify(profileDataRef.current)
      );

      // 2. ⭐️ СОХРАНЕНИЕ В FIREBASE (ВКЛЮЧАЯ РАСЧЕТ КБЖУ)
      // profileDataRef.current имеет тип LocalProfileData, который ожидает userService
      await userService.saveProfileToFirestore(profileDataRef.current);
      // Если здесь возникнет ошибка, она будет перехвачена блоком catch

      return true;
    } catch (error) {
      console.error("Error saving profile data:", error);
      // Сообщаем об ошибке сохранения, особенно если это ошибка Firestore
      Alert.alert(
        "Ошибка сохранения",
        "Не удалось сохранить данные профиля в облаке."
      );
      return false;
    }
  };

  /** * Обновляет данные в useRef и при необходимости обновляет состояние для перерисовки UI.
   * */
  const updateProfileData = useCallback(
    <K extends keyof ProfileData>(field: K, value: ProfileData[K]) => {
      profileDataRef.current[field] = value;

      // Обновляем состояние, если поле входит в SelectedOptions
      if (field in selectedOptions) {
        setSelectedOptions((prev) => ({
          ...prev,
          [field]: value as SelectedOptions[keyof SelectedOptions],
        }));

        // Логика для типа питания: управление customNutritionRef
        if (field === "nutritionType") {
          if (value !== "Другое") {
            // Если выбран стандартный тип, очищаем Ref и main nutritionType
            customNutritionRef.current = "";
            profileDataRef.current.nutritionType = value as string;
            // Очищаем и поле в Ref
            profileDataRef.current.customNutritionType = "";
          } else {
            profileDataRef.current.nutritionType = "Другое";
          }
        }
      }
    },
    [selectedOptions]
  );

  const handleNext = async () => {
    Keyboard.dismiss();

    // 🌟 Валидация: проверяем, что Возраст, Рост, Вес заполнены на Шаге 2 (currentStep === 1)
    if (currentStep === 1) {
      const { age, height, weight } = profileDataRef.current;
      if (!age.trim() || !height.trim() || !weight.trim()) {
        Alert.alert(
          "Внимание",
          "Пожалуйста, заполните поля Возраст, Рост и Вес."
        );
        return;
      }
    }

    // Финальная синхронизация Ref перед переходом/завершением (для "Другое")
    if (
      currentStep === steps.length - 1 &&
      selectedOptions.nutritionType === "Другое"
    ) {
      const customValue = customNutritionRef.current;
      // Если пользователь выбрал "Другое", но ничего не ввел, оставляем просто "Другое"
      if (customValue.trim()) {
        profileDataRef.current.nutritionType = `Другое: ${customValue.trim()}`;
        profileDataRef.current.customNutritionType = customValue.trim();
      } else {
        profileDataRef.current.nutritionType = "Другое";
        profileDataRef.current.customNutritionType = "";
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // На последнем шаге профиль считается заполненным
      const success = await saveProfileData(true);
      if (success) {
        await AsyncStorage.setItem("profile_setup_complete", "true");
        router.replace("/home");
      } else {
        Alert.alert("Ошибка", "Не удалось завершить настройку профиля.");
      }
    }
  };

  const handleBack = () => {
    Keyboard.dismiss();
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    Keyboard.dismiss();
    // При пропуске профиль считается НЕ заполненным, но данные сохраняются
    const success = await saveProfileData(false);
    if (success) {
      await AsyncStorage.setItem("profile_setup_complete", "true");
      router.replace("/home");
    }
  };

  const progress = useMemo(
    () => ((currentStep + 1) / steps.length) * 100,
    [currentStep, steps.length]
  );

  // Мемоизированные компоненты шагов
  const Step1 = useCallback(() => {
    const data = profileDataRef.current;
    return (
      <View style={styles.stepContent}>
        <View style={styles.photoContainer}>
          <View style={styles.placeholderPhoto}>
            <Ionicons name="person" size={60} color="#6A9AA9" />
          </View>
          <TouchableOpacity style={styles.editPhotoButton}>
            <Ionicons name="pencil" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
        {/* Поля Имя и Email - Только для чтения или скрыты */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Имя</Text>
          <TextInput
            style={[styles.input, styles.readOnlyInput]}
            value={data.name || "Не указано (из Auth)"}
            editable={false} // Нельзя редактировать на этом экране
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.readOnlyInput]}
            value={data.email || "Не указано (из Auth)"}
            editable={false} // Нельзя редактировать на этом экране
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>О себе</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            defaultValue={data.description}
            onChangeText={(text) => updateProfileData("description", text)}
            placeholder="Расскажите о своих целях, интересах..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </View>
    );
  }, [updateProfileData]);

  const Step2 = useCallback(() => {
    const data = profileDataRef.current;
    const { gender } = selectedOptions;
    return (
      <View style={styles.stepContent}>
        <View style={styles.dataGrid}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Возраст</Text>
            <TextInput
              style={styles.input}
              defaultValue={data.age}
              onChangeText={(text) => updateProfileData("age", text)}
              placeholder="лет"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Рост</Text>
            <TextInput
              style={styles.input}
              defaultValue={data.height}
              onChangeText={(text) => updateProfileData("height", text)}
              placeholder="см"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Вес</Text>
            <TextInput
              style={styles.input}
              defaultValue={data.weight}
              onChangeText={(text) => updateProfileData("weight", text)}
              placeholder="кг"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Пол</Text>
            <View style={styles.genderContainer}>
              {genders.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.genderButton,
                    gender === g && styles.genderButtonActive,
                  ]}
                  onPress={() => updateProfileData("gender", g)}
                >
                  <Text
                    style={[
                      styles.genderText,
                      gender === g && styles.genderTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }, [updateProfileData, genders, selectedOptions.gender]);

  const Step3 = useCallback(() => {
    const { goal, activity } = selectedOptions;
    return (
      <View style={styles.stepContent}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ваша цель</Text>
          <View style={styles.optionsContainer}>
            {goals.map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.optionButton,
                  goal === g && styles.optionButtonActive,
                ]}
                onPress={() => updateProfileData("goal", g)}
              >
                <Text
                  style={[
                    styles.optionText,
                    goal === g && styles.optionTextActive,
                  ]}
                >
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Уровень активности</Text>
          <View style={styles.optionsContainer}>
            {activityLevels.map((a) => (
              <TouchableOpacity
                key={a}
                style={[
                  styles.optionButton,
                  activity === a && styles.optionButtonActive,
                ]}
                onPress={() => updateProfileData("activity", a)}
              >
                <Text
                  style={[
                    styles.optionText,
                    activity === a && styles.optionTextActive,
                  ]}
                >
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  }, [
    updateProfileData,
    goals,
    activityLevels,
    selectedOptions.goal,
    selectedOptions.activity,
  ]);

  const Step4 = useCallback(() => {
    const data = profileDataRef.current;
    const { nutritionType, cookingTimeLimit } = selectedOptions;

    const isCustomNutrition = nutritionType === "Другое";

    const isButtonActive = (type: string) => {
      return nutritionType === type;
    };

    // ⭐️ НОВАЯ ЛОГИКА АКТИВНОСТИ КНОПОК ВРЕМЕНИ
    const isTimeButtonActive = (value: string) => {
      return cookingTimeLimit === value;
    };

    return (
      <View style={styles.stepContent}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Тип питания</Text>
          <View style={styles.optionsContainer}>
            {nutritionTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionButton,
                  isButtonActive(type) && styles.optionButtonActive,
                ]}
                onPress={() => {
                  updateProfileData("nutritionType", type);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    isButtonActive(type) && styles.optionTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Поле для ввода пользовательского типа питания: НЕКОНТРОЛИРУЕМЫЙ КОМПОНЕНТ */}
        {isCustomNutrition && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Укажите свой тип питания</Text>
            <TextInput
              key="customNutritionInputKey"
              style={styles.input}
              // Используем defaultValue из Ref для инициализации
              defaultValue={customNutritionRef.current}
              // Обновляем Ref, что НЕ вызывает рендеринг
              onChangeText={(text) => (customNutritionRef.current = text)}
              placeholder="Например, Палео, Безглютеновое..."
              placeholderTextColor="#999"
            />
          </View>
        )}

        {/* ⭐️ ОБНОВЛЕННЫЙ РАЗДЕЛ: Максимальное время готовки (КНОПКИ) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Максимальное время готовки</Text>
          <View style={styles.cookingTimeOptions}>
            {cookingTimes.map((time, index) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.cookingTimeButton, // Используем собственный стиль для гибкого отображения
                  styles.optionButton, // Базовый стиль для внешнего вида
                  isTimeButtonActive(cookingTimeValues[index]) &&
                    styles.optionButtonActive,
                ]}
                onPress={() =>
                  updateProfileData(
                    "cookingTimeLimit",
                    cookingTimeValues[index]
                  )
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    isTimeButtonActive(cookingTimeValues[index]) &&
                      styles.optionTextActive,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Аллергии</Text>
          <TextInput
            style={styles.input}
            defaultValue={data.allergies}
            onChangeText={(text) => updateProfileData("allergies", text)}
            placeholder="орехи, цитрусы, молоко или оставьте пустым, если аллергии отсутствуют"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Не любимые продукты</Text>
          <TextInput
            style={styles.input}
            defaultValue={data.dislikes}
            onChangeText={(text) => updateProfileData("dislikes", text)}
            placeholder="грибы, брокколи, рыба или оставьте пустым, если нет явных исключений"
            placeholderTextColor="#999"
          />
        </View>
      </View>
    );
  }, [
    updateProfileData,
    nutritionTypes,
    selectedOptions.nutritionType,
    selectedOptions.cookingTimeLimit,
  ]); // ДОБАВИЛИ selectedOptions.cookingTimeLimit в зависимости

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return <Step1 />;
      case 1:
        return <Step2 />;
      case 2:
        return <Step3 />;
      case 3:
        return <Step4 />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <SafeAreaView style={styles.safeAreaHeader}>
        <View style={styles.headerContent}>
          {/* Кнопка "Назад" - Скрыта/отключена на первом шаге */}
          <TouchableOpacity
            style={[styles.backButton, currentStep === 0 && { opacity: 0 }]}
            onPress={handleBack}
            disabled={currentStep === 0}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {currentStep + 1} из {steps.length}
            </Text>
          </View>

          {/* Кнопка "Пропустить" - текст изменен */}
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Я заполню позже</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Контент */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
          <Text style={styles.stepDescription}>
            {steps[currentStep].description}
          </Text>
          <View key={`step-${currentStep}`}>{renderCurrentStep()}</View>
        </View>
      </ScrollView>

      {/* Кнопка продолжения */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentStep === steps.length - 1 ? "Завершить" : "Далее"}
          </Text>
          <Ionicons
            name={
              currentStep === steps.length - 1 ? "checkmark" : "arrow-forward"
            }
            size={20}
            color="#000"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- СТИЛИ (добавлен только один новый, чтобы кнопки времени были в ряд) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  safeAreaHeader: {
    backgroundColor: "#C2DAE2",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginTop: Platform.OS === "android" ? 30 : 0,
  },
  backButton: {
    padding: 5,
  },
  progressContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 15,
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#9BDF11",
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: "#000000",
    marginTop: 4,
    fontFamily: "Playfair Display Regular",
  },
  skipButton: {
    padding: 5,
  },
  skipText: {
    fontSize: 14,
    color: "#4A7A89",
    fontFamily: "Playfair Display Regular",
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: 20,
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
  },
  stepDescription: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  stepContent: {
    flex: 1,
  },
  photoContainer: {
    alignItems: "center",
    marginBottom: 32,
    position: "relative",
    alignSelf: "center",
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#E1F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6A9AA9",
  },
  editPhotoButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#6A9AA9",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000000",
    marginBottom: 8,
    fontFamily: "Playfair Display Regular",
  },
  input: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
  },
  readOnlyInput: {
    backgroundColor: "#F3F4F6", // Более тусклый фон
    borderColor: "#D1D5DB", // Более тусклый бордер
    color: "#6B7280", // Более тусклый текст
  },
  textArea: {
    height: 120,
    textAlignVertical: "top",
  },
  dataGrid: {
    gap: 16,
  },
  genderContainer: {
    flexDirection: "row",
    gap: 12,
  },
  genderButton: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  genderButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  genderText: {
    fontSize: 16,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    fontWeight: "500",
  },
  genderTextActive: {
    color: "#000000",
    fontWeight: "600",
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  optionButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  optionText: {
    fontSize: 16,
    color: "#000000",
    textAlign: "center",
    fontFamily: "Playfair Display Regular",
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#000000",
    fontWeight: "600",
  },
  footer: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  nextButton: {
    backgroundColor: "#9BDF11",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    marginRight: 8,
  },

  // для расположения кнопок времени в ряд
  cookingTimeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  // для распределения кнопок времени по ширине
  cookingTimeButton: {
    flex: 1, // Позволяет кнопкам равномерно распределиться
    minWidth: "45%", // Убедимся, что помещаются 2 кнопки в ряд на маленьких экранах
    maxWidth: "48%", // Дает небольшой зазор
    paddingVertical: 12, // Делаем кнопку чуть менее высокой, чем основные опции
  },
});
