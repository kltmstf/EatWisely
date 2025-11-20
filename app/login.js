// app/login.js
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
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/app//contexts/AuthContext';

export default function Login() {
  const router = useRouter();
  const { signIn, loading: authLoading, error, clearError, isAuthenticated } = useAuthContext();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Редирект если уже авторизован
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/home');
    }
  }, [isAuthenticated]);

  // Очищаем ошибки при монтировании компонента
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        router.push('/');
        return true;
      }
    );

    return () => backHandler.remove();
  }, []);

  // Показываем ошибки
  useEffect(() => {
    if (error && !authLoading) {
      Alert.alert('Ошибка входа', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error, authLoading]);

  const handleLogin = async () => {
  // Валидация полей
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
  clearError(); // Очищаем предыдущие ошибки

  try {
    console.log('🔄 Attempting login for:', email);
    await signIn(email, password);
    console.log('✅ Login successful');
    
  } catch (error) {
    console.log('❌ Login failed:', error.message);
    console.log('🔍 Full error:', error);
    
    let alertTitle = 'Ошибка входа';
    let alertMessage = error.message;
    
    // Улучшенная обработка ошибок
    if (error.message.includes('Неверный email или пароль') || 
        error.message.includes('Неверный пароль') || 
        error.message.includes('Пользователь не найден')) {
      alertTitle = 'Неверные данные';
      alertMessage = 'Неверный email или пароль.\n\nПроверьте:\n• Правильность email адреса\n• Правильность пароля\n• Регистр букв\n• Язык раскладки клавиатуры';
    }
    
    const alertButtons = [{ text: 'Понятно' }];
    
    // Добавляем полезные кнопки
    if (error.message.includes('Неверный email или пароль') || 
        error.message.includes('Неверный пароль') || 
        error.message.includes('Пользователь не найден')) {
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

  // Блокируем кнопку если идет загрузка или поля пустые
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
                autoComplete="email"
                editable={!isLoading && !authLoading}
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
                secureTextEntry={!showPassword}
                autoComplete="password"
                editable={!isLoading && !authLoading}
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                disabled={isLoading || authLoading}
              >
                <Text style={styles.eyeText}>
                  {showPassword ? '🙈' : '👁️'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Кнопка входа */}
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

          {/* Ссылка на регистрацию */}
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
  },
  // Первый контейнер - изображение и текст
  headerContainer: {
    flex: 0.35,
    justifyContent: "center",
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerImage: {
    width: 280,
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
    flex: 0.45,
    justifyContent: 'center',
    marginBottom: 60,
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
  // Ссылка на регистрацию
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
  // Третий контейнер - восстановление пароля
  footerContainer: {
    flex: 0.2,
    alignItems: 'center',
    justifyContent: 'flex-start',
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
  },
  eyeButton: {
    padding: 8,
    marginLeft: 8,
  },
  eyeIcon: {
    width: 20,
    height: 20,
    tintColor: '#000',
  },
});