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
  updateDoc,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { db, auth } from '@/app/firebase/config';

type FavoriteType = 'recipe' | 'ration';

interface FavoriteItem {
  id: string;
  userId: string;
  favoriteType: FavoriteType;
  recipeId?: string;
  rationPlanId?: string;
  active?: boolean;
  createdAt: Date | Timestamp;
  item?: any;
}

interface RecipeData {
  id: string;
  title?: string;
  name?: string;
  category?: string;
  calories?: number;
  proteins?: number;
  fats?: number;
  carbohydrates?: number;
  cookingTime?: string;
  difficultyLevel?: string;
  rating?: number;
  imageUrl?: string;
}

interface RationPlanData {
  id: string;
  name?: string;
  description?: string;
  totalCalories?: number;
  totalProteins?: number;
  totalFats?: number;
  totalCarbs?: number;
  meals?: any[];
  createdAt?: Date;
}

class FavoriteService {
  // Получить ID текущего пользователя
  getCurrentUserId(): string | null {
    return auth.currentUser ? auth.currentUser.uid : null;
  }

  // Проверить авторизацию
  isAuthenticated(): boolean {
    return !!auth.currentUser;
  }

  // Проверить валидность ID
  isValidId(id: string | null | undefined): boolean {
    return !!id && 
           typeof id === 'string' && 
           id.trim() !== '' && 
           id !== 'undefined' && 
           id !== 'null' &&
           id.length >= 5;
  }

  // Получить все избранное пользователя
  async getUserFavorites(userId?: string | null): Promise<FavoriteItem[]> {
    try {
      const currentUserId = userId || this.getCurrentUserId();
      if (!currentUserId) {
        console.log("❌ Нет userId для загрузки избранного");
        return [];
      }

      console.log("🔄 Загрузка избранного для пользователя:", currentUserId);

      const favoritesQuery = query(
        collection(db, 'user_favorites'),
        where('userId', '==', currentUserId),
        orderBy('createdAt', 'desc')
      );

      console.log("📝 Выполняем запрос к Firestore...");
      const snapshot = await getDocs(favoritesQuery);
      console.log("✅ Запрос выполнен, документов:", snapshot.docs.length);

      const favorites: FavoriteItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FavoriteItem));

      console.log("📊 Найдено избранных:", favorites.length);

      // Определяем favoriteType для каждого элемента
      favorites.forEach((fav) => {
        if (!fav.favoriteType || fav.favoriteType === 'undefined' as any) { // ИСПРАВЛЕНО: приведение типа
          if (fav.recipeId) {
            fav.favoriteType = 'recipe';
          } else if (fav.rationPlanId) {
            fav.favoriteType = 'ration';
          }
        }
      });

      // Фильтруем активные записи
      const activeFavorites = favorites.filter(fav => 
        fav.active === undefined || fav.active === true
      );

      console.log("✅ Активных избранных:", activeFavorites.length);

      // Фильтруем только записи с определенным типом и ВАЛИДНЫМИ ID
      const favoritesWithType = activeFavorites.filter(fav => {
        if (!fav.favoriteType) return false;
        
        if (fav.favoriteType === 'recipe' && fav.recipeId) {
          return this.isValidId(fav.recipeId);
        } else if (fav.favoriteType === 'ration' && fav.rationPlanId) {
          return this.isValidId(fav.rationPlanId);
        }
        
        return false;
      });
      
      console.log("🔍 Избранных с валидным типом и ID:", favoritesWithType.length);

