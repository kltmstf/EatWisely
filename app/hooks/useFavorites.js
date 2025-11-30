// hooks/useFavorites.js
import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { favoriteService } from '../services/favoriteService';
// 👇 Убедитесь, что путь к useAuth верен относительно этого файла
import { useAuth } from '../hooks/useAuth'; 

const FavoritesContext = createContext(null);

export const FavoritesProvider = ({ children }) => {
    const [favoriteRecipeIds, setFavoriteRecipeIds] = useState([]);
    const [favoriteRationIds, setFavoriteRationIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // 👇 Получаем статус пользователя и статус загрузки аутентификации
    const { user, loading: authLoading } = useAuth();
    
    // Функция для загрузки избранного
    const loadFavorites = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Этот вызов должен быть защищен в useEffect, 
            // но мы ловим ошибку на случай, если кто-то вызовет loadFavorites вручную
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
            // 👇 ИСПРАВЛЕНИЕ: Игнорируем ошибку, если пользователь не аутентифицирован
            if (err.message.includes('authenticated') || err.message.includes('index')) {
                setFavoriteRecipeIds([]);
                setFavoriteRationIds([]);
                setError(null);
                console.log("👤 Загрузка избранного пропущена (не залогинен).");
                return;
            }
            // Устанавливаем ошибку для других, не связанных с аутентификацией проблем
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []); 

    // 👇 ИСПРАВЛЕНИЕ: Запускаем loadFavorites условно
    useEffect(() => {
        // 1. Если загрузка аутентификации еще идет, ждем
        if (authLoading) {
            setLoading(true);
            return;
        }

        // 2. Если пользователь вошел в систему, загружаем
        if (user) {
            loadFavorites();
        } else {
            // 3. Если пользователь не вошел в систему, сбрасываем и завершаем загрузку
            setFavoriteRecipeIds([]);
            setFavoriteRationIds([]);
            setLoading(false);
            setError(null);
        }

    }, [user, authLoading, loadFavorites]); // Реагируем на изменение user и authLoading

    // Остальной код toggleFavorite и isFavorite остается прежним
    const toggleFavorite = useCallback(async (itemId, favoriteType) => {
        // ... (логика toggleFavorite)
        if (!user) {
            // Дополнительная проверка на user, если вызов идет из UI
            alert("Для добавления в избранное необходимо войти в систему.");
            return;
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
                setFavoriteRecipeIds(prev => isCurrentlyFavorite ? prev.filter(id => id !== itemId) : [...prev, itemId]);
            } else {
                setFavoriteRationIds(prev => isCurrentlyFavorite ? prev.filter(id => id !== itemId) : [...prev, itemId]);
            }

        } catch (err) {
            console.error(`Ошибка при переключении избранного (${favoriteType}):`, err);
            setError(err.message);
            throw err;
        }
    }, [favoriteRecipeIds, favoriteRationIds, user]); // Добавлена зависимость user

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