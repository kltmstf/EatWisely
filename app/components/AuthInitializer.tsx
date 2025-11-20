// components/AuthInitializer.tsx
import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '../hooks/useAuth';

// Этот компонент обеспечивает правильную инициализацию аутентификации
export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  // Показываем индикатор загрузки пока проверяется статус аутентификации
  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#C2DAE2' 
      }}>
        <ActivityIndicator size="large" color="#9BDF11" />
        <Text style={{ 
          marginTop: 20, 
          fontFamily: 'Playfair Display Regular',
          fontSize: 16,
          color: '#000'
        }}>
          Загрузка...
        </Text>
      </View>
    );
  }

  // Когда загрузка завершена, рендерим детей
  return <>{children}</>;
}