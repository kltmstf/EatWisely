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
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

class CommunityService {
  // Создать пост в сообществе
  async createPost(postData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const postWithMetadata = {
        title: postData.title,
        content: postData.content,
        images: postData.images || [],
        recipeId: postData.recipeId || null,
        rationPlanId: postData.rationPlanId || null,
        userId: user.uid,
        likesCount: 0,
        commentsCount: 0,
        tags: postData.tags || [],
        isPublic: true,
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

  // Получить ленту постов (с пагинацией)
  async getFeedPosts(lastVisible = null, pageSize = 10) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

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
        ...doc.data()
      }));

      // Обогащаем посты данными
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          // Данные автора
          try {
            const userDoc = await getDoc(doc(db, 'users', post.userId));
            if (userDoc.exists()) {
              post.author = { id: userDoc.id, ...userDoc.data() };
            }
          } catch (error) {
            console.warn(`User ${post.userId} not found`);
          }

          // Связанный рецепт
          if (post.recipeId) {
            try {
              const recipeDoc = await getDoc(doc(db, 'recipes', post.recipeId));
              if (recipeDoc.exists()) {
                post.recipe = { id: recipeDoc.id, ...recipeDoc.data() };
              }
            } catch (error) {
              console.warn(`Recipe ${post.recipeId} not found`);
            }
          }

          // Связанный рацион
          if (post.rationPlanId) {
            try {
              const rationDoc = await getDoc(doc(db, 'ration_plans', post.rationPlanId));
              if (rationDoc.exists()) {
                post.rationPlan = { id: rationDoc.id, ...rationDoc.data() };
              }
            } catch (error) {
              console.warn(`Ration plan ${post.rationPlanId} not found`);
            }
          }

          // Проверяем лайк текущего пользователя
          post.isLikedByCurrentUser = await this.isPostLikedByUser(post.id, user.uid);

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

  // Получить посты конкретного пользователя
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
        ...doc.data()
      }));

      // Обогащаем данные автора
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', post.userId));
            if (userDoc.exists()) {
              post.author = { id: userDoc.id, ...userDoc.data() };
            }
          } catch (error) {
            console.warn(`User ${post.userId} not found`);
          }
          return post;
        })
      );

      return enrichedPosts;
    } catch (error) {
      console.error('Error getting user posts:', error);
      throw error;
    }
  }

  // Получить пост по ID
  async getPostById(postId) {
    try {
      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const post = { id: postDoc.id, ...postDoc.data() };

      // Проверяем права доступа
      if (!post.isPublic) {
        const user = auth.currentUser;
        if (!user || post.userId !== user.uid) {
          throw new Error('Access denied');
        }
      }

      // Данные автора
      try {
        const userDoc = await getDoc(doc(db, 'users', post.userId));
        if (userDoc.exists()) {
          post.author = { id: userDoc.id, ...userDoc.data() };
        }
      } catch (error) {
        console.warn(`User ${post.userId} not found`);
      }

      // Связанные данные
      if (post.recipeId) {
        try {
          const recipeDoc = await getDoc(doc(db, 'recipes', post.recipeId));
          if (recipeDoc.exists()) {
            post.recipe = { id: recipeDoc.id, ...recipeDoc.data() };
          }
        } catch (error) {
          console.warn(`Recipe ${post.recipeId} not found`);
        }
      }

      if (post.rationPlanId) {
        try {
          const rationDoc = await getDoc(doc(db, 'ration_plans', post.rationPlanId));
          if (rationDoc.exists()) {
            post.rationPlan = { id: rationDoc.id, ...rationDoc.data() };
          }
        } catch (error) {
          console.warn(`Ration plan ${post.rationPlanId} not found`);
        }
      }

      // Проверяем лайк текущего пользователя
      const user = auth.currentUser;
      if (user) {
        post.isLikedByCurrentUser = await this.isPostLikedByUser(post.id, user.uid);
      }

      return post;
    } catch (error) {
      console.error('Error getting post by ID:', error);
      throw error;
    }
  }

  // Обновить пост
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

  // Удалить пост
  async deletePost(postId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const postRef = doc(db, 'community_posts', postId);
      const postDoc = await getDoc(postRef);

      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      if (postDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to delete this post');
      }

      // Удаляем также все лайки и комментарии поста
      const batch = writeBatch(db);

      // Удаляем лайки поста
      const likesQuery = query(
        collection(db, 'likes'),
        where('postId', '==', postId)
      );
      const likesSnapshot = await getDocs(likesQuery);
      likesSnapshot.docs.forEach(likeDoc => {
        batch.delete(likeDoc.ref);
      });

      // Удаляем комментарии поста
      const commentsQuery = query(
        collection(db, 'comments'),
        where('postId', '==', postId)
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      commentsSnapshot.docs.forEach(commentDoc => {
        batch.delete(commentDoc.ref);
      });

      // Удаляем сам пост
      batch.delete(postRef);

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  // Лайкнуть пост
  async likePost(postId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Проверяем, не лайкнул ли уже
      const existingLike = await this.getPostLike(postId, user.uid);
      if (existingLike) {
        throw new Error('Post already liked');
      }

      const batch = writeBatch(db);

      // Создаем запись лайка
      const likeRef = doc(collection(db, 'likes'));
      batch.set(likeRef, {
        postId: postId,
        userId: user.uid,
        createdAt: new Date()
      });

      // Обновляем счетчик лайков в посте
      const postRef = doc(db, 'community_posts', postId);
      batch.update(postRef, {
        likesCount: increment(1),
        updatedAt: new Date()
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  // Убрать лайк с поста
  async unlikePost(postId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Находим лайк
      const like = await this.getPostLike(postId, user.uid);
      if (!like) {
        throw new Error('Like not found');
      }

      const batch = writeBatch(db);

      // Удаляем лайк
      batch.delete(doc(db, 'likes', like.id));

      // Обновляем счетчик лайков в посте
      const postRef = doc(db, 'community_posts', postId);
      batch.update(postRef, {
        likesCount: increment(-1),
        updatedAt: new Date()
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error unliking post:', error);
      throw error;
    }
  }

  // Получить лайк пользователя на пост
  async getPostLike(postId, userId) {
    try {
      const likeQuery = query(
        collection(db, 'likes'),
        where('postId', '==', postId),
        where('userId', '==', userId)
      );

      const likeSnapshot = await getDocs(likeQuery);
      if (likeSnapshot.empty) return null;

      const likeDoc = likeSnapshot.docs[0];
      return { id: likeDoc.id, ...likeDoc.data() };
    } catch (error) {
      console.error('Error getting post like:', error);
      return null;
    }
  }

  // Проверить, лайкнул ли пользователь пост
  async isPostLikedByUser(postId, userId) {
    try {
      const like = await this.getPostLike(postId, userId);
      return !!like;
    } catch (error) {
      return false;
    }
  }

  // Получить лайки поста
  async getPostLikes(postId) {
    try {
      const likesQuery = query(
        collection(db, 'likes'),
        where('postId', '==', postId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(likesQuery);
      const likes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Обогащаем данные пользователей
      const enrichedLikes = await Promise.all(
        likes.map(async (like) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', like.userId));
            if (userDoc.exists()) {
              like.user = { id: userDoc.id, ...userDoc.data() };
            }
          } catch (error) {
            console.warn(`User ${like.userId} not found`);
          }
          return like;
        })
      );

      return enrichedLikes;
    } catch (error) {
      console.error('Error getting post likes:', error);
      throw error;
    }
  }

  // Поиск постов
  async searchPosts(searchTerm, filters = {}) {
    try {
      const { posts } = await this.getFeedPosts();
      
      if (!searchTerm) return posts;

      const searchLower = searchTerm.toLowerCase();
      return posts.filter(post => 
        post.title.toLowerCase().includes(searchLower) ||
        post.content.toLowerCase().includes(searchLower) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    } catch (error) {
      console.error('Error searching posts:', error);
      throw error;
    }
  }
}

export const communityService = new CommunityService();
export default communityService;