// app/services/recipeService.ts
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
  limit,
  startAfter,
  increment,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/app/firebase/config";

const RECIPES_PER_PAGE = 20;

// Типы питания
export type DietType = 'Обычное' | 'Вегетарианское' | 'Веганское' | 'Безглютеновое' | 'Безлактозное' | 'Низкоуглеводное' | 'Высокобелковое' | 'Средиземноморское' | 'Кето';

// Питательная ценность на 100г
export interface NutritionPer100g {
  protein: number;
  fat: number;
  carbs: number;
  calories: number;
}

// НОВЫЙ ИНТЕРФЕЙС ДЛЯ ИНГРЕДИЕНТОВ С ВЕСАМИ
export interface IngredientWithWeight {
  name: string;
  amount: number;
  unit: string; // "г", "мл", "шт", "ст.л.", "ч.л."
}

// Обновленный интерфейс Recipe
export interface Recipe {
  id?: string;
  title: string;
  description?: string;
  categories: string[];
  dietType: DietType;
  prepTime: number;
  difficulty: string;
  ingredientsList: string[];      // Массив названий ингредиентов (для проверки аллергий)
  ingredientsWithWeights?: IngredientWithWeight[];  // НОВОЕ ПОЛЕ: ингредиенты с граммовками
  steps: string[];
  nutritionPer100g: NutritionPer100g;
  caloriesPerGram: number;
  totalWeight?: number;
  servings?: number;
  imageUrl?: string;
  cloudinaryPublicId?: string;
  isPublic: boolean;
  userId: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  // Для обратной совместимости со старыми методами
  averageRating?: number;
  ratingsCount?: number;
  likesCount?: number;
  savesCount?: number;
  tags?: string[];
  weight?: string;
  mealType?: string;
  calories?: number;
  proteins?: number;
  fats?: number;
  carbohydrates?: number;
  ingredients?: string[];
  ingredientsText?: string;
}

interface RecipesResponse {
  recipes: Recipe[];
  lastUserDoc: QueryDocumentSnapshot<DocumentData> | null;
  lastPublicDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMoreUser: boolean;
  hasMorePublic: boolean;
}

interface Filters {
  categories?: string[];
  dietType?: DietType;
  difficulty?: string;
  maxPrepTime?: number;
  search?: string;
  excludeIngredients?: string[];
}

class RecipeService {
  async updateRecipeRatingStats(
    recipeId: string,
    countChange: number,
    ratingChange: number = 0
  ): Promise<void> {
    try {
      if (!recipeId) throw new Error("Recipe ID is required");
      const recipeRef = doc(db, "recipes", recipeId);
      await updateDoc(recipeRef, {
        ratingsCount: increment(countChange),
        averageRating: ratingChange ? increment(ratingChange) : undefined,
      });
    } catch (error) {
      console.error("Error updating recipe rating stats:", error);
      throw error;
    }
  }

  async getRecipes({
    filters = {},
    lastPublicDoc = null,
    lastUserDoc = null,
    sortField = "createdAt",
    sortDirection = "desc",
  }: {
    filters?: Filters;
    lastPublicDoc?: QueryDocumentSnapshot<DocumentData> | null;
    lastUserDoc?: QueryDocumentSnapshot<DocumentData> | null;
    sortField?: string;
    sortDirection?: "asc" | "desc";
  }): Promise<RecipesResponse> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const recipesRef = collection(db, "recipes");

      const applyFilters = (baseQuery: any) => {
        let q = baseQuery;

        if (filters.categories && filters.categories.length > 0) {
          q = query(q, where("categories", "array-contains-any", filters.categories));
        }

        if (filters.dietType) {
          q = query(q, where("dietType", "==", filters.dietType));
        }

        if (filters.difficulty) {
          q = query(q, where("difficulty", "==", filters.difficulty));
        }

        if (filters.maxPrepTime) {
          q = query(q, where("prepTime", "<=", filters.maxPrepTime));
        }

        q = query(q, orderBy(sortField, sortDirection));

        return q;
      };

