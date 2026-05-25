// app/following.tsx - С ПОДДЕРЖКОЙ ДРУГОГО ПОЛЬЗОВАТЕЛЯ

import { Ionicons, Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
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
import { userService } from "@/app/services/userService";

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  photoURL?: string | null;
  description?: string;
  followersCount?: number;
  followingCount?: number;
}

interface FollowData {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: any;
  user?: UserProfile;
}

export default function FollowingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [following, setFollowing] = useState<FollowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetUserName, setTargetUserName] = useState<string>("");

  const getCurrentUserId = useCallback((): string | null => {
    return auth.currentUser?.uid || null;
  }, []);

  const loadFollowing = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      console.log("Загрузка списка подписок для пользователя:", userId);

      const followingList = await followService.getFollowing(userId);
      
      const typedFollowing: FollowData[] = [];
      
      if (Array.isArray(followingList)) {
        for (const item of followingList) {
          try {
            const anyItem = item as any;
            
            const followData: FollowData = {
              id: anyItem.id || '',
              followerId: anyItem.followerId || '',
              followingId: anyItem.followingId || '',
              createdAt: anyItem.createdAt || new Date(),
            };
            
            if (anyItem.user) {
              followData.user = {
                id: anyItem.user.id || anyItem.followingId || '',
                name: anyItem.user.name || 'Пользователь',
                email: anyItem.user.email,
                photoURL: anyItem.user.photoURL,
                description: anyItem.user.description,
                followersCount: anyItem.user.followersCount || 0,
                followingCount: anyItem.user.followingCount || 0
              };
            } else {
              followData.user = {
                id: anyItem.followingId || '',
                name: 'Пользователь',
                followersCount: 0,
                followingCount: 0
              };
            }
            
            typedFollowing.push(followData);
          } catch (error) {
            console.error("Ошибка обработки элемента:", error, item);
          }
        }
      }

      setFollowing(typedFollowing);
    } catch (error) {
      console.error("Ошибка загрузки подписок:", error);
      Alert.alert("Ошибка", "Не удалось загрузить список подписок");
      setFollowing([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadUserInfo = useCallback(async (userId: string) => {
    try {
      const userProfile = await userService.fetchUserProfile(userId);
      setTargetUserName(userProfile?.name || "Пользователь");
    } catch (error) {
      console.error("Ошибка загрузки информации о пользователе:", error);
      setTargetUserName("Пользователь");
    }
  }, []);

  const initialize = useCallback(async () => {
    const userId = params.userId as string;
    if (userId) {
      setTargetUserId(userId);
      await Promise.all([
        loadFollowing(userId),
        loadUserInfo(userId)
      ]);
    } else {
      const currentUserId = getCurrentUserId();
      if (currentUserId) {
        setTargetUserId(currentUserId);
        await loadFollowing(currentUserId);
      } else {
        Alert.alert("Ошибка", "Пользователь не авторизован");
        router.back();
      }
    }
  }, [params.userId, getCurrentUserId, loadFollowing, loadUserInfo]);

  const handleUnfollow = async (userId: string, userName: string) => {
    const currentUserId = getCurrentUserId();
    if (targetUserId !== currentUserId) {
      Alert.alert("Ошибка", "Вы можете управлять только своими подписками");
      return;
    }
    
    Alert.alert(
      "Отписаться",
      `Вы уверены, что хотите отписаться от ${userName}?`,
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Отписаться",
          style: "destructive",
          onPress: async () => {
            try {
              await followService.unfollowUser(userId);
              setFollowing(prev => prev.filter(follow => follow.followingId !== userId));
              Alert.alert("Успешно", `Вы отписались от ${userName}`);
            } catch (error) {
              console.error("Ошибка отписки:", error);
              Alert.alert("Ошибка", "Не удалось отписаться");
            }
          },
        },
      ]
    );
  };

  const navigateToProfile = (userId: string) => {
    const currentUserId = getCurrentUserId();
    if (userId === currentUserId) {
      router.push("/(tabs)/profile");
    } else {
      router.push({
        pathname: "/user/[id]",
        params: { id: userId }
      });
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (targetUserId) {
      await loadFollowing(targetUserId);
    }
  }, [targetUserId, loadFollowing]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [initialize])
  );

  const filteredFollowing = following.filter((follow) => {
    const user = follow.user;
    if (!user) return false;
    
    const searchLower = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      (user.email && user.email.toLowerCase().includes(searchLower)) ||
      (user.description && user.description.toLowerCase().includes(searchLower))
    );
  });

  const renderUserCard = (follow: FollowData) => {
    const user = follow.user;
    if (!user) return null;
    
    const currentUserId = getCurrentUserId();
    const isOwnProfile = targetUserId === currentUserId;
    const showUnfollowButton = isOwnProfile && user.id !== currentUserId;

    return (
      <View key={follow.id} style={styles.userCard}>
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
        
        {showUnfollowButton && (
          <TouchableOpacity
            style={styles.unfollowButton}
            onPress={() => handleUnfollow(user.id, user.name)}
          >
            <Ionicons name="person-remove-outline" size={16} color="#FF6B6B" />
            <Text style={styles.unfollowButtonText}>Отписаться</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const headerTitle = targetUserId && targetUserId !== getCurrentUserId() 
    ? `Подписки ${targetUserName}` 
    : "Подписки";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по подпискам..."
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
            <Text style={styles.loaderText}>Загрузка подписок...</Text>
          </View>
        ) : filteredFollowing.length === 0 ? (
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
                <Text style={styles.emptyTitle}>Нет подписок</Text>
                <Text style={styles.emptyText}>
                  {targetUserId && targetUserId !== getCurrentUserId() 
                    ? `${targetUserName} ни на кого не подписан(а)` 
                    : "Вы еще ни на кого не подписаны"}
                </Text>
              </>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Всего подписок: {filteredFollowing.length}
            </Text>
            <View style={styles.usersList}>
              {filteredFollowing.map((follow) => renderUserCard(follow))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ... те же стили, что и в followers.tsx
  container: { flex: 1, backgroundColor: "#FFFFFF" },
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
  backButton: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: "600", color: "#212529", fontFamily: "Playfair Display Bold" },
  headerRight: { width: 32 },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
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
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, color: "#212529", fontFamily: "Playfair Display Regular", paddingVertical: 2 },
  content: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 80 },
  loaderText: { marginTop: 12, fontSize: 16, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 20, color: "#212529", fontFamily: "Playfair Display Bold", marginTop: 16, marginBottom: 8, textAlign: "center" },
  emptyText: { fontSize: 16, color: "#6C757D", fontFamily: "Playfair Display Regular", textAlign: "center", lineHeight: 22, marginBottom: 24 },
  sectionTitle: { fontSize: 16, color: "#6C757D", fontFamily: "Playfair Display Regular", marginHorizontal: 16, marginVertical: 12 },
  usersList: { paddingHorizontal: 16, paddingBottom: 24 },
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
  userInfo: { flex: 1, flexDirection: "row", alignItems: "center" },
  avatarContainer: { marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: "#9BDF11" },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#9BDF11" },
  userDetails: { flex: 1 },
  userName: { fontSize: 16, fontWeight: "600", color: "#212529", fontFamily: "Playfair Display Regular", marginBottom: 4 },
  userDescription: { fontSize: 13, color: "#6C757D", fontFamily: "Playfair Display Regular", marginBottom: 6, lineHeight: 16 },
  userStats: { flexDirection: "row", alignItems: "center", gap: 12 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: "#666", fontFamily: "Playfair Display Regular" },
  unfollowButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#fff5f5", borderWidth: 1, borderColor: "#FF6B6B", gap: 4 },
  unfollowButtonText: { fontSize: 12, color: "#FF6B6B", fontWeight: "600", fontFamily: "Playfair Display Regular" },
});