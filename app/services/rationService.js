import { 
  collection, 
  setDoc, // Используем setDoc для создания/обновления по известному ID
  doc, 
  getDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

// ----------------------------------------------------------------------
// ПОМОЩНИК: Получение ID документа для дневного плана
// Формат: [userId]_[YYYY-MM-DD]
const getDailyPlanDocId = (userId, date) => {
  const dateStr = date.toISOString().split('T')[0];
  return `${userId}_${dateStr}`;
};
// ----------------------------------------------------------------------

class DailyRationService {
  /**
   * 1. СОЗДАНИЕ ИЛИ ОБНОВЛЕНИЕ ДНЕВНОГО РАЦИОНА
   * Сохраняет 4 ID рецепта в одном документе в ration_plan_days.
   * * @param {Date} date - Дата плана.
   * @param {object} recipeIds - Объект с ID рецептов (breakfastRecipeId, etc.).
   * @returns {Promise<object>} Сохраненный документ.
   */
  async createDailyRation(date, recipeIds) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');
      
      const docId = getDailyPlanDocId(user.uid, date);
      const planRef = doc(db, 'ration_plan_days', docId);

      const planData = {
        userId: user.uid,
        planDate: date.toISOString(), // Храним дату в ISO формате для простоты
        ...recipeIds, // Содержит: { breakfastRecipeId, lunchRecipeId, ... }
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // setDoc создает или полностью перезаписывает документ
      await setDoc(planRef, planData, { merge: true }); 

      return { id: docId, ...planData };
    } catch (error) {
      console.error('Error creating daily ration plan:', error);
      throw error;
    }
  }

  /**
   * 2. ПОЛУЧЕНИЕ ДНЕВНОГО РАЦИОНА (Один запрос)
   * Возвращает 4 ID рецепта для указанной даты.
   * * @param {Date} date - Дата плана для загрузки.
   * @returns {Promise<object|null>} Объект плана или null.
   */
  async getDailyRation(date) {
    try {
      const user = auth.currentUser;
      if (!user) {
        // Для неаутентифицированных пользователей возвращаем null, 
        // или можете использовать анонимный userId, если нужно
        return null;
      }

      const docId = getDailyPlanDocId(user.uid, date);
      const planRef = doc(db, 'ration_plan_days', docId);
      const planSnap = await getDoc(planRef);

      if (planSnap.exists()) {
        return { id: planSnap.id, ...planSnap.data() };
      } else {
        return null;
      }

    } catch (error) {
      console.error('Error getting daily ration:', error);
      throw error;
    }
  }

  // --- Устаревшие или неиспользуемые методы удалены ---
  
  // Примечание: Для загрузки деталей рецепта (ингредиенты, шаги) 
  // используйте отдельный RecipeService или просто doc(db, 'recipes', recipeId) 
  // прямо в компоненте Meal.tsx.
}

export const dailyRationService = new DailyRationService();
export default dailyRationService;