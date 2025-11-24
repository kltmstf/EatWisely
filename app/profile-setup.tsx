import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
// Импортируем иконки
import { Ionicons } from "@expo/vector-icons";

type ProfileData = {
  description: string;
  age: string;
  height: string;
  gender: string;
  weight: string;
  goal: string;
  activity: string;
  nutritionType: string;
  allergies: string;
  dislikes: string;
  isPrivate: boolean;
};

const PROFILE_STORAGE_KEY = "user_profile_data";

export default function ProfileSetup() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [profileData, setProfileData] = useState<ProfileData>({
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
  });

  const goals = ["Похудение", "Поддержание веса", "Набор веса"];

  const activityLevels = [
    "Низкий (0-1 тренировка в неделю)",
    "Умеренный (2-3 тренировки в неделю)",
    "Интенсивный (3 и более тренировки в неделю)",
  ];

  const nutritionTypes = ["Обычное", "Вегетарианское", "Веганское"];

  const genders = ["Муж", "Жен"];

  const steps = [
    {
      title: "Основная информация",
      description: "Расскажите немного о себе",
    },
    {
      title: "Физические данные",
      description: "Помогите нам лучше понять ваши потребности",
    },
    {
      title: "Цели и активность",
      description: "Что вы хотите достичь?",
    },
    {
      title: "Питание",
      description: "Ваши предпочтения в еде",
    },
  ];

  const saveProfileData = async () => {
    try {
      await AsyncStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify(profileData)
      );
      return true;
    } catch (error) {
      console.error("Error saving profile data:", error);
      return false;
    }
  };

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Завершение настройки профиля
      const success = await saveProfileData();
      if (success) {
        // Помечаем, что профиль настроен
        await AsyncStorage.setItem("profile_setup_complete", "true");
        router.replace("/home");
      } else {
        Alert.alert("Ошибка", "Не удалось сохранить данные профиля");
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleSkip = async () => {
    const success = await saveProfileData();
    if (success) {
      await AsyncStorage.setItem("profile_setup_complete", "true");
      router.replace("/home");
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  // Шаг 1: Основная информация
  const Step1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.photoContainer}>
        {/* Заменили Image на иконку-плейсхолдер */}
        <View style={styles.placeholderPhoto}>
          <Ionicons name="person" size={60} color="#6A9AA9" />
        </View>
        <TouchableOpacity style={styles.editPhotoButton}>
          <Ionicons name="pencil" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>О себе</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={profileData.description}
          onChangeText={(text) =>
            setProfileData({ ...profileData, description: text })
          }
          placeholder="Расскажите о своих целях, интересах..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>
    </View>
  );

  // Шаг 2: Физические данные
  const Step2 = () => (
    <View style={styles.stepContent}>
      <View style={styles.dataGrid}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Возраст</Text>
          <TextInput
            style={styles.input}
            value={profileData.age}
            onChangeText={(text) =>
              setProfileData({ ...profileData, age: text })
            }
            placeholder="лет"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Рост</Text>
          <TextInput
            style={styles.input}
            value={profileData.height}
            onChangeText={(text) =>
              setProfileData({ ...profileData, height: text })
            }
            placeholder="см"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Вес</Text>
          <TextInput
            style={styles.input}
            value={profileData.weight}
            onChangeText={(text) =>
              setProfileData({ ...profileData, weight: text })
            }
            placeholder="кг"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Пол</Text>
          <View style={styles.genderContainer}>
            {genders.map((gender) => (
              <TouchableOpacity
                key={gender}
                style={[
                  styles.genderButton,
                  profileData.gender === gender && styles.genderButtonActive,
                ]}
                onPress={() => setProfileData({ ...profileData, gender })}
              >
                <Text
                  style={[
                    styles.genderText,
                    profileData.gender === gender && styles.genderTextActive,
                  ]}
                >
                  {gender}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </View>
  );

  // Шаг 3: Цели и активность
  const Step3 = () => (
    <View style={styles.stepContent}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Ваша цель</Text>
        <View style={styles.optionsContainer}>
          {goals.map((goal) => (
            <TouchableOpacity
              key={goal}
              style={[
                styles.optionButton,
                profileData.goal === goal && styles.optionButtonActive,
              ]}
              onPress={() => setProfileData({ ...profileData, goal })}
            >
              <Text
                style={[
                  styles.optionText,
                  profileData.goal === goal && styles.optionTextActive,
                ]}
              >
                {goal}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Уровень активности</Text>
        <View style={styles.optionsContainer}>
          {activityLevels.map((activity) => (
            <TouchableOpacity
              key={activity}
              style={[
                styles.optionButton,
                profileData.activity === activity && styles.optionButtonActive,
              ]}
              onPress={() => setProfileData({ ...profileData, activity })}
            >
              <Text
                style={[
                  styles.optionText,
                  profileData.activity === activity && styles.optionTextActive,
                ]}
              >
                {activity}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  // Шаг 4: Питание
  const Step4 = () => (
    <View style={styles.stepContent}>
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Тип питания</Text>
        <View style={styles.optionsContainer}>
          {nutritionTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.optionButton,
                profileData.nutritionType === type && styles.optionButtonActive,
              ]}
              onPress={() =>
                setProfileData({ ...profileData, nutritionType: type })
              }
            >
              <Text
                style={[
                  styles.optionText,
                  profileData.nutritionType === type && styles.optionTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Аллергии</Text>
        <TextInput
          style={styles.input}
          value={profileData.allergies}
          onChangeText={(text) =>
            setProfileData({ ...profileData, allergies: text })
          }
          placeholder="орехи, цитрусы, молоко..."
          placeholderTextColor="#999"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Не любимые продукты</Text>
        <TextInput
          style={styles.input}
          value={profileData.dislikes}
          onChangeText={(text) =>
            setProfileData({ ...profileData, dislikes: text })
          }
          placeholder="грибы, брокколи, рыба..."
          placeholderTextColor="#999"
        />
      </View>
    </View>
  );

  const stepComponents = [Step1, Step2, Step3, Step4];
  const CurrentStepComponent = stepComponents[currentStep];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Шапка */}
      <SafeAreaView style={styles.safeAreaHeader}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
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

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>Пропустить</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Контент */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
          <Text style={styles.stepDescription}>
            {steps[currentStep].description}
          </Text>
          <CurrentStepComponent />
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
    </KeyboardAvoidingView>
  );
}

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
  content: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
    fontFamily: "Playfair Display Bold", // Исправлено на Bold если есть, иначе Regular
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
});
