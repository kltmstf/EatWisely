// app/services/rationPlanService.ts - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ

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
  title?: string;
  category: string;
  mealType?: string;
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
  meals?: Meal[];
  days?: DayPlan[];
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
      const meals = data.meals || [];
      return { id: snapshot.docs[0].id, ...data, meals } as RationPlan;
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
      
      // Берем meals из корня плана
      const meals = planData.meals || [];
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
        planId: planId,
        planTitle: planData.title || "План питания",
        updatedAt: new Date().toISOString()
      });
      
      // Обновляем ration_plan_days
      const planDayId = `${userId}_${dateStr}_${planId}`;
      const planDayRef = doc(db, 'ration_plan_days', planDayId);
      await setDoc(planDayRef, {
        userId: userId,
        planId: planId,
        date: dateStr,
        meals: meals,
        stats: {
          totalCalories,
          totalProteins,
          totalFats,
          totalCarbs,
          totalCookingTime: meals.reduce((sum: number, m: any) => sum + (m.cookingTime || 0), 0)
        },
        isActive: true,
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
      
      // Также деактивируем в ration_plan_days
      const planDayId = `${userId}_${today}_`;
      const planDaysQuery = query(
        collection(db, 'ration_plan_days'),
        where('userId', '==', userId),
        where('date', '==', today)
      );
      const planDaysSnap = await getDocs(planDaysQuery);
      for (const doc of planDaysSnap.docs) {
        await updateDoc(doc.ref, { isActive: false });
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
      return snapshot.docs.map(doc => {
        const data = doc.data();
        const meals = data.meals || [];
        return { id: doc.id, ...data, meals } as RationPlan;
      });
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
        const meals = data.meals || [];
        const mealsCount = meals.length || data.mealsCount || 0;
        return { 
          id: doc.id, 
          ...data,
          meals: meals,
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

        const meals = data.meals || [];
        
        return { 
          id: planSnap.id, 
          ...data,
          meals: meals
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
      
      const meals = planData.meals || [];
      const mealsCount = meals.length;
      const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);

      const newPlan = {
        userId,
        title: planData.title || 'Новый шаблон',
        description: planData.description || '',
        type: 'daily',
        meals: meals,
        isTemplate: true,
        usedDates: [],
        status: 'template',
        category: planData.category || 'Шаблон',
        totalCalories: totalCalories,
        totalDuration: '1 день',
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
  
  async updateRationPlan(userId: string, planId: string, planData: any): Promise<boolean> {
    try {
      const planRef = doc(db, 'ration_plans', planId);
      const planSnap = await getDoc(planRef);
      if (!planSnap.exists()) throw new Error('План не найден');
      if (planSnap.data().userId !== userId) throw new Error('Нет прав доступа');
      
      const meals = planData.meals || [];
      const mealsCount = meals.length;
      const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
      const totalProteins = meals.reduce((sum: number, m: any) => sum + (m.proteins || 0), 0);
      const totalFats = meals.reduce((sum: number, m: any) => sum + (m.fats || 0), 0);
      const totalCarbs = meals.reduce((sum: number, m: any) => sum + (m.carbohydrates || 0), 0);

      const updateData: any = {
        meals: meals,
        mealsCount: mealsCount,
        totalCalories: totalCalories,
        updatedAt: new Date().toISOString(),
      };
      
      if (planData.title) updateData.title = planData.title;
      if (planData.description) updateData.description = planData.description;
      if (planData.status) updateData.status = planData.status;
      
      // 1. Обновляем ОРИГИНАЛ в коллекции ration_plans
      await updateDoc(planRef, updateData);
      console.log('✅ Оригинальный шаблон обновлен в ration_plans:', planId);
      
      const today = new Date().toISOString().split('T')[0];
      const finalTitle = planData.title || planSnap.data().title || "План питания";
      
      const statsObj = {
        totalCalories,
        totalProteins,
        totalFats,
        totalCarbs,
        totalCookingTime: meals.reduce((sum: number, m: any) => sum + (m.cookingTime || 0), 0)
      };

      // 2. 🌟 ПРЯМАЯ ЗАПИСЬ ВО ВСЕ ВОЗМОЖНЫЕ ДОКУМЕНТЫ ДНЯ (Без фильтра по planId)
      // Проверяем первый возможный ID (чистый день, который ставит главная при генерации)
      const cleanDayId = `${userId}_${today}`;
      // Проверяем второй возможный ID (день с суффиксом плана, который ставится при активации шаблона)
      const suffixedDayId = `${userId}_${today}_${planId}`;

      const dayIdsToUpdate = [cleanDayId, suffixedDayId];

      for (const dayId of dayIdsToUpdate) {
        const dayDocRef = doc(db, 'ration_plan_days', dayId);
        const dayDocSnap = await getDoc(dayDocRef);

        // Если документ дня существует в базе — мы ПРИНУДИТЕЛЬНО перезаписываем в него новые meals
        if (dayDocSnap.exists()) {
          await updateDoc(dayDocRef, {
            meals: meals,
            stats: statsObj,
            planName: finalTitle,
            planId: planId, // Выставляем нормальный ID, связывая их обратно!
            updatedAt: new Date().toISOString()
          });
          console.log(`🎯 [УСПЕХ] Изменения перенесены в ration_plan_days -> документ: ${dayId}`);
        }
      }

      // 3. Дублируем в подколлекцию пользователя для совместимости с Home
      const dailyPlanRef = doc(db, 'users', userId, 'daily_plans', today);
      const dailyPlanSnap = await getDoc(dailyPlanRef);
      
      if (dailyPlanSnap.exists()) {
        await updateDoc(dailyPlanRef, {
          meals: meals,
          stats: statsObj,
          planTitle: finalTitle,
          planId: planId,
          updatedAt: new Date().toISOString()
        });
        console.log("🎯 [УСПЕХ] Изменения перенесены в подколлекцию users/.../daily_plans");
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Ошибка синхронизации между коллекциями:', error);
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