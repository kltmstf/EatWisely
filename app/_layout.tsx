// app/_layout.tsx
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../app/contexts/AuthContext';
import AuthInitializer from '../app/components/AuthInitializer';

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
          <Stack screenOptions={{ headerShown: false }}>
            {/* Страницы без нижней навигации */}
            <Stack.Screen name="index" />
            <Stack.Screen name="title" />
            <Stack.Screen name="welcome" />
            <Stack.Screen name="login" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name='registration'/>
            
            {/* Основные страницы с нижней навигацией - без заголовка и кнопки назад */}
            <Stack.Screen 
              name="(tabs)" 
              options={{ 
                headerShown: false,
                // Отключаем жесты для назад на iOS
                gestureEnabled: false 
              }} 
            />
            
            {/* Остальные страницы */}
            <Stack.Screen name="meal" />
            <Stack.Screen name="profile-settings" />
            <Stack.Screen name="help-support" />
          </Stack>
        </AuthInitializer>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}