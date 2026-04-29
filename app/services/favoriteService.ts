// app/services/favoriteService.ts
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
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/app/firebase/config';

type FavoriteType = 'recipe' | 'ration';

interface FavoriteItem {
  id: string;
  userId: string;
  favoriteType: FavoriteType;
  recipeId?: string;
  rationPlanId?: string;
  createdAt: Date | Timestamp;
  item?: any;
}

class FavoriteService {
  getCurrentUserId(): string | null {
    return auth.currentUser ? auth.currentUser.uid : null;
  }

  isValidId(id: string | null | undefined): boolean {
    return !!id && typeof id === 'string' && id.trim() !== '' && id.length >= 5;
  }

  async getUserFavorites(userId?: string | null): Promise<FavoriteItem[]> {
    try {
      const currentUserId = userId || this.getCurrentUserId();
      if (!currentUserId) {
        console.log("❌ Нет userId");
        return [];
      }

      const favoritesQuery = query(
        collection(db, 'user_favorites'),
        where('userId', '==', currentUserId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(favoritesQuery);
      
      const favorites: FavoriteItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FavoriteItem));

      // Загружаем данные для каждого избранного элемента
      const enrichedFavorites = await Promise.all(
        favorites.map(async (favorite) => {
          try {
            if (favorite.favoriteType === 'recipe' && favorite.recipeId) {
              const recipeDoc = await getDoc(doc(db, 'recipes', favorite.recipeId));
              if (recipeDoc.exists()) {
                favorite.item = { id: favorite.recipeId, ...recipeDoc.data() };
                return favorite;
              }
            } else if (favorite.favoriteType === 'ration' && favorite.rationPlanId) {
              const rationDoc = await getDoc(doc(db, 'ration_plans', favorite.rationPlanId));
              if (rationDoc.exists()) {
                favorite.item = { id: favorite.rationPlanId, ...rationDoc.data() };
                return favorite;
              }
            }
          } catch (error) {
            console.error("Ошибка загрузки:", error);
          }
          return null;
        })
      );

      return enrichedFavorites.filter(f => f !== null) as FavoriteItem[];
    } catch (error) {
      console.error('Ошибка получения избранного:', error);
      return [];
    }
  }

  async addToFavorites(
    itemId: string, 
    favoriteType: FavoriteType, 
    userId: string
  ): Promise<FavoriteItem> {
    if (!userId) throw new Error('User ID is required');
    if (!this.isValidId(itemId)) throw new Error('Некорректный ID');

    const existing = await this.isInFavorites(itemId, favoriteType, userId);
    if (existing) throw new Error('Уже в избранном');

    const favoriteData: any = {
      userId,
      favoriteType,
      createdAt: Timestamp.now()
    };

    if (favoriteType === 'recipe') {
      favoriteData.recipeId = itemId;
    } else {
      favoriteData.rationPlanId = itemId;
    }

    const docRef = await addDoc(collection(db, 'user_favorites'), favoriteData);
    return { id: docRef.id, ...favoriteData } as FavoriteItem;
  }

  // ГЛАВНОЕ ИСПРАВЛЕНИЕ - УДАЛЯЕМ, А НЕ ДЕАКТИВИРУЕМ
  async removeFromFavorites(
    itemId: string, 
    favoriteType: FavoriteType, 
    userId: string
  ): Promise<boolean> {
    console.log(`➖ УДАЛЕНИЕ из избранного: ${favoriteType} ${itemId}, userId: ${userId}`);
    
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!this.isValidId(itemId)) {
      throw new Error('Некорректный ID элемента');
    }

    let favoritesQuery;
    if (favoriteType === 'recipe') {
      favoritesQuery = query(
        collection(db, 'user_favorites'),
        where('userId', '==', userId),
        where('recipeId', '==', itemId)
      );
    } else {
      favoritesQuery = query(
        collection(db, 'user_favorites'),
        where('userId', '==', userId),
        where('rationPlanId', '==', itemId)
      );
    }

    const snapshot = await getDocs(favoritesQuery);
    
    if (snapshot.empty) {
      throw new Error('Не найдено в избранном');
    }

    // ПОЛНОСТЬЮ УДАЛЯЕМ документы
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    console.log(`✅ Удалено ${snapshot.docs.length} записей`);
    return true;
  }

  async isInFavorites(
    itemId: string, 
    favoriteType: FavoriteType, 
    userId?: string | null
  ): Promise<boolean> {
    const currentUserId = userId || this.getCurrentUserId();
    if (!currentUserId || !this.isValidId(itemId)) return false;

    let favoritesQuery;
    if (favoriteType === 'recipe') {
      favoritesQuery = query(
        collection(db, 'user_favorites'),
        where('userId', '==', currentUserId),
        where('recipeId', '==', itemId)
      );
    } else {
      favoritesQuery = query(
        collection(db, 'user_favorites'),
        where('userId', '==', currentUserId),
        where('rationPlanId', '==', itemId)
      );
    }

    const snapshot = await getDocs(favoritesQuery);
    return !snapshot.empty;
  }

  async getFavoriteRecipes(userId?: string | null): Promise<FavoriteItem[]> {
    const allFavorites = await this.getUserFavorites(userId);
    return allFavorites.filter(fav => fav.favoriteType === 'recipe');
  }

  async getFavoriteRations(userId?: string | null): Promise<FavoriteItem[]> {
    const allFavorites = await this.getUserFavorites(userId);
    return allFavorites.filter(fav => fav.favoriteType === 'ration');
  }
}

export const favoriteService = new FavoriteService();