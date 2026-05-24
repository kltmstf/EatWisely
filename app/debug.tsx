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

// Импортируйте RECIPES массив из вашего файла
// Либо вставьте его прямо сюда (я покажу вариант с импортом)
import { RECIPES } from './scripts/recipesFill';

export default function Debug() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentRecipe: '' });
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev, `${timestamp} ${isError ? '❌' : '✅'} ${message}`]);
  };

  const runPopulateScript = async () => {
    if (loading) return;
    
    setLoading(true);
    setProgress({ current: 0, total: RECIPES.length, currentRecipe: '' });
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
          currentRecipe: recipe.title
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
          
          // Небольшая задержка, чтобы не перегружать Firestore
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
    }
  };

  const clearLogs = () => {
    setLog([]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          Debug Page
        </Text>
        
        {/* Кнопка запуска скрипта */}
        <TouchableOpacity
          onPress={runPopulateScript}
          disabled={loading}
          style={{
            backgroundColor: loading ? '#ccc' : '#4CAF50',
            paddingHorizontal: 30,
            paddingVertical: 15,
            borderRadius: 10,
            marginBottom: 20,
            width: '100%',
            alignItems: 'center',
          }}
        >
          {loading ? (
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
                backgroundColor: '#4CAF50', 
                height: 20 
              }} />
            </View>
            <Text style={{ marginTop: 5, textAlign: 'center' }}>
              {progress.current} / {progress.total} - {progress.currentRecipe}
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
            <Text style={{ color: 'white', fontSize: 12 }}>Очистить логи</Text>
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
          <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Информация:</Text>
          <Text>Статус: {auth.currentUser ? '✅ Авторизован' : '❌ Не авторизован'}</Text>
          {auth.currentUser && (
            <>
              <Text>Email: {auth.currentUser.email}</Text>
              <Text>UID: {auth.currentUser.uid}</Text>
            </>
          )}
          <Text>Доступно рецептов: {RECIPES.length}</Text>
        </View>
      </View>
    </ScrollView>
  );
}