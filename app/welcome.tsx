import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';

export default function Welcome() {
  const router = useRouter();

  // 🔧 ОБРАБОТКА КНОПКИ "НАЗАД" - добавляем этот useEffect
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        router.push('/title'); // Переход на страницу title
        return true;
      }
    );

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('Автоматический переход на login...');
      router.push('/login');
    }, 1000);

    return () => clearTimeout(timer);           
  }, []);

  return (
    <View style={styles.container}>
      {/* Первый контейнер: изображение сверху */}
      <View style={styles.topContainer}>
        <Image
          source={require("@/assets/images/logo-circles.png")}
          style={styles.topImage}
          resizeMode="contain"
        />
      </View>

      {/* Второй контейнер: текст и смайл по центру */}
      <View style={styles.middleContainer}>
        <View style={styles.textWithSmile}>
          <Text style={styles.welcomeText}>
            Добро пожаловать в EatWisely!
          </Text>
          <Image
            source={require("@/assets/images/people-icon.png")}
            style={styles.smileImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C2DAE2',
    paddingHorizontal: 20,
  },
  // Первый контейнер - изображение сверху
  topContainer: {
    flex: 0.15,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 40,
  },
  topImage: {
    width: 280,
    height: 280,
  },
  // Второй контейнер - текст и смайл по центру
  middleContainer: {
    flex: 0.75,
    justifyContent: "center",
    alignItems: "center",
  },
  textWithSmile: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  welcomeText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 28,
    fontWeight: 'normal',
    textAlign: 'center',
    color: '#000',
  },
  smileImage: {
    width: 30,
    height: 30,
    marginLeft: 5,
  },
});