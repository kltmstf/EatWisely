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
  orderBy,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

class FavoriteService {
  // Получить ID текущего пользователя
  getCurrentUserId() {
    return auth.currentUser ? auth.currentUser.uid : null;
  }

  // Проверить авторизацию
  isAuthenticated() {
    return !!auth.currentUser;
  }

  // Проверить валидность ID
  isValidId(id) {
    return id && 
           typeof id === 'string' && 
           id.trim() !== '' && 
           id !== 'undefined' && 
           id !== 'null' &&
           id.length >= 5;
  }

  // Получить все избранное пользователя
  async getUserFavorites(userId = null) {
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

      const favorites = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log("📊 Найдено избранных:", favorites.length);

      // Определяем favoriteType для каждого элемента
      favorites.forEach((fav, index) => {
        if (!fav.favoriteType || fav.favoriteType === 'undefined') {
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
                const recipeDoc = await getDoc(doc(db, 'recipes', favorite.recipeId));
                
                if (recipeDoc.exists()) {
                  const recipeData = recipeDoc.data();
                  console.log(`  ✅ Рецепт найден: ${recipeData.title || recipeData.name || 'Без названия'}`);
                  
                  favorite.item = { 
                    id: recipeDoc.id, 
                    ...recipeData 
                  };
                } else {
                  console.log(`  ❌ Рецепт ${favorite.recipeId} не найден`);
                  return null; // Пропускаем этот элемент
                }
              } catch (docError) {
                console.error(`  💥 Ошибка загрузки рецепта ${favorite.recipeId}:`, docError.message);
                return null;
              }
              
            } else if (favorite.favoriteType === 'ration' && this.isValidId(favorite.rationPlanId)) {
              console.log(`  🔍 Поиск плана с ID: ${favorite.rationPlanId}`);
              
              try {
                const rationDoc = await getDoc(doc(db, 'ration_plans', favorite.rationPlanId));
                
                if (rationDoc.exists()) {
                  const rationData = rationDoc.data();
                  console.log(`  ✅ План найден: ${rationData.name || 'Без названия'}`);
                  
                  favorite.item = { 
                    id: rationDoc.id, 
                    ...rationData 
                  };
                } else {
                  console.log(`  ❌ План ${favorite.rationPlanId} не найден`);
                  return null;
                }
              } catch (docError) {
                console.error(`  💥 Ошибка загрузки плана ${favorite.rationPlanId}:`, docError.message);
                return null;
              }
            }
          } catch (error) {
            console.error(`  💥 Общая ошибка загрузки данных:`, error.message);
            return null;
          }
          
          return favorite.item ? favorite : null;
        })
      );

      // Фильтруем только валидные записи (не null)
      const validFavorites = enrichedFavorites.filter(fav => fav !== null);
      console.log("🎯 Валидных избранных с данными:", validFavorites.length);

      return validFavorites;
    } catch (error) {
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

  // Добавить в избранное
  async addToFavorites(itemId, favoriteType, userId = null) {
    try {
      const currentUserId = userId || this.getCurrentUserId();
      if (!currentUserId) {
        throw new Error('Пользователь не аутентифицирован');
      }

      if (!this.isValidId(itemId)) {
        throw new Error('Некорректный ID элемента');
      }

      console.log(`➕ Добавление в избранное: ${favoriteType} ${itemId}`);

      // Проверяем, не добавлено ли уже
      const existing = await this.isInFavorites(itemId, favoriteType, currentUserId);
      if (existing) {
        console.log("⚠️ Уже в избранном, активируем запись");
        
        // Находим и активируем существующую запись
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
        if (!snapshot.empty) {
          const docToUpdate = snapshot.docs[0];
          await updateDoc(docToUpdate.ref, { 
            active: true,
            favoriteType: favoriteType 
          });
          return { id: docToUpdate.id, ...docToUpdate.data() };
        }
      }

      const favoriteData = {
        userId: currentUserId,
        favoriteType: favoriteType,
        createdAt: new Date(),
        active: true
      };

      if (favoriteType === 'recipe') {
        favoriteData.recipeId = itemId;
      } else {
        favoriteData.rationPlanId = itemId;
      }

      console.log(`  📤 Сохранение в Firestore...`);
      const docRef = await addDoc(collection(db, 'user_favorites'), favoriteData);
      console.log(`  ✅ Добавлено в избранное с ID: ${docRef.id}`);
      
      return { id: docRef.id, ...favoriteData };
    } catch (error) {
      console.error('💥 Ошибка добавления в избранное:', error);
      throw error;
    }
  }

  // Удалить из избранного
  async removeFromFavorites(itemId, favoriteType, userId = null) {
    try {
      const currentUserId = userId || this.getCurrentUserId();
      if (!currentUserId) {
        throw new Error('Пользователь не аутентифицирован');
      }

      if (!this.isValidId(itemId)) {
        throw new Error('Некорректный ID элемента');
      }

      console.log(`➖ Удаление из избранного: ${favoriteType} ${itemId}`);

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
    } catch (error) {
      console.error('💥 Ошибка удаления из избранного:', error);
      throw error;
    }
  }

  // Проверить, находится ли в избранном
  async isInFavorites(itemId, favoriteType, userId = null) {
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
    } catch (error) {
      console.error('💥 Ошибка проверки избранного:', error);
      return false;
    }
  }

  // Получить только избранные рецепты
  async getFavoriteRecipes(userId = null) {
    try {
      console.log("🍳 Загрузка только избранных рецептов...");
      const allFavorites = await this.getUserFavorites(userId);
      const recipes = allFavorites.filter(fav => fav.favoriteType === 'recipe');
      console.log(`  📊 Найдено рецептов: ${recipes.length}`);
      return recipes;
    } catch (error) {
      console.error('💥 Ошибка получения избранных рецептов:', error);
      return [];
    }
  }

  // Получить только избранные планы
  async getFavoriteRations(userId = null) {
    try {
      console.log("📅 Загрузка только избранных планов...");
      const allFavorites = await this.getUserFavorites(userId);
      const rations = allFavorites.filter(fav => fav.favoriteType === 'ration');
      console.log(`  📊 Найдено планов: ${rations.length}`);
      return rations;
    } catch (error) {
      console.error('💥 Ошибка получения избранных планов:', error);
      return [];
    }
  }

  // Обновить активность записи
  async setFavoriteActive(itemId, favoriteType, active = true, userId = null) {
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
        favoriteType: favoriteType // Обновляем тип для совместимости
      });
      
      console.log(`  ✅ Активность записи ${docToUpdate.id} обновлена на ${active}`);
      
      return true;
    } catch (error) {
      console.error('💥 Ошибка обновления избранного:', error);
      throw error;
    }
  }
}

export const favoriteService = new FavoriteService();