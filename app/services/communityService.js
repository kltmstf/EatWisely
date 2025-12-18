// services/communityService.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { uploadCommunityPostImage } from './cloudinaryService';

class CommunityService {
  // Создать пост в сообществе с изображениями
  async createPost(postData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Загружаем изображения в Cloudinary если они есть
      let uploadedImages = [];
      if (postData.images && postData.images.length > 0) {
        uploadedImages = await this.uploadPostImages(postData.images);
      }

      const postWithMetadata = {
        title: postData.title,
        content: postData.content,
        postType: postData.postType || 'Обсуждение',
        images: uploadedImages, // Теперь это массив объектов с данными изображений
        recipeId: postData.recipeId || null,
        rationPlanId: postData.rationPlanId || null,
        userId: user.uid,
        userName: postData.userName || user.displayName || 'Пользователь',
        likesCount: 0,
        commentsCount: 0,
        likedBy: [], // Массив userId кто лайкнул
        tags: postData.tags || [],
        isPublic: true,
        verified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'community_posts'), postWithMetadata);
      return { id: docRef.id, ...postWithMetadata };
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  // Загрузить изображения для поста
  async uploadPostImages(images) {
    try {
      const uploadedImages = [];
      
      for (const image of images) {
        if (image.uri) {
          const result = await uploadCommunityPostImage(image.uri);
          
          if (result.success && result.url) {
            uploadedImages.push({
              url: result.url,
              publicId: result.publicId,
              width: image.width,
              height: image.height,
              fileName: image.fileName || `image_${Date.now()}.jpg`,
              uploadedAt: new Date()
            });
          }
        } else if (image.url) {
          // Если изображение уже загружено (перезагрузка поста)
          uploadedImages.push(image);
        }
      }
      
      return uploadedImages;
    } catch (error) {
      console.error('Error uploading post images:', error);
      throw error;
    }
  }

  // Обновить изображения поста
  async updatePostImages(postId, newImages, oldImages = []) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      if (postDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to update this post');
      }

      // Загружаем новые изображения
      const uploadedImages = await this.uploadPostImages(newImages);
      
      // Сохраняем старые изображения, если они есть
      const allImages = [...oldImages, ...uploadedImages];

      await updateDoc(postRef, {
        images: allImages,
        updatedAt: new Date()
      });

