// hooks/useFavorites.js
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { favoriteService } from '../services/favoriteService';
// Исправьте путь в зависимости от вашей структуры
import { useAuth } from '../contexts/AuthContext'; // или '@/app/contexts/AuthContext'

const FavoritesContext = createContext(null);

export const FavoritesProvider = ({ children }) => {
    const [favoriteRecipeIds, setFavoriteRecipeIds] = useState([]);
    const [favoriteRationIds, setFavoriteRationIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Временно убираем useAuth до исправления
    // const { user } = useAuth();
    
    const loadFavorites = useCallback(async () => {
        // Временное решение - проверяем аутентификацию через favoriteService
        setLoading(true);
        setError(null);
        try {
            const allFavorites = await favoriteService.getUserFavorites();

            const recipes = allFavorites
                .filter(fav => fav.favoriteType === 'recipe' && fav.item)
                .map(fav => fav.item.id);

            const rations = allFavorites
                .filter(fav => fav.favoriteType === 'ration' && fav.item)
                .map(fav => fav.item.id);

            setFavoriteRecipeIds(recipes);
            setFavoriteRationIds(rations);

        } catch (err) {
            console.error("Ошибка при загрузке избранного:", err);
            // Игнорируем ошибки аутентификации
            if (!err.message.includes('authenticated') && !err.message.includes('index')) {
                setError(err.message);
            }
        } finally {
            setLoading(false);
        }
    }, []); // Убираем зависимость от user

    useEffect(() => {
        loadFavorites();
    }, [loadFavorites]);

    // Остальной код без изменений...
    const toggleFavorite = useCallback(async (itemId, favoriteType) => {
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
                setFavoriteRecipeIds(prev => isCurrentlyFavorite ? prev.filter(id => id !== itemId) : [...prev, itemId]);
            } else {
                setFavoriteRationIds(prev => isCurrentlyFavorite ? prev.filter(id => id !== itemId) : [...prev, itemId]);
            }

        } catch (err) {
            console.error(`Ошибка при переключении избранного (${favoriteType}):`, err);
            setError(err.message);
            throw err;
        }
    }, [favoriteRecipeIds, favoriteRationIds]);

    const isFavorite = useCallback((itemId, favoriteType) => {
        if (favoriteType === 'recipe') {
            return favoriteRecipeIds.includes(itemId);
        }
        return favoriteRationIds.includes(itemId);
    }, [favoriteRecipeIds, favoriteRationIds]);

    const contextValue = {
        favoriteRecipeIds,
        favoriteRationIds,
        loading,
        error,
        isFavorite,
        toggleFavorite,
        loadFavorites
    };

    return (
        <FavoritesContext.Provider value={contextValue}>
            {children}
        </FavoritesContext.Provider>
    );
};

export const useFavorites = () => {
    const context = useContext(FavoritesContext);
    if (!context) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
};