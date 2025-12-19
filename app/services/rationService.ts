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
  arrayUnion,
  arrayRemove
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
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  cookingTime: number;
  difficultyLevel?: string;
  imageUrl?: string;
  mealType?: string;
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
  isCustom?: boolean;
  canBeRemoved?: boolean;
  addedAt?: string;
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
  customMeals?: Meal[];
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

// Генерация уникального ID
const generateUniqueId = (): string => {
  return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
};

// Преобразование cookingTime в число
const parseCookingTime = (time: any): number => {
  if (typeof time === 'number') {
    return time;
  }
  if (typeof time === 'string') {
    const match = time.match(/\d+/);
    return match ? parseInt(match[0], 10) : 20;
  }
  return 20;
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
        const cachedPlan = this.cachedPlans.get(planId)!;
        return cachedPlan;
      }
      
      // 1. Проверяем существующий план
      let plan = await this.getPlanById(planId);
      
      // 2. Если плана нет - генерируем новый
      if (!plan) {
        console.log('🔄 Generating new plan for today');
        plan = await this.generateNewPlan(userId, date);
        plan.id = planId;
        await this.savePlan(plan);
      }
      
      // 3. Объединяем meals и customMeals для отображения
      const allMeals = [
        ...(plan.meals || []),
        ...(plan.customMeals || [])
      ];
      
      const finalPlan: Plan = {
        ...plan,
        meals: allMeals
      };
      
      // 4. Кэшируем (сохраняем с объединенными meals)
      this.cachedPlans.set(planId, finalPlan);
      
      return finalPlan;
      
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
      
      const plan = await this.generateNewPlan(userId, date);
      plan.id = planId;
      
      await this.savePlan(plan);
      
      const finalPlan: Plan = {
        ...plan,
        meals: [
          ...(plan.meals || []),
          ...(plan.customMeals || [])
        ]
      };
      
      this.cachedPlans.set(planId, finalPlan);
      
      return finalPlan;
      
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
        
        const meals = data.meals || [];
        const customMeals = data.customMeals || [];
        const allMeals = [...meals, ...customMeals];
        
        return {
          id: planSnap.id,
          userId: data.userId || '',
          date: data.date || '',
          dayOfWeek: data.dayOfWeek || '',
          userTargets: data.userTargets || { dailyCalories: 2000, dietType: 'Обычное' },
          meals: meals, // Только обычные meals
          customMeals: customMeals, // Отдельно customMeals
          stats: data.stats || {
            totalCalories: allMeals.reduce((sum: number, meal: Meal) => sum + (meal.calories || 0), 0),
            totalProteins: allMeals.reduce((sum: number, meal: Meal) => sum + (meal.proteins || 0), 0),
            totalFats: allMeals.reduce((sum: number, meal: Meal) => sum + (meal.fats || 0), 0),
            totalCarbs: allMeals.reduce((sum: number, meal: Meal) => sum + (meal.carbohydrates || 0), 0),
            totalCookingTime: allMeals.reduce((sum: number, meal: Meal) => sum + (meal.cookingTime || 0), 0),
            completedMeals: allMeals.filter((meal: Meal) => meal.marked).length,
            totalMeals: allMeals.length
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
   * Добавить кастомный рецепт в план
   */
  async addCustomMealToPlan(userId: string, date: Date, mealData: Omit<Meal, 'id'> & { id?: string }): Promise<string> {
    try {
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      
      const mealId = mealData.id || generateUniqueId();
      const meal: Meal = {
        ...mealData,
        id: mealId,
        isCustom: true,
        canBeRemoved: true,
        addedAt: new Date().toISOString()
      };
      
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      
      if (!planSnap.exists()) {
        const newPlan: Omit<Plan, 'id'> & { id?: string } = {
          userId,
          date: dateStr,
          dayOfWeek: getDayOfWeek(date),
          userTargets: {
            dailyCalories: 2000,
            dietType: 'Обычное'
          },
          meals: [],
          customMeals: [meal],
          stats: {
            totalCalories: meal.calories || 0,
            totalProteins: meal.proteins || 0,
            totalFats: meal.fats || 0,
            totalCarbs: meal.carbohydrates || 0,
            totalCookingTime: meal.cookingTime || 0,
            completedMeals: 0,
            totalMeals: 1
          },
          timestamps: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
        
        await setDoc(planRef, newPlan);
      } else {
        const existingPlan = planSnap.data();
        const existingCustomMeals = existingPlan.customMeals || [];
        
        // Проверяем, не добавлен ли уже этот рецепт
        const existingMealIndex = existingCustomMeals.findIndex((m: Meal) => 
          m.id === meal.id || m.recipeId === meal.recipeId
        );
        
        if (existingMealIndex !== -1) {
          const updatedCustomMeals = [...existingCustomMeals];
          updatedCustomMeals[existingMealIndex] = meal;
          
          await updateDoc(planRef, {
            customMeals: updatedCustomMeals,
            'timestamps.updatedAt': new Date().toISOString()
          });
        } else {
          await updateDoc(planRef, {
            customMeals: arrayUnion(meal),
            'timestamps.updatedAt': new Date().toISOString()
          });
        }
        
        const allMeals = [
          ...(existingPlan.meals || []),
          ...(existingPlan.customMeals || []),
          ...(existingMealIndex === -1 ? [meal] : [])
        ];
        
        const stats = this.calculatePlanStats(allMeals);
        
        await updateDoc(planRef, {
          'stats.totalCalories': stats.totalCalories,
          'stats.totalProteins': stats.totalProteins,
          'stats.totalFats': stats.totalFats,
          'stats.totalCarbs': stats.totalCarbs,
          'stats.totalCookingTime': stats.totalCookingTime,
          'stats.totalMeals': allMeals.length,
          'stats.completedMeals': allMeals.filter((m: Meal) => m.marked).length
        });
      }
      
      // Обновляем кэш
      if (this.cachedPlans.has(planId)) {
        const cachedPlan = this.cachedPlans.get(planId)!;
        const existingMealIndex = cachedPlan.meals.findIndex(m => m.id === mealId);
        
        if (existingMealIndex !== -1) {
          const updatedMeals = [...cachedPlan.meals];
          updatedMeals[existingMealIndex] = meal;
          cachedPlan.meals = updatedMeals;
        } else {
          cachedPlan.meals.push(meal);
        }
        
        const stats = this.calculatePlanStats(cachedPlan.meals);
        cachedPlan.stats = {
          ...stats,
          completedMeals: cachedPlan.meals.filter(m => m.marked).length,
          totalMeals: cachedPlan.meals.length
        };
        
        this.cachedPlans.set(planId, cachedPlan);
      }
      
      console.log('✅ Custom meal added to plan:', meal.id);
      return mealId;
      
    } catch (error) {
      console.error('❌ Error adding custom meal to plan:', error);
      throw error;
    }
  }
  
  /**
   * Удалить кастомный рецепт из плана
   */
  async removeCustomMealFromPlan(userId: string, date: Date, mealId: string): Promise<void> {
    try {
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      
      if (!planSnap.exists()) return;
      
      const planData = planSnap.data();
      const customMeals = planData.customMeals || [];
      
      const mealToRemove = customMeals.find((meal: Meal) => meal.id === mealId);
      if (!mealToRemove) return;
      
      const updatedCustomMeals = customMeals.filter((meal: Meal) => meal.id !== mealId);
      
      const allMeals = [
        ...(planData.meals || []),
        ...updatedCustomMeals
      ];
      
      const stats = this.calculatePlanStats(allMeals);
      
      await updateDoc(planRef, {
        customMeals: updatedCustomMeals,
        'stats.totalCalories': stats.totalCalories,
        'stats.totalProteins': stats.totalProteins,
        'stats.totalFats': stats.totalFats,
        'stats.totalCarbs': stats.totalCarbs,
        'stats.totalCookingTime': stats.totalCookingTime,
        'stats.totalMeals': allMeals.length,
        'stats.completedMeals': allMeals.filter((m: Meal) => m.marked).length,
        'timestamps.updatedAt': new Date().toISOString()
      });
      
      // Обновляем кэш
      if (this.cachedPlans.has(planId)) {
        const cachedPlan = this.cachedPlans.get(planId)!;
        const allMealsFiltered = cachedPlan.meals.filter(meal => meal.id !== mealId);
        const statsFiltered = this.calculatePlanStats(allMealsFiltered);
        
        cachedPlan.meals = allMealsFiltered;
        cachedPlan.stats = {
          ...statsFiltered,
          completedMeals: allMealsFiltered.filter(m => m.marked).length,
          totalMeals: allMealsFiltered.length
        };
        
        this.cachedPlans.set(planId, cachedPlan);
      }
      
      console.log('✅ Custom meal removed from plan:', mealId);
      
    } catch (error) {
      console.error('❌ Error removing custom meal from plan:', error);
      throw error;
    }
  }
  
  /**
   * ГЕНЕРАЦИЯ НОВОГО ПЛАНА
   */
  async generateNewPlan(userId: string, date: Date): Promise<Plan> {
    try {
      const userData = await this.getUserData(userId);
      
      const availableRecipes = await this.getRecipesWithFilters(userData);
      
      const recipesByCategory = this.groupRecipesByCategory(availableRecipes);
      
      const categories = ['Завтрак', 'Обед', 'Ужин', 'Перекусы'];
      const meals: Meal[] = [];
      
      for (const category of categories) {
        const categoryRecipes = recipesByCategory[category] || [];
        
        if (categoryRecipes.length > 0) {
          const randomIndex = Math.floor(Math.random() * categoryRecipes.length);
          const recipe = categoryRecipes[randomIndex];
          meals.push(this.createMealFromRecipe(recipe, category));
        } else {
          meals.push(this.createFallbackMeal(category));
        }
      }
      
      const stats = this.calculatePlanStats(meals);
      
      const plan: Omit<Plan, 'id'> = {
        userId,
        date: formatDate(date),
        dayOfWeek: getDayOfWeek(date),
        
        userTargets: {
          dailyCalories: userData.dailyCalories,
          dietType: userData.dietType
        },
        
        meals,
        customMeals: [],
        
        stats: {
          ...stats,
          completedMeals: 0,
          totalMeals: meals.length
        },
        
        timestamps: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };
      
      return plan as Plan;
      
    } catch (error) {
      console.error('❌ Error generating new plan:', error);
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
      const allExternalRecipes = await recipeService.getRecipesForPlanner();
      
      if (!allExternalRecipes || allExternalRecipes.length === 0) {
        return [];
      }
      
      const allRecipes = allExternalRecipes.map(externalRecipe => {
        const cookingTime = parseCookingTime(externalRecipe.cookingTime);

        return {
          id: externalRecipe.id,
          title: externalRecipe.title || 'Без названия',
          calories: externalRecipe.calories || 0,
          proteins: externalRecipe.proteins || 0,
          fats: externalRecipe.fats || 0,
          carbohydrates: externalRecipe.carbohydrates || 0,
          cookingTime: cookingTime,
          difficultyLevel: externalRecipe.difficultyLevel || 'Легко',
          imageUrl: externalRecipe.imageUrl || null,
          mealType: externalRecipe.mealType || 'Обед',
        } as Recipe;
      });
      
      const timeLimit = userData.cookingTimeLimit || 45;
      const timeFiltered = allRecipes.filter(recipe => {
        return recipe.cookingTime <= timeLimit;
      });
      
      return timeFiltered.length > 0 ? timeFiltered : allRecipes.slice(0, 20);
      
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
      const category = recipe.mealType || 'Обед';
      if (grouped[category]) {
        grouped[category].push(recipe);
      } else {
        grouped['Обед'].push(recipe);
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
      category: category,
      name: recipe.title || 'Рецепт',
      calories: Math.round(recipe.calories || 0),
      proteins: Math.round(recipe.proteins || 0),
      fats: Math.round(recipe.fats || 0),
      carbohydrates: Math.round(recipe.carbohydrates || 0),
      weight: '300 гр',
      cookingTime: recipe.cookingTime || 20,
      difficultyLevel: recipe.difficultyLevel || 'Легко',
      rating: 0,
      imageUrl: recipe.imageUrl || null,
      marked: false,
      bookmarked: false,
      isCustom: false,
      canBeRemoved: false
    };
  }
  
  /**
   * Создать заглушку
   */
  createFallbackMeal(category: string): Meal {
    return {
      id: `fallback-${category}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
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
      bookmarked: false,
      isCustom: false,
      canBeRemoved: false
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
      customMeals: [],
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
    return {
      totalCalories: meals.reduce((sum, meal) => sum + (meal.calories || 0), 0),
      totalProteins: meals.reduce((sum, meal) => sum + (meal.proteins || 0), 0),
      totalFats: meals.reduce((sum, meal) => sum + (meal.fats || 0), 0),
      totalCarbs: meals.reduce((sum, meal) => sum + (meal.carbohydrates || 0), 0),
      totalCookingTime: meals.reduce((sum, meal) => sum + (meal.cookingTime || 0), 0)
    };
  }
  
  /**
   * Сохранить план
   */
  async savePlan(plan: Plan) {
    try {
      const planRef = doc(db, 'ration_plan_days', plan.id);
      
      // Разделяем meals на обычные и кастомные
      const regularMeals = plan.meals.filter(meal => !meal.isCustom);
      const customMeals = plan.meals.filter(meal => meal.isCustom);
      
      const planData = {
        userId: plan.userId,
        date: plan.date,
        dayOfWeek: plan.dayOfWeek,
        userTargets: plan.userTargets,
        meals: regularMeals,
        customMeals: customMeals,
        stats: plan.stats,
        timestamps: plan.timestamps
      };
      
      await setDoc(planRef, planData);
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
      
      const planData = planSnap.data();
      const meals = planData.meals || [];
      const customMeals = planData.customMeals || [];
      const allMeals = [...meals, ...customMeals];
      
      const mealIndex = allMeals.findIndex((meal: Meal) => meal.id === mealId);
      
      if (mealIndex === -1) {
        return;
      }
      
      const isCustom = mealIndex >= meals.length;
      const targetArray = isCustom ? 'customMeals' : 'meals';
      const targetIndex = isCustom ? mealIndex - meals.length : mealIndex;
      
      const updatedArray = [...planData[targetArray]];
      updatedArray[targetIndex] = { ...updatedArray[targetIndex], ...updates };
      
      await updateDoc(planRef, {
        [targetArray]: updatedArray,
        'timestamps.updatedAt': new Date().toISOString()
      });
      
      // Обновляем кэш
      if (this.cachedPlans.has(planId)) {
        const cachedPlan = this.cachedPlans.get(planId)!;
        
        const allCachedMeals = cachedPlan.meals;
        const cachedMealIndex = allCachedMeals.findIndex(m => m.id === mealId);
        
        if (cachedMealIndex !== -1) {
          const updatedMeals = [...allCachedMeals];
          updatedMeals[cachedMealIndex] = { 
            ...updatedMeals[cachedMealIndex], 
            ...updates 
          };
          cachedPlan.meals = updatedMeals;
          
          cachedPlan.stats.completedMeals = updatedMeals.filter(m => m.marked).length;
          
          this.cachedPlans.set(planId, cachedPlan);
        }
      }
      
    } catch (error) {
      console.error('❌ Error updating meal status:', error);
    }
  }
  
  /**
   * Очистить кэш
   */
  clearCache() {
    this.cachedPlans.clear();
    console.log('🧹 Cache cleared');
  }
}

// Экспорт синглтона
export const dailyRationService = new DailyRationService();