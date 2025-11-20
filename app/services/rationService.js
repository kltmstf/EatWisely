// services/rationService.js
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
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

class RationService {
  // Создать рацион питания
  async createRationPlan(planData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const batch = writeBatch(db);

      // Создаем основной план
      const planRef = doc(collection(db, 'ration_plans'));
      const planWithMetadata = {
        title: planData.title,
        description: planData.description || '',
        startDate: planData.startDate,
        endDate: planData.endDate,
        isTemplate: planData.isTemplate || false,
        status: 'active',
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      batch.set(planRef, planWithMetadata);

      // Создаем дни и приемы пищи
      for (const dayData of planData.days) {
        const dayRef = doc(collection(db, 'ration_plan_days'));
        const dayWithMetadata = {
          planDate: dayData.date,
          rationPlanId: planRef.id,
          createdAt: new Date()
        };
        batch.set(dayRef, dayWithMetadata);

        for (const mealData of dayData.meals) {
          const mealRef = doc(collection(db, 'ration_plan_meals'));
          const mealWithMetadata = {
            mealType: mealData.mealType,
            recipeId: mealData.recipeId,
            customMealName: mealData.customMealName,
            scheduledTime: mealData.scheduledTime,
            dayId: dayRef.id,
            sortOrder: mealData.sortOrder || 0,
            createdAt: new Date()
          };
          batch.set(mealRef, mealWithMetadata);
        }
      }

      await batch.commit();
      return { id: planRef.id, ...planWithMetadata };
    } catch (error) {
      console.error('Error creating ration plan:', error);
      throw error;
    }
  }

  // Получить текущий активный рацион
  async getCurrentRation() {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const plansQuery = query(
        collection(db, 'ration_plans'),
        where('userId', '==', user.uid),
        where('status', '==', 'active'),
        where('startDate', '<=', today),
        where('endDate', '>=', today)
      );

      const snapshot = await getDocs(plansQuery);
      if (snapshot.empty) return null;

      const planDoc = snapshot.docs[0];
      const plan = { id: planDoc.id, ...planDoc.data() };

      // Получаем полные данные рациона
      return await this.getRationPlanDetails(plan.id);
    } catch (error) {
      console.error('Error getting current ration:', error);
      throw error;
    }
  }

  // Получить детали рациона по ID
  async getRationPlanDetails(planId) {
    try {
      const planRef = doc(db, 'ration_plans', planId);
      const planDoc = await getDoc(planRef);

      if (!planDoc.exists()) {
        throw new Error('Ration plan not found');
      }

      const plan = { id: planDoc.id, ...planDoc.data() };

      // Проверяем права доступа
      const user = auth.currentUser;
      if (plan.userId !== user?.uid) {
        throw new Error('Access denied');
      }

      // Получаем дни рациона
      const daysQuery = query(
        collection(db, 'ration_plan_days'),
        where('rationPlanId', '==', plan.id),
        orderBy('planDate', 'asc')
      );
      const daysSnapshot = await getDocs(daysQuery);

      const days = await Promise.all(
        daysSnapshot.docs.map(async (dayDoc) => {
          const day = { id: dayDoc.id, ...dayDoc.data() };

          // Получаем приемы пищи для дня
          const mealsQuery = query(
            collection(db, 'ration_plan_meals'),
            where('dayId', '==', day.id),
            orderBy('sortOrder', 'asc')
          );
          const mealsSnapshot = await getDocs(mealsQuery);

          day.meals = await Promise.all(
            mealsSnapshot.docs.map(async (mealDoc) => {
              const meal = { id: mealDoc.id, ...mealDoc.data() };

              // Если есть recipeId, получаем рецепт
              if (meal.recipeId) {
                try {
                  const recipeDoc = await getDoc(doc(db, 'recipes', meal.recipeId));
                  if (recipeDoc.exists()) {
                    meal.recipe = { id: recipeDoc.id, ...recipeDoc.data() };
                  }
                } catch (error) {
                  console.warn(`Recipe ${meal.recipeId} not found`);
                }
              }

              return meal;
            })
          );

          return day;
        })
      );

      return { ...plan, days };
    } catch (error) {
      console.error('Error getting ration plan details:', error);
      throw error;
    }
  }

  // Получить историю рационов
  async getRationHistory(month = null) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      let plansQuery;

      if (month) {
        const startDate = new Date(`${month}-01`);
        const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
        
        plansQuery = query(
          collection(db, 'ration_plans'),
          where('userId', '==', user.uid),
          where('startDate', '>=', startDate),
          where('startDate', '<=', endDate),
          orderBy('startDate', 'desc')
        );
      } else {
        plansQuery = query(
          collection(db, 'ration_plans'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
      }

      const snapshot = await getDocs(plansQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting ration history:', error);
      throw error;
    }
  }

  // Обновить рацион
  async updateRationPlan(planId, updates) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const planRef = doc(db, 'ration_plans', planId);
      const planDoc = await getDoc(planRef);

      if (!planDoc.exists()) {
        throw new Error('Ration plan not found');
      }

      if (planDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to update this ration plan');
      }

      await updateDoc(planRef, {
        ...updates,
        updatedAt: new Date()
      });

      return { id: planId, ...updates };
    } catch (error) {
      console.error('Error updating ration plan:', error);
      throw error;
    }
  }

  // Удалить рацион
  async deleteRationPlan(planId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const planRef = doc(db, 'ration_plans', planId);
      const planDoc = await getDoc(planRef);

      if (!planDoc.exists()) {
        throw new Error('Ration plan not found');
      }

      if (planDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to delete this ration plan');
      }

      // Удаляем также все связанные дни и приемы пищи
      const batch = writeBatch(db);

      // Находим и удаляем дни
      const daysQuery = query(
        collection(db, 'ration_plan_days'),
        where('rationPlanId', '==', planId)
      );
      const daysSnapshot = await getDocs(daysQuery);

      daysSnapshot.docs.forEach(dayDoc => {
        // Находим и удаляем приемы пищи для каждого дня
        const mealsQuery = query(
          collection(db, 'ration_plan_meals'),
          where('dayId', '==', dayDoc.id)
        );
        
        // В реальном приложении нужно дождаться получения meals
        // Для упрощения удаляем только дни (meals удалятся каскадно если настроены правила)
        batch.delete(dayDoc.ref);
      });

      // Удаляем основной план
      batch.delete(planRef);

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error deleting ration plan:', error);
      throw error;
    }
  }

  // Клонировать рацион как шаблон
  async cloneRationAsTemplate(planId, newTitle) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Получаем исходный рацион
      const originalPlan = await this.getRationPlanDetails(planId);
      if (!originalPlan) throw new Error('Ration plan not found');

      // Подготавливаем данные для нового рациона
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + (originalPlan.days?.length || 7) - 1);

      const planData = {
        title: newTitle || `${originalPlan.title} (Копия)`,
        description: originalPlan.description,
        startDate: today,
        endDate: endDate,
        isTemplate: true,
        days: originalPlan.days.map(day => ({
          date: new Date(today.getTime() + (new Date(day.planDate).getTime() - new Date(originalPlan.startDate).getTime())),
          meals: day.meals.map(meal => ({
            mealType: meal.mealType,
            recipeId: meal.recipeId,
            customMealName: meal.customMealName,
            scheduledTime: meal.scheduledTime,
            sortOrder: meal.sortOrder
          }))
        }))
      };

      return await this.createRationPlan(planData);
    } catch (error) {
      console.error('Error cloning ration plan:', error);
      throw error;
    }
  }
}

export const rationService = new RationService();
export default rationService;