      // Загружаем дополнительные данные с безопасной обработкой
      console.log("🔄 Загрузка дополнительных данных...");
      const enrichedFavorites = await Promise.all(
        favoritesWithType.map(async (favorite) => {
          try {
            if (favorite.favoriteType === 'recipe' && this.isValidId(favorite.recipeId)) {
              console.log(`  🔍 Поиск рецепта с ID: ${favorite.recipeId}`);
              
              try {
                const recipeDoc = await getDoc(doc(db, 'recipes', favorite.recipeId!));
                
                if (recipeDoc.exists()) {
                  const recipeData = recipeDoc.data() as RecipeData;
                  console.log(`  ✅ Рецепт найден: ${recipeData.title || recipeData.name || 'Без названия'}`);
                  
                  // ИСПРАВЛЕНО: не дублируем id
                  favorite.item = { 
                    ...recipeData, // id уже включен в recipeData
                  };
                } else {
                  console.log(`  ❌ Рецепт ${favorite.recipeId} не найден`);
                  return null;
                }
              } catch (docError: any) {
                console.error(`  💥 Ошибка загрузки рецепта ${favorite.recipeId}:`, docError.message);
                return null;
              }
              
            } else if (favorite.favoriteType === 'ration' && this.isValidId(favorite.rationPlanId)) {
              console.log(`  🔍 Поиск плана с ID: ${favorite.rationPlanId}`);
              
              try {
                const rationDoc = await getDoc(doc(db, 'ration_plans', favorite.rationPlanId!));
                
                if (rationDoc.exists()) {
                  const rationData = rationDoc.data() as RationPlanData;
                  console.log(`  ✅ План найден: ${rationData.name || 'Без названия'}`);
                  
                  // ИСПРАВЛЕНО: не дублируем id
                  favorite.item = { 
                    ...rationData, // id уже включен в rationData
                  };
                } else {
                  console.log(`  ❌ План ${favorite.rationPlanId} не найден`);
                  return null;
                }
              } catch (docError: any) {
                console.error(`  💥 Ошибка загрузки плана ${favorite.rationPlanId}:`, docError.message);
                return null;
              }
            }
          } catch (error: any) {
            console.error(`  💥 Общая ошибка загрузки данных:`, error.message);
            return null;
          }
          
          return favorite.item ? favorite : null;
        })
      );

      // Фильтруем только валидные записи (не null)
      const validFavorites = enrichedFavorites.filter((fav): fav is FavoriteItem => fav !== null);
      console.log("🎯 Валидных избранных с данными:", validFavorites.length);

