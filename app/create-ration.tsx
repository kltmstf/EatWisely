// app/create-ration.tsx
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Alert,
  Image,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Modal,
} from "react-native";
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { recipeService } from "@/app/services/recipeService";
import { rationPlanService, RationPlan } from "@/app/services/rationPlanService";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/app/firebase/config';

type Recipe = {
  id: string;
  title: string;
  description?: string;
  mealType?: string;
  category?: string;
  calories?: number;
  cookingTime?: string | number;
  difficultyLevel?: string;
  difficulty?: string;
  ingredients?: string[];
  instructions?: string[];
  image?: string;
  imageUrl?: string;
  langdir1?: string;
  createdAt: any;
  updatedAt: any;
  userId: string;
  isPublic?: boolean;
  likesCount?: number;
  savesCount?: number;
  averageRating?: number;
  rating?: number; 
};

type MealInTemplate = {
  id: string;
  recipeId: string;
  title: string;
  category: string;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  weight: string;
  cookingTime: number;
  difficultyLevel: string;
  imageUrl?: string;
};

const categories = ["Все", "Завтрак", "Обед", "Ужин", "Перекусы"];
const RECIPES_PER_PAGE = 6;
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2;

const getCategoryName = (mealType?: string): string => {
  if (!mealType) return "Другое";
  const normalizedMealType = String(mealType).trim().toLowerCase();
  switch (normalizedMealType) {
    case "breakfast":
    case "завтрак":
      return "Завтрак";
    case "lunch":
    case "обед":
      return "Обед";
    case "dinner":
    case "ужин":
      return "Ужин";
    case "snack":
    case "перекусы":
      return "Перекусы";
    default:
      return "Другое";
  }
};

const formatCookingTime = (time: any): string => {
  if (!time) return "20 мин";
  if (typeof time === 'number') {
    const minutes = Math.abs(time);
    const lastDigit = minutes % 10;
    const lastTwoDigits = minutes % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return `${minutes} минут`;
    if (lastDigit === 1) return `${minutes} минута`;
    if (lastDigit >= 2 && lastDigit <= 4) return `${minutes} минуты`;
    return `${minutes} минут`;
  }
  const strTime = String(time);
  return strTime;
};

