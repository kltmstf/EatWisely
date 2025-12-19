import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Dimensions,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { getAuth } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  orderBy,
} from "firebase/firestore";
import { db } from "@/app/firebase/config";
import { safeDeleteCommunityImage } from "@/app/services/cloudinaryService";

// Типы
interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  title: string;
  content: string;
  images: string[];
  postType: string;
  likes: number;
  comments: number;
  createdAt: any;
  timeAgo: string;
  verified: boolean;
  liked: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function UserPostsScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedFilter, setSelectedFilter] = useState("Все");

  const filters = ["Все", "Рецепты", "Вопросы", "Отзывы", "Советы"];

  // Получаем текущего пользователя
  useEffect(() => {
    const auth = getAuth();
    const user = auth.currentUser;
    setCurrentUser(user);
  }, []);

  // Загружаем посты пользователя
  const loadUserPosts = useCallback(async () => {
    if (!currentUser?.uid) return;

    try {
      setLoading(true);

      const postsQuery = query(
        collection(db, "community_posts"),
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(postsQuery);
      const userPosts: CommunityPost[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const images = data.images || (data.image ? [data.image] : []);

        userPosts.push({
          id: doc.id,
          userId: data.userId || currentUser.uid,
          userName: data.userName || currentUser.displayName || "Пользователь",
          userAvatar: currentUser.photoURL || null,
          title: data.title,
          content: data.content,
          images: images,
          postType: data.postType || "Рецепты",
          likes: data.likes || 0,
          comments: data.comments || 0,
          createdAt: data.createdAt,
          timeAgo: formatTimeAgo(data.createdAt?.toDate() || new Date()),
          verified: data.verified || false,
          liked: data.likedBy?.includes(currentUser.uid) || false,
        });
      });

      setPosts(userPosts);
      setFilteredPosts(userPosts); // Инициализируем отфильтрованные посты
    } catch (error) {
      console.error("Ошибка загрузки постов пользователя:", error);
      Alert.alert("Ошибка", "Не удалось загрузить ваши публикации");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  // Фильтрация постов при изменении фильтра или постов
  useEffect(() => {
    if (selectedFilter === "Все") {
      setFilteredPosts(posts);
    } else {
      const filtered = posts.filter((post) => post.postType === selectedFilter);
      setFilteredPosts(filtered);
    }
  }, [selectedFilter, posts]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser?.uid) {
        loadUserPosts();
      }
    }, [currentUser?.uid, loadUserPosts])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadUserPosts();
  }, [loadUserPosts]);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "только что";
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} минут назад`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} часов назад`;
    return `${Math.floor(diffInSeconds / 86400)} дней назад`;
  };

  const getPostTypeColor = (postType: string) => {
    switch (postType) {
      case "Рецепты":
        return "#E8F5E8";
      case "Вопросы":
        return "#E3F2FD";
      case "Отзывы":
        return "#FFF3E0";
      case "Советы":
        return "#F3E5F5";
      default:
        return "#C2DAE2";
    }
  };

  // Удаление поста
  const handleDeletePost = async (postId: string, postImages: string[]) => {
    Alert.alert(
      "Удалить пост",
      "Вы уверены, что хотите удалить этот пост? Это действие нельзя отменить.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Удалить",
          style: "destructive",
          onPress: async () => {
            try {
               // ВРЕМЕННО ОТКЛЮЧАЕМ УДАЛЕНИЕ ИЗОБРАЖЕНИЙ ИЗ CLOUDINARY
            /*
            // Удаляем изображения из Cloudinary если они есть
            if (postImages && postImages.length > 0) {
              for (const imageUrl of postImages) {
                try {
                  await safeDeleteCommunityImage(imageUrl);
                } catch (imgError) {
                  console.error('Ошибка удаления изображения:', imgError);
                }
              }
            }
            */

              // Удаляем пост из Firestore
              await deleteDoc(doc(db, "community_posts", postId));

              // Удаляем комментарии к посту
              const commentsQuery = query(
                collection(db, "comments"),
                where("postId", "==", postId)
              );
              const commentsSnapshot = await getDocs(commentsQuery);
              const deleteCommentsPromises = commentsSnapshot.docs.map(
                (commentDoc) => deleteDoc(doc(db, "comments", commentDoc.id))
              );
              await Promise.all(deleteCommentsPromises);

              // Удаляем лайки к посту
              const likesQuery = query(
                collection(db, "likes"),
                where("postId", "==", postId)
              );
              const likesSnapshot = await getDocs(likesQuery);
              const deleteLikesPromises = likesSnapshot.docs.map((likeDoc) =>
                deleteDoc(doc(db, "likes", likeDoc.id))
              );
              await Promise.all(deleteLikesPromises);

              // Обновляем список постов
              setPosts((prev) => prev.filter((post) => post.id !== postId));

              Alert.alert("Успешно", "Пост удален");
            } catch (error) {
              console.error("Ошибка удаления поста:", error);
              Alert.alert("Ошибка", "Не удалось удалить пост");
            }
          },
        },
      ]
    );
  };

  // Компонент Avatar (идентичный Community)
  const Avatar = ({
    photoURL,
    size = 45,
  }: {
    photoURL?: string | null;
    size?: number;
  }) => {
    if (photoURL) {
      return (
        <Image
          source={{ uri: photoURL }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: "#9BDF11",
          }}
          resizeMode="cover"
        />
      );
    }

    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: "#E5F0F5",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 2,
          borderColor: "#9BDF11",
        }}
      >
        <Feather name="user" size={size * 0.4} color="#6A9AA9" />
      </View>
    );
  };

  // Компонент ImageSlider (идентичный Community)
  const ImageSlider = ({
    images,
    postId,
  }: {
    images: string[];
    postId: string;
  }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    if (!images || images.length === 0) return null;

    const onViewRef = useRef(({ viewableItems }: any) => {
      if (viewableItems.length > 0) {
        setCurrentIndex(viewableItems[0].index);
      }
    });

    const viewConfigRef = useRef({ viewAreaCoveragePercentThreshold: 50 });

    const handlePrev = () => {
      if (currentIndex > 0) {
        flatListRef.current?.scrollToIndex({
          index: currentIndex - 1,
          animated: true,
        });
      }
    };

    const handleNext = () => {
      if (currentIndex < images.length - 1) {
        flatListRef.current?.scrollToIndex({
          index: currentIndex + 1,
          animated: true,
        });
      }
    };

    return (
      <View style={styles.imageSliderContainer}>
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.prevButton]}
                onPress={handlePrev}
              >
                <Feather name="chevron-left" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            {currentIndex < images.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.nextButton]}
                onPress={handleNext}
              >
                <Feather name="chevron-right" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}

        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewRef.current}
          viewabilityConfig={viewConfigRef.current}
          scrollEventThrottle={32}
          decelerationRate="fast"
          keyExtractor={(item, index) => `${postId}_image_${index}`}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image
                source={{ uri: item }}
                style={styles.postImage}
                resizeMode="cover"
              />
            </View>
          )}
        />

        {images.length > 1 && (
          <View style={styles.imageCounter}>
            <Text style={styles.imageCounterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // Рендер карточки поста
  const renderPostCard = ({ item }: { item: CommunityPost }) => (
    <View key={item.id} style={styles.postCard}>
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          <View style={styles.userAvatarContainer}>
            <Avatar photoURL={item.userAvatar} size={45} />
          </View>
          <View style={styles.userDetails}>
            <View style={styles.userNameContainer}>
              <Text style={styles.userName}>{item.userName}</Text>
              {item.verified && (
                <MaterialIcons name="verified" size={14} color="#000000ff" />
              )}
            </View>
            <Text style={styles.postTime}>{item.timeAgo}</Text>
          </View>
        </View>

        {/* Правая часть хедера с типом поста и кнопкой удаления */}
        <View style={styles.headerRight}>
          <View style={styles.typeAndDeleteRow}>
            {/* Тип поста */}
            <View
              style={[
                styles.postTypeBadge,
                { backgroundColor: getPostTypeColor(item.postType) },
              ]}
            >
              <Text style={styles.postTypeText}>{item.postType}</Text>
            </View>

            {/* Кнопка удаления */}
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePost(item.id, item.images)}
            >
              <Feather name="trash-2" size={18} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.postContent}>
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postText}>{item.content}</Text>

        {item.images && item.images.length > 0 && (
          <ImageSlider images={item.images} postId={item.id} />
        )}
      </View>

      {/* Лайки и комментарии снизу */}
      <View style={styles.postStats}>
        <View style={styles.statItem}>
          <View style={styles.statButton}>
            <MaterialIcons
              name={item.liked ? "favorite" : "favorite-border"}
              size={18}
              color={item.liked ? "#FF6B6B" : "#6A9AA9"}
            />
            <Text style={[styles.statText, item.liked && styles.likedText]}>
              {item.likes}
            </Text>
          </View>
        </View>

        <View style={styles.statItem}>
          <View style={styles.statButton}>
            <Feather name="message-circle" size={18} color="#6A9AA9" />
            <Text style={styles.statText}>{item.comments}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Рендер пустого состояния
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="file-text" size={64} color="#C2DAE2" />
      <Text style={styles.emptyStateTitle}>Публикаций пока нет</Text>
      <Text style={styles.emptyStateText}>
        Создайте свой первый пост в сообществе!
      </Text>
      <TouchableOpacity
        style={styles.createPostButton}
        onPress={() => router.push("/community")}
      >
        <Feather name="edit-3" size={20} color="#000" />
        <Text style={styles.createPostButtonText}>Создать пост</Text>
      </TouchableOpacity>
    </View>
  );

  // Статистика
  const renderStats = () => {
    const totalLikes = posts.reduce((sum, post) => sum + post.likes, 0);
    const totalComments = posts.reduce((sum, post) => sum + post.comments, 0);

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Мои публикации ({posts.length})</Text>
          <Text style={styles.filterInfo}>
            {selectedFilter === "Все"
              ? "Все типы"
              : `Только: ${selectedFilter}`}
          </Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="favorite" size={20} color="#FF6B6B" />
            <Text style={styles.statCardValue}>{totalLikes}</Text>
            <Text style={styles.statCardLabel}>Лайки</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="message-circle" size={20} color="#6A9AA9" />
            <Text style={styles.statCardValue}>{totalComments}</Text>
            <Text style={styles.statCardLabel}>Комментарии</Text>
          </View>
          <View style={styles.statCard}>
            <Feather name="filter" size={20} color="#9BDF11" />
            <Text style={styles.statCardValue}>{filteredPosts.length}</Text>
            <Text style={styles.statCardLabel}>Показано</Text>
          </View>
        </View>
      </View>
    );
  };

  // Обработчик выбора фильтра
  const handleFilterSelect = (filter: string) => {
    setSelectedFilter(filter);
  };

  return (
    <View style={styles.container}>
      {/* Хедер */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Мои публикации</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Фильтры */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterButton,
                selectedFilter === filter && styles.filterButtonActive,
              ]}
              onPress={() => handleFilterSelect(filter)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === filter && styles.filterTextActive,
                ]}
              >
                {filter}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loadingText}>Загрузка публикаций...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          renderItem={renderPostCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#6A9AA9"]}
              tintColor="#6A9AA9"
            />
          }
          ListEmptyComponent={renderEmptyState}
          ListHeaderComponent={renderStats()}
        />
      )}
    </View>
  );
}

