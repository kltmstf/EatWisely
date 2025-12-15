// services/recipeService.js
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
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

// Максимальное количество документов за один запрос
const RECIPES_PER_PAGE = 20;

class RecipeService {
  
  
  async updateRecipeRatingStats(recipeId, countChange, ratingChange = 0) {
    try {
      if (!recipeId) throw new Error('Recipe ID is required');

      const recipeRef = doc(db, 'recipes', recipeId);
      
      
      await updateDoc(recipeRef, {
        ratingsCount: increment(countChange),
      });

      console.log(`Recipe ${recipeId} ratingsCount updated by ${countChange}`);
      
    } catch (error) {
      console.error('Error updating recipe rating stats:', error);
      throw error;
    }
  }
  
  
  async getRecipes({ filters = {}, lastPublicDoc = null, lastUserDoc = null, sortField = 'createdAt', sortDirection = 'desc' }) {

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const recipesRef = collection(db, 'recipes');

      const applyFilters = (baseQuery) => {
        let q = baseQuery;

        if (filters.mealType) {
          q = query(q, where('mealType', '==', filters.mealType));
        }

        if (filters.difficulty) {
          q = query(q, where('difficultyLevel', '==', filters.difficulty));
        }

        if (filters.minRating) {
          q = query(q, where('averageRating', '>=', filters.minRating));
        }

        q = query(q, orderBy(sortField, sortDirection));

        return q;
      };

      let userQ = query(recipesRef, where('userId', '==', user.uid));
      userQ = applyFilters(userQ);
      if (lastUserDoc) {
        userQ = query(userQ, startAfter(lastUserDoc));
      }
      userQ = query(userQ, limit(RECIPES_PER_PAGE));

      let publicQ = query(recipesRef, where('isPublic', '==', true), where('userId', '!=', user.uid));
      publicQ = applyFilters(publicQ);
      if (lastPublicDoc) {
        publicQ = query(publicQ, startAfter(lastPublicDoc));
      }
      publicQ = query(publicQ, limit(RECIPES_PER_PAGE));

      const [userSnapshot, publicSnapshot] = await Promise.all([
        getDocs(userQ),
        getDocs(publicQ)
      ]);

      let allRecipes = [];

      userSnapshot.docs.forEach(doc => {
        allRecipes.push({ id: doc.id, ...doc.data() });
      });

      publicSnapshot.docs.forEach(doc => {
        allRecipes.push({ id: doc.id, ...doc.data() });
      });

      const nextLastUserDoc = userSnapshot.docs.length > 0 ? userSnapshot.docs[userSnapshot.docs.length - 1] : null;
      const nextLastPublicDoc = publicSnapshot.docs.length > 0 ? publicSnapshot.docs[publicSnapshot.docs.length - 1] : null;

      let recipesToReturn = allRecipes;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        recipesToReturn = allRecipes.filter(recipe =>
          recipe.title.toLowerCase().includes(searchLower) ||
          (recipe.description && recipe.description.toLowerCase().includes(searchLower)) ||
          (Array.isArray(recipe.tags) && recipe.tags.some(tag => tag.toLowerCase().includes(searchLower))) ||
          (recipe.ingredientsText && recipe.ingredientsText.toLowerCase().includes(searchLower))
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
      console.error('Error getting recipes:', error);
      throw error;
    }
  }

  async getRecipesForPlanner() {
    try {
      const user = auth.currentUser;
      if (!user) return [];

      const recipesRef = collection(db, 'recipes');

      const userQ = query(recipesRef, where('userId', '==', user.uid));
      const publicQ = query(recipesRef, where('isPublic', '==', true));

      const [userSnapshot, publicSnapshot] = await Promise.all([
        getDocs(userQ),
        getDocs(publicQ)
      ]);

      let allRecipesMap = new Map();

      userSnapshot.docs.forEach(doc => {
        allRecipesMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      publicSnapshot.docs.forEach(doc => {
        if (!allRecipesMap.has(doc.id) || doc.data().userId !== user.uid) {
          allRecipesMap.set(doc.id, { id: doc.id, ...doc.data() });
        }
      });

      return Array.from(allRecipesMap.values());
    } catch (error) {
      console.error('Error getting recipes for planner:', error);
      return [];
    }
  }

  async getRecipeById(recipeId) {
    try {
      const recipeRef = doc(db, 'recipes', recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error('Recipe not found');
      }

      const recipe = { id: recipeDoc.id, ...recipeDoc.data() };

      const user = auth.currentUser;
      if (!recipe.isPublic && recipe.userId !== user?.uid) {
        throw new Error('Access denied');
      }

      return recipe;
    } catch (error) {
      console.error('Error getting recipe:', error);
      throw error;
    }
  }

  async createRecipe(recipeData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const recipeWithMetadata = {
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
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'recipes'), recipeWithMetadata);
      return { id: docRef.id, ...recipeWithMetadata };
    } catch (error) {
      console.error('Error creating recipe:', error);
      throw error;
    }
  }

  async updateRecipe(recipeId, updates) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const recipeRef = doc(db, 'recipes', recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error('Recipe not found');
      }

      if (recipeDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to update this recipe');
      }

      await updateDoc(recipeRef, {
        ...updates,
        updatedAt: new Date()
      });

      return { id: recipeId, ...updates };
    } catch (error) {
      console.error('Error updating recipe:', error);
      throw error;
    }
  }

  async deleteRecipe(recipeId) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const recipeRef = doc(db, 'recipes', recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error('Recipe not found');
      }

      if (recipeDoc.data().userId !== user.uid) {
        throw new Error('Not authorized to delete this recipe');
      }

      await deleteDoc(recipeRef);
      return true;
    } catch (error) {
      console.error('Error deleting recipe:', error);
      throw error;
    }
  }

  async getUserRecipes(userId) {
    try {
      const recipesQuery = query(
        collection(db, 'recipes'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(recipesQuery);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting user recipes:', error);
      throw error;
    }
  }

  async searchRecipes(searchTerm, filters = {}) {
    try {
      const result = await this.getRecipes({ filters: { ...filters, search: searchTerm } });
      return result.recipes;
    } catch (error) {
      console.error('Error searching recipes:', error);
      throw error;
    }
  }
}

export const recipeService = new RecipeService();
export default recipeService;