      return validFavorites;
    } catch (error: any) {
      console.error('💥 Ошибка при получении избранного:', error);
      console.error('Код ошибки:', error.code);
      console.error('Сообщение:', error.message);
      
      // Обработка ошибок индексов
      if (error.code === 'failed-precondition') {
        console.log("⚠️ Требуется создание индекса в Firestore.");
        return [];
      }
      
      // Ошибка "не авторизован"
      if (error.message && error.message.includes('not authenticated')) {
        console.log("🔒 Пользователь не авторизован");
        return [];
      }
      
      // Возвращаем пустой массив вместо ошибки
      return [];
    }
  }

  // Добавить в избранное (userId теперь обязательный)
  async addToFavorites(
    itemId: string, 
    favoriteType: FavoriteType, 
    userId: string // Обязательный параметр
  ): Promise<FavoriteItem> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!this.isValidId(itemId)) {
        throw new Error('Некорректный ID элемента');
      }

      console.log(`➕ Добавление в избранное: ${favoriteType} ${itemId}`);

      // Проверяем, не добавлено ли уже
      const existing = await this.isInFavorites(itemId, favoriteType, userId);
      if (existing) {
        console.log("⚠️ Уже в избранном, активируем запись");
        
        // Находим и активируем существующую запись
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
        if (!snapshot.empty) {
          const docToUpdate = snapshot.docs[0];
          const docData = docToUpdate.data();
          await updateDoc(docToUpdate.ref, { 
            active: true,
            favoriteType: favoriteType 
          });
          // ИСПРАВЛЕНО: возвращаем данные без дублирования id
          return { 
            id: docToUpdate.id, 
            ...docData 
          } as FavoriteItem;
        }
      }

      const favoriteData: Omit<FavoriteItem, 'id'> = {
        userId: userId,
        favoriteType: favoriteType,
        createdAt: Timestamp.now(),
        active: true
      };

      if (favoriteType === 'recipe') {
        (favoriteData as any).recipeId = itemId;
      } else {
        (favoriteData as any).rationPlanId = itemId;
      }

      console.log(`  📤 Сохранение в Firestore...`);
      const docRef = await addDoc(collection(db, 'user_favorites'), favoriteData);
      console.log(`  ✅ Добавлено в избранное с ID: ${docRef.id}`);
      
      return { id: docRef.id, ...favoriteData } as FavoriteItem;
    } catch (error: any) {
      console.error('💥 Ошибка добавления в избранное:', error);
      throw error;
    }
  }

  // Удалить из избранного (userId теперь обязательный)
  async removeFromFavorites(
    itemId: string, 
    favoriteType: FavoriteType, 
    userId: string // Обязательный параметр
  ): Promise<boolean> {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      if (!this.isValidId(itemId)) {
        throw new Error('Некорректный ID элемента');
      }

      console.log(`➖ Удаление из избранного: ${favoriteType} ${itemId}`);

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
      console.log(`  📊 Найдено документов: ${snapshot.docs.length}`);
      
      if (snapshot.empty) {
        throw new Error('Не найдено в избранном');
      }

      // Деактивируем записи вместо удаления (мягкое удаление)
      const updatePromises = snapshot.docs.map(doc => {
        console.log(`  🗑️ Деактивация ${doc.id}...`);
        return updateDoc(doc.ref, { active: false });
      });
      
      await Promise.all(updatePromises);
      console.log(`  ✅ Деактивировано ${snapshot.docs.length} записей`);
      
      return true;
    } catch (error: any) {
      console.error('💥 Ошибка удаления из избранного:', error);
      throw error;
    }
  }

  // Проверить, находится ли в избранном (userId опциональный)
  async isInFavorites(
    itemId: string, 
    favoriteType: FavoriteType, 
    userId?: string | null
  ): Promise<boolean> {
    try {
      const currentUserId = userId || this.getCurrentUserId();
      if (!currentUserId || !this.isValidId(itemId)) {
        return false;
      }

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
      const result = !snapshot.empty;
      
      // Проверяем активность записей
      if (result) {
        const hasActive = snapshot.docs.some(doc => {
          const data = doc.data();
          return data.active === undefined || data.active === true;
        });
        return hasActive;
      }
      
      return false;
    } catch (error: any) {
      console.error('💥 Ошибка проверки избранного:', error);
      return false;
    }
  }

  // Получить только избранные рецепты
  async getFavoriteRecipes(userId?: string | null): Promise<FavoriteItem[]> {
    try {
      console.log("🍳 Загрузка только избранных рецептов...");
      const allFavorites = await this.getUserFavorites(userId);
      const recipes = allFavorites.filter(fav => fav.favoriteType === 'recipe');
      console.log(`  📊 Найдено рецептов: ${recipes.length}`);
      return recipes;
    } catch (error: any) {
      console.error('💥 Ошибка получения избранных рецептов:', error);
      return [];
    }
  }

  // Получить только избранные планы
  async getFavoriteRations(userId?: string | null): Promise<FavoriteItem[]> {
    try {
      console.log("📅 Загрузка только избранных планов...");
      const allFavorites = await this.getUserFavorites(userId);
      const rations = allFavorites.filter(fav => fav.favoriteType === 'ration');
      console.log(`  📊 Найдено планов: ${rations.length}`);
      return rations;
    } catch (error: any) {
      console.error('💥 Ошибка получения избранных планов:', error);
      return [];
    }
  }

  // Обновить активность записи
  async setFavoriteActive(
    itemId: string, 
    favoriteType: FavoriteType, 
    active = true, 
    userId?: string | null
  ): Promise<boolean> {
    try {
      const currentUserId = userId || this.getCurrentUserId();
      if (!currentUserId) {
        throw new Error('Пользователь не аутентифицирован');
      }

      if (!this.isValidId(itemId)) {
        throw new Error('Некорректный ID элемента');
      }

      console.log(`${active ? '✅ Активация' : '❌ Деактивация'} избранного: ${favoriteType} ${itemId}`);

      // Находим документ
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
      
      if (snapshot.empty) {
        throw new Error('Не найдено в избранном');
      }

      // Обновляем поле active
      const docToUpdate = snapshot.docs[0];
      console.log(`  📝 Обновление документа ${docToUpdate.id}...`);
      await updateDoc(docToUpdate.ref, { 
        active: active,
        favoriteType: favoriteType
      });
      
      console.log(`  ✅ Активность записи ${docToUpdate.id} обновлена на ${active}`);
      
      return true;
    } catch (error: any) {
      console.error('💥 Ошибка обновления избранного:', error);
      throw error;
    }
  }
}

export const favoriteService = new FavoriteService();