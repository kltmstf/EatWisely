import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// --- ТИПЫ ДАННЫХ ---
type ProfileData = {
  name: string;
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
  email: string;
  customNutritionType: string;
  cookingTimeLimit: string;
  isProfileFilled: boolean; // Оставлено, но не используется для рендера уведомления
  avatarUri?: string | null;
};

const PROFILE_STORAGE_KEY = "user_profile_data";
const PROFILE_SETUP_KEY = "profile_setup_complete";

// --- ДАННЫЕ ПО УМОЛЧАНИЮ ---
const defaultProfileData: ProfileData = {
  name: "Пользователь",
  email: "",
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
  cookingTimeLimit: "30 мин",
  isProfileFilled: false,
};

export default function ProfileScreen() {
  const router = useRouter();
  const [profileData, setProfileData] =
    useState<ProfileData>(defaultProfileData);
  const [loading, setLoading] = useState(true);

  // Переменная profileCompleted больше не используется для рендера, но оставлена в логике загрузки
  const [, setProfileCompleted] = useState(false);

  // --- ЛОГИКА ЗАГРУЗКИ ---
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    try {
      const [storedProfile, setupStatus] = await Promise.all([
        AsyncStorage.getItem(PROFILE_STORAGE_KEY),
        AsyncStorage.getItem(PROFILE_SETUP_KEY),
      ]);

      if (storedProfile) {
        const parsedData = JSON.parse(storedProfile);

        // ⭐️ ВРЕМЕННЫЙ ЛОГ ДЛЯ ДИАГНОСТИКИ
            console.log("Загруженные данные профиля:", parsedData); 
            console.log("Значение поля 'name':", parsedData.name);
        setProfileData({ ...defaultProfileData, ...parsedData });
      } else {
        setProfileData(defaultProfileData);
      }

      setProfileCompleted(setupStatus === "true");
    } catch (error) {
      console.error("Не удалось загрузить профиль:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  // --- РАССЧИТЫВАЕМЫЕ ЗНАЧЕНИЯ ---
  const primaryInfo = useMemo(
    () => [
      {
        label: "Возраст",
        value: profileData.age ? `${profileData.age} лет` : "-",
      },
      {
        label: "Рост",
        value: profileData.height ? `${profileData.height} см` : "-",
      },
      {
        label: "Вес",
        value: profileData.weight ? `${profileData.weight} кг` : "-",
      },
      { label: "Пол", value: profileData.gender || "-" },
    ],
    [
      profileData.age,
      profileData.height,
      profileData.weight,
      profileData.gender,
    ]
  );

  const preferences = useMemo(
    () => [
      { label: "Цель", value: profileData.goal || "-" },
      { label: "Активность", value: profileData.activity || "-" },
      { label: "Тип питания", value: profileData.nutritionType || "-" },
      { label: "Аллергии", value: profileData.allergies || "Нет" },
      { label: "Нелюбимые продукты", value: profileData.dislikes || "Нет" },
    ],
    [
      profileData.goal,
      profileData.activity,
      profileData.nutritionType,
      profileData.allergies,
      profileData.dislikes,
    ]
  );

  const userName = profileData.name || "Пользователь";

  const profileTypeLabel = profileData.isPrivate
    ? "Приватный профиль"
    : "Публичный профиль";
  const profileTypeDescription = profileData.isPrivate
    ? "Ваш профиль и данные видны только вам."
    : "Другие пользователи могут просматривать ваши данные и рекомендации.";

  // --- ОБРАБОТЧИКИ ---
  const handleEdit = () => {
    router.push("/profile-settings");
  };

  // 🚨 handleSetup удален, так как блок уведомления удален.
  const handleNavigationStub = (path: string) => {
    console.log(`Navigating to: ${path}`);
    // router.push(path); // Закомментировано по требованию (оставить только внешне)
  };

  // --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ ПУНКТОВ МЕНЮ ---
  const renderMenuItem = (
    iconName: string,
    label: string,
    onPress: () => void
  ) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuIconContainer}>
        <Ionicons name={iconName as any} size={24} color="#6A9AA9" />
      </View>
      <Text style={styles.menuItemText}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  // --- РЕНДЕР ---
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loaderText}>Загружаем данные...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. КАРТОЧКА ПРОФИЛЯ */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              {profileData.avatarUri ? (
                <Image
                  source={{ uri: profileData.avatarUri }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={48} color="#6A9AA9" />
              )}
            </View>
            <Text style={styles.nameText}>{userName}</Text>
            <Text style={styles.descriptionText}>
              {profileData.description || "Вы еще не рассказали о себе"}
            </Text>
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Ionicons name="create-outline" size={18} color="#000" />
              <Text style={styles.editButtonText}>Редактировать</Text>
            </TouchableOpacity>
          </View>

          {/* 2. ТИП ПРОФИЛЯ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Тип профиля</Text>
            <View style={styles.profileTypeCard}>
              <View style={styles.profileTypeHeader}>
                <Ionicons
                  name={
                    profileData.isPrivate
                      ? "lock-closed-outline"
                      : "earth-outline"
                  }
                  size={22}
                  color="#6A9AA9"
                />
                <Text style={styles.profileTypeLabel}>{profileTypeLabel}</Text>
              </View>
              <Text style={styles.profileTypeDescription}>
                {profileTypeDescription}
              </Text>
            </View>
          </View>

          {/* 3. ОБНОВЛЕННЫЙ РАЗДЕЛ: Сообщество */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Сообщество</Text>
            <View style={styles.communityMenu}>
              {renderMenuItem(
                "restaurant-outline",
                "Опубликованные рецепты (12)",
                () => handleNavigationStub("/my-recipes")
              )}
              {renderMenuItem("people-outline", "Подписки (8)", () =>
                handleNavigationStub("/following")
              )}
              {renderMenuItem("person-add-outline", "Подписчики (55)", () =>
                handleNavigationStub("/followers")
              )}
              {renderMenuItem("grid-outline", "Публикации (4)", () =>
                handleNavigationStub("/posts")
              )}
            </View>
          </View>

          {/* 4. ОСНОВНЫЕ ДАННЫЕ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Основные данные</Text>
            <View style={styles.infoGrid}>
              {primaryInfo.map((item) => (
                <View key={item.label} style={styles.infoCard}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 5. ПРЕДПОЧТЕНИЯ */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Предпочтения</Text>
            <View style={styles.preferences}>
              {preferences.map((item, index) => (
                <View
                  key={item.label}
                  style={[
                    styles.preferenceRow,
                    index === preferences.length - 1 &&
                      styles.preferenceRowLast,
                  ]}
                >
                  <Text style={styles.preferenceLabel}>{item.label}</Text>
                  <Text style={styles.preferenceValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// --- СТИЛИ ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7F9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 8,
    backgroundColor: "#C2DAE2",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  headerPlaceholder: {
    width: 40,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
    fontFamily: "Playfair Display Regular",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 32,
  },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 3,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#E1F0F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#6A9AA9",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 48,
  },
  nameText: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000",
    fontFamily: "Playfair Display Bold",
  },
  descriptionText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular",
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9BDF11",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    gap: 6,
  },
  editButtonText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 12,
    fontFamily: "Playfair Display Regular",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  infoCard: {
    flexBasis: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  infoLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 6,
    fontFamily: "Playfair Display Regular",
  },
  infoValue: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  preferences: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileTypeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  profileTypeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  profileTypeLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "Playfair Display Regular",
    marginLeft: 8,
  },
  profileTypeDescription: {
    fontSize: 14,
    color: "#4B5563",
    fontFamily: "Playfair Display Regular",
  },
  preferenceRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "column",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  preferenceRowLast: {
    borderBottomWidth: 0,
  },
  preferenceLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
    fontFamily: "Playfair Display Regular",
  },
  preferenceValue: {
    fontSize: 16,
    color: "#111827",
    fontFamily: "Playfair Display Regular",
  },
  communityMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuIconContainer: {
    width: 32,
    alignItems: "center",
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    marginLeft: 12,
    fontFamily: "Playfair Display Regular",
  },
});
