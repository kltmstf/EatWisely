// app/(tabs)/profile/saved-plans.tsx
import { Ionicons, Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Platform,
} from "react-native";
import {
  rationPlanService,
  RationPlan,
} from "@/app/services/rationPlanService";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { auth } from "@/app/firebase/config";

type PlanType = {
  id: number;
  name: string;
  description: string;
  totalCalories: number;
  duration: string;
  mealsCount: number;
  savedDate: string;
  category: string;
  originalPlan?: RationPlan;
  createdAt?: number;
};

const categories = [
  "Все",
  "Похудение",
  "Энергия",
  "Здоровье",
  "Спорт",
  "Шаблоны",
  "Активные",
  "Завершенные",
];

// Вспомогательная функция форматирования даты
const formatDate = (dateInput: any) => {
  try {
    let date: Date;
    
    if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    } else if (dateInput?.seconds) {
      // Если это объект Firestore Timestamp
      date = new Date(dateInput.seconds * 1000);
    } else if (typeof dateInput === 'number') {
      date = new Date(dateInput);
    } else {
      date = new Date();
    }
    
    return date.toLocaleDateString("ru-RU");
  } catch (error) {
    console.error("Ошибка форматирования даты:", error);
    return new Date().toLocaleDateString("ru-RU");
  }
};

