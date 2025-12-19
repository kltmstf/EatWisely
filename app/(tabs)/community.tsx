import { Feather, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
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
import React, { useEffect, useState, useRef, useCallback } from "react";
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
  Dimensions,
  FlatList,
  Animated,
  RefreshControl,
} from "react-native";
import { db } from "../firebase/config";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { communityCloudinaryService, uploadCommunityPostImage } from "@/app/services/cloudinaryService";
import type { UploadResult, UploadProgress } from "@/app/services/cloudinaryService";

// Импортируем userService для получения фото профиля
import { userService } from "@/app/services/userService";

// Получаем размеры экрана
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Оптимальные размеры для постов
const POST_IMAGE_SIZE = {
  WIDTH: 1080,
  HEIGHT: 1080,
  MAX_FILE_SIZE: 2 * 1024 * 1024,
  QUALITY: 0.85,
};

// Типы для постов
interface CommunityPost {
  id: string;
  userName: string;
  userAvatar: string | null; // Изменено на string | null для хранения URL фото
  userId: string; // Добавлено поле для ID пользователя
  postType: string;
  title: string;
  content: string;
  images?: string[];
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

// Тип для изображений перед загрузкой
interface PostImage {
  id: string;
  uri: string;
  name: string;
  type: string;
  size?: number;
  uploaded?: boolean;
  uploadProgress?: number;
  cloudinaryUrl?: string;
  publicId?: string;
  error?: string;
}

// ========== ФУНКЦИЯ ДЛЯ ОБРЕЗКИ И ОПТИМИЗАЦИИ ФОТО ==========

const optimizeImageForPost = async (
  imageUri: string,
  originalName?: string
): Promise<PostImage> => {
  try {
    console.log('Начинаем оптимизацию изображения...');
    
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      throw new Error('Файл не найден');
    }
    
    const originalSize = 'size' in fileInfo ? fileInfo.size as number : 0;
    console.log(`Оригинальный размер: ${Math.round(originalSize / 1024)} KB`);
    
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [
        {
          resize: {
            width: POST_IMAGE_SIZE.WIDTH,
            height: POST_IMAGE_SIZE.HEIGHT,
          },
        },
      ],
      {
        compress: POST_IMAGE_SIZE.QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      }
    );
    
    const optimizedInfo = await FileSystem.getInfoAsync(manipResult.uri);
    const optimizedSize = 'size' in optimizedInfo ? optimizedInfo.size as number : 0;
    
    console.log(`Оптимизированный размер: ${Math.round(optimizedSize / 1024)} KB`);
    console.log(`Сжатие: ${Math.round((optimizedSize / originalSize) * 100)}% от оригинала`);
    
    if (optimizedSize > POST_IMAGE_SIZE.MAX_FILE_SIZE) {
      console.log('Файл все еще большой, применяем дополнительное сжатие...');
      
      const furtherCompressed = await ImageManipulator.manipulateAsync(
        manipResult.uri,
        [],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      
      const finalInfo = await FileSystem.getInfoAsync(furtherCompressed.uri);
      const finalSize = 'size' in finalInfo ? finalInfo.size as number : 0;
      
      console.log(`Финальный размер после доп. сжатия: ${Math.round(finalSize / 1024)} KB`);
      
      return {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        uri: furtherCompressed.uri,
        name: originalName || `post_${Date.now()}.jpg`,
        type: 'image/jpeg',
        size: finalSize,
        uploaded: false,
        uploadProgress: 0,
      };
    }
    
    return {
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      uri: manipResult.uri,
      name: originalName || `post_${Date.now()}.jpg`,
      type: 'image/jpeg',
      size: optimizedSize,
      uploaded: false,
      uploadProgress: 0,
    };
    
  } catch (error) {
    console.error('Ошибка оптимизации изображения:', error);
    
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    const size = 'size' in fileInfo ? fileInfo.size as number : 0;
    
    return {
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      uri: imageUri,
      name: originalName || `post_${Date.now()}.jpg`,
      type: 'image/jpeg',
      size: size,
      uploaded: false,
      uploadProgress: 0,
    };
  }
};

// ========== КОМПОНЕНТ АВАТАРА С ФОТО ИЛИ ЗАГЛУШКОЙ ==========

