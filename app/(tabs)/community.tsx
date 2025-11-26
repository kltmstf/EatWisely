import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ProfileMenu from "../components/ProfileMenu";
import { db } from "../firebase/config";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// Типы для постов
interface CommunityPost {
  id: string;
  userName: string;
  userAvatar: any;
  postType: string;
  title: string;
  content: string;
  image?: any;
  likes: number;
  comments: number;
  timeAgo: string;
  verified: boolean;
  liked: boolean;
}

interface Comment {
  id: string;
  userName: string;
  content: string;
  timeAgo: string;
  userId: string;
}

export default function Community() {
  const router = useRouter();
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("Все");
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPostModalVisible, setAddPostModalVisible] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    postType: "Рецепты",
  });
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userData, setUserData] = useState({
    name: "Гость",
    id: null as string | null,
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const filters = ["Все", "Рецепты", "Вопросы", "Отзывы", "Советы"];

  // Отслеживаем состояние аутентификации
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Пользователь авторизован
        setCurrentUser(user);
        setUserData({
          name: user.displayName || user.email || "Пользователь",
          id: user.uid,
        });
        setIsAuthenticated(true);
        console.log("Пользователь авторизован:", user.uid);

        // Перезагружаем посты для обновления статуса лайков
        loadPosts();
      } else {
        // Пользователь не авторизован
        setCurrentUser(null);
        setUserData({
          name: "Гость",
          id: null,
        });
        setIsAuthenticated(false);
        console.log("Пользователь не авторизован");

        // Сбрасываем все лайки в локальном состоянии
        setCommunityPosts((prev) =>
          prev.map((post) => ({ ...post, liked: false }))
        );
      }
    });

    return unsubscribe;
  }, []);

  // Моковые данные для fallback
  const getMockPosts = (): CommunityPost[] => [
    {
      id: "1",
      userName: "Анна Петрова",
      userAvatar: require("@/assets/images/people-icon.png"),
      postType: "Рецепты",
      title: "Полезный завтрак на неделю",
      content:
        "Поделюсь своими любимыми рецептами полезных завтраков, которые готовлю каждое утро! 🍓🥣",
      image: null,
      likes: 24,
      comments: 8,
      timeAgo: "2 часа назад",
      verified: true,
      liked: false,
    },
    {
      id: "2",
      userName: "Максим Иванов",
      userAvatar: require("@/assets/images/people-icon.png"),
      postType: "Вопросы",
      title: "Как разнообразить рацион?",
      content:
        "Ребята, подскажите идеи для разнообразия питания. Надоело есть одно и то же каждый день...",
      image: null,
      likes: 15,
      comments: 12,
      timeAgo: "5 часов назад",
      verified: false,
      liked: false,
    },
    {
      id: "3",
      userName: "Елена Сидорова",
      userAvatar: require("@/assets/images/people-icon.png"),
      postType: "Отзывы",
      title: "Результат за 3 месяца",
      content:
        "С помощью EatWisely похудела на 8 кг! Спасибо за отличные рецепты и поддержку сообщества! 💪",
      image: null,
      likes: 42,
      comments: 15,
      timeAgo: "1 день назад",
      verified: true,
      liked: false,
    },
  ];

  // Загрузка постов из Firebase
  const loadPosts = async () => {
    try {
      setLoading(true);
      const postsQuery = query(
        collection(db, "community_posts"),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(postsQuery);
      const posts: CommunityPost[] = [];

      // Проверяем лайки только если пользователь авторизован
      let userLikedPosts: string[] = [];
      if (isAuthenticated && userData.id) {
        try {
          const userLikesQuery = query(
            collection(db, "likes"),
            where("userId", "==", userData.id)
          );
          const userLikesSnapshot = await getDocs(userLikesQuery);
          userLikedPosts = userLikesSnapshot.docs.map(
            (doc) => doc.data().postId
          );
          console.log("Найдены лайки пользователя:", userLikedPosts);
        } catch (error) {
          console.error("Ошибка загрузки лайков:", error);
        }
      }

      querySnapshot.forEach((doc) => {
        const data = doc.data();

        posts.push({
          id: doc.id,
          userName: data.userName || "Анонимный пользователь",
          userAvatar: require("@/assets/images/people-icon.png"),
          postType: data.postType || "Рецепты",
          title: data.title,
          content: data.content,
          image: data.image ? { uri: data.image } : null,
          likes: data.likes || 0,
          comments: data.comments || 0,
          timeAgo: formatTimeAgo(data.createdAt?.toDate() || new Date()),
          verified: data.verified || false,
          liked: userLikedPosts.includes(doc.id),
        });
      });

      setCommunityPosts(posts);
    } catch (error) {
      console.error("Ошибка загрузки постов:", error);
      setCommunityPosts(getMockPosts());
    } finally {
      setLoading(false);
    }
  };

  // Загрузка комментариев
  const loadComments = async (postId: string) => {
    try {
      const commentsQuery = query(
        collection(db, "comments"),
        where("postId", "==", postId)
      );

      const querySnapshot = await getDocs(commentsQuery);
      const loadedComments: Comment[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Убедитесь, что userId всегда строка
        const userId = data.userId || "unknown_user";
        loadedComments.push({
          id: doc.id,
          userName: data.userName || "Аноним",
          content: data.content,
          timeAgo: formatTimeAgo(data.createdAt?.toDate() || new Date()),
          userId: userId, // Теперь всегда string
        });
      });

      // Сортируем по времени (новые сверху)
      loadedComments.sort((a, b) => {
        return new Date(b.timeAgo).getTime() - new Date(a.timeAgo).getTime();
      });

      setComments(loadedComments);
    } catch (error) {
      console.error("Ошибка загрузки комментариев:", error);
      setComments([]);
    }
  };

  // Функция для форматирования времени
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

  // Добавление нового поста
  const handleAddPost = async () => {
    // ПРОВЕРКА АВТОРИЗАЦИИ
    if (!isAuthenticated || !userData.id) {
      Alert.alert("Ошибка", "Необходимо войти в аккаунт");
      return;
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      Alert.alert("Ошибка", "Заполните заголовок и содержание поста");
      return;
    }

    try {
      const postData = {
        title: newPost.title,
        content: newPost.content,
        postType: newPost.postType,
        userName: userData.name,
        userId: userData.id,
        likes: 0,
        comments: 0,
        verified: true,
        likedBy: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, "community_posts"), postData);

      setNewPost({
        title: "",
        content: "",
        postType: "Рецепты",
      });
      setAddPostModalVisible(false);
      await loadPosts();

      Alert.alert("Успех", "Пост успешно опубликован!");
    } catch (error: any) {
      console.error("Ошибка добавления поста:", error);
      
      // ОБРАБОТКА ОШИБОК АВТОРИЗАЦИИ
      if (error.code === 'auth/admin-restricted-operation' || 
          error.code === 'permission-denied' ||
          error.code === 'unauthenticated') {
        Alert.alert("Ошибка", "Необходимо войти в аккаунт");
        setIsAuthenticated(false);
      } else {
        Alert.alert("Ошибка", "Не удалось опубликовать пост");
      }
    }
  };

  // Лайк поста - исправленная версия
  const handleLike = async (postId: string) => {
    try {
      // ПРОВЕРКА АВТОРИЗАЦИИ ДО ЛЮБЫХ ДЕЙСТВИЙ
      if (!isAuthenticated || !userData.id) {
        Alert.alert("Ошибка", "Необходимо войти в аккаунт");
        return;
      }

      const postRef = doc(db, "community_posts", postId);
      const post = communityPosts.find((p) => p.id === postId);

      if (!post) return;

      const newLikedState = !post.liked;
      const newLikesCount = newLikedState ? post.likes + 1 : post.likes - 1;

      // Обновляем локальное состояние
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: newLikedState, likes: newLikesCount }
            : p
        )
      );

      if (newLikedState) {
        // Добавляем лайк
        await Promise.all([
          updateDoc(postRef, {
            likes: newLikesCount,
            likedBy: arrayUnion(userData.id),
          }),
          addDoc(collection(db, "likes"), {
            postId: postId,
            userId: userData.id,
            createdAt: Timestamp.now(),
          }),
        ]);
        console.log("Лайк добавлен для пользователя:", userData.id);
      } else {
        // Удаляем лайк
        const likesQuery = query(
          collection(db, "likes"),
          where("postId", "==", postId),
          where("userId", "==", userData.id)
        );

        const likesSnapshot = await getDocs(likesQuery);

        const updatePromises = [
          updateDoc(postRef, {
            likes: newLikesCount,
            likedBy: arrayRemove(userData.id),
          }),
        ];

        // Удаляем все найденные лайки
        likesSnapshot.forEach((likeDoc) => {
          updatePromises.push(deleteDoc(doc(db, "likes", likeDoc.id)));
        });

        await Promise.all(updatePromises);
        console.log("Лайк удален для пользователя:", userData.id);
      }
    } catch (error: any) {
      console.error("Ошибка лайка:", error);

      // Откатываем локальное состояние
      const post = communityPosts.find((p) => p.id === postId);
      if (post) {
        setCommunityPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, liked: post.liked, likes: post.likes } : p
          )
        );
      }

      // ОБРАБОТКА ОШИБОК АВТОРИЗАЦИИ
      if (error.code === "auth/admin-restricted-operation" || 
          error.code === "permission-denied" ||
          error.code === "unauthenticated") {
        Alert.alert("Ошибка", "Необходимо войти в аккаунт");
        setIsAuthenticated(false);
      } else {
        Alert.alert("Ошибка", "Не удалось обновить лайк");
      }
    }
  };

  // Добавление комментария
  const handleAddComment = async () => {
    // ПРОВЕРКА АВТОРИЗАЦИИ
    if (!isAuthenticated || !userData.id) {
      Alert.alert("Ошибка", "Необходимо войти в аккаунт");
      return;
    }

    if (!newComment.trim() || !selectedPost) {
      Alert.alert("Ошибка", "Введите текст комментария");
      return;
    }

    try {
      const commentData = {
        postId: selectedPost.id,
        userName: userData.name,
        userId: userData.id, // Теперь точно string, т.к. прошли проверку выше
        content: newComment.trim(),
        createdAt: Timestamp.now(),
        likesCount: 0,
        parentCommentId: null,
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, "comments"), commentData);

      // Обновляем счетчик комментариев в посте
      const postRef = doc(db, "community_posts", selectedPost.id);
      await updateDoc(postRef, {
        comments: (selectedPost.comments || 0) + 1,
      });

      // Обновляем локальное состояние
      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id ? { ...p, comments: (p.comments || 0) + 1 } : p
        )
      );

      // Добавляем комментарий в локальное состояние
      const newCommentObj: Comment = {
        id: docRef.id,
        userName: userData.name,
        content: newComment.trim(),
        timeAgo: "только что",
        userId: userData.id,
      };

      setComments((prev) => [...prev, newCommentObj]);
      setNewComment("");
      
    } catch (error: any) {
      console.error("Ошибка добавления комментария:", error);
      
      // ОБРАБОТКА ОШИБОК АВТОРИЗАЦИИ
      if (error.code === 'auth/admin-restricted-operation' || 
          error.code === 'permission-denied' ||
          error.code === 'unauthenticated') {
        Alert.alert("Ошибка", "Необходимо войти в аккаунт");
        setIsAuthenticated(false);
      } else {
        Alert.alert("Ошибка", "Не удалось добавить комментарий");
      }
    }
  };

  // Поделиться постом
  const handleShare = async (post: CommunityPost) => {
    try {
      const shareContent = `${post.title}\n\n${post.content}\n\n— ${post.userName}`;

      Alert.alert("Поделиться постом", shareContent, [
        { text: "Скопировать", onPress: () => console.log("Скопировано") },
        { text: "Отмена", style: "cancel" },
      ]);
    } catch (error) {
      console.error("Ошибка шаринга:", error);
    }
  };

  // Открытие комментариев
  const openComments = async (post: CommunityPost) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
    await loadComments(post.id);
  };

  useEffect(() => {
    loadPosts();
  }, [isAuthenticated]); // Перезагружаем посты при изменении статуса аутентификации

  const filteredPosts = communityPosts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      selectedFilter === "Все" || post.postType === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const handleProfileMenu = () => {
    setProfileMenuVisible(!profileMenuVisible);
  };

  if (loading) {
    return (
      <View style={styles.background}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6A9AA9" />
          <Text style={styles.loadingText}>Загрузка постов...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Верхнее меню с приветствием */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>Сообщество</Text>
            <Text style={styles.dietText}>
              {isAuthenticated
                ? "Обсуждайте питание, делитесь отзывами и получайте советы"
                : "Войдите для взаимодействия"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfileMenu}
          >
            <Image
              source={require("@/assets/images/people-icon.png")}
              style={styles.profileImage}
            />
            {!isAuthenticated && (
              <View style={styles.guestBadge}>
                <Text style={styles.guestBadgeText}>Гость</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Компонент меню профиля */}
        <ProfileMenu
          visible={profileMenuVisible}
          onClose={() => setProfileMenuVisible(false)}
          userName={userData.name}
        />

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {/* Поиск и фильтры */}
          <View style={styles.searchSection}>
            {/* Фильтры */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filtersContainer}
            >
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterButton,
                    selectedFilter === filter && styles.filterButtonActive,
                  ]}
                  onPress={() => setSelectedFilter(filter)}
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

            {/* Поле поиска с кнопкой создания поста */}
            <View style={styles.searchRow}>
              <View style={styles.searchInputContainer}>
                <Feather
                  name="search"
                  size={16}
                  color="#666"
                  style={styles.searchIcon}
                />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Поиск в сообществе..."
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.addPostButton,
                  !isAuthenticated && styles.disabledButton,
                ]}
                onPress={() => {
                  // ПРОВЕРКА ПРИ НАЖАТИИ НА КНОПКУ
                  if (!isAuthenticated) {
                    Alert.alert("Ошибка", "Необходимо войти в аккаунт");
                    return;
                  }
                  setAddPostModalVisible(true);
                }}
                disabled={!isAuthenticated}
              >
                <Feather
                  name="edit-3"
                  size={20}
                  color={isAuthenticated ? "#000" : "#ccc"}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.sectionDivider} />
          </View>

          {/* Посты сообщества */}
          <View style={styles.postsSection}>
            <Text style={styles.postsTitle}>
              {filteredPosts.length} постов найдено
            </Text>

            {/* Список постов */}
            <View style={styles.postsList}>
              {filteredPosts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  {/* Заголовок поста и пользователь */}
                  <View style={styles.postHeader}>
                    <View style={styles.userInfo}>
                      <Image
                        source={post.userAvatar}
                        style={styles.userAvatar}
                      />
                      <View style={styles.userDetails}>
                        <View style={styles.userNameContainer}>
                          <Text style={styles.userName}>{post.userName}</Text>
                          {post.verified && (
                            <MaterialIcons
                              name="verified"
                              size={14}
                              color="#000000ff"
                            />
                          )}
                        </View>
                        <Text style={styles.postTime}>{post.timeAgo}</Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.postTypeBadge,
                        { backgroundColor: getPostTypeColor(post.postType) },
                      ]}
                    >
                      <Text style={styles.postTypeText}>{post.postType}</Text>
                    </View>
                  </View>

                  {/* Контент поста */}
                  <TouchableOpacity
                    style={styles.postContent}
                    onPress={() => console.log("Переход к посту:", post.title)}
                  >
                    <Text style={styles.postTitle}>{post.title}</Text>
                    <Text style={styles.postText}>{post.content}</Text>
                  </TouchableOpacity>

                  {/* Действия с постом */}
                  <View style={styles.postActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
                        // ПРОВЕРКА ПРИ НАЖАТИИ НА ЛАЙК
                        if (!isAuthenticated) {
                          Alert.alert("Ошибка", "Необходимо войти в аккаунт");
                          return;
                        }
                        handleLike(post.id);
                      }}
                    >
                      <MaterialIcons
                        name={post.liked ? "favorite" : "favorite-border"}
                        size={16}
                        color={post.liked ? "#FF6B6B" : "#6A9AA9"}
                      />
                      <Text
                        style={[
                          styles.actionText,
                          post.liked && styles.actionTextLiked,
                        ]}
                      >
                        {post.likes}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openComments(post)}
                    >
                      <Feather
                        name="message-circle"
                        size={16}
                        color="#6A9AA9"
                      />
                      <Text style={styles.actionText}>{post.comments}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleShare(post)}
                    >
                      <Feather name="share-2" size={16} color="#6A9AA9" />
                      <Text style={styles.actionText}>Поделиться</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {filteredPosts.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Посты не найдены</Text>
                <Text style={styles.emptyStateSubtext}>
                  Попробуйте изменить параметры поиска
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Модальное окно добавления поста */}
        <Modal
          visible={addPostModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAddPostModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Создать новый пост</Text>
                <TouchableOpacity onPress={() => setAddPostModalVisible(false)}>
                  <Feather name="x" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody}>
                <Text style={styles.inputLabel}>Тип поста</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.postTypeSelector}
                >
                  {filters
                    .filter((f) => f !== "Все")
                    .map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.postTypeOption,
                          newPost.postType === type &&
                            styles.postTypeOptionActive,
                        ]}
                        onPress={() =>
                          setNewPost({ ...newPost, postType: type })
                        }
                      >
                        <Text
                          style={[
                            styles.postTypeOptionText,
                            newPost.postType === type &&
                              styles.postTypeOptionTextActive,
                          ]}
                        >
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Заголовок</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Введите заголовок поста..."
                  value={newPost.title}
                  onChangeText={(text) =>
                    setNewPost({ ...newPost, title: text })
                  }
                />

                <Text style={styles.inputLabel}>Содержание</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Расскажите что-нибудь интересное..."
                  value={newPost.content}
                  onChangeText={(text) =>
                    setNewPost({ ...newPost, content: text })
                  }
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setAddPostModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleAddPost}
                >
                  <Text style={styles.submitButtonText}>Опубликовать</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Модальное окно комментариев */}
        <Modal
          visible={commentsModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setCommentsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.commentsModal]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Комментарии ({comments.length})
                </Text>
                <TouchableOpacity
                  onPress={() => setCommentsModalVisible(false)}
                >
                  <Feather name="x" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.commentsContainer}>
                <ScrollView
                  style={styles.commentsList}
                  showsVerticalScrollIndicator={true}
                >
                  {comments.length > 0 ? (
                    comments.map((comment) => (
                      <View key={comment.id} style={styles.commentItem}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentUserName}>
                            {comment.userName}
                          </Text>
                          <Text style={styles.commentTime}>
                            {comment.timeAgo}
                          </Text>
                        </View>
                        <Text style={styles.commentContent}>
                          {comment.content}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View style={styles.noComments}>
                      <Text style={styles.noCommentsText}>
                        Пока нет комментариев
                      </Text>
                      <Text style={styles.noCommentsSubtext}>
                        Будьте первым!
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>

              <View style={styles.commentInputContainer}>
                <TextInput
                  style={styles.commentInput}
                  placeholder={
                    isAuthenticated
                      ? "Напишите комментарий..."
                      : "Войдите для комментирования"
                  }
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                  maxLength={500}
                  editable={isAuthenticated}
                />
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    (!newComment.trim() || !isAuthenticated) &&
                      styles.sendButtonDisabled,
                  ]}
                  onPress={handleAddComment}
                  disabled={!newComment.trim() || !isAuthenticated}
                >
                  <Feather
                    name="send"
                    size={20}
                    color={
                      newComment.trim() && isAuthenticated ? "#fff" : "#ccc"
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

// Функция для цветов типов постов
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
;

// Стили (остаются без изменений)
const styles = StyleSheet.create({
  // ... все стили остаются такими же как в предыдущем коде
  background: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  headerTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 24,
    color: "#1a1a1a",
    marginBottom: 4,
    fontFamily: "Playfair Display Bold",
  },
  dietText: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginRight: 20,
  },
  profileButton: {
    width: 55,
    height: 55,
    borderRadius: 25,
    overflow: "hidden",
  },
  guestBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#FF6B6B",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  guestBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Playfair Display Bold",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: "#fff",
    padding: 15,
    marginBottom: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffffff",
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#6A9AA9",
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#000",
    paddingVertical: 4,
    fontFamily: "Playfair Display Regular",
  },
  filtersContainer: {
    marginBottom: 12,
  },
  filterButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
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
  },
  addPostButton: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    width: 44,
    height: 44,
  },
  disabledButton: {
    borderColor: "#ccc",
    backgroundColor: "#f0f0f0",
  },
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -15,
    marginTop: 12,
  },
  postsSection: {
    backgroundColor: "#fff",
    padding: 15,
    paddingBottom: 20,
  },
  postsTitle: {
    fontSize: 16,
    color: "#000000ff",
    marginBottom: 12,
    fontFamily: "Playfair Display Bold",
  },
  postsList: {
    paddingBottom: 20,
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
    marginBottom: 12,
    fontFamily: "Playfair Display Bold",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  userAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
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
  postActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 2,
    borderTopColor: "#6A9AA9",
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  actionText: {
    fontSize: 14,
    color: "#6A9AA9",
    marginLeft: 6,
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  actionTextLiked: {
    color: "#FF6B6B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  commentsModal: {
    maxHeight: "85%",
    height: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  commentsContainer: {
    flex: 1,
    minHeight: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
    fontFamily: "Playfair Display Regular",
  },
  textInput: {
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#f8f9fa",
    fontFamily: "Playfair Display Regular",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  postTypeSelector: {
    marginBottom: 8,
  },
  postTypeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#6A9AA9",
    marginRight: 8,
    backgroundColor: "#f8f9fa",
  },
  postTypeOptionActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  postTypeOptionText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  postTypeOptionTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#6A9AA9",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  submitButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#9BDF11",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#6A9AA9",
  },
  submitButtonText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  commentItem: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a1a1a",
    fontFamily: "Playfair Display Regular",
  },
  commentTime: {
    fontSize: 12,
    color: "#888",
    fontFamily: "Playfair Display Regular",
  },
  commentContent: {
    fontSize: 14,
    color: "#444",
    lineHeight: 20,
    fontFamily: "Playfair Display Regular",
  },
  commentInputContainer: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    alignItems: "flex-end",
    backgroundColor: "#fff",
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#6A9AA9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 12,
    backgroundColor: "#f8f9fa",
    fontFamily: "Playfair Display Regular",
  },
  sendButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: "#6A9AA9",
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
  noComments: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  noCommentsText: {
    fontSize: 16,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
  },
  noCommentsSubtext: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
});
