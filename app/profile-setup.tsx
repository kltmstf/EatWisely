import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
// ⭐️ Импортируем authService вместо заглушки useAuthInfo и userService (для auth info)
import { authService } from "../app/services/authService"; 
import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ⭐️ НОВЫЙ ИМПОРТ: Импортируем наш сервис для работы с пользователями и БД
// Предполагаем, что этот сервис будет отвечать за сохранение данных профиля (saveProfileToFirestore)
import { userService } from "../app/services/userService";

// --- ТИПЫ ДАННЫХ ---

// 💡 НОВЫЙ ТИП: Соответствует данным, которые компонент ProfileSetup собирает
// Поля gender, goal, activity, nutritionType теперь будут использоваться для 
// расчета КБЖУ, которые сохранит userService.
export type LocalProfileData = {
  name: string;
  email: string; // Email пользователя
  description: string;
  age: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  // Мы используем nutritionType в UI, но в БД он сохраняется как dietType. 
  // userService должен это преобразовать или принять 'nutritionType'.
  nutritionType: string; 
  customNutritionType: string;
  allergies: string;
  dislikes: string; // Соответствует excludedIngredients в БД
  isPrivate: boolean; // Соответствует isProfilePrivate в БД
  cookingTimeLimit: string;
  isProfileFilled: boolean;
};

// Тип для выбранных опций, которые требуют немедленного обновления UI
type SelectedOptions = Pick<
  LocalProfileData,
  "gender" | "goal" | "activity" | "nutritionType" | "cookingTimeLimit"
>;

const PROFILE_STORAGE_KEY = "user_profile_data";

// ✅ ОБНОВЛЕННЫЙ ХУК: Для получения реальных данных аутентификации из authService
const useAuthInfo = () => {
  const [authData, setAuthData] = useState<{ name: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAuthData = () => {
      // ⭐️ ИСПОЛЬЗУЕМ authService
      const user = authService.getCurrentUser();

      if (user) {
        // Устанавливаем данные из объекта Firebase User
        setAuthData({
          // Берем displayName из Auth, если он есть, иначе берем email или пустую строку
          name: user.displayName || user.email?.split('@')[0] || "Пользователь",
          email: user.email || "email_not_found@example.com",
        });
      } else {
        // Если пользователя нет, это может быть ошибка или переход до логина
        setAuthData({ name: "", email: "" });
      }
      setIsLoading(false);
    };

    // Слушатель Firebase Auth state (обеспечивает получение данных после логина)
    const unsubscribe = authService.onAuthStateChange(user => {
        if (user) {
            fetchAuthData();
        } else {
            setAuthData({ name: "", email: "" });
            setIsLoading(false);
        }
    });
    
    // Также пробуем загрузить сразу
    fetchAuthData();
    
    return () => unsubscribe();
  }, []);

  return {
    name: authData?.name || "",
    email: authData?.email || "",
    isLoading: isLoading,
  };
};

