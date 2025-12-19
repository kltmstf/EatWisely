// app/followers.tsx
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
  isFriend?: boolean; // Новое поле: является ли другом
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
      console.log("Загрузка списка подписчиков для пользователя:", userId);

      // Получаем данные из сервиса
      const followersList = await followService.getFollowers(userId);
      console.log("Raw данные из сервиса:", followersList);
      
      // Преобразуем данные, защищаясь от ошибок
      const typedFollowers: FollowerData[] = [];
      
      if (Array.isArray(followersList)) {
        for (const item of followersList) {
          try {
            // Используем any для обхода проверки типов
            const anyItem = item as any;
            
            const followerData: FollowerData = {
              id: anyItem.id || '',
              followerId: anyItem.followerId || '',
              followingId: anyItem.followingId || '',
              createdAt: anyItem.createdAt || new Date(),
            };
            
            // Проверяем наличие user данных
            if (anyItem.user) {
              followerData.user = {
                id: anyItem.user.id || anyItem.followerId || '',
                name: anyItem.user.name || 'Пользователь',
                email: anyItem.user.email,
                photoURL: anyItem.user.photoURL,
                description: anyItem.user.description,
                followersCount: anyItem.user.followersCount || 0,
                followingCount: anyItem.user.followingCount || 0
              };
            } else {
              // Если user не загружен, используем базовую информацию
              followerData.user = {
                id: anyItem.followerId || '',
                name: 'Пользователь',
                followersCount: 0,
                followingCount: 0
              };
            }
            
            typedFollowers.push(followerData);
          } catch (error) {
            console.error("Ошибка обработки элемента:", error, item);
          }
        }
      }

      console.log("Обработанные подписчики:", typedFollowers.length, typedFollowers);
      
      // Проверяем, подписан ли я на каждого подписчика
      const enrichedFollowers = await Promise.all(
        typedFollowers.map(async (follower) => {
          try {
            // Проверяем, подписан ли я на этого пользователя
            const isFollowing = await followService.isFollowing(follower.followerId);
            
            // Временно: считаем друзьями, если мы подписаны на подписчика
            // (так как он уже подписан на нас - он в списке подписчиков)
            const isFriend = isFollowing;
            
            return { ...follower, isFollowing, isFriend };
          } catch (error) {
            console.error("Ошибка проверки подписки:", error);
            return { ...follower, isFollowing: false, isFriend: false };
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
            ? { ...follower, isFollowing: true, isFriend: true } // При подписке автоматически становимся друзьями
            : follower
        )
      );
      
      Alert.alert("Успешно", `Вы подписались на ${userName}. Теперь вы друзья!`);
    } catch (error: any) {
      console.error("Ошибка подписки:", error);
      Alert.alert("Ошибка", error.message || "Не удалось подписаться");
    }
  };

  // Отписаться от пользователя (используется для кнопки "Друзья")
  const handleUnfollow = async (userId: string, userName: string) => {
    Alert.alert(
      "Отписаться",
      `Вы уверены, что хотите отписаться от ${userName}? Это удалит статус "Друзья".`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Отписаться",
          style: "destructive",
          onPress: async () => {
            try {
              await followService.unfollowUser(userId);
              
              // Обновляем статус в списке
              setFollowers(prev =>
                prev.map(follower =>
                  follower.followerId === userId
                    ? { ...follower, isFollowing: false, isFriend: false }
                    : follower
                )
              );
              
              Alert.alert("Успешно", `Вы отписались от ${userName}`);
            } catch (error: any) {
              console.error("Ошибка отписки:", error);
              Alert.alert("Ошибка", error.message || "Не удалось отписаться");
            }
          },
        },
      ]
    );
  };

  // Обработка нажатия на кнопку (для друзей и подписок)
  const handleFollowButtonPress = (follower: FollowerData) => {
    const user = follower.user;
    if (!user) return;

    if (follower.isFriend) {
      // Если это друг - предлагаем отписаться
      handleUnfollow(user.id, user.name);
    } else if (follower.isFollowing) {
      // Если уже подписан - предлагаем отписаться
      Alert.alert(
        "Отписаться",
        `Вы уверены, что хотите отписаться от ${user.name}?`,
        [
          { text: "Отмена", style: "cancel" },
          {
            text: "Отписаться",
            style: "destructive",
            onPress: async () => {
              try {
                await followService.unfollowUser(user.id);
                
                // Обновляем статус в списке
                setFollowers(prev =>
                  prev.map(f =>
                    f.followerId === user.id
                      ? { ...f, isFollowing: false, isFriend: false }
                      : f
                  )
                );
                
                Alert.alert("Успешно", `Вы отписались от ${user.name}`);
              } catch (error: any) {
                console.error("Ошибка отписки:", error);
                Alert.alert("Ошибка", error.message || "Не удалось отписаться");
              }
            },
          },
        ]
      );
    } else {
      // Если не подписан - подписаться
      handleFollow(user.id, user.name);
    }
  };

  // Переход к профилю пользователя
  const navigateToProfile = (userId: string) => {
  if (userId === getCurrentUserId()) {
    router.push("/(tabs)/profile");
  } else {
    // Используем правильный синтаксис для динамических маршрутов
    router.push({
      pathname: "/user/[id]",
      params: { id: userId }
    });
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

    // Определяем текст и стиль кнопки
    let buttonText = "Подписаться";
    let buttonStyle = styles.notFollowingButton;
    let buttonTextStyle = styles.notFollowingButtonText;
    let iconName: "person-add" | "person" | "people" = "person-add";
    let iconColor = "#fff";

    if (follower.isFriend) {
      buttonText = "Друзья";
      buttonStyle = styles.friendButton;
      buttonTextStyle = styles.friendButtonText;
      iconName = "people";
      iconColor = "#fff";
    } else if (follower.isFollowing) {
      buttonText = "Подписан";
      buttonStyle = styles.followingButton;
      buttonTextStyle = styles.followingButtonText;
      iconName = "person";
      iconColor = "#000";
    }

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
              {follower.isFriend && (
                <View style={styles.friendBadge}>
                  <Ionicons name="checkmark-circle" size={10} color="#fff" />
                  <Text style={styles.friendBadgeText}>Друг</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        {!isCurrentUser && (
          <TouchableOpacity
            style={[
              styles.followButton,
              buttonStyle
            ]}
            onPress={() => handleFollowButtonPress(follower)}
          >
            <Ionicons 
              name={iconName} 
              size={16} 
              color={iconColor} 
            />
            <Text style={[
              styles.followButtonText,
              buttonTextStyle
            ]}>
              {buttonText}
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
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9BDF11",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  friendBadgeText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    minWidth: 100,
    justifyContent: "center",
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
  friendButton: {
    backgroundColor: "#9BDF11",
    borderWidth: 1,
    borderColor: "#9BDF11",
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
  friendButtonText: {
    color: "#fff",
  },
});