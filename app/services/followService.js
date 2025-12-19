// services/followService.js
import { 
  collection, 
  addDoc, 
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
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { communityService } from './communityService';

class FollowService {
  // Подписаться на пользователя
  async followUser(targetUserId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      if (user.uid === targetUserId) {
        throw new Error('Cannot follow yourself');
      }

      // Проверяем существование целевого пользователя
      const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
      if (!targetUserDoc.exists()) {
        throw new Error('User not found');
      }

      // Проверяем, не подписаны ли уже
      const existingFollow = await this.getFollow(user.uid, targetUserId);
      if (existingFollow) {
        throw new Error('Already following this user');
      }

      const followData = {
        followerId: user.uid,
        followingId: targetUserId,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'follows'), followData);
      
      // Обновляем счетчики у обоих пользователей
      await this.updateFollowCounts(user.uid, targetUserId, 'increment');
      
      return { id: docRef.id, ...followData };
    } catch (error) {
      console.error('Error following user:', error);
      throw error;
    }
  }

  // Отписаться от пользователя
  async unfollowUser(targetUserId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const follow = await this.getFollow(user.uid, targetUserId);
      if (!follow) {
        throw new Error('Not following this user');
      }

      await deleteDoc(doc(db, 'follows', follow.id));
      
      // Обновляем счетчики у обоих пользователей
      await this.updateFollowCounts(user.uid, targetUserId, 'decrement');
      
      return true;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
    }
  }

  // Обновить счетчики подписок/подписчиков
  async updateFollowCounts(followerId, followingId, operation) {
    try {
      const batch = writeBatch(db);
      
      const followerRef = doc(db, 'users', followerId);
      const followingRef = doc(db, 'users', followingId);
      
      if (operation === 'increment') {
        // У подписчика увеличиваем счетчик подписок
        batch.update(followerRef, {
          followingCount: increment(1),
          updatedAt: new Date()
        });
        
        // У того, на кого подписались, увеличиваем счетчик подписчиков
        batch.update(followingRef, {
          followersCount: increment(1),
          updatedAt: new Date()
        });
      } else if (operation === 'decrement') {
        // У подписчика уменьшаем счетчик подписок
        batch.update(followerRef, {
          followingCount: increment(-1),
          updatedAt: new Date()
        });
        
        // У того, от кого отписались, уменьшаем счетчик подписчиков
        batch.update(followingRef, {
          followersCount: increment(-1),
          updatedAt: new Date()
        });
      }
      
      await batch.commit();
    } catch (error) {
      console.error('Error updating follow counts:', error);
      // Не выбрасываем ошибку, чтобы основная операция не прервалась
    }
  }

  // Получить информацию о подписке
  async getFollow(followerId, followingId) {
    try {
      const followQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', followerId),
        where('followingId', '==', followingId)
      );

      const followSnapshot = await getDocs(followQuery);
      if (followSnapshot.empty) return null;

      const followDoc = followSnapshot.docs[0];
      return { id: followDoc.id, ...followDoc.data() };
    } catch (error) {
      console.error('Error getting follow:', error);
      return null;
    }
  }

  // Проверить, подписан ли пользователь
  async isFollowing(targetUserId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const follow = await this.getFollow(user.uid, targetUserId);
      return !!follow;
    } catch (error) {
      return false;
    }
  }

  // Получить подписчиков пользователя
  async getFollowers(userId, limitCount = 50) {
    try {
      const followersQuery = query(
        collection(db, 'follows'),
        where('followingId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(followersQuery);
      const followers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Обогащаем данные пользователей
      const enrichedFollowers = await Promise.all(
        followers.map(async (follow) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', follow.followerId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              follow.user = { 
                id: userDoc.id, 
                name: userData.name || 'Пользователь',
                email: userData.email || '',
                photoURL: userData.photoURL || null,
                description: userData.description || '',
                followersCount: userData.followersCount || 0,
                followingCount: userData.followingCount || 0
              };
            }
          } catch (error) {
            console.warn(`User ${follow.followerId} not found`);
          }
          return follow;
        })
      );

      return enrichedFollowers;
    } catch (error) {
      console.error('Error getting followers:', error);
      throw error;
    }
  }

  // Получить подписки пользователя
  async getFollowing(userId, limitCount = 50) {
    try {
      const followingQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(followingQuery);
      const following = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Обогащаем данные пользователей
      const enrichedFollowing = await Promise.all(
        following.map(async (follow) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', follow.followingId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              console.log(`Загружен пользователь ${follow.followingId}:`, userData.name);
              follow.user = { 
                id: userDoc.id, 
                name: userData.name || 'Пользователь',
                email: userData.email || '',
                photoURL: userData.photoURL || null,
                description: userData.description || '',
                followersCount: userData.followersCount || 0,
                followingCount: userData.followingCount || 0
              };
            } else {
            console.log(`Пользователь ${follow.followingId} не найден в базе данных`);
            }
          } catch (error) {
            console.warn(`Ошибка загрузки пользователя ${follow.followingId}:`, error);
        
          }
          return follow;
        })
      );
      console.log("Обогащенные данные подписок:", enrichedFollowing);
      return enrichedFollowing;
    } catch (error) {
      console.error('Error getting following:', error);

      throw error;
    }
  }

  // Проверка взаимной подписки 
  async checkMutualFollow(currentUserId, otherUserId) {
  try {
    // Проверяем, подписан ли текущий пользователь на другого
    const currentFollowsOther = await this.isFollowing(otherUserId);
    
    // Проверяем, подписан ли другой пользователь на текущего
    const otherFollowsCurrent = await this.getFollow(otherUserId, currentUserId);
    
    return currentFollowsOther && !!otherFollowsCurrent;
  } catch (error) {
    console.error('Error checking mutual follow:', error);
    return false;
  }
}

  // Получить количество подписчиков
  async getFollowersCount(userId) {
    try {
      // Сначала пробуем получить из профиля пользователя
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.followersCount !== undefined) {
          return userData.followersCount;
        }
      }
      
      // Если в профиле нет, считаем вручную
      const followersQuery = query(
        collection(db, 'follows'),
        where('followingId', '==', userId)
      );
      
      const snapshot = await getDocs(followersQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting followers count:', error);
      return 0;
    }
  }

  // Получить количество подписок
  async getFollowingCount(userId) {
    try {
      // Сначала пробуем получить из профиля пользователя
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.followingCount !== undefined) {
          return userData.followingCount;
        }
      }
      
      // Если в профиле нет, считаем вручную
      const followingQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', userId)
      );
      
      const snapshot = await getDocs(followingQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting following count:', error);
      return 0;
    }
  }

  // Получить рекомендации для подписки (пользователи, на которых еще не подписан)
  async getFollowSuggestions(limitCount = 10) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Получаем текущие подписки
      const currentFollowing = await this.getFollowing(user.uid, 100);
      const followingIds = new Set(currentFollowing.map(f => f.followingId));
      followingIds.add(user.uid); // Исключаем себя

      // Получаем несколько случайных пользователей
      // В реальном приложении здесь должна быть более сложная логика
      const allUsersQuery = query(
        collection(db, 'users'),
        limit(50)
      );

      const allUsersSnapshot = await getDocs(allUsersQuery);
      const allUsers = allUsersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(userDoc => !followingIds.has(userDoc.id))
        .slice(0, limitCount);

      return allUsers;
    } catch (error) {
      console.error('Error getting follow suggestions:', error);
      throw error;
    }
  }

  // Получить ленту из постов подписанных пользователей
  async getFollowingFeed(lastVisible = null, pageSize = 10) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Получаем подписки пользователя
      const following = await this.getFollowing(user.uid);
      const followingIds = following.map(f => f.followingId);

      if (followingIds.length === 0) {
        return { posts: [], lastVisible: null };
      }

      let feedQuery;
      if (lastVisible) {
        feedQuery = query(
          collection(db, 'community_posts'),
          where('userId', 'in', followingIds),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
          limit(pageSize)
        );
      } else {
        feedQuery = query(
          collection(db, 'community_posts'),
          where('userId', 'in', followingIds),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      }

      const snapshot = await getDocs(feedQuery);
      const posts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Обогащаем посты данными авторов
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', post.userId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              post.author = { 
                id: userDoc.id, 
                name: userData.name || 'Пользователь',
                photoURL: userData.photoURL || null
              };
            }
          } catch (error) {
            console.warn(`User ${post.userId} not found`);
          }

          // Проверяем лайк текущего пользователя
          if (communityService && communityService.isPostLikedByUser) {
            post.isLikedByCurrentUser = await communityService.isPostLikedByUser(post.id, user.uid);
          } else {
            post.isLikedByCurrentUser = false;
          }

          return post;
        })
      );

      return {
        posts: enrichedPosts,
        lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
      };
    } catch (error) {
      console.error('Error getting following feed:', error);
      throw error;
    }
  }

  // Инициализировать счетчики для пользователя (при создании профиля)
  async initializeUserCounts(userId) {
    try {
      const userRef = doc(db, 'users', userId);
      
      // Устанавливаем начальные значения
      await updateDoc(userRef, {
        followersCount: 0,
        followingCount: 0,
        updatedAt: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing user counts:', error);
      return false;
    }
  }
}

export const followService = new FollowService();
export default followService;