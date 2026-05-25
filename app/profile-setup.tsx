import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
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
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { userService, calculateAgeFromBirthYear } from "../app/services/userService";
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- ТИПЫ ДАННЫХ ---

export type LocalProfileData = {
  name: string;
  email: string;
  description: string;
  age: string;
  birthYear: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  nutritionType: string;
  customNutritionType: string;
  allergies: string;
  dislikes: string;
  isPrivate: boolean;
  cookingTimeLimit: string;
  isProfileFilled: boolean;
  photoURL?: string;
  cloudinaryPublicId?: string;
};

// Тип для выбранных опций
type SelectedOptions = Pick<
  LocalProfileData,
  "gender" | "goal" | "activity" | "nutritionType" | "cookingTimeLimit"
>;

const PROFILE_STORAGE_KEY = "user_profile_data";

// ✅ ОБНОВЛЕННЫЙ ХУК: Для получения реальных данных аутентификации
const useAuthInfo = () => {
  const [authData, setAuthData] = useState<{ 
    name: string; 
    email: string;
    photoURL?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAuthData = () => {
      const user = authService.getCurrentUser();

      if (user) {
        setAuthData({
          name: user.displayName || user.email?.split('@')[0] || "Пользователь",
          email: user.email || "email_not_found@example.com",
          photoURL: user.photoURL || undefined,
        });
      } else {
        setAuthData({ name: "", email: "" });
      }
      setIsLoading(false);
    };

    const unsubscribe = authService.onAuthStateChange(user => {
        if (user) {
            fetchAuthData();
        } else {
            setAuthData({ name: "", email: "" });
            setIsLoading(false);
        }
    });
    
    fetchAuthData();
    
    return () => unsubscribe();
  }, []);

  return {
    name: authData?.name || "",
    email: authData?.email || "",
    photoURL: authData?.photoURL || "",
    isLoading: isLoading,
  };
};

