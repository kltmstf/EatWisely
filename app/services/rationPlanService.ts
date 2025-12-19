// app/services/rationPlanService.ts
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
  Timestamp,
  addDoc,
  orderBy
} from 'firebase/firestore';
import { db } from '@/app/firebase/config';
import { recipeService } from './recipeService';

// Типы
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
}

export interface DayPlan {
  day: number; // 1-7 для недельных планов
  date?: string; // Конкретная дата, если назначено
  meals: Meal[];
  stats: {
    totalCalories: number;
    totalProteins: number;
    totalFats: number;
    totalCarbs: number;
    totalCookingTime: number;
  };
}

export interface RationPlan {
  id?: string;
  userId: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  days: DayPlan[];
  isTemplate: boolean;
  usedDates: string[]; // Даты, когда план был использован
  status: 'active' | 'completed' | 'archived';
  category: string;
  totalCalories: number;
  totalDuration: string; // Например: "7 дней", "1 день"
  mealsCount: number;
  createdAt: string;
  updatedAt: string;
  startDate?: string; // Дата начала использования
  endDate?: string; // Дата окончания использования
}

// Тип для фильтрации планов
export interface PlanFilters {
  category?: string;
  status?: string;
  isTemplate?: boolean;
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
}

// Вспомогательные функции
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const getDayOfWeek = (date: Date): string => {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  return days[date.getDay()];
};

class RationPlanService {
  
  /**
   * СОЗДАТЬ НОВЫЙ ПЛАН РАЦИОНА
   */
  async createRationPlan(userId: string, planData: Partial<RationPlan>): Promise<string> {
    try {
      const now = new Date().toISOString();
      
      const newPlan: RationPlan = {
        userId,
        title: planData.title || 'Новый рацион',
        description: planData.description || '',
        type: planData.type || 'daily',
        days: planData.days || [],
        isTemplate: planData.isTemplate !== undefined ? planData.isTemplate : true,
        usedDates: [],
        status: 'active',
        category: planData.category || 'Общее',
        totalCalories: planData.totalCalories || this.calculateTotalCalories(planData.days || []),
        totalDuration: planData.totalDuration || (planData.type === 'weekly' ? '7 дней' : '1 день'),
        mealsCount: planData.mealsCount || this.calculateMealsCount(planData.days || []),
        createdAt: now,
        updatedAt: now,
        ...planData
      };

      // Удаляем id, если он есть, так как Firestore сам его создаст
      const { id, ...planWithoutId } = newPlan;
      
      const docRef = await addDoc(collection(db, 'ration_plans'), planWithoutId);
      console.log('✅ Ration plan created:', docRef.id);
      
      return docRef.id;
      
    } catch (error) {
      console.error('❌ Error creating ration plan:', error);
      throw error;
    }
  }
  
  /**
   * ПОЛУЧИТЬ ПЛАНЫ ПОЛЬЗОВАТЕЛЯ С ФИЛЬТРАЦИЕЙ
   */
  async getUserRationPlans(userId: string, filters?: PlanFilters): Promise<RationPlan[]> {
    try {
      let q = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId)
      );

      // Добавляем фильтры
      if (filters?.isTemplate !== undefined) {
        q = query(q, where('isTemplate', '==', filters.isTemplate));
      }
      
      if (filters?.status) {
        q = query(q, where('status', '==', filters.status));
      }
      
      if (filters?.category && filters.category !== 'Все') {
        q = query(q, where('category', '==', filters.category));
      }

      q = query(q, orderBy('createdAt', 'desc'));
      
      const snapshot = await getDocs(q);
      