// Стили
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
  },
  placeholder: {
    width: 40,
  },
  filtersWrapper: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filtersContent: {
    paddingHorizontal: 15,
    alignItems: "center",
  },
  filterButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    minWidth: 80,
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  filterText: {
    fontSize: 14,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
  },
  filterTextActive: {
    color: "#000000",
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  listContent: {
    padding: 15,
    paddingBottom: 30,
  },
  statsContainer: {
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statsHeader: {
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
  },
  filterInfo: {
    fontSize: 14,
    color: "#6A9AA9",
    marginTop: 4,
    fontFamily: "Playfair Display Regular",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statCardValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginVertical: 6,
    fontFamily: "Playfair Display Bold",
  },
  statCardLabel: {
    fontSize: 11,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  postCard: {
    backgroundColor: "#C2DAE2",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 2,
    borderColor: "#6A9AA9",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  userAvatarContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  userDetails: {
    flex: 1,
  },
  userNameContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginRight: 6,
    fontFamily: "Playfair Display Regular",
  },
  postTime: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
    fontFamily: "Playfair Display Regular",
  },
  headerRight: {
    alignItems: "flex-end",
  },
  typeAndDeleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  postTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  postTypeText: {
    fontSize: 12,
    color: "#000",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },

  postContent: {
    marginBottom: 12,
  },
  postTitle: {
    fontSize: 18,
    color: "#333",
    marginBottom: 8,
    fontFamily: "Playfair Display Bold",
  },
  postText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
    fontFamily: "Playfair Display Regular",
  },
  imageSliderContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: "hidden",
    height: 300,
    position: "relative",
    backgroundColor: "#000",
  },
  slide: {
    width: SCREEN_WIDTH - 62,
    height: 300,
    justifyContent: "center",
    alignItems: "center",
  },
  postImage: {
    width: "100%",
    height: "100%",
  },
  navButton: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  prevButton: {
    left: 8,
  },
  nextButton: {
    right: 8,
  },
  imageCounter: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  postStats: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#6A9AA9",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  statText: {
    fontSize: 14,
    color: "#6A9AA9",
    marginLeft: 6,
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  likedText: {
    color: "#FF6B6B",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 20,
    color: "#1a1a1a",
    marginTop: 16,
    marginBottom: 8,
    fontFamily: "Playfair Display Bold",
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    fontFamily: "Playfair Display Regular",
  },
  createPostButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9BDF11",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    borderWidth: 2,
    borderColor: "#6A9AA9",
  },
  createPostButtonText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
});
