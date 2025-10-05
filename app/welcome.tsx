import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function Welcome() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('Автоматический переход на login...');
      router.push('/login');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handlePress = () => {
    console.log('Ручной переход на login...');
    router.push('/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>
          Добро пожаловать в EatWisely!
        </Text>
        
        <Text style={styles.subText}>
          ♂
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.button}
        onPress={handlePress}
      >
        <Text style={styles.buttonText}>Продолжить</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#C2DAE2',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
    marginBottom: 50,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#000',
  },
  subText: {
    fontSize: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#9BDF11',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 100,
  },
  buttonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
});