export default function SavedPlansScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [showUsePlanModal, setShowUsePlanModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<RationPlan | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [userPlans, setUserPlans] = useState<RationPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserPlans();
  }, []);

  const loadUserPlans = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert("Ошибка", "Пользователь не авторизован");
        setUserPlans([]);
        return;
      }

      // Загружаем планы пользователя из ration_plans
      const plans = await rationPlanService.getUserRationPlans(currentUser.uid);
      console.log("Загружено планов пользователя:", plans?.length || 0);
      
      // Сортируем планы по дате создания (от новых к старым)
      const sortedPlans = plans.sort((a, b) => {
        const aTime = getTimestamp(a.createdAt);
        const bTime = getTimestamp(b.createdAt);
        return bTime - aTime;
      });
      
      setUserPlans(sortedPlans);
    } catch (error) {
      console.error("Error loading plans:", error);
      Alert.alert("Ошибка", "Не удалось загрузить планы");
    } finally {
      setLoading(false);
    }
  };

  // Вспомогательная функция для получения timestamp
  const getTimestamp = (dateInput: any): number => {
    if (!dateInput) return 0;
    
    if (typeof dateInput === 'string') {
      return new Date(dateInput).getTime();
    } else if (dateInput?.seconds) {
      return dateInput.seconds * 1000;
    } else if (typeof dateInput === 'number') {
      return dateInput;
    }
    
    return 0;
  };

  // Функция определения иконки типа плана
  const getPlanTypeIcon = (type: string) => {
    return type === "weekly" ? "calendar-outline" : "today-outline";
  };

  // Функция определения цвета статуса
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#6BCF7F";
      case "completed":
        return "#6A9AA9";
      case "archived":
        return "#999";
      default:
        return "#6A9AA9";
    }
  };

  const filteredPlans = useMemo(() => {
    const allPlans = userPlans.map((plan) => {
      // Определяем дату создания для сортировки
      const createdAt = getTimestamp(plan.createdAt);
      
      return {
        id: parseInt(plan.id?.substring(plan.id.length - 3) || "0") || Date.now(),
        name: plan.title || "План без названия",
        description: plan.description || "Описание отсутствует",
        totalCalories: plan.totalCalories || 0,
        duration: plan.totalDuration || plan.totalDuration || "0 дней",
        mealsCount: plan.mealsCount || 0,
        savedDate: formatDate(plan.createdAt),
        category: plan.category || "Обычный",
        originalPlan: plan,
        createdAt: createdAt,
      };
    });

    return allPlans.filter((plan) => {
      const matchesSearch =
        plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plan.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = (() => {
        if (selectedCategory === "Все") return true;
        if (selectedCategory === "Шаблоны")
          return plan.originalPlan?.isTemplate === true;
        if (selectedCategory === "Активные")
          return (
            plan.originalPlan?.status === "active" &&
            !plan.originalPlan?.isTemplate
          );
        if (selectedCategory === "Завершенные")
          return plan.originalPlan?.status === "completed";
        return plan.category === selectedCategory;
      })();

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, userPlans]);

  const navigateToPlan = (plan: any) => {
    console.log(`Переход к плану: ${plan.name}`);
    // Переход к деталям плана или редактированию
    router.push({
      pathname: "/create-ration",
      params: { planId: plan.originalPlan?.id }
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
  };

  const handleUsePlan = (plan: any) => {
    setSelectedPlan(plan.originalPlan);
    setStartDate(new Date());
    const endDate = new Date();
    endDate.setDate(
      endDate.getDate() + (plan.originalPlan?.type === "weekly" ? 6 : 0)
    );
    setEndDate(endDate);
    setShowUsePlanModal(true);
  };

  const handleUsePlanConfirm = async () => {
    if (!selectedPlan?.id) return;

    try {
      await rationPlanService.useRationPlan(
        selectedPlan.id,
        startDate,
        endDate
      );

      Alert.alert("Успешно", "План назначен на выбранные даты!", [
        {
          text: "OK",
          onPress: () => {
            setShowUsePlanModal(false);
            loadUserPlans();
          },
        },
      ]);
    } catch (error) {
      Alert.alert("Ошибка", "Не удалось использовать план");
    }
  };

  const handleDeletePlan = (planId: string) => {
    Alert.alert("Удалить план", "Вы уверены, что хотите удалить этот план?", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          try {
            await rationPlanService.deleteRationPlan(planId);
            loadUserPlans();
          } catch (error) {
            Alert.alert("Ошибка", "Не удалось удалить план");
          }
        },
      },
    ]);
  };

  const handleEditPlan = (plan: RationPlan) => {
    router.push({
      pathname: "/create-ration",
      params: { planId: plan.id },
    });
  };

  const navigateToCreateRation = () => {
    router.push("/create-ration");
  };

  const handleStartDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowStartDatePicker(false);
    if (date) {
      setStartDate(date);
      if (date > endDate) {
        setEndDate(date);
      }
    }
  };

  const handleEndDateChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowEndDatePicker(false);
    if (date) {
      setEndDate(date);
    }
  };

  const handlePlanPress = (plan: any) => {
    if (plan.originalPlan?.isTemplate) {
      handleUsePlan(plan);
    } else {
      navigateToPlan(plan);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: "Сохраненные планы",
          headerBackTitle: "Назад",
        }}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Мои планы питания</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Feather
                name="search"
                size={16}
                color="#666"
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Поиск планов..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesContainer}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category && styles.categoryTextActive,
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.sectionDivider} />
        </View>

        <View style={styles.plansSection}>
          {loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Загрузка...</Text>
            </View>
          ) : filteredPlans.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#C2DAE2" />
              <Text style={styles.emptyTitle}>Планы не найдены</Text>
              <Text style={styles.emptyText}>
                {searchQuery || selectedCategory !== "Все"
                  ? "Попробуйте изменить параметры поиска"
                  : "Создайте свой первый план питания!"}
              </Text>
              {searchQuery || selectedCategory !== "Все" ? (
                <TouchableOpacity
                  style={styles.clearFiltersButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.clearFiltersText}>
                    Показать все планы
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.clearFiltersButton}
                  onPress={navigateToCreateRation}
                >
                  <Text style={styles.clearFiltersText}>Создать план</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View style={styles.plansHeader}>
                <Text style={styles.plansTitle}>
                  {filteredPlans.length}{" "}
                  {getPlanCountText(filteredPlans.length)}
                </Text>
                <TouchableOpacity
                  style={styles.createPlanButton}
                  onPress={navigateToCreateRation}
                >
                  <Ionicons name="add" size={20} color="#000" />
                  <Text style={styles.createPlanButtonText}>Новый план</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.plansList}>
                {filteredPlans.map((plan) => (
                  <TouchableOpacity
                    key={plan.id}
                    style={styles.planCard}
                    onPress={() => handlePlanPress(plan)}
                  >
                    <View style={styles.planIconContainer}>
                      <Ionicons 
                        name={getPlanTypeIcon(plan.originalPlan?.type || "daily")} 
                        size={32} 
                        color="#6A9AA9" 
                      />
                    </View>
                    <View style={styles.planContent}>
                      <View style={styles.planHeader}>
                        <View style={styles.planTitleRow}>
                          <Text style={styles.planName}>{plan.name}</Text>
                        </View>
                        <View style={styles.planActions}>
                          {!plan.originalPlan?.isTemplate && (
                            <View
                              style={[
                                styles.planStatusBadge,
                                {
                                  backgroundColor: getStatusColor(
                                    plan.originalPlan?.status || "active"
                                  ),
                                },
                              ]}
                            >
                              <Text style={styles.planStatusText}>
                                {plan.originalPlan?.status === "active"
                                  ? "Активный"
                                  : plan.originalPlan?.status === "completed"
                                  ? "Завершен"
                                  : "Архив"}
                              </Text>
                            </View>
                          )}
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleEditPlan(plan.originalPlan!);
                            }}
                          >
                            <Feather name="edit-2" size={16} color="#6A9AA9" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeletePlan(plan.originalPlan!.id!);
                            }}
                          >
                            <Feather name="trash-2" size={16} color="#FF6B6B" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={styles.planDescription}>
                        {plan.description}
                      </Text>

                      <View style={styles.planDetails}>
                        <View style={styles.planDetail}>
                          <Ionicons
                            name="flame-outline"
                            size={14}
                            color="#FF6B6B"
                          />
                          <Text style={styles.planDetailText}>
                            {plan.totalCalories} ккал/день
                          </Text>
                        </View>
                        <View style={styles.planDetail}>
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color="#6A9AA9"
                          />
                          <Text style={styles.planDetailText}>
                            {plan.duration}
                          </Text>
                        </View>
                        <View style={styles.planDetail}>
                          <Ionicons
                            name="restaurant-outline"
                            size={14}
                            color="#9BDF11"
                          />
                          <Text style={styles.planDetailText}>
                            {plan.mealsCount} приёмов
                          </Text>
                        </View>
                      </View>

                      <View style={styles.planFooter}>
                        <View style={styles.planFooterLeft}>
                          <View
                            style={[
                              styles.planCategoryBadge,
                              {
                                backgroundColor: getCategoryColor(
                                  plan.category
                                ),
                              },
                            ]}
                          >
                            <Text style={styles.planCategoryText}>
                              {plan.category}
                            </Text>
                          </View>
                          <Text style={styles.planDate}>
                            Создан: {plan.savedDate}
                          </Text>
                        </View>

                        <View style={styles.planFooterRight}>
                          {plan.originalPlan?.isTemplate ? (
                            <TouchableOpacity
                              style={styles.usePlanButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleUsePlan(plan);
                              }}
                            >
                              <Text style={styles.usePlanButtonText}>
                                Использовать
                              </Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={[
                                styles.usePlanButton,
                                styles.activePlanButton,
                              ]}
                              onPress={(e) => {
                                e.stopPropagation();
                                navigateToPlan(plan);
                              }}
                            >
                              <Text style={styles.usePlanButtonText}>
                                {plan.originalPlan?.status === "active"
                                  ? "Просмотр"
                                  : "Повторить"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        transparent={true}
        visible={showUsePlanModal}
        onRequestClose={() => setShowUsePlanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Использовать план</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowUsePlanModal(false)}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalPlanName}>{selectedPlan?.title}</Text>
              <Text style={styles.modalPlanDescription}>
                {selectedPlan?.description}
              </Text>

              <View style={styles.datePickerSection}>
                <Text style={styles.datePickerLabel}>Начало:</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#6A9AA9" />
                  <Text style={styles.datePickerText}>
                    {startDate.toLocaleDateString("ru-RU")}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.datePickerSection}>
                <Text style={styles.datePickerLabel}>Окончание:</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Ionicons name="calendar" size={20} color="#6A9AA9" />
                  <Text style={styles.datePickerText}>
                    {endDate.toLocaleDateString("ru-RU")}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.durationText}>
                Длительность:{" "}
                {Math.ceil(
                  (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
                ) + 1}{" "}
                дней
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowUsePlanModal(false)}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleUsePlanConfirm}
              >
                <Text style={styles.confirmButtonText}>Подтвердить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleStartDateChange}
          />
        )}

        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            minimumDate={startDate}
            onChange={handleEndDateChange}
          />
        )}
      </Modal>
    </View>
  );
}