interface AvatarProps {
  photoURL?: string | null;
  size?: number;
  onPress?: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ photoURL, size = 55, onPress }) => {
  const AvatarContent = () => {
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
    
    // Заглушка, если фото нет (аналогично ProfileScreen)
    return (
      <View style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#E5F0F5",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#9BDF11",
      }}>
        <Feather name="user" size={size * 0.4} color="#6A9AA9" />
      </View>
    );
  };

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress}>
        <AvatarContent />
      </TouchableOpacity>
    );
  }

  return <AvatarContent />;
};

export default function Community() {
  const router = useRouter();
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
    photoURL: null as string | null,
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfileLoading, setUserProfileLoading] = useState(false);
  const [userAvatars, setUserAvatars] = useState<Record<string, string | null>>({});

  // Состояние для работы с изображениями
  const [postImages, setPostImages] = useState<PostImage[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSelectingImages, setIsSelectingImages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const filters = ["Все", "Рецепты", "Вопросы", "Отзывы", "Советы"];
  
  // Настройки для изображений
  const IMAGE_SETTINGS = {
    maxImagesPerPost: 10,
    maxFileSize: 10 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'],
  };

  // Функция для загрузки фото профиля пользователя
  const loadUserProfilePhoto = useCallback(async (userId: string) => {
    if (!userId) return null;
    
    try {
      setUserProfileLoading(true);
      
      // 1. Пробуем загрузить из Firestore через userService
      const profileData = await userService.fetchUserProfile(userId);
      if (profileData?.photoURL) {
        console.log("✅ Фото профиля загружено из Firestore");
        return profileData.photoURL;
      }
      
      // 2. Если в Firestore нет, проверяем Firebase Auth
      const auth = getAuth();
      if (auth.currentUser?.photoURL) {
        console.log("✅ Фото профиля загружено из Firebase Auth");
        return auth.currentUser.photoURL;
      }
      
      console.log("❌ Фото профиля не найдено");
      return null;
    } catch (error) {
      console.error("Ошибка загрузки фото профиля:", error);
      return null;
    } finally {
      setUserProfileLoading(false);
    }
  }, []);

  // Функция для загрузки фото профиля для списка пользователей
  const loadUserAvatarForPost = useCallback(async (userId: string, userName: string) => {
    if (!userId) return null;
    
    try {
      // Проверяем, есть ли уже аватар в кэше
      if (userAvatars[userId]) {
        return userAvatars[userId];
      }
      
      // Загружаем из Firestore
      const profileData = await userService.fetchUserProfile(userId);
      if (profileData?.photoURL) {
        setUserAvatars(prev => ({ ...prev, [userId]: profileData.photoURL }));
        return profileData.photoURL;
      }
      
      return null;
    } catch (error) {
      console.error(`Ошибка загрузки аватара для пользователя ${userName}:`, error);
      return null;
    }
  }, [userAvatars]);

  // Обработчик нажатия на иконку профиля
  const handleProfilePress = () => {
    router.push('/profile');
  };

  // Отслеживаем состояние аутентификации и загружаем фото профиля
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Загружаем фото профиля
        const photoURL = await loadUserProfilePhoto(user.uid);
        
        setUserData({
          name: user.displayName || user.email || "Пользователь",
          id: user.uid,
          photoURL: photoURL,
        });
        setIsAuthenticated(true);
        console.log("Пользователь авторизован:", user.uid);
        loadPosts();
      } else {
        setCurrentUser(null);
        setUserData({
          name: "Гость",
          id: null,
          photoURL: null,
        });
        setIsAuthenticated(false);
        console.log("Пользователь не авторизован");
        setCommunityPosts((prev) =>
          prev.map((post) => ({ ...post, liked: false }))
        );
      }
    });

    return unsubscribe;
  }, [loadUserProfilePhoto]);

  // Автоматическое обновление при возврате на экран
  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [])
  );

  // ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ИЗОБРАЖЕНИЯМИ ==========

  const checkPermissions = async () => {
    const galleryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    
    if (galleryStatus.status !== 'granted' || cameraStatus.status !== 'granted') {
      Alert.alert(
        'Требуются разрешения',
        'Для загрузки фото необходимы разрешения на доступ к камере и галерее'
      );
      return false;
    }
    return true;
  };

  const pickImageFromGallery = async () => {
    if (!isAuthenticated) {
      Alert.alert("Ошибка", "Необходимо войти в аккаунт");
      return;
    }

    if (postImages.length >= IMAGE_SETTINGS.maxImagesPerPost) {
      Alert.alert(
        "Лимит фото",
        `Можно добавить не более ${IMAGE_SETTINGS.maxImagesPerPost} фото`
      );
      return;
    }

    const hasPermission = await checkPermissions();
    if (!hasPermission) return;

    try {
      setIsSelectingImages(true);
      
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: IMAGE_SETTINGS.maxImagesPerPost - postImages.length,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newImages: PostImage[] = [];
        let processedCount = 0;
        
        for (const asset of result.assets) {
          try {
            const optimizedImage = await optimizeImageForPost(
              asset.uri,
              asset.fileName || undefined
            );
            
            newImages.push(optimizedImage);
            processedCount++;
            
            const progress = Math.round((processedCount / result.assets.length) * 100);
            console.log(`Обработано ${processedCount}/${result.assets.length} фото (${progress}%)`);
            
          } catch (error) {
            console.error(`Ошибка обработки фото ${asset.fileName}:`, error);
            
            const fileInfo = await FileSystem.getInfoAsync(asset.uri);
            let fileSize = 0;
            
            if (fileInfo.exists && 'size' in fileInfo) {
              fileSize = fileInfo.size as number;
              if (fileSize > IMAGE_SETTINGS.maxFileSize) {
                Alert.alert(
                  "Файл слишком большой",
                  `Файл "${asset.fileName || 'изображение'}" превышает лимит 10MB`
                );
                continue;
              }
            }

            const image: PostImage = {
              id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              uri: asset.uri,
              name: asset.fileName || `image_${Date.now()}.jpg`,
              type: asset.mimeType || 'image/jpeg',
              size: fileSize,
              uploaded: false,
              uploadProgress: 0,
            };
            newImages.push(image);
          }
        }

        if (newImages.length > 0) {
          setPostImages(prev => [...prev, ...newImages]);
        }
      }
    } catch (error) {
      console.error("Ошибка выбора фото:", error);
      Alert.alert("Ошибка", "Не удалось выбрать фото");
    } finally {
      setIsSelectingImages(false);
    }
  };

  const takePhotoWithCamera = async () => {
    if (!isAuthenticated) {
      Alert.alert("Ошибка", "Необходимо войти в аккаунт");
      return;
    }

    if (postImages.length >= IMAGE_SETTINGS.maxImagesPerPost) {
      Alert.alert(
        "Лимит фото",
        `Можно добавить не более ${IMAGE_SETTINGS.maxImagesPerPost} фото`
      );
      return;
    }

    const hasPermission = await checkPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        
        try {
          const optimizedImage = await optimizeImageForPost(
            asset.uri,
            `camera_${Date.now()}.jpg`
          );
          
          setPostImages(prev => [...prev, optimizedImage]);
          
        } catch (optimizeError) {
          console.error("Ошибка оптимизации фото с камеры:", optimizeError);
          
          const fileInfo = await FileSystem.getInfoAsync(asset.uri);
          let fileSize = 0;
          
          if (fileInfo.exists && 'size' in fileInfo) {
            fileSize = fileInfo.size as number;
            if (fileSize > IMAGE_SETTINGS.maxFileSize) {
              Alert.alert(
                "Файл слишком большой",
                "Фото превышает лимит 10MB"
              );
              return;
            }
          }

          const image: PostImage = {
            id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            uri: asset.uri,
            name: `camera_${Date.now()}.jpg`,
            type: asset.mimeType || 'image/jpeg',
            size: fileSize,
            uploaded: false,
            uploadProgress: 0,
          };

          setPostImages(prev => [...prev, image]);
        }
      }
    } catch (error) {
      console.error("Ошибка съемки фото:", error);
      Alert.alert("Ошибка", "Не удалось сделать фото");
    }
  };

  const removeImage = (imageId: string) => {
    setPostImages(prev => prev.filter(img => img.id !== imageId));
  };

  const uploadAllImages = async (): Promise<string[]> => {
    if (postImages.length === 0) return [];
    
    setIsUploadingImages(true);
    setUploadProgress(0);
    
    const uploadedUrls: string[] = [];
    
    try {
      for (let i = 0; i < postImages.length; i++) {
        const image = postImages[i];
        
        setPostImages(prev => prev.map((img, idx) => 
          idx === i ? { ...img, uploadProgress: 10 } : img
        ));
        
        const result = await uploadCommunityPostImage(
          image.uri,
          (progress) => {
            setPostImages(prev => prev.map((img, idx) => 
              idx === i ? { ...img, uploadProgress: progress.percent } : img
            ));
            
            const totalProgress = (i / postImages.length * 100) + (progress.percent / postImages.length);
            setUploadProgress(totalProgress);
          }
        );
        
        if (result.success && result.url) {
          setPostImages(prev => prev.map((img, idx) => 
            idx === i ? { 
              ...img, 
              uploaded: true, 
              cloudinaryUrl: result.url,
              publicId: result.publicId,
              uploadProgress: 100 
            } : img
          ));
          
          uploadedUrls.push(result.url);
        } else {
          setPostImages(prev => prev.map((img, idx) => 
            idx === i ? { 
              ...img, 
              error: result.error || 'Ошибка загрузки',
              uploadProgress: 0 
            } : img
          ));
          
          throw new Error(`Ошибка загрузки изображения ${i + 1}: ${result.error}`);
        }
      }
      
      return uploadedUrls;
      
    } catch (error: any) {
      console.error("Ошибка загрузки изображений:", error);
      throw error;
    } finally {
      setIsUploadingImages(false);
      setUploadProgress(0);
    }
  };

  const clearAllImages = () => {
    setPostImages([]);
  };

  // Функция для полного сброса состояния модального окна
  const resetAddPostModal = () => {
    setNewPost({
      title: "",
      content: "",
      postType: "Рецепты",
    });
    clearAllImages();
    setAddPostModalVisible(false);
  };

  // ========== ОСНОВНЫЕ ФУНКЦИИ ==========

  // Pull-to-refresh функция
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPosts();
    setRefreshing(false);
  }, []);

  const getMockPosts = (): CommunityPost[] => [
    {
      id: "1",
      userName: "Анна Петрова",
      userAvatar: null,
      userId: "mock1",
      postType: "Рецепты",
      title: "Полезный завтрак на неделю",
      content: "Поделюсь своими любимыми рецептами полезных завтраков, которые готовлю каждое утро! 🍓🥣",
      images: [],
      likes: 24,
      comments: 8,
      timeAgo: "2 часа назад",
      verified: true,
      liked: false,
    },
    {
      id: "2",
      userName: "Максим Иванов",
      userAvatar: null,
      userId: "mock2",
      postType: "Вопросы",
      title: "Как разнообразить рацион?",
      content: "Ребята, подскажите идеи для разнообразия питания. Надоело есть одно и то же каждый день...",
      images: [],
      likes: 15,
      comments: 12,
      timeAgo: "5 часов назад",
      verified: false,
      liked: false,
    },
    {
      id: "3",
      userName: "Елена Сидорова",
      userAvatar: null,
      userId: "mock3",
      postType: "Отзывы",
      title: "Результат за 3 месяца",
      content: "С помощью EatWisely похудела на 8 кг! Спасибо за отличные рецепты и поддержку сообщества! 💪",
      images: [],
      likes: 42,
      comments: 15,
      timeAgo: "1 день назад",
      verified: true,
      liked: false,
    },
  ];

  const loadPosts = async () => {
    try {
      setLoading(true);
      const postsQuery = query(
        collection(db, "community_posts"),
        orderBy("createdAt", "desc")
      );

      const querySnapshot = await getDocs(postsQuery);
      const posts: CommunityPost[] = [];

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
        } catch (error) {
          console.error("Ошибка загрузки лайков:", error);
        }
      }

      // Собираем ID пользователей для загрузки аватаров
      const userIds: string[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId || "unknown_user";
        if (userId && !userIds.includes(userId)) {
          userIds.push(userId);
        }
      });

      // Загружаем аватары для всех пользователей
      const avatarPromises = userIds.map(async (userId) => {
        const avatar = await loadUserAvatarForPost(userId, "unknown");
        return { userId, avatar };
      });

      const avatarResults = await Promise.all(avatarPromises);
      const avatarMap: Record<string, string | null> = {};
      avatarResults.forEach(({ userId, avatar }) => {
        avatarMap[userId] = avatar;
      });

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId || "unknown_user";

        const images = data.images || (data.image ? [data.image] : []);

        posts.push({
          id: doc.id,
          userName: data.userName || "Анонимный пользователь",
          userAvatar: avatarMap[userId] || null, // Используем загруженный аватар
          userId: userId,
          postType: data.postType || "Рецепты",
          title: data.title,
          content: data.content,
          images: images,
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
        const userId = data.userId || "unknown_user";
        loadedComments.push({
          id: doc.id,
          userName: data.userName || "Аноним",
          content: data.content,
          timeAgo: formatTimeAgo(data.createdAt?.toDate() || new Date()),
          userId: userId,
        });
      });

      loadedComments.sort((a, b) => {
        return new Date(b.timeAgo).getTime() - new Date(a.timeAgo).getTime();
      });

      setComments(loadedComments);
    } catch (error) {
      console.error("Ошибка загрузки комментариев:", error);
      setComments([]);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "только что";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} минут назад`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} часов назад`;
    return `${Math.floor(diffInSeconds / 86400)} дней назад`;
  };

  const handleAddPost = async () => {
    if (!isAuthenticated || !userData.id) {
      Alert.alert("Ошибка", "Необходимо войти в аккаунт");
      return;
    }

    if (!newPost.title.trim() || !newPost.content.trim()) {
      Alert.alert("Ошибка", "Заполните заголовок и содержание поста");
      return;
    }

    try {
      let imageUrls: string[] = [];
      
      if (postImages.length > 0) {
        try {
          imageUrls = await uploadAllImages();
          
          const failedImages = postImages.filter(img => !img.uploaded && img.error);
          if (failedImages.length > 0) {
            const shouldContinue = await new Promise((resolve) => {
              Alert.alert(
                'Некоторые фото не загрузились',
                'Продолжить публикацию без этих фото?',
                [
                  { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Продолжить', onPress: () => resolve(true) },
                ]
              );
            });

            if (!shouldContinue) {
              return;
            }
          }
        } catch (uploadError) {
          console.error("Ошибка загрузки изображений:", uploadError);
          
          const shouldContinue = await new Promise((resolve) => {
            Alert.alert(
              'Ошибка загрузки фото',
              'Продолжить публикацию без фото?',
              [
                { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Продолжить', onPress: () => resolve(true) },
              ]
            );
          });

          if (!shouldContinue) {
            return;
          }
        }
      }

      const postData = {
        title: newPost.title,
        content: newPost.content,
        postType: newPost.postType,
        userName: userData.name,
        userId: userData.id,
        images: imageUrls,
        image: imageUrls.length > 0 ? imageUrls[0] : null,
        likes: 0,
        comments: 0,
        verified: true,
        likedBy: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, "community_posts"), postData);

      resetAddPostModal();
      await loadPosts();
      
    } catch (error: any) {
      console.error("Ошибка добавления поста:", error);

      if (
        error.code === "auth/admin-restricted-operation" ||
        error.code === "permission-denied" ||
        error.code === "unauthenticated"
      ) {
        Alert.alert("Ошибка", "Необходимо войти в аккаунт");
        setIsAuthenticated(false);
      } else {
        Alert.alert("Ошибка", "Не удалось опубликовать пост");
      }
    }
  };

  const handleLike = async (postId: string) => {
    try {
      if (!isAuthenticated || !userData.id) {
        Alert.alert("Ошибка", "Необходимо войти в аккаунт");
        return;
      }

      const postRef = doc(db, "community_posts", postId);
      const post = communityPosts.find((p) => p.id === postId);

      if (!post) return;

      const newLikedState = !post.liked;
      const newLikesCount = newLikedState ? post.likes + 1 : post.likes - 1;

      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, liked: newLikedState, likes: newLikesCount }
            : p
        )
      );

      if (newLikedState) {
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
      } else {
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

        likesSnapshot.forEach((likeDoc) => {
          updatePromises.push(deleteDoc(doc(db, "likes", likeDoc.id)));
        });

        await Promise.all(updatePromises);
      }
    } catch (error: any) {
      console.error("Ошибка лайка:", error);

      const post = communityPosts.find((p) => p.id === postId);
      if (post) {
        setCommunityPosts((prev) =>
          prev.map((p) =>
            p.id === postId ? { ...p, liked: post.liked, likes: post.likes } : p
          )
        );
      }

      if (
        error.code === "auth/admin-restricted-operation" ||
        error.code === "permission-denied" ||
        error.code === "unauthenticated"
      ) {
        Alert.alert("Ошибка", "Необходимо войти в аккаунт");
        setIsAuthenticated(false);
      } else {
        Alert.alert("Ошибка", "Не удалось обновить лайк");
      }
    }
  };

  const handleAddComment = async () => {
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
        userId: userData.id,
        content: newComment.trim(),
        createdAt: Timestamp.now(),
        likesCount: 0,
        parentCommentId: null,
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, "comments"), commentData);

      const postRef = doc(db, "community_posts", selectedPost.id);
      await updateDoc(postRef, {
        comments: (selectedPost.comments || 0) + 1,
      });

      setCommunityPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id
            ? { ...p, comments: (p.comments || 0) + 1 }
            : p
        )
      );

      const newCommentObj: Comment = {
        id: docRef.id,
        userName: userData.name,
        content: newComment.trim(),
        timeAgo: "только что",
        userId: userData.id,
      };

      setComments((prev) => [newCommentObj, ...prev]);
      setNewComment("");
    } catch (error: any) {
      console.error("Ошибка добавления комментария:", error);

      if (
        error.code === "auth/admin-restricted-operation" ||
        error.code === "permission-denied" ||
        error.code === "unauthenticated"
      ) {
        Alert.alert("Ошибка", "Необходимо войти в аккаунт");
        setIsAuthenticated(false);
      } else {
        Alert.alert("Ошибка", "Не удалось добавить комментарий");
      }
    }
  };

  const handleShare = async (post: CommunityPost) => {
    try {
      const shareContent = `${post.title}\n\n${post.content}\n\n- ${post.userName}`;

      Alert.alert("Поделиться постом", shareContent, [
        { text: "Скопировать", onPress: () => console.log("Скопировано") },
        { text: "Отмена", style: "cancel" },
      ]);
    } catch (error) {
      console.error("Ошибка шаринга:", error);
    }
  };

  const openComments = async (post: CommunityPost) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
    await loadComments(post.id);
  };

  // ========== УЛУЧШЕННЫЙ КОМПОНЕНТ СЛАЙДЕРА ==========
  
  interface ImageSliderProps {
    images: string[];
    postId: string;
  }

  const ImageSlider: React.FC<ImageSliderProps> = ({ images, postId }) => {
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
        {/* Кнопки навигации */}
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <TouchableOpacity
                style={[styles.navButton, styles.prevButton]}
                onPress={handlePrev}
              >
                <Feather 
                  name="chevron-left" 
                  size={16} 
                  color="#fff" 
                />
              </TouchableOpacity>
            )}
            {currentIndex < images.length - 1 && (
              <TouchableOpacity
                style={[styles.navButton, styles.nextButton]}
                onPress={handleNext}
              >
                <Feather 
                  name="chevron-right" 
                  size={16} 
                  color="#fff" 
                />
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
        
        {/* Счетчик */}
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

  useEffect(() => {
    loadPosts();
  }, [isAuthenticated, loadUserAvatarForPost]);

  const filteredPosts = communityPosts.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      selectedFilter === "Все" || post.postType === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading && !refreshing) {
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

          <View style={styles.profileSection}>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={handleProfilePress}
            >
              {userProfileLoading ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator size="small" color="#6A9AA9" />
                </View>
              ) : (
                <Avatar 
                  photoURL={userData.photoURL} 
                  size={55} 
                  onPress={handleProfilePress}
                />
              )}
              {!isAuthenticated && (
                <View style={styles.guestBadge}>
                  <Text style={styles.guestBadgeText}>Гость</Text>
                </View>
              )}
            </TouchableOpacity>
            <Text style={styles.profileName}>{userData.name}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
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
          {/* Поиск и фильтры */}
          <View style={styles.searchSection}>
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

            <View style={styles.postsList}>
              {filteredPosts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={styles.userInfo}>
                      <View style={styles.userAvatarContainer}>
                        {/* Используем Avatar компонент для отображения фото пользователя */}
                        <Avatar 
                          photoURL={post.userAvatar} 
                          size={45}
                        />
                      </View>
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

                  <TouchableOpacity
                    style={styles.postContent}
                    onPress={() => console.log("Переход к посту:", post.title)}
                  >
                    <Text style={styles.postTitle}>{post.title}</Text>
                    <Text style={styles.postText}>{post.content}</Text>
                    
                    {/* Улучшенный слайдер с изображениями */}
                    {post.images && post.images.length > 0 && (
                      <ImageSlider images={post.images} postId={post.id} />
                    )}
                    
                    {/* Для обратной совместимости с одним изображением */}
                    {post.image && (!post.images || post.images.length === 0) && (
                      <View style={styles.singleImageContainer}>
                        <Image 
                          source={post.image} 
                          style={styles.postImage}
                          resizeMode="contain"
                        />
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.postActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => {
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
          onRequestClose={() => resetAddPostModal()}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Создать новый пост</Text>
                <TouchableOpacity onPress={() => resetAddPostModal()}>
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

                {/* Секция для изображений */}
                <Text style={styles.inputLabel}>
                  Фото ({postImages.length}/{IMAGE_SETTINGS.maxImagesPerPost})
                </Text>
                
                <View style={styles.imageUploadSection}>
                  {/* Кнопки добавления фото */}
                  <View style={styles.imageButtonsRow}>
                    <TouchableOpacity
                      style={[styles.imageButton, styles.galleryButton]}
                      onPress={pickImageFromGallery}
                      disabled={postImages.length >= IMAGE_SETTINGS.maxImagesPerPost || isUploadingImages || isSelectingImages}
                    >
                      {isSelectingImages ? (
                        <ActivityIndicator size="small" color="#6A9AA9" />
                      ) : (
                        <>
                          <Feather name="image" size={20} color="#6A9AA9" />
                          <Text style={styles.imageButtonText}>Галерея</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.imageButton, styles.cameraButton]}
                      onPress={takePhotoWithCamera}
                      disabled={postImages.length >= IMAGE_SETTINGS.maxImagesPerPost || isUploadingImages || isSelectingImages}
                    >
                      <Feather name="camera" size={20} color="#6A9AA9" />
                      <Text style={styles.imageButtonText}>Камера</Text>
                    </TouchableOpacity>
                    
                    {postImages.length > 0 && (
                      <TouchableOpacity
                        style={[styles.imageButton, styles.clearButton]}
                        onPress={clearAllImages}
                        disabled={isUploadingImages || isSelectingImages}
                      >
                        <Feather name="trash-2" size={20} color="#FF6B6B" />
                        <Text style={[styles.imageButtonText, styles.clearButtonText]}>
                          Очистить
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Индикатор выбора фото */}
                  {isSelectingImages && (
                    <View style={styles.selectionIndicator}>
                      <ActivityIndicator size="small" color="#6A9AA9" />
                      <Text style={styles.selectionIndicatorText}>
                        Загрузка выбранных фото...
                      </Text>
                    </View>
                  )}

                  {/* Прогресс загрузки */}
                  {isUploadingImages && (
                    <View style={styles.uploadProgressContainer}>
                      <Text style={styles.uploadProgressText}>
                        Загрузка на сервер... {Math.round(uploadProgress)}%
                      </Text>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill, 
                            { width: `${uploadProgress}%` }
                          ]} 
                        />
                      </View>
                      <Text style={styles.uploadInfoText}>
                        Загружено {postImages.filter(img => img.uploaded).length} из {postImages.length} фото
                      </Text>
                    </View>
                  )}

                  {/* Список выбранных фото */}
                  {postImages.length > 0 && (
                    <View style={styles.selectedImagesContainer}>
                      <Text style={styles.selectedImagesTitle}>
                        Выбрано фото: {postImages.length}
                        {postImages.some(img => img.error) && (
                          <Text style={styles.errorCountText}> (есть ошибки)</Text>
                        )}
                      </Text>
                      
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.imagesPreviewScroll}
                      >
                        {postImages.map((image, index) => (
                          <View key={image.id} style={styles.imagePreviewWrapper}>
                            <Image 
                              source={{ uri: image.uri }} 
                              style={styles.imagePreview}
                              resizeMode="cover"
                            />
                            
                            {/* Индикатор статуса */}
                            <View style={styles.statusIndicator}>
                              {image.uploaded ? (
                                <View style={[styles.statusBadge, styles.statusSuccess]}>
                                  <Feather name="check" size={12} color="#fff" />
                                </View>
                              ) : image.error ? (
                                <View style={[styles.statusBadge, styles.statusError]}>
                                  <Feather name="alert-circle" size={12} color="#fff" />
                                </View>
                              ) : image.uploadProgress && image.uploadProgress > 0 ? (
                                <View style={[styles.statusBadge, styles.statusUploading]}>
                                  <Text style={styles.uploadProgressBadgeText}>
                                    {Math.round(image.uploadProgress)}%
                                  </Text>
                                </View>
                              ) : (
                                <View style={[styles.statusBadge, styles.statusPending]}>
                                  <Text style={styles.statusBadgeText}>{index + 1}</Text>
                                </View>
                              )}
                            </View>
                            
                            <TouchableOpacity
                              style={styles.removeImageButton}
                              onPress={() => removeImage(image.id)}
                              disabled={isUploadingImages || isSelectingImages}
                            >
                              <Feather name="x" size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </ScrollView>
                      
                      {/* Информация о лимите */}
                      {postImages.length >= IMAGE_SETTINGS.maxImagesPerPost ? (
                        <Text style={styles.maxImagesWarning}>
                          ✅ Достигнут лимит {IMAGE_SETTINGS.maxImagesPerPost} фото
                        </Text>
                      ) : (
                        <Text style={styles.imagesInfoText}>
                          Можно добавить еще {IMAGE_SETTINGS.maxImagesPerPost - postImages.length} фото
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => resetAddPostModal()}
                  disabled={isUploadingImages}
                >
                  <Text style={styles.cancelButtonText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    isUploadingImages && styles.submitButtonDisabled
                  ]}
                  onPress={handleAddPost}
                  disabled={isUploadingImages}
                >
                  {isUploadingImages ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>Опубликовать</Text>
                  )}
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

const styles = StyleSheet.create({
  // Базовые стили (остаются без изменений)
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
  profileSection: {
    alignItems: 'center',
    marginLeft: 15,
  },
  profileButton: {
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  profileName: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: "Playfair Display Regular",
    textAlign: 'center',
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
  userAvatarContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderAvatar: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#9BDF11",
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
    maxHeight: "90%",
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
  submitButtonDisabled: {
    backgroundColor: "#ccc",
    borderColor: "#ccc",
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
  
  // ========== ИЗМЕНЕННЫЕ СТИЛИ ДЛЯ УЛУЧШЕННОГО СЛАЙДЕРА ==========
  imageSliderContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    height: 300,
    position: 'relative',
    backgroundColor: '#000',
  },
  slide: {
    width: SCREEN_WIDTH - 62,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  singleImageContainer: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    height: 200,
    backgroundColor: '#000',
  },
  
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  prevButton: {
    left: 8,
  },
  nextButton: {
    right: 8,
  },
   
  imageCounter: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // ========== СТИЛИ ДЛЯ МОДАЛЬНОГО ОКНА ==========
  imageUploadSection: {
    marginTop: 8,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    borderWidth: 2,
  },
  galleryButton: {
    backgroundColor: '#f8f9fa',
    borderColor: '#6A9AA9',
  },
  cameraButton: {
    backgroundColor: '#f8f9fa',
    borderColor: '#6A9AA9',
  },
  clearButton: {
    backgroundColor: '#fff5f5',
    borderColor: '#FF6B6B',
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: "Playfair Display Regular",
  },
  clearButtonText: {
    color: '#FF6B6B',
  },
  
  selectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectionIndicatorText: {
    fontSize: 14,
    color: '#6A9AA9',
    marginLeft: 8,
    fontFamily: "Playfair Display Regular",
  },
  
  uploadProgressContainer: {
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  uploadProgressText: {
    fontSize: 14,
    color: '#6A9AA9',
    marginBottom: 6,
    fontFamily: "Playfair Display Regular",
    textAlign: 'center',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#9BDF11',
    borderRadius: 3,
  },
  uploadInfoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
    fontFamily: "Playfair Display Regular",
  },
  
  selectedImagesContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectedImagesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    fontFamily: "Playfair Display Regular",
  },
  errorCountText: {
    color: '#e74c3c',
  },
  imagesPreviewScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  imagePreviewWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  
  statusIndicator: {
    position: 'absolute',
    top: 5,
    left: 5,
  },
  statusBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusSuccess: {
    backgroundColor: '#27ae60',
  },
  statusError: {
    backgroundColor: '#e74c3c',
  },
  statusUploading: {
    backgroundColor: '#6A9AA9',
  },
  statusPending: {
    backgroundColor: '#6A9AA9',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  uploadProgressBadgeText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  
  removeImageButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FF6B6B',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  
  maxImagesWarning: {
    fontSize: 12,
    color: '#27ae60',
    textAlign: 'center',
    fontFamily: "Playfair Display Regular",
    marginTop: 4,
  },
  imagesInfoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontFamily: "Playfair Display Regular",
    marginTop: 4,
  },

  // Новые стили для загрузки аватара
  avatarLoading: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: '#E5F0F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#9BDF11',
  },
});