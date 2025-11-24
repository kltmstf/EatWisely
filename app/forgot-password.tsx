import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  BackHandler,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Dimensions,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { authService } from "@/app/services/authService";
import { Ionicons } from "@expo/vector-icons";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Вспомогательная функция проверки типа ошибки
function isFirebaseError(
  error: unknown
): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        router.back();
        return true;
      }
    );
    return () => backHandler.remove();
  }, [router]);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert("Ошибка", "Пожалуйста, введите email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Ошибка", "Пожалуйста, введите корректный email");
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(email);
      // УСПЕХ: Просто меняем состояние, Alert НЕ показываем
      setIsSuccess(true);
    } catch (error: unknown) {
      console.error("Password reset error:", error);
      let errorMessage =
        "Произошла ошибка при отправке письма. Попробуйте еще раз.";
      if (isFirebaseError(error)) {
        switch (error.code) {
          case "auth/user-not-found":
            // Для безопасности можно писать "Если аккаунт существует, письмо отправлено"
            // Но для UX часто пишут прямо:
            errorMessage = "Пользователь с таким email не найден.";
            break;
          case "auth/invalid-email":
            errorMessage = "Неверный формат email адреса.";
            break;
          case "auth/too-many-requests":
            errorMessage = "Слишком много попыток. Попробуйте позже.";
            break;
          case "auth/network-request-failed":
            errorMessage = "Ошибка сети. Проверьте подключение к интернету.";
            break;
          default:
            errorMessage = error.message || "Неизвестная ошибка";
        }
      }
      Alert.alert("Ошибка", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (isSuccess) {
      setIsSuccess(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Кнопка назад */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.back()}
        disabled={isLoading}
      >
        <Ionicons
          name="arrow-back"
          size={24}
          color="#000"
          style={isLoading && styles.disabledIcon}
        />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.innerContent}>
          {/* Заголовок и логотип */}
          <View style={styles.headerContainer}>
            {/* Логотип: лучше использовать Image, если это бренд, но можно и иконку */}
            <Image
              source={require("@/assets/images/logo-circles.png")}
              style={styles.headerImage}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Восстановление</Text>
              <Text style={styles.subtitle}>
                Забыли пароль? Не волнуйтесь, мы поможем.
              </Text>
            </View>
          </View>

          {/* Контент формы или успеха */}
          <View style={styles.formWrapper}>
            {isSuccess ? (
              // --- Блок УСПЕХА (без Alert) ---
              <View style={styles.successContainer}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={80}
                  color="#9BDF11"
                  style={styles.successIcon}
                />
                <Text style={styles.successTitle}>Письмо отправлено!</Text>
                <Text style={styles.successText}>
                  Инструкции по восстановлению пароля были отправлены на{" "}
                  <Text style={{ fontWeight: "bold" }}>{email}</Text>.
                </Text>
                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.backToLoginText}>Вернуться к входу</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // --- Блок ФОРМЫ ВВОДА ---
              <>
                <Text style={styles.instructionText}>
                  Введите email, связанный с вашим аккаунтом.
                </Text>

                <View style={styles.inputContainer}>
                  <View style={styles.inputWithIcon}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color="#000"
                      style={styles.inputIcon}
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

                <TouchableOpacity
                  style={[
                    styles.confirmButton,
                    (isLoading || !email.trim()) &&
                      styles.confirmButtonDisabled,
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
          </View>
        </View>

        {/* Футер (подсказки) - показываем только если нет успеха */}
        {!isSuccess && (
          <View style={styles.footerContainer}>
            <TouchableOpacity
              style={styles.helpLink}
              onPress={() =>
                Alert.alert(
                  "Помощь",
                  'Проверьте папку "Спам". Письмо обычно приходит в течение 1-2 минут.'
                )
              }
            >
              <Ionicons
                name="help-circle-outline"
                size={18}
                color="#001226"
                style={{ marginRight: 5 }}
              />
              <Text style={styles.helpLinkText}>Не получили письмо?</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#C2DAE2",
  },
  scrollContainer: {
    flexGrow: 1,
    minHeight: SCREEN_HEIGHT,
    paddingBottom: 30,
  },
  innerContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center", // Центрируем контент по вертикали
  },
  // Кнопка назад
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 40,
    left: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 20,
  },
  disabledIcon: {
    opacity: 0.5,
  },
  // Хедер
  headerContainer: {
    alignItems: "center",
    marginBottom: 30,
    marginTop: 60,
  },
  headerImage: {
    width: 200, 
    height: 200,
    marginBottom: 20,
  },
  headerTextContainer: {
    alignItems: "center",
  },
  title: {
    fontFamily: "Playfair Display Bold",
    fontSize: 28,
    color: "#000",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Playfair Display Regular",
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    maxWidth: 280,
  },

  // Обертка формы
  formWrapper: {
    width: "100%",
    alignItems: "center",
  },
  instructionText: {
    fontFamily: "Playfair Display Regular",
    fontSize: 16,
    color: "#000",
    textAlign: "center",
    marginBottom: 25,
  },
  // Поля ввода
  inputContainer: {
    width: "100%",
    marginBottom: 25,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#C2DAE2",
    borderRadius: 75,
    borderWidth: 4,
    borderColor: "#6A9AA9",
    paddingHorizontal: 20,
    height: 60,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#000",
    height: "100%",
    fontFamily: "Playfair Display Regular",
  },

  // Кнопка действия
  confirmButton: {
    backgroundColor: "#9BDF11",
    borderRadius: 75,
    paddingVertical: 15,
    paddingHorizontal: 40,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#C2DAE2",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: "#B8D48A",
    opacity: 0.7,
  },
  confirmButtonText: {
    fontFamily: "Playfair Display Regular",
    fontSize: 18,
    color: "black",
  },

  //Стили УСПЕХА
  successContainer: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 20,
    padding: 30,
    width: "100%",
    marginTop: 10,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontFamily: "Playfair Display Bold",
    fontSize: 22,
    color: "#000",
    marginBottom: 10,
    textAlign: "center",
  },
  successText: {
    fontFamily: "Playfair Display Regular",
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 30,
  },
  backToLoginButton: {
    backgroundColor: "#6A9AA9",
    borderRadius: 75,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  backToLoginText: {
    fontFamily: "Playfair Display Regular",
    fontSize: 16,
    color: "#FFF",
  },

  // Футер
  footerContainer: {
    alignItems: "center",
    paddingVertical: 20,
    justifyContent: "flex-end",
    flex: 0.2, // Занимает оставшееся место
  },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  helpLinkText: {
    fontFamily: "Playfair Display Regular",
    fontSize: 14,
    color: "#001226",
    textDecorationLine: "underline",
  },
});
