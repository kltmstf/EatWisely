// app/user/[id].tsx
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { auth } from "@/app/firebase/config";
import { userService, UserProfile } from "@/app/services/userService";
import { followService } from "@/app/services/followService";

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followStats, setFollowStats] = useState({
    followersCount: 0,
    followingCount: 0,
  });

  // Проверяем, это ли профиль текущего пользователя
  const isCurrentUser = id === auth.currentUser?.uid;

  // Проверяем, является ли пользователь другом (взаимная подписка)
  const [isFriend, setIsFriend] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  // Загрузка профиля пользователя
  const loadProfile = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      console.log("Загрузка профиля пользователя:", id);

      // Загружаем данные пользователя
      const userData = await userService.getUserById(id);
      
      if (!userData) {
        Alert.alert("Ошибка", "Пользователь не найден");
        router.back();
        return;
      }

      setProfile(userData);

      // Загружаем статистику
      await loadFollowStats(id);

    } catch (error) {
      console.error("Ошибка загрузки профиля:", error);
      Alert.alert("Ошибка", "Не удалось загрузить профиль пользователя");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  // Загрузка статистики подписок
  const loadFollowStats = useCallback(async (userId: string) => {
    try {
      const [followersCount, followingCount] = await Promise.all([
        followService.getFollowersCount(userId),
        followService.getFollowingCount(userId),
      ]);

      setFollowStats({
        followersCount,
        followingCount,
      });
    } catch (error) {
      console.error("Ошибка загрузки статистики:", error);
    }
  }, []);

  // Проверка подписки
  const checkFollowingStatus = useCallback(async () => {
    if (!id || isCurrentUser) return;

    try {
      const following = await followService.isFollowing(id);
      setIsFollowing(following);
    } catch (error) {
      console.error("Ошибка проверки подписки:", error);
    }
  }, [id, isCurrentUser]);

  // Подписка/отписка
  const handleFollowToggle = async () => {
    if (!profile || isCurrentUser) return;

    try {
      setFollowLoading(true);

      if (isFollowing) {
        await followService.unfollowUser(profile.id);
        setIsFollowing(false);
        setIsFriend(false); // При отписке перестаем быть друзьями
        setFollowStats(prev => ({
          ...prev,
          followersCount: Math.max(0, prev.followersCount - 1),
        }));
        Alert.alert("Успешно", `Вы отписались от ${profile.name}`);
      } else {
        await followService.followUser(profile.id);
        setIsFollowing(true);
        
        // После подписки проверяем статус дружбы
        await checkFriendshipStatus();
        
        setFollowStats(prev => ({
          ...prev,
          followersCount: prev.followersCount + 1,
        }));
        
        Alert.alert("Успешно", `Вы подписались на ${profile.name}`);
      }
    } catch (error: any) {
      console.error("Ошибка подписки/отписки:", error);
      Alert.alert("Ошибка", error.message || "Не удалось выполнить действие");
    } finally {
      setFollowLoading(false);
    }
  };

  // Полная проверка статуса дружбы
  const checkFriendshipStatus = useCallback(async () => {
    if (!id || isCurrentUser) return;

    try {
      setFriendLoading(true);
      const currentUserId = auth.currentUser?.uid;
      
      if (!currentUserId) return;

      // Используем метод checkMutualFollow из сервиса
      const mutualFollow = await followService.checkMutualFollow(currentUserId, id);
      setIsFriend(mutualFollow);
      
      // Также проверяем просто подписку
      const following = await followService.isFollowing(id);
      setIsFollowing(following);
    } catch (error) {
      console.error("Ошибка проверки статуса дружбы:", error);
    } finally {
      setFriendLoading(false);
    }
  }, [id, isCurrentUser]);

  // Определяем, можно ли просматривать приватный профиль
  const canViewPrivateProfile = () => {
    if (!profile?.isProfilePrivate) return true; // Публичный профиль всегда доступен
    if (isCurrentUser) return true; // Свой профиль всегда доступен
    if (isFriend) return true; // Друзья могут просматривать приватный профиль
    return false; // Нельзя просматривать приватный профиль
  };

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    await checkFriendshipStatus();
  }, [loadProfile, checkFriendshipStatus]);

  useEffect(() => {
    loadProfile();
    checkFriendshipStatus();
  }, [loadProfile, checkFriendshipStatus]);

  // Рендер элемента меню сообщества
  const renderMenuItem = useCallback((
    iconName: string,
    label: string,
    count?: number,
    onPress?: () => void
  ) => (
    <TouchableOpacity 
      style={styles.menuItem} 
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.menuIconContainer}>
        <Ionicons name={iconName as any} size={24} color="#555" />
      </View>
      <Text style={styles.menuItemText}>
        {label}
        {count !== undefined && ` (${count})`}
      </Text>
      {onPress && <Ionicons name="chevron-forward" size={20} color="#ccc" />}
    </TouchableOpacity>
  ), []);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loaderText}>Загружаем профиль...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-remove-outline" size={64} color="#C2DAE2" />
        <Text style={styles.errorTitle}>Пользователь не найден</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Вернуться назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Проверяем, можно ли просматривать профиль
  const canView = canViewPrivateProfile();
  
  // Определяем, нужно ли показывать сообщение о приватности
  const showPrivacyMessage = !canView && profile.isProfilePrivate;
  
  // Определяем, нужно ли показывать сообщение о дружбе или публичном профиле
  const showAccessMessage = canView && (profile.isProfilePrivate || !profile.isProfilePrivate) && !isCurrentUser;

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профиль</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Основной контент */}
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
        {/* Карточка профиля */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {profile.photoURL ? (
              <Image
                source={{ uri: profile.photoURL }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={48} color="#6A9AA9" />
              </View>
            )}
          </View>
          <Text style={styles.nameText}>{profile.name}</Text>
          <Text style={styles.descriptionText}>
            {profile.description || "Пользователь еще не добавил описание"}
          </Text>
          
          {/* Статус профиля и дружбы */}
          <View style={styles.statusContainer}>
            <View style={styles.profileStatus}>
              <Ionicons 
                name={profile.isProfilePrivate ? "lock-closed-outline" : "earth-outline"} 
                size={16} 
                color="#6A9AA9" 
              />
              <Text style={styles.profileStatusText}>
                {profile.isProfilePrivate ? "Приватный профиль" : "Публичный профиль"}
              </Text>
            </View>
            
            {/* Бейдж друга */}
            {isFriend && (
              <View style={styles.friendBadge}>
                <Ionicons name="people" size={12} color="#fff" />
                <Text style={styles.friendBadgeText}>Друг</Text>
              </View>
            )}
          </View>

          {/* Кнопки действий */}
          {!isCurrentUser && (
            <TouchableOpacity
              style={[
                styles.followButton,
                isFriend ? styles.friendButton : 
                isFollowing ? styles.followingButton : styles.followButtonStyle
              ]}
              onPress={handleFollowToggle}
              disabled={followLoading || friendLoading}
            >
              {followLoading || friendLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? "#000" : "#fff"} />
              ) : (
                <>
                  <Ionicons 
                    name={
                      isFriend ? "people" : 
                      isFollowing ? "person-remove" : "person-add"
                    } 
                    size={16} 
                    color={
                      isFriend ? "#fff" : 
                      isFollowing ? "#000" : "#fff"
                    } 
                  />
                  <Text style={[
                    styles.followButtonText,
                    isFriend ? styles.friendButtonText : 
                    isFollowing ? styles.followingButtonText : styles.followButtonTextStyle
                  ]}>
                    {isFriend ? "Друзья" : 
                     isFollowing ? "Отписаться" : "Подписаться"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Сообщество */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Сообщество</Text>
          
          {!canView && profile.isProfilePrivate ? (
            <View style={styles.communityBlocked}>
              <Ionicons name="lock-closed-outline" size={32} color="#C2DAE2" />
              <Text style={styles.communityBlockedTitle}>Доступ ограничен</Text>
              <Text style={styles.communityBlockedText}>
                Статистика сообщества доступна только друзьям для приватных профилей.
                {!isFollowing && " Подпишитесь, чтобы пользователь мог подписаться на вас в ответ."}
                {isFollowing && !isFriend && " Ожидайте, когда пользователь подпишется на вас в ответ."}
              </Text>
              
              {/* Сообщение о дружбе */}
              {isFollowing && !isFriend && (
                <View style={styles.friendshipInfo}>
                  <Text style={styles.friendshipInfoText}>
                    Чтобы стать друзьями, пользователь должен подписаться на вас в ответ.
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.communityMenu}>
              <View style={styles.statsRow}>
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => router.push({ 
                    pathname: "/followers", 
                    params: { userId: id } 
                  })}
                >
                  <Text style={styles.statNumber}>{followStats.followersCount}</Text>
                  <Text style={styles.statLabel}>Подписчики</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.statItem}
                  onPress={() => router.push({ 
                    pathname: "/following", 
                    params: { userId: id } 
                  })}
                >
                  <Text style={styles.statNumber}>{followStats.followingCount}</Text>
                  <Text style={styles.statLabel}>Подписки</Text>
                </TouchableOpacity>
              </View>
              
              {renderMenuItem(
                "restaurant-outline",
                "Опубликованные рецепты",
                0, // TODO: Реализовать получение количества рецептов
                canView ? () => {
                  // TODO: Переход на страницу рецептов пользователя
                  Alert.alert("Информация", "Страница рецептов пользователя в разработке");
                } : undefined
              )}
              
              {renderMenuItem(
                "grid-outline",
                "Публикации",
                0, // TODO: Реализовать получение количества публикаций
                canView ? () => {
                  // TODO: Переход на страницу публикаций пользователя
                  Alert.alert("Информация", "Страница публикаций пользователя в разработке");
                } : undefined
              )}
            </View>
          )}
        </View>

        {/* Сообщение о доступе к приватному профилю (только если друзья) */}
        {canView && profile.isProfilePrivate && isFriend && !isCurrentUser && (
          <View style={styles.section}>
            <View style={styles.friendAccessNotice}>
              <Ionicons name="people-outline" size={32} color="#9BDF11" />
              <View style={styles.accessNoticeContent}>
                <Text style={styles.friendAccessTitle}>Доступ к приватному профилю</Text>
                <Text style={styles.friendAccessText}>
                  Вы являетесь другом {profile.name}, поэтому можете просматривать его профиль.
                </Text>
              </View>
            </View>
          </View>
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
  content: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loaderText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
    marginTop: 16,
    marginBottom: 8,
  },
  backBtn: {
    marginTop: 16,
    backgroundColor: "#6A9AA9",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  backBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  // Карточка профиля
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    margin: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#9BDF11",
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#9BDF11",
  },
  nameText: {
    fontSize: 22,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
    marginBottom: 4,
    textAlign: "center",
  },
  descriptionText: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    marginBottom: 12,
    fontFamily: "Playfair Display Regular",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  profileStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  profileStatusText: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  friendBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9BDF11",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    minWidth: 120,
    justifyContent: "center",
  },
  followButtonStyle: {
    backgroundColor: "#6A9AA9",
  },
  followingButton: {
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  friendButton: {
    backgroundColor: "#9BDF11",
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  followButtonTextStyle: {
    color: "#fff",
  },
  followingButtonText: {
    color: "#666",
  },
  friendButtonText: {
    color: "#fff",
  },
  // Секции
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    color: "#212529",
    marginBottom: 12,
    fontFamily: "Playfair Display Bold",
  },
  // Сообщество
  communityMenu: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7F9",
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "Playfair Display Bold",
  },
  statLabel: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginTop: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F7F9",
  },
  menuIconContainer: {
    marginRight: 15,
  },
  menuItemText: {
    flex: 1,
    fontSize: 15,
    color: "#212529",
    fontFamily: "Playfair Display Regular",
  },
  communityBlocked: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  communityBlockedTitle: {
    fontSize: 16,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
    marginTop: 12,
    marginBottom: 6,
    textAlign: "center",
  },
  communityBlockedText: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  followToViewButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#6A9AA9",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginTop: 10,
  },
  followToViewButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  friendshipInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  friendshipInfoText: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  friendAccessNotice: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#f0f9e9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#9BDF11",
    gap: 12,
  },
  accessNoticeContent: {
    flex: 1,
  },
  friendAccessTitle: {
    fontSize: 15,
    color: "#212529",
    fontFamily: "Playfair Display Bold",
    marginBottom: 4,
  },
  friendAccessText: {
    fontSize: 13,
    color: "#4a6c2e",
    fontFamily: "Playfair Display Regular",
  },
});