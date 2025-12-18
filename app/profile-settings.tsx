// app/screens/ProfileSettings.tsx

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
  Image,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthContext } from "@/app/contexts/AuthContext";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { userService } from "../app/services/userService";
import * as ImagePicker from 'expo-image-picker';

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
  cookingTimeLimit: string;
  isProfileFilled: boolean;
  photoURL?: string; // НОВОЕ ПОЛЕ
  cloudinaryPublicId?: string; // НОВОЕ ПОЛЕ
};

export default function ProfileSettings() {
  const router = useRouter();
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
    cookingTimeLimit: "30 минут",
    isProfileFilled: true,
    photoURL: user?.photoURL || "",
  });

  const [originalData, setOriginalData] = useState<UserData | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // НОВОЕ СОСТОЯНИЕ

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

  // ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ
  const loadProfileData = async () => {
    let parsedData: any | null = null;

    try {
      if (user?.uid) {
        parsedData = await userService.fetchUserProfile(user.uid);
        console.log("Loaded data from Firebase:", parsedData);
      }

      if (!parsedData || Object.keys(parsedData).length === 0) {
        const savedData = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
        if (savedData !== null) {
          parsedData = JSON.parse(savedData);
          console.log("Loaded data from AsyncStorage:", parsedData);
        }
      }

      if (parsedData) {
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

        let finalCookingTime = parsedData.cookingTimeLimit || "30 минут";
        if (COOKING_TIME_MAP[finalCookingTime]) {
          finalCookingTime = COOKING_TIME_MAP[finalCookingTime];
        }

        const userDataWithDefaults: UserData = {
          ...userData,
          ...parsedData,
          name: parsedData.name || user?.displayName || "",
          email: parsedData.email || user?.email || "",
          nutritionType: finalNutritionType,
          customNutritionType: finalCustomNutritionType,
          dislikes: parsedData.excludedIngredients || parsedData.dislikes || "",
          isPrivate: parsedData.isProfilePrivate ?? parsedData.isPrivate ?? false,
          cookingTimeLimit: finalCookingTime,
          isProfileFilled: parsedData.isProfileFilled ?? true,
          photoURL: parsedData.photoURL || user?.photoURL || "",
          cloudinaryPublicId: parsedData.cloudinaryPublicId || "",
        };

        setUserData(userDataWithDefaults);
        setOriginalData(userDataWithDefaults);
      } else {
        const defaultData = {
          ...userData,
          name: user?.displayName || "",
          email: user?.email || "",
          photoURL: user?.photoURL || "",
        };
        setUserData(defaultData);
        setOriginalData(defaultData);
      }
    } catch (error) {
      console.error("Ошибка при загрузке данных профиля:", error);
      const defaultData = {
        ...userData,
        name: user?.displayName || "",
        email: user?.email || "",
        photoURL: user?.photoURL || "",
      };
      setUserData(defaultData);
      setOriginalData(defaultData);
    }
  };

  // ФУНКЦИЯ СОХРАНЕНИЯ ДАННЫХ
  const saveProfileData = async (data: UserData) => {
    const dataToStore = { ...data };

    if (
      dataToStore.nutritionType === "Другое" &&
      dataToStore.customNutritionType.trim()
    ) {
      dataToStore.nutritionType = `Другое: ${dataToStore.customNutritionType.trim()}`;
    } else if (dataToStore.nutritionType !== "Другое") {
      dataToStore.customNutritionType = "";
    }

    if (user?.uid) {
      try {
        if (data.name !== user.displayName) {
          console.log("Имя изменилось. Обновление профиля Firebase Auth.");
          await userService.updateAuthProfileName(data.name);
        }

        await userService.saveProfileToFirestore(dataToStore);
        Alert.alert("Успех", "Данные профиля сохранены и обновлены.");
        setOriginalData(data);
      } catch (error) {
        console.error("Ошибка при сохранении профиля через сервис:", error);
        Alert.alert("Ошибка", "Не удалось сохранить данные профиля.");
      }
    } else {
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

  // НОВАЯ ФУНКЦИЯ: Запрос разрешений
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

  // НОВАЯ ФУНКЦИЯ: Выбор фото из галереи
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

  // НОВАЯ ФУНКЦИЯ: Сделать фото
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

  // НОВАЯ ФУНКЦИЯ: Загрузка фото в Cloudinary
  const uploadProfilePhoto = async (imageUri: string) => {
    if (!user?.uid) {
      Alert.alert("Ошибка", "Пользователь не авторизован");
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      console.log("Starting photo upload to Cloudinary...");
      
      const result = await userService.uploadProfilePhoto(imageUri, user.uid);
      
      if (result.success && result.url) {
        // Обновляем состояние
        setUserData(prev => ({ 
          ...prev, 
          photoURL: result.url,
          cloudinaryPublicId: result.publicId 
        }));
        
        if (originalData) {
          setOriginalData(prev => prev ? { 
            ...prev, 
            photoURL: result.url,
            cloudinaryPublicId: result.publicId 
          } : null);
        }
        
        Alert.alert("Успех", "Фото профиля обновлено");
      } else {
        Alert.alert("Ошибка", result.error || "Не удалось загрузить фото");
      }
    } catch (error: any) {
      console.error("Error uploading photo:", error);
      Alert.alert("Ошибка", error.message || "Не удалось загрузить фото");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // НОВАЯ ФУНКЦИЯ: Удаление фото
  const deleteProfilePhoto = async () => {
    if (!user?.uid) return;
    
    Alert.alert(
      "Удаление фото",
      "Вы уверены, что хотите удалить фото профиля?",
      [
        {
          text: "Отмена",
          style: "cancel"
        },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
              await userService.deleteProfilePhoto(user.uid, userData.cloudinaryPublicId);
              
              // Обновляем состояние
              setUserData(prev => ({ 
                ...prev, 
                photoURL: "",
                cloudinaryPublicId: "" 
              }));
              
              if (originalData) {
                setOriginalData(prev => prev ? { 
                  ...prev, 
                  photoURL: "",
                  cloudinaryPublicId: "" 
                } : null);
              }
              
              Alert.alert("Успех", "Фото профиля удалено");
            } catch (error) {
              console.error("Error deleting photo:", error);
              Alert.alert("Ошибка", "Не удалось удалить фото");
            }
          }
        }
      ]
    );
  };

  // ИЗМЕНЕННАЯ ФУНКЦИЯ: Обработчик смены фото с прогрессом
  const handleChangePhoto = () => {
    if (isUploading) {
      Alert.alert("Загрузка", "Пожалуйста, подождите, фото загружается...");
      return;
    }

    const options = [];
    
    if (userData.photoURL) {
      options.push({
        text: "Удалить фото",
        style: "destructive" as const,
        onPress: deleteProfilePhoto
      });
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
        ...options,
        {
          text: "Отмена",
          style: "cancel"
        }
      ]
    );
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
    saveProfileData(userData);
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
      customNutritionType: type === "Другое" ? userData.customNutritionType : "",
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
              {isUploading ? (
                <View style={[styles.profilePhoto, styles.uploadingPhoto]}>
                  <ActivityIndicator size="large" color="#6A9AA9" />
                  {uploadProgress > 0 && (
                    <Text style={styles.uploadProgressText}>
                      {Math.round(uploadProgress)}%
                    </Text>
                  )}
                </View>
              ) : userData.photoURL ? (
                <Image
                  source={{ uri: userData.photoURL }}
                  style={styles.profilePhotoImage}
                />
              ) : (
                <View style={styles.profilePhoto}>
                  <Ionicons name="person" size={40} color="#6A9AA9" />
                </View>
              )}
              <TouchableOpacity
                style={styles.editPhotoButton}
                onPress={handleChangePhoto}
                disabled={isUploading}
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
                  editable={false}
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

        {/* Остальные секции остаются без изменений */}
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

        {/* Время приготовления */}
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
  profilePhotoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#6A9AA9",
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
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  uploadProgressText: {
    marginTop: 8,
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
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