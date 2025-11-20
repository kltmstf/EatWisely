// services/favoriteService.js
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

class FavoriteService {
  // Добавить в избранное
  async addToFavorites(itemId, favoriteType) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      if (!['recipe', 'ration'].includes(favoriteType)) {
        throw new Error('Invalid favorite type');
      }

      // Проверяем, не добавлено ли уже в избранное
      const existingFavorite = await this.getFavorite(itemId, favoriteType);
      if (existingFavorite) {
        throw new Error('Already in favorites');
      }

      const favoriteData = {
        userId: user.uid,
        favoriteType: favoriteType,
        createdAt: new Date()
      };

      // Устанавливаем правильную ссылку в зависимости от типа
      if (favoriteType === 'recipe') {
        favoriteData.recipeId = itemId;
        
        // Проверяем существование рецепта
        const recipeDoc = await getDoc(doc(db, 'recipes', itemId));
        if (!recipeDoc.exists()) {
          throw new Error('Recipe not found');
        }
      } else {
        favoriteData.rationPlanId = itemId;
        
        // Проверяем существование рациона
        const rationDoc = await getDoc(doc(db, 'ration_plans', itemId));
        if (!rationDoc.exists()) {
          throw new Error('Ration plan not found');
        }
      }

      const docRef = await addDoc(collection(db, 'user_favorites'), favoriteData);
      return { id: docRef.id, ...favoriteData };
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw error;
    }
  }

  // Удалить из избранного
  async removeFromFavorites(itemId, favoriteType) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const favorite = await this.getFavorite(itemId, favoriteType);
      if (!favorite) {
        throw new Error('Not found in favorites');
      }

      await deleteDoc(doc(db, 'user_favorites', favorite.id));
      return true;
    } catch (error) {
      console.error('Error removing from favorites:', error);
      throw error;
    }
  }

  // Получить конкретное избранное
  async getFavorite(itemId, favoriteType) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      let favoritesQuery;

      if (favoriteType === 'recipe') {
        favoritesQuery = query(
          collection(db, 'user_favorites'),
          where('userId', '==', user.uid),
          where('favoriteType', '==', 'recipe'),
          where('recipeId', '==', itemId)
        );
      } else {
        favoritesQuery = query(
          collection(db, 'user_favorites'),
          where('userId', '==', user.uid),
          where('favoriteType', '==', 'ration'),
          where('rationPlanId', '==', itemId)
        );
      }

      const snapshot = await getDocs(favoritesQuery);
      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    } catch (error) {
      console.error('Error getting favorite:', error);
      return null;
    }
  }

  // Получить все избранное пользователя
  async getUserFavorites() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const favoritesQuery = query(
        collection(db, 'user_favorites'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(favoritesQuery);
      const favorites = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Загружаем дополнительные данные для каждого избранного
      const enrichedFavorites = await Promise.all(
        favorites.map(async (favorite) => {
          if (favorite.favoriteType === 'recipe' && favorite.recipeId) {
            try {
              const recipeDoc = await getDoc(doc(db, 'recipes', favorite.recipeId));
              if (recipeDoc.exists()) {
                favorite.item = { id: recipeDoc.id, ...recipeDoc.data() };
              }
            } catch (error) {
              console.warn(`Recipe ${favorite.recipeId} not found`);
            }
          } else if (favorite.favoriteType === 'ration' && favorite.rationPlanId) {
            try {
              const rationDoc = await getDoc(doc(db, 'ration_plans', favorite.rationPlanId));
              if (rationDoc.exists()) {
                favorite.item = { id: rationDoc.id, ...rationDoc.data() };
              }
            } catch (error) {
              console.warn(`Ration plan ${favorite.rationPlanId} not found`);
            }
          }
          return favorite;
        })
      );

      return enrichedFavorites;
    } catch (error) {
      console.error('Error getting user favorites:', error);
      throw error;
    }
  }

  // Проверить, находится ли элемент в избранном
  async isItemInFavorites(itemId, favoriteType) {
    try {
      const favorite = await this.getFavorite(itemId, favoriteType);
      return !!favorite;
    } catch (error) {
      return false;
    }
  }

  // Получить только избранные рецепты
  async getFavoriteRecipes() {
    try {
      const allFavorites = await this.getUserFavorites();
      return allFavorites.filter(fav => 
        fav.favoriteType === 'recipe' && fav.item
      );
    } catch (error) {
      console.error('Error getting favorite recipes:', error);
      throw error;
    }
  }

  // Получить только избранные рационы
  async getFavoriteRations() {
    try {
      const allFavorites = await this.getUserFavorites();
      return allFavorites.filter(fav => 
        fav.favoriteType === 'ration' && fav.item
      );
    } catch (error) {
      console.error('Error getting favorite rations:', error);
      throw error;
    }
  }
}

export const favoriteService = new FavoriteService();
export default favoriteService;