      return allImages;
    } catch (error) {
      console.error('Error updating post images:', error);
      throw error;
    }
  }

  // Удалить изображение из поста
  async deletePostImage(postId, imagePublicId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      if (postDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to update this post');
      }

      const currentImages = postDoc.data().images || [];
      const updatedImages = currentImages.filter(img => img.publicId !== imagePublicId);

      await updateDoc(postRef, {
        images: updatedImages,
        updatedAt: new Date()
      });

      return updatedImages;
    } catch (error) {
      console.error('Error deleting post image:', error);
      throw error;
    }
  }

  // Получить ленту постов (с пагинацией) - ОБНОВЛЕННЫЙ МЕТОД
  async getFeedPosts(lastVisible = null, pageSize = 10) {
    try {
      let postsQuery = query(
        collection(db, 'community_posts'),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      if (lastVisible) {
        postsQuery = query(
          collection(db, 'community_posts'),
          where('isPublic', '==', true),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(pageSize)
        );
      }

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      // Обогащаем посты данными
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          // Проверяем лайк текущего пользователя
          if (auth.currentUser) {
            post.isLikedByCurrentUser = post.likedBy?.includes(auth.currentUser.uid) || false;
          }

          // Форматируем время
          post.timeAgo = this.formatTimeAgo(post.createdAt);

          // Гарантируем, что images всегда массив
          if (!Array.isArray(post.images)) {
            post.images = [];
          }

          return post;
        })
      );

      return {
        posts: enrichedPosts,
        lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
      };
    } catch (error) {
      console.error('Error getting feed posts:', error);
      throw error;
    }
  }

  // Форматирование времени
  formatTimeAgo(date) {
    if (!date) return 'недавно';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'только что';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} минут назад`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} часов назад`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} дней назад`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} месяцев назад`;
    return `${Math.floor(diffInSeconds / 31536000)} лет назад`;
  }

  // Получить посты конкретного пользователя - ОБНОВЛЕННЫЙ
  async getUserPosts(userId) {
    try {
      const postsQuery = query(
        collection(db, 'community_posts'),
        where('userId', '==', userId),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      // Обогащаем данные
      const enrichedPosts = posts.map(post => {
        post.timeAgo = this.formatTimeAgo(post.createdAt);
        
        if (auth.currentUser) {
          post.isLikedByCurrentUser = post.likedBy?.includes(auth.currentUser.uid) || false;
        }

        if (!Array.isArray(post.images)) {
          post.images = [];
        }

        return post;
      });

      return enrichedPosts;
    } catch (error) {
      console.error('Error getting user posts:', error);
      throw error;
    }
  }

  // Получить пост по ID - ОБНОВЛЕННЫЙ
  async getPostById(postId) {
    try {
      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      let post = { 
        id: postDoc.id, 
        ...postDoc.data(),
        createdAt: postDoc.data().createdAt?.toDate(),
        updatedAt: postDoc.data().updatedAt?.toDate()
      };

      // Проверяем права доступа
      if (!post.isPublic) {
        const user = auth.currentUser;
        if (!user || post.userId !== user.uid) {
          throw new Error('Access denied');
        }
      }

      // Проверяем лайк текущего пользователя
      const user = auth.currentUser;
      if (user) {
        post.isLikedByCurrentUser = post.likedBy?.includes(user.uid) || false;
      }

      // Форматируем время
      post.timeAgo = this.formatTimeAgo(post.createdAt);

      // Гарантируем, что images всегда массив
      if (!Array.isArray(post.images)) {
        post.images = [];
      }

      return post;
    } catch (error) {
      console.error('Error getting post by ID:', error);
      throw error;
    }
  }

  // Обновить пост - ОБНОВЛЕННЫЙ
  async updatePost(postId, updates) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      if (postDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to update this post');
      }

      // Если обновляются изображения
      if (updates.images) {
        const currentImages = postDoc.data().images || [];
        updates.images = await this.uploadPostImages(updates.images);
      }

      await updateDoc(postRef, {
        ...updates,
        updatedAt: new Date()
      });

      return { id: postId, ...updates };
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  // Лайкнуть пост - ОБНОВЛЕННЫЙ ДЛЯ РАБОТЫ С likedBy
  async likePost(postId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data();
      
      // Проверяем, не лайкнул ли уже
      if (postData.likedBy?.includes(user.uid)) {
        throw new Error('Post already liked');
      }

      const batch = writeBatch(db);

      // Обновляем пост
      batch.update(postRef, {
        likesCount: increment(1),
        likedBy: arrayUnion(user.uid),
        updatedAt: new Date()
      });

      // Создаем запись лайка в отдельной коллекции для истории
      const likeRef = doc(collection(db, 'likes'));
      batch.set(likeRef, {
        postId: postId,
        userId: user.uid,
        createdAt: new Date()
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  // Убрать лайк с поста - ОБНОВЛЕННЫЙ ДЛЯ РАБОТЫ С likedBy
  async unlikePost(postId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data();
      
      // Проверяем, есть ли лайк
      if (!postData.likedBy?.includes(user.uid)) {
        throw new Error('Like not found');
      }

      const batch = writeBatch(db);

      // Обновляем пост
      batch.update(postRef, {
        likesCount: increment(-1),
        likedBy: arrayRemove(user.uid),
        updatedAt: new Date()
      });

      // Удаляем запись лайка
      const likeQuery = query(
        collection(db, 'likes'),
        where('postId', '==', postId),
        where('userId', '==', user.uid)
      );

      const likeSnapshot = await getDocs(likeQuery);
      likeSnapshot.docs.forEach(likeDoc => {
        batch.delete(likeDoc.ref);
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error unliking post:', error);
      throw error;
    }
  }

  // Получить лайки поста - ОБНОВЛЕННЫЙ
  async getPostLikes(postId) {
    try {
      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const postData = postDoc.data();
      const likedBy = postData.likedBy || [];

      // Получаем данные пользователей кто лайкнул
      const likesWithUsers = await Promise.all(
        likedBy.map(async (userId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
              return {
                userId: userId,
                user: { id: userDoc.id, ...userDoc.data() }
              };
            }
          } catch (error) {
            console.warn(`User ${userId} not found`);
          }
          return { userId };
        })
      );

      return likesWithUsers.filter(like => like.user);
    } catch (error) {
      console.error('Error getting post likes:', error);
      throw error;
    }
  }

  // Поиск постов - ОБНОВЛЕННЫЙ
  async searchPosts(searchTerm, filters = {}) {
    try {
      // Сначала получаем все посты
      const allPosts = [];
      let lastVisible = null;
      let hasMore = true;

      while (hasMore) {
        const result = await this.getFeedPosts(lastVisible, 50);
        allPosts.push(...result.posts);
        lastVisible = result.lastVisible;
        hasMore = result.lastVisible !== null && allPosts.length < 100; // Ограничим 100 постами
      }

      if (!searchTerm && !filters.postType) return allPosts;

      const searchLower = searchTerm ? searchTerm.toLowerCase() : '';

      return allPosts.filter(post => {
        // Фильтр по типу поста
        if (filters.postType && filters.postType !== 'Все' && post.postType !== filters.postType) {
          return false;
        }

        // Поиск по тексту
        if (searchTerm) {
          const matchesTitle = post.title?.toLowerCase().includes(searchLower) || false;
          const matchesContent = post.content?.toLowerCase().includes(searchLower) || false;
          const matchesTags = post.tags?.some(tag => tag.toLowerCase().includes(searchLower)) || false;
          
          if (!matchesTitle && !matchesContent && !matchesTags) {
            return false;
          }
        }

        return true;
      });
    } catch (error) {
      console.error('Error searching posts:', error);
      throw error;
    }
  }

  // Получить статистику постов пользователя
  async getUserStats(userId) {
    try {
      const postsQuery = query(
        collection(db, 'community_posts'),
        where('userId', '==', userId),
        where('isPublic', '==', true)
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => doc.data());

      const totalPosts = posts.length;
      const totalLikes = posts.reduce((sum, post) => sum + (post.likesCount || 0), 0);
      const totalComments = posts.reduce((sum, post) => sum + (post.commentsCount || 0), 0);

      // Группировка по типам постов
      const postTypes = posts.reduce((acc, post) => {
        const type = post.postType || 'Без типа';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      return {
        totalPosts,
        totalLikes,
        totalComments,
        postTypes,
        averageLikesPerPost: totalPosts > 0 ? (totalLikes / totalPosts).toFixed(1) : 0
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  // Получить популярные посты (по лайкам)
  async getPopularPosts(limitCount = 10) {
    try {
      const postsQuery = query(
        collection(db, 'community_posts'),
        where('isPublic', '==', true),
        orderBy('likesCount', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));

      // Обогащаем данные
      const enrichedPosts = posts.map(post => {
        post.timeAgo = this.formatTimeAgo(post.createdAt);
        
        if (auth.currentUser) {
          post.isLikedByCurrentUser = post.likedBy?.includes(auth.currentUser.uid) || false;
        }

        if (!Array.isArray(post.images)) {
          post.images = [];
        }

        return post;
      });

      return enrichedPosts;
    } catch (error) {
      console.error('Error getting popular posts:', error);
      throw error;
    }
  }
}

export const communityService = new CommunityService();
export default communityService;