// app/debug.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator, 
  ScrollView, 
  Alert 
} from 'react-native';
import { auth, db } from '@/app/firebase/config';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

// Импортируйте массивы из ваших файлов
import { RECIPES } from './scripts/recipesFill';
import { COMMUNITY_POSTS, CommunityPost } from './scripts/communityPostsFill';

export default function Debug() {
  const [loading, setLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<'recipes' | 'community' | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentItem: '' });
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev, `${timestamp} ${isError ? '❌' : '✅'} ${message}`]);
  };

  // Заполнение рецептов
  const populateRecipes = async () => {
    if (loading) return;
    
    setLoading(true);
    setCurrentAction('recipes');
    setProgress({ current: 0, total: RECIPES.length, currentItem: '' });
    setLog([]);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Ошибка', 'Пользователь не авторизован. Войдите в аккаунт.');
        addLog('Пользователь не авторизован', true);
        setLoading(false);
        return;
      }
      
      addLog(`Авторизован: ${user.email} (${user.uid})`);
      addLog(`Начинаем загрузку ${RECIPES.length} рецептов...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < RECIPES.length; i++) {
        const recipe = RECIPES[i];
        setProgress({
          current: i + 1,
          total: RECIPES.length,
          currentItem: recipe.title
        });
        
        try {
          const caloriesPerGram = recipe.nutritionPer100g.calories / 100;
          
          const recipeData = {
            ...recipe,
            userId: user.uid,
            caloriesPerGram,
            likesCount: 0,
            savesCount: 0,
            averageRating: 0,
            ratingsCount: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          
          await addDoc(collection(db, "recipes"), recipeData);
          successCount++;
          addLog(`[${i+1}/${RECIPES.length}] ${recipe.title}`);
          
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          errorCount++;
          addLog(`Ошибка: ${recipe.title} - ${error}`, true);
        }
      }
      
      addLog(`\n📊 ЗАВЕРШЕНО! Успешно: ${successCount}, Ошибок: ${errorCount}, Всего: ${RECIPES.length}`);
      Alert.alert(
        'Готово!',
        `Добавлено рецептов: ${successCount}\nОшибок: ${errorCount}\nВсего: ${RECIPES.length}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Fatal error:', error);
      addLog(`Критическая ошибка: ${error}`, true);
      Alert.alert('Ошибка', 'Произошла ошибка при выполнении скрипта');
    } finally {
      setLoading(false);
      setCurrentAction(null);
    }
  };

  // Заполнение постов сообщества
  const populateCommunity = async () => {
    if (loading) return;
    
    setLoading(true);
    setCurrentAction('community');
    setProgress({ current: 0, total: COMMUNITY_POSTS.length, currentItem: '' });
    setLog([]);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Ошибка', 'Пользователь не авторизован. Войдите в аккаунт.');
        addLog('Пользователь не авторизован', true);
        setLoading(false);
        return;
      }
      
      addLog(`Авторизован: ${user.email} (${user.uid})`);
      addLog(`Начинаем загрузку ${COMMUNITY_POSTS.length} постов...`);
      
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < COMMUNITY_POSTS.length; i++) {
        const post = COMMUNITY_POSTS[i];
        setProgress({
          current: i + 1,
          total: COMMUNITY_POSTS.length,
          currentItem: post.title.substring(0, 50)
        });
        
        try {
          const postData = {
            title: post.title,
            content: post.content,
            postType: post.postType,
            tags: post.tags,
            images: post.images,
            userId: user.uid,
            userName: user.displayName || user.email?.split('@')[0] || 'Пользователь',
            likesCount: 0,
            commentsCount: 0,
            likedBy: [],
            isPublic: true,
            verified: false,
            recipeId: null,
            rationPlanId: null,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          };
          
          await addDoc(collection(db, "community_posts"), postData);
          successCount++;
          addLog(`[${i+1}/${COMMUNITY_POSTS.length}] ${post.title.substring(0, 50)}...`);
          
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          errorCount++;
          addLog(`Ошибка: ${post.title} - ${error}`, true);
        }
      }
      
      addLog(`\n📊 ЗАВЕРШЕНО! Успешно: ${successCount}, Ошибок: ${errorCount}, Всего: ${COMMUNITY_POSTS.length}`);
      
      // Статистика по типам постов
      const postTypes: Record<string, number> = {};
      COMMUNITY_POSTS.forEach((post: CommunityPost) => {
        postTypes[post.postType] = (postTypes[post.postType] || 0) + 1;
      });
      
      let statsMessage = `Добавлено постов: ${successCount}\nОшибок: ${errorCount}\n\nПо типам:\n`;
      Object.entries(postTypes).forEach(([type, count]) => {
        statsMessage += `${type}: ${count}\n`;
      });
      
      Alert.alert('Готово!', statsMessage, [{ text: 'OK' }]);
    } catch (error) {
      console.error('Fatal error:', error);
      addLog(`Критическая ошибка: ${error}`, true);
      Alert.alert('Ошибка', 'Произошла ошибка при выполнении скрипта');
    } finally {
      setLoading(false);
      setCurrentAction(null);
    }
  };

  const clearLogs = () => {
    setLog([]);
  };

  // Подсчет количества постов по типам для отображения
  const getPostTypeStats = (): Record<string, number> => {
    const stats: Record<string, number> = {};
    COMMUNITY_POSTS.forEach((post: CommunityPost) => {
      stats[post.postType] = (stats[post.postType] || 0) + 1;
    });
    return stats;
  };

  const postStats = getPostTypeStats();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          🛠️ Debug Panel
        </Text>
        
        {/* Кнопка заполнения рецептов */}
        <TouchableOpacity
          onPress={populateRecipes}
          disabled={loading}
          style={{
            backgroundColor: loading && currentAction === 'recipes' ? '#ccc' : '#4CAF50',
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 10,
            marginBottom: 15,
            width: '100%',
            alignItems: 'center',
          }}
        >
          {loading && currentAction === 'recipes' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="white" style={{ marginRight: 10 }} />
              <Text style={{ color: 'white', fontSize: 16 }}>Загрузка...</Text>
            </View>
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              🍳 Заполнить БД рецептами ({RECIPES.length} шт.)
            </Text>
          )}
        </TouchableOpacity>
        
        {/* Кнопка заполнения постов сообщества */}
        <TouchableOpacity
          onPress={populateCommunity}
          disabled={loading}
          style={{
            backgroundColor: loading && currentAction === 'community' ? '#ccc' : '#2196F3',
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 10,
            marginBottom: 20,
            width: '100%',
            alignItems: 'center',
          }}
        >
          {loading && currentAction === 'community' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="white" style={{ marginRight: 10 }} />
              <Text style={{ color: 'white', fontSize: 16 }}>Загрузка...</Text>
            </View>
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>
              💬 Заполнить БД постами ({COMMUNITY_POSTS.length} шт.)
            </Text>
          )}
        </TouchableOpacity>
        
        {/* Прогресс бар */}
        {loading && progress.total > 0 && (
          <View style={{ width: '100%', marginBottom: 20 }}>
            <View style={{ 
              backgroundColor: '#ddd', 
              borderRadius: 10, 
              height: 20, 
              overflow: 'hidden' 
            }}>
              <View style={{ 
                width: `${(progress.current / progress.total) * 100}%`, 
                backgroundColor: currentAction === 'recipes' ? '#4CAF50' : '#2196F3', 
                height: 20 
              }} />
            </View>
            <Text style={{ marginTop: 5, textAlign: 'center' }}>
              {progress.current} / {progress.total} - {progress.currentItem}
            </Text>
          </View>
        )}
        
        {/* Кнопка очистки логов */}
        {log.length > 0 && (
          <TouchableOpacity
            onPress={clearLogs}
            style={{
              backgroundColor: '#ff6b6b',
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 8,
              marginBottom: 10,
              alignSelf: 'flex-end',
            }}
          >
            <Text style={{ color: 'white', fontSize: 12 }}>🗑️ Очистить логи</Text>
          </TouchableOpacity>
        )}
        
        {/* Логи выполнения */}
        {log.length > 0 && (
          <View style={{ 
            width: '100%', 
            backgroundColor: '#1e1e1e', 
            borderRadius: 10, 
            padding: 15,
            marginTop: 10,
          }}>
            <Text style={{ color: '#ddd', fontSize: 12, fontFamily: 'monospace', marginBottom: 10 }}>
              ━━━ ЛОГ ВЫПОЛНЕНИЯ ━━━
            </Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {log.map((entry, index) => (
                <Text key={index} style={{ 
                  color: entry.includes('❌') ? '#ff6b6b' : '#4CAF50', 
                  fontSize: 11, 
                  fontFamily: 'monospace',
                  marginBottom: 3,
                }}>
                  {entry}
                </Text>
              ))}
            </ScrollView>
          </View>
        )}
        
        {/* Информация о пользователе */}
        <View style={{ 
          width: '100%', 
          backgroundColor: 'white', 
          borderRadius: 10, 
          padding: 15,
          marginTop: 20,
          borderWidth: 1,
          borderColor: '#ddd',
        }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>📱 Информация:</Text>
          <Text>👤 Статус: {auth.currentUser ? '✅ Авторизован' : '❌ Не авторизован'}</Text>
          {auth.currentUser && (
            <>
              <Text>📧 Email: {auth.currentUser.email}</Text>
              <Text>🆔 UID: {auth.currentUser.uid}</Text>
              <Text>👋 Имя: {auth.currentUser.displayName || 'Не указано'}</Text>
            </>
          )}
        </View>
        
        {/* Статистика рецептов */}
        <View style={{ 
          width: '100%', 
          backgroundColor: 'white', 
          borderRadius: 10, 
          padding: 15,
          marginTop: 10,
          borderWidth: 1,
          borderColor: '#ddd',
        }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>📊 Статистика рецептов:</Text>
          <Text>🍳 Всего рецептов для загрузки: {RECIPES.length}</Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 5 }}>
            (рецепты из файла scripts/recipesFill.ts)
          </Text>
        </View>
        
        {/* Статистика постов */}
        <View style={{ 
          width: '100%', 
          backgroundColor: 'white', 
          borderRadius: 10, 
          padding: 15,
          marginTop: 10,
          marginBottom: 30,
          borderWidth: 1,
          borderColor: '#ddd',
        }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>💬 Статистика постов:</Text>
          <Text>Всего постов для загрузки: {COMMUNITY_POSTS.length}</Text>
          <View style={{ marginTop: 8 }}>
            {Object.entries(postStats).map(([type, count]) => (
              <Text key={type} style={{ fontSize: 13, marginLeft: 10 }}>
                • {type}: {count}
              </Text>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>
            (посты из файла scripts/communityPostsFill.ts)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}