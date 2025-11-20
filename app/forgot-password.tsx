import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity,
  Platform,
  Image,
  BackHandler,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '@/app//services/authService';

// Определяем тип для ошибки Firebase
interface FirebaseError extends Error {
  code: string;
  message: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        router.back();
        return true;
      }
    );

    return () => backHandler.remove();
  }, [router]);

  const handleResetPassword = async (): Promise<void> => {
    // Валидация email
    if (!email.trim()) {
      Alert.alert('Ошибка', 'Пожалуйста, введите email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Ошибка', 'Пожалуйста, введите корректный email');
      return;
    }

    setIsLoading(true);

    try {
      // Используем сервис для отправки email восстановления
      await authService.resetPassword(email);
      
      setIsSuccess(true);
      
      Alert.alert(
        'Письмо отправлено!',
        'Инструкции по восстановлению пароля отправлены на вашу электронную почту. Пожалуйста, проверьте вашу почту и следуйте инструкциям.',
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
      
    } catch (error: unknown) {
      console.error('Password reset error:', error);
      
      // Обработка различных ошибок Firebase
      let errorMessage = 'Произошла ошибка при отправке письма. Попробуйте еще раз.';
      
      if (isFirebaseError(error)) {
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'Пользователь с таким email не найден.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Неверный формат email адреса.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Слишком много попыток. Попробуйте позже.';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
            break;
          default:
            errorMessage = error.message || 'Неизвестная ошибка';
        }
      }
      
      Alert.alert('Ошибка', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = (): void => {
    router.back();
  };

  const handleEmailChange = (text: string): void => {
    setEmail(text);
    // Сбрасываем состояние успеха при изменении email
    if (isSuccess) {
      setIsSuccess(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Кнопка назад */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={handleBack}
        disabled={isLoading}
      >
        <Image
          source={require("@/assets/images/back-icon.png")}
          style={[
            styles.backIcon,
            isLoading && styles.disabledIcon
          ]}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Основной контент */}
      <View style={styles.content}>
        {/* Заголовок и описание */}
        <View style={styles.headerContainer}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.headerImage}
            resizeMode="contain"
          />
          
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>EatWisely</Text>
            
            <Text style={styles.subtitle}>
              Восстановление пароля
            </Text>
          </View>
        </View>

        {/* Форма восстановления */}
        <View style={styles.formContainer}>
          <Text style={styles.instructionText}>
            {isSuccess 
              ? 'Письмо отправлено! Проверьте вашу почту.'
              : 'Введите электронную почту, связанную с вашим аккаунтом, и мы отправим инструкции по восстановлению пароля.'
            }
          </Text>

          {!isSuccess && (
            <>
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
                    placeholder="Ваш email"
                    placeholderTextColor="#666"
                    value={email}
                    onChangeText={handleEmailChange}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Кнопка подтверждения */}
              <TouchableOpacity 
                style={[
                  styles.confirmButton,
                  isLoading && styles.confirmButtonDisabled,
                  !email.trim() && styles.confirmButtonDisabled
                ]}
                onPress={handleResetPassword}
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    Отправить инструкции
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Сообщение об успехе */}
          {isSuccess && (
            <View style={styles.successContainer}>
              <Image
                source={require("@/assets/images/checkmark-done.png")}
                style={styles.successIcon}
                resizeMode="contain"
              />
              <Text style={styles.successText}>
                Проверьте вашу почту {email} и следуйте инструкциям в письме.
              </Text>
              
              <TouchableOpacity 
                style={styles.backToLoginButton}
                onPress={() => router.back()}
              >
                <Text style={styles.backToLoginText}>Вернуться к входу</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Дополнительная информация */}
        {!isSuccess && (
          <View style={styles.footerContainer}>
            <Text style={styles.footerText}>
              На указанный email будет отправлено письмо со ссылкой для сброса пароля. 
              Ссылка действительна в течение 1 часа.
            </Text>
            
            {/* Ссылка на помощь */}
            <TouchableOpacity 
              style={styles.helpLink}
              onPress={() => Alert.alert(
                'Нужна помощь?',
                'Если вы не получили письмо:\n• Проверьте папку "Спам"\n• Убедитесь, что ввели правильный email\n• Попробуйте еще раз через несколько минут'
              )}
            >
              <Text style={styles.helpLinkText}>Не получили письмо?</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#C2DAE2',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  // Кнопка назад
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#000',
  },
  disabledIcon: {
    opacity: 0.5,
  },
  // Заголовок
  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  headerImage: {
    width: 150,
    height: 150,
  },
  headerTextContainer: {
    alignItems: 'center',
    marginTop: 0,
  },
  title: {
    fontFamily: 'Playfair Display Bold',
    fontSize: 40,
    fontWeight: 'normal',
    color: '#000',
    marginBottom: 15,
    textAlign: 'center',
    paddingBottom: 10,
    borderBottomWidth: 3,
    borderRadius: 2,
    borderBottomColor: '#000000',
    width: '80%',
  },
  subtitle: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    color: '#000',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 10,
  },
  // Форма
  formContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  instructionText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 30,
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C2DAE2',
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  inputIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    tintColor: '#000',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 12,
    fontFamily: 'Playfair Display Regular',
  },
  confirmButton: {
    backgroundColor: '#9BDF11',
    borderRadius: 75,
    paddingVertical: 15,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  confirmButtonDisabled: {
    backgroundColor: '#B8D48A',
    opacity: 0.7,
  },
  confirmButtonText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 16,
    fontWeight: 'normal',
    color: 'black',
  },
  // Сообщение об успехе
  successContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(155, 223, 17, 0.1)',
    borderRadius: 20,
    padding: 25,
    borderWidth: 2,
    borderColor: '#9BDF11',
    width: '100%',
  },
  successIcon: {
    width: 60,
    height: 60,
    marginBottom: 15,
  },
  successText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  backToLoginButton: {
    backgroundColor: '#6A9AA9',
    borderRadius: 75,
    paddingVertical: 12,
    paddingHorizontal: 30,
  },
  backToLoginText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 16,
    color: '#FFF',
  },
  // Футер
  footerContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  footerText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 14,
    color: '#001226',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  helpLink: {
    padding: 10,
  },
  helpLinkText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 14,
    color: '#001226',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});