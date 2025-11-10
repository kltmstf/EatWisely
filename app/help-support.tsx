import React from 'react';
import { 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
  Image 
} from 'react-native';
import { useRouter } from 'expo-router';

export default function HelpSupport() {
  const router = useRouter();

  const faqItems = [
    {
      question: "Как создать рацион питания?",
      answer: "Перейдите в раздел 'Рацион' и нажмите 'Создать новый рацион'. Система автоматически предложит варианты на основе ваших предпочтений."
    },
    {
      question: "Можно ли изменить тип питания?",
      answer: "Да, в настройках профиля вы можете изменить тип питания на вегетарианское, веганское или обычное."
    },
    {
      question: "Как добавить аллергии и исключения?",
      answer: "В разделе 'Настройки профиля' есть специальный раздел 'Аллергии и исключения' для указания продуктов, которые вы не употребляете."
    },
    {
      question: "Как работает система оценок блюд?",
      answer: "После каждого приема пищи вы можете оценить блюдо. Это поможет системе лучше подбирать рацион под ваши вкусы."
    },
    {
      question: "Можно ли сохранить понравившиеся рецепты?",
      answer: "Да, нажимайте на иконку закладки на карточке блюда, чтобы добавить его в избранное."
    }
  ];

  const handleBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Шапка */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Image 
            source={require('@/assets/images/back-icon.png')}
            style={styles.backIcon}
          />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Справка и поддержка</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Приветственный блок */}
        <View style={styles.welcomeSection}>
          <Image
            source={require('@/assets/images/support-icon.png')}
            style={styles.supportIcon}
          />
          <Text style={styles.welcomeTitle}>Мы здесь чтобы помочь!</Text>
          <Text style={styles.welcomeText}>
            Найдите ответы на часто задаваемые вопросы или свяжитесь с нашей службой поддержки.
          </Text>
        </View>

        {/* FAQ раздел */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Часто задаваемые вопросы</Text>
          {faqItems.map((item, index) => (
            <View key={index} style={styles.faqItem}>
              <Text style={styles.faqQuestion}>• {item.question}</Text>
              <Text style={styles.faqAnswer}>{item.answer}</Text>
              {index < faqItems.length - 1 && <View style={styles.faqDivider} />}
            </View>
          ))}
        </View>

        {/* Контакты поддержки */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Свяжитесь с нами</Text>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Email поддержки:</Text>
            <Text style={styles.contactValue}>support@eatwisely.com</Text>
          </View>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Телефон:</Text>
            <Text style={styles.contactValue}>+7 (800) 123-45-67</Text>
          </View>
          <View style={styles.contactItem}>
            <Text style={styles.contactLabel}>Часы работы:</Text>
            <Text style={styles.contactValue}>Пн-Пт: 9:00-18:00</Text>
          </View>
        </View>

        {/* Дополнительная информация */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Полезные советы</Text>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Регулярно обновляйте свои предпочтения для более точных рекомендаций</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Используйте функцию оценки блюд для персонализации рациона</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipText}>• Не забывайте указывать сезонные аллергии</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: "#C2DAE2",
    borderBottomWidth: 3,
    borderBottomColor: "#6A9AA9",
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backIcon: {
    width: 30,
    height: 15,
    tintColor: "#000000",
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    maxWidth: "80%",
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  welcomeSection: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F8F9FA',
    margin: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#6A9AA9',
  },
  supportIcon: {
    width: 50,
    height: 50,
    marginBottom: 16,
    tintColor: '#000000ff',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    padding: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 16,
    fontFamily: "Playfair Display Regular",
  },
  faqItem: {
    marginBottom: 16,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
    marginBottom: 8,
    fontFamily: "Playfair Display Regular",
  },
  faqAnswer: {
    fontSize: 14,
    color: "#6C757D",
    lineHeight: 20,
    fontFamily: "Playfair Display Regular",
  },
  faqDivider: {
    height: 2,
    backgroundColor: "#C2DAE2",
    marginTop: 10,
  },
  contactItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  contactLabel: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    fontWeight: "500",
  },
  contactValue: {
    fontSize: 14,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    fontWeight: "600",
  },
  tipItem: {
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    lineHeight: 20,
  },
});