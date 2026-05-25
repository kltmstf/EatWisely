// app/create-ration.tsx - ПРАВИЛЬНОЕ ОБНОВЛЕНИЕ ration_plan_days

import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput, Alert, Image, RefreshControl, ActivityIndicator, Dimensions, StatusBar, Modal } from "react-native";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { recipeService } from "@/app/services/recipeService";
import { rationPlanService } from "@/app/services/rationPlanService";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs, addDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/firebase/config';

type Recipe = {
  id: string; title: string; description?: string; mealType?: string; calories?: number;
  cookingTime?: string | number; difficultyLevel?: string; difficulty?: string;
  image?: string; imageUrl?: string; langdir1?: string; createdAt: any; updatedAt: any;
  userId: string; isPublic?: boolean; proteins?: number; fats?: number; carbohydrates?: number;
};

type MealInTemplate = {
  id: string; recipeId: string; title: string; category: string; calories: number;
  proteins: number; fats: number; carbohydrates: number; weight: string; cookingTime: number;
  difficultyLevel: string; imageUrl?: string;
};

const { width } = Dimensions.get("window");

const getCategoryName = (mealType?: string): string => {
  if (!mealType) return "Другое";
  const t = String(mealType).trim().toLowerCase();
  if (t === "breakfast" || t === "завтрак") return "Завтрак";
  if (t === "lunch" || t === "обед") return "Обед";
  if (t === "dinner" || t === "ужин") return "Ужин";
  if (t === "snack" || t === "перекусы") return "Перекусы";
  return "Другое";
};

const formatCookingTime = (time: any): string => {
  if (!time) return "20 мин";
  if (typeof time === 'number') {
    const m = Math.abs(time);
    if (m % 10 === 1 && m % 100 !== 11) return `${m} минута`;
    if ([2,3,4].includes(m % 10) && ![12,13,14].includes(m % 100)) return `${m} минуты`;
    return `${m} минут`;
  }
  return String(time);
};

