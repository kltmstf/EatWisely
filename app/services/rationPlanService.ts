import { 
  doc, 
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/app/firebase/config';

export interface Meal {
  id: string;
  recipeId: string;
  name: string;
  category: string;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  weight: string;
  cookingTime: number;
  difficultyLevel: string;
  imageUrl?: string;
  marked?: boolean;
  bookmarked?: boolean;
  isCustom?: boolean;
  canBeRemoved?: boolean;
  addedAt?: string;
}

export interface DayPlan {
  day: number;
  date?: string;
  meals: Meal[];
  stats: {
    totalCalories: number;
    totalProteins: number;
    totalFats: number;
    totalCarbs: number;
    totalCookingTime: number;
    completedMeals?: number;
    totalMeals?: number;
  };
}

export interface RationPlan {
  id?: string;
  userId: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  meals?: Meal[]; // Поддержка новой плоской структуры
  days: DayPlan[];
  isTemplate: boolean;
  usedDates: string[];
  status: 'active' | 'completed' | 'archived' | 'draft' | 'template';
  category: string;
  totalCalories: number;
  totalDuration: string;
  mealsCount: number;
  createdAt: string;
  updatedAt: string;
  startDate?: string;
  endDate?: string;
  planDate?: string;
}

class RationPlanService {
  
  async getActivePlanForToday(userId: string): Promise<RationPlan | null> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        where('startDate', '==', today)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const data = snapshot.docs[0].data();
      return { id: snapshot.docs[0].id, ...data } as RationPlan;
    } catch (error) {
      console.error('Ошибка получения активного плана:', error);
      return null;
    }
  }
  
  async hasActivePlanForToday(userId: string): Promise<boolean> {
    const activePlan = await this.getActivePlanForToday(userId);
    return activePlan !== null;
  }
  
  async activatePlanOnDate(planId: string, userId: string, date: Date): Promise<boolean> {
    try {
      const dateStr = date.toISOString().split('T')[0];
      console.log(`🔄 Активация плана ${planId} на дату ${dateStr}`);
      
      const planRef = doc(db, 'ration_plans', planId);
      const planSnap = await getDoc(planRef);
      if (!planSnap.exists()) throw new Error('План не найден');
      
      const planData = planSnap.data();
      
      // Деактивируем все активные планы на эту дату
      const activeQuery = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        where('startDate', '==', dateStr)
      );
      const activeSnapshot = await getDocs(activeQuery);
      
      for (const doc of activeSnapshot.docs) {
        await updateDoc(doc.ref, { 
          status: 'completed',
          updatedAt: new Date().toISOString()
        });
      }
      
      // ИСПРАВЛЕНО: Ищем meals сначала в корне, затем в днях
      const meals = planData.meals || planData.days?.[0]?.meals || [];
      const mealsCount = meals.length;
      const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
      const totalProteins = meals.reduce((sum: number, m: any) => sum + (m.proteins || 0), 0);
      const totalFats = meals.reduce((sum: number, m: any) => sum + (m.fats || 0), 0);
      const totalCarbs = meals.reduce((sum: number, m: any) => sum + (m.carbohydrates || 0), 0);
      
      // Сохраняем в daily_plans для страницы Home
      const dailyPlanRef = doc(db, 'users', userId, 'daily_plans', dateStr);
      await setDoc(dailyPlanRef, {
        meals: meals,
        stats: {
          totalCalories,
          totalProteins,
          totalFats,
          totalCarbs,
          totalCookingTime: meals.reduce((sum: number, m: any) => sum + (m.cookingTime || 0), 0)
        },
        updatedAt: new Date().toISOString()
      });
      
      // Активируем выбранный план
      await updateDoc(planRef, {
        status: 'active',
        startDate: dateStr,
        endDate: dateStr,
        isTemplate: false,
        mealsCount: mealsCount,
        totalCalories: totalCalories,
        updatedAt: new Date().toISOString()
      });
      
      console.log(`✅ План активирован на ${dateStr}, блюд: ${mealsCount}`);
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка активации плана на дату:', error);
      return false;
    }
  }
  
  async deactivateAllActivePlansForToday(userId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        where('startDate', '==', today)
      );
      const snapshot = await getDocs(q);
      
      for (const doc of snapshot.docs) {
        await updateDoc(doc.ref, { 
          status: 'completed',
          updatedAt: new Date().toISOString()
        });
      }
      console.log(`✅ Деактивировано ${snapshot.size} планов на сегодня`);
    } catch (error) {
      console.error('Ошибка деактивации:', error);
    }
  }
  
  async deactivateAllActivePlans(userId: string): Promise<void> {
    await this.deactivateAllActivePlansForToday(userId);
  }
  
  async getActivePlan(userId: string): Promise<RationPlan | null> {
    return this.getActivePlanForToday(userId);
  }
  
  async getActivePlans(userId: string): Promise<RationPlan[]> {
    const activePlan = await this.getActivePlanForToday(userId);
    return activePlan ? [activePlan] : [];
  }
  
  async getUserTemplates(userId: string): Promise<RationPlan[]> {
    try {
      const q = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        where('isTemplate', '==', true),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RationPlan));
    } catch (error) {
      console.error('Ошибка получения шаблонов:', error);
      return [];
    }
  }
  
  async getUserRationPlans(userId: string): Promise<RationPlan[]> {
    try {
      const q = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const plans = snapshot.docs.map(doc => {
        const data = doc.data();
        // ИСПРАВЛЕНО: Безопасный подсчет количества блюд из любой структуры
        const mealsCount = data.meals?.length || data.days?.[0]?.meals?.length || data.mealsCount || 0;
        return { 
          id: doc.id, 
          ...data,
          mealsCount: mealsCount
        } as RationPlan;
      });
      return plans;
    } catch (error) {
      console.error('Ошибка получения планов:', error);
      return [];
    }
  }
  
  async getRationPlanById(planId: string, userId?: string): Promise<RationPlan | null> {
    try {
      const planRef = doc(db, 'ration_plans', planId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        const data = planSnap.data();
        if (userId && data.userId !== userId) return null;

        // ✨ ХЕЙЛ-МЕРИ ДЛЯ АРХИВНЫХ ПЛАНОВ:
        // Гарантируем, что meals и days ВСЕГДА существуют в объекте, 
        // даже если план старый или плоский.
        const meals = data.meals || data.days?.[0]?.meals || [];
        const totalCalories = data.totalCalories || meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
        
        const daysData = data.days || [{
          day: 1,
          meals: meals,
          stats: {
            totalCalories,
            totalProteins: meals.reduce((sum: number, m: any) => sum + (m.proteins || 0), 0),
            totalFats: meals.reduce((sum: number, m: any) => sum + (m.fats || 0), 0),
            totalCarbs: meals.reduce((sum: number, m: any) => sum + (m.carbohydrates || 0), 0),
            totalCookingTime: meals.reduce((sum: number, m: any) => sum + (m.cookingTime || 0), 0)
          }
        }];

        return { 
          id: planSnap.id, 
          ...data,
          meals: meals,    // Теперь экран просмотра через .meals увидит блюда
          days: daysData   // И экран просмотра через .days[0] тоже их увидит!
        } as RationPlan;
      }
      return null;
    } catch (error) {
      console.error('Ошибка получения плана:', error);
      return null;
    }
  }
  
  async createRationPlan(userId: string, planData: Partial<RationPlan>): Promise<string> {
    try {
      const now = new Date().toISOString();
      
      // ИСПРАВЛЕНО: Извлекаем блюда как из корневого массива, так и из старого "days"
      const meals = planData.meals || planData.days?.[0]?.meals || [];
      const mealsCount = meals.length;
      const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
      
      // ИСПРАВЛЕНО: Если days не передан, собираем его автоматически, чтобы не ломать типы
      const daysData = planData.days || [{
        day: 1,
        meals: meals,
        stats: {
          totalCalories,
          totalProteins: meals.reduce((sum: number, m: any) => sum + (m.proteins || 0), 0),
          totalFats: meals.reduce((sum: number, m: any) => sum + (m.fats || 0), 0),
          totalCarbs: meals.reduce((sum: number, m: any) => sum + (m.carbohydrates || 0), 0),
          totalCookingTime: meals.reduce((sum: number, m: any) => sum + (m.cookingTime || 0), 0)
        }
      }];

      const newPlan = {
        userId,
        title: planData.title || 'Новый шаблон',
        description: planData.description || '',
        type: 'daily',
        meals: meals, // Сохраняем в корень (новый вариант)
        days: daysData, // Сохраняем обратную совместимость (старый вариант)
        isTemplate: true,
        usedDates: [],
        status: 'template',
        category: planData.category || 'Шаблон',
        totalCalories: totalCalories,
        totalDuration: '1日',
        mealsCount: mealsCount,
        createdAt: now,
        updatedAt: now,
      };
      
      const docRef = await addDoc(collection(db, 'ration_plans'), newPlan);
      console.log('✅ Шаблон создан:', docRef.id);
      return docRef.id;
      
    } catch (error) {
      console.error('Ошибка создания шаблона:', error);
      throw error;
    }
  }
  
  async saveDailyRationAsTemplate(userId: string, dailyPlanData: any): Promise<string> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const meals = dailyPlanData.meals || [];
      const mealsCount = meals.length;
      const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
      
      const templateData: Partial<RationPlan> = {
        userId: userId,
        title: dailyPlanData.title || `Рацион на ${today}`,
        description: dailyPlanData.description || `Дневной рацион от ${new Date().toLocaleDateString('ru-RU')}`,
        type: 'daily',
        meals: meals, // В корень
        days: [{
          day: 1,
          meals: meals,
          stats: dailyPlanData.stats || {
            totalCalories: totalCalories,
            totalProteins: meals.reduce((sum: number, m: any) => sum + (m.proteins || 0), 0),
            totalFats: meals.reduce((sum: number, m: any) => sum + (m.fats || 0), 0),
            totalCarbs: meals.reduce((sum: number, m: any) => sum + (m.carbohydrates || 0), 0),
            totalCookingTime: meals.reduce((sum: number, m: any) => sum + (m.cookingTime || 0), 0)
          }
        }],
        isTemplate: true,
        usedDates: [],
        status: 'template',
        category: dailyPlanData.category || 'Дневной рацион',
        totalCalories: totalCalories,
        totalDuration: '1 день',
        mealsCount: mealsCount,
        planDate: today
      };
      
      return await this.createRationPlan(userId, templateData);
      
    } catch (error) {
      console.error('❌ Ошибка сохранения шаблона:', error);
      throw error;
    }
  }
  
  async updateRationPlan(userId: string, planId: string, planData: any): Promise<boolean> {
    try {
      const planRef = doc(db, 'ration_plans', planId);
      
      // ИСПРАВЛЕНО: Безопасное чтение meals из корня или из days
      const meals = planData.meals || planData.days?.[0]?.meals || [];
      const mealsCount = meals.length;
      const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
      
      // Пересобираем days автоматически, если пришла чисто плоская структура
      const daysData = planData.days || [{
        day: 1,
        meals: meals,
        stats: {
          totalCalories,
          totalProteins: meals.reduce((sum: number, m: any) => sum + (m.proteins || 0), 0),
          totalFats: meals.reduce((sum: number, m: any) => sum + (m.fats || 0), 0),
          totalCarbs: meals.reduce((sum: number, m: any) => sum + (m.carbohydrates || 0), 0),
          totalCookingTime: meals.reduce((sum: number, m: any) => sum + (m.cookingTime || 0), 0)
        }
      }];

      const updateData = {
        ...planData,
        meals: meals,
        days: daysData,
        mealsCount: mealsCount,
        totalCalories: totalCalories,
        updatedAt: new Date().toISOString()
      };
      delete updateData.id;
      delete updateData.userId;
      delete updateData.createdAt;
      
      await updateDoc(planRef, updateData);
      console.log('✅ План обновлен:', planId);
      return true;
      
    } catch (error) {
      console.error('Ошибка обновления:', error);
      return false;
    }
  }
  
  async deleteRationPlan(planId: string, userId?: string): Promise<void> {
    try {
      if (userId) {
        const plan = await this.getRationPlanById(planId, userId);
        if (!plan) throw new Error('План не найден');
      }
      await deleteDoc(doc(db, 'ration_plans', planId));
      console.log('✅ План удален:', planId);
    } catch (error) {
      console.error('Ошибка удаления:', error);
      throw error;
    }
  }
  
  async useRationPlan(planId: string, userId: string, startDate: Date, endDate: Date, markAsUsed: boolean): Promise<void> {
    await this.activatePlanOnDate(planId, userId, startDate);
  }
  
  async activatePlan(planId: string, userId: string): Promise<boolean> {
    return this.activatePlanOnDate(planId, userId, new Date());
  }
}

export const rationPlanService = new RationPlanService();