      let userQ = query(recipesRef, where("userId", "==", user.uid));
      userQ = applyFilters(userQ);
      if (lastUserDoc) {
        userQ = query(userQ, startAfter(lastUserDoc));
      }
      userQ = query(userQ, limit(RECIPES_PER_PAGE));

      let publicQ = query(
        recipesRef,
        where("isPublic", "==", true),
        where("userId", "!=", user.uid)
      );
      publicQ = applyFilters(publicQ);
      if (lastPublicDoc) {
        publicQ = query(publicQ, startAfter(lastPublicDoc));
      }
      publicQ = query(publicQ, limit(RECIPES_PER_PAGE));

      const [userSnapshot, publicSnapshot] = await Promise.all([
        getDocs(userQ),
        getDocs(publicQ),
      ]);

      let allRecipes: Recipe[] = [];

      userSnapshot.docs.forEach((doc) => {
        allRecipes.push({ id: doc.id, ...doc.data() } as Recipe);
      });

      publicSnapshot.docs.forEach((doc) => {
        allRecipes.push({ id: doc.id, ...doc.data() } as Recipe);
      });

      const nextLastUserDoc =
        userSnapshot.docs.length > 0
          ? userSnapshot.docs[userSnapshot.docs.length - 1]
          : null;
      const nextLastPublicDoc =
        publicSnapshot.docs.length > 0
          ? publicSnapshot.docs[publicSnapshot.docs.length - 1]
          : null;

