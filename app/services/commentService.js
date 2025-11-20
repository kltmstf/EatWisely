// services/commentService.js
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
  writeBatch,
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

class CommentService {
  // Добавить комментарий
  async addComment(postId, commentText, parentCommentId = null) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Проверяем существование поста
      const postDoc = await getDoc(doc(db, 'community_posts', postId));
      if (!postDoc.exists()) {
        throw new Error('Post not found');
      }

      const batch = writeBatch(db);

      // Создаем комментарий
      const commentRef = doc(collection(db, 'comments'));
      const commentData = {
        postId: postId,
        userId: user.uid,
        content: commentText,
        parentCommentId: parentCommentId,
        likesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      batch.set(commentRef, commentData);

      // Обновляем счетчик комментариев в посте
      const postRef = doc(db, 'community_posts', postId);
      batch.update(postRef, {
        commentsCount: increment(1),
        updatedAt: new Date()
      });

      await batch.commit();
      return { id: commentRef.id, ...commentData };
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  // Получить комментарии поста
  async getPostComments(postId) {
    try {
      const commentsQuery = query(
        collection(db, 'comments'),
        where('postId', '==', postId),
        where('parentCommentId', '==', null), // только родительские комментарии
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(commentsQuery);
      const comments = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Обогащаем комментарии
      const enrichedComments = await Promise.all(
        comments.map(async (comment) => {
          // Данные автора
          try {
            const userDoc = await getDoc(doc(db, 'users', comment.userId));
            if (userDoc.exists()) {
              comment.author = { id: userDoc.id, ...userDoc.data() };
            }
          } catch (error) {
            console.warn(`User ${comment.userId} not found`);
          }

          // Получаем ответы на комментарий
          comment.replies = await this.getCommentReplies(comment.id);

          // Проверяем лайк текущего пользователя
          const user = auth.currentUser;
          if (user) {
            comment.isLikedByCurrentUser = await this.isCommentLikedByUser(comment.id, user.uid);
          }

          return comment;
        })
      );

      return enrichedComments;
    } catch (error) {
      console.error('Error getting post comments:', error);
      throw error;
    }
  }

  // Получить ответы на комментарий
  async getCommentReplies(commentId) {
    try {
      const repliesQuery = query(
        collection(db, 'comments'),
        where('parentCommentId', '==', commentId),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(repliesQuery);
      const replies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Обогащаем ответы
      const enrichedReplies = await Promise.all(
        replies.map(async (reply) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', reply.userId));
            if (userDoc.exists()) {
              reply.author = { id: userDoc.id, ...userDoc.data() };
            }
          } catch (error) {
            console.warn(`User ${reply.userId} not found`);
          }

          // Проверяем лайк текущего пользователя
          const user = auth.currentUser;
          if (user) {
            reply.isLikedByCurrentUser = await this.isCommentLikedByUser(reply.id, user.uid);
          }

          return reply;
        })
      );

      return enrichedReplies;
    } catch (error) {
      console.error('Error getting comment replies:', error);
      return [];
    }
  }

  // Получить комментарий по ID
  async getCommentById(commentId) {
    try {
      const commentRef = doc(db, 'comments', commentId);
      const commentDoc = await getDoc(commentRef);

      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      const comment = { id: commentDoc.id, ...commentDoc.data() };

      // Данные автора
      try {
        const userDoc = await getDoc(doc(db, 'users', comment.userId));
        if (userDoc.exists()) {
          comment.author = { id: userDoc.id, ...userDoc.data() };
        }
      } catch (error) {
        console.warn(`User ${comment.userId} not found`);
      }

      return comment;
    } catch (error) {
      console.error('Error getting comment by ID:', error);
      throw error;
    }
  }

  // Обновить комментарий
  async updateComment(commentId, newContent) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const commentRef = doc(db, 'comments', commentId);
      const commentDoc = await getDoc(commentRef);

      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      if (commentDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to update this comment');
      }

      await updateDoc(commentRef, {
        content: newContent,
        updatedAt: new Date()
      });

      return { id: commentId, content: newContent };
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  }

  // Удалить комментарий
  async deleteComment(commentId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const commentRef = doc(db, 'comments', commentId);
      const commentDoc = await getDoc(commentRef);

      if (!commentDoc.exists()) {
        throw new Error('Comment not found');
      }

      if (commentDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to delete this comment');
      }

      const batch = writeBatch(db);

      // Удаляем комментарий
      batch.delete(commentRef);

      // Обновляем счетчик комментариев в посте
      const postRef = doc(db, 'community_posts', commentDoc.data().postId);
      batch.update(postRef, {
        commentsCount: increment(-1),
        updatedAt: new Date()
      });

      // Если есть ответы, удаляем их тоже
      const repliesQuery = query(
        collection(db, 'comments'),
        where('parentCommentId', '==', commentId)
      );
      const repliesSnapshot = await getDocs(repliesQuery);
      repliesSnapshot.docs.forEach(replyDoc => {
        batch.delete(replyDoc.ref);
        // Также обновляем счетчик для каждого удаленного ответа
        batch.update(postRef, {
          commentsCount: increment(-1)
        });
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw error;
    }
  }

  // Лайкнуть комментарий
  async likeComment(commentId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const commentRef = doc(db, 'comments', commentId);
      await updateDoc(commentRef, {
        likesCount: increment(1),
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error liking comment:', error);
      throw error;
    }
  }

  // Убрать лайк с комментария
  async unlikeComment(commentId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const commentRef = doc(db, 'comments', commentId);
      await updateDoc(commentRef, {
        likesCount: increment(-1),
        updatedAt: new Date()
      });

      return true;
    } catch (error) {
      console.error('Error unliking comment:', error);
      throw error;
    }
  }

  // Проверить, лайкнул ли пользователь комментарий
  async isCommentLikedByUser(commentId, userId) {
    try {
      // В реальном приложении здесь была бы проверка в отдельной коллекции лайков
      // Для упрощения считаем, что лайки хранятся только счетчиком
      return false;
    } catch (error) {
      return false;
    }
  }

  // Получить количество комментариев поста
  async getCommentsCount(postId) {
    try {
      const commentsQuery = query(
        collection(db, 'comments'),
        where('postId', '==', postId)
      );

      const snapshot = await getDocs(commentsQuery);
      return snapshot.size;
    } catch (error) {
      console.error('Error getting comments count:', error);
      return 0;
    }
  }
}

export const commentService = new CommentService();
export default commentService;