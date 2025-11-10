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
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        router.back();
        return true;
      }
    );

    return () => backHandler.remove();
  }, []);

  const handleResetPassword = () => {
    if (!email) {
      Alert.alert('Ошибка', 'Пожалуйста, введите email');
      return;
    }

    // Здесь будет логика отправки email для восстановления пароля
    console.log('Восстановление пароля для:', email);
    
    Alert.alert(
      'Письмо отправлено',
      'Инструкции по восстановлению пароля отправлены на вашу электронную почту.',
      [
        {
          text: 'OK',
          onPress: () => router.back()
        }
      ]
    );
  };

  const handleBack = () => {
    router.back();
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
        {/* Кнопка назад */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Image
            source={require("@/assets/images/back-icon.png")}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>

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
      Ваш персональный гид по здоровому питанию!
    </Text>
  </View>
</View>

        {/* Основной контент */}
        <View style={styles.contentContainer}>
          <Text style={styles.instructionText}>
            Введите электронную почту для восстановления пароля.
          </Text>

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
              />
            </View>
          </View>

          {/* Кнопка подтверждения */}
          <TouchableOpacity 
            style={styles.confirmButton}
            onPress={handleResetPassword}
          >
            <Text style={styles.confirmButtonText}>Подтвердить</Text>
          </TouchableOpacity>
        </View>

        {/* Дополнительная информация */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            На указанный email будет отправлено письмо с инструкциями по восстановлению пароля.
          </Text>
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
  // Кнопка назад
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  backIcon: {
    width: 24,
    height: 24,
    tintColor: '#000',
  },
   // Заголовок
  headerContainer: {
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 30,
  },
  headerImage: {
    width: 150, // Уменьшенный логотип
    height: 150, // Уменьшенный логотип
  },
  headerTextContainer: {
    alignItems: 'center',
    marginTop: 0, // Убрали отступ сверху, так как теперь есть разделитель
  },
  title: {
    fontFamily: 'Playfair Display Bold',
    fontSize: 40,
    fontWeight: 'normal',
    color: '#000',
    marginBottom: 15,
    textAlign: 'center',
    paddingBottom: 10, // Отступ для линии
    borderBottomWidth: 3, // Линия как бордер
    borderRadius: 2,
    borderBottomColor: '#000000',
    width: '80%', // Ширина линии
},
  subtitle: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 16,
    color: '#000',
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 300,
  },
  // Основной контент
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  instructionText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
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
  confirmButtonText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    fontWeight: 'normal',
    color: 'black',
  },
  // Футер
  footerContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  footerText: {
    fontFamily: 'Playfair Display Regular',
    fontSize: 14,
    color: '#001226',
    textAlign: 'center',
    lineHeight: 18,
  },
});