import { Ionicons, Feather } from "@expo/vector-icons";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput, Modal, Alert, Dimensions, Platform, ActivityIndicator } from "react-native";
import { rationPlanService, RationPlan } from "@/app/services/rationPlanService";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { auth } from "@/app/firebase/config";
import { getFirestore, doc, setDoc, collection, query, where, getDocs, deleteDoc, Timestamp } from "firebase/firestore";
import { getApps, getApp, initializeApp } from "firebase/app";

declare const __firebase_config: string | undefined;

const categories = ["Все", "Шаблоны", "Активные", "Запланированные", "Завершенные", "Архивные"];

const formatDate = (dateInput: any) => {
  try {
    let date: Date;
    if (typeof dateInput === 'string') date = new Date(dateInput);
    else if (dateInput?.seconds) date = new Date(dateInput.seconds * 1000);
    else if (typeof dateInput === 'number') date = new Date(dateInput);
    else date = new Date();
    return date.toLocaleDateString("ru-RU");
  } catch { return new Date().toLocaleDateString("ru-RU"); }
};

export default function SavedPlansScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [showUsePlanModal, setShowUsePlanModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<RationPlan | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [userPlans, setUserPlans] = useState<RationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [firestoreDb, setFirestoreDb] = useState<any>(null);

  useEffect(() => {
    const initFirebase = async () => {
      try {
        const firebaseConfig = typeof __firebase_config !== "undefined" ? JSON.parse(__firebase_config) : {};
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        setFirestoreDb(getFirestore(app));
      } catch (error) { console.error("Firebase init error:", error); }
    };
    initFirebase();
  }, []);

  useFocusEffect(useCallback(() => { loadUserPlans(); }, []));

  const loadUserPlans = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) { setUserPlans([]); return; }
      const plans = await rationPlanService.getUserRationPlans(currentUser.uid);
      setUserPlans(plans);
    } catch (error) { Alert.alert("Ошибка", "Не удалось загрузить планы"); } 
    finally { setLoading(false); }
  };

  const filteredPlans = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const allPlans = userPlans.map((plan) => {
      const isActiveToday = plan.status === 'active' && plan.startDate?.split('T')[0] === today;
      const isScheduled = plan.status === 'active' && plan.startDate?.split('T')[0] !== today && !!plan.startDate;
      const isArchived = plan.status === 'archived';
      const isTemplate = plan.status === 'template';
      const isCompleted = plan.status === 'completed';
      let displayCategory = plan.category || "Обычный";
      if (isTemplate) displayCategory = "Шаблон";
      if (isActiveToday) displayCategory = "Активный";
      if (isScheduled) displayCategory = "Запланированный";
      if (isCompleted) displayCategory = "Завершенный";
      if (isArchived) displayCategory = "Архивный";
      
      // ======= УБРАЛИ ДНИ: ТЕПЕРЬ СТРОГО ИЗ КОРНЯ =======
      const meals = (plan as any).meals || [];
      const totalCalories = plan.totalCalories || meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);
      const mealsCount = meals.length; 
      // =================================================
      
      return {
        id: plan.id || `plan-${Date.now()}`, 
        name: plan.title || "План без названия", 
        description: plan.description || "Описание отсутствует",
        totalCalories: totalCalories, 
        mealsCount: mealsCount, 
        savedDate: formatDate(plan.createdAt),
        category: displayCategory, 
        originalPlan: plan, 
        isTemplate, 
        status: plan.status || "template",
        isActiveToday, 
        isScheduled, 
        isArchived, 
        isCompleted,
        activeDate: plan.startDate ? formatDate(plan.startDate) : null, 
        meals: meals
      };
    });
    return allPlans.filter((plan) => {
      const matchesSearch = plan.name.toLowerCase().includes(searchQuery.toLowerCase()) || plan.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = (() => {
        if (selectedCategory === "Все") return true;
        if (selectedCategory === "Шаблоны") return plan.isTemplate === true;
        if (selectedCategory === "Активные") return plan.isActiveToday === true;
        if (selectedCategory === "Запланированные") return plan.isScheduled === true;
        if (selectedCategory === "Завершенные") return plan.isCompleted === true;
        if (selectedCategory === "Архивные") return plan.isArchived === true;
        return plan.category === selectedCategory;
      })();
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory, userPlans]);

  const handleViewPlan = (plan: any) => {
    router.push({ 
      pathname: "/create-ration", 
      params: { 
        planId: plan.originalPlan?.id, 
        mode: "view", 
        source: "saved-plans" 
      } 
    });
  };
  
  // Исправленный handleEditPlan - теперь только предупреждение, без запрета
  const handleEditPlan = (plan: RationPlan, planInfo: any) => {
    if (planInfo.isArchived) {
      Alert.alert("Архивный план", "Архивные планы нельзя редактировать. Сначала восстановите план из архива.", [{ text: "OK" }]);
    } else if (planInfo.isActiveToday) {
      Alert.alert(
        "Внимание!", 
        "Этот план активен на главной странице. Если вы его измените, изменения также применятся к текущему рациону. Продолжить?",
        [
          { text: "Отмена", style: "cancel" },
          { text: "Продолжить", onPress: () => router.push({ 
            pathname: "/create-ration", 
            params: { planId: plan.id, mode: "edit", source: "saved-plans" } 
          })}
        ]
      );
    } else if (planInfo.isCompleted) {
      Alert.alert(
        "Завершенный план", 
        "Завершенные планы можно редактировать, но изменения не повлияют на завершенные дни. Продолжить?",
        [
          { text: "Отмена", style: "cancel" },
          { text: "Продолжить", onPress: () => router.push({ 
            pathname: "/create-ration", 
            params: { planId: plan.id, mode: "edit", source: "saved-plans" } 
          })}
        ]
      );
    } else {
      router.push({ 
        pathname: "/create-ration", 
        params: { planId: plan.id, mode: "edit", source: "saved-plans" } 
      });
    }
  };

  const clearFilters = () => { setSearchQuery(""); setSelectedCategory("Все"); };

  const handleRestoreFromArchive = async (plan: any) => {
    Alert.alert("Восстановить план", `Восстановить план "${plan.name}" из архива?`, [
      { text: "Отмена", style: "cancel" },
      { text: "Восстановить", onPress: async () => {
          const currentUser = auth.currentUser;
          if (!currentUser) return;
          await rationPlanService.updateRationPlan(currentUser.uid, plan.originalPlan.id, { status: 'template', isTemplate: true });
          await loadUserPlans();
          Alert.alert("Успех", "План восстановлен из архива");
        }
      }
    ]);
  };

  const activatePlanDirectly = async (plan: any, date: Date) => {
    if (!firestoreDb) { Alert.alert("Ошибка", "База данных не инициализирована"); return false; }
    const currentUser = auth.currentUser;
    if (!currentUser) { Alert.alert("Ошибка", "Пользователь не авторизован"); return false; }
    try {
      const dateStr = date.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      
      // ======= ЧИТАЕМ ТОЛЬКО ИЗ КОРНЯ =======
      const mealsFromPlan = plan.meals || [];
      
      const formattedMeals = mealsFromPlan.map((meal: any) => ({
        id: meal.id || `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: meal.category || "Обед", 
        name: meal.name || meal.title || "Рецепт",
        calories: meal.calories || 0, 
        proteins: meal.proteins || 0, 
        fats: meal.fats || 0, 
        carbohydrates: meal.carbohydrates || 0,
        weight: meal.weight || "250г", 
        marked: false, 
        cookingTime: meal.cookingTime || 20,
        difficultyLevel: meal.difficultyLevel || "Легко", 
        rating: meal.rating || 0,
        recipeId: meal.recipeId || meal.id || '', 
        isCustom: meal.isCustom || false, 
        canBeRemoved: true,
        imageUrl: meal.imageUrl || null, 
        addedAt: new Date().toISOString()
      }));
      
      // Удаляем старые записи за выбранную дату
      const daysQuery = query(
        collection(firestoreDb, 'ration_plan_days'), 
        where('userId', '==', currentUser.uid), 
        where('date', '==', dateStr)
      );
      const daysSnap = await getDocs(daysQuery);
      for (const docSnap of daysSnap.docs) {
        await deleteDoc(doc(firestoreDb, 'ration_plan_days', docSnap.id));
      }
      
      // Создаем новую запись в ration_plan_days
      const newPlanId = `${currentUser.uid}_${dateStr}_${Date.now()}`;
      await setDoc(doc(firestoreDb, 'ration_plan_days', newPlanId), {
        userId: currentUser.uid, 
        date: dateStr, 
        meals: formattedMeals, 
        planName: plan.name,
        planId: plan.originalPlan?.id, 
        createdAt: Timestamp.now(), 
        updatedAt: Timestamp.now(), 
        isActive: true
      });
      
      // Обновляем статус плана в ration_plans
      let newStatus = dateStr === todayStr ? 'active' : (dateStr > todayStr ? 'active' : 'completed');
      if (plan.originalPlan?.id) {
        await rationPlanService.updateRationPlan(currentUser.uid, plan.originalPlan.id, { 
          status: newStatus, 
          startDate: dateStr, 
          isTemplate: false,
          meals: formattedMeals // сохраняем плоскую структуру и сюда
        });
      }
      
      return true;
    } catch (error) { 
      console.error("Error activating plan:", error); 
      return false; 
    }
  };

  const handleUsePlan = (plan: any) => {
    if (plan.isArchived) {
      Alert.alert("Архивный план", "Этот план в архиве. Восстановите его перед использованием.", [
        { text: "Отмена", style: "cancel" }, 
        { text: "Восстановить", onPress: () => handleRestoreFromArchive(plan) }
      ]);
    } else if (plan.isActiveToday) {
      Alert.alert("План уже активен", "Этот план уже активен на сегодня.", [{ text: "OK" }]);
    } else { 
      setSelectedPlan(plan.originalPlan); 
      setSelectedDate(new Date()); 
      setShowUsePlanModal(true); 
    }
  };

  const handleUsePlanConfirm = async () => {
    if (!selectedPlan?.id) { Alert.alert("Ошибка", "План не выбран"); return; }
    const currentUser = auth.currentUser;
    if (!currentUser) { Alert.alert("Ошибка", "Пользователь не авторизован"); return; }
    const plan = filteredPlans.find(p => p.originalPlan?.id === selectedPlan.id);
    if (!plan || !plan.meals?.length) { 
      Alert.alert("Ошибка", "В плане нет блюд для активации"); 
      return; 
    }
    const success = await activatePlanDirectly(plan, selectedDate);
    if (success) { 
      await loadUserPlans(); 
      setShowUsePlanModal(false); 
      setShowSuccessModal(true);
      
      // Если активируем на сегодня, обновляем главную страницу
      if (selectedDate.toDateString() === new Date().toDateString()) {
        router.push({ pathname: "/home", params: { refreshHome: Date.now().toString() } });
      }
    } else {
      Alert.alert("Ошибка", "Не удалось активировать план");
    }
  };

  const handleDeletePlan = (planId: string, planInfo: any) => {
    let message = "Вы уверены, что хотите удалить этот план?";
    if (planInfo.isActiveToday) message = "Этот план активен на сегодня. Если вы удалите его, сегодняшний рацион станет пустым. Продолжить?";
    else if (planInfo.isScheduled) message = "Этот план запланирован на будущую дату. Удалить его?";
    Alert.alert("Удалить план", message, [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
          const currentUser = auth.currentUser;
          if (!currentUser) return;
          await rationPlanService.deleteRationPlan(planId, currentUser.uid);
          await loadUserPlans();
          if (planInfo.isActiveToday) {
            router.push({ pathname: "/home", params: { refreshHome: Date.now().toString() } });
          }
          Alert.alert("Успех", "План удален");
        }
      }
    ]);
  };

  const navigateToCreateRation = () => router.push("/create-ration");
  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => { 
    setShowDatePicker(false); 
    if (date) setSelectedDate(date); 
  };
  const handlePlanPress = (plan: any) => handleViewPlan(plan);
  const goToProfileSavedTab = () => router.push("/(tabs)/profile?tab=saved");
  const goToHome = () => { 
    setShowSuccessModal(false); 
    router.push({ pathname: "/home", params: { refreshHome: Date.now().toString() } }); 
  };

  if (loading) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6A9AA9" />
      <Text style={styles.loadingText}>Загрузка планов...</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goToProfileSavedTab}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Мои планы питания</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
              <TextInput 
                style={styles.searchInput} 
                placeholder="Поиск планов..." 
                placeholderTextColor="#666" 
                value={searchQuery} 
                onChangeText={setSearchQuery} 
              />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesContainer}>
            {categories.map((category) => (
              <TouchableOpacity 
                key={category} 
                style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]} 
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.sectionDivider} />
        </View>
        <View style={styles.plansSection}>
          <TouchableOpacity style={styles.createPlanMainButton} onPress={navigateToCreateRation}>
            <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
            <Text style={styles.createPlanMainButtonText}>Создать новый план питания</Text>
          </TouchableOpacity>
          {filteredPlans.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#C2DAE2" />
              <Text style={styles.emptyTitle}>Планы не найдены</Text>
              <Text style={styles.emptyText}>
                {searchQuery || selectedCategory !== "Все" ? "Попробуйте изменить параметры поиска" : "Создайте свой первый план питания!"}
              </Text>
              {searchQuery || selectedCategory !== "Все" ? 
                <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                  <Text style={styles.clearFiltersText}>Показать все планы</Text>
                </TouchableOpacity> : null}
            </View>
          ) : (
            <>
              <View style={styles.plansHeader}>
                <Text style={styles.plansTitle}>{filteredPlans.length} {getPlanCountText(filteredPlans.length)}</Text>
              </View>
              <View style={styles.plansList}>
                {filteredPlans.map((plan) => {
                  const isActiveToday = plan.isActiveToday, 
                        isArchived = plan.isArchived, 
                        isScheduled = plan.isScheduled, 
                        isTemplate = plan.isTemplate, 
                        isCompleted = plan.isCompleted;
                  return (
                    <TouchableOpacity 
                      key={plan.id} 
                      style={[
                        styles.planCard, 
                        isActiveToday && styles.activePlanCard, 
                        isArchived && styles.archivedPlanCard, 
                        isScheduled && styles.scheduledPlanCard, 
                        isCompleted && styles.completedPlanCard
                      ]} 
                      onPress={() => handlePlanPress(plan)} 
                      activeOpacity={0.7}
                    >
                      <View style={styles.planContent}>
                        <View style={styles.planHeader}>
                          <View style={styles.planTitleRow}>
                            <Text style={styles.planName} numberOfLines={1}>{plan.name}</Text>
                            {isActiveToday && (
                              <View style={styles.activeBadge}>
                                <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                                <Text style={styles.activeBadgeText}>Активен сегодня</Text>
                              </View>
                            )}
                            {isScheduled && (
                              <View style={styles.scheduledBadge}>
                                <Ionicons name="calendar" size={12} color="#FFFFFF" />
                                <Text style={styles.activeBadgeText}>на {plan.activeDate}</Text>
                              </View>
                            )}
                            {isTemplate && (
                              <View style={styles.templateBadge}>
                                <Ionicons name="document-outline" size={12} color="#FFFFFF" />
                                <Text style={styles.activeBadgeText}>Шаблон</Text>
                              </View>
                            )}
                            {isCompleted && (
                              <View style={styles.completedBadge}>
                                <Ionicons name="checkmark-done" size={12} color="#FFFFFF" />
                                <Text style={styles.activeBadgeText}>Завершен</Text>
                              </View>
                            )}
                            {isArchived && (
                              <View style={styles.archivedBadge}>
                                <Ionicons name="archive" size={12} color="#FFFFFF" />
                                <Text style={styles.activeBadgeText}>Архивный</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.planActions}>
                            {isArchived && (
                              <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); handleRestoreFromArchive(plan); }}>
                                <Ionicons name="refresh-outline" size={18} color="#4CAF50" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); handleEditPlan(plan.originalPlan!, plan); }}>
                              <Feather name="edit-2" size={16} color={isArchived ? "#999" : "#6A9AA9"} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionButton} onPress={(e) => { e.stopPropagation(); handleDeletePlan(plan.originalPlan!.id!, plan); }}>
                              <Feather name="trash-2" size={16} color="#FF6B6B" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        {isActiveToday && (
                          <View style={styles.editWarning}>
                            <Ionicons name="information-circle" size={14} color="#FF9800" />
                            <Text style={styles.editWarningText}>Редактирование изменит текущий рацион на главной странице</Text>
                          </View>
                        )}
                        {isScheduled && (
                          <View style={styles.editWarning}>
                            <Ionicons name="information-circle" size={14} color="#FF9800" />
                            <Text style={styles.editWarningText}>Запланирован на {plan.activeDate}</Text>
                          </View>
                        )}
                        <Text style={styles.planDescription} numberOfLines={2}>{plan.description}</Text>
                        <View style={styles.planDetails}>
                          <View style={styles.planDetail}>
                            <Ionicons name="flame-outline" size={14} color="#FF6B6B" />
                            <Text style={styles.planDetailText}>{plan.totalCalories || 0} ккал/день</Text>
                          </View>
                          <View style={styles.planDetail}>
                            <Ionicons name="restaurant-outline" size={14} color="#9BDF11" />
                            <Text style={styles.planDetailText}>{plan.mealsCount || 0} приёмов</Text>
                          </View>
                        </View>
                        <View style={styles.planFooter}>
                          <View style={[
                            styles.planCategoryBadge, 
                            isArchived && styles.archivedCategoryBadge, 
                            isScheduled && styles.scheduledCategoryBadge, 
                            isCompleted && styles.completedCategoryBadge
                          ]}>
                            <Text style={[
                              styles.planCategoryText, 
                              isArchived && styles.archivedCategoryText, 
                              isScheduled && styles.scheduledCategoryText, 
                              isCompleted && styles.completedCategoryText
                            ]}>{plan.category}</Text>
                          </View>
                          <Text style={styles.planDate}>Создан: {plan.savedDate}</Text>
                          <TouchableOpacity 
                            style={[styles.usePlanButton, (isActiveToday || isCompleted || isArchived) && styles.usePlanButtonDisabled]} 
                            onPress={(e) => { e.stopPropagation(); if (!isActiveToday && !isCompleted && !isArchived) handleUsePlan(plan); }} 
                            disabled={isActiveToday || isCompleted || isArchived}
                          >
                            <Text style={[styles.usePlanButtonText, (isActiveToday || isCompleted) && styles.usePlanButtonTextDisabled]}>
                              {isActiveToday ? "Активен" : (isScheduled ? "Запланирован" : (isCompleted ? "Завершен" : (isArchived ? "В архиве" : "Использовать")))}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {isArchived && (
                          <Text style={styles.archivedNote}>Нажмите на иконку восстановления, чтобы вернуть план из архива</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </ScrollView>
      
      {/* Модальное окно использования плана */}
      <Modal animationType="slide" transparent visible={showUsePlanModal} onRequestClose={() => setShowUsePlanModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Использовать план</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowUsePlanModal(false)}>
                <Ionicons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalContent}>
              <Text style={styles.modalPlanName}>{selectedPlan?.title}</Text>
              <Text style={styles.modalPlanDescription}>{selectedPlan?.description}</Text>
              <View style={styles.datePickerSection}>
                <Text style={styles.datePickerLabel}>Дата активации:</Text>
                <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar" size={20} color="#6A9AA9" />
                  <Text style={styles.datePickerText}>{selectedDate.toLocaleDateString("ru-RU")}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.warningContainer}>
                <Ionicons name="information-circle" size={20} color="#FF9800" />
                <Text style={styles.warningText}>
                  {selectedDate.toDateString() === new Date().toDateString() 
                    ? "План будет активирован на сегодня" 
                    : selectedDate > new Date() 
                      ? `План будет запланирован на ${selectedDate.toLocaleDateString("ru-RU")}` 
                      : `План будет активирован на ${selectedDate.toLocaleDateString("ru-RU")} (завершенный)`}
                </Text>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setShowUsePlanModal(false)}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={handleUsePlanConfirm}>
                <Text style={styles.confirmButtonText}>Активировать</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {showDatePicker && (
          <DateTimePicker 
            value={selectedDate} 
            mode="date" 
            display={Platform.OS === "ios" ? "spinner" : "default"} 
            onChange={handleDateChange} 
          />
        )}
      </Modal>
      
      {/* Модальное окно успеха */}
      <Modal animationType="fade" transparent visible={showSuccessModal} onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>План активирован!</Text>
            <Text style={styles.successMessage}>
              План "{selectedPlan?.title}" активирован на {selectedDate.toLocaleDateString("ru-RU")}
            </Text>
            <View style={styles.successButtons}>
              <TouchableOpacity style={[styles.successButton, styles.stayButton]} onPress={() => { setShowSuccessModal(false); loadUserPlans(); }}>
                <Text style={styles.stayButtonText}>Остаться здесь</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.successButton, styles.goToRationButton]} onPress={goToHome}>
                <Text style={styles.goToRationButtonText}>Перейти к рациону</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getPlanCountText = (count: number) => {
  if (count % 10 === 1 && count % 100 !== 11) return "план";
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return "плана";
  return "планов";
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFFFFF" },
  loadingText: { marginTop: 16, fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Regular" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 50, paddingBottom: 15, backgroundColor: "#FFF", borderBottomWidth: 2, borderBottomColor: "#6A9AA9" },
  backButton: { padding: 8, minWidth: 40 },
  headerTitle: { fontSize: 20, color: "#1a1a1a", fontFamily: "Playfair Display Bold", textAlign: "center", flex: 1 },
  scrollContainer: { flex: 1 },
  searchSection: { backgroundColor: "#FFFFFF", padding: 15, marginBottom: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  searchInputContainer: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 30, borderWidth: 2, borderColor: "#6A9AA9", paddingHorizontal: 15, paddingVertical: 6 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: "#000", paddingVertical: 4, fontFamily: "Playfair Display Regular" },
  categoriesContainer: { marginBottom: 12 },
  categoryButton: { backgroundColor: "white", borderWidth: 2, borderColor: "#6A9AA9", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8 },
  categoryButtonActive: { backgroundColor: "#9BDF11", borderColor: "#9BDF11" },
  categoryText: { fontSize: 14, color: "#000000", fontFamily: "Playfair Display Regular", fontWeight: "600" },
  categoryTextActive: { color: "#000000" },
  sectionDivider: { height: 2, backgroundColor: "#6A9AA9", marginHorizontal: -15, marginTop: 12 },
  plansSection: { backgroundColor: "#FFFFFF", padding: 15, paddingBottom: 20 },
  createPlanMainButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#6A9AA9", paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, marginBottom: 20, gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  createPlanMainButtonText: { fontSize: 16, color: "#FFFFFF", fontFamily: "Playfair Display Bold" },
  plansHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  plansTitle: { fontSize: 16, color: "#000000", fontWeight: "500", fontFamily: "Playfair Display Regular" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 18, color: "#6C757D", fontFamily: "Playfair Display Regular", marginBottom: 8 },
  emptyText: { fontSize: 14, color: "#6C757D", fontFamily: "Playfair Display Regular", textAlign: "center", marginBottom: 20 },
  clearFiltersButton: { backgroundColor: "#9BDF11", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  clearFiltersText: { color: "#000000", fontSize: 16, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  plansList: { gap: 12 },
  planCard: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  activePlanCard: { borderWidth: 2, borderColor: "#6BCF7F", backgroundColor: "#D4E8D4" },
  archivedPlanCard: { borderWidth: 1, borderColor: "#FF9800", backgroundColor: "#F5F5F5", opacity: 0.85 },
  scheduledPlanCard: { borderWidth: 1, borderColor: "#2196F3", backgroundColor: "#E3F2FD" },
  completedPlanCard: { borderWidth: 1, borderColor: "#9E9E9E", backgroundColor: "#F5F5F5" },
  planContent: { padding: 14, justifyContent: "space-between" },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  planTitleRow: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8, flexWrap: "wrap" },
  planName: { fontSize: 16, fontWeight: "600", color: "#212529", fontFamily: "Playfair Display Bold", flex: 1 },
  activeBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#6BCF7F", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  archivedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#FF9800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  scheduledBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#2196F3", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  templateBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#9BDF11", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  completedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#9E9E9E", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4 },
  activeBadgeText: { fontSize: 10, fontWeight: "bold", color: "#FFFFFF", fontFamily: "Playfair Display Regular" },
  planActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  actionButton: { padding: 4 },
  disabledActionButton: { padding: 4, opacity: 0.5 },
  planDescription: { fontSize: 13, color: "#4a6a7a", fontFamily: "Playfair Display Regular", marginBottom: 10, lineHeight: 18 },
  editWarning: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF3E0", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8, gap: 6 },
  editWarningText: { fontSize: 11, color: "#FF9800", fontFamily: "Playfair Display Regular", flex: 1 },
  planDetails: { flexDirection: "row", justifyContent: "flex-start", gap: 16, marginBottom: 10 },
  planDetail: { flexDirection: "row", alignItems: "center", gap: 6 },
  planDetailText: { fontSize: 12, color: "#212529", fontFamily: "Playfair Display Regular" },
  planFooter: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  planCategoryBadge: { backgroundColor: "rgba(107, 207, 127, 0.2)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  archivedCategoryBadge: { backgroundColor: "rgba(255, 152, 0, 0.2)" },
  scheduledCategoryBadge: { backgroundColor: "rgba(33, 150, 243, 0.2)" },
  completedCategoryBadge: { backgroundColor: "rgba(158, 158, 158, 0.2)" },
  planCategoryText: { fontSize: 11, fontWeight: "600", color: "#2e7d32", fontFamily: "Playfair Display Regular" },
  archivedCategoryText: { color: "#E65100" },
  scheduledCategoryText: { color: "#1565C0" },
  completedCategoryText: { color: "#757575" },
  planDate: { fontSize: 11, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  usePlanButton: { backgroundColor: "#9BDF11", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 15, marginLeft: "auto" },
  usePlanButtonDisabled: { backgroundColor: "#E5F0F5" },
  usePlanButtonText: { color: "#000000", fontSize: 12, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  usePlanButtonTextDisabled: { color: "#6A9AA9" },
  archivedNote: { fontSize: 11, color: "#FF9800", fontFamily: "Playfair Display Regular", marginTop: 8, fontStyle: "italic" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  modalContainer: { backgroundColor: "#FFF", borderRadius: 20, width: "90%", maxHeight: Dimensions.get("window").height * 0.8, overflow: "hidden" },
  successModalContainer: { backgroundColor: "#FFF", borderRadius: 20, width: "85%", padding: 24, alignItems: "center" },
  successIconContainer: { marginBottom: 16 },
  successTitle: { fontSize: 22, fontFamily: "Playfair Display Bold", color: "#1a1a1a", marginBottom: 8 },
  successMessage: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular", textAlign: "center", marginBottom: 24 },
  successButtons: { flexDirection: "row", gap: 12, width: "100%" },
  successButton: { flex: 1, paddingVertical: 12, borderRadius: 25, alignItems: "center" },
  stayButton: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#6A9AA9" },
  goToRationButton: { backgroundColor: "#9BDF11" },
  stayButtonText: { color: "#6A9AA9", fontSize: 14, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  goToRationButtonText: { color: "#000000", fontSize: 14, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 2, borderBottomColor: "#6A9AA9" },
  modalTitle: { fontSize: 20, fontFamily: "Playfair Display Bold", color: "#1a1a1a" },
  modalCloseButton: { padding: 4 },
  modalContent: { padding: 20 },
  modalPlanName: { fontSize: 18, fontFamily: "Playfair Display Bold", color: "#1a1a1a", marginBottom: 8 },
  modalPlanDescription: { fontSize: 14, color: "#6A9AA9", fontFamily: "Playfair Display Regular", marginBottom: 20 },
  datePickerSection: { marginBottom: 16 },
  datePickerLabel: { fontSize: 14, color: "#000000", fontFamily: "Playfair Display Regular", marginBottom: 8 },
  datePickerButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderWidth: 2, borderColor: "#6A9AA9", borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, gap: 10 },
  datePickerText: { fontSize: 16, color: "#000", fontFamily: "Playfair Display Regular" },
  warningContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF3E0", padding: 12, borderRadius: 8, gap: 8, marginTop: 16 },
  warningText: { flex: 1, fontSize: 12, color: "#FF9800", fontFamily: "Playfair Display Regular" },
  modalButtons: { flexDirection: "row", paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  modalButton: { flex: 1, paddingVertical: 14, borderRadius: 25, alignItems: "center" },
  cancelButton: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#6A9AA9" },
  confirmButton: { backgroundColor: "#9BDF11" },
  cancelButtonText: { color: "#000", fontSize: 16, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  confirmButtonText: { color: "#000", fontSize: 16, fontWeight: "600", fontFamily: "Playfair Display Regular" }
});