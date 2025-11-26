import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthContext } from "../app/contexts/AuthContext";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { userService } from "../app/services/userService";

// 💡 Хелпер-маппинг для корректного отображения времени готовки
const COOKING_TIME_MAP: { [key: string]: string } = {
  "15": "15 минут",
  "30": "30 минут",
  "45": "45 минут",
  "60": "60+ минут",
  "60+": "60+ минут",
};

type UserData = {
  name: string;
  email: string;
  description: string;
  age: string;
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
  // НОВЫЕ ПОЛЯ
  cookingTimeLimit: string;
  isProfileFilled: boolean;
};

export default function ProfileSettings() {
  const router = useRouter();
  // user.displayName используется для сравнения имени
  const { signOut, deleteUserAccount, user } = useAuthContext();

  const [userData, setUserData] = useState<UserData>({
    name: user?.displayName || "",
    email: user?.email || "",
    description: "",
    age: "",
    height: "",
    gender: "Муж",
    weight: "",
    goal: "Поддержание веса",
    activity: "Низкий (0-1 тренировка в неделю)",
    nutritionType: "Обычное",
    customNutritionType: "",
    allergies: "",
    dislikes: "",
    isPrivate: false,
    // 🚀 НОВЫЕ ДЕФОЛТЫ
    cookingTimeLimit: "30 минут",
    isProfileFilled: true,
  });

  const [originalData, setOriginalData] = useState<UserData | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const goals = ["Похудение", "Поддержание веса", "Набор веса"];

  const activityLevels = [
    "Низкий (0-1 тренировка в неделю)",
    "Умеренный (2-3 тренировки в неделю)",
    "Интенсивный (3 и более тренировки в неделю)",
  ];

  const nutritionTypes = ["Обычное", "Вегетарианское", "Веганское", "Другое"];
  const genders = ["Муж", "Жен"];

  const cookingTimes = ["15 минут", "30 минут", "45 минут", "60+ минут"];

  const PROFILE_STORAGE_KEY = "user_profile_data";

  const hasChanges = originalData
    ? JSON.stringify(userData) !== JSON.stringify(originalData)
    : false;

  useEffect(() => {
    loadProfileData();
  }, []);

  // ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ (ПРИОРИТЕТ: FIREBASE)
  const loadProfileData = async () => {
    let parsedData: any | null = null;

    try {
      if (user?.uid) {
        // 1. Попытка загрузки из Firebase
        parsedData = await userService.fetchUserProfile(user.uid);
        console.log("Loaded data from Firebase:", parsedData);
      }

      if (!parsedData || Object.keys(parsedData).length === 0) {
        // 2. Если Firebase данных нет, пробуем AsyncStorage
        const savedData = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        if (savedData !== null) {
          parsedData = JSON.parse(savedData);
          console.log("Loaded data from AsyncStorage:", parsedData);
        }
      }

      if (parsedData) {
        // Логика разделения объединенного поля nutritionType (dietType в БД)
        let finalNutritionType =
          parsedData.dietType || parsedData.nutritionType || "Обычное";
        let finalCustomNutritionType = "";

        if (
          typeof finalNutritionType === "string" &&
          finalNutritionType.startsWith("Другое: ")
        ) {
          finalCustomNutritionType = finalNutritionType
            .substring("Другое: ".length)
            .trim();
          finalNutritionType = "Другое";
        }

        // 🚀 FIX 1: Коррекция формата времени готовки для подсветки
        let finalCookingTime = parsedData.cookingTimeLimit || "30 минут";
        // Проверяем, если в базе сохранено числовое значение ("30"), конвертируем его в полный формат ("30 минут")
        if (COOKING_TIME_MAP[finalCookingTime]) {
          finalCookingTime = COOKING_TIME_MAP[finalCookingTime];
        }

        // Преобразуем данные обратно в формат UserData, учитывая новые поля
        const userDataWithDefaults: UserData = {
          ...userData,
          ...parsedData, // Перезаписываем сохраненными данными
          // Важно: берем имя из БД/Auth, если оно есть
          name: parsedData.name || user?.displayName || "",
          email: parsedData.email || user?.email || "",
          nutritionType: finalNutritionType,
          customNutritionType: finalCustomNutritionType,
          dislikes: parsedData.excludedIngredients || parsedData.dislikes || "",
          isPrivate:
            parsedData.isProfilePrivate ?? parsedData.isPrivate ?? false,
          // 🚀 Используем скорректированное значение:
          cookingTimeLimit: finalCookingTime,
          isProfileFilled: parsedData.isProfileFilled ?? true,
        };

        setUserData(userDataWithDefaults);
        setOriginalData(userDataWithDefaults);
      } else {
        // Если данных нигде нет, устанавливаем дефолты из Firebase Auth
        const defaultData = {
          ...userData,
          name: user?.displayName || "",
          email: user?.email || "",
        };
        setUserData(defaultData);
        setOriginalData(defaultData);
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных профиля:", error);
      // В случае ошибки все равно устанавливаем данные из Firebase Auth/дефолты
      const defaultData = {
        ...userData,
        name: user?.displayName || "",
        email: user?.email || "",
      };
      setUserData(defaultData);
      setOriginalData(defaultData);
    }
  };

  // 🌟 ФУНКЦИЯ СОХРАНЕНИЯ ДАННЫХ (ПРИОРИТЕТ: FIREBASE)
  const saveProfileData = async (data: UserData) => {
    const dataToStore = { ...data };

    // 1. Логика объединения customNutritionType в nutritionType для сохранения
    if (
      dataToStore.nutritionType === "Другое" &&
      dataToStore.customNutritionType.trim()
    ) {
      dataToStore.nutritionType = `Другое: ${dataToStore.customNutritionType.trim()}`;
    } else if (dataToStore.nutritionType !== "Другое") {
      // Если выбран стандартный тип, очищаем кастомное поле перед сохранением
      dataToStore.customNutritionType = "";
    }

    // 2. Сохранение в Firebase
    if (user?.uid) {
      try {
        // --- 🚀 FIX 2: Обновление имени пользователя в Firebase Auth ---
        // user.displayName - это имя из Firebase Auth, data.name - это новое имя из стейта
        if (data.name !== user.displayName) {
          console.log("Имя изменилось. Обновление профиля Firebase Auth.");
          // Предполагается, что userService имеет метод для обновления displayName в Firebase Auth
          await userService.updateAuthProfileName(data.name);
        }
        // -------------------------------------------------------------

        // Вызов метода, который сохранит остальные данные в Firestore
        await userService.saveProfileToFirestore(dataToStore);
        Alert.alert("Успех", "Данные профиля сохранены и обновлены.");
        // Обновляем originalData, используя данные из стейта
        setOriginalData(data);
      } catch (error) {
        // Сообщение об ошибке уже выведено в userService.ts
        console.error("Ошибка при сохранении профиля через сервис:", error);
        Alert.alert("Ошибка", "Не удалось сохранить данные профиля.");
      }
    } else {
      // Только локальное сохранение, если нет UID (хотя должно быть при авторизации)
      try {
        await AsyncStorage.setItem(
          PROFILE_STORAGE_KEY,
          JSON.stringify(dataToStore)
        );
        Alert.alert("Успех", "Данные профиля сохранены локально.");
        setOriginalData(data);
      } catch (error) {
        console.error("Ошибка при локальном сохранении данных профиля:", error);
        Alert.alert("Ошибка", "Не удалось сохранить данные профиля.");
      }
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      Alert.alert(
        "Несохраненные изменения",
        "У вас есть несохраненные изменения. Вы уверены, что хотите выйти?",
        [
          {
            text: "Отмена",
            style: "cancel",
          },
          {
            text: "Выйти",
            style: "destructive",
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSave = () => {
    // Вызываем обновленную функцию сохранения
    saveProfileData(userData);
  };

  // Функция для смены фото профиля
  const handleChangePhoto = () => {
    Alert.alert("В разработке", "Функция смены фото будет реализована позже");
  };

  // Функция выхода из аккаунта
  const handleLogout = () => {
    Alert.alert("Выход из аккаунта", "Вы уверены, что хотите выйти?", [
      {
        text: "Отмена",
        style: "cancel",
      },
      {
        text: "Выйти",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/login");
          } catch (error) {
            console.error("Ошибка при выходе:", error);
            Alert.alert("Ошибка", "Не удалось выйти из аккаунта");
          }
        },
      },
    ]);
  };

  // Функция удаления аккаунта
  const handleDeleteAccount = () => {
    setDeleteModalVisible(true);
  };

  const confirmDeleteAccount = async () => {
    if (confirmText.toLowerCase() !== "удалить") {
      Alert.alert(
        "Ошибка",
        "Пожалуйста, введите слово 'удалить' для подтверждения"
      );
      return;
    }

    try {
      await deleteUserAccount();
      setDeleteModalVisible(false);
      router.replace("/login");
    } catch (error) {
      console.error("Ошибка при удалении аккаунта:", error);
      Alert.alert("Ошибка", "Не удалось удалить аккаунт");
      setDeleteModalVisible(false);
    }
  };

  const cancelDelete = () => {
    setDeleteModalVisible(false);
    setConfirmText("");
  };

  // Обработчик изменения типа питания
  const handleNutritionTypeChange = (type: string) => {
    setUserData({
      ...userData,
      nutritionType: type,
      // Сбрасываем customNutritionType, если выбран не "Другое"
      customNutritionType:
        type === "Другое" ? userData.customNutritionType : "",
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Шапка с кнопкой назад и заголовком */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Настройки профиля</Text>
        </View>
        {hasChanges && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="checkmark" size={24} color="#000" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Основная информация с фото профиля */}
        <View style={styles.section}>
          <View style={styles.profileHeader}>
            <View style={styles.photoContainer}>
              <View style={styles.profilePhoto}>
                <Ionicons name="person" size={40} color="#6A9AA9" />
              </View>
              <TouchableOpacity
                style={styles.editPhotoButton}
                onPress={handleChangePhoto}
              >
                <Ionicons name="camera" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.sectionTitleSmall}>Имя пользователя</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="person-outline"
                  size={20}
                  color="#6A9AA9"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.inputSmall}
                  value={userData.name}
                  onChangeText={(text) =>
                    setUserData({ ...userData, name: text })
                  }
                  placeholder="Введите имя"
                  placeholderTextColor="#999"
                />
              </View>

              <Text style={styles.sectionTitleSmall}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#6A9AA9"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.inputSmall}
                  value={userData.email}
                  onChangeText={(text) =>
                    setUserData({ ...userData, email: text })
                  }
                  placeholder="Введите email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                />
              </View>
            </View>
          </View>

          <Text style={[styles.sectionTitle, styles.descriptionTitle]}>
            О себе
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={userData.description}
              onChangeText={(text) =>
                setUserData({ ...userData, description: text })
              }
              placeholder="Расскажите о своих целях, интересах..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Разделитель */}
        <View style={styles.divider} />

        {/* Ваши данные */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="body-outline" size={20} color="#6A9AA9" />
            <Text style={styles.sectionTitle}>Физические данные</Text>
          </View>

          <View style={styles.dataGrid}>
            <View style={styles.dataItem}>
              <View style={styles.dataLabelContainer}>
                <Ionicons name="calendar-outline" size={16} color="#6A9AA9" />
                <Text style={styles.dataLabel}>Возраст</Text>
              </View>
              <TextInput
                style={styles.dataInput}
                value={userData.age}
                onChangeText={(text) => setUserData({ ...userData, age: text })}
                placeholder="лет"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.dataItem}>
              <View style={styles.dataLabelContainer}>
                <Ionicons name="resize-outline" size={16} color="#6A9AA9" />
                <Text style={styles.dataLabel}>Рост</Text>
              </View>
              <TextInput
                style={styles.dataInput}
                value={userData.height}
                onChangeText={(text) =>
                  setUserData({ ...userData, height: text })
                }
                placeholder="см"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.dataItem}>
              <View style={styles.dataLabelContainer}>
                <Ionicons name="scale-outline" size={16} color="#6A9AA9" />
                <Text style={styles.dataLabel}>Вес</Text>
              </View>
              <TextInput
                style={styles.dataInput}
                value={userData.weight}
                onChangeText={(text) =>
                  setUserData({ ...userData, weight: text })
                }
                placeholder="кг"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.dataItem}>
              <View style={styles.dataLabelContainer}>
                <Ionicons
                  name="male-female-outline"
                  size={16}
                  color="#6A9AA9"
                />
                <Text style={styles.dataLabel}>Пол</Text>
              </View>
              <View style={styles.genderContainer}>
                {genders.map((gender) => (
                  <TouchableOpacity
                    key={gender}
                    style={[
                      styles.genderButton,
                      userData.gender === gender && styles.genderButtonActive,
                    ]}
                    onPress={() => setUserData({ ...userData, gender })}
                  >
                    <Text
                      style={[
                        styles.genderText,
                        userData.gender === gender && styles.genderTextActive,
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

        {/* Разделитель */}
        <View style={styles.divider} />

        {/* Цель */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="flag" size={20} color="#6A9AA9" />
            <Text style={styles.sectionTitle}>Цель</Text>
          </View>
          <View style={styles.optionsContainer}>
            {goals.map((goal) => (
              <TouchableOpacity
                key={goal}
                style={[
                  styles.optionButton,
                  userData.goal === goal && styles.optionButtonActive,
                ]}
                onPress={() => setUserData({ ...userData, goal })}
              >
                <Text
                  style={[
                    styles.optionText,
                    userData.goal === goal && styles.optionTextActive,
                  ]}
                >
                  {goal}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Разделитель */}
        <View style={styles.divider} />

        {/* Уровень активности */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="fitness-outline" size={20} color="#6A9AA9" />
            <Text style={styles.sectionTitle}>Уровень активности</Text>
          </View>
          <View style={styles.optionsContainer}>
            {activityLevels.map((activity) => (
              <TouchableOpacity
                key={activity}
                style={[
                  styles.optionButton,
                  userData.activity === activity && styles.optionButtonActive,
                ]}
                onPress={() => setUserData({ ...userData, activity })}
              >
                <Text
                  style={[
                    styles.optionText,
                    userData.activity === activity && styles.optionTextActive,
                  ]}
                >
                  {activity}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Разделитель */}
        <View style={styles.divider} />

        {/* 🚀 НОВОЕ: Время приготовления (Теперь должно работать) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color="#6A9AA9" />
            <Text style={styles.sectionTitle}>Лимит времени на готовку</Text>
          </View>
          <View style={styles.optionsContainer}>
            {cookingTimes.map((time) => (
              <TouchableOpacity
                key={time}
                style={[
                  styles.optionButton,
                  userData.cookingTimeLimit === time &&
                    styles.optionButtonActive,
                ]}
                onPress={() =>
                  setUserData({ ...userData, cookingTimeLimit: time })
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    userData.cookingTimeLimit === time &&
                      styles.optionTextActive,
                  ]}
                >
                  {time}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Разделитель */}
        <View style={styles.divider} />

        {/* Тип питания */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="restaurant-outline" size={20} color="#6A9AA9" />
            <Text style={styles.sectionTitle}>Тип питания</Text>
          </View>
          <View style={styles.optionsContainer}>
            {nutritionTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.optionButton,
                  userData.nutritionType === type && styles.optionButtonActive,
                ]}
                onPress={() => handleNutritionTypeChange(type)}
              >
                <Text
                  style={[
                    styles.optionText,
                    userData.nutritionType === type && styles.optionTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Поле для своего варианта типа питания */}
          {userData.nutritionType === "Другое" && (
            <View style={[styles.inputContainer, { marginTop: 12 }]}>
              <Ionicons
                name="create-outline"
                size={20}
                color="#6A9AA9"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={userData.customNutritionType}
                onChangeText={(text) =>
                  setUserData({ ...userData, customNutritionType: text })
                }
                placeholder="Укажите ваш тип питания..."
                placeholderTextColor="#999"
              />
            </View>
          )}
        </View>

        {/* Разделитель */}
        <View style={styles.divider} />

        {/* Аллергии и исключения */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="warning" size={20} color="#6A9AA9" />
            <Text style={styles.sectionTitle}>Аллергии и исключения</Text>
          </View>

          <View style={styles.allergySection}>
            <View style={styles.inputContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color="#6A9AA9"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.allergyInput}
                value={userData.allergies}
                onChangeText={(text) =>
                  setUserData({ ...userData, allergies: text })
                }
                placeholder="Аллергия на: орехи, цитрусы..."
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <View style={styles.allergySection}>
            <View style={styles.inputContainer}>
              <Ionicons
                name="close-circle-outline"
                size={20}
                color="#6A9AA9"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.allergyInput}
                value={userData.dislikes}
                onChangeText={(text) =>
                  setUserData({ ...userData, dislikes: text })
                }
                placeholder="Не любит: грибы, брокколи..."
                placeholderTextColor="#999"
              />
            </View>
          </View>
        </View>

        {/* Разделитель */}
        <View style={styles.divider} />

        {/* Приватность профиля */}
        <View style={styles.section}>
          <View style={styles.privacyContainer}>
            <View style={styles.privacyTextContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#6A9AA9" />
              <Text style={styles.privacyText}>Приватный профиль</Text>
            </View>
            <TouchableOpacity
              style={[styles.switch, userData.isPrivate && styles.switchActive]}
              onPress={() =>
                setUserData({ ...userData, isPrivate: !userData.isPrivate })
              }
            >
              <View
                style={[
                  styles.switchThumb,
                  userData.isPrivate && styles.switchThumbActive,
                ]}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Разделитель */}
        <View style={styles.divider} />

        {/* Опасная зона */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.dangerButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
            <Text style={styles.dangerButtonText}>Выйти из аккаунта</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, styles.deleteButton]}
            onPress={handleDeleteAccount}
          >
            <Ionicons name="trash-outline" size={20} color="#DC3545" />
            <Text style={styles.dangerButtonText}>Удалить аккаунт</Text>
          </TouchableOpacity>
        </View>

        {/* Отступ для фиксированной кнопки */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Модальное окно подтверждения удаления */}
      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDelete}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="trash-outline" size={32} color="#DC3545" />
              <Text style={styles.modalTitle}>Удаление аккаунта</Text>
            </View>

            <Text style={styles.modalWarning}>
              Это действие нельзя отменить!
            </Text>

            <Text style={styles.modalText}>
              Все ваши данные будут безвозвратно удалены:
            </Text>

            <View style={styles.warningList}>
              <View style={styles.warningItem}>
                <Ionicons name="person-remove" size={16} color="#DC3545" />
                <Text style={styles.warningItemText}>Аккаунт и профиль</Text>
              </View>
              <View style={styles.warningItem}>
                <Ionicons name="book" size={16} color="#DC3545" />
                <Text style={styles.warningItemText}>Созданные рецепты</Text>
              </View>
              <View style={styles.warningItem}>
                <Ionicons name="heart" size={16} color="#DC3545" />
                <Text style={styles.warningItemText}>Избранные рецепты</Text>
              </View>
            </View>

            <Text style={styles.confirmText}>
              Для подтверждения введите слово "удалить":
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.confirmInput}
                value={confirmText}
                onChangeText={setConfirmText}
                placeholder="удалить"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelDelete}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.deleteModalButton,
                  confirmText.toLowerCase() !== "удалить" &&
                    styles.deleteButtonDisabled,
                ]}
                onPress={confirmDeleteAccount}
                disabled={confirmText.toLowerCase() !== "удалить"}
              >
                <Ionicons name="trash" size={18} color="#FFF" />
                <Text style={styles.deleteModalButtonText}>
                  Удалить навсегда
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ⚠️ Предполагаемая реализация метода в вашем userService.ts
// Если у вас нет такого метода, вам нужно будет его добавить, используя Firebase Auth SDK
// import { getAuth, updateProfile } from "firebase/auth";

// export const userService = {
// // ... другие ваши методы ...
// updateAuthProfileName: async (newName: string) => {
// const auth = getAuth();
// const user = auth.currentUser;
// if (user) {
// try {
// // Обновление имени в основном профиле Firebase Auth
// await updateProfile(user, { displayName: newName });
// console.log("Firebase Auth display name updated successfully.");
// } catch (error) {
// console.error("Failed to update Firebase Auth display name:", error);
// // В реальном приложении может потребоваться re-authentication
// throw new Error("Не удалось обновить имя пользователя в Auth.");
// }
// }
// },
// };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
    backgroundColor: "#C2DAE2",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    color: "#000000",
    fontFamily: "Playfair Display Bold",
  },
  saveButton: {
    padding: 8,
    backgroundColor: "#9BDF11",
    borderRadius: 12,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
  },
  // Стили для фото профиля
  profileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  photoContainer: {
    position: "relative",
    marginRight: 20,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E1F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#6A9AA9",
  },
  editPhotoButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#6A9AA9",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  profileInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    color: "#1E293B",
    fontFamily: "Playfair Display Bold",
  },
  sectionTitleSmall: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 8,
    fontFamily: "Playfair Display Regular",
  },
  descriptionTitle: {
    marginTop: 0,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    paddingVertical: 14,
    fontFamily: "Playfair Display Regular",
  },
  inputSmall: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
    paddingVertical: 12,
    fontFamily: "Playfair Display Regular",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 20,
  },
  dataGrid: {
    gap: 16,
  },
  dataItem: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dataLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 6,
  },
  dataLabel: {
    fontSize: 14,
    color: "#475569",
    fontFamily: "Playfair Display Regular",
  },
  dataInput: {
    fontSize: 16,
    color: "#1E293B",
    fontFamily: "Playfair Display Regular",
  },
  // Стили для выбора пола
  genderContainer: {
    flexDirection: "row",
    gap: 8,
  },
  genderButton: {
    flex: 1,
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  genderButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  genderText: {
    fontSize: 14,
    color: "#64748B",
    fontFamily: "Playfair Display Regular",
  },
  genderTextActive: {
    color: "#000000",
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  optionButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
    shadowColor: "#9BDF11",
    shadowOpacity: 0.3,
  },
  optionText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    fontFamily: "Playfair Display Regular",
  },
  optionTextActive: {
    color: "#000000",
  },
  allergySection: {
    marginBottom: 16,
  },
  allergyInput: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    paddingVertical: 14,
    fontFamily: "Playfair Display Regular",
  },
  privacyContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  privacyTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  privacyText: {
    fontSize: 16,
    color: "#1E293B",
    fontFamily: "Playfair Display Regular",
  },
  switch: {
    width: 50,
    height: 28,
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    padding: 2,
  },
  switchActive: {
    backgroundColor: "#9BDF11",
  },
  switchThumb: {
    width: 24,
    height: 24,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  switchThumbActive: {
    transform: [{ translateX: 22 }],
  },
  // Стили для опасной зоны
  dangerSectionTitle: {
    fontSize: 18,
    color: "#DC3545",
    fontFamily: "Playfair Display Bold",
  },
  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logoutButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 2,
    borderColor: "#FECACA",
  },
  deleteButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 2,
    borderColor: "#FECACA",
  },
  dangerButtonText: {
    fontSize: 16,
    fontFamily: "Playfair Display Regular",
    color: "#DC3545",
  },
  bottomSpacing: {
    height: 40,
  },
  // Стили для модального окна удаления
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    color: "#DC3545",
    marginTop: 12,
    textAlign: "center",
    fontFamily: "Playfair Display Bold",
  },
  modalWarning: {
    fontSize: 16,
    color: "#DC3545",
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "Playfair Display Regular",
  },
  modalText: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 16,
    textAlign: "center",
    fontFamily: "Playfair Display Regular",
  },
  warningList: {
    marginBottom: 20,
    gap: 8,
  },
  warningItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningItemText: {
    fontSize: 14,
    color: "#64748B",
    fontFamily: "Playfair Display Regular",
  },
  confirmText: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "Playfair Display Regular",
  },
  confirmInput: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    paddingVertical: 14,
    fontFamily: "Playfair Display Regular",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 16,
  },
  cancelButton: {
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  deleteModalButton: {
    backgroundColor: "#DC3545",
  },
  deleteButtonDisabled: {
    backgroundColor: "#94A3B8",
    opacity: 0.6,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#475569",
    fontFamily: "Playfair Display Regular",
  },
  deleteModalButtonText: {
    fontSize: 16,
    color: "#FFF",
    fontFamily: "Playfair Display Regular",
  },
});
