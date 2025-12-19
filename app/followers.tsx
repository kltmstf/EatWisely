// app/(tabs)/profile/followers.tsx
import { Ionicons, Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { auth } from "@/app/firebase/config";
import { followService } from "@/app/services/followService";

// Типы данных
interface UserProfile {
  id: string;
  name: string;
  email?: string;
  photoURL?: string | null;
  description?: string;
  followersCount?: number;
  followingCount?: number;
}

interface FollowerData {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: any;
  user?: UserProfile;
  isFollowing?: boolean;
}

export default function FollowersScreen() {
  const router = useRouter();
  const [followers, setFollowers] = useState<FollowerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Функция для получения текущего userId
  const getCurrentUserId = useCallback((): string | null => {
    return auth.currentUser?.uid || null;
  }, []);

  // Загрузка списка подписчиков
  const loadFollowers = useCallback(async () => {
    const userId = getCurrentUserId();
    if (!userId) {
      Alert.alert("Ошибка", "Вы не авторизованы");
      return;
    }

    try {
      setLoading(true);
      console.log("Загрузка списка подписчиков...");

      // Получаем данные и явно приводим к типу
      const followersList = await followService.getFollowers(userId);
      
      // Явно приводим к нужному типу
      const typedFollowers: FollowerData[] = (followersList || []).map(item => ({
        id: item.id,
        followerId: item.followerId || '',
        followingId: item.followingId || '',
        createdAt: item.createdAt || new Date(),
        user: item.user ? {
          id: item.user.id || '',
          name: item.user.name || 'Пользователь',
          email: item.user.email,
          photoURL: item.user.photoURL,
          description: item.user.description,
          followersCount: item.user.followersCount || 0,
          followingCount: item.user.followingCount || 0
        } : undefined
      }));

      console.log("Получено подписчиков:", typedFollowers.length);
      
      // Проверяем, подписан ли я на каждого подписчика
      const enrichedFollowers = await Promise.all(
        typedFollowers.map(async (follower) => {
          try {
            const isFollowing = await followService.isFollowing(follower.followerId);
            return { ...follower, isFollowing };
          } catch (error) {
            console.error("Ошибка проверки подписки:", error);
            return { ...follower, isFollowing: false };
          }
        })
      );

      setFollowers(enrichedFollowers);
    } catch (error) {
      console.error("Ошибка загрузки подписчиков:", error);
      Alert.alert("Ошибка", "Не удалось загрузить список подписчиков");
      setFollowers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getCurrentUserId]);

  // Подписаться на пользователя
  const handleFollow = async (userId: string, userName: string) => {
    try {
      await followService.followUser(userId);
      // Обновляем статус в списке
      setFollowers(prev =>
        prev.map(follower =>
          follower.followerId === userId
            ? { ...follower, isFollowing: true }
            : follower
        )
      );
      Alert.alert("Успешно", `Вы подписались на ${userName}`);
    } catch (error: any) {
      console.error("Ошибка подписки:", error);
      Alert.alert("Ошибка", error.message || "Не удалось подписаться");
    }
  };

  // Переход к профилю пользователя
  const navigateToProfile = (userId: string) => {
    // Создаем временное решение пока нет страницы профиля пользователя
    if (userId === getCurrentUserId()) {
      router.push("/(tabs)/profile");
    } else {
      Alert.alert("Информация", "Страница профиля пользователя в разработке");
    }
  };

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFollowers();
  }, [loadFollowers]);

  useFocusEffect(
    useCallback(() => {
      loadFollowers();
    }, [loadFollowers])
  );

  // Фильтрация по поиску
  const filteredFollowers = followers.filter((follower) => {
    const user = follower.user;
    if (!user) return false;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.description && user.description.toLowerCase().includes(searchLower))
    );
  });

  // Компонент карточки подписчика
  const renderFollowerCard = (follower: FollowerData) => {
    const user = follower.user;
    if (!user) return null;

    const isCurrentUser = follower.followerId === getCurrentUserId();

    return (
      <View key={follower.id} style={styles.userCard}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => navigateToProfile(user.id)}
        >
          <View style={styles.avatarContainer}>
            {user.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={24} color="#6A9AA9" />
              </View>
            )}
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName} numberOfLines={1}>
              {user.name}
            </Text>
            {user.description ? (
              <Text style={styles.userDescription} numberOfLines={2}>
                {user.description}
              </Text>
            ) : null}
            <View style={styles.userStats}>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={12} color="#666" />
                <Text style={styles.statText}>
                  {user.followersCount || 0}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="person-add-outline" size={12} color="#666" />
                <Text style={styles.statText}>
                  {user.followingCount || 0}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        
        {!isCurrentUser && (
          <TouchableOpacity
            style={[
              styles.followButton,
              follower.isFollowing ? styles.followingButton : styles.notFollowingButton
            ]}
            onPress={() => handleFollow(user.id, user.name)}
          >
            <Ionicons 
              name={follower.isFollowing ? "person" : "person-add"} 
              size={16} 
              color={follower.isFollowing ? "#000" : "#fff"} 
            />
            <Text style={[
              styles.followButtonText,
              follower.isFollowing ? styles.followingButtonText : styles.notFollowingButtonText
            ]}>
              {follower.isFollowing ? "Подписан" : "Подписаться"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Подписчики</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Поиск */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather
            name="search"
            size={16}
            color="#666"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по подписчикам..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Список */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#6A9AA9"]}
            tintColor="#6A9AA9"
          />
        }
      >
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#6A9AA9" />
            <Text style={styles.loaderText}>Загрузка подписчиков...</Text>
          </View>
        ) : filteredFollowers.length === 0 ? (
          <View style={styles.emptyState}>
            {searchQuery ? (
              <>
                <Ionicons name="search-outline" size={64} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>Ничего не найдено</Text>
                <Text style={styles.emptyText}>
                  Попробуйте изменить поисковый запрос
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="people-outline" size={64} color="#C2DAE2" />
                <Text style={styles.emptyTitle}>Нет подписчиков</Text>
                <Text style={styles.emptyText}>
                  У вас пока нет подписчиков
                </Text>
                <TouchableOpacity
                  style={styles.exploreButton}
                  onPress={() => router.push("/community")}
                >
                  <Text style={styles.exploreButtonText}>
                    Найти пользователей
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Всего подписчиков: {filteredFollowers.length}
            </Text>
            <View style={styles.usersList}>
              {filteredFollowers.map((follower) => renderFollowerCard(follower))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Используем те же стили, что и для FollowingScreen с небольшими изменениями
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "Playfair Display Bold",
  },
  headerRight: {
    width: 32,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    paddingVertical: 2,
  },
  content: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  exploreButton: {
    backgroundColor: "#6A9AA9",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  sectionTitle: {
    fontSize: 16,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginHorizontal: 16,
    marginVertical: 12,
  },
  usersList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#9BDF11",
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#9BDF11",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    marginBottom: 4,
  },
  userDescription: {
    fontSize: 13,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 6,
    lineHeight: 16,
  },
  userStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Playfair Display Regular",
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  notFollowingButton: {
    backgroundColor: "#6A9AA9",
    borderWidth: 1,
    borderColor: "#6A9AA9",
  },
  followingButton: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  followButtonText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  notFollowingButtonText: {
    color: "#fff",
  },
  followingButtonText: {
    color: "#666",
  },
});