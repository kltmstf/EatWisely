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
  startAfter
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';

class RecipeService {
  // Получить все рецепты (публичные + пользователя)
  async getRecipes(filters = {}) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      // Базовый запрос для рецептов пользователя
      let userRecipesQuery = query(
        collection(db, 'recipes'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      // Базовый запрос для публичных рецептов
      let publicRecipesQuery = query(
        collection(db, 'recipes'),
        where('isPublic', '==', true),
        where('userId', '!=', user.uid),
        orderBy('createdAt', 'desc')
      );

      // Применяем фильтры если есть
      if (filters.mealType) {
        userRecipesQuery = query(userRecipesQuery, where('mealType', '==', filters.mealType));
        publicRecipesQuery = query(publicRecipesQuery, where('mealType', '==', filters.mealType));
      }

      if (filters.difficulty) {
        userRecipesQuery = query(userRecipesQuery, where('difficultyLevel', '==', filters.difficulty));
        publicRecipesQuery = query(publicRecipesQuery, where('difficultyLevel', '==', filters.difficulty));
      }

      const [userRecipesSnapshot, publicRecipesSnapshot] = await Promise.all([
        getDocs(userRecipesQuery),
        getDocs(publicRecipesQuery)
      ]);

      const userRecipes = userRecipesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const publicRecipes = publicRecipesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      let allRecipes = [...userRecipes, ...publicRecipes];

      // Фильтрация по поиску если есть
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        allRecipes = allRecipes.filter(recipe => 
          recipe.title.toLowerCase().includes(searchLower) ||
          recipe.description.toLowerCase().includes(searchLower) ||
          recipe.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
          recipe.ingredientsText.toLowerCase().includes(searchLower)
        );
      }

      return allRecipes;
    } catch (error) {
      console.error('Error getting recipes:', error);
      throw error;
    }
  }

  // Получить рецепт по ID
  async getRecipeById(recipeId) {
    try {
      const recipeRef = doc(db, 'recipes', recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error('Recipe not found');
      }

      const recipe = { id: recipeDoc.id, ...recipeDoc.data() };

      // Проверяем права доступа
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

  // Создать рецепт
  async createRecipe(recipeData) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User not authenticated');

      const recipeWithMetadata = {
        ...recipeData,
        userId: user.uid,
        likesCount: 0,
        savesCount: 0,
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

  // Обновить рецепт
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

  // Удалить рецепт
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

  // Получить рецепты пользователя
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

  // Поиск рецептов
  async searchRecipes(searchTerm, filters = {}) {
    try {
      const allRecipes = await this.getRecipes(filters);
      
      if (!searchTerm) return allRecipes;

      const searchLower = searchTerm.toLowerCase();
      return allRecipes.filter(recipe => 
        recipe.title.toLowerCase().includes(searchLower) ||
        recipe.description.toLowerCase().includes(searchLower) ||
        recipe.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        recipe.ingredientsText.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      console.error('Error searching recipes:', error);
      throw error;
    }
  }
}

export const recipeService = new RecipeService();
export default recipeService;