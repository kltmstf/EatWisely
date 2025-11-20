// app/registration.js
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

  useEffect(() => {
    if (error) {
      clearError();
    }
  }, []);

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

    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 6 символов');
      return;
    }

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
            <View style={[styles.inputContainer, styles.halfInput]}>
              <TextInput
                style={styles.input}
                placeholder="Имя *"
                placeholderTextColor="#666"
                value={firstName}
                onChangeText={setFirstName}
                editable={!isLoading && !authLoading}
              />
            </View>
            <View style={[styles.inputContainer, styles.halfInput]}>
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

          {/* Пароль */}
          <View style={styles.inputContainer}>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.input}
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
          </View>

          {/* Подтверждение пароля */}
          <View style={styles.inputContainer}>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.input}
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
    paddingBottom: 20,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 30,
  },
  headerImage: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Playfair Display Bold',
    fontSize: 24,
    color: '#000',
    marginBottom: 10,
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
  },
  halfInput: {
    flex: 0.48,
  },
  input: {
    backgroundColor: '#C2DAE2',
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 16,
    color: '#000',
    fontFamily: 'Playfair Display Regular',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C2DAE2',
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 20,
  },
  eyeButton: {
    padding: 5,
  },
  eyeText: {
    fontSize: 16,
  },
  signUpButton: {
    backgroundColor: '#9BDF11',
    borderRadius: 75,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
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
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
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
  },
});