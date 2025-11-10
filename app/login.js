import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  BackHandler
} from 'react-native';
import { useRouter } from 'expo-router';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {

        router.push('/title');
        return true;
      }
    );

    return () => backHandler.remove();
  }, []);

  const handleLogin = () => {

    console.log('Email:', email, 'Password:', password);
    

    router.push('/home');
  };


  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Первый контейнер: изображение и текст */}
        <View style={styles.headerContainer}>
          <Image
            source={require("@/assets/images/logo-circles.png")}
            style={styles.headerImage}
            resizeMode="contain"
          />
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Добро пожаловать в EatWisely!</Text>
            <Text style={styles.subtitle}>
              Войдите, чтобы получить персонализированный рацион на неделю.
            </Text>
          </View>
        </View>

        {/* Второй контейнер: форма ввода данных */}
        <View style={styles.formContainer}>
          {/* Поле Email с иконкой */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWithIcon}>
              <Image
                source={require("@/assets/images/email-icon.png")}
                style={styles.inputIcon}
                resizeMode="contain"
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Поле Пароль с иконкой */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWithIcon}>
              <Image
                source={require("@/assets/images/password-icon.png")}
                style={styles.inputIcon}
                resizeMode="contain"
              />
              <TextInput
                style={styles.input}
                placeholder="Пароль"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {/* Кнопка входа */}
          <TouchableOpacity 
            style={styles.loginButton}
            onPress={handleLogin}
          >
            <Text style={styles.loginButtonText}>Войти</Text>
          </TouchableOpacity>
        </View>

        {/* Третий контейнер: восстановление пароля - ВСЯ НАДПИСЬ КЛИКАБЕЛЬНА */}
        <View style={styles.footerContainer}>
          <TouchableOpacity 
            style={styles.forgotPasswordContainer}
            onPress={handleForgotPassword}
          >
            <Text style={styles.link}>Забыли пароль?</Text>
            <Text style={styles.recoveryText}>Восстановите его здесь.</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C2DAE2',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20, 
  },
  // Первый контейнер - изображение и текст
  headerContainer: {
    flex: 0.35, // Уменьшили для компактности
    justifyContent: "center",
    alignItems: 'center',
    paddingTop: 20, // Уменьшили отступ сверху
    paddingBottom: 20,
  },
  headerImage: {
    width: 280, // Немного уменьшили
    height: 280,
  },
  headerTextContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  title: {
    fontFamily: 'Playfair Display Bold',
    fontSize: 20,
    fontWeight: 'normal',
    color: '#000',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 16,
    color: '#000',
    lineHeight: 20,
    textAlign: 'center',
  },
  // Второй контейнер - форма ввода данных
  formContainer: {
    flex: 0.45, // Увеличили для формы
    justifyContent: 'center',
    marginBottom: 60, // Уменьшили отступ
  },
  inputContainer: {
    marginBottom: 20, // Уменьшили отступ между полями
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C2DAE2',
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  inputIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#000',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 12,
    fontFamily: 'Playfair Display Regular',
  },
  loginButton: {
    backgroundColor: '#9BDF11',
    borderRadius: 75,
    paddingVertical: 15,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15, // Уменьшили отступ
    borderWidth: 2,
    borderColor: '#C2DAE2', 
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    alignSelf: 'center',
  },
  loginButtonText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    fontWeight: 'normal',
    color: 'black',
  },
  // Третий контейнер - восстановление пароля
  footerContainer: {
    flex: 0.2, // Минимальное пространство
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    padding: 10, // Добавляем padding для удобства нажатия
  },
  link: {
    fontFamily: 'Playfair Display Regular',
    color: '#001226',
    fontSize: 16,
    fontWeight: 'normal',
    marginBottom: 0,
    textAlign: 'center',
  },
  recoveryText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 14,
    color: '#001226',
    textAlign: 'center',
    
  },
});