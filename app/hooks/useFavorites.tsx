// app/hooks/useFavorites.tsx
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { favoriteService } from '../services/favoriteService';
import { useAuth } from './useAuth';

// Типы данных (добавьте эти типы)
interface FavoriteItem {
  id: string;
  userId: string;
  favoriteType: 'recipe' | 'ration';
  recipeId?: string;
  rationPlanId?: string;
  createdAt: any;
  item?: {
    id: string;
    name?: string;
    category?: string;
    calories?: number;
    cookingTime?: string;
    image?: string;
    rating?: number;
    difficulty?: string;
    description?: string;
    totalCalories?: number;
    duration?: string;
    mealsCount?: number;
  };
}

interface FavoritesContextType {
  favoriteRecipeIds: string[];
  favoriteRationIds: string[];
  loading: boolean;
  error: string | null;
  isFavorite: (itemId: string, favoriteType: 'recipe' | 'ration') => boolean;
  toggleFavorite: (itemId: string, favoriteType: 'recipe' | 'ration') => Promise<boolean>;
  loadFavorites: () => Promise<void>;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider = ({ children }: { children: React.ReactNode }) => {
    const [favoriteRecipeIds, setFavoriteRecipeIds] = useState<string[]>([]);
    const [favoriteRationIds, setFavoriteRationIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const { user, loading: authLoading } = useAuth();
    
    const loadFavorites = useCallback(async () => {
        if (authLoading) {
            setLoading(true);
            return;
        }

        if (!user) {
            setFavoriteRecipeIds([]);
            setFavoriteRationIds([]);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        
        try {
            // ИСПРАВЛЕНИЕ: Указываем тип для allFavorites
            const allFavorites = await favoriteService.getUserFavorites() as FavoriteItem[];

            const recipes = allFavorites
                .filter((fav: FavoriteItem) => fav.favoriteType === 'recipe' && fav.item)
                .map((fav: FavoriteItem) => fav.item!.id);

            const rations = allFavorites
                .filter((fav: FavoriteItem) => fav.favoriteType === 'ration' && fav.item)
                .map((fav: FavoriteItem) => fav.item!.id);

            setFavoriteRecipeIds(recipes);
            setFavoriteRationIds(rations);

        } catch (err: any) {
            console.error("Ошибка при загрузке избранного:", err);
            if (err.message.includes('authenticated') || err.message.includes('index')) {
                setFavoriteRecipeIds([]);
                setFavoriteRationIds([]);
                setError(null);
                console.log("👤 Загрузка избранного пропущена (не залогинен).");
                return;
            }
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [user, authLoading]);

    useEffect(() => {
        loadFavorites();
    }, [user, authLoading, loadFavorites]);

    const toggleFavorite = useCallback(async (itemId: string, favoriteType: 'recipe' | 'ration') => {
        if (!user) {
            throw new Error("Для добавления в избранное необходимо войти в систему.");
        }

        try {
            const isCurrentlyFavorite = favoriteType === 'recipe'
                ? favoriteRecipeIds.includes(itemId)
                : favoriteRationIds.includes(itemId);

            if (isCurrentlyFavorite) {
                await favoriteService.removeFromFavorites(itemId, favoriteType);
            } else {
                await favoriteService.addToFavorites(itemId, favoriteType);
            }

            if (favoriteType === 'recipe') {
                setFavoriteRecipeIds(prev => 
                    isCurrentlyFavorite 
                        ? prev.filter(id => id !== itemId) 
                        : [...prev, itemId]
                );
            } else {
                setFavoriteRationIds(prev => 
                    isCurrentlyFavorite 
                        ? prev.filter(id => id !== itemId) 
                        : [...prev, itemId]
                );
            }

            return !isCurrentlyFavorite;
        } catch (err: any) {
            console.error(`Ошибка при переключении избранного (${favoriteType}):`, err);
            setError(err.message);
            throw err;
        }
    }, [favoriteRecipeIds, favoriteRationIds, user]);

    const isFavorite = useCallback((itemId: string, favoriteType: 'recipe' | 'ration') => {
        if (favoriteType === 'recipe') {
            return favoriteRecipeIds.includes(itemId);
        }
        return favoriteRationIds.includes(itemId);
    }, [favoriteRecipeIds, favoriteRationIds]);

    const contextValue: FavoritesContextType = {
        favoriteRecipeIds,
        favoriteRationIds,
        loading,
        error,
        isFavorite,
        toggleFavorite,
        loadFavorites,
        refresh: loadFavorites
    };

    return (
        <FavoritesContext.Provider value={contextValue}>
            {children}
        </FavoritesContext.Provider>
    );
};

export const useFavorites = (): FavoritesContextType => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
};