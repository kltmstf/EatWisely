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
  BackHandler,
  Alert,
  ActivityIndicator,
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/app/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons'; 

// Получаем высоту экрана
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function Login() {
  const router = useRouter();
  const { signIn, loading: authLoading, error, clearError, isAuthenticated } = useAuthContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (error) {
      clearError();
    }
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        // Лучше выходить из приложения или ничего не делать,
        // чем пушить на '/' (что может создать цикл)
        return false;
      }
    );
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (error && !authLoading) {
      Alert.alert('Ошибка входа', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, authLoading]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный email');
      return;
    }

    setIsLoading(true);
    clearError();

    try {
      await signIn(email, password);
    } catch (error) {
      console.log('❌ Login failed:', error.message);
      let alertTitle = 'Ошибка входа';
      let alertMessage = error.message;
      const isInvalidCredentials = error.message.includes('Неверный email или пароль');

      if (isInvalidCredentials) {
        alertTitle = 'Неверные данные';
        alertMessage = error.message;
      }
      const alertButtons = [{ text: 'Понятно' }];
      if (isInvalidCredentials) {
        alertButtons.push(
          {
            text: 'Восстановить пароль',
            onPress: () => {
              router.push('/forgot-password');
            }
          },
          {
            text: 'Зарегистрироваться',
            onPress: () => {
              router.push('/registration');
            }
          }
        );
      }
      Alert.alert(alertTitle, alertMessage, alertButtons);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const handleSignUpRedirect = () => {
    router.push('/registration');
  };

  const isLoginDisabled = isLoading || authLoading || !email.trim() || !password.trim();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // bounces={false} предотвращает "прыжки" на iOS
        bounces={false}
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
          <View style={styles.inputContainer}>
            <View style={styles.inputWithIcon}>
              
              <Ionicons name="mail-outline" size={20} color="black" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading && !authLoading}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.inputWithIcon}>
             
              <Ionicons name="lock-closed-outline" size={20} color="black" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Пароль"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!isLoading && !authLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                disabled={isLoading || authLoading}
              >
                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} 
                size={20} color="black" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              isLoginDisabled && styles.loginButtonDisabled
            ]}
            onPress={handleLogin}
            disabled={isLoginDisabled}
          >
            {isLoading || authLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Войти</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Еще нет аккаунта? </Text>
            <TouchableOpacity onPress={handleSignUpRedirect}>
              <Text style={styles.signUpLink}>Зарегистрируйтесь</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Третий контейнер: восстановление пароля */}
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={handleForgotPassword}
            disabled={isLoading || authLoading}
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
    
    // Устанавливаем минимальную высоту равную высоте экрана.
    // Это заставляет flex-контейнеры внутри ScrollView работать корректно.
    minHeight: SCREEN_HEIGHT,
    justifyContent: 'space-between' // Распределяем контент
  },
  headerContainer: {
    // Используем height в % или фиксированные значения вместо flex внутри ScrollView,
    // либо flex работает только благодаря minHeight у родителя
    flex: 0.35,
    justifyContent: "center",
    alignItems: 'center',
    paddingTop: 40, 
    paddingBottom: 20,
  },
  headerImage: {
    width: 250,
    height: 250,
  },
  headerTextContainer: {
    alignItems: 'center',
    marginTop: 10,
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
  formContainer: {
    flex: 0.45,
    justifyContent: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C2DAE2',
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 15,
    // Фиксированная высота для стабильности
    height: 60,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    height: '100%', // Занимает всю высоту контейнера
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
    marginTop: 15,
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
  loginButtonDisabled: {
    backgroundColor: '#B8D48A',
    opacity: 0.7,
  },
  loginButtonText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    fontWeight: 'normal',
    color: 'black',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  signUpText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 14,
    color: '#000',
  },
  signUpLink: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 14,
    color: '#001226',
    textDecorationLine: 'underline',
  },
  footerContainer: {
    flex: 0.2,
    alignItems: 'center',
    justifyContent: 'flex-end', // Выравнивание по центру по вертикали
    paddingBottom: 0,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    padding: 10,
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
    textDecorationLine: 'underline',
  },
  eyeButton: {
    padding: 8,
  },
});