      let recipesToReturn = allRecipes;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        recipesToReturn = allRecipes.filter(
          (recipe) =>
            recipe.title.toLowerCase().includes(searchLower) ||
            (recipe.description &&
              recipe.description.toLowerCase().includes(searchLower)) ||
            (recipe.ingredientsList &&
              recipe.ingredientsList.some(ing => ing.toLowerCase().includes(searchLower)))
        );
      }

      return {
        recipes: recipesToReturn,
        lastUserDoc: nextLastUserDoc,
        lastPublicDoc: nextLastPublicDoc,
        hasMoreUser: userSnapshot.docs.length === RECIPES_PER_PAGE,
        hasMorePublic: publicSnapshot.docs.length === RECIPES_PER_PAGE,
      };
    } catch (error) {
      console.error("Error getting recipes:", error);
      throw error;
    }
  }

  async getRecipesForPlanner(): Promise<Recipe[]> {
    try {
      const user = auth.currentUser;
      if (!user) return [];

      const recipesRef = collection(db, "recipes");
      const userQ = query(recipesRef, where("userId", "==", user.uid));
      const publicQ = query(recipesRef, where("isPublic", "==", true));

      const [userSnapshot, publicSnapshot] = await Promise.all([
        getDocs(userQ),
        getDocs(publicQ),
      ]);

      let allRecipesMap = new Map<string, Recipe>();

      userSnapshot.docs.forEach((doc) => {
        allRecipesMap.set(doc.id, { id: doc.id, ...doc.data() } as Recipe);
      });

      publicSnapshot.docs.forEach((doc) => {
        if (!allRecipesMap.has(doc.id)) {
          allRecipesMap.set(doc.id, { id: doc.id, ...doc.data() } as Recipe);
        }
      });

      return Array.from(allRecipesMap.values());
    } catch (error) {
      console.error("Error getting recipes for planner:", error);
      return [];
    }
  }

  async getRecipeById(recipeId: string): Promise<Recipe> {
    try {
      const recipeRef = doc(db, "recipes", recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error("Recipe not found");
      }

      const recipe = { id: recipeDoc.id, ...recipeDoc.data() } as Recipe;

      const user = auth.currentUser;
      if (!recipe.isPublic && recipe.userId !== user?.uid) {
        throw new Error("Access denied");
      }

      return recipe;
    } catch (error) {
      console.error("Error getting recipe:", error);
      throw error;
    }
  }

  async createRecipe(recipeData: Omit<Recipe, "id" | "createdAt" | "updatedAt" | "userId" | "averageRating" | "ratingsCount" | "likesCount" | "savesCount">): Promise<Recipe> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const caloriesPerGram = recipeData.nutritionPer100g.calories / 100;

      const recipeWithMetadata: any = {
        ...recipeData,
        userId: user.uid,
        caloriesPerGram,
        likesCount: 0,
        savesCount: 0,
        averageRating: 0,
        ratingsCount: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, "recipes"), recipeWithMetadata);
      return { id: docRef.id, ...recipeWithMetadata } as Recipe;
    } catch (error) {
      console.error("Error creating recipe:", error);
      throw error;
    }
  }

  async updateRecipe(
    recipeId: string,
    updates: Partial<Recipe>
  ): Promise<{ id: string } & Partial<Recipe>> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const recipeRef = doc(db, "recipes", recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error("Recipe not found");
      }

      const recipeData = recipeDoc.data() as Recipe;
      if (recipeData.userId !== user.uid) {
        throw new Error("Not authorized to update this recipe");
      }

      if (updates.nutritionPer100g) {
        updates.caloriesPerGram = updates.nutritionPer100g.calories / 100;
      }

      await updateDoc(recipeRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });

      return { id: recipeId, ...updates };
    } catch (error) {
      console.error("Error updating recipe:", error);
      throw error;
    }
  }

  async deleteRecipe(recipeId: string): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const recipeRef = doc(db, "recipes", recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error("Recipe not found");
      }

      const recipeData = recipeDoc.data() as Recipe;
      if (recipeData.userId !== user.uid) {
        throw new Error("Not authorized to delete this recipe");
      }

      await deleteDoc(recipeRef);
      return true;
    } catch (error) {
      console.error("Error deleting recipe:", error);
      throw error;
    }
  }

  async getUserRecipes(userId?: string | null): Promise<Recipe[]> {
    try {
      let targetUserId = userId;

      if (!targetUserId) {
        const user = auth.currentUser;
        if (!user) {
          throw new Error("User not authenticated and no user ID provided");
        }
        targetUserId = user.uid;
      }

      console.log(`Getting recipes for user: ${targetUserId}`);

      const recipesQuery = query(
        collection(db, "recipes"),
        where("userId", "==", targetUserId),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(recipesQuery);
      const recipes = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Recipe)
      );

      console.log(`Found ${recipes.length} recipes for user ${targetUserId}`);
      return recipes;
    } catch (error) {
      console.error("Error getting user recipes:", error);
      throw error;
    }
  }

  async getAllRecipes(): Promise<Recipe[]> {
    try {
      console.log('📋 Загрузка всех рецептов (публичные + пользовательские)...');
      
      const user = auth.currentUser;
      if (!user) {
        console.log('Пользователь не авторизован, загружаем только публичные рецепты');
        const publicRecipes = await this.getPublicRecipes();
        return publicRecipes;
      }

      const publicRecipes = await this.getPublicRecipes();
      const userRecipes = await this.getUserRecipes(user.uid);
      
      const allRecipesMap = new Map<string, Recipe>();
      
      publicRecipes.forEach(recipe => allRecipesMap.set(recipe.id!, recipe));
      userRecipes.forEach(recipe => allRecipesMap.set(recipe.id!, recipe));
      
      const allRecipes = Array.from(allRecipesMap.values());
      
      console.log(`✅ Загружено всего рецептов: ${allRecipes.length}`);
      return allRecipes;
    } catch (error) {
      console.error('❌ Ошибка загрузки всех рецептов:', error);
      return [];
    }
  }

  async getPublicRecipes(): Promise<Recipe[]> {
    try {
      console.log('📋 Загрузка публичных рецептов...');
      
      const recipesQuery = query(
        collection(db, "recipes"),
        where("isPublic", "==", true),
        orderBy("createdAt", "desc")
      );

      const snapshot = await getDocs(recipesQuery);
      const recipes = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Recipe)
      );

      console.log(`✅ Загружено публичных рецептов: ${recipes.length}`);
      return recipes;
    } catch (error) {
      console.error('❌ Ошибка загрузки публичных рецептов:', error);
      return [];
    }
  }

  async searchRecipes(searchTerm: string, filters?: Filters): Promise<Recipe[]> {
    try {
      console.log(`🔍 Поиск рецептов: "${searchTerm}"`);
      
      const allRecipes = await this.getAllRecipes();
      const searchLower = searchTerm.toLowerCase();
      
      let filteredRecipes = allRecipes.filter(recipe => {
        const titleMatch = recipe.title.toLowerCase().includes(searchLower);
        const descriptionMatch = recipe.description?.toLowerCase().includes(searchLower) || false;
        const ingredientsMatch = recipe.ingredientsList?.some(ing => ing.toLowerCase().includes(searchLower)) || false;
        return titleMatch || descriptionMatch || ingredientsMatch;
      });
      
      if (filters) {
        if (filters.dietType) {
          filteredRecipes = filteredRecipes.filter(r => r.dietType === filters.dietType);
        }
        if (filters.maxPrepTime) {
          filteredRecipes = filteredRecipes.filter(r => r.prepTime <= filters.maxPrepTime!);
        }
        if (filters.difficulty) {
          filteredRecipes = filteredRecipes.filter(r => r.difficulty === filters.difficulty);
        }
        if (filters.categories && filters.categories.length > 0) {
          filteredRecipes = filteredRecipes.filter(r => 
            r.categories.some(cat => filters.categories!.includes(cat))
          );
        }
        if (filters.excludeIngredients && filters.excludeIngredients.length > 0) {
          filteredRecipes = filteredRecipes.filter(r => 
            !r.ingredientsList.some(ing => filters.excludeIngredients!.includes(ing))
          );
        }
      }
      
      console.log(`✅ Найдено рецептов: ${filteredRecipes.length}`);
      return filteredRecipes;
    } catch (error) {
      console.error('❌ Ошибка поиска рецептов:', error);
      return [];
    }
  }

  async getRecipesByCategory(category: string): Promise<Recipe[]> {
    try {
      console.log(`📂 Загрузка рецептов категории: ${category}`);
      
      const allRecipes = await this.getAllRecipes();
      const categoryLower = category.toLowerCase();
      
      const filteredRecipes = allRecipes.filter(recipe => 
        recipe.categories.some(cat => cat.toLowerCase().includes(categoryLower))
      );
      
      console.log(`✅ Найдено рецептов в категории: ${filteredRecipes.length}`);
      return filteredRecipes;
    } catch (error) {
      console.error('❌ Ошибка загрузки рецептов по категории:', error);
      return [];
    }
  }

  async getMealPlanRecipes(): Promise<Recipe[]> {
    try {
      const user = auth.currentUser;
      if (!user) return [];
      
      const publicQuery = query(
        collection(db, "recipes"),
        where("isPublic", "==", true)
      );
      
      const userQuery = query(
        collection(db, "recipes"),
        where("userId", "==", user.uid)
      );
      
      const [publicSnapshot, userSnapshot] = await Promise.all([
        getDocs(publicQuery),
        getDocs(userQuery)
      ]);
      
      const recipesMap = new Map<string, Recipe>();
      
      userSnapshot.docs.forEach(doc => {
        const recipe = { id: doc.id, ...doc.data() } as Recipe;
        recipesMap.set(doc.id, recipe);
      });
      
      publicSnapshot.docs.forEach(doc => {
        if (!recipesMap.has(doc.id)) {
          const recipe = { id: doc.id, ...doc.data() } as Recipe;
          recipesMap.set(doc.id, recipe);
        }
      });
      
      return Array.from(recipesMap.values());
    } catch (error) {
      console.error('❌ Ошибка загрузки рецептов для плана:', error);
      return [];
    }
  }

  async getUserRecipesCount(): Promise<number> {
    try {
      const user = auth.currentUser;
      if (!user) return 0;
      
      const userRecipes = await this.getUserRecipes(user.uid);
      return userRecipes.length;
    } catch (error) {
      console.error('❌ Ошибка получения количества рецептов:', error);
      return 0;
    }
  }
}

export const recipeService = new RecipeService();
export default recipeService;