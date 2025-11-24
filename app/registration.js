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
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/app/contexts/AuthContext';

export default function Registration() {
  const router = useRouter();
  const { signUp, loading: authLoading, error, clearError } = useAuthContext();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Очистка ошибки при первом рендере
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, []);

  // Отображение ошибки
  useEffect(() => {
    if (error && !authLoading) {
      Alert.alert('Ошибка регистрации', error, [{ text: 'OK' }]);
    }
  }, [error, authLoading]);

  const handleSignUp = async () => {
    // Валидация
    if (!email.trim() || !password.trim() || !firstName.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все обязательные поля');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    // Проверка длины и сложности пароля
    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 6 символов');
      return;
    }

    // Проверка на сложность (заглавная буква и цифра)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).+$/;
    if (!passwordRegex.test(password)) {
      Alert.alert('Ошибка', 'Пароль должен содержать хотя бы одну заглавную букву (A-Z) и одну цифру (0-9).');
      return;
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный email');
      return;
    }

    setIsLoading(true);

    try {
      await signUp(email, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
      Alert.alert('Успешно', 'Регистрация прошла успешно!', [
        {
          text: 'Продолжить',
          onPress: () => router.push('/profile-setup')
        }
      ]);
    } catch (error) {
      console.error('Registration error:', error);
      // Ошибка будет отображена через useEffect
    } finally {
      setIsLoading(false);
    }
  };

  const isSignUpDisabled = isLoading || authLoading ||
    !email.trim() || !password.trim() || !firstName.trim() ||
    password !== confirmPassword;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Image
            source={require("@/assets/images/logo-circles.png")}
            style={styles.headerImage}
            resizeMode="contain"
          />
          <Text style={styles.title}>Создайте аккаунт</Text>
          <Text style={styles.subtitle}>Присоединяйтесь к сообществу EatWisely</Text>
        </View>

        <View style={styles.formContainer}>
          {/* Имя и Фамилия */}
          <View style={styles.rowContainer}>
            <View style={[styles.inputWrapper, styles.halfInput]}>
              <TextInput
                style={styles.input}
                placeholder="Имя *"
                placeholderTextColor="#666"
                value={firstName}
                onChangeText={setFirstName}
                editable={!isLoading && !authLoading}
              />
            </View>
            <View style={[styles.inputWrapper, styles.halfInput]}>
              <TextInput
                style={styles.input}
                placeholder="Фамилия"
                placeholderTextColor="#666"
                value={lastName}
                onChangeText={setLastName}
                editable={!isLoading && !authLoading}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Email *"
                placeholderTextColor="#666"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading && !authLoading}
              />
            </View>
          </View>

          {/* Пароль */}
          <View style={styles.inputContainer}>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, paddingHorizontal: 0 }]}
                placeholder="Пароль *"
                placeholderTextColor="#666"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!isLoading && !authLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>
                  {showPassword ? '🙈' : '👁️'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.passwordHint}>
              Пароль: 6+ символов, 1 заглавная буква, 1 цифра.
            </Text>
          </View>

          {/* Подтверждение пароля */}
          <View style={styles.inputContainer}>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { flex: 1, paddingHorizontal: 0 }]}
                placeholder="Подтвердите пароль *"
                placeholderTextColor="#666"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                editable={!isLoading && !authLoading}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <Text style={styles.eyeText}>
                  {showConfirmPassword ? '🙈' : '👁️'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Кнопка регистрации */}
          <TouchableOpacity
            style={[
              styles.signUpButton,
              isSignUpDisabled && styles.signUpButtonDisabled
            ]}
            onPress={handleSignUp}
            disabled={isSignUpDisabled}
          >
            {isLoading || authLoading ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.signUpButtonText}>Зарегистрироваться</Text>
            )}
          </TouchableOpacity>

          {/* Ссылка на вход */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Уже есть аккаунт? </Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.loginLink}>Войдите</Text>
            </TouchableOpacity>
          </View>
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
    // Уменьшен paddingBottom для более плотного контента
    paddingBottom: 40,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
  },
  headerImage: {
    // Немного уменьшен размер изображения
    width: 150,
    height: 150,
    marginBottom: 15,
  },
  title: {
    fontFamily: 'Playfair Display Bold',
    fontSize: 28, // Слегка увеличен для акцента
    color: '#000',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
  },
  formContainer: {
    flex: 1,
  },
  rowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  inputContainer: {
    marginBottom: 15,
    // Контейнер для Input + Hint
  },
  halfInput: {
    flex: 0.48,
  },

  // Стиль-обертка для TextInput (Имя, Фамилия, Email)
  inputWrapper: {
    backgroundColor: '#C2DAE2',
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 20,
    paddingVertical: 0, // Установлено 0, так как paddingVertical задается в input
    height: 60, // Фиксированная высота для единообразия
    justifyContent: 'center',
  },

  input: {
    // Общие стили для всех TextInput, без границ и фона
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontFamily: 'Playfair Display Regular',
    paddingVertical: 15, // Вертикальный padding определяет высоту текста
    paddingHorizontal: 0, // Горизонтальный padding задан в inputWrapper
  },

  // Специальный контейнер для пароля (с иконкой)
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C2DAE2',
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 20,
    height: 60, // Фиксированная высота для единообразия
  },
  eyeButton: {
    paddingLeft: 10,
    paddingVertical: 5,
    // Отцентровать иконку по высоте
    height: '100%',
    justifyContent: 'center',
  },
  eyeText: {
    fontSize: 20,
  },
  // Стиль для подсказки к паролю
  passwordHint: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 12,
    color: '#333',
    marginTop: 5,
    marginLeft: 20, // Сдвиг, чтобы не сливаться с границей
  },
  signUpButton: {
    backgroundColor: '#9BDF11',
    borderRadius: 75,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30, // Увеличенный отступ
    borderWidth: 2,
    borderColor: '#C2DAE2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  signUpButtonDisabled: {
    backgroundColor: '#B8D48A',
    opacity: 0.7,
  },
  signUpButtonText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    color: 'black',
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
  },
  loginText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 14,
    color: '#000',
  },
  loginLink: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 14,
    color: '#001226',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});