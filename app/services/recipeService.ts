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

// Максимальное количество документов за один запрос
const RECIPES_PER_PAGE = 20;

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  userId: string;
  isPublic: boolean;
  mealType: string;
  difficultyLevel: string;
  averageRating: number;
  ratingsCount: number;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  cookingTime: number | string; 
  ingredients: string[];
  ingredientsText?: string; 
  steps: string[];
  tags: string[];
  imageUrl?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

interface RecipesResponse {
  recipes: Recipe[];
  lastUserDoc: QueryDocumentSnapshot<DocumentData> | null;
  lastPublicDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMoreUser: boolean;
  hasMorePublic: boolean;
}

interface Filters {
  mealType?: string;
  difficulty?: string;
  minRating?: number;
  search?: string;
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
      });

      console.log(`Recipe ${recipeId} ratingsCount updated by ${countChange}`);
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

        if (filters.mealType) {
          q = query(q, where("mealType", "==", filters.mealType));
        }

        if (filters.difficulty) {
          q = query(q, where("difficultyLevel", "==", filters.difficulty));
        }

        if (filters.minRating) {
          q = query(q, where("averageRating", ">=", filters.minRating));
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
            (Array.isArray(recipe.tags) &&
              recipe.tags.some((tag) =>
                tag.toLowerCase().includes(searchLower)
              )) ||
            (recipe.ingredientsText &&
              recipe.ingredientsText.toLowerCase().includes(searchLower)) // Теперь ingredientsText есть в интерфейсе
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
        if (
          !allRecipesMap.has(doc.id) ||
          (doc.data() as Recipe).userId !== user.uid
        ) {
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

  async createRecipe(
    recipeData: Omit<
      Recipe,
      | "id"
      | "createdAt"
      | "updatedAt"
      | "userId"
      | "likesCount"
      | "savesCount"
      | "averageRating"
      | "ratingsCount"
    >
  ): Promise<Recipe> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated");

      const recipeWithMetadata: Omit<Recipe, "id"> = {
        ...recipeData,
        userId: user.uid,
        likesCount: 0,
        savesCount: 0,
        averageRating: 0,
        ratingsCount: 0,
        calories: recipeData.calories || 0,
        proteins: recipeData.proteins || 0,
        fats: recipeData.fats || 0,
        carbohydrates: recipeData.carbohydrates || 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } as Omit<Recipe, "id">;

      const docRef = await addDoc(
        collection(db, "recipes"),
        recipeWithMetadata
      );
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
      // Определяем, какой userId использовать
      let targetUserId = userId;

      // Если userId не передан, пробуем взять из текущего пользователя
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
}



export const recipeService = new RecipeService();
export default recipeService;
