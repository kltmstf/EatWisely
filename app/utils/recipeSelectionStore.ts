// app/utils/recipeSelectionStore.ts
interface SelectedRecipe {
  id: string;
  title: string;
  description: string;
  calories?: number;
  cookingTime?: number;
  ingredientsText: string;
  difficultyLevel?: string;
  imageUrl?: string;
  mealType: string;
  proteins?: number;
  fats?: number;
  carbohydrates?: number;
  weight?: string;
}

interface RecipeSelection {
  recipe: SelectedRecipe;
  category: string;
  selectedDayIndex: number;
  timestamp: number;
}

class RecipeSelectionStore {
  private selection: RecipeSelection | null = null;
  private subscribers: Array<(selection: RecipeSelection | null) => void> = [];

  selectRecipe(recipe: SelectedRecipe, category: string = 'Обед', selectedDayIndex: number = 0) {
    this.selection = {
      recipe,
      category,
      selectedDayIndex,
      timestamp: Date.now()
    };
    this.notifySubscribers();
  }

  getSelection(): RecipeSelection | null {
    return this.selection;
  }

  clearSelection() {
    this.selection = null;
    this.notifySubscribers();
  }

  subscribe(callback: (selection: RecipeSelection | null) => void) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.selection));
  }
}

export const recipeSelectionStore = new RecipeSelectionStore();