export default function CreateRationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { planId, mode, source } = params;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedMeals, setSelectedMeals] = useState<MealInTemplate[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planStatus, setPlanStatus] = useState<"template" | "active" | "completed" | "archived" | "draft">("template");
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealInTemplate | null>(null);
  const [newWeight, setNewWeight] = useState("");
  const [showAfterSaveModal, setShowAfterSaveModal] = useState(false);

  // Обработка возврата через параметры URL
  useEffect(() => {
    if (params.selectedRecipe && typeof params.selectedRecipe === 'string') {
      try {
        const recipe = JSON.parse(params.selectedRecipe);
        setSelectedMeals(prev => {
          if (prev.some(m => m.recipeId === recipe.id)) {
            Alert.alert("Внимание", `Рецепт "${recipe.title}" уже добавлен`);
            return prev;
          }
          
          const newMeal: MealInTemplate = {
            id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            recipeId: recipe.id,
            title: recipe.title,
            category: recipe.category || "Обед",
            calories: recipe.calories || 0,
            proteins: recipe.proteins || 0,
            fats: recipe.fats || 0,
            carbohydrates: recipe.carbohydrates || 0,
            weight: recipe.weight || "250г",
            cookingTime: recipe.cookingTime || 20,
            difficultyLevel: recipe.difficultyLevel || "Легко",
            imageUrl: recipe.imageUrl,
          };
          
          Alert.alert("Успех", `Рецепт "${recipe.title}" добавлен`);
          return [...prev, newMeal];
        });
        
        setTimeout(() => {
          router.setParams({ selectedRecipe: undefined });
        }, 100);
      } catch (e) {
        console.error("Ошибка парсинга selectedRecipe:", e);
      }
    }
  }, [params.selectedRecipe]);

  useEffect(() => {
    if ((mode === "edit" || mode === "view") && planId) {
      loadPlanForEditing();
      if (mode === "view") setIsViewMode(true);
    } else {
      setLoading(false);
    }
  }, [planId, mode]);

  const handleEditWeight = (meal: MealInTemplate) => {
    setNewWeight((parseInt(meal.weight.replace(/[^0-9]/g, '')) || 250).toString());
    setEditingMeal(meal);
    setShowWeightModal(true);
  };

  const handleSaveWeight = () => {
    if (!editingMeal) return;
    const weightNum = parseInt(newWeight);
    if (isNaN(weightNum) || weightNum < 50 || weightNum > 1000) {
      Alert.alert("Ошибка", "Введите вес от 50 до 1000 грамм");
      return;
    }
    const oldWeight = parseInt(editingMeal.weight.replace(/[^0-9]/g, '')) || 250;
    const ratio = weightNum / oldWeight;
    const updatedMeal = { 
      ...editingMeal, 
      weight: `${weightNum} гр`, 
      calories: Math.round(editingMeal.calories * ratio), 
      proteins: Math.round(editingMeal.proteins * ratio), 
      fats: Math.round(editingMeal.fats * ratio), 
      carbohydrates: Math.round(editingMeal.carbohydrates * ratio) 
    };
    setSelectedMeals(prev => prev.map(m => m.id === editingMeal.id ? updatedMeal : m));
    setShowWeightModal(false);
    setEditingMeal(null);
    Alert.alert("Успех", `Вес изменен на ${weightNum} г, КБЖУ пересчитаны`);
  };

  const normalizeMeal = (meal: any): MealInTemplate => ({
    id: meal.id || `meal-${Date.now()}-${Math.random()}`,
    recipeId: meal.recipeId || meal.id,
    title: meal.name || meal.title || "Без названия",
    category: meal.category || meal.mealType || "Обед",
    calories: meal.calories || 0,
    proteins: meal.proteins || meal.proteinGrams || 0,
    fats: meal.fats || meal.fatGrams || 0,
    carbohydrates: meal.carbohydrates || meal.carbGrams || 0,
    weight: meal.weight || "250г",
    cookingTime: meal.cookingTime || 20,
    difficultyLevel: meal.difficultyLevel || "Легко",
    imageUrl: meal.imageUrl,
  });

  const loadPlanForEditing = async () => {
    try {
      setLoadingPlan(true);
      const userId = getAuth().currentUser?.uid;
      if (!userId) { 
        Alert.alert("Ошибка", "Пользователь не авторизован"); 
        return; 
      }
      
      const plan = await rationPlanService.getRationPlanById(planId as string, userId);
      if (plan) {
        let meals = (plan as any).meals || [];
        if (!meals.length && plan.days?.[0]?.meals) {
          meals = plan.days[0].meals;
        }
        
        const normalizedMeals = meals.map(normalizeMeal);
        setSelectedMeals(normalizedMeals);
        setTemplateTitle(plan.title || "План питания");
        setTemplateDescription(plan.description || "");
        setEditingPlanId(plan.id || null);
        setPlanStatus((plan.status as any) || "template");
      } else {
        Alert.alert("Ошибка", "План не найден");
        router.back();
      }
    } catch (error) { 
      console.error(error); 
      Alert.alert("Ошибка", "Не удалось загрузить план"); 
    } finally { 
      setLoadingPlan(false);
      setLoading(false);
    }
  };

  const handleAddRecipe = () => {
    if (isViewMode) { 
      Alert.alert("Внимание", "В режиме просмотра нельзя редактировать план"); 
      return; 
    }
    
    const existingMealsList = selectedMeals.map(m => ({ id: m.recipeId, title: m.title }));
    
    router.push({
      pathname: "/select-recipe",
      params: { 
        mode: "single",
        returnTo: "create-ration",
        existingMeals: JSON.stringify(existingMealsList)
      }
    });
  };

  const handleRemove = (id: string) => { 
    if (!isViewMode) setSelectedMeals(prev => prev.filter(m => m.id !== id)); 
  };
  
  const handleArchive = async () => {
    if (!editingPlanId) return;
    const userId = getAuth().currentUser?.uid;
    if (!userId) return;
    const newStatus = planStatus === "archived" ? "template" : "archived";
    await updateDoc(doc(db, 'ration_plans', editingPlanId), { 
      status: newStatus, 
      updatedAt: new Date().toISOString() 
    });
    setPlanStatus(newStatus);
    Alert.alert("Успех", newStatus === "archived" ? "План архивирован" : "План восстановлен");
  };

  const handleGoToHome = () => {
    setShowAfterSaveModal(false);
    router.replace({
      pathname: "/(tabs)/home",
      params: { refresh: Date.now().toString() }
    });
  };

  const handleStayHere = () => {
    setShowAfterSaveModal(false);
    if (source === "profile") {
      router.push("/(tabs)/profile?tab=saved");
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!templateTitle.trim()) { 
      Alert.alert("Ошибка", "Введите название"); 
      return; 
    }
    if (!selectedMeals.length) { 
      Alert.alert("Ошибка", "Добавьте блюда"); 
      return; 
    }
    
    try {
      setIsSaving(true);
      const userId = getAuth().currentUser?.uid;
      if (!userId) { 
        Alert.alert("Ошибка", "Пользователь не авторизован"); 
        return; 
      }
      
      const mealsData = selectedMeals.map(m => ({ 
        id: m.id,
        recipeId: m.recipeId,
        name: m.title,
        title: m.title,
        category: m.category,
        mealType: m.category,
        calories: m.calories,
        proteins: m.proteins,
        fats: m.fats,
        carbohydrates: m.carbohydrates,
        weight: m.weight,
        cookingTime: m.cookingTime,
        difficultyLevel: m.difficultyLevel,
        imageUrl: m.imageUrl,
      }));
      
      const totalCalories = selectedMeals.reduce((s, m) => s + m.calories, 0);
      const totalProteins = selectedMeals.reduce((s, m) => s + m.proteins, 0);
      const totalFats = selectedMeals.reduce((s, m) => s + m.fats, 0);
      const totalCarbs = selectedMeals.reduce((s, m) => s + m.carbohydrates, 0);
      
      const now = new Date().toISOString();
      const today = new Date().toISOString().split('T')[0];
      
      if (editingPlanId) {
        // 1. Обновляем основной план в ration_plans
        const planRef = doc(db, 'ration_plans', editingPlanId);
        await updateDoc(planRef, {
          title: templateTitle,
          description: templateDescription || `План от ${new Date().toLocaleDateString("ru-RU")}`,
          meals: mealsData,
          totalCalories: totalCalories,
          mealsCount: selectedMeals.length,
          updatedAt: now,
          status: planStatus === "archived" ? "archived" : "template"
        });
        
        // 2. Обновляем запись в ration_plan_days для сегодняшней даты (если есть)
        const planDaysQuery = query(
          collection(db, 'ration_plan_days'),
          where('userId', '==', userId),
          where('date', '==', today),
          where('planId', '==', editingPlanId)
        );
        const planDaysSnap = await getDocs(planDaysQuery);
        
        if (!planDaysSnap.empty) {
          // Обновляем существующую запись в ration_plan_days
          await updateDoc(planDaysSnap.docs[0].ref, {
            meals: mealsData,
            stats: {
              totalCalories,
              totalProteins,
              totalFats,
              totalCarbs,
              totalCookingTime: selectedMeals.reduce((s, m) => s + (m.cookingTime || 0), 0)
            },
            planName: templateTitle,
            updatedAt: now
          });
          console.log("✅ Обновлена запись в ration_plan_days");
        } else {
          // Проверяем, есть ли активный план на сегодня (возможно с другим planId)
          const activeDayQuery = query(
            collection(db, 'ration_plan_days'),
            where('userId', '==', userId),
            where('date', '==', today),
            where('isActive', '==', true)
          );
          const activeDaySnap = await getDocs(activeDayQuery);
          
          if (!activeDaySnap.empty && activeDaySnap.docs[0].data().planId === editingPlanId) {
            // Если это активный план, создаем запись
            const newPlanDayId = `${userId}_${today}_${editingPlanId}`;
            await setDoc(doc(db, 'ration_plan_days', newPlanDayId), {
              userId: userId,
              planId: editingPlanId,
              date: today,
              meals: mealsData,
              stats: {
                totalCalories,
                totalProteins,
                totalFats,
                totalCarbs,
                totalCookingTime: selectedMeals.reduce((s, m) => s + (m.cookingTime || 0), 0)
              },
              planName: templateTitle,
              isActive: true,
              createdAt: now,
              updatedAt: now
            });
            console.log("✅ Создана запись в ration_plan_days");
          }
        }
        
        setShowAfterSaveModal(true);
      } else {
        // Создаем новый шаблон
        const newPlan = {
          userId,
          title: templateTitle,
          description: templateDescription || `Шаблон от ${new Date().toLocaleDateString("ru-RU")}`,
          type: 'daily',
          meals: mealsData,
          isTemplate: true,
          usedDates: [],
          status: 'template',
          category: "Шаблон",
          totalCalories: totalCalories,
          totalDuration: '1 день',
          mealsCount: selectedMeals.length,
          createdAt: now,
          updatedAt: now,
        };
        
        const docRef = await addDoc(collection(db, 'ration_plans'), newPlan);
        setEditingPlanId(docRef.id);
        setShowAfterSaveModal(true);
      }
      
    } catch (error: any) { 
      console.error("Save error:", error);
      Alert.alert("Ошибка", error.message); 
    } finally { 
      setIsSaving(false); 
    }
  };

  const goBack = () => {
    router.back();
  };

  if (loadingPlan || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>Загрузка плана...</Text>
      </View>
    );
  }

  const total = { 
    calories: selectedMeals.reduce((s, m) => s + m.calories, 0), 
    proteins: selectedMeals.reduce((s, m) => s + m.proteins, 0), 
    fats: selectedMeals.reduce((s, m) => s + m.fats, 0), 
    carbs: selectedMeals.reduce((s, m) => s + m.carbohydrates, 0) 
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerText}>
          {isViewMode ? "Просмотр плана" : (editingPlanId ? "Редактировать" : "Создать шаблон")}
        </Text>
        {!isViewMode && editingPlanId && (
          <TouchableOpacity onPress={handleArchive}>
            <Ionicons 
              name={planStatus === "archived" ? "archive-outline" : "archive"} 
              size={24} 
              color={planStatus === "archived" ? "#4CAF50" : "#FF9800"} 
            />
          </TouchableOpacity>
        )}
        {!isViewMode && !editingPlanId && <View style={{ width: 40 }} />}
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {}} colors={["#6A9AA9"]} />
        }
      >
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Информация</Text>
          {planStatus === "archived" && (
            <View style={styles.archivedWarning}>
              <Ionicons name="archive" size={20} color="#FF9800" />
              <Text style={styles.archivedText}>План в архиве</Text>
            </View>
          )}
          
          {isViewMode ? (
            <Text style={styles.viewText}>{templateTitle || "—"}</Text>
          ) : (
            <TextInput 
              style={styles.input} 
              placeholder="Название *" 
              value={templateTitle} 
              onChangeText={setTemplateTitle} 
            />
          )}
          
          {isViewMode ? (
            <Text style={styles.viewText}>{templateDescription || "—"}</Text>
          ) : (
            <TextInput 
              style={[styles.input, styles.textArea]} 
              placeholder="Описание" 
              value={templateDescription} 
              onChangeText={setTemplateDescription} 
              multiline 
            />
          )}
        </View>

        {selectedMeals.length > 0 && (
          <View style={styles.form}>
            <View style={styles.row}>
              <Text style={styles.sectionTitle}>Блюда ({selectedMeals.length})</Text>
              {!isViewMode && planStatus !== "archived" && (
                <TouchableOpacity onPress={() => setSelectedMeals([])}>
                  <Text style={styles.clear}>Очистить</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {selectedMeals.map(meal => (
              <View key={meal.id} style={styles.mealItem}>
                {meal.imageUrl && (
                  <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
                )}
                <View style={styles.mealInfo}>
                  <Text style={styles.mealTitle}>{meal.title}</Text>
                  <Text style={styles.mealCategory}>{meal.category}</Text>
                  <View style={styles.mealStats}>
                    <Text style={styles.mealCalories}>{meal.calories} ккал</Text>
                    <Text style={styles.mealMacro}>Б: {meal.proteins || 0}г</Text>
                    <Text style={styles.mealMacro}>Ж: {meal.fats || 0}г</Text>
                    <Text style={styles.mealMacro}>У: {meal.carbohydrates || 0}г</Text>
                  </View>
                </View>
                <View style={styles.mealActions}>
                  {!isViewMode && planStatus !== "archived" && (
                    <TouchableOpacity style={styles.weightBtn} onPress={() => handleEditWeight(meal)}>
                      <Ionicons name="scale-outline" size={16} color="#4CAF50" />
                      <Text style={styles.weightBtnText}>{meal.weight}</Text>
                    </TouchableOpacity>
                  )}
                  {!isViewMode && planStatus !== "archived" && (
                    <TouchableOpacity onPress={() => handleRemove(meal.id)}>
                      <Ionicons name="close" size={20} color="#DC3545" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
            
            <View style={styles.stats}>
              <Text style={styles.statsTitle}>📊 Статистика дня:</Text>
              <Text style={styles.statsText}>🔥 Калории: {total.calories} ккал</Text>
              <Text style={styles.statsText}>💪 Белки: {total.proteins} г | Жиры: {total.fats} г | Углеводы: {total.carbs} г</Text>
            </View>
          </View>
        )}

        {!isViewMode && planStatus !== "archived" && (
          <TouchableOpacity style={styles.addRecipesBtn} onPress={handleAddRecipe}>
            <Ionicons name="add-circle-outline" size={24} color="#6A9AA9" />
            <Text style={styles.addRecipesBtnText}>Добавить блюдо</Text>
          </TouchableOpacity>
        )}

        {!isViewMode && selectedMeals.length > 0 && planStatus !== "archived" && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFF" />
                <Text style={styles.saveBtnText}>{editingPlanId ? "Обновить" : "Сохранить"}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Модальное окно после сохранения */}
      <Modal visible={showAfterSaveModal} transparent animationType="fade" onRequestClose={() => setShowAfterSaveModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Рацион сохранен!</Text>
            <Text style={styles.successMessage}>Ваш рацион успешно сохранен.</Text>
            <View style={styles.successButtons}>
              <TouchableOpacity style={[styles.successButton, styles.stayButton]} onPress={handleStayHere}>
                <Text style={styles.stayButtonText}>Остаться здесь</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.successButton, styles.goToPlansButton]} onPress={handleGoToHome}>
                <Text style={styles.goToPlansButtonText}>К рациону</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showWeightModal} transparent animationType="fade" onRequestClose={() => setShowWeightModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.weightModal}>
            <View style={styles.weightModalHeader}>
              <Text style={styles.weightModalTitle}>Изменить вес</Text>
              <TouchableOpacity onPress={() => setShowWeightModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.weightModalContent}>
              <Text style={styles.weightModalText}>{editingMeal?.title}</Text>
              <Text style={styles.weightModalSubtext}>Текущий: {editingMeal?.weight}</Text>
              
              <View style={styles.weightInputContainer}>
                <TextInput 
                  style={styles.weightInput} 
                  value={newWeight} 
                  onChangeText={setNewWeight} 
                  keyboardType="numeric" 
                  placeholder="Вес" 
                />
                <Text style={styles.weightUnit}>гр</Text>
              </View>
              
              <Text style={styles.weightHint}>КБЖУ пересчитаются автоматически</Text>
              
              <View style={styles.weightModalButtons}>
                <TouchableOpacity style={[styles.weightBtnModal, styles.weightBtnCancel]} onPress={() => setShowWeightModal(false)}>
                  <Text style={styles.weightBtnCancelText}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.weightBtnModal, styles.weightBtnSave]} onPress={handleSaveWeight}>
                  <Text style={styles.weightBtnSaveText}>Сохранить</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  loadingText: { marginTop: 10, fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Regular" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  headerText: { fontSize: 18, color: "#1a1a1a", fontFamily: "Playfair Display Bold", textAlign: "center", flex: 1 },
  form: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  sectionTitle: { fontSize: 18, color: "#1a1a1a", fontFamily: "Playfair Display Bold", marginBottom: 16 },
  input: { borderWidth: 1, borderColor: "#C2DAE2", borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "Playfair Display Regular", marginBottom: 12 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  viewText: { fontSize: 16, padding: 12, backgroundColor: "#F5F5F5", borderRadius: 8, fontFamily: "Playfair Display Regular", marginBottom: 12 },
  archivedWarning: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF3E0", padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  archivedText: { fontSize: 14, color: "#FF9800", fontFamily: "Playfair Display Regular", flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  clear: { fontSize: 14, color: "#DC3545", fontFamily: "Playfair Display Regular" },
  mealItem: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F9FA", padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: "#E9ECEF", gap: 12 },
  mealImage: { width: 50, height: 50, borderRadius: 8 },
  mealInfo: { flex: 1 },
  mealTitle: { fontSize: 14, color: "#1a1a1a", fontFamily: "Playfair Display Bold", marginBottom: 4 },
  mealCategory: { fontSize: 12, color: "#6A9AA9", fontFamily: "Playfair Display Regular", marginBottom: 4 },
  mealStats: { flexDirection: "row", gap: 12, marginTop: 4, flexWrap: "wrap" },
  mealCalories: { fontSize: 12, color: "#FF6B6B", fontFamily: "Playfair Display Medium" },
  mealMacro: { fontSize: 11, color: "#6A9AA9", fontFamily: "Playfair Display Medium" },
  mealActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  weightBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(76,175,80,0.15)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 4 },
  weightBtnText: { fontSize: 11, color: "#4CAF50", fontFamily: "Playfair Display Bold" },
  stats: { backgroundColor: "#E5F0F5", padding: 12, borderRadius: 8, marginTop: 12 },
  statsTitle: { fontSize: 14, color: "#1a1a1a", fontFamily: "Playfair Display Bold", marginBottom: 8 },
  statsText: { fontSize: 13, color: "#666", fontFamily: "Playfair Display Regular", marginBottom: 4 },
  addRecipesBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F5", marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: "#C2DAE2", borderStyle: "dashed" },
  addRecipesBtnText: { fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Bold" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#6A9AA9", padding: 16, borderRadius: 12, gap: 8, margin: 16 },
  saveBtnText: { fontSize: 16, color: "#FFF", fontFamily: "Playfair Display Bold" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  successModalContainer: { backgroundColor: "#FFF", borderRadius: 20, width: "85%", padding: 24, alignItems: "center" },
  successIconContainer: { marginBottom: 16 },
  successTitle: { fontSize: 22, fontFamily: "Playfair Display Bold", color: "#1a1a1a", marginBottom: 8 },
  successMessage: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular", textAlign: "center", marginBottom: 24 },
  successButtons: { flexDirection: "row", gap: 12, width: "100%" },
  successButton: { flex: 1, paddingVertical: 12, borderRadius: 25, alignItems: "center" },
  stayButton: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#6A9AA9" },
  goToPlansButton: { backgroundColor: "#9BDF11" },
  stayButtonText: { color: "#6A9AA9", fontSize: 14, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  goToPlansButtonText: { color: "#000", fontSize: 14, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  weightModal: { backgroundColor: "#FFF", borderRadius: 20, width: "85%", overflow: "hidden" },
  weightModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  weightModalTitle: { fontSize: 18, fontFamily: "Playfair Display Bold", color: "#1a1a1a" },
  weightModalContent: { padding: 20 },
  weightModalText: { fontSize: 16, fontFamily: "Playfair Display Bold", marginBottom: 8 },
  weightModalSubtext: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular", marginBottom: 20 },
  weightInputContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#C2DAE2", borderRadius: 12, backgroundColor: "#F5F5F5", marginBottom: 12 },
  weightInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: "Playfair Display Regular" },
  weightUnit: { paddingHorizontal: 12, fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Bold" },
  weightHint: { fontSize: 12, color: "#999", fontFamily: "Playfair Display Regular", marginBottom: 20, textAlign: "center" },
  weightModalButtons: { flexDirection: "row", gap: 12 },
  weightBtnModal: { flex: 1, paddingVertical: 12, borderRadius: 25, alignItems: "center" },
  weightBtnCancel: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#6A9AA9" },
  weightBtnCancelText: { color: "#6A9AA9", fontSize: 14, fontFamily: "Playfair Display Bold" },
  weightBtnSave: { backgroundColor: "#6A9AA9" },
  weightBtnSaveText: { color: "#FFF", fontSize: 14, fontFamily: "Playfair Display Bold" },
});