export default function CreateRationScreen() {
  const router = useRouter();
  const { planId, mode, source } = useLocalSearchParams();
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

  useEffect(() => {
    if ((mode === "edit" || mode === "view") && planId) {
      loadPlanForEditing();
      if (mode === "view") {
        setIsViewMode(true);
      }
    }
  }, [planId, mode]);

  const loadPlanForEditing = async () => {
    try {
      setLoadingPlan(true);
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Ошибка", "Пользователь не авторизован");
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const activePlan = await rationPlanService.getActivePlanForToday(userId);
      
      let loadedMeals: MealInTemplate[] = [];
      
      // Если это активный план на сегодня, загружаем из daily_plans
      if (activePlan && activePlan.id === planId) {
        console.log("Загрузка активного плана из daily_plans");
        setIsActivePlan(true);
        const dailyPlanRef = doc(db, 'users', userId, 'daily_plans', today);
        const dailyPlanSnap = await getDoc(dailyPlanRef);
        
        if (dailyPlanSnap.exists()) {
          const dailyMeals = dailyPlanSnap.data().meals || [];
          loadedMeals = dailyMeals.map((meal: any) => ({
            id: meal.id || `meal-${Date.now()}-${Math.random()}`,
            recipeId: meal.recipeId || meal.id,
            title: meal.name || meal.title || "Без названия",
            category: meal.category || "Обед",
            calories: meal.calories || 0,
            proteins: meal.proteins || 0,
            fats: meal.fats || 0,
            carbohydrates: meal.carbohydrates || 0,
            weight: meal.weight || "250г",
            cookingTime: meal.cookingTime || 20,
            difficultyLevel: meal.difficultyLevel || "Легко",
            imageUrl: meal.imageUrl,
          }));
          
          setTemplateTitle(activePlan.title || "Активный план");
          setTemplateDescription(activePlan.description || "Активный план на сегодня");
          setEditingPlanId(activePlan.id || null);
          setPlanStatus(activePlan.status as any || "active");
        }
      } else {
        setIsActivePlan(false);
        // Обычная загрузка из ration_plans
        const plan = await rationPlanService.getRationPlanById(planId as string, userId);
        if (plan && plan.days && plan.days[0] && plan.days[0].meals) {
          loadedMeals = plan.days[0].meals.map((meal: any) => ({
            id: meal.id || `meal-${Date.now()}-${Math.random()}`,
            recipeId: meal.recipeId || meal.id,
            title: meal.name || meal.title || "Без названия",
            category: meal.category || "Обед",
            calories: meal.calories || 0,
            proteins: meal.proteins || 0,
            fats: meal.fats || 0,
            carbohydrates: meal.carbohydrates || 0,
            weight: meal.weight || "250г",
            cookingTime: meal.cookingTime || 20,
            difficultyLevel: meal.difficultyLevel || "Легко",
            imageUrl: meal.imageUrl,
          }));
          setTemplateTitle(plan.title || "План питания");
          setTemplateDescription(plan.description || "Описание плана");
          setEditingPlanId(plan.id || null);
          setPlanStatus((plan.status as any) || "template");
        } else if (plan) {
          setTemplateTitle(plan.title || "План питания");
          setTemplateDescription(plan.description || "Описание плана");
          setEditingPlanId(plan.id || null);
          setPlanStatus((plan.status as any) || "template");
        }
      }
      
      setSelectedMeals(loadedMeals);
      
      if (mode !== "view" && loadedMeals.length > 0) {
        Alert.alert("Успех", `План загружен для ${mode === "edit" ? "редактирования" : "просмотра"} (${loadedMeals.length} блюд)`);
      }
    } catch (error) {
      console.error("Error loading plan:", error);
      Alert.alert("Ошибка", "Не удалось загрузить план");
    } finally {
      setLoadingPlan(false);
    }
  };

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true);
      let loadedRecipes: any[] = [];
      if (recipeSource === "user") {
        loadedRecipes = await recipeService.getUserRecipes();
      } else {
        loadedRecipes = await recipeService.getPublicRecipes();
      }
      
      const formattedRecipes: Recipe[] = loadedRecipes.map((recipe: any) => ({
        id: recipe.id,
        title: recipe.title || "Без названия",
        description: recipe.description || "",
        mealType: recipe.mealType,
        category: getCategoryName(recipe.mealType),
        calories: recipe.calories || 0,
        cookingTime: recipe.cookingTime,
        difficultyLevel: recipe.difficultyLevel || recipe.difficulty || "Легко",
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        image: recipe.image,
        imageUrl: recipe.imageUrl,
        langdir1: recipe.langdir1,
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
        userId: recipe.userId,
        isPublic: recipe.isPublic || false,
        likesCount: recipe.likesCount || 0,
        savesCount: recipe.savesCount || 0,
        averageRating: recipe.averageRating || 0,
      }));
      
      formattedRecipes.sort((a, b) => {
        const aTime = getTimestamp(a.createdAt);
        const bTime = getTimestamp(b.createdAt);
        return bTime - aTime;
      });

      setRecipes(formattedRecipes);
      setPage(0);
      setHasMore(true);
      setDisplayedRecipes([]);
    } catch (error) {
      console.error("Ошибка загрузки рецептов:", error);
      Alert.alert("Ошибка", "Не удалось загрузить рецепты");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [recipeSource]);

  useEffect(() => {
    loadRecipes();
  }, [recipeSource]);

  useEffect(() => {
    let filtered = [...recipes];
    if (selectedCategory !== "Все") {
      filtered = filtered.filter(recipe => {
        const recipeCategory = getCategoryName(recipe.mealType);
        return recipeCategory.toLowerCase() === selectedCategory.toLowerCase();
      });
    }
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(recipe =>
        recipe.title?.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query)
      );
    }
    setFilteredRecipes(filtered);
    setPage(0);
    setHasMore(filtered.length > RECIPES_PER_PAGE);
    setDisplayedRecipes(filtered.slice(0, RECIPES_PER_PAGE));
  }, [recipes, selectedCategory, searchQuery]);

  const loadMoreRecipes = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const endIndex = (nextPage + 1) * RECIPES_PER_PAGE;
    const newDisplayed = filteredRecipes.slice(0, endIndex);
    setDisplayedRecipes(newDisplayed);
    setPage(nextPage);
    if (endIndex >= filteredRecipes.length) {
      setHasMore(false);
    }
    setLoadingMore(false);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 100;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    if (isCloseToBottom && hasMore && !loadingMore) {
      loadMoreRecipes();
    }
  };

  const getTimestamp = (dateInput: any): number => {
    if (!dateInput) return 0;
    if (typeof dateInput === 'string') return new Date(dateInput).getTime();
    if (dateInput?.seconds) return dateInput.seconds * 1000;
    if (typeof dateInput === 'number') return dateInput;
    return 0;
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRecipes();
  }, [loadRecipes]);

  const getDifficultyColor = (difficulty?: string) => {
    if (!difficulty) return "#6A9AA9";
    const lowerDifficulty = difficulty.toLowerCase();
    if (lowerDifficulty.includes("легк") || lowerDifficulty === "easy") return "#4CAF50";
    if (lowerDifficulty.includes("средн") || lowerDifficulty === "medium") return "#FF9800";
    if (lowerDifficulty.includes("сложн") || lowerDifficulty === "hard") return "#F44336";
    return "#6A9AA9";
  };

  const getCategoryIcon = (mealType?: string) => {
    const category = getCategoryName(mealType);
    switch (category.toLowerCase()) {
      case "завтрак": return "sunny-outline";
      case "обед": return "restaurant-outline";
      case "ужин": return "moon-outline";
      case "перекусы": return "cafe-outline";
      default: return "fast-food-outline";
    }
  };

  const getImageUrl = (recipe: Recipe) => {
    return recipe.imageUrl || recipe.image || recipe.langdir1 || null;
  };

  const resetFiltersAndScroll = () => {
    setSearchQuery("");
    setSelectedCategory("Все");
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleAddToTemplate = (recipe: Recipe) => {
    if (isViewMode) {
      Alert.alert("Внимание", "В режиме просмотра нельзя редактировать план");
      return;
    }
    const isAlreadyAdded = selectedMeals.some(meal => meal.recipeId === recipe.id);
    if (isAlreadyAdded) {
      Alert.alert("Внимание", "Этот рецепт уже добавлен в шаблон");
      return;
    }
    const newMeal: MealInTemplate = {
      id: `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      recipeId: recipe.id,
      title: recipe.title,
      category: getCategoryName(recipe.mealType),
      calories: recipe.calories || 300,
      proteins: 0,
      fats: 0,
      carbohydrates: 0,
      weight: "250г",
      cookingTime: typeof recipe.cookingTime === 'number' ? recipe.cookingTime : 20,
      difficultyLevel: recipe.difficultyLevel || recipe.difficulty || "Легко",
      imageUrl: recipe.imageUrl,
    };
    setSelectedMeals(prev => [...prev, newMeal]);
    Alert.alert("Успех", "Рецепт добавлен в шаблон");
  };

  const handleRemoveFromTemplate = (mealId: string) => {
    if (isViewMode) {
      Alert.alert("Внимание", "В режиме просмотра нельзя редактировать план");
      return;
    }
    setSelectedMeals(prev => prev.filter(meal => meal.id !== mealId));
  };

  const handleArchivePlan = async () => {
    if (!editingPlanId) return;
    
    try {
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      
      const newStatus = planStatus === "archived" ? "template" : "archived";
      await rationPlanService.updateRationPlan(userId, editingPlanId, { status: newStatus });
      setPlanStatus(newStatus);
      Alert.alert("Успех", newStatus === "archived" ? "План архивирован" : "План восстановлен из архива");
    } catch (error) {
      console.error("Ошибка архивации:", error);
      Alert.alert("Ошибка", "Не удалось изменить статус плана");
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateTitle.trim()) {
      Alert.alert("Ошибка", "Введите название шаблона");
      return;
    }
    if (selectedMeals.length === 0) {
      Alert.alert("Ошибка", "Добавьте хотя бы один рецепт в шаблон");
      return;
    }
    try {
      setIsSaving(true);
      const auth = getAuth();
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Ошибка", "Пользователь не авторизован");
        return;
      }

      if (editingPlanId) {
        // Обновление существующего плана
        const updateData = {
          title: templateTitle,
          description: templateDescription || `Шаблон рациона от ${new Date().toLocaleDateString("ru-RU")}`,
          days: [{
            day: 1,
            meals: selectedMeals.map(meal => ({
              id: meal.id,
              recipeId: meal.recipeId,
              name: meal.title,
              category: meal.category,
              calories: meal.calories,
              proteins: meal.proteins || 0,
              fats: meal.fats || 0,
              carbohydrates: meal.carbohydrates || 0,
              weight: meal.weight,
              cookingTime: meal.cookingTime,
              difficultyLevel: meal.difficultyLevel,
              imageUrl: meal.imageUrl,
            })),
            stats: {
              totalCalories: selectedMeals.reduce((sum, meal) => sum + meal.calories, 0),
              totalProteins: selectedMeals.reduce((sum, meal) => sum + meal.proteins, 0),
              totalFats: selectedMeals.reduce((sum, meal) => sum + meal.fats, 0),
              totalCarbs: selectedMeals.reduce((sum, meal) => sum + meal.carbohydrates, 0),
              totalCookingTime: selectedMeals.reduce((sum, meal) => sum + (meal.cookingTime || 0), 0),
            }
          }],
          totalCalories: selectedMeals.reduce((sum, meal) => sum + meal.calories, 0),
          mealsCount: selectedMeals.length,
          updatedAt: new Date().toISOString()
        };
        
        await rationPlanService.updateRationPlan(userId, editingPlanId, updateData);
        
        // Если это активный план, обновляем daily_plans
        if (isActivePlan) {
          const today = new Date().toISOString().split('T')[0];
          const dailyPlanRef = doc(db, 'users', userId, 'daily_plans', today);
          await setDoc(dailyPlanRef, {
            meals: selectedMeals.map(meal => ({
              id: meal.id,
              category: meal.category,
              name: meal.title,
              calories: meal.calories,
              proteins: meal.proteins || 0,
              fats: meal.fats || 0,
              carbohydrates: meal.carbohydrates || 0,
              weight: meal.weight,
              marked: false,
              cookingTime: meal.cookingTime,
              difficultyLevel: meal.difficultyLevel,
              rating: 0,
              recipeId: meal.recipeId,
              isCustom: false,
              canBeRemoved: true,
              imageUrl: meal.imageUrl,
              addedAt: new Date().toISOString()
            })),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
        
        Alert.alert("Успех!", "План успешно обновлен");
      } else {
        // Создание нового плана
        const templateData = {
          title: templateTitle,
          description: templateDescription || `Шаблон рациона от ${new Date().toLocaleDateString("ru-RU")}`,
          type: 'daily' as const,
          days: [{
            day: 1,
            meals: selectedMeals.map(meal => ({
              id: meal.id,
              recipeId: meal.recipeId,
              name: meal.title,
              category: meal.category,
              calories: meal.calories,
              proteins: meal.proteins || 0,
              fats: meal.fats || 0,
              carbohydrates: meal.carbohydrates || 0,
              weight: meal.weight,
              cookingTime: meal.cookingTime,
              difficultyLevel: meal.difficultyLevel,
              imageUrl: meal.imageUrl,
            })),
            stats: {
              totalCalories: selectedMeals.reduce((sum, meal) => sum + meal.calories, 0),
              totalProteins: selectedMeals.reduce((sum, meal) => sum + meal.proteins, 0),
              totalFats: selectedMeals.reduce((sum, meal) => sum + meal.fats, 0),
              totalCarbs: selectedMeals.reduce((sum, meal) => sum + meal.carbohydrates, 0),
              totalCookingTime: selectedMeals.reduce((sum, meal) => sum + (meal.cookingTime || 0), 0),
            }
          }],
          isTemplate: true,
          category: "Шаблон",
          totalCalories: selectedMeals.reduce((sum, meal) => sum + meal.calories, 0),
          totalDuration: "1 день",
          mealsCount: selectedMeals.length,
          status: "template" as const,
        };
        
        await rationPlanService.createRationPlan(userId, templateData);
        Alert.alert("Успех!", "Шаблон рациона успешно сохранен");
      }
      
      goBack();
      
    } catch (error: any) {
      console.error("Error saving template:", error);
      Alert.alert("Ошибка", error.message || "Не удалось сохранить шаблон");
    } finally {
      setIsSaving(false);
    }
  };

  const goBack = () => {
    if (source === "profile") {
      router.push("/(tabs)/profile?tab=saved");
    } else {
      router.push("/saved-plans");
    }
  };

  const FooterLoader = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6A9AA9" />
        <Text style={styles.footerLoaderText}>Загрузка...</Text>
      </View>
    );
  };

  const renderRecipeCard = (recipe: Recipe) => {
    const imageUrl = getImageUrl(recipe);
    const categoryName = getCategoryName(recipe.mealType);
    const cookingTime = formatCookingTime(recipe.cookingTime);
    const difficulty = recipe.difficultyLevel || recipe.difficulty || "Легко";
    const isAdded = selectedMeals.some(meal => meal.recipeId === recipe.id);

    return (
      <View key={recipe.id} style={styles.recipeColumn}>
        <TouchableOpacity
          style={[styles.recipeCard, isViewMode && styles.disabledCard]}
          onPress={() => handleAddToTemplate(recipe)}
          disabled={isViewMode || isAdded}
        >
          <View style={styles.imageContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={styles.recipeImage} resizeMode="cover" />
            ) : (
              <View style={styles.recipeImagePlaceholder}>
                <Ionicons name={getCategoryIcon(recipe.mealType)} size={32} color="#6A9AA9" />
              </View>
            )}
            <View style={styles.recipeBadges}>
              <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(difficulty) }]}>
                <Text style={styles.difficultyText}>{difficulty}</Text>
              </View>
              {recipe.isPublic && (
                <View style={styles.publicBadge}>
                  <Ionicons name="earth" size={10} color="#FFFFFF" />
                </View>
              )}
              {isAdded && (
                <View style={styles.addedBadge}>
                  <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                </View>
              )}
            </View>
          </View>
          <View style={styles.recipeContent}>
            <View style={styles.recipeInfo}>
              <Text style={styles.recipeName} numberOfLines={2} ellipsizeMode="tail">
                {recipe.title}
              </Text>
              <Text style={styles.recipeCategory}>{categoryName}</Text>
              <View style={styles.recipeDetails}>
                {recipe.calories && recipe.calories > 0 && (
                  <Text style={styles.recipeCalories}>{recipe.calories} ккал</Text>
                )}
                <MaterialIcons name="access-time" size={12} color="#6A9AA9" style={styles.timeIcon} />
                <Text style={styles.recipeTime}>{cookingTime}</Text>
              </View>
            </View>
            {!isViewMode && (
              <TouchableOpacity
                style={[styles.selectButton, isAdded && styles.selectButtonAdded]}
                onPress={() => handleAddToTemplate(recipe)}
                disabled={isAdded}
              >
                <Text style={[styles.selectButtonText, isAdded && styles.selectButtonTextAdded]}>
                  {isAdded ? "Добавлено" : "Добавить"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const AddRecipeModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showAddRecipeModal}
      onRequestClose={() => setShowAddRecipeModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Добавить рецепт в шаблон</Text>
            <TouchableOpacity onPress={() => setShowAddRecipeModal(false)} style={styles.modalCloseButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalText}>Откуда вы хотите добавить рецепт?</Text>
            <TouchableOpacity
              style={[styles.modalOption, recipeSource === "all" && styles.modalOptionActive]}
              onPress={() => { setRecipeSource("all"); setShowAddRecipeModal(false); }}
            >
              <Ionicons name="search" size={24} color="#6A9AA9" />
              <Text style={styles.modalOptionText}>Из всех рецептов</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, recipeSource === "user" && styles.modalOptionActive]}
              onPress={() => { setRecipeSource("user"); setShowAddRecipeModal(false); }}
            >
              <Ionicons name="book" size={24} color="#FF9800" />
              <Text style={styles.modalOptionText}>Из моих рецептов</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (loadingPlan) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>Загрузка плана...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.simpleHeader}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.simpleHeaderText}>
          {isViewMode ? "Просмотр плана" : (editingPlanId ? "Редактировать шаблон" : "Создать шаблон рациона")}
        </Text>
        {!isViewMode && editingPlanId && (
          <TouchableOpacity style={styles.archiveButton} onPress={handleArchivePlan}>
            <Ionicons 
              name={planStatus === "archived" ? "archive-outline" : "archive"} 
              size={24} 
              color={planStatus === "archived" ? "#4CAF50" : "#FF9800"} 
            />
          </TouchableOpacity>
        )}
        {!isViewMode && !editingPlanId && <View style={styles.addRecipePlaceholder} />}
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6A9AA9"]} tintColor="#6A9AA9" />}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.templateForm}>
          <Text style={styles.sectionTitle}>Информация о шаблоне</Text>
          
          {planStatus === "archived" && (
            <View style={styles.archivedWarning}>
              <Ionicons name="archive" size={20} color="#FF9800" />
              <Text style={styles.archivedWarningText}>Этот план находится в архиве</Text>
            </View>
          )}
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Название *</Text>
            {isViewMode ? (
              <Text style={styles.viewText}>{templateTitle || "—"}</Text>
            ) : (
              <TextInput
                style={styles.textInput}
                placeholder="Например: Здоровый завтрак"
                value={templateTitle}
                onChangeText={setTemplateTitle}
              />
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Описание (необязательно)</Text>
            {isViewMode ? (
              <Text style={styles.viewText}>{templateDescription || "—"}</Text>
            ) : (
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="Опишите ваш шаблон..."
                value={templateDescription}
                onChangeText={setTemplateDescription}
                multiline
                numberOfLines={3}
              />
            )}
          </View>

          {selectedMeals.length > 0 && (
            <View style={styles.selectedMealsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Выбранные блюда ({selectedMeals.length})</Text>
                {!isViewMode && (
                  <TouchableOpacity onPress={() => setSelectedMeals([])}>
                    <Text style={styles.clearButton}>Очистить</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {selectedMeals.map(meal => (
                <View key={meal.id} style={styles.selectedMealItem}>
                  <View style={styles.selectedMealInfo}>
                    <Text style={styles.selectedMealTitle}>{meal.title}</Text>
                    <Text style={styles.selectedMealCategory}>{meal.category}</Text>
                    <Text style={styles.selectedMealCalories}>{meal.calories} ккал</Text>
                  </View>
                  {!isViewMode && (
                    <TouchableOpacity style={styles.removeButton} onPress={() => handleRemoveFromTemplate(meal.id)}>
                      <Ionicons name="close" size={20} color="#DC3545" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <View style={styles.templateStats}>
                <Text style={styles.statsTitle}>Статистика шаблона:</Text>
                <Text style={styles.statsText}>
                  Всего калорий: {selectedMeals.reduce((sum, meal) => sum + meal.calories, 0)} ккал
                </Text>
                <Text style={styles.statsText}>
                  Количество блюд: {selectedMeals.length}
                </Text>
              </View>
            </View>
          )}

          {!isViewMode && selectedMeals.length > 0 && planStatus !== "archived" && (
            <TouchableOpacity style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSaveTemplate} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>{editingPlanId ? "Обновить шаблон" : "Сохранить шаблон"}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          {!isViewMode && selectedMeals.length > 0 && planStatus === "archived" && (
            <TouchableOpacity style={[styles.saveButton, styles.saveButtonDisabled]} disabled={true}>
              <Text style={styles.saveButtonText}>Архивный план нельзя редактировать</Text>
            </TouchableOpacity>
          )}
          
          {isViewMode && (
            <View style={styles.viewModeMessage}>
              <Ionicons name="eye-outline" size={24} color="#6A9AA9" />
              <Text style={styles.viewModeMessageText}>
                Режим просмотра
              </Text>
            </View>
          )}
        </View>

        {!isViewMode && planStatus !== "archived" && (
          <View style={styles.recipesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Добавить блюда в шаблон</Text>
              <TouchableOpacity style={styles.sourceButton} onPress={() => setShowAddRecipeModal(true)}>
                <Text style={styles.sourceButtonText}>{recipeSource === "all" ? "Все рецепты" : "Мои рецепты"}</Text>
                <Ionicons name="chevron-down" size={16} color="#6A9AA9" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchInputContainer}>
                <Feather name="search" size={16} color="#666" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Поиск рецептов..."
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {(searchQuery || selectedCategory !== "Все") && (
                  <TouchableOpacity onPress={resetFiltersAndScroll} style={styles.clearFilterButton}>
                    <Feather name="x" size={16} color="#666" />
                  </TouchableOpacity>
                )}
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

            <View style={styles.recipesGrid}>
              {loading && !refreshing ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#6A9AA9" />
                  <Text style={styles.loadingText}>Загрузка рецептов...</Text>
                </View>
              ) : displayedRecipes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="restaurant-outline" size={64} color="#C2DAE2" />
                  <Text style={styles.emptyStateText}>
                    {searchQuery || selectedCategory !== "Все" ? "Рецепты не найдены" : recipeSource === "user" ? "У вас пока нет рецептов" : "Рецепты не найдены"}
                  </Text>
                  <Text style={styles.emptyStateSubtext}>
                    {searchQuery || selectedCategory !== "Все" ? "Попробуйте изменить параметры поиска" : recipeSource === "user" ? "Создайте свой первый рецепт!" : "Попробуйте выбрать другой источник"}
                  </Text>
                </View>
              ) : (
                <>
                  {displayedRecipes.map((recipe) => renderRecipeCard(recipe))}
                  <FooterLoader />
                </>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <AddRecipeModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },

  simpleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backButton: {
    padding: 8,
  },
  simpleHeaderText: {
    fontSize: 18,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    textAlign: "center",
    flex: 1,
  },
  addRecipePlaceholder: {
    width: 40,
  },
  archiveButton: {
    padding: 8,
  },
  archivedWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  archivedWarningText: {
    fontSize: 14,
    color: "#FF9800",
    fontFamily: "Playfair Display Regular",
    flex: 1,
  },

  templateForm: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  sectionTitle: {
    fontSize: 18,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#C2DAE2",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Regular",
    backgroundColor: "#FFFFFF",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  viewText: {
    fontSize: 16,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Regular",
    padding: 12,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
  },
  selectedMealsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  clearButton: {
    fontSize: 14,
    color: "#DC3545",
    fontFamily: "Playfair Display Regular",
  },
  selectedMealItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E9ECEF",
  },
  selectedMealInfo: {
    flex: 1,
  },
  selectedMealTitle: {
    fontSize: 14,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    marginBottom: 4,
  },
  selectedMealCategory: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    marginBottom: 4,
  },
  selectedMealCalories: {
    fontSize: 12,
    color: "#666",
    fontFamily: "Playfair Display Regular",
  },
  removeButton: {
    padding: 4,
  },
  templateStats: {
    backgroundColor: "#E5F0F5",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  statsTitle: {
    fontSize: 14,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Bold",
    marginBottom: 8,
  },
  statsText: {
    fontSize: 13,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginBottom: 4,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#6A9AA9",
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
    backgroundColor: "#C2DAE2",
  },
  saveButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontFamily: "Playfair Display Bold",
  },
  viewModeMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E5F0F5",
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 12,
  },
  viewModeMessageText: {
    flex: 1,
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },

  recipesSection: {
    padding: 16,
    backgroundColor: "#FFFFFF",
  },
  sourceButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#E5F0F5",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#C2DAE2",
  },
  sourceButtonText: {
    fontSize: 12,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#C2DAE2",
    paddingHorizontal: 12,
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
  clearFilterButton: {
    padding: 4,
    marginLeft: 8,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoryButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#C2DAE2",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  categoryText: {
    fontSize: 12,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
  },
  categoryTextActive: {
    color: "#000000",
  },
  recipesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  recipeColumn: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  recipeCard: {
    backgroundColor: "#C2DAE2",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    height: 260,
  },
  disabledCard: {
    opacity: 0.6,
  },
  imageContainer: {
    position: "relative",
    height: 120,
    backgroundColor: "#F8F8F8",
    justifyContent: "center",
    alignItems: "center",
  },
  recipeImage: {
    width: "100%",
    height: "100%",
  },
  recipeImagePlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E5F0F5",
    justifyContent: "center",
    alignItems: "center",
  },
  recipeBadges: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "column",
    gap: 4,
  },
  difficultyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: "Playfair Display Regular",
  },
  publicBadge: {
    backgroundColor: "rgba(74, 144, 226, 0.9)",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  addedBadge: {
    backgroundColor: "rgba(76, 175, 80, 0.9)",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  recipeContent: {
    padding: 12,
    flex: 1,
    justifyContent: "space-between",
  },
  recipeInfo: {
    flex: 1,
    marginBottom: 8,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
    marginBottom: 4,
    fontFamily: "Playfair Display Regular",
    lineHeight: 18,
    minHeight: 36,
  },
  recipeCategory: {
    fontSize: 11,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
    fontStyle: "italic",
    marginBottom: 6,
  },
  recipeDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  recipeCalories: {
    fontSize: 12,
    color: "#000000",
    fontWeight: "normal",
    fontFamily: "Playfair Display Bold",
    marginRight: 8,
  },
  timeIcon: {
    marginRight: 4,
  },
  recipeTime: {
    fontSize: 12,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
  },
  selectButton: {
    backgroundColor: "#9BDF11",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    marginTop: 8,
  },
  selectButtonAdded: {
    backgroundColor: "#C2DAE2",
  },
  selectButtonText: {
    color: "#000000ff",
    fontSize: 12,
    fontWeight: "normal",
    fontFamily: "Playfair Display Regular",
  },
  selectButtonTextAdded: {
    color: "#666",
  },
  emptyState: {
    width: "100%",
    alignItems: "center",
    padding: 40,
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    marginBottom: 8,
    marginTop: 16,
    textAlign: "center",
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6C757D",
    fontFamily: "Playfair Display Regular",
    textAlign: "center",
    marginBottom: 24,
  },
  footerLoader: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
  },
  footerLoaderText: {
    fontSize: 14,
    color: "#6A9AA9",
    fontFamily: "Playfair Display Regular",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "90%",
    maxHeight: "60%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Playfair Display Bold",
    color: "#1a1a1a",
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 20,
  },
  modalText: {
    fontSize: 16,
    color: "#666",
    fontFamily: "Playfair Display Regular",
    marginBottom: 20,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  modalOptionActive: {
    backgroundColor: "#E5F0F5",
    borderColor: "#6A9AA9",
  },
  modalOptionText: {
    fontSize: 16,
    color: "#1a1a1a",
    fontFamily: "Playfair Display Regular",
    marginLeft: 12,
    flex: 1,
  },
});