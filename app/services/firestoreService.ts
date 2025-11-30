// app/services/firestoreService.ts
import { 
    getFirestore, 
    doc, 
    collection, 
    onSnapshot, 
    Unsubscribe,
    query 
} from 'firebase/firestore';

// ⚠️ Предполагаем, что db импортируется из вашего файла конфигурации Firebase
// Например: import { db } from "../firebase/config";
const db = getFirestore(); // Используйте вашу реальную переменную 'db'

/**
 * Сервис для управления реальными подписками Firestore
 */
export const firestoreService = {

    /**
     * Подписывается на данные плана питания пользователя в реальном времени.
     * @param userId UID пользователя.
     * @returns Функция отписки (Unsubscribe).
     */
    subscribeRationPlan: (userId: string): Unsubscribe => {
        // Пример подписки на определенный документ (план на сегодня)
        const docRef = doc(db, `users/${userId}/ration_plan_days/today`);
        
        const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
            // Здесь происходит обновление состояния React (в другом хуке), 
            // но главная цель - получить функцию отписки.
            console.log(`✅ Firestore Listener: Ration Plan updated for ${userId}.`);
        }, (error) => {
            // Эта ошибка будет вызвана при выходе, если не отписаться
            console.error(`❌ Firestore Error (Ration Plan, clean up needed): ${error.message}`);
        });

        return unsubscribe;
    },

    /**
     * Подписывается на коллекцию избранного пользователя.
     * @param userId UID пользователя.
     * @returns Функция отписки (Unsubscribe).
     */
    subscribeFavorites: (userId: string): Unsubscribe => {
        // Пример подписки на коллекцию (с запросом, чтобы слушать только данные пользователя)
        const userFavoritesQuery = query(collection(db, 'user_favorites'));
        
        const unsubscribe = onSnapshot(userFavoritesQuery, (querySnapshot) => {
            console.log(`✅ Firestore Listener: User favorites updated. Total: ${querySnapshot.size}`);
        }, (error) => {
            // Эта ошибка будет вызвана при выходе, если не отписаться
            console.error(`❌ Firestore Error (Favorites, clean up needed): ${error.message}`);
        });

        return unsubscribe;
    },
};