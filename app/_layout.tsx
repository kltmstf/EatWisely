import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// ДОБАВИЛИ ИМПОРТ НИЖЕ:
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AuthProvider } from '../app/contexts/AuthContext';
import AuthInitializer from '../app/components/AuthInitializer';
import { FavoritesProvider } from '../app/hooks/useFavorites'; 

// Импортируем конфигурацию Firebase
import '../app/firebase/config';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    'Playfair Display Regular': require('@/assets/fonts/PlayfairDisplay.ttf'),
    'Playfair Display Italic': require('@/assets/fonts/PlayfairDisplay-Italic.ttf'),
    'Playfair Display Bold': require('@/assets/fonts/PlayfairDisplay-Bold.ttf'),
    'Playfair Display BoldItalic': require('@/assets/fonts/PlayfairDisplay-BoldItalic.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AuthInitializer>
          <FavoritesProvider>
            
            {/* 1. ДОБАВИЛИ ПРОВАЙДЕР СВЕРХУ */}
            <SafeAreaProvider>
              {/* 2. ДОБАВИЛИ VIEW, КОТОРЫЙ ОТЖИМАЕТ МЕСТО У ШТОРКИ И КНОПОК */}
              {/* Замени #ffffff на основной цвет фона твоего приложения, если он темный */}
              <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }} edges={['top', 'bottom']}>
                
                <Stack screenOptions={{ headerShown: false }}>
                  {/* Страницы без нижней навигации */}
                  <Stack.Screen name="index" />
                  <Stack.Screen name="title" />
                  <Stack.Screen name="welcome" />
                  <Stack.Screen name="login" />
                  <Stack.Screen name="forgot-password" />
                  <Stack.Screen name='registration'/>
                  
                  {/* Основные страницы с нижней навигацией */}
                  <Stack.Screen 
                    name="(tabs)" 
                    options={{ 
                      headerShown: false,
                      gestureEnabled: false 
                    }} 
                  />
                  
                  {/* Остальные страницы */}
                  <Stack.Screen name="favorites"/>
                  <Stack.Screen name="meal" />
                  <Stack.Screen name="profile-settings" />
                  <Stack.Screen name="help-support" />
                  <Stack.Screen name="create-recipe"/>
                </Stack>

              </SafeAreaView>
            </SafeAreaProvider>

          </FavoritesProvider> 
        </AuthInitializer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}