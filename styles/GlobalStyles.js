// styles/GlobalStyles.js
import { StyleSheet } from "react-native";

export const GlobalStyles = StyleSheet.create({
  // Цвета
  colors: {
    primary: "#9BDF11",       // Основной зеленый
    secondary: "#C2DAE2",     // Голубой фон
    accent: "#6A9AA9",        // Акцентный цвет
    background: "#FFFFFF",    // Белый фон
    text: "#000000",          // Основной текст
    textSecondary: "#6C757D", // Вторичный текст
    textLight: "#FFFFFF",     // Светлый текст
    border: "#E9ECEF",        // Цвет границ
    progress: "#9BDF11",      // Цвет прогресс-бара
  },

  // Шрифты
  fonts: {
    regular: "Playfair Display Regular",
    bold: "Playfair Display Bold",
    italic: "Playfair Display Italic",
    boldItalic: "Playfair Display BoldItalic",
  },

  // Типография
  typography: {
    title: {
      fontSize: 24,
      fontFamily: "Playfair Display Bold",
      color: "#000000",
    },
    subtitle: {
      fontSize: 18,
      fontFamily: "Playfair Display Regular",
      color: "#6C757D",
    },
    body: {
      fontSize: 16,
      fontFamily: "Playfair Display Regular",
      color: "#000000",
    },
    caption: {
      fontSize: 14,
      fontFamily: "Playfair Display Regular",
      color: "#6C757D",
    },
  },

  // Компоненты
  components: {
    //кнопка профиль
    profileButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: "hidden",
    },
    //изображение на кнопке профиля
    profileImage: {
      width: "100%",
      height: "100%",
      borderRadius: 30,
    },
    // Кнопки
    button: {
      backgroundColor: "#9BDF11",
      borderRadius: 25,
      paddingVertical: 15,
      paddingHorizontal: 40,
      minWidth: 200,
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
    buttonText: {
      fontSize: 18,
      fontFamily: "Playfair Display Regular",
      color: "#000000",
      fontWeight: "normal",
    },

    // Поля ввода
    input: {
      backgroundColor: "#C2DAE2",
      borderRadius: 20,
      borderWidth: 4,
      borderColor: "#6A9AA9",
      paddingHorizontal: 15,
      paddingVertical: 12,
      fontSize: 16,
      fontFamily: "Playfair Display Regular",
      color: "#000000",
    },

    // Карточки
    card: {
      backgroundColor: "#FFFFFF",
      borderRadius: 16,
      padding: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
      borderWidth: 1,
      borderColor: "#F1F3F4",
    },

    // Навигация
    bottomNav: {
      backgroundColor: "#C2DAE2",
      height: 70,
      paddingHorizontal: 10,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: "#E9ECEF",
    },
    navButton: {
      backgroundColor: "#9BDF11",
      borderRadius: 12,
      paddingVertical: 8,
      marginHorizontal: 5,
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  },

  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  // Layout
  layout: {
    container: {
      flex: 1,
      backgroundColor: "#C2DAE2",
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      borderBottomWidth: 1,
      borderBottomColor: "#E9ECEF",
    },
    section: {
      padding: 20,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      marginBottom: 1,
    },
  },
});

// Утилиты для быстрого доступа
export const { colors, fonts, typography, components, layout } = GlobalStyles;