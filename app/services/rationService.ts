// app/services/rationService.ts - ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД

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
  difficulty: string;
  imageUrl?: string;
  mealType?: string;
  ingredientsList?: string[];
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

interface PlanStats {
  totalCalories: number;
  totalProteins: number;
  totalFats: number;
  totalCarbs: number;
  totalCookingTime: number;
  completedMeals: number;
  totalMeals: number;
  isOverLimit?: boolean;
  percentOfTarget?: number;
  note?: string;
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
  stats: PlanStats;
  timestamps: {
    createdAt: string;
    updatedAt: string;
  };
}

const formatDate = (date: Date): string => date.toISOString().split('T')[0];

const getDayOfWeek = (date: Date): string => {
  const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  return days[date.getDay()];
};

const generateUniqueId = (): string => `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;

const parseCookingTime = (time: any): number => {
  if (typeof time === 'number') return time;
  if (typeof time === 'string') {
    const match = time.match(/\d+/);
    return match ? parseInt(match[0], 10) : 20;
  }
  return 20;
};

const normalizeCategory = (cat: string): string => {
  const normalized = cat.toLowerCase().trim();
  
  if (normalized.includes('завтрак') || normalized.includes('breakfast') ||
      normalized.includes('каша') || normalized.includes('омлет') || 
      normalized.includes('панкейк') || normalized.includes('блин') ||
      normalized.includes('тост') || normalized.includes('йогурт') ||
      normalized.includes('мюсли') || normalized.includes('гранола') ||
      normalized.includes('чиа') || normalized.includes('смузи') ||
      normalized.includes('сырник') || normalized.includes('кекс') ||
      normalized.includes('маффин')) {
    return 'Завтрак';
  }
  
  if (normalized.includes('обед') || normalized.includes('lunch') ||
      normalized.includes('суп') || normalized.includes('борщ') ||
      normalized.includes('бульон') || normalized.includes('паста') ||
      normalized.includes('рис') || normalized.includes('карри') ||
      normalized.includes('плов') || normalized.includes('лазанья') ||
      normalized.includes('котлета')) {
    return 'Обед';
  }
  
  if (normalized.includes('ужин') || normalized.includes('dinner') ||
      normalized.includes('стейк') || normalized.includes('рыба') ||
      normalized.includes('курица') || normalized.includes('мясо') ||
      normalized.includes('запеканка') || normalized.includes('рагу')) {
    return 'Ужин';
  }
  
  if (normalized.includes('перекус') || normalized.includes('snack') ||
      normalized.includes('салат') || normalized.includes('фрукт') ||
      normalized.includes('орех') || normalized.includes('батончик') ||
      normalized.includes('чипсы') || normalized.includes('десерт') ||
      normalized.includes('печенье')) {
    return 'Перекус';
  }
  
  return 'Обед';
};

class DailyRationService {
  private cachedPlans: Map<string, Plan>;
  
  constructor() {
    this.cachedPlans = new Map();
  }
  
  async getOrGenerateDailyPlan(userId: string): Promise<Plan> {
    try {
      if (!userId) throw new Error('User ID is required');
      const date = new Date();
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      
      if (this.cachedPlans.has(planId)) {
        return this.cachedPlans.get(planId)!;
      }
      
      let plan = await this.getPlanById(planId);
      
      if (!plan) {
        console.log('🔄 Generating new plan for today');
        plan = await this.generateNewPlan(userId, date);
        plan.id = planId;
        await this.savePlan(plan);
      }
      
      const allMeals = [...(plan.meals || []), ...(plan.customMeals || [])];
      const finalPlan = { ...plan, meals: allMeals };
      this.cachedPlans.set(planId, finalPlan);
      
      return finalPlan;
    } catch (error) {
      console.error('❌ Error in getOrGenerateDailyPlan:', error);
      throw error;
    }
  }
  
  async createNewPlanWithUserSettings(userId: string): Promise<Plan> {
    try {
      const date = new Date();
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      
      console.log('🔄 Creating new plan with current user settings');
      const plan = await this.generateNewPlan(userId, date);
      plan.id = planId;
      await this.savePlan(plan);
      
      const finalPlan = { ...plan, meals: [...(plan.meals || []), ...(plan.customMeals || [])] };
      this.cachedPlans.set(planId, finalPlan);
      
      return finalPlan;
    } catch (error) {
      console.error('❌ Error creating new plan with settings:', error);
      throw error;
    }
  }
  
  async getPlanById(planId: string): Promise<Plan | null> {
    try {
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      
      if (planSnap.exists()) {
        const data = planSnap.data();
        const meals = data.meals || [];
        const customMeals = data.customMeals || [];
        const allMeals = [...meals, ...customMeals];
        const dailyCalories = data.userTargets?.dailyCalories || 2000;
        
        return {
          id: planSnap.id,
          userId: data.userId || '',
          date: data.date || '',
          dayOfWeek: data.dayOfWeek || '',
          userTargets: data.userTargets || { dailyCalories: 2000, dietType: 'Обычное' },
          meals: meals,
          customMeals: customMeals,
          stats: this.calculatePlanStats(allMeals, dailyCalories),
          timestamps: data.timestamps || { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        };
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting plan:', error);
      return null;
    }
  }
  
  async addCustomMealToPlan(userId: string, date: Date, mealData: Omit<Meal, 'id'> & { id?: string }): Promise<string> {
    try {
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      const mealId = mealData.id || generateUniqueId();
      const meal: Meal = { ...mealData, id: mealId, isCustom: true, canBeRemoved: true, addedAt: new Date().toISOString() };
      
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      let dailyCalories = 2000;
      
      if (!planSnap.exists()) {
        const userData = await this.getUserData(userId);
        dailyCalories = userData.dailyCalories;
        const newPlan = {
          userId, date: dateStr, dayOfWeek: getDayOfWeek(date),
          userTargets: { dailyCalories, dietType: userData.dietType || 'Обычное' },
          meals: [], customMeals: [meal],
          stats: this.calculatePlanStats([meal], dailyCalories),
          timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        };
        await setDoc(planRef, newPlan);
      } else {
        const existingPlan = planSnap.data();
        dailyCalories = existingPlan.userTargets?.dailyCalories || 2000;
        const existingCustomMeals = existingPlan.customMeals || [];
        const existingMealIndex = existingCustomMeals.findIndex((m: Meal) => m.id === meal.id || m.recipeId === meal.recipeId);
        
        if (existingMealIndex !== -1) {
          const updatedCustomMeals = [...existingCustomMeals];
          updatedCustomMeals[existingMealIndex] = meal;
          await updateDoc(planRef, { customMeals: updatedCustomMeals, 'timestamps.updatedAt': new Date().toISOString() });
        } else {
          await updateDoc(planRef, { customMeals: arrayUnion(meal), 'timestamps.updatedAt': new Date().toISOString() });
        }
        
        const allMeals = [...(existingPlan.meals || []), ...(existingPlan.customMeals || []), ...(existingMealIndex === -1 ? [meal] : [])];
        const stats = this.calculatePlanStats(allMeals, dailyCalories);
        
        await updateDoc(planRef, {
          'stats.totalCalories': stats.totalCalories,
          'stats.totalProteins': stats.totalProteins,
          'stats.totalFats': stats.totalFats,
          'stats.totalCarbs': stats.totalCarbs,
          'stats.totalCookingTime': stats.totalCookingTime,
          'stats.totalMeals': allMeals.length,
          'stats.completedMeals': allMeals.filter((m: Meal) => m.marked).length,
          'stats.isOverLimit': stats.isOverLimit,
          'stats.percentOfTarget': stats.percentOfTarget,
          'stats.note': stats.note
        });
      }
      
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
        const stats = this.calculatePlanStats(cachedPlan.meals, cachedPlan.userTargets?.dailyCalories || 2000);
        cachedPlan.stats = { ...stats, completedMeals: cachedPlan.meals.filter(m => m.marked).length, totalMeals: cachedPlan.meals.length };
        this.cachedPlans.set(planId, cachedPlan);
      }
      
      return mealId;
    } catch (error) {
      console.error('❌ Error adding custom meal to plan:', error);
      throw error;
    }
  }
  
  async removeCustomMealFromPlan(userId: string, date: Date, mealId: string): Promise<void> {
    try {
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      if (!planSnap.exists()) return;
      
      const planData = planSnap.data();
      const dailyCalories = planData.userTargets?.dailyCalories || 2000;
      const customMeals = planData.customMeals || [];
      const mealToRemove = customMeals.find((meal: Meal) => meal.id === mealId);
      if (!mealToRemove) return;
      
      const updatedCustomMeals = customMeals.filter((meal: Meal) => meal.id !== mealId);
      const allMeals = [...(planData.meals || []), ...updatedCustomMeals];
      const stats = this.calculatePlanStats(allMeals, dailyCalories);
      
      await updateDoc(planRef, {
        customMeals: updatedCustomMeals,
        'stats.totalCalories': stats.totalCalories,
        'stats.totalProteins': stats.totalProteins,
        'stats.totalFats': stats.totalFats,
        'stats.totalCarbs': stats.totalCarbs,
        'stats.totalCookingTime': stats.totalCookingTime,
        'stats.totalMeals': allMeals.length,
        'stats.completedMeals': allMeals.filter((m: Meal) => m.marked).length,
        'stats.isOverLimit': stats.isOverLimit,
        'stats.percentOfTarget': stats.percentOfTarget,
        'stats.note': stats.note,
        'timestamps.updatedAt': new Date().toISOString()
      });
      
      if (this.cachedPlans.has(planId)) {
        const cachedPlan = this.cachedPlans.get(planId)!;
        const allMealsFiltered = cachedPlan.meals.filter(meal => meal.id !== mealId);
        const statsFiltered = this.calculatePlanStats(allMealsFiltered, dailyCalories);
        cachedPlan.meals = allMealsFiltered;
        cachedPlan.stats = { ...statsFiltered, completedMeals: allMealsFiltered.filter(m => m.marked).length, totalMeals: allMealsFiltered.length };
        this.cachedPlans.set(planId, cachedPlan);
      }
    } catch (error) {
      console.error('❌ Error removing custom meal from plan:', error);
      throw error;
    }
  }
  
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  async generateNewPlan(userId: string, date: Date): Promise<Plan> {
    try {
      const userData = await this.getUserData(userId);
      const dailyCalories = userData.dailyCalories;
      
      let targetProteins = userData.targetProteinGrams;
      let targetFats = userData.targetFatGrams;
      let targetCarbs = userData.targetCarbGrams;
      
      if (!targetProteins || targetProteins === 0) {
        targetProteins = Math.round((dailyCalories * 0.3) / 4);
      }
      if (!targetFats || targetFats === 0) {
        targetFats = Math.round((dailyCalories * 0.3) / 9);
      }
      if (!targetCarbs || targetCarbs === 0) {
        targetCarbs = Math.round((dailyCalories * 0.4) / 4);
      }
      
      console.log(`🎯 ЦЕЛЬ: ${dailyCalories} ккал, Б:${targetProteins}, Ж:${targetFats}, У:${targetCarbs}`);
      
      const availableRecipes = await this.getRecipesWithFilters(userData);
      
      if (availableRecipes.length === 0) {
        return this.createEmptyPlan(userId, date);
      }
      
      const recipesByCategory = this.groupRecipesByCategory(availableRecipes);
      
      const dayStructure = ['Завтрак', 'Обед', 'Ужин', 'Перекус'];
      
      const distribution: Record<string, { calories: number; proteins: number; fats: number; carbs: number }> = {
        'Завтрак': { calories: 0.25, proteins: 0.25, fats: 0.25, carbs: 0.25 },
        'Обед': { calories: 0.35, proteins: 0.40, fats: 0.35, carbs: 0.35 },
        'Ужин': { calories: 0.25, proteins: 0.25, fats: 0.25, carbs: 0.25 },
        'Перекус': { calories: 0.15, proteins: 0.10, fats: 0.15, carbs: 0.15 }
      };
      
      const weightRange: Record<string, { min: number; max: number; default: number }> = {
        'Завтрак': { min: 200, max: 400, default: 300 },
        'Обед': { min: 300, max: 600, default: 450 },
        'Ужин': { min: 250, max: 500, default: 350 },
        'Перекус': { min: 100, max: 250, default: 150 }
      };
      
      let bestMeals: Meal[] = [];
      let bestScore = Infinity;
      
      // 100 попыток для разнообразия
      for (let attempt = 0; attempt < 100; attempt++) {
        const attemptMeals: Meal[] = [];
        let attCalories = 0, attProteins = 0, attFats = 0, attCarbs = 0;
        
        for (const category of dayStructure) {
          let categoryRecipes = [...(this.getRecipesForCategory(recipesByCategory, category))];
          if (categoryRecipes.length === 0) continue;
          
          // Перемешиваем для разнообразия
          categoryRecipes = this.shuffleArray(categoryRecipes);
          
          const dist = distribution[category];
          const weight = weightRange[category];
          
          const targetMealCalories = dailyCalories * dist.calories;
          const targetMealProteins = targetProteins * dist.proteins;
          const targetMealFats = targetFats * dist.fats;
          const targetMealCarbs = targetCarbs * dist.carbs;
          
          // Собираем всех кандидатов с их оценками
          const candidates: { recipe: Recipe; weight: number; calories: number; proteins: number; fats: number; carbs: number; score: number }[] = [];
          
          for (const recipe of categoryRecipes) {
            const caloriesPer100g = recipe.calories || 0;
            if (caloriesPer100g <= 0) continue;
            
            let calculatedWeight = (targetMealCalories / caloriesPer100g) * 100;
            let finalWeight = Math.max(weight.min, Math.min(weight.max, calculatedWeight));
            
            const calcCalories = Math.round((caloriesPer100g * finalWeight) / 100);
            const calcProteins = Math.round((recipe.proteins * finalWeight) / 100);
            const calcFats = Math.round((recipe.fats * finalWeight) / 100);
            const calcCarbs = Math.round((recipe.carbohydrates * finalWeight) / 100);
            
            if (attCalories + calcCalories > dailyCalories) continue;
            if (attProteins + calcProteins > targetProteins) continue;
            if (attFats + calcFats > targetFats) continue;
            if (attCarbs + calcCarbs > targetCarbs) continue;
            
            const calorieDiff = Math.abs(calcCalories - targetMealCalories);
            const proteinDiff = Math.abs(calcProteins - targetMealProteins);
            const fatDiff = Math.abs(calcFats - targetMealFats);
            const carbDiff = Math.abs(calcCarbs - targetMealCarbs);
            
            const score = calorieDiff * 0.2 + proteinDiff * 0.5 + fatDiff * 0.15 + carbDiff * 0.15;
            
            candidates.push({
              recipe, weight: Math.round(finalWeight),
              calories: calcCalories, proteins: calcProteins,
              fats: calcFats, carbs: calcCarbs, score
            });
          }
          
          if (candidates.length > 0) {
            // Сортируем по оценке
            candidates.sort((a, b) => a.score - b.score);
            
            // 🔧 ВЫБИРАЕМ СЛУЧАЙНЫЙ ИЗ ТОП-5 (для разнообразия)
            const topCount = Math.min(5, candidates.length);
            const randomIndex = Math.floor(Math.random() * topCount);
            const selected = candidates[randomIndex];
            
            const meal = this.createMealFromRecipe(
              selected.recipe, category, selected.weight,
              selected.calories, selected.proteins, selected.fats, selected.carbs
            );
            attemptMeals.push(meal);
            attCalories += selected.calories;
            attProteins += selected.proteins;
            attFats += selected.fats;
            attCarbs += selected.carbs;
          }
        }
        
        if (attemptMeals.length === 4) {
          const totalScore = 
            Math.abs(attCalories - dailyCalories) * 0.3 +
            Math.abs(attProteins - targetProteins) * 0.4 +
            Math.abs(attFats - targetFats) * 0.15 +
            Math.abs(attCarbs - targetCarbs) * 0.15;
          
          if (totalScore < bestScore) {
            bestScore = totalScore;
            bestMeals = [...attemptMeals];
          }
        }
      }
      
      if (bestMeals.length > 0) {
        const stats = this.calculatePlanStats(bestMeals, dailyCalories);
        
        console.log(`📊 ИТОГОВЫЙ РАЦИОН:`);
        console.log(`   Калории: ${stats.totalCalories}/${dailyCalories} (${Math.round((stats.totalCalories/dailyCalories)*100)}%)`);
        console.log(`   Белки: ${stats.totalProteins}/${targetProteins} (${Math.round((stats.totalProteins/targetProteins)*100)}%)`);
        console.log(`   Жиры: ${stats.totalFats}/${targetFats} (${Math.round((stats.totalFats/targetFats)*100)}%)`);
        console.log(`   Углеводы: ${stats.totalCarbs}/${targetCarbs} (${Math.round((stats.totalCarbs/targetCarbs)*100)}%)`);
        
        const plan: Omit<Plan, 'id'> = {
          userId,
          date: formatDate(date),
          dayOfWeek: getDayOfWeek(date),
          userTargets: { dailyCalories: userData.dailyCalories, dietType: userData.dietType },
          meals: bestMeals,
          customMeals: [],
          stats: { ...stats, completedMeals: 0, totalMeals: bestMeals.length },
          timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        };
        
        return plan as Plan;
      }
      
      return this.createEmptyPlan(userId, date);
      
    } catch (error) {
      console.error('❌ Error generating new plan:', error);
      return this.createEmptyPlan(userId, date);
    }
  }
  
  private getRecipesForCategory(recipesByCategory: { [key: string]: Recipe[] }, category: string): Recipe[] {
    if (recipesByCategory[category]) return recipesByCategory[category];
    const normalizedTarget = normalizeCategory(category).toLowerCase();
    for (const [key, recipes] of Object.entries(recipesByCategory)) {
      if (normalizeCategory(key).toLowerCase() === normalizedTarget || key === category) {
        return recipes;
      }
    }
    return [];
  }
  
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
          cookingTimeLimit: data.cookingTimeLimit ? parseInt(data.cookingTimeLimit) : 60,
          cookingSkill: data.cookingSkill || 'Средний',
          favoriteRecipes: data.favoriteRecipes || []
        };
      }
      return {
        dailyCalories: 2000, targetProteinGrams: 0, targetFatGrams: 0, targetCarbGrams: 0,
        dietType: 'Обычное', allergies: '', excludedIngredients: '', cookingTimeLimit: 60, cookingSkill: 'Средний'
      };
    } catch (error) {
      console.error('❌ Error getting user data:', error);
      return {
        dailyCalories: 2000, targetProteinGrams: 0, targetFatGrams: 0, targetCarbGrams: 0,
        dietType: 'Обычное', allergies: '', excludedIngredients: '', cookingTimeLimit: 60, cookingSkill: 'Средний'
      };
    }
  }
  
  async getRecipesWithFilters(userData: UserData): Promise<Recipe[]> {
    try {
      const allExternalRecipes = await recipeService.getRecipesForPlanner();
      if (!allExternalRecipes || allExternalRecipes.length === 0) {
        console.warn('⚠️ No recipes from recipeService');
        return [];
      }
      
      const allRecipes: Recipe[] = allExternalRecipes.map(externalRecipe => {
        const cookingTime = parseCookingTime(externalRecipe.prepTime);
        let mealType = externalRecipe.mealType || externalRecipe.categories?.[0] || 'Обед';
        if (Array.isArray(mealType)) mealType = mealType[0] || 'Обед';
        mealType = normalizeCategory(mealType);
        
        let difficulty = externalRecipe.difficulty || 'Легко';
        if (Array.isArray(difficulty)) difficulty = difficulty[0] || 'Легко';
        
        const calories = externalRecipe.nutritionPer100g?.calories || externalRecipe.calories || 0;
        const proteins = externalRecipe.nutritionPer100g?.protein || externalRecipe.proteins || 0;
        const fats = externalRecipe.nutritionPer100g?.fat || externalRecipe.fats || 0;
        const carbs = externalRecipe.nutritionPer100g?.carbs || externalRecipe.carbohydrates || 0;
        
        return {
          id: externalRecipe.id || `temp-${Date.now()}-${Math.random()}`,
          title: externalRecipe.title || 'Без названия',
          calories, proteins, fats, carbohydrates: carbs,
          cookingTime, difficulty, mealType,
          imageUrl: externalRecipe.imageUrl || undefined,
          ingredientsList: externalRecipe.ingredientsList || externalRecipe.ingredients || []
        };
      });
      
      const timeLimit = userData.cookingTimeLimit || 60;
      let filtered = allRecipes.filter(recipe => recipe.cookingTime <= timeLimit);
      
      const allergiesList = (userData.allergies || '').split(',').map(a => a.trim().toLowerCase()).filter(Boolean);
      const excludedList = (userData.excludedIngredients || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      const forbiddenItems = [...allergiesList, ...excludedList];
      
      if (forbiddenItems.length > 0) {
        filtered = filtered.filter(recipe => {
          const ingredients = (recipe.ingredientsList || []).map(i => i.toLowerCase());
          return !forbiddenItems.some(forbidden => ingredients.some(ing => ing.includes(forbidden)));
        });
      }
      
      return filtered.length > 0 ? filtered : allRecipes.slice(0, 50);
    } catch (error) {
      console.error('❌ Error filtering recipes:', error);
      return [];
    }
  }
  
  groupRecipesByCategory(recipes: Recipe[]): { [key: string]: Recipe[] } {
    const grouped: { [key: string]: Recipe[] } = {
      'Завтрак': [], 'Обед': [], 'Ужин': [], 'Перекус': []
    };
    
    recipes.forEach(recipe => {
      let category = normalizeCategory(recipe.mealType || 'Обед');
      const title = (recipe.title || '').toLowerCase();
      
      if (category === 'Завтрак') {
        const breakfastKeywords = ['каша', 'омлет', 'панкейк', 'блин', 'тост', 'йогурт', 'мюсли', 'гранола', 'чиа', 'смузи', 'кекс', 'маффин', 'сырник'];
        const isSuitable = breakfastKeywords.some(kw => title.includes(kw));
        if (isSuitable || grouped['Завтрак'].length < 15) {
          grouped['Завтрак'].push(recipe);
        } else {
          grouped['Обед'].push(recipe);
        }
      } else if (category === 'Перекус') {
        grouped['Перекус'].push(recipe);
      } else if (category === 'Ужин') {
        grouped['Ужин'].push(recipe);
      } else {
        grouped['Обед'].push(recipe);
      }
    });
    
    Object.entries(grouped).forEach(([cat, recs]) => console.log(`📁 ${cat}: ${recs.length} рецептов`));
    return grouped;
  }
  
  createMealFromRecipe(recipe: Recipe, category: string, weight: number, calories: number, proteins: number, fats: number, carbs: number): Meal {
    const uniqueId = `${recipe.id}-${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: uniqueId,
      recipeId: recipe.id,
      category: category,
      name: recipe.title || 'Рецепт',
      calories: calories,
      proteins: proteins,
      fats: fats,
      carbohydrates: carbs,
      weight: `${weight} гр`,
      cookingTime: recipe.cookingTime || 20,
      difficultyLevel: recipe.difficulty || 'Легко',
      rating: 0,
      imageUrl: recipe.imageUrl || null,
      marked: false,
      bookmarked: false,
      isCustom: false,
      canBeRemoved: false
    };
  }
  
  createFallbackMeal(category: string): Meal {
    return {
      id: `fallback-${category}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      recipeId: null, category,
      name: `Нет рецептов для "${category}"`,
      calories: 0, proteins: 0, fats: 0, carbohydrates: 0,
      weight: '0 гр', cookingTime: 0, difficultyLevel: 'Легко', rating: 0,
      imageUrl: null, marked: false, bookmarked: false, isCustom: false, canBeRemoved: false
    };
  }
  
  createEmptyPlan(userId: string, date: Date): Plan {
    const dateStr = formatDate(date);
    return {
      id: `${userId}_${dateStr}`, userId, date: dateStr, dayOfWeek: getDayOfWeek(date),
      userTargets: { dailyCalories: 2000, dietType: 'Обычное' },
      meals: [this.createFallbackMeal('Завтрак'), this.createFallbackMeal('Обед'), this.createFallbackMeal('Ужин'), this.createFallbackMeal('Перекус')],
      customMeals: [],
      stats: { totalCalories: 0, totalProteins: 0, totalFats: 0, totalCarbs: 0, totalCookingTime: 0, completedMeals: 0, totalMeals: 4, isOverLimit: false, percentOfTarget: 0, note: 'Не удалось загрузить рецепты' },
      timestamps: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    };
  }
  
  calculatePlanStats(meals: Meal[], targetCalories: number = 2000): PlanStats {
    const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
    const isOverLimit = totalCalories > targetCalories;
    const percentOfTarget = Math.round((totalCalories / targetCalories) * 100);
    
    let note = '';
    if (isOverLimit) note = `Внимание: рацион превышает норму на ${totalCalories - targetCalories} ккал.`;
    else if (percentOfTarget < 80) note = `Рацион недобирает ${targetCalories - totalCalories} ккал.`;
    else note = 'План сбалансирован';
    
    return {
      totalCalories,
      totalProteins: meals.reduce((sum, m) => sum + (m.proteins || 0), 0),
      totalFats: meals.reduce((sum, m) => sum + (m.fats || 0), 0),
      totalCarbs: meals.reduce((sum, m) => sum + (m.carbohydrates || 0), 0),
      totalCookingTime: meals.reduce((sum, m) => sum + (m.cookingTime || 0), 0),
      completedMeals: meals.filter(m => m.marked).length,
      totalMeals: meals.length,
      isOverLimit, percentOfTarget, note
    };
  }
  
  async savePlan(plan: Plan) {
    try {
      const planRef = doc(db, 'ration_plan_days', plan.id);
      const regularMeals = plan.meals.filter(meal => !meal.isCustom);
      const customMeals = plan.meals.filter(meal => meal.isCustom);
      await setDoc(planRef, {
        userId: plan.userId, date: plan.date, dayOfWeek: plan.dayOfWeek,
        userTargets: plan.userTargets, meals: regularMeals, customMeals: customMeals,
        stats: plan.stats, timestamps: plan.timestamps
      });
    } catch (error) {
      console.error('❌ Error saving plan:', error);
      throw error;
    }
  }
  
  async updateMealStatus(userId: string, date: Date, mealId: string, updates: Partial<Meal>) {
    try {
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      const planRef = doc(db, 'ration_plan_days', planId);
      const planSnap = await getDoc(planRef);
      if (!planSnap.exists()) return;
      
      const planData = planSnap.data();
      const dailyCalories = planData.userTargets?.dailyCalories || 2000;
      const meals = planData.meals || [];
      const customMeals = planData.customMeals || [];
      const allMeals = [...meals, ...customMeals];
      const mealIndex = allMeals.findIndex((meal: Meal) => meal.id === mealId);
      if (mealIndex === -1) return;
      
      const isCustom = mealIndex >= meals.length;
      const targetArray = isCustom ? 'customMeals' : 'meals';
      const targetIndex = isCustom ? mealIndex - meals.length : mealIndex;
      const updatedArray = [...planData[targetArray]];
      updatedArray[targetIndex] = { ...updatedArray[targetIndex], ...updates };
      
      const updatedAllMeals = [...(targetArray === 'meals' ? updatedArray : meals), ...(targetArray === 'customMeals' ? updatedArray : customMeals)];
      const stats = this.calculatePlanStats(updatedAllMeals, dailyCalories);
      
      await updateDoc(planRef, {
        [targetArray]: updatedArray,
        'stats.totalCalories': stats.totalCalories,
        'stats.totalProteins': stats.totalProteins,
        'stats.totalFats': stats.totalFats,
        'stats.totalCarbs': stats.totalCarbs,
        'stats.totalMeals': updatedAllMeals.length,
        'stats.completedMeals': updatedAllMeals.filter((m: Meal) => m.marked).length,
        'stats.isOverLimit': stats.isOverLimit,
        'stats.percentOfTarget': stats.percentOfTarget,
        'stats.note': stats.note,
        'timestamps.updatedAt': new Date().toISOString()
      });
      
      if (this.cachedPlans.has(planId)) {
        const cachedPlan = this.cachedPlans.get(planId)!;
        const allCachedMeals = cachedPlan.meals;
        const cachedMealIndex = allCachedMeals.findIndex(m => m.id === mealId);
        if (cachedMealIndex !== -1) {
          const updatedMeals = [...allCachedMeals];
          updatedMeals[cachedMealIndex] = { ...updatedMeals[cachedMealIndex], ...updates };
          cachedPlan.meals = updatedMeals;
          const newStats = this.calculatePlanStats(updatedMeals, dailyCalories);
          cachedPlan.stats = { ...newStats, completedMeals: updatedMeals.filter(m => m.marked).length, totalMeals: updatedMeals.length };
          this.cachedPlans.set(planId, cachedPlan);
        }
      }
    } catch (error) {
      console.error('❌ Error updating meal status:', error);
    }
  }
  
  async getPlanStats(userId: string, date: Date): Promise<PlanStats | null> {
    try {
      const dateStr = formatDate(date);
      const planId = `${userId}_${dateStr}`;
      const plan = await this.getPlanById(planId);
      if (!plan) return null;
      const allMeals = [...(plan.meals || []), ...(plan.customMeals || [])];
      return this.calculatePlanStats(allMeals, plan.userTargets.dailyCalories);
    } catch (error) {
      console.error('❌ Error getting plan stats:', error);
      return null;
    }
  }
  
  clearCache() {
    this.cachedPlans.clear();
    console.log('🧹 Cache cleared');
  }
}

export const dailyRationService = new DailyRationService();