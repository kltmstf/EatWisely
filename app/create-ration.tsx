// app/create-ration.tsx - ИСПРАВЛЕННАЯ ЗАГРУЗКА БЖУ

import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput, Alert, Image, RefreshControl, ActivityIndicator, Dimensions, StatusBar, Modal } from "react-native";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { recipeService } from "@/app/services/recipeService";
import { rationPlanService } from "@/app/services/rationPlanService";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекусы"];
const RECIPES_PER_PAGE = 6;
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

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
  const { planId, mode, source, meals: mealsParam } = useLocalSearchParams();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [filteredRecipes, setFilteredRecipes] = useState<Recipe[]>([]);
  const [displayedRecipes, setDisplayedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Все");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isViewMode, setIsViewMode] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedMeals, setSelectedMeals] = useState<MealInTemplate[]>([]);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recipeSource, setRecipeSource] = useState<"all" | "user">("all");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planStatus, setPlanStatus] = useState<"template" | "active" | "completed" | "archived" | "draft">("template");
  const [isActivePlan, setIsActivePlan] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealInTemplate | null>(null);
  const [newWeight, setNewWeight] = useState("");

  useEffect(() => {
    if ((mode === "edit" || mode === "view") && planId) {
      loadPlanForEditing();
      if (mode === "view") setIsViewMode(true);
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
    const updatedMeal = { ...editingMeal, weight: `${weightNum} гр`, calories: Math.round(editingMeal.calories * ratio), proteins: Math.round(editingMeal.proteins * ratio), fats: Math.round(editingMeal.fats * ratio), carbohydrates: Math.round(editingMeal.carbohydrates * ratio) };
    setSelectedMeals(prev => prev.map(m => m.id === editingMeal.id ? updatedMeal : m));
    setShowWeightModal(false);
    setEditingMeal(null);
    Alert.alert("Успех", `Вес изменен на ${weightNum} г, КБЖУ пересчитаны`);
  };

  // Функция для преобразования meal в правильный формат с БЖУ
  const normalizeMeal = (meal: any): MealInTemplate => ({
    id: meal.id || `meal-${Date.now()}-${Math.random()}`,
    recipeId: meal.recipeId || meal.id,
    title: meal.name || meal.title || "Без названия",
    category: meal.category || "Обед",
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
      if (!userId) { Alert.alert("Ошибка", "Пользователь не авторизован"); return; }
      const today = new Date().toISOString().split('T')[0];
      const activePlan = await rationPlanService.getActivePlanForToday(userId);
      let loadedMeals: MealInTemplate[] = [];
      
      // 1. Сначала пробуем получить из параметров (режим просмотра)
      if (mealsParam && typeof mealsParam === 'string') {
        try {
          const parsed = JSON.parse(mealsParam);
          if (Array.isArray(parsed) && parsed.length) {
            loadedMeals = parsed.map(normalizeMeal);
          }
        } catch(e) {}
      }
      
      // 2. Если нет - загружаем из activePlan (daily_plans)
      if (!loadedMeals.length && activePlan && activePlan.id === planId) {
        setIsActivePlan(true);
        const dailyPlanRef = doc(db, 'users', userId, 'daily_plans', today);
        const dailyPlanSnap = await getDoc(dailyPlanRef);
        if (dailyPlanSnap.exists()) {
          const dailyMeals = dailyPlanSnap.data().meals || [];
          loadedMeals = dailyMeals.map(normalizeMeal);
          setTemplateTitle(activePlan.title || "Активный план");
          setEditingPlanId(activePlan.id || null);
        }
      } 
      // 3. Иначе загружаем из ration_plans
      else if (!loadedMeals.length && planId) {
        const plan = await rationPlanService.getRationPlanById(planId as string, userId);
        if (plan) {
          const raw = (plan as any).meals || (plan.days?.[0]?.meals) || [];
          loadedMeals = raw.map(normalizeMeal);
          setTemplateTitle(plan.title || "План питания");
          setTemplateDescription(plan.description || "");
          setEditingPlanId(plan.id || null);
          setPlanStatus((plan.status as any) || "template");
        }
      } 
      // 4. Если есть loadedMeals из параметров, но нужно установить заголовок
      else if (loadedMeals.length) {
        if (activePlan && activePlan.id === planId) {
          setIsActivePlan(true);
          setTemplateTitle(activePlan.title || "Активный план");
          setEditingPlanId(activePlan.id || null);
        } else if (planId) {
          const plan = await rationPlanService.getRationPlanById(planId as string, userId);
          if (plan) { 
            setTemplateTitle(plan.title || "План питания");
            setTemplateDescription(plan.description || "");
            setEditingPlanId(plan.id || null);
            setPlanStatus((plan.status as any) || "template");
          }
        }
      }
      
      setSelectedMeals(loadedMeals);
      console.log("Загружено блюд:", loadedMeals.length);
      console.log("БЖУ первого блюда:", loadedMeals[0] ? { proteins: loadedMeals[0].proteins, fats: loadedMeals[0].fats, carbohydrates: loadedMeals[0].carbohydrates } : "нет");
    } catch (error) { 
      console.error(error); 
      Alert.alert("Ошибка", "Не удалось загрузить план"); 
    } finally { 
      setLoadingPlan(false); 
    }
  };

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true);
      const data = recipeSource === "user" ? await recipeService.getUserRecipes() : await recipeService.getPublicRecipes();
      const formatted: Recipe[] = data.map((r: any) => ({ id: r.id, title: r.title || "Без названия", description: r.description || "", mealType: r.mealType, calories: r.calories || 0, cookingTime: r.cookingTime, difficultyLevel: r.difficultyLevel || r.difficulty || "Легко", imageUrl: r.imageUrl || r.image, langdir1: r.langdir1, createdAt: r.createdAt, updatedAt: r.updatedAt, userId: r.userId, isPublic: r.isPublic || false, proteins: r.proteins || 0, fats: r.fats || 0, carbohydrates: r.carbohydrates || 0 }));
      formatted.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setRecipes(formatted);
      setPage(0);
      setHasMore(true);
      setDisplayedRecipes([]);
    } catch (error) { Alert.alert("Ошибка", "Не удалось загрузить рецепты"); } 
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  }, [recipeSource]);

  useEffect(() => { loadRecipes(); }, [recipeSource]);
  useEffect(() => {
    let filtered = [...recipes];
    if (selectedCategory !== "Все") filtered = filtered.filter(r => getCategoryName(r.mealType).toLowerCase() === selectedCategory.toLowerCase());
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); filtered = filtered.filter(r => r.title?.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)); }
    setFilteredRecipes(filtered);
    setPage(0);
    setHasMore(filtered.length > RECIPES_PER_PAGE);
    setDisplayedRecipes(filtered.slice(0, RECIPES_PER_PAGE));
  }, [recipes, selectedCategory, searchQuery]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    const end = (next + 1) * RECIPES_PER_PAGE;
    setDisplayedRecipes(filteredRecipes.slice(0, end));
    setPage(next);
    if (end >= filteredRecipes.length) setHasMore(false);
    setLoadingMore(false);
  };

  const onRefresh = useCallback(() => { setRefreshing(true); loadRecipes(); }, [loadRecipes]);
  const getDifficultyColor = (d?: string) => { if (!d) return "#6A9AA9"; const ld = d.toLowerCase(); if (ld.includes("легк")) return "#4CAF50"; if (ld.includes("средн")) return "#FF9800"; if (ld.includes("сложн")) return "#F44336"; return "#6A9AA9"; };
  const getCategoryIcon = (mt?: string) => { const c = getCategoryName(mt).toLowerCase(); if (c === "завтрак") return "sunny-outline"; if (c === "обед") return "restaurant-outline"; if (c === "ужин") return "moon-outline"; if (c === "перекусы") return "cafe-outline"; return "fast-food-outline"; };
  const getImageUrl = (r: Recipe) => r.imageUrl || r.image || r.langdir1 || null;
  const resetFilters = () => { setSearchQuery(""); setSelectedCategory("Все"); scrollViewRef.current?.scrollTo({ y: 0, animated: true }); };

  const navigateToRecipe = (recipe: Recipe) => {
    router.push({ pathname: "/meal", params: { recipeId: recipe.id, mealName: recipe.title, category: getCategoryName(recipe.mealType), calories: (recipe.calories || 0).toString(), proteins: (recipe.proteins || 0).toString(), fats: (recipe.fats || 0).toString(), carbohydrates: (recipe.carbohydrates || 0).toString(), cookingTime: formatCookingTime(recipe.cookingTime), difficultyLevel: recipe.difficultyLevel || "Легко", imageUrl: getImageUrl(recipe) || "" } });
  };

  const handleAdd = (recipe: Recipe) => {
    if (isViewMode) { Alert.alert("Внимание", "В режиме просмотра нельзя редактировать план"); return; }
    if (selectedMeals.some(m => m.recipeId === recipe.id)) { Alert.alert("Внимание", "Рецепт уже добавлен"); return; }
    setSelectedMeals(prev => [...prev, { id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, recipeId: recipe.id, title: recipe.title, category: getCategoryName(recipe.mealType), calories: recipe.calories || 0, proteins: recipe.proteins || 0, fats: recipe.fats || 0, carbohydrates: recipe.carbohydrates || 0, weight: "250г", cookingTime: typeof recipe.cookingTime === 'number' ? recipe.cookingTime : 20, difficultyLevel: recipe.difficultyLevel || "Легко", imageUrl: getImageUrl(recipe) || undefined }]);
    Alert.alert("Успех", "Рецепт добавлен");
  };

  const handleRemove = (id: string) => { if (!isViewMode) setSelectedMeals(prev => prev.filter(m => m.id !== id)); };
  
  const handleArchive = async () => {
    if (!editingPlanId) return;
    const userId = getAuth().currentUser?.uid;
    if (!userId) return;
    const newStatus = planStatus === "archived" ? "template" : "archived";
    await updateDoc(doc(db, 'ration_plans', editingPlanId), { status: newStatus, updatedAt: new Date().toISOString() });
    setPlanStatus(newStatus);
    Alert.alert("Успех", newStatus === "archived" ? "План архивирован" : "План восстановлен");
  };

  const handleSave = async () => {
    if (!templateTitle.trim()) { Alert.alert("Ошибка", "Введите название"); return; }
    if (!selectedMeals.length) { Alert.alert("Ошибка", "Добавьте блюда"); return; }
    try {
      setIsSaving(true);
      const userId = getAuth().currentUser?.uid;
      if (!userId) { Alert.alert("Ошибка", "Пользователь не авторизован"); return; }
      const mealsData = selectedMeals.map(m => ({ id: m.id, recipeId: m.recipeId, name: m.title, category: m.category, calories: m.calories, proteins: m.proteins, fats: m.fats, carbohydrates: m.carbohydrates, weight: m.weight, cookingTime: m.cookingTime, difficultyLevel: m.difficultyLevel, imageUrl: m.imageUrl }));
      const total = selectedMeals.reduce((s, m) => s + m.calories, 0);
      
      if (editingPlanId) {
        await rationPlanService.updateRationPlan(userId, editingPlanId, { title: templateTitle, description: templateDescription || `Шаблон от ${new Date().toLocaleDateString("ru-RU")}`, meals: mealsData, totalCalories: total, mealsCount: selectedMeals.length, updatedAt: new Date().toISOString() });
        const today = new Date().toISOString().split('T')[0];
        const dayQuery = query(collection(db, 'ration_plan_days'), where('userId', '==', userId), where('date', '==', today), where('planId', '==', editingPlanId));
        const daySnap = await getDocs(dayQuery);
        if (!daySnap.empty) await updateDoc(daySnap.docs[0].ref, { meals: mealsData, totalCalories: total, updatedAt: new Date().toISOString() });
        Alert.alert("Успех!", "План обновлен");
      } else {
        await rationPlanService.createRationPlan(userId, { title: templateTitle, description: templateDescription || `Шаблон от ${new Date().toLocaleDateString("ru-RU")}`, type: 'daily', meals: mealsData, days: [{ day: 1, meals: mealsData, stats: { totalCalories: total, totalProteins: selectedMeals.reduce((s, m) => s + m.proteins, 0), totalFats: selectedMeals.reduce((s, m) => s + m.fats, 0), totalCarbs: selectedMeals.reduce((s, m) => s + m.carbohydrates, 0) } }], isTemplate: true, category: "Шаблон", totalCalories: total, mealsCount: selectedMeals.length, status: "template", createdAt: new Date().toISOString() } as any);
        Alert.alert("Успех!", "Шаблон сохранен");
      }
      if (source === "home" || isActivePlan) router.replace("/(tabs)/home");
      else goBack();
    } catch (error: any) { Alert.alert("Ошибка", error.message); } finally { setIsSaving(false); }
  };

  const goBack = () => source === "profile" ? router.push("/(tabs)/profile?tab=saved") : router.push("/saved-plans");

  const renderRecipeCard = (recipe: Recipe) => {
    const isAdded = selectedMeals.some(m => m.recipeId === recipe.id);
    return (
      <View key={recipe.id} style={styles.recipeColumn}>
        <View style={styles.recipeCardContainer}>
          <TouchableOpacity style={styles.recipeCard} onPress={() => navigateToRecipe(recipe)} activeOpacity={0.7}>
            <View style={styles.imageContainer}>
              {getImageUrl(recipe) ? <Image source={{ uri: getImageUrl(recipe)! }} style={styles.recipeImage} /> : <View style={styles.recipeImagePlaceholder}><Ionicons name={getCategoryIcon(recipe.mealType)} size={32} color="#6A9AA9" /></View>}
              <View style={styles.recipeBadges}>
                <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(recipe.difficultyLevel) }]}><Text style={styles.difficultyText}>{recipe.difficultyLevel || "Легко"}</Text></View>
                {recipe.isPublic && <View style={styles.publicBadge}><Ionicons name="earth" size={10} color="#FFF" /></View>}
              </View>
            </View>
            <View style={styles.recipeContent}>
              <Text style={styles.recipeName} numberOfLines={2}>{recipe.title}</Text>
              <Text style={styles.recipeCategory}>{getCategoryName(recipe.mealType)}</Text>
              <View style={styles.recipeDetails}><Text style={styles.recipeCalories}>{recipe.calories || 0} ккал</Text><MaterialIcons name="access-time" size={12} color="#6A9AA9" /><Text style={styles.recipeTime}>{formatCookingTime(recipe.cookingTime)}</Text></View>
              <View style={styles.recipeMacros}><Text style={styles.macroText}>Б: {recipe.proteins || 0}</Text><Text style={styles.macroText}>Ж: {recipe.fats || 0}</Text><Text style={styles.macroText}>У: {recipe.carbohydrates || 0}</Text></View>
            </View>
          </TouchableOpacity>
          {!isViewMode && <TouchableOpacity style={[styles.addButton, isAdded && styles.addButtonAdded]} onPress={() => handleAdd(recipe)} disabled={isAdded}><Text style={[styles.addButtonText, isAdded && styles.addButtonTextAdded]}>{isAdded ? "Добавлено" : "Добавить"}</Text></TouchableOpacity>}
        </View>
      </View>
    );
  };

  if (loadingPlan) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#6A9AA9" /><Text style={styles.loadingText}>Загрузка плана...</Text></View>;

  const total = { calories: selectedMeals.reduce((s, m) => s + m.calories, 0), proteins: selectedMeals.reduce((s, m) => s + m.proteins, 0), fats: selectedMeals.reduce((s, m) => s + m.fats, 0), carbs: selectedMeals.reduce((s, m) => s + m.carbohydrates, 0) };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack}><Ionicons name="arrow-back" size={24} color="#1a1a1a" /></TouchableOpacity>
        <Text style={styles.headerText}>{isViewMode ? "Просмотр плана" : (editingPlanId ? "Редактировать" : "Создать шаблон")}</Text>
        {!isViewMode && editingPlanId && <TouchableOpacity onPress={handleArchive}><Ionicons name={planStatus === "archived" ? "archive-outline" : "archive"} size={24} color={planStatus === "archived" ? "#4CAF50" : "#FF9800"} /></TouchableOpacity>}
        {!isViewMode && !editingPlanId && <View style={{ width: 40 }} />}
      </View>

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6A9AA9"]} />} onScroll={({ nativeEvent }) => { const { layoutMeasurement, contentOffset, contentSize } = nativeEvent; if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 100 && hasMore && !loadingMore) loadMore(); }} scrollEventThrottle={400}>
        
        <View style={styles.form}>
          <Text style={styles.sectionTitle}>Информация</Text>
          {planStatus === "archived" && <View style={styles.archivedWarning}><Ionicons name="archive" size={20} color="#FF9800" /><Text style={styles.archivedText}>План в архиве</Text></View>}
          {isViewMode ? <Text style={styles.viewText}>{templateTitle || "—"}</Text> : <TextInput style={styles.input} placeholder="Название *" value={templateTitle} onChangeText={setTemplateTitle} />}
          {isViewMode ? <Text style={styles.viewText}>{templateDescription || "—"}</Text> : <TextInput style={[styles.input, styles.textArea]} placeholder="Описание" value={templateDescription} onChangeText={setTemplateDescription} multiline />}
        </View>

        {selectedMeals.length > 0 && (
          <View style={styles.form}>
            <View style={styles.row}><Text style={styles.sectionTitle}>Блюда ({selectedMeals.length})</Text>{!isViewMode && <TouchableOpacity onPress={() => setSelectedMeals([])}><Text style={styles.clear}>Очистить</Text></TouchableOpacity>}</View>
            {selectedMeals.map(meal => (
              <View key={meal.id} style={styles.mealItem}>
                <View style={styles.mealInfo}>
                  <Text style={styles.mealTitle}>{meal.title}</Text>
                  <Text style={styles.mealCategory}>{meal.category}</Text>
                  <View style={styles.mealStats}>
                    <Text style={styles.mealCalories}>{meal.calories} ккал</Text>
                    <Text style={styles.mealMacro}>Б: {meal.proteins || 0}</Text>
                    <Text style={styles.mealMacro}>Ж: {meal.fats || 0}</Text>
                    <Text style={styles.mealMacro}>У: {meal.carbohydrates || 0}</Text>
                  </View>
                </View>
                <View style={styles.mealActions}>
                  {!isViewMode && planStatus !== "archived" && <TouchableOpacity style={styles.weightBtn} onPress={() => handleEditWeight(meal)}><Ionicons name="scale-outline" size={16} color="#4CAF50" /><Text style={styles.weightBtnText}>{meal.weight}</Text></TouchableOpacity>}
                  {!isViewMode && <TouchableOpacity onPress={() => handleRemove(meal.id)}><Ionicons name="close" size={20} color="#DC3545" /></TouchableOpacity>}
                </View>
              </View>
            ))}
            <View style={styles.stats}><Text style={styles.statsTitle}>Статистика:</Text><Text style={styles.statsText}>Калории: {total.calories} ккал</Text><Text style={styles.statsText}>Белки: {total.proteins} г | Жиры: {total.fats} г | Углеводы: {total.carbs} г</Text></View>
          </View>
        )}

        {!isViewMode && selectedMeals.length > 0 && planStatus !== "archived" && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>{isSaving ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="save-outline" size={20} color="#FFF" /><Text style={styles.saveBtnText}>{editingPlanId ? "Обновить" : "Сохранить"}</Text></>}</TouchableOpacity>
        )}

        {!isViewMode && planStatus !== "archived" && (
          <View style={styles.form}>
            <View style={styles.row}><Text style={styles.sectionTitle}>Добавить блюда</Text><TouchableOpacity style={styles.sourceBtn} onPress={() => setShowAddRecipeModal(true)}><Text style={styles.sourceBtnText}>{recipeSource === "all" ? "Все" : "Мои"}</Text><Ionicons name="chevron-down" size={16} color="#6A9AA9" /></TouchableOpacity></View>
            <View style={styles.searchContainer}><Feather name="search" size={16} color="#666" /><TextInput style={styles.searchInput} placeholder="Поиск..." value={searchQuery} onChangeText={setSearchQuery} /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cats}>{categories.map(c => <TouchableOpacity key={c} style={[styles.catBtn, selectedCategory === c && styles.catBtnActive]} onPress={() => setSelectedCategory(c)}><Text style={[styles.catText, selectedCategory === c && styles.catTextActive]}>{c}</Text></TouchableOpacity>)}</ScrollView>
            <View style={styles.grid}>
              {loading ? <View style={styles.loadingContainer}><ActivityIndicator color="#6A9AA9" /></View> : !displayedRecipes.length ? <View style={styles.empty}><Ionicons name="restaurant-outline" size={64} color="#C2DAE2" /><Text style={styles.emptyText}>Рецепты не найдены</Text></View> : displayedRecipes.map(renderRecipeCard)}
              {loadingMore && <View style={styles.footerLoader}><ActivityIndicator size="small" color="#6A9AA9" /><Text>Загрузка...</Text></View>}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={showAddRecipeModal} onRequestClose={() => setShowAddRecipeModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Источник</Text><TouchableOpacity onPress={() => setShowAddRecipeModal(false)}><Ionicons name="close" size={24} /></TouchableOpacity></View><ScrollView><TouchableOpacity style={[styles.modalOption, recipeSource === "all" && styles.modalOptionActive]} onPress={() => { setRecipeSource("all"); setShowAddRecipeModal(false); }}><Ionicons name="search" size={24} color="#6A9AA9" /><Text style={styles.modalOptionText}>Все рецепты</Text></TouchableOpacity><TouchableOpacity style={[styles.modalOption, recipeSource === "user" && styles.modalOptionActive]} onPress={() => { setRecipeSource("user"); setShowAddRecipeModal(false); }}><Ionicons name="book" size={24} color="#FF9800" /><Text style={styles.modalOptionText}>Мои рецепты</Text></TouchableOpacity></ScrollView></View></View>
      </Modal>

      <Modal visible={showWeightModal} transparent animationType="fade" onRequestClose={() => setShowWeightModal(false)}>
        <View style={styles.modalOverlay}><View style={styles.weightModal}><View style={styles.weightModalHeader}><Text style={styles.weightModalTitle}>Изменить вес</Text><TouchableOpacity onPress={() => setShowWeightModal(false)}><Ionicons name="close" size={24} color="#666" /></TouchableOpacity></View><View style={styles.weightModalContent}><Text style={styles.weightModalText}>{editingMeal?.title}</Text><Text style={styles.weightModalSubtext}>Текущий: {editingMeal?.weight}</Text><View style={styles.weightInputContainer}><TextInput style={styles.weightInput} value={newWeight} onChangeText={setNewWeight} keyboardType="numeric" placeholder="Вес" /><Text style={styles.weightUnit}>гр</Text></View><Text style={styles.weightHint}>КБЖУ пересчитаются автоматически</Text><View style={styles.weightModalButtons}><TouchableOpacity style={[styles.weightBtnModal, styles.weightBtnCancel]} onPress={() => setShowWeightModal(false)}><Text style={styles.weightBtnCancelText}>Отмена</Text></TouchableOpacity><TouchableOpacity style={[styles.weightBtnModal, styles.weightBtnSave]} onPress={handleSaveWeight}><Text style={styles.weightBtnSaveText}>Сохранить</Text></TouchableOpacity></View></View></View></View>
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
  input: { borderWidth: 1, borderColor: "#C2DAE2", borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "Playfair Display Regular" },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  viewText: { fontSize: 16, padding: 12, backgroundColor: "#F5F5F5", borderRadius: 8, fontFamily: "Playfair Display Regular" },
  archivedWarning: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF3E0", padding: 12, borderRadius: 8, marginBottom: 16, gap: 8 },
  archivedText: { fontSize: 14, color: "#FF9800", fontFamily: "Playfair Display Regular", flex: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  clear: { fontSize: 14, color: "#DC3545", fontFamily: "Playfair Display Regular" },
  mealItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F8F9FA", padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: "#E9ECEF" },
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
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#6A9AA9", padding: 16, borderRadius: 12, gap: 8, margin: 16 },
  saveBtnText: { fontSize: 16, color: "#FFF", fontFamily: "Playfair Display Bold" },
  sourceBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#E5F0F5", borderRadius: 20, borderWidth: 1, borderColor: "#C2DAE2" },
  sourceBtnText: { fontSize: 12, color: "#6A9AA9", fontFamily: "Playfair Display Regular" },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", borderRadius: 30, borderWidth: 1, borderColor: "#C2DAE2", paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 4, fontFamily: "Playfair Display Regular" },
  cats: { marginBottom: 16 },
  catBtn: { backgroundColor: "white", borderWidth: 1, borderColor: "#C2DAE2", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginRight: 8 },
  catBtnActive: { backgroundColor: "#9BDF11", borderColor: "#9BDF11" },
  catText: { fontSize: 12, color: "#000", fontFamily: "Playfair Display Regular" },
  catTextActive: { color: "#000" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  recipeColumn: { width: CARD_WIDTH, marginBottom: 16 },
  recipeCardContainer: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  recipeCard: { padding: 0 },
  imageContainer: { position: "relative", height: 120, backgroundColor: "#F8F8F8", justifyContent: "center", alignItems: "center" },
  recipeImage: { width: "100%", height: "100%" },
  recipeImagePlaceholder: { width: "100%", height: "100%", backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center" },
  recipeBadges: { position: "absolute", top: 8, left: 8, flexDirection: "column", gap: 4 },
  difficultyBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  difficultyText: { fontSize: 9, fontWeight: "bold", color: "#FFF", fontFamily: "Playfair Display Regular" },
  publicBadge: { backgroundColor: "rgba(74,144,226,0.9)", paddingHorizontal: 5, paddingVertical: 3, borderRadius: 10 },
  recipeContent: { padding: 12 },
  recipeName: { fontSize: 14, fontWeight: "600", color: "#212529", marginBottom: 4, fontFamily: "Playfair Display Regular", lineHeight: 18, minHeight: 36 },
  recipeCategory: { fontSize: 11, color: "#6A9AA9", fontFamily: "Playfair Display Regular", marginBottom: 4 },
  recipeDetails: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 4 },
  recipeCalories: { fontSize: 12, color: "#000", fontFamily: "Playfair Display Bold", marginRight: 8 },
  recipeTime: { fontSize: 12, color: "#6C757D", fontFamily: "Playfair Display Regular" },
  recipeMacros: { flexDirection: "row", gap: 12, marginTop: 4, flexWrap: "wrap" },
  macroText: { fontSize: 10, color: "#6A9AA9", fontFamily: "Playfair Display Medium" },
  addButton: { backgroundColor: "#9BDF11", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignItems: "center", marginHorizontal: 12, marginBottom: 12 },
  addButtonAdded: { backgroundColor: "#C2DAE2" },
  addButtonText: { color: "#000", fontSize: 12, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  addButtonTextAdded: { color: "#666" },
  empty: { width: "100%", alignItems: "center", padding: 40, marginTop: 20 },
  emptyText: { fontSize: 18, color: "#6C757D", fontFamily: "Playfair Display Regular", marginTop: 16, textAlign: "center" },
  footerLoader: { width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 20, gap: 10 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modal: { backgroundColor: "#FFF", borderRadius: 20, width: "90%", overflow: "hidden" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  modalTitle: { fontSize: 18, fontFamily: "Playfair Display Bold", color: "#1a1a1a" },
  modalOption: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F8F8", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E0E0E0" },
  modalOptionActive: { backgroundColor: "#E5F0F5", borderColor: "#6A9AA9" },
  modalOptionText: { fontSize: 16, marginLeft: 12, flex: 1, fontFamily: "Playfair Display Regular" },
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