      let plans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RationPlan));

      // Фильтрация по датам (локально, так как Firestore не поддерживает сложные запросы с диапазонами)
      if (filters?.startDate) {
        plans = plans.filter(plan => {
          if (!plan.startDate) return true;
          return plan.startDate >= filters.startDate!;
        });
      }
      
      if (filters?.endDate) {
        plans = plans.filter(plan => {
          if (!plan.endDate) return true;
          return plan.endDate <= filters.endDate!;
        });
      }

      // Поиск по тексту (локально)
      if (filters?.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase();
        plans = plans.filter(plan => 
          plan.title.toLowerCase().includes(searchTerm) ||
          plan.description.toLowerCase().includes(searchTerm)
        );
      }
      
      return plans;
      
    } catch (error) {
      console.error('❌ Error getting user ration plans:', error);
      return [];
    }
  }
  
  /**
   * ПОЛУЧИТЬ ПЛАН ПО ID
   */
  async getRationPlanById(planId: string): Promise<RationPlan | null> {
    try {
      const planRef = doc(db, 'ration_plans', planId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        return {
          id: planSnap.id,
          ...planSnap.data()
        } as RationPlan;
      }
      return null;
      
    } catch (error) {
      console.error('❌ Error getting ration plan:', error);
      return null;
    }
  }
  
  /**
   * ОБНОВИТЬ ПЛАН
   */
  async updateRationPlan(planId: string, updates: Partial<RationPlan>): Promise<void> {
    try {
      const planRef = doc(db, 'ration_plans', planId);
      const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      await updateDoc(planRef, updatedData);
      console.log('✅ Ration plan updated:', planId);
      
    } catch (error) {
      console.error('❌ Error updating ration plan:', error);
      throw error;
    }
  }
  
  /**
   * УДАЛИТЬ ПЛАН
   */
  async deleteRationPlan(planId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'ration_plans', planId));
      console.log('✅ Ration plan deleted:', planId);
      
    } catch (error) {
      console.error('❌ Error deleting ration plan:', error);
      throw error;
    }
  }
  
  /**
   * ИСПОЛЬЗОВАТЬ ПЛАН В УКАЗАННЫЕ ДАТЫ
   */
  async useRationPlan(
    planId: string, 
    startDate: Date, 
    endDate: Date,
    markAsUsed: boolean = true
  ): Promise<void> {
    try {
      const plan = await this.getRationPlanById(planId);
      if (!plan) throw new Error('Plan not found');
      
      const planRef = doc(db, 'ration_plans', planId);
      
      const updates: Partial<RationPlan> = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isTemplate: false,
        status: 'active'
      };
      
      if (markAsUsed) {
        // Генерируем все даты между startDate и endDate
        const dates: string[] = [];
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
          dates.push(formatDate(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        updates.usedDates = [...(plan.usedDates || []), ...dates];
      }
      
      await this.updateRationPlan(planId, updates);
      
      // Создаем дневные планы для каждого дня
      await this.createDailyPlansFromRation(plan, startDate, endDate);
      
    } catch (error) {
      console.error('❌ Error using ration plan:', error);
      throw error;
    }
  }
  
  /**
   * СОЗДАТЬ ДНЕВНЫЕ ПЛАНЫ ИЗ РАЦИОНА
   */
  private async createDailyPlansFromRation(
    plan: RationPlan, 
    startDate: Date, 
    endDate: Date
  ): Promise<void> {
    try {
      const currentDate = new Date(startDate);
      let dayIndex = 0;
      
      while (currentDate <= endDate) {
        const dayPlan = plan.type === 'weekly' 
          ? plan.days[dayIndex % 7] 
          : plan.days[0];
        
        if (dayPlan) {
          const dailyPlan = {
            userId: plan.userId,
            date: formatDate(currentDate),
            dayOfWeek: getDayOfWeek(currentDate),
            meals: dayPlan.meals,
            stats: dayPlan.stats,
            sourcePlanId: plan.id,
            timestamps: {
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          };
          
          const planId = `${plan.userId}_${formatDate(currentDate)}`;
          await setDoc(doc(db, 'ration_plan_days', planId), dailyPlan);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
        dayIndex++;
      }
      
    } catch (error) {
      console.error('❌ Error creating daily plans:', error);
    }
  }
  
  /**
   * ДОБАВИТЬ БЛЮДО К ПЛАНУ
   */
  async addMealToPlan(planId: string, meal: Meal, dayIndex: number = 0): Promise<void> {
    try {
      const plan = await this.getRationPlanById(planId);
      if (!plan) throw new Error('Plan not found');
      
      const updatedDays = [...plan.days];
      if (!updatedDays[dayIndex]) {
        updatedDays[dayIndex] = {
          day: dayIndex + 1,
          meals: [],
          stats: { totalCalories: 0, totalProteins: 0, totalFats: 0, totalCarbs: 0, totalCookingTime: 0 }
        };
      }
      
      updatedDays[dayIndex].meals.push(meal);
      updatedDays[dayIndex].stats = this.calculateDayStats(updatedDays[dayIndex].meals);
      
      await this.updateRationPlan(planId, {
        days: updatedDays,
        totalCalories: this.calculateTotalCalories(updatedDays),
        mealsCount: this.calculateMealsCount(updatedDays)
      });
      
    } catch (error) {
      console.error('❌ Error adding meal to plan:', error);
      throw error;
    }
  }
  
  /**
   * УДАЛИТЬ БЛЮДО ИЗ ПЛАНА
   */
  async removeMealFromPlan(planId: string, mealId: string, dayIndex: number): Promise<void> {
    try {
      const plan = await this.getRationPlanById(planId);
      if (!plan || !plan.days[dayIndex]) throw new Error('Plan or day not found');
      
      const updatedDays = [...plan.days];
      updatedDays[dayIndex].meals = updatedDays[dayIndex].meals.filter(meal => meal.id !== mealId);
      updatedDays[dayIndex].stats = this.calculateDayStats(updatedDays[dayIndex].meals);
      
      await this.updateRationPlan(planId, {
        days: updatedDays,
        totalCalories: this.calculateTotalCalories(updatedDays),
        mealsCount: this.calculateMealsCount(updatedDays)
      });
      
    } catch (error) {
      console.error('❌ Error removing meal from plan:', error);
      throw error;
    }
  }
  
  /**
   * ОБНОВИТЬ КАТЕГОРИЮ БЛЮДА В ПЛАНЕ
   */
  async updateMealCategory(
    planId: string, 
    dayIndex: number, 
    mealIndex: number, 
    newCategory: string
  ): Promise<void> {
    try {
      const plan = await this.getRationPlanById(planId);
      if (!plan || !plan.days[dayIndex] || !plan.days[dayIndex].meals[mealIndex]) {
        throw new Error('Plan, day or meal not found');
      }
      
      const updatedDays = [...plan.days];
      updatedDays[dayIndex].meals[mealIndex].category = newCategory;
      
      await this.updateRationPlan(planId, {
        days: updatedDays
      });
      
    } catch (error) {
      console.error('❌ Error updating meal category:', error);
      throw error;
    }
  }
  
  /**
   * ПЕРЕМЕСТИТЬ БЛЮДО МЕЖДУ ДНЯМИ
   */
  async moveMealBetweenDays(
    planId: string,
    sourceDayIndex: number,
    targetDayIndex: number,
    mealId: string
  ): Promise<void> {
    try {
      const plan = await this.getRationPlanById(planId);
      if (!plan) throw new Error('Plan not found');
      
      const updatedDays = [...plan.days];
      
      // Находим блюдо
      const mealIndex = updatedDays[sourceDayIndex].meals.findIndex(meal => meal.id === mealId);
      if (mealIndex === -1) throw new Error('Meal not found');
      
      // Удаляем из исходного дня
      const [mealToMove] = updatedDays[sourceDayIndex].meals.splice(mealIndex, 1);
      
      // Добавляем в целевой день
      if (!updatedDays[targetDayIndex]) {
        updatedDays[targetDayIndex] = {
          day: targetDayIndex + 1,
          meals: [],
          stats: { totalCalories: 0, totalProteins: 0, totalFats: 0, totalCarbs: 0, totalCookingTime: 0 }
        };
      }
      updatedDays[targetDayIndex].meals.push(mealToMove);
      
      // Пересчитываем статистику для обоих дней
      updatedDays[sourceDayIndex].stats = this.calculateDayStats(updatedDays[sourceDayIndex].meals);
      updatedDays[targetDayIndex].stats = this.calculateDayStats(updatedDays[targetDayIndex].meals);
      
      await this.updateRationPlan(planId, {
        days: updatedDays,
        totalCalories: this.calculateTotalCalories(updatedDays),
        mealsCount: this.calculateMealsCount(updatedDays)
      });
      
    } catch (error) {
      console.error('❌ Error moving meal between days:', error);
      throw error;
    }
  }
  
  /**
   * СОЗДАТЬ ПЛАН ИЗ ШАБЛОНА
   */
  async createPlanFromTemplate(templateId: string, userId: string): Promise<string> {
    try {
      const template = await this.getRationPlanById(templateId);
      if (!template) throw new Error('Template not found');
      
      const newPlan: Partial<RationPlan> = {
        title: `Копия: ${template.title}`,
        description: template.description,
        type: template.type,
        days: template.days,
        isTemplate: true,
        category: template.category,
        totalCalories: template.totalCalories,
        totalDuration: template.totalDuration,
        mealsCount: template.mealsCount
      };
      
      return await this.createRationPlan(userId, newPlan);
      
    } catch (error) {
      console.error('❌ Error creating plan from template:', error);
      throw error;
    }
  }
  
  /**
   * КОПИРОВАТЬ ПЛАН (СОЗДАНИЕ ДУБЛИКАТА)
   */
  async duplicatePlan(planId: string, userId: string, newTitle?: string): Promise<string> {
    try {
      const originalPlan = await this.getRationPlanById(planId);
      if (!originalPlan) throw new Error('Plan not found');
      
      const newPlanData: Partial<RationPlan> = {
        title: newTitle || `Копия: ${originalPlan.title}`,
        description: originalPlan.description,
        type: originalPlan.type,
        days: originalPlan.days,
        isTemplate: originalPlan.isTemplate,
        category: originalPlan.category,
        totalCalories: originalPlan.totalCalories,
        totalDuration: originalPlan.totalDuration,
        mealsCount: originalPlan.mealsCount
      };
      
      return await this.createRationPlan(userId, newPlanData);
      
    } catch (error) {
      console.error('❌ Error duplicating plan:', error);
      throw error;
    }
  }
  
  /**
   * ПОЛУЧИТЬ АКТИВНЫЕ ПЛАНЫ (ТЕ, КОТОРЫЕ ИСПОЛЬЗУЮТСЯ СЕЙЧАС)
   */
  async getActivePlans(userId: string): Promise<RationPlan[]> {
    try {
      const today = formatDate(new Date());
      
      const plansQuery = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        where('status', '==', 'active'),
        where('isTemplate', '==', false),
        where('startDate', '<=', today),
        where('endDate', '>=', today)
      );
      
      const snapshot = await getDocs(plansQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RationPlan));
      
    } catch (error) {
      console.error('❌ Error getting active plans:', error);
      return [];
    }
  }
  
  /**
   * ПОЛУЧИТЬ ШАБЛОНЫ ПОЛЬЗОВАТЕЛЯ
   */
  async getUserTemplates(userId: string): Promise<RationPlan[]> {
    try {
      const templatesQuery = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        where('isTemplate', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(templatesQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RationPlan));
      
    } catch (error) {
      console.error('❌ Error getting user templates:', error);
      return [];
    }
  }
  
  /**
   * ПОЛУЧИТЬ ЗАВЕРШЕННЫЕ ПЛАНЫ
   */
  async getCompletedPlans(userId: string): Promise<RationPlan[]> {
    try {
      const completedQuery = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        where('status', '==', 'completed'),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(completedQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RationPlan));
      
    } catch (error) {
      console.error('❌ Error getting completed plans:', error);
      return [];
    }
  }
  
  /**
   * ПОЛУЧИТЬ ПЛАНЫ ПО КАТЕГОРИИ
   */
  async getPlansByCategory(userId: string, category: string): Promise<RationPlan[]> {
    try {
      const categoryQuery = query(
        collection(db, 'ration_plans'),
        where('userId', '==', userId),
        where('category', '==', category),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(categoryQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RationPlan));
      
    } catch (error) {
      console.error(`❌ Error getting plans by category ${category}:`, error);
      return [];
    }
  }
  
  /**
   * ПОИСК ПЛАНОВ ПО НАЗВАНИЮ ИЛИ ОПИСАНИИ
   */
  async searchPlans(userId: string, searchTerm: string): Promise<RationPlan[]> {
    try {
      // Firestore не поддерживает полнотекстовый поиск, поэтому фильтруем локально
      const allPlans = await this.getUserRationPlans(userId);
      
      const lowerSearchTerm = searchTerm.toLowerCase();
      
      return allPlans.filter(plan => 
        plan.title.toLowerCase().includes(lowerSearchTerm) ||
        plan.description.toLowerCase().includes(lowerSearchTerm)
      );
      
    } catch (error) {
      console.error('❌ Error searching plans:', error);
      return [];
    }
  }
  
  /**
   * ПОМЕТИТЬ ПЛАН КАК ЗАВЕРШЕННЫЙ
   */
  async markPlanAsCompleted(planId: string): Promise<void> {
    await this.updateRationPlan(planId, { status: 'completed' });
  }
  
  /**
   * ПОМЕТИТЬ ПЛАН КАК АРХИВНЫЙ
   */
  async markPlanAsArchived(planId: string): Promise<void> {
    await this.updateRationPlan(planId, { status: 'archived' });
  }
  
  /**
   * ПОЛУЧИТЬ ДНЕВНОЙ ПЛАН ПО ДАТЕ
   */
  async getDailyPlanByDate(userId: string, date: string): Promise<any | null> {
    try {
      const planId = `${userId}_${date}`;
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        return {
          id: planSnap.id,
          ...planSnap.data()
        };
      }
      return null;
      
    } catch (error) {
      console.error('❌ Error getting daily plan by date:', error);
      return null;
    }
  }
  
  /**
   * ПОЛУЧИТЬ ДНЕВНЫЕ ПЛАНЫ НА ПЕРИОД
   */
  async getDailyPlansForPeriod(userId: string, startDate: string, endDate: string): Promise<any[]> {
    try {
      // Создаем массив дат для запроса
      const dates: string[] = [];
      const currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      while (currentDate <= endDateObj) {
        dates.push(formatDate(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Получаем планы для каждой даты
      const plansPromises = dates.map(date => this.getDailyPlanByDate(userId, date));
      const plans = await Promise.all(plansPromises);
      
      return plans.filter(plan => plan !== null);
      
    } catch (error) {
      console.error('❌ Error getting daily plans for period:', error);
      return [];
    }
  }
  
  /**
   * АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ПЛАНА НА НЕДЕЛЮ
   */
  async createWeeklyPlanFromTemplates(
    userId: string,
    templates: RationPlan[],
    startDate: Date
  ): Promise<string> {
    try {
      if (templates.length === 0) throw new Error('No templates provided');
      
      const days: DayPlan[] = [];
      
      // Создаем 7 дней, циклически используя шаблоны
      for (let i = 0; i < 7; i++) {
        const templateIndex = i % templates.length;
        const template = templates[templateIndex];
        
        days.push({
          day: i + 1,
          meals: template.days[0]?.meals || [],
          stats: template.days[0]?.stats || { totalCalories: 0, totalProteins: 0, totalFats: 0, totalCarbs: 0, totalCookingTime: 0 }
        });
      }
      
      const totalCalories = this.calculateTotalCalories(days);
      const mealsCount = this.calculateMealsCount(days);
      
      const newPlan: Partial<RationPlan> = {
        title: `Авто-неделя (${formatDate(startDate)})`,
        description: 'Автоматически сгенерированный недельный план',
        type: 'weekly',
        days,
        isTemplate: false,
        category: 'Общее',
        totalCalories,
        totalDuration: '7 дней',
        mealsCount
      };
      
      const planId = await this.createRationPlan(userId, newPlan);
      
      // Используем план на указанную дату
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      await this.useRationPlan(planId, startDate, endDate, false);
      
      return planId;
      
    } catch (error) {
      console.error('❌ Error creating weekly plan from templates:', error);
      throw error;
    }
  }
  
  /**
   * ПОЛУЧИТЬ СТАТИСТИКУ ПОЛЬЗОВАТЕЛЯ
   */
  async getUserStats(userId: string): Promise<{
    totalPlans: number;
    totalTemplates: number;
    activePlans: number;
    completedPlans: number;
    totalMeals: number;
    averageCalories: number;
    mostUsedCategory: string;
  }> {
    try {
      const allPlans = await this.getUserRationPlans(userId);
      
      const totalPlans = allPlans.length;
      const totalTemplates = allPlans.filter(plan => plan.isTemplate).length;
      const activePlans = allPlans.filter(plan => plan.status === 'active').length;
      const completedPlans = allPlans.filter(plan => plan.status === 'completed').length;
      
      const totalMeals = allPlans.reduce((sum, plan) => sum + plan.mealsCount, 0);
      const totalCalories = allPlans.reduce((sum, plan) => sum + plan.totalCalories, 0);
      const averageCalories = totalPlans > 0 ? Math.round(totalCalories / totalPlans) : 0;
      
      // Находим наиболее используемую категорию
      const categoryCounts: Record<string, number> = {};
      allPlans.forEach(plan => {
        categoryCounts[plan.category] = (categoryCounts[plan.category] || 0) + 1;
      });
      
      const mostUsedCategory = Object.keys(categoryCounts).reduce((a, b) => 
        categoryCounts[a] > categoryCounts[b] ? a : b, 'Общее'
      );
      
      return {
        totalPlans,
        totalTemplates,
        activePlans,
        completedPlans,
        totalMeals,
        averageCalories,
        mostUsedCategory
      };
      
    } catch (error) {
      console.error('❌ Error getting user stats:', error);
      return {
        totalPlans: 0,
        totalTemplates: 0,
        activePlans: 0,
        completedPlans: 0,
        totalMeals: 0,
        averageCalories: 0,
        mostUsedCategory: 'Общее'
      };
    }
  }
  
  /**
   * РАССЧИТАТЬ СТАТИСТИКУ ДНЯ
   */
  private calculateDayStats(meals: Meal[]) {
    return meals.reduce((stats, meal) => ({
      totalCalories: stats.totalCalories + (meal.calories || 0),
      totalProteins: stats.totalProteins + (meal.proteins || 0),
      totalFats: stats.totalFats + (meal.fats || 0),
      totalCarbs: stats.totalCarbs + (meal.carbohydrates || 0),
      totalCookingTime: stats.totalCookingTime + (meal.cookingTime || 0)
    }), {
      totalCalories: 0,
      totalProteins: 0,
      totalFats: 0,
      totalCarbs: 0,
      totalCookingTime: 0
    });
  }
  
  /**
   * РАССЧИТАТЬ ОБЩУЮ КАЛОРИЙНОСТЬ
   */
  private calculateTotalCalories(days: DayPlan[]): number {
    return days.reduce((total, day) => total + (day.stats?.totalCalories || 0), 0);
  }
  
  /**
   * РАССЧИТАТЬ ОБЩЕЕ КОЛИЧЕСТВО ПРИЕМОВ ПИЩИ
   */
  private calculateMealsCount(days: DayPlan[]): number {
    return days.reduce((total, day) => total + (day.meals?.length || 0), 0);
  }
}

// Экспорт синглтона
export const rationPlanService = new RationPlanService();