export default function ProfileSetup() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  // Получаем реальные данные аутентификации пользователя
  const { name: authName, email: authEmail, isLoading: isAuthLoading } = useAuthInfo();

  // useRef для основных данных
  const profileDataRef = useRef<LocalProfileData>({
    // ✅ ИНИЦИАЛИЗИРУЕМ ДАННЫМИ ИЗ AUTH (пока пустые, будут заполнены в useEffect)
    name: "",
    email: "",
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
    cookingTimeLimit: "60",
    isProfileFilled: false,
  });

  // ⭐️ ДОБАВЛЕНИЕ useEffect для синхронизации authName/authEmail
  useEffect(() => {
    if (!isAuthLoading) {
        // Устанавливаем имя и email из Auth в Ref, только если они пустые
        if (profileDataRef.current.name === "") {
            profileDataRef.current.name = authName;
        }
        if (profileDataRef.current.email === "") {
            profileDataRef.current.email = authEmail;
        }
    }
  }, [isAuthLoading, authName, authEmail]);


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

  const cookingTimes = ["15 минут", "30 минут", "45 минут", "60+ минут"];
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
   * @param isFilled - true, если пользователь нажал "Завершить".
   */
  const saveProfileData = async (isFilled: boolean) => {
    try {
      const currentSelectedType = selectedOptions.nutritionType;
      const customValue = customNutritionRef.current;

      // 1. Финальная корректировка Ref перед сохранением
      if (currentSelectedType === "Другое" && customValue.trim()) {
        profileDataRef.current.customNutritionType = customValue.trim();
        profileDataRef.current.nutritionType = "Другое";
      } else if (currentSelectedType === "Другое" && !customValue.trim()) {
        profileDataRef.current.customNutritionType = "";
        profileDataRef.current.nutritionType = "Другое";
      } else {
        profileDataRef.current.customNutritionType = "";
        profileDataRef.current.nutritionType = currentSelectedType;
      }
      
      profileDataRef.current.isProfileFilled = isFilled;

      // 2. ЛОКАЛЬНОЕ СОХРАНЕНИЕ
      await AsyncStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify(profileDataRef.current)
      );

      // 3. ⭐️ СОХРАНЕНИЕ В FIREBASE через userService
      // userService.saveProfileToFirestore должен принять LocalProfileData 
      // и правильно сопоставить поля с FirestoreProfile (например, nutritionType -> dietType)
      await userService.saveProfileToFirestore(profileDataRef.current);

      return true;
    } catch (error) {
      console.error("Error saving profile data:", error);
      Alert.alert(
        "Ошибка сохранения",
        "Не удалось сохранить данные профиля в облаке."
      );
      return false;
    }
  };

  /** * Обновляет данные в useRef и при необходимости обновляет состояние для перерисовки UI. */
  const updateProfileData = useCallback(
    <K extends keyof LocalProfileData>(field: K, value: LocalProfileData[K]) => {
      profileDataRef.current[field] = value;

      // Обновляем состояние, если поле входит в SelectedOptions
      if (field in selectedOptions) {
        setSelectedOptions((prev) => ({
          ...prev,
          [field]: value as SelectedOptions[keyof SelectedOptions],
        }));

        // Логика для типа питания: управление customNutritionRef и общим nutritionType
        if (field === "nutritionType") {
          if (value !== "Другое") {
            customNutritionRef.current = "";
            profileDataRef.current.customNutritionType = "";
          }
          // profileDataRef.current.nutritionType уже обновлен выше
        }
      }
    },
    [selectedOptions]
  );

  const handleNext = async () => {
    Keyboard.dismiss();

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

    // Финальная синхронизация Ref перед переходом/завершением (для "Другое" на последнем шаге)
    if (currentStep === steps.length - 1) {
        const customValue = customNutritionRef.current;
        // Обновляем Ref перед сохранением
        if (selectedOptions.nutritionType === "Другое" && customValue.trim()) {
            profileDataRef.current.customNutritionType = customValue.trim();
        } else if (selectedOptions.nutritionType === "Другое") {
             profileDataRef.current.customNutritionType = "";
        }
    }


    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
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

  const progress = useMemo(
    () => ((currentStep + 1) / steps.length) * 100,
    [currentStep, steps.length]
  );

  // Мемоизированные компоненты шагов
  const Step1 = useCallback(() => {
    const data = profileDataRef.current;
    
    // ⭐️ ИСПОЛЬЗУЕМ ЗНАЧЕНИЯ ИЗ AUTH/REF
    const currentName = data.name || authName;
    const currentEmail = data.email || authEmail;

    return (
      <View style={styles.stepContent}>
        {isAuthLoading ? (
            <ActivityIndicator size="large" color="#6A9AA9" style={{ marginBottom: 32 }} />
        ) : (
          <View style={styles.photoContainer}>
            <View style={styles.placeholderPhoto}>
              <Ionicons name="person" size={60} color="#6A9AA9" />
            </View>
            <TouchableOpacity style={styles.editPhotoButton}>
              <Ionicons name="pencil" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
        
        {/* Поля Имя и Email - Только для чтения */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Имя</Text>
          <TextInput
            style={[styles.input, styles.readOnlyInput]}
            // ✅ ИСПОЛЬЗУЕМ ЗНАЧЕНИЕ ИЗ AUTH
            value={currentName || "Не указано"}
            editable={false} 
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.readOnlyInput]}
            // ✅ ИСПОЛЬЗУЕМ ЗНАЧЕНИЕ ИЗ AUTH
            value={currentEmail || "Не указано"}
            editable={false} 
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
  }, [updateProfileData, authName, authEmail, isAuthLoading]);

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
              defaultValue={customNutritionRef.current}
              onChangeText={(text) => (customNutritionRef.current = text)}
              placeholder="Например, Палео, Безглютеновое..."
              placeholderTextColor="#999"
            />
          </View>
        )}

        {/* Максимальное время готовки */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Максимальное время готовки</Text>
          <View style={styles.cookingTimeOptions}>
            {cookingTimes.map((time, index) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.cookingTimeButton,
                  styles.optionButton,
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
            placeholder="оставьте пустым, если аллергии отсутствуют"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Не любимые продукты</Text>
          <TextInput
            style={styles.input}
            defaultValue={data.dislikes}
            onChangeText={(text) => updateProfileData("dislikes", text)}
            placeholder="оставьте пустым, если нет явных исключений"
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
  ]);

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

          {/* ❌ ЗАГЛУШКА ДЛЯ СИММЕТРИИ (заменяет кнопку "Пропустить") */}
          <TouchableOpacity
            style={[styles.backButton, { opacity: 0 }]}
            disabled={true}
          >
            {/* Пустая иконка, чтобы занять место */}
            <Ionicons name="arrow-back" size={24} color="#000" />
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
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} disabled={isAuthLoading}>
          {isAuthLoading ? (
             <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
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
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- СТИЛИ ---
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
    backgroundColor: "#F3F4F6", 
    borderColor: "#D1D5DB", 
    color: "#6B7280", 
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

  cookingTimeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  cookingTimeButton: {
    flex: 1,
    minWidth: "45%",
    maxWidth: "48%",
    paddingVertical: 12,
  },
});