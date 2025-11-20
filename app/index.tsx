// app/index.js
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/app/contexts/AuthContext'; // Исправлен путь

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuthContext();

  // Автоматический редирект если пользователь уже авторизован
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated, loading]);

  // Показываем индикатор загрузки при проверке авторизации
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#9BDF11" />
        <Text style={styles.loadingText}>Проверка авторизации...</Text>
      </View>
    );
  }

  // Если не авторизован, переходим на страницу title
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/title');
    }
  }, [loading, isAuthenticated]);

  // Показываем временный экран пока идет редирект
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#9BDF11" />
      <Text style={styles.loadingText}>Загрузка...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C2DAE2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 16,
    color: '#000',
    marginTop: 20,
  },
});