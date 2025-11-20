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
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

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
      return true;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      throw error;
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
  async getFollowers(userId) {
    try {
      const followersQuery = query(
        collection(db, 'follows'),
        where('followingId', '==', userId),
        orderBy('createdAt', 'desc')
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
              follow.user = { id: userDoc.id, ...userDoc.data() };
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
  async getFollowing(userId) {
    try {
      const followingQuery = query(
        collection(db, 'follows'),
        where('followerId', '==', userId),
        orderBy('createdAt', 'desc')
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
              follow.user = { id: userDoc.id, ...userDoc.data() };
            }
          } catch (error) {
            console.warn(`User ${follow.followingId} not found`);
          }
          return follow;
        })
      );

      return enrichedFollowing;
    } catch (error) {
      console.error('Error getting following:', error);
      throw error;
    }
  }

  // Получить количество подписчиков
  async getFollowersCount(userId) {
    try {
      const followers = await this.getFollowers(userId);
      return followers.length;
    } catch (error) {
      console.error('Error getting followers count:', error);
      return 0;
    }
  }

  // Получить количество подписок
  async getFollowingCount(userId) {
    try {
      const following = await this.getFollowing(userId);
      return following.length;
    } catch (error) {
      console.error('Error getting following count:', error);
      return 0;
    }
  }

  // Получить рекомендации для подписки (пользователи, на которых еще не подписан)
  async getFollowSuggestions(limit = 10) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Получаем всех пользователей, кроме текущего
      const allUsersQuery = query(
        collection(db, 'users'),
        where('__name__', '!=', user.uid)
      );

      const allUsersSnapshot = await getDocs(allUsersQuery);
      const allUsers = allUsersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Получаем текущие подписки
      const currentFollowing = await this.getFollowing(user.uid);
      const followingIds = new Set(currentFollowing.map(f => f.followingId));

      // Фильтруем пользователей, на которых еще не подписаны
      const suggestions = allUsers
        .filter(userDoc => !followingIds.has(userDoc.id))
        .slice(0, limit);

      return suggestions;
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

      let feedQuery = query(
        collection(db, 'community_posts'),
        where('userId', 'in', followingIds),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

      if (lastVisible) {
        feedQuery = query(
          collection(db, 'community_posts'),
          where('userId', 'in', followingIds),
          where('isPublic', '==', true),
          orderBy('createdAt', 'desc'),
          startAfter(lastVisible),
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
              post.author = { id: userDoc.id, ...userDoc.data() };
            }
          } catch (error) {
            console.warn(`User ${post.userId} not found`);
          }

          // Проверяем лайк текущего пользователя
          post.isLikedByCurrentUser = await communityService.isPostLikedByUser(post.id, user.uid);

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
}

export const followService = new FollowService();
export default followService;