export default function ProfileSetup() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(false);
  
  // Состояния для DatePicker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Получаем реальные данные аутентификации пользователя
  const { 
    name: authName, 
    email: authEmail, 
    photoURL: authPhotoURL,
    isLoading: isAuthLoading 
  } = useAuthInfo();

  // useRef для основных данных
  const profileDataRef = useRef<LocalProfileData>({
    name: "",
    email: "",
    photoURL: "",
    customNutritionType: "",
    description: "",
    age: "",
    birthYear: "",
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
    cloudinaryPublicId: "",
  });

  // Состояние для отображения фото
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Функция для обновления года рождения и автоматического расчета возраста
  const updateBirthYear = (birthYear: string) => {
    profileDataRef.current.birthYear = birthYear;
    const age = calculateAgeFromBirthYear(birthYear);
    profileDataRef.current.age = age;
    setForceUpdate(prev => !prev);
  };

  // Обработчик выбора даты
  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setSelectedDate(selectedDate);
      const year = selectedDate.getFullYear().toString();
      updateBirthYear(year);
    }
  };

  // ⭐️ useEffect для синхронизации auth данных
  useEffect(() => {
    if (!isAuthLoading) {
        if (profileDataRef.current.name === "") {
            profileDataRef.current.name = authName;
        }
        if (profileDataRef.current.email === "") {
            profileDataRef.current.email = authEmail;
        }
        if (profileDataRef.current.photoURL === "" && authPhotoURL) {
            profileDataRef.current.photoURL = authPhotoURL;
            setProfilePhoto(authPhotoURL);
        }
    }
  }, [isAuthLoading, authName, authEmail, authPhotoURL]);

  // useRef для пользовательского ввода "Другое"
  const customNutritionRef = useRef("");

  // useState для опций
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({
    gender: "Муж",
    goal: "Поддержание веса",
    activity: "Низкий (0-1 тренировка в неделю)",
    nutritionType: "Обычное",
    cookingTimeLimit: "60",
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
   * Сохраняет данные профиля в AsyncStorage и Firestore
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

      // 3. СОХРАНЕНИЕ В FIREBASE через userService
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

  /**
   * Запрашивает разрешения для камеры и галереи
   */
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        "Нужны разрешения",
        "Для загрузки фото нужно разрешение на доступ к камере и галерее."
      );
      return false;
    }
    return true;
  };

  /**
   * Выбор фото из галереи
   */
  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать фото');
    }
  };

  /**
   * Сделать фото
   */
  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await uploadProfilePhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Ошибка', 'Не удалось сделать фото');
    }
  };

  /**
   * Загрузка фото в Cloudinary
   */
  const uploadProfilePhoto = async (imageUri: string) => {
    const user = authService.getCurrentUser();
    if (!user?.uid) {
      Alert.alert("Ошибка", "Пользователь не авторизован");
      return;
    }
    
    setIsUploadingPhoto(true);
    
    try {
      console.log("Starting photo upload to Cloudinary from ProfileSetup...");
      
      const result = await userService.uploadProfilePhoto(imageUri, user.uid);
      
      if (result.success && result.url) {
        setProfilePhoto(result.url);
        profileDataRef.current.photoURL = result.url;
        profileDataRef.current.cloudinaryPublicId = result.publicId;
        
        console.log("Photo uploaded successfully from ProfileSetup");
      } else {
        Alert.alert("Ошибка", result.error || "Не удалось загрузить фото");
      }
    } catch (error: any) {
      console.error("Error uploading photo from ProfileSetup:", error);
      Alert.alert("Ошибка", error.message || "Не удалось загрузить фото");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  /**
   * Обработчик смены фото
   */
  const handleChangePhoto = () => {
    if (isUploadingPhoto) {
      Alert.alert("Загрузка", "Пожалуйста, подождите, фото загружается...");
      return;
    }

    Alert.alert(
      "Сменить фото профиля",
      "Выберите способ",
      [
        {
          text: "Сделать фото",
          onPress: takePhoto
        },
        {
          text: "Выбрать из галереи",
          onPress: pickImage
        },
        {
          text: "Отмена",
          style: "cancel"
        }
      ]
    );
  };

  /** * Обновляет данные в useRef */
  const updateProfileData = useCallback(
    <K extends keyof LocalProfileData>(field: K, value: LocalProfileData[K]) => {
      profileDataRef.current[field] = value;

      if (field in selectedOptions) {
        setSelectedOptions((prev) => ({
          ...prev,
          [field]: value as SelectedOptions[keyof SelectedOptions],
        }));

        if (field === "nutritionType") {
          if (value !== "Другое") {
            customNutritionRef.current = "";
            profileDataRef.current.customNutritionType = "";
          }
        }
      }
    },
    [selectedOptions]
  );

  const handleNext = async () => {
    Keyboard.dismiss();

    if (currentStep === 1) {
      const { birthYear, height, weight } = profileDataRef.current;
      if (!birthYear.trim() || !height.trim() || !weight.trim()) {
        Alert.alert(
          "Внимание",
          "Пожалуйста, заполните поля Год рождения, Рост и Вес."
        );
        return;
      }
    }

    // Финальная синхронизация Ref перед переходом/завершением
    if (currentStep === steps.length - 1) {
        const customValue = customNutritionRef.current;
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

  // Вспомогательная функция для склонения слова "год"
  const getAgeWord = (age: number): string => {
    const lastDigit = age % 10;
    const lastTwoDigits = age % 100;
    
    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return "лет";
    }
    
    switch (lastDigit) {
      case 1: return "год";
      case 2:
      case 3:
      case 4: return "года";
      default: return "лет";
    }
  };

  // Мемоизированные компоненты шагов
  const Step1 = useCallback(() => {
    const data = profileDataRef.current;
    
    const currentName = data.name || authName;
    const currentEmail = data.email || authEmail;
    const currentPhoto = profilePhoto || data.photoURL || authPhotoURL;

    return (
      <View style={styles.stepContent}>
        {isAuthLoading ? (
            <ActivityIndicator size="large" color="#6A9AA9" style={{ marginBottom: 32 }} />
        ) : (
          <View style={styles.photoContainer}>
            {isUploadingPhoto ? (
              <View style={[styles.photoWrapper, styles.uploadingPhoto]}>
                <ActivityIndicator size="large" color="#6A9AA9" />
              </View>
            ) : currentPhoto ? (
              <View style={styles.photoWrapper}>
                <Image
                  source={{ uri: currentPhoto }}
                  style={styles.profilePhotoImage}
                />
              </View>
            ) : (
              <View style={styles.placeholderPhoto}>
                <Ionicons name="person" size={60} color="#6A9AA9" />
              </View>
            )}
            <TouchableOpacity 
              style={styles.editPhotoButton}
              onPress={handleChangePhoto}
              disabled={isUploadingPhoto}
            >
              <Ionicons 
                name="camera" 
                size={16} 
                color="#FFF" 
              />
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Имя</Text>
          <TextInput
            style={[styles.input, styles.readOnlyInput]}
            value={currentName || "Не указано"}
            editable={false} 
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.readOnlyInput]}
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
  }, [updateProfileData, authName, authEmail, authPhotoURL, isAuthLoading, profilePhoto, isUploadingPhoto, handleChangePhoto]);

  const Step2 = useCallback(() => {
    const data = profileDataRef.current;
    const { gender } = selectedOptions;
    
    const calculatedAge = data.age ? `${data.age} ${getAgeWord(parseInt(data.age, 10))}` : "не указан";
    
    return (
      <View style={styles.stepContent}>
        <View style={styles.dataGrid}>
          
          {/* Год рождения с DatePicker */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Год рождения</Text>
            <TouchableOpacity 
              style={styles.datePickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={data.birthYear ? styles.dateText : styles.placeholderDateText}>
                {data.birthYear ? `${data.birthYear} год` : "Выберите год рождения"}
              </Text>
              <Ionicons name="chevron-down" size={20} color="#6A9AA9" />
            </TouchableOpacity>
            
            {showDatePicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)}
              />
            )}
          </View>

          {/* Нередактируемое поле возраста */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Возраст (рассчитывается автоматически)</Text>
            <View style={styles.ageDisplayContainer}>
              <Text style={styles.ageDisplayText}>{calculatedAge}</Text>
            </View>
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
  }, [updateProfileData, genders, selectedOptions.gender, forceUpdate, showDatePicker, selectedDate, onDateChange]);

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
      <SafeAreaView style={styles.safeAreaHeader}>
        <View style={styles.headerContent}>
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

          <TouchableOpacity
            style={[styles.backButton, { opacity: 0 }]}
            disabled={true}
          >
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

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

      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.nextButton} 
          onPress={handleNext} 
          disabled={isAuthLoading || isUploadingPhoto}
        >
          {isAuthLoading || isUploadingPhoto ? (
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
  photoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    overflow: 'hidden',
    backgroundColor: "#E1F0F5",
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
  profilePhotoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  uploadingPhoto: {
    backgroundColor: "#F0F9FF",
    borderStyle: "dashed",
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
  datePickerButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateText: {
    fontSize: 16,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
  },
  placeholderDateText: {
    fontSize: 16,
    color: "#999",
    fontFamily: "Playfair Display Regular",
  },
  ageDisplayContainer: {
    backgroundColor: "#F3F4F6",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ageDisplayText: {
    fontSize: 16,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Bold",
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