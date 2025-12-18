// app/services/rationService.ts
import { 
  doc, 
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/app/firebase/config';
import { recipeService } from './recipeService';

// Типы
interface UserData {
  dailyCalories: number;
  targetCalories?: number;
  targetProteinGrams: number;
  targetFatGrams: number;
  targetCarbGrams: number;
  dietType: string;
  allergies: string;
  excludedIngredients: string;
  cookingTimeLimit: number;
  cookingSkill: string;
  favoriteRecipes?: string[];
}

interface Recipe {
  id: string;
  title?: string;
  name?: string;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  carbs?: number;
  weight?: string;
  cookingTime: number;
  difficultyLevel: string;
  rating?: number;
  imageUrl?: string;
  mealType?: string;
  category?: string;
  dietType?: string;
}

interface Meal {
  id: string;
  recipeId: string | null;
  category: string;
  name: string;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  weight: string;
  cookingTime: number;
  difficultyLevel: string;
  rating: number;
  imageUrl: string | null;
  marked: boolean;
  bookmarked: boolean;
}

interface Plan {
  id: string;
  userId: string;
  date: string;
  dayOfWeek: string;
  userTargets: {
    dailyCalories: number;
    dietType: string;
  };
  meals: Meal[];
  stats: {
    totalCalories: number;
    totalProteins: number;
    totalFats: number;
    totalCarbs: number;
    totalCookingTime: number;
    completedMeals: number;
    totalMeals: number;
  };
  timestamps: {
    createdAt: string;
    updatedAt: string;
  };
}

// Форматирование даты
const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Получение дня недели
const getDayOfWeek = (date: Date): string => {
  const days = [
    'воскресенье', 'понедельник', 'вторник', 'среда', 
    'четверг', 'пятница', 'суббота'
  ];
  return days[date.getDay()];
};

class DailyRationService {
  private cachedPlans: Map<string, Plan>;
  
  constructor() {
    this.cachedPlans = new Map();
  }
  
  /**
   * ОСНОВНОЙ МЕТОД: Получить или сгенерировать рацион
   */
  async getOrGenerateDailyPlan(userId: string): Promise<Plan> {
    try {
      if (!userId) throw new Error('User ID is required');
      
      const date = new Date();
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      
      // Проверяем кэш
      if (this.cachedPlans.has(planId)) {
        return this.cachedPlans.get(planId)!;
      }
      
      // 1. Проверяем существующий план
      let plan = await this.getPlanById(planId);
      
      // 2. Если плана нет - генерируем новый
      if (!plan) {
        console.log('🔄 Generating new plan for today');
        plan = await this.generateNewPlan(userId, date);
        plan.id = planId; // Устанавливаем id для плана
        await this.savePlan(plan);
      }
      
      // 3. Кэшируем
      this.cachedPlans.set(planId, plan);
      
      return plan;
      
    } catch (error) {
      console.error('❌ Error in getOrGenerateDailyPlan:', error);
      throw error;
    }
  }
  
  /**
   * СОЗДАТЬ НОВЫЙ ПЛАН С УЧЕТОМ ТЕКУЩИХ НАСТРОЕК
   */
  async createNewPlanWithUserSettings(userId: string): Promise<Plan> {
    try {
      const date = new Date();
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      
      console.log('🔄 Creating new plan with current user settings');
      
      // Генерируем новый план
      const plan = await this.generateNewPlan(userId, date);
      plan.id = planId; // Устанавливаем id
      
      // Сохраняем и перезаписываем старый
      await this.savePlan(plan);
      
      // Обновляем кэш
      this.cachedPlans.set(planId, plan);
      
      return plan;
      
    } catch (error) {
      console.error('❌ Error creating new plan with settings:', error);
      throw error;
    }
  }
  
  /**
   * Получить план по ID
   */
  async getPlanById(planId: string): Promise<Plan | null> {
    try {
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        const data = planSnap.data();
        return {
          id: planSnap.id,
          userId: data.userId || '',
          date: data.date || '',
          dayOfWeek: data.dayOfWeek || '',
          userTargets: data.userTargets || { dailyCalories: 2000, dietType: 'Обычное' },
          meals: data.meals || [],
          stats: data.stats || {
            totalCalories: 0,
            totalProteins: 0,
            totalFats: 0,
            totalCarbs: 0,
            totalCookingTime: 0,
            completedMeals: 0,
            totalMeals: 0
          },
          timestamps: data.timestamps || {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting plan:', error);
      return null;
    }
  }
  
  /**
   * ГЕНЕРАЦИЯ НОВОГО ПЛАНА
   */
  async generateNewPlan(userId: string, date: Date): Promise<Plan> {
    try {
      // 1. Получаем данные пользователя
      const userData = await this.getUserData(userId);
      
      // 2. Получаем рецепты с учетом настроек
      const availableRecipes = await this.getRecipesWithFilters(userData);
      
      // 3. Группируем по категориям
      const recipesByCategory = this.groupRecipesByCategory(availableRecipes);
      
      // 4. Выбираем по 1 рецепту для каждой категории
      const categories = ['Завтрак', 'Обед', 'Ужин', 'Перекусы'];
      const meals: Meal[] = [];
      
      for (const category of categories) {
        const categoryRecipes = recipesByCategory[category] || [];
        
        if (categoryRecipes.length > 0) {
          // Берем случайный рецепт из категории
          const randomIndex = Math.floor(Math.random() * categoryRecipes.length);
          const recipe = categoryRecipes[randomIndex];
          meals.push(this.createMealFromRecipe(recipe, category));
        } else {
          // Если нет рецептов для категории
          meals.push(this.createFallbackMeal(category));
        }
      }
      
      // 5. Рассчитываем статистику
      const stats = this.calculatePlanStats(meals);
      
      // 6. Формируем план (без id, он будет установлен позже)
      const plan: Omit<Plan, 'id'> & { id?: string } = {
        userId,
        date: formatDate(date),
        dayOfWeek: getDayOfWeek(date),
        
        // Цели пользователя
        userTargets: {
          dailyCalories: userData.dailyCalories,
          dietType: userData.dietType
        },
        
        // Приемы пищи
        meals,
        
        // Статистика
        stats: {
          ...stats,
          completedMeals: 0,
          totalMeals: meals.length
        },
        
        // Таймстемпы
        timestamps: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      
      return plan as Plan; // Приводим к типу Plan
      
    } catch (error) {
      console.error('❌ Error generating new plan:', error);
      // Возвращаем план с пустыми данными в случае ошибки
      return this.createEmptyPlan(userId, date);
    }
  }
  
  /**
   * Получить данные пользователя
   */
  async getUserData(userId: string): Promise<UserData> {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const data = userSnap.data();
        
        // Возвращаем только базовые данные
        return {
          dailyCalories: data.dailyCalories || data.targetCalories || 2000,
          targetCalories: data.targetCalories,
          targetProteinGrams: data.targetProteinGrams || 0,
          targetFatGrams: data.targetFatGrams || 0,
          targetCarbGrams: data.targetCarbGrams || 0,
          dietType: data.dietType || 'Обычное',
          allergies: data.allergies || '',
          excludedIngredients: data.excludedIngredients || '',
          cookingTimeLimit: data.cookingTimeLimit ? parseInt(data.cookingTimeLimit) : 45,
          cookingSkill: data.cookingSkill || 'Средний',
          favoriteRecipes: data.favoriteRecipes || []
        };
      }
      
      // Данные по умолчанию
      return {
        dailyCalories: 2000,
        targetProteinGrams: 0,
        targetFatGrams: 0,
        targetCarbGrams: 0,
        dietType: 'Обычное',
        allergies: '',
        excludedIngredients: '',
        cookingTimeLimit: 45,
        cookingSkill: 'Средний'
      };
      
    } catch (error) {
      console.error('❌ Error getting user data:', error);
      return {
        dailyCalories: 2000,
        targetProteinGrams: 0,
        targetFatGrams: 0,
        targetCarbGrams: 0,
        dietType: 'Обычное',
        allergies: '',
        excludedIngredients: '',
        cookingTimeLimit: 45,
        cookingSkill: 'Средний'
      };
    }
  }
  
  /**
   * Получить рецепты с учетом фильтров
   */
  async getRecipesWithFilters(userData: UserData): Promise<Recipe[]> {
    try {
      // Получаем ВСЕ рецепты
      const allRecipes = await recipeService.getRecipesForPlanner();
      
      if (!allRecipes || allRecipes.length === 0) {
        return [];
      }
      
      // Фильтруем по типу питания
      const dietFiltered = allRecipes.filter(recipe => {
        if (!userData.dietType || userData.dietType === 'Обычное') {
          return true;
        }
        
        // Простая проверка совместимости
        if (userData.dietType === 'Веганское') {
          return recipe.dietType === 'Веганское';
        }
        
        if (userData.dietType === 'Вегетарианское') {
          return recipe.dietType === 'Вегетарианское' || recipe.dietType === 'Веганское';
        }
        
        return true;
      });
      
      // Фильтруем по времени готовки
      const timeLimit = userData.cookingTimeLimit || 45;
      const timeFiltered = dietFiltered.filter(recipe => {
        const cookingTime = parseInt(recipe.cookingTime?.toString()) || 30;
        return cookingTime <= timeLimit;
      });
      
      // Если после фильтрации мало рецептов, возвращаем хотя бы часть
      return timeFiltered.length > 0 ? timeFiltered : dietFiltered.slice(0, 20);
      
    } catch (error) {
      console.error('❌ Error filtering recipes:', error);
      return [];
    }
  }
  
  /**
   * Группировать рецепты по категориям
   */
  groupRecipesByCategory(recipes: Recipe[]): { [key: string]: Recipe[] } {
    const grouped: { [key: string]: Recipe[] } = {
      'Завтрак': [],
      'Обед': [],
      'Ужин': [],
      'Перекусы': []
    };
    
    recipes.forEach(recipe => {
      const category = recipe.mealType || recipe.category || 'Обед';
      if (grouped[category]) {
        grouped[category].push(recipe);
      }
    });
    
    return grouped;
  }
  
  /**
   * Создать прием пищи из рецепта
   */
  createMealFromRecipe(recipe: Recipe, category: string): Meal {
    return {
      id: recipe.id,
      recipeId: recipe.id,
      category,
      name: recipe.title || recipe.name || 'Рецепт',
      calories: Math.round(recipe.calories || 0),
      proteins: Math.round(recipe.proteins || 0),
      fats: Math.round(recipe.fats || 0),
      carbohydrates: Math.round(recipe.carbohydrates || recipe.carbs || 0),
      weight: recipe.weight || '300 гр',
      cookingTime: recipe.cookingTime || 20,
      difficultyLevel: recipe.difficultyLevel || 'Легко',
      rating: recipe.rating || 0,
      imageUrl: recipe.imageUrl || null,
      marked: false,
      bookmarked: false
    };
  }
  
  /**
   * Создать заглушку
   */
  createFallbackMeal(category: string): Meal {
    return {
      id: `fallback-${category}-${Date.now()}`,
      recipeId: null,
      category,
      name: 'Рецепты не найдены',
      calories: 0,
      proteins: 0,
      fats: 0,
      carbohydrates: 0,
      weight: '0 гр',
      cookingTime: 0,
      difficultyLevel: 'Легко',
      rating: 0,
      imageUrl: null,
      marked: false,
      bookmarked: false
    };
  }
  
  /**
   * Создать пустой план (при ошибке)
   */
  createEmptyPlan(userId: string, date: Date): Plan {
    const dateStr = formatDate(date);
    const planId = `${userId}_${dateStr}`;
    
    return {
      id: planId,
      userId,
      date: dateStr,
      dayOfWeek: getDayOfWeek(date),
      userTargets: {
        dailyCalories: 2000,
        dietType: 'Обычное'
      },
      meals: [
        this.createFallbackMeal('Завтрак'),
        this.createFallbackMeal('Обед'),
        this.createFallbackMeal('Ужин'),
        this.createFallbackMeal('Перекусы')
      ],
      stats: {
        totalCalories: 0,
        totalProteins: 0,
        totalFats: 0,
        totalCarbs: 0,
        totalCookingTime: 0,
        completedMeals: 0,
        totalMeals: 4
      },
      timestamps: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
  }
  
  /**
   * Рассчитать статистику
   */
  calculatePlanStats(meals: Meal[]) {
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
   * Сохранить план
   */
  async savePlan(plan: Plan) {
    try {
      const planRef = doc(db, 'ration_plan_days', plan.id);
      await setDoc(planRef, plan);
      console.log('✅ Plan saved:', plan.id);
      
    } catch (error) {
      console.error('❌ Error saving plan:', error);
      throw error;
    }
  }
  
  /**
   * Обновить состояние приема пищи
   */
  async updateMealStatus(userId: string, date: Date, mealId: string, updates: Partial<Meal>) {
    try {
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      
      if (!planSnap.exists()) {
        return;
      }
      
      const plan = planSnap.data() as Plan;
      const mealIndex = plan.meals.findIndex((meal: Meal) => meal.id === mealId);
      
      if (mealIndex === -1) {
        return;
      }
      
      const updatedMeals = [...plan.meals];
      updatedMeals[mealIndex] = { ...updatedMeals[mealIndex], ...updates };
      
      await updateDoc(planRef, {
        meals: updatedMeals,
        'timestamps.updatedAt': new Date().toISOString()
      });
      
      // Обновляем кэш
      if (this.cachedPlans.has(planId)) {
        const cachedPlan = { ...this.cachedPlans.get(planId)! };
        cachedPlan.meals = updatedMeals;
        this.cachedPlans.set(planId, cachedPlan);
      }
      
    } catch (error) {
      console.error('❌ Error updating meal status:', error);
    }
  }
  
  /**
   * Обновить избранное
   */
  async toggleBookmark(userId: string, recipeId: string, isBookmarked: boolean) {
    try {
      // Просто обновляем в пользовательских данных
      const userRef = doc(db, 'users', userId);
      
      // Получаем текущие избранные
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const favorites = userData.favoriteRecipes || [];
        
        let updatedFavorites: string[];
        if (isBookmarked) {
          updatedFavorites = [...new Set([...favorites, recipeId])];
        } else {
          updatedFavorites = favorites.filter((id: string) => id !== recipeId);
        }
        
        await updateDoc(userRef, {
          favoriteRecipes: updatedFavorites
        });
      }
      
    } catch (error) {
      console.error('❌ Error toggling bookmark:', error);
    }
  }
  
  /**
   * Получить недавние планы
   */
  async getRecentPlans(userId: string, days: number = 7): Promise<Plan[]> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const plansQuery = query(
        collection(db, 'ration_plan_days'),
        where('userId', '==', userId),
        where('date', '>=', formatDate(startDate)),
        where('date', '<=', formatDate(endDate))
      );
      
      const snapshot = await getDocs(plansQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Plan));
      
    } catch (error) {
      console.error('❌ Error getting recent plans:', error);
      return [];
    }
  }
  
  /**
   * Извлечь использованные ID рецептов
   */
  extractUsedRecipeIds(plans: Plan[]): string[] {
    const usedIds = new Set<string>();
    
    plans.forEach(plan => {
      if (plan.meals) {
        plan.meals.forEach(meal => {
          if (meal.recipeId) {
            usedIds.add(meal.recipeId);
          }
        });
      }
    });
    
    return Array.from(usedIds);
  }
  
  /**
   * Очистить кэш
   */
  clearCache() {
    this.cachedPlans.clear();
  }
}

// Экспорт синглтона
export const dailyRationService = new DailyRationService();