// Вспомогательные функции
const getCategoryColor = (category: string) => {
  switch (category) {
    case "Похудение":
      return "#FF6B6B";
    case "Энергия":
      return "#FFD93D";
    case "Здоровье":
      return "#6BCF7F";
    case "Спорт":
      return "#4D96FF";
    default:
      return "#6A9AA9";
  }
};

const getPlanCountText = (count: number) => {
  if (count % 10 === 1 && count % 100 !== 11) return "план найден";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100))
    return "плана найдено";
  return "планов найдено";
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    marginBottom: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#6A9AA9",
    paddingHorizontal: 15,
    paddingVertical: 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#000",
    paddingVertical: 4,
    fontFamily: "Playfair Display Regular",
  },
  categoriesContainer: {
    marginBottom: 12,
  },
  categoryButton: {
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  categoryText: {
    fontSize: 14,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    fontWeight: "600",
  },
  categoryTextActive: {
    color: "#000000",
  },
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -15,
    marginTop: 12,
  },
  plansSection: {
    backgroundColor: "#FFFFFF",
    padding: 15,
    paddingBottom: 20,
  },
  plansHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  plansTitle: {
    fontSize: 16,
    color: "#000000ff",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  createPlanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9BDF11",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  createPlanButtonText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    marginBottom: 20,
  },
  clearFiltersButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  clearFiltersText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  plansList: {
    gap: 16,
  },
  planCard: {
    backgroundColor: "#C2DAE2",
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    height: 140,
  },
  planIconContainer: {
    width: 80,
    height: "100%",
    backgroundColor: "#C2DAE2",
    justifyContent: "center",
    alignItems: "center",
  },
  planContent: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  planTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  planName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#212529",
    fontFamily: "Playfair Display Regular",
    flex: 1,
  },
  planActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  planStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planStatusText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Playfair Display Regular",
  },
  planDescription: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
    lineHeight: 14,
  },
  planDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  planDetail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  planDetailText: {
    fontSize: 10,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
  },
  planFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planFooterLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  planFooterRight: {
    alignItems: "flex-end",
  },
  planCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planCategoryText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Playfair Display Regular",
  },
  planDate: {
    fontSize: 10,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
  usePlanButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  activePlanButton: {
    backgroundColor: "#6A9AA9",
  },
  usePlanButtonText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: Dimensions.get("window").height * 0.8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: "Playfair Display Bold",
    color: "#1a1a1a",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalPlanName: {
    fontSize: 18,
    fontFamily: "Playfair Display Bold",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  modalPlanDescription: {
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    marginBottom: 20,
  },
  datePickerSection: {
    marginBottom: 16,
  },
  datePickerLabel: {
    fontSize: 14,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#6A9AA9",
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    gap: 10,
  },
  datePickerText: {
    fontSize: 16,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
  },
  durationText: {
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    marginTop: 8,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#6A9AA9",
  },
  confirmButton: {
    backgroundColor: "#9BDF11",
  },
  cancelButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
  confirmButtonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Playfair Display Regular",
  },
});