import { Feather, FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import { doc, Firestore, getDoc, getFirestore, onSnapshot, collection, query, where, getDocs, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Image, Modal, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { favoriteService } from "@/app/services/favoriteService";
import { rationPlanService } from "@/app/services/rationPlanService";
import { dailyRationService } from "@/app/services/rationService";

declare const __firebase_config: string | undefined;

interface Meal { 
  id: string; 
  category: string; 
  name: string; 
  calories: number; 
  proteins: number; 
  fats: number; 
  carbohydrates: number; 
  weight: string; 
  marked: boolean; 
  bookmarked: boolean; 
  image: any; 
  cookingTime: number; 
  difficultyLevel: string; 
  rating: number; 
  recipeId: string; 
  isCustom?: boolean; 
  canBeRemoved?: boolean; 
  imageUrl?: string; 
  addedAt?: string; 
}

interface UserDataState { 
  userName: string; 
  dailyCalories: number; 
  consumedCalories: number; 
  photoURL: string | null; 
  targetProteins: number; 
  targetFats: number; 
  targetCarbs: number; 
}

interface KBRUState { 
  proteins: number; 
  fats: number; 
  carbohydrates: number; 
}

const DEFAULT_MEAL_IMAGE = require("@/assets/images/logo.png");
const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 56) / 2;
const generateUniqueId = (): string => `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const Avatar: React.FC<{ photoURL?: string | null; size?: number }> = ({ photoURL, size = 55 }) => 
  photoURL ? 
    <Image source={{ uri: photoURL }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: "#9BDF11" }} resizeMode="cover" /> : 
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#9BDF11" }}>
      <Feather name="user" size={size * 0.4} color="#6A9AA9" />
    </View>;

const parseCookingTime = (time: any): number => { 
  if (typeof time === "number") return time; 
  if (typeof time === "string") { 
    const match = time.match(/\d+/); 
    return match ? parseInt(match[0], 10) : 20; 
  } 
  return 20; 
};

const formatMinutes = (minutes: number | string | undefined): string => { 
  let num = typeof minutes === "string" ? parseCookingTime(minutes) : (minutes || 20); 
  const lastDigit = num % 10, lastTwo = num % 100; 
  if (lastTwo >= 11 && lastTwo <= 14) return `${num} минут`; 
  if (lastDigit === 1) return `${num} минута`; 
  if (lastDigit >= 2 && lastDigit <= 4) return `${num} минуты`; 
  return `${num} минут`; 
};

const getDifficultyColor = (difficulty?: string) => { 
  if (!difficulty) return "#6A9AA9"; 
  const d = difficulty.trim(); 
  if (d === "Легко") return "#4CAF50"; 
  if (d === "Средне") return "#FF9800"; 
  if (d === "Сложно") return "#F44336"; 
  return "#6A9AA9"; 
};

const getCategoryIcon = (category: string | undefined) => { 
  const c = String(category || "").trim().toLowerCase(); 
  if (c === "завтрак" || c === "breakfast") return "sunny-outline"; 
  if (c === "обед" || c === "lunch") return "restaurant-outline"; 
  if (c === "ужин" || c === "dinner") return "moon-outline"; 
  if (c === "перекусы" || c === "snack") return "cafe-outline"; 
  return "fast-food-outline"; 
};

const DifficultyBadge: React.FC<{ difficulty: string | undefined }> = ({ difficulty }) => 
  <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(difficulty) }]}>
    <Text style={styles.difficultyText}>{difficulty || "Легко"}</Text>
  </View>;

const loadFavoritesStatus = async (userId: string, mealsList: Meal[]): Promise<Meal[]> => { 
  if (!userId || mealsList.length === 0) return mealsList; 
  try { 
    const favorites = await favoriteService.getUserFavorites(userId); 
    const favoriteIds = new Set(favorites.map(fav => fav.item?.id).filter(id => id)); 
    return mealsList.map(meal => ({ ...meal, bookmarked: meal.recipeId ? favoriteIds.has(meal.recipeId) : false })); 
  } catch (error) { 
    console.error("Ошибка загрузки избранного:", error); 
    return mealsList; 
  } 
};

export default function Home() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [firestoreDb, setFirestoreDb] = useState<Firestore | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isUpdatingBookmark, setIsUpdatingBookmark] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [showRationSelectModal, setShowRationSelectModal] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [showSaveChoiceModal, setShowSaveChoiceModal] = useState(false);
  const [showAfterSaveModal, setShowAfterSaveModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isTemplateSaved, setIsTemplateSaved] = useState(false);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [activePlanSourceId, setActivePlanSourceId] = useState<string | null>(null);
  const hasInitialLoadRef = useRef(false);
  const isAddingRecipeRef = useRef(false);
  const isReplacingMealRef = useRef(false);
  const [pendingReplaceData, setPendingReplaceData] = useState<{index: number, meal: any} | null>(null);
  const [userData, setUserData] = useState<UserDataState>({ 
    userName: "Пользователь", 
    dailyCalories: 2000, 
    consumedCalories: 0, 
    photoURL: null, 
    targetProteins: 0, 
    targetFats: 0, 
    targetCarbs: 0 
  });
  const [recommendedKBRU, setRecommendedKBRU] = useState<KBRUState>({ proteins: 0, fats: 0, carbohydrates: 0 });
  const [targetKBRU, setTargetKBRU] = useState<KBRUState>({ proteins: 0, fats: 0, carbohydrates: 0 });

  const getTodayDateString = useCallback(() => new Date().toISOString().split("T")[0], []);

  const convertToUIMeal = (meal: any): Meal => ({ 
    id: meal.id || generateUniqueId(), 
    category: meal.category || "Обед", 
    name: meal.name || "Рецепт", 
    calories: meal.calories || 0, 
    proteins: meal.proteins || 0, 
    fats: meal.fats || 0, 
    carbohydrates: meal.carbohydrates || 0, 
    weight: meal.weight || "250г", 
    marked: meal.marked || false, 
    bookmarked: meal.bookmarked || false, 
    image: meal.imageUrl ? { uri: meal.imageUrl } : DEFAULT_MEAL_IMAGE, 
    cookingTime: parseCookingTime(meal.cookingTime), 
    difficultyLevel: meal.difficultyLevel || "Легко", 
    rating: meal.rating || 0, 
    recipeId: meal.recipeId || '', 
    isCustom: meal.isCustom || false, 
    canBeRemoved: meal.canBeRemoved || false, 
    imageUrl: meal.imageUrl || null, 
    addedAt: meal.addedAt || new Date().toISOString() 
  });

  // Сохранение текущего плана в БД
  const savePlanToDatabase = useCallback(async (mealsToSave: Meal[]) => {
    if (!currentUser || !firestoreDb) return false;
    try {
      const todayStr = getTodayDateString();
      const formattedMeals = mealsToSave.map(meal => ({
        id: meal.id,
        category: meal.category,
        name: meal.name,
        calories: meal.calories,
        proteins: meal.proteins,
        fats: meal.fats,
        carbohydrates: meal.carbohydrates,
        weight: meal.weight,
        marked: meal.marked,
        cookingTime: meal.cookingTime,
        difficultyLevel: meal.difficultyLevel,
        rating: meal.rating,
        recipeId: meal.recipeId,
        isCustom: meal.isCustom,
        canBeRemoved: meal.canBeRemoved,
        imageUrl: meal.imageUrl,
        addedAt: meal.addedAt
      }));

      const planName = activePlanName || `Рацион на ${new Date().toLocaleDateString('ru-RU')}`;

      const daysQuery = query(
        collection(firestoreDb, 'ration_plan_days'),
        where('userId', '==', currentUser.uid),
        where('date', '==', todayStr)
      );
      const daysSnap = await getDocs(daysQuery);
      
      if (daysSnap.empty) {
        const newPlanId = `${currentUser.uid}_${todayStr}_${Date.now()}`;
        await setDoc(doc(firestoreDb, 'ration_plan_days', newPlanId), {
          userId: currentUser.uid,
          date: todayStr,
          meals: formattedMeals,
          planName: planName,
          planId: activePlanSourceId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true
        });
        setActivePlanId(newPlanId);
        console.log("✅ Создан новый план с", formattedMeals.length, "блюдами");
      } else {
        const existingDoc = daysSnap.docs[0];
        await updateDoc(doc(firestoreDb, 'ration_plan_days', existingDoc.id), {
          meals: formattedMeals,
          planName: planName,
          updatedAt: new Date().toISOString()
        });
        setActivePlanId(existingDoc.id);
        console.log(`✅ Обновлен план с ${formattedMeals.length} блюдами`);
      }
      return true;
    } catch (error) {
      console.error("Error saving plan:", error);
      return false;
    }
  }, [currentUser, firestoreDb, activePlanName, activePlanSourceId, getTodayDateString]);

  // Загрузка дневного плана из ration_plan_days по текущей дате
  const loadDailyPlan = useCallback(async () => {
    if (!currentUser || !firestoreDb) return;
    setIsPlanLoading(true);
    try {
      const todayStr = getTodayDateString();
      const daysQuery = query(
        collection(firestoreDb, 'ration_plan_days'), 
        where('userId', '==', currentUser.uid), 
        where('date', '==', todayStr)
      );
      
      const daysSnap = await getDocs(daysQuery);
      
      if (!daysSnap.empty) {
        const sortedDocs = daysSnap.docs.sort((a, b) => {
          const aTime = a.data().createdAt || a.data().updatedAt || '';
          const bTime = b.data().createdAt || b.data().updatedAt || '';
          return bTime.localeCompare(aTime);
        });
        
        const dayDoc = sortedDocs[0];
        const dayData = dayDoc.data();
        const mealsData = dayData.meals || [];
        const planName = dayData.planName || null;
        const sourcePlanId = dayData.planId || null;
        
        let mealsWithFavorites = await loadFavoritesStatus(currentUser.uid, mealsData.map(convertToUIMeal));
        
        setMeals(mealsWithFavorites);
        setActivePlanName(planName);
        setActivePlanId(dayDoc.id);
        setActivePlanSourceId(sourcePlanId);
        setHasChanges(false);
        
        if (sourcePlanId) {
          const templateCheck = await getDoc(doc(firestoreDb, 'ration_plans', sourcePlanId));
          setIsTemplateSaved(templateCheck.exists());
        } else {
          setIsTemplateSaved(false);
        }
        
        setRecommendedKBRU(mealsWithFavorites.reduce((acc, m) => ({ 
          proteins: acc.proteins + (m.proteins || 0), 
          fats: acc.fats + (m.fats || 0), 
          carbohydrates: acc.carbohydrates + (m.carbohydrates || 0) 
        }), { proteins: 0, fats: 0, carbohydrates: 0 }));
        
        setUserData(prev => ({ 
          ...prev, 
          consumedCalories: mealsWithFavorites.filter(m => m.marked).reduce((sum, m) => sum + (m.calories || 0), 0) 
        }));
        
        for (let i = 1; i < sortedDocs.length; i++) {
          await deleteDoc(doc(firestoreDb, 'ration_plan_days', sortedDocs[i].id));
          console.log("🗑 Удален дублирующий документ дня:", sortedDocs[i].id);
        }
        
      } else {
        console.log("📅 План на сегодня отсутствует. Запуск автоматической генерации...");
        
        const newPlan = await dailyRationService.createNewPlanWithUserSettings(currentUser.uid);
        
        if (newPlan && newPlan.meals && newPlan.meals.length > 0) {
          let mealsWithFavorites = await loadFavoritesStatus(currentUser.uid, newPlan.meals.map(convertToUIMeal));
          
          setMeals(mealsWithFavorites);
          
          setRecommendedKBRU(mealsWithFavorites.reduce((acc, m) => ({ 
            proteins: acc.proteins + (m.proteins || 0), 
            fats: acc.fats + (m.fats || 0), 
            carbohydrates: acc.carbohydrates + (m.carbohydrates || 0) 
          }), { proteins: 0, fats: 0, carbohydrates: 0 }));
          
          await savePlanToDatabase(mealsWithFavorites);
          
          console.log("✅ Успешная автогенерация и сохранение стартового плана.");
        } else {
          setMeals([]);
          setRecommendedKBRU({ proteins: 0, fats: 0, carbohydrates: 0 });
        }
        
        setActivePlanName(null);
        setActivePlanId(null);
        setActivePlanSourceId(null);
        setHasChanges(false);
        setIsTemplateSaved(false);
        setUserData(prev => ({ ...prev, consumedCalories: 0 }));
      }
      setIsInitialLoadDone(true);
    } catch (error) {
      console.error("Error loading plan:", error);
      Alert.alert("Ошибка", "Не удалось загрузить или сгенерировать рацион");
    } finally {
      setIsPlanLoading(false);
    }
  }, [currentUser, firestoreDb, getTodayDateString, savePlanToDatabase]);

  const addRecipeToPlan = useCallback(async (recipeData: any) => {
    if (isAddingRecipeRef.current) return;
    isAddingRecipeRef.current = true;
    
    try {
      const finalCategory = recipeData.category || recipeData.mealType || "Обед";
      const newMeal: Meal = {
        id: generateUniqueId(),
        category: finalCategory,
        name: recipeData.title || "Новый рецепт",
        calories: Number(recipeData.calories) || 300,
        proteins: Number(recipeData.proteins) || 20,
        fats: Number(recipeData.fats) || 10,
        carbohydrates: Number(recipeData.carbohydrates || recipeData.carbs) || 30,
        weight: recipeData.weight || "250г",
        marked: false,
        bookmarked: false,
        image: recipeData.imageUrl ? { uri: recipeData.imageUrl } : DEFAULT_MEAL_IMAGE,
        cookingTime: parseCookingTime(recipeData.cookingTime),
        difficultyLevel: recipeData.difficultyLevel || "Легко",
        rating: recipeData.rating || 0,
        recipeId: recipeData.id || '',
        isCustom: true,
        canBeRemoved: true,
        imageUrl: recipeData.imageUrl || null,
        addedAt: new Date().toISOString()
      };
      
      console.log("Текущее количество блюд в стейте перед добавлением:", meals.length);

      const nextMeals = [...meals, newMeal];
      
      setMeals(nextMeals);
      setRecommendedKBRU(nextMeals.reduce((acc, m) => ({ 
        proteins: acc.proteins + (m.proteins || 0), 
        fats: acc.fats + (m.fats || 0), 
        carbohydrates: acc.carbohydrates + (m.carbohydrates || 0) 
      }), { proteins: 0, fats: 0, carbohydrates: 0 }));
      setHasChanges(true);
      setIsTemplateSaved(false);
      setActivePlanSourceId(null);

      console.log("💾 Сохраняем в БД полный список из", nextMeals.length, "блюд");
      await savePlanToDatabase(nextMeals);

    } catch (error) {
      console.error("❌ Ошибка добавления:", error);
    } finally {
      isAddingRecipeRef.current = false;
    }
  }, [meals, savePlanToDatabase]);

  // Удаление рецепта
  const removeMeal = useCallback((mealId: string) => {
    const mealToRemove = meals.find(m => m.id === mealId);
    if (!mealToRemove) return;

    Alert.alert("Удалить рецепт", `Удалить "${mealToRemove.name}"?`, [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
          const newMeals = meals.filter(m => m.id !== mealId);
          setMeals(newMeals);
          setHasChanges(true);
          setIsTemplateSaved(false); 
          await savePlanToDatabase(newMeals);
          Alert.alert("Успех", "Рецепт удален!");
        }
      }
    ]);
  }, [meals, savePlanToDatabase]);

  // Отметка приема пищи
  const handleToggleMeal = useCallback(async (mealId: string) => {
    const updatedMeals = meals.map(m => m.id === mealId ? { ...m, marked: !m.marked } : m);
    const newConsumedCalories = updatedMeals.filter(m => m.marked).reduce((sum, m) => sum + (m.calories || 0), 0);
    setMeals(updatedMeals);
    setUserData(prev => ({ ...prev, consumedCalories: newConsumedCalories }));
    await savePlanToDatabase(updatedMeals);
  }, [meals, savePlanToDatabase]);

  // Функция для получения уникального названия
  const getUniqueTitle = useCallback(async (userId: string, baseTitle: string): Promise<string> => {
    try {
      const q = query(collection(firestoreDb!, 'ration_plans'), where('userId', '==', userId));
      const snapshot = await getDocs(q);
      const existingTitles = snapshot.docs.map(doc => doc.data().title);
      if (!existingTitles.includes(baseTitle)) return baseTitle;
      let counter = 1;
      let newTitle = `${baseTitle} (${counter})`;
      while (existingTitles.includes(newTitle)) { counter++; newTitle = `${baseTitle} (${counter})`; }
      return newTitle;
    } catch (error) { return `${baseTitle} (${Date.now()})`; }
  }, [firestoreDb]);

  const executeSave = async (title: string) => {
    try {
      setIsSaving(true);

      if (!currentUser || !firestoreDb) {
        console.error("Пользователь не авторизован или база данных недоступна");
        return;
      }

      const { collection, addDoc, doc, setDoc, query, where, getDocs, updateDoc } = require("firebase/firestore");
      const todayStr = new Date().toISOString().split('T')[0];
      const totalCalories = meals.reduce((sum: number, m: any) => sum + (m.calories || 0), 0);

      // 1. СОЗДАЕМ ШАБЛОН В RATION_PLANS
      const newTemplateData = {
        userId: currentUser.uid,
        title: title,
        description: `Сгенерированный рацион от ${new Date().toLocaleDateString("ru-RU")}`,
        type: 'daily',
        meals: meals,
        isTemplate: true,
        category: "Шаблон",
        status: "active", 
        totalCalories: totalCalories,
        mealsCount: meals.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startDate: todayStr,
        endDate: todayStr
      };

      const docRef = await addDoc(collection(firestoreDb, 'ration_plans'), newTemplateData);
      const newPlanId = docRef.id; 

      console.log("🔹 Шаблон успешно создан в ration_plans с ID:", newPlanId);

      // 2. УМНОЕ ОБНОВЛЕНИЕ ДОКУМЕНТА ДНЯ
      console.log("⏳ Поиск существующего документа дня для синхронизации...");
      const dayQuery = query(
        collection(firestoreDb, 'ration_plan_days'),
        where('userId', '==', currentUser.uid),
        where('date', '==', todayStr)
      );
      const daySnap = await getDocs(dayQuery);

      const dayUpdateData = {
        userId: currentUser.uid,
        date: todayStr,
        planId: newPlanId,          
        planName: title,            
        meals: meals,
        totalCalories: totalCalories,
        status: "active",
        updatedAt: new Date().toISOString()
      };

      if (!daySnap.empty) {
        await updateDoc(daySnap.docs[0].ref, dayUpdateData);
        console.log("💾 [УСПЕХ] Документ автогенерации найден и связан с шаблоном:", daySnap.docs[0].id);
      } else {
        const cleanDayId = activePlanId || `${currentUser.uid}_${todayStr}`;
        await setDoc(doc(firestoreDb, 'ration_plan_days', cleanDayId), dayUpdateData, { merge: true });
        console.log("💾 [УСПЕХ] Создан новый чистый документ дня:", cleanDayId);
      }

      // 3. Обновляем локальные стейты экрана
      setActivePlanSourceId(newPlanId); 
      setActivePlanName(title);
      setIsTemplateSaved(true);
      setHasChanges(false);

      // 4. УПРАВЛЕНИЕ МОДАЛКАМИ
      setShowNameModal(false); 
      setShowSaveSuccessModal(true);

    } catch (error) {
      console.error("Ошибка при executeSave:", error);
      Alert.alert("Ошибка", "Не удалось сохранить рацион");
    } finally {
      setIsSaving(false);
    }
  };

  // Сохранение как новый шаблон
  const saveAsNewTemplate = useCallback(() => {
    console.log("🚀 saveAsNewTemplate начат", { mealsLength: meals.length });
    
    if (!currentUser || meals.length === 0) { 
      Alert.alert("Ошибка", "Нет данных для сохранения");
      return;
    }
    
    const formattedDate = new Date().toLocaleDateString('ru-RU', { 
      day: 'numeric', 
      month: 'numeric', 
      year: 'numeric' 
    });
    const defaultTitle = `Дневной рацион ${formattedDate}`;
    
    setTemplateTitle(defaultTitle);
    setShowNameModal(true);
  }, [currentUser, meals]);

  // Обновление существующего шаблона
  const handleConfirmUpdate = async () => {
    if (!firestoreDb || !activePlanId) {
      Alert.alert("Ошибка", "База данных или активный план не инициализированы");
      return;
    }

    setShowSaveChoiceModal(false);
    setIsSaving(true);
    
    try {
      console.log("💾 [ОБНОВЛЕНИЕ] Обновляем текущий день...", activePlanId);
      
      const success = await savePlanToDatabase(meals);
      
      if (success) {
        console.log("🔍 Читаем актуальный ID шаблона из документа дня...");
        const dayDocRef = doc(firestoreDb, 'ration_plan_days', activePlanId);
        const dayDocSnap = await getDoc(dayDocRef);
        
        let sourceTemplateId = activePlanSourceId;
        
        if (dayDocSnap.exists()) {
          const dayData = dayDocSnap.data();
          sourceTemplateId = dayData.planId || dayData.activePlanSourceId;
          console.log("📦 Найдена связь с шаблоном в БД. ID шаблона:", sourceTemplateId);
        }

        if (sourceTemplateId) {
          console.log("💾 [ОБНОВЛЕНИЕ] Записываем обновленные meals в ration_plans...", sourceTemplateId);
          
          const cleanedMeals = meals.map(m => ({
            id: m.id || `meal-${Date.now()}`,
            recipeId: m.recipeId || '',
            category: m.category || "Обед",
            name: m.name || "Рецепт",
            calories: m.calories || 0,
            proteins: m.proteins || 0,
            fats: m.fats || 0,
            carbohydrates: m.carbohydrates || 0,
            weight: m.weight || "250г",
            cookingTime: m.cookingTime || 20,
            difficultyLevel: m.difficultyLevel || "Легко",
            imageUrl: m.imageUrl || null,
            isCustom: m.isCustom || false,
            marked: m.marked || false
          }));

          const templateRef = doc(firestoreDb, 'ration_plans', sourceTemplateId);
          await updateDoc(templateRef, {
            meals: cleanedMeals,
            days: [{ meals: cleanedMeals }],
            updatedAt: new Date().toISOString()
          });
          
          console.log("✅ [ОБНОВЛЕНИЕ] Шаблон успешно обновлен!");
        }
      }
      
      setHasChanges(false);
      setIsTemplateSaved(true);
      setIsSaving(false);
      setShowSaveSuccessModal(true);
      
    } catch (error) {
      console.error("❌ КРИТИЧЕСКАЯ ОШИБКА ОБНОВЛЕНИЯ:", error);
      Alert.alert("Ошибка", "Не удалось обновить рацион");
      setIsSaving(false);
    }
  };

  // Сохранение как новый шаблон из модального окна выбора
  const handleConfirmSaveAsNew = async () => {
    setShowSaveChoiceModal(false);
    
    if (!currentUser || !firestoreDb) {
      Alert.alert("Ошибка", "Пользователь не авторизован");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const formattedDate = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric', year: 'numeric' });
      const baseName = `Дневной рацион ${formattedDate}`;
      let finalName = baseName;
      
      const { collection, query, where, getDocs } = require("firebase/firestore");
      const qTemplates = query(
        collection(firestoreDb, 'ration_plans'),
        where('userId', '==', currentUser.uid)
      );
      const templatesSnap = await getDocs(qTemplates);
      
      const existingTitles = templatesSnap.docs.map((d: any) => {
        const data = d.data();
        return (data.title || data.planName || data.name || "").trim().toLowerCase();
      });

      let counter = 1;
      while (existingTitles.includes(finalName.trim().toLowerCase())) {
        finalName = `${baseName} (${counter})`;
        counter++;
      }

      setTemplateTitle(finalName);
      setShowNameModal(true);
    } catch (err) {
      console.error("Ошибка в handleConfirmSaveAsNew:", err);
      const formattedDate = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric', year: 'numeric' });
      setTemplateTitle(`Дневной рацион ${formattedDate}`);
      setShowNameModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Обработчик нажатия на кнопку сохранения
  const handleSavePress = async () => {
    if (isSaving) return;
    if (!currentUser || !firestoreDb) {
      Alert.alert("Ошибка", "Пользователь не авторизован");
      return;
    }

    console.log("🔘 Нажата кнопка сохранения. Текущее состояние:", { activePlanId, hasChanges, mealsLength: meals.length });

    if (!activePlanId) {
      if (meals.length > 0) {
        saveAsNewTemplate();
      } else {
        Alert.alert("Информация", "Рацион пуст, нечего сохранять");
      }
      return;
    }

    if (activePlanId) {
      if (hasChanges) {
        setShowSaveChoiceModal(true);
      } else {
        setIsSaving(true); 
        try {
          const formattedDate = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric', year: 'numeric' });
          const baseName = `Дневной рацион ${formattedDate}`;
          let finalName = baseName;
          
          const { collection, query, where, getDocs } = require("firebase/firestore");
          const qTemplates = query(
            collection(firestoreDb, 'ration_plans'),
            where('userId', '==', currentUser.uid)
          );
          const templatesSnap = await getDocs(qTemplates);
          
          const existingTitles = templatesSnap.docs.map((d: any) => {
            const data = d.data();
            return (data.title || data.planName || data.name || "").trim().toLowerCase();
          });

          let counter = 1;
          while (existingTitles.includes(finalName.trim().toLowerCase())) {
            finalName = `${baseName} (${counter})`;
            counter++;
          }

          setTemplateTitle(finalName); 
          setShowNameModal(true); 
        } catch (err) {
          console.error("❌ Ошибка при подготовке имени:", err);
        } finally {
          setIsSaving(false);
        }
      }
    }
  };

  // Обработчик сохранения из кастомной модалки
  const handleSaveWithName = async () => {
    if (!currentUser) return;
    
    setShowNameModal(false);
    setIsSaving(true);
    
    try {
      const formattedDate = new Date().toLocaleDateString('ru-RU', { 
        day: 'numeric', 
        month: 'numeric', 
        year: 'numeric' 
      });
      const finalTitle = templateTitle.trim() || `Дневной рацион ${formattedDate}`;
      
      console.log("🚀 Проверяем уникальность для имени:", finalTitle);
      const uniqueTitle = await getUniqueTitle(currentUser.uid, finalTitle);
      
      await executeSave(uniqueTitle);
    } catch (error) {
      console.error("Ошибка при сохранении шаблона:", error);
      setIsSaving(false);
    }
  };

  // Обработчики для модального окна после сохранения
  const handleGoToPlans = () => {
    setShowAfterSaveModal(false);
    router.push("/saved-plans");
  };

  const handleStayHere = () => {
    setShowAfterSaveModal(false);
  };

  // Генерация нового рациона
  const handleGenerateNewRation = useCallback(async () => {
    if (!currentUser || !firestoreDb) return;
    if (isGeneratingPlan) return;
    
    try {
      setIsGeneratingPlan(true);
      console.log("🔄 Генерация нового рациона...");
      
      const newPlan = await dailyRationService.createNewPlanWithUserSettings(currentUser.uid);
      
      if (newPlan && newPlan.meals && newPlan.meals.length > 0) {
        let mealsWithFavorites = await loadFavoritesStatus(currentUser.uid, newPlan.meals.map(convertToUIMeal));
        
        const { collection, query, where, getDocs, updateDoc, doc } = require("firebase/firestore");
        
        const qTemplates = query(
          collection(firestoreDb, 'ration_plans'),
          where('userId', '==', currentUser.uid)
        );
        const templatesSnap = await getDocs(qTemplates);
        const existingTitles = templatesSnap.docs.map((d: any) => d.data().title || d.data().planName || "");

        const baseGenName = "Сгенерированный рацион";
        let finalGenName = baseGenName;
        let counter = 1;

        while (existingTitles.includes(finalGenName)) {
          finalGenName = `${baseGenName} (${counter})`;
          counter++;
        }

        console.log(`🏷️ Определено уникальное имя для рациона: "${finalGenName}"`);

        setMeals(mealsWithFavorites);
        setActivePlanName(finalGenName);
        setActivePlanSourceId(null); 
        setHasChanges(false);
        setIsTemplateSaved(false); 

        const todayStr = new Date().toISOString().split('T')[0];
        const currentDayId = activePlanId || `${currentUser.uid}_${todayStr}`;
        
        console.log("💾 Авто-сохранение сгенерированного плана в документ дня:", currentDayId);
        
        const cleanedMeals = mealsWithFavorites.map((m: any) => ({
          id: m.id || `meal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          recipeId: m.recipeId || m.id || '',
          category: m.category || "Обед",
          name: m.name || m.title || "Рецепт",
          calories: m.calories || 0,
          proteins: m.proteins || 0,
          fats: m.fats || 0,
          carbohydrates: m.carbohydrates || 0,
          weight: m.weight || "250г",
          cookingTime: m.cookingTime || 20,
          difficultyLevel: m.difficultyLevel || "Легко",
          imageUrl: m.imageUrl || null,
          isCustom: m.isCustom || false,
          marked: false
        }));

        await updateDoc(doc(firestoreDb, 'ration_plan_days', currentDayId), {
          meals: cleanedMeals,
          planName: finalGenName,
          planId: null,
          updatedAt: new Date().toISOString()
        });

        setActivePlanId(currentDayId);
        
        setShowRationSelectModal(false);
        Alert.alert("Успех", `Сгенерирован рацион "${finalGenName}"!`);
      } else {
        Alert.alert("Ошибка", "Не удалось сгенерировать рацион. Попробуйте позже.");
      }
    } catch (error) { 
      console.error("Ошибка генерации рациона:", error);
      Alert.alert("Ошибка", "Не удалось сгенерировать рацион");
    } finally { 
      setIsGeneratingPlan(false);
    }
  }, [currentUser, firestoreDb, isGeneratingPlan, activePlanId]);

  // Обработка замены блюда
  useEffect(() => { 
    if (params.replaceMeal && currentUser && firestoreDb && isInitialLoadDone && !isReplacingMealRef.current) { 
      isReplacingMealRef.current = true;
      console.log("🔵 [ЭФФЕКТ ЗАМЕНЫ] Поймали replaceMeal, база данных загружена. Начинаем замену...");
      
      try { 
        const { index, meal } = JSON.parse(params.replaceMeal as string);
        const updatedMeal = convertToUIMeal(meal);
        
        const currentMeals = Array.isArray(meals) ? [...meals] : [];
        
        if (index >= 0 && index < currentMeals.length) {
          console.log(`🔄 Заменяем блюдо на позиции [${index}]: ${currentMeals[index].name} -> ${updatedMeal.name}`);
          
          updatedMeal.id = currentMeals[index].id; 
          currentMeals[index] = updatedMeal;
          
          setMeals(currentMeals);
          setRecommendedKBRU({
            proteins: currentMeals.reduce((sum, m) => sum + (m.proteins || 0), 0),
            fats: currentMeals.reduce((sum, m) => sum + (m.fats || 0), 0),
            carbohydrates: currentMeals.reduce((sum, m) => sum + (m.carbohydrates || 0), 0),
          });
          setUserData(prev => ({ 
            ...prev, 
            consumedCalories: currentMeals.filter(m => m.marked).reduce((sum, m) => sum + (m.calories || 0), 0) 
          }));
          setHasChanges(true);
          setIsTemplateSaved(false);
          
          console.log("💾 Сохраняем замененный рацион в БД. Всего блюд в массиве:", currentMeals.length);
          savePlanToDatabase(currentMeals);
        } else {
          console.warn(`⚠️ Индекс замены ${index} невалиден для массива длиной ${currentMeals.length}`);
        }

        router.setParams({ replaceMeal: undefined });
        isReplacingMealRef.current = false;

      } catch (e) { 
        console.error("❌ Ошибка при замене блюда:", e); 
        isReplacingMealRef.current = false;
      } 
    } 
  }, [params.replaceMeal, currentUser, firestoreDb, isInitialLoadDone, meals, savePlanToDatabase, router]);

  const handleToggleBookmark = useCallback(async (mealId: string) => {
    const meal = meals.find(m => m.id === mealId);
    if (!meal || !currentUser || isUpdatingBookmark) return;
    setIsUpdatingBookmark(mealId);
    try {
      const updatedMeals = meals.map(m => m.id === mealId ? { ...m, bookmarked: !m.bookmarked } : m);
      setMeals(updatedMeals);
      if (meal.bookmarked) await favoriteService.removeFromFavorites(meal.recipeId, "recipe", currentUser.uid);
      else await favoriteService.addToFavorites(meal.recipeId, "recipe", currentUser.uid);
    } catch (error) { console.error("Ошибка избранного:", error); } finally { setIsUpdatingBookmark(null); }
  }, [meals, currentUser, isUpdatingBookmark]);

  const navigateToMealPage = (mealIndex: number) => { 
    const meal = meals[mealIndex]; 
    if (!meal) return; 
    router.push({ 
      pathname: "/meal", 
      params: { 
        mealId: meal.id, 
        recipeId: meal.recipeId || meal.id, 
        mealName: meal.name, 
        category: meal.category, 
        mealIndex: mealIndex.toString(), 
        initialBookmarked: meal.bookmarked ? "true" : "false", 
        calories: (meal.calories || 0).toString(), 
        proteins: (meal.proteins || 0).toString(), 
        fats: (meal.fats || 0).toString(), 
        carbohydrates: (meal.carbohydrates || 0).toString(), 
        weight: meal.weight || "250г", 
        cookingTime: (meal.cookingTime || 20).toString(), 
        difficultyLevel: meal.difficultyLevel || "Легко", 
        rating: (meal.rating || 0).toString(), 
        fromScreen: "home", 
        isCustom: (meal.isCustom || false).toString(), 
        imageUrl: meal.imageUrl || "" 
      } 
    }); 
  };

  const handleRefresh = async () => { 
    setIsRefreshing(true); 
    setMeals([]);
    await loadDailyPlan(); 
    setIsRefreshing(false); 
  };

  // Инициализация Firebase
  useEffect(() => {
    const initFirebase = async () => {
      try {
        const firebaseConfig = typeof __firebase_config !== "undefined"
          ? JSON.parse(__firebase_config as string)
          : {};
        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        setFirestoreDb(getFirestore(app));
        const authInstance = getAuth(app);
        const unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
          setCurrentUser(user);
          setIsAuthReady(true);
        });
        return () => unsubscribeAuth();
      } catch (error) {
        console.error("Firebase init error:", error);
        setIsAuthReady(true);
      }
    };
    initFirebase();
  }, []);

  useEffect(() => { 
    if (isAuthReady && currentUser && firestoreDb && !hasInitialLoadRef.current) { 
      hasInitialLoadRef.current = true; 
      loadDailyPlan(); 
    } 
  }, [isAuthReady, currentUser, firestoreDb, loadDailyPlan]);
  
  useEffect(() => { 
    if (params.refreshHome && currentUser && firestoreDb) { 
      loadDailyPlan(); 
      setTimeout(() => router.setParams({ refreshHome: undefined }), 100); 
    } 
  }, [params.refreshHome, currentUser, firestoreDb, router, loadDailyPlan]);
  
  useEffect(() => { 
    if (params.selectedRecipe && currentUser && firestoreDb && isInitialLoadDone && !isAddingRecipeRef.current) { 
      console.log("🔵 [ЭФФЕКТ] Дождались загрузки БД. Добавляем рецепт...");
      
      try { 
        const recipeData = JSON.parse(params.selectedRecipe as string);
        router.setParams({ selectedRecipe: undefined });
        addRecipeToPlan(recipeData); 
      } catch (e) { 
        console.error("❌ Ошибка парсинга selectedRecipe:", e); 
      } 
    } 
  }, [params.selectedRecipe, currentUser, firestoreDb, isInitialLoadDone, addRecipeToPlan]); 
  
  useEffect(() => { 
    const daily = userData.dailyCalories; 
    setTargetKBRU({ 
      proteins: Math.round((daily * 0.3) / 4), 
      fats: Math.round((daily * 0.3) / 9), 
      carbohydrates: Math.round((daily * 0.4) / 4) 
    }); 
  }, [userData.dailyCalories]);
  
  useEffect(() => { 
    if (!firestoreDb || !currentUser) return; 
    const unsubscribe = onSnapshot(doc(firestoreDb, `users/${currentUser.uid}`), (docSnap) => { 
      if (docSnap.exists()) { 
        const data = docSnap.data(); 
        const name = `${data.first_name || data.firstName || data.name || ""} ${data.last_name || data.lastName || ""}`.trim(); 
        setUserData(prev => ({ 
          ...prev, 
          userName: name || "Пользователь", 
          dailyCalories: Math.round(data.dailyCalories || data.targetCalories || 2000), 
          targetProteins: data.targetProteinGrams || 0, 
          targetFats: data.targetFatGrams || 0, 
          targetCarbs: data.targetCarbGrams || 0, 
          photoURL: data.photoURL || null 
        })); 
      } 
    }); 
    return () => unsubscribe(); 
  }, [firestoreDb, currentUser]);

  if (!isAuthReady || !currentUser || !firestoreDb || isPlanLoading) 
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#6A9AA9" /><Text style={styles.loadingText}>Загрузка...</Text></View>;

  const dailyTarget = Math.round(userData.dailyCalories / 100) * 100, 
        progress = Math.min(100, (userData.consumedCalories / dailyTarget) * 100), 
        remaining = Math.max(0, dailyTarget - userData.consumedCalories);

  // Определение текста, стилей и состояния блокировки кнопки сохранения
  const getButtonState = () => {
    if (isSaving) {
      return { 
        text: "Сохранение...", 
        style: styles.saveRationButton, 
        disabled: true,
        iconColor: "#FFFFFF"
      };
    }
    
    if (isTemplateSaved && !hasChanges) {
      return { 
        text: "Рацион сохранен", 
        style: [styles.saveRationButton, styles.saveButtonDisabled], 
        disabled: true,
        iconColor: "#999999"
      };
    }
    
    if (activePlanId && hasChanges) {
      return { 
        text: "Обновить рацион", 
        style: styles.saveRationButtonUpdate || styles.saveRationButton, 
        disabled: false,
        iconColor: "#FFFFFF"
      };
    }
    
    return { 
      text: "Сохранить рацион", 
      style: styles.saveRationButton, 
      disabled: false,
      iconColor: "#FFFFFF"
    };
  };

  const currentButton = getButtonState();
  const displayPlanName = activePlanName || "Новый рацион (не сохранено)";

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>Рацион</Text>
            <Text style={styles.dietText}>Ваш рацион на день, {userData.userName.split(" ")[0] || "Пользователь"}!</Text>
          </View>
          <TouchableOpacity style={styles.userInfo} onPress={() => router.push("/profile")}>
            <Avatar photoURL={userData.photoURL} size={55} />
            <Text style={styles.userName}>{userData.userName || "Пользователь"}</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} colors={["#6A9AA9"]} tintColor="#6A9AA9" />}>
          <View style={styles.caloriesSection}>
            <Text style={styles.caloriesTitle}>Цель на день: {dailyTarget} ккал</Text>
            <View style={styles.remainingCaloriesContainer}>
              <Text style={styles.remainingCaloriesLabel}>Осталось:</Text>
              <Text style={styles.remainingCaloriesValue}>{Math.round(remaining / 100) * 100} ккал</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            
            <View style={styles.kbruContainer}>
              <View style={styles.kbruRow}>
                <Text style={[styles.kbruHeader, { flex: 1, textAlign: "left" }]}>Макронутриенты</Text>
                <Text style={styles.kbruHeader}>Белки (г)</Text>
                <Text style={styles.kbruHeader}>Жиры (г)</Text>
                <Text style={styles.kbruHeader}>Углеводы (г)</Text>
              </View>
              <View style={styles.kbruRow}>
                <Text style={[styles.kbruLabel, { flex: 1, textAlign: "left" }]}>План</Text>
                <Text style={styles.kbruValue}>{recommendedKBRU.proteins}</Text>
                <Text style={styles.kbruValue}>{recommendedKBRU.fats}</Text>
                <Text style={styles.kbruValue}>{recommendedKBRU.carbohydrates}</Text>
              </View>
              <View style={[styles.kbruRow, styles.targetKBRURow]}>
                <Text style={[styles.kbruLabel, { flex: 1, textAlign: "left", fontFamily: "Playfair Display Bold" }]}>Цель</Text>
                <Text style={[styles.kbruValue, { fontFamily: "Playfair Display Bold" }]}>{targetKBRU.proteins}</Text>
                <Text style={[styles.kbruValue, { fontFamily: "Playfair Display Bold" }]}>{targetKBRU.fats}</Text>
                <Text style={[styles.kbruValue, { fontFamily: "Playfair Display Bold" }]}>{targetKBRU.carbohydrates}</Text>
              </View>
            </View>
            
            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.selectRationButton} onPress={() => setShowRationSelectModal(true)}>
                <Ionicons name="swap-horizontal-outline" size={18} color="#6A9AA9" />
                <Text style={styles.selectRationButtonText}>Выбрать рацион</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[currentButton.style, isSaving && styles.saveRationButtonSaving]} 
                onPress={handleSavePress}
                disabled={currentButton.disabled} 
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons 
                      name={hasChanges && !isTemplateSaved ? "refresh-outline" : "save-outline"} 
                      size={18} 
                      color={currentButton.iconColor} 
                    />
                    <Text style={[
                      styles.saveRationButtonText,
                      (isTemplateSaved && !hasChanges) && styles.saveButtonTextDisabled
                    ]}>
                      {currentButton.text}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.planNameContainer}>
              <Ionicons name={activePlanName ? "bookmark" : "create-outline"} size={18} color="#6A9AA9" />
              <Text style={styles.planNameValue} numberOfLines={1}>{displayPlanName}</Text>
            </View>
            
            <View style={styles.sectionDivider} />
          </View>
          
          <View style={styles.mealsTitleSection}>
            <Text style={styles.mealsTitle}>Приемы пищи ({meals.length})</Text>
            <TouchableOpacity style={styles.addRecipeButton} onPress={() => setShowAddRecipeModal(true)}>
              <Ionicons name="add-circle-outline" size={18} color="#6A9AA9" />
              <Text style={styles.addRecipeText}>Добавить</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.mealsSection}>
            {meals.length === 0 ? (
              <View style={styles.emptyPlanContainer}>
                <Ionicons name="restaurant-outline" size={64} color="#C2DAE2" />
                <Text style={styles.emptyPlanTitle}>Рацион пуст</Text>
                <Text style={styles.emptyPlanText}>
                  У вас нет активного рациона на сегодня
                </Text>
                <Text style={styles.emptyPlanHint}>
                  Нажмите "Выбрать рацион", чтобы сгенерировать новый или выбрать из сохраненных
                </Text>
                <TouchableOpacity style={styles.emptyPlanButton} onPress={() => setShowRationSelectModal(true)}>
                  <Text style={styles.emptyPlanButtonText}>Выбрать рацион</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.recipesGrid}>
                {meals.map((meal, idx) => (
                  <View key={meal.id} style={styles.recipeColumn}>
                    <TouchableOpacity style={styles.recipeCard} onPress={() => navigateToMealPage(idx)}>
                      <View style={styles.imageContainer}>
                        {meal.image?.uri ? <Image source={meal.image} style={styles.recipeImage} /> : 
                          <View style={styles.recipeImagePlaceholder}>
                            <Ionicons name={getCategoryIcon(meal.category) as any} size={32} color="#6A9AA9" />
                          </View>
                        }
                        <DifficultyBadge difficulty={meal.difficultyLevel} />
                        <TouchableOpacity style={styles.bookmarkButton} onPress={() => handleToggleBookmark(meal.id)} disabled={isUpdatingBookmark === meal.id}>
                          <Ionicons name={meal.bookmarked ? "bookmark" : "bookmark-outline"} size={18} color={meal.bookmarked ? "#FFD700" : "#6A9AA9"} />
                        </TouchableOpacity>
                        {meal.canBeRemoved && (
                          <TouchableOpacity style={styles.deleteButton} onPress={(e) => { e.stopPropagation(); removeMeal(meal.id); }}>
                            <Ionicons name="trash-outline" size={16} color="#FFF" />
                          </TouchableOpacity>
                        )}
                        {meal.rating > 0 && (
                          <View style={styles.ratingBadge}>
                            <FontAwesome name="star" size={10} color="#FFD700" />
                            <Text style={styles.ratingText}>{meal.rating.toFixed(1)}</Text>
                          </View>
                        )}
                        {meal.isCustom && (
                          <View style={styles.customBadge}>
                            <Ionicons name="add-circle" size={10} color="#FFF" />
                            <Text style={styles.customBadgeText}>Добавлен</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.recipeContent}>
                        <View>
                          <Text style={styles.recipeName} numberOfLines={2}>{meal.name}</Text>
                          <Text style={styles.recipeCategory}>{meal.category}</Text>
                          <View style={styles.recipeDetails}>
                            <Text style={styles.recipeCalories}>{meal.calories} ккал</Text>
                            <MaterialIcons name="access-time" size={12} color="#6A9AA9" />
                            <Text style={styles.recipeTime}>{formatMinutes(meal.cookingTime)}</Text>
                          </View>
                        </View>
                        <TouchableOpacity style={[styles.markButton, meal.marked && styles.markButtonActive]} onPress={() => handleToggleMeal(meal.id)}>
                          {meal.marked ? 
                            <Image source={require("@/assets/images/checkmark-done.png")} style={styles.checkmarkIcon} /> : 
                            <Text style={styles.markButtonText}>Отметить прием</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* Модальное окно выбора типа сохранения */}
      <Modal
        visible={showSaveChoiceModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSaveChoiceModal(false)}
      >
        <View style={styles.saveChoiceOverlay}>
          <View style={styles.saveChoiceContainer}>
            <Ionicons name="save-outline" size={36} color="#6A9AA9" style={{ marginBottom: 12 }} />
            <Text style={styles.saveChoiceTitle}>Сохранение изменений</Text>
            <Text style={styles.saveChoiceText}>
              Вы изменили блюдо в текущем рационе. Как вы хотите сохранить изменения?
            </Text>
            <TouchableOpacity style={styles.saveChoiceUpdateButton} onPress={handleConfirmUpdate}>
              <Text style={styles.saveChoiceUpdateButtonText}>Обновить текущий рацион</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveChoiceNewButton} onPress={handleConfirmSaveAsNew}>
              <Text style={styles.saveChoiceNewButtonText}>Сохранить как новый шаблон</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSaveChoiceModal(false)} style={{ paddingVertical: 8 }}>
              <Text style={styles.saveChoiceCancelText}>Отмена</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Кастомное модальное окно для ввода имени шаблона */}
      <Modal
        visible={showNameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <Text style={styles.successTitle}>Сохранить как шаблон</Text>
            <Text style={styles.successDescription}>Введите название для этого рациона:</Text>
            
            <TextInput
              style={styles.nameInput}
              value={templateTitle}
              onChangeText={setTemplateTitle}
              placeholder="Название рациона"
              placeholderTextColor="#999"
              autoFocus={true}
            />

            <View style={styles.successModalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonSecondary]} 
                onPress={() => setShowNameModal(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.modalButton, styles.modalButtonPrimary]} 
                onPress={handleSaveWithName}
              >
                <Text style={styles.modalButtonPrimaryText}>Сохранить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модальное окно после сохранения - выбор действия */}
      <Modal
        visible={showAfterSaveModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAfterSaveModal(false)}
      >
        <View style={styles.saveChoiceOverlay}>
          <View style={styles.saveChoiceContainer}>
            <Ionicons name="checkmark-circle" size={48} color="#4CAF50" style={{ marginBottom: 12 }} />
            <Text style={styles.saveChoiceTitle}>Рацион сохранен!</Text>
            <Text style={styles.saveChoiceText}>
              Ваш рацион успешно сохранен.
            </Text>
            <TouchableOpacity style={styles.saveChoiceUpdateButton} onPress={handleGoToPlans}>
              <Text style={styles.saveChoiceUpdateButtonText}>Перейти к сохраненным планам</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveChoiceNewButton} onPress={handleStayHere}>
              <Text style={styles.saveChoiceNewButtonText}>Остаться здесь</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <Modal animationType="slide" transparent visible={showAddRecipeModal} onRequestClose={() => setShowAddRecipeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Добавить рецепт</Text>
              <TouchableOpacity onPress={() => setShowAddRecipeModal(false)}><Ionicons name="close" size={24} color="#666" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalText}>Выберите, как вы хотите добавить рецепт:</Text>
              <TouchableOpacity style={styles.modalOption} onPress={() => { setShowAddRecipeModal(false); router.push("/select-recipe"); }}>
                <Ionicons name="search" size={24} color="#6A9AA9" />
                <Text style={styles.modalOptionText}>Выбрать из рецептов</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOption} onPress={() => { setShowAddRecipeModal(false); router.push("/create-recipe"); }}>
                <Ionicons name="add-circle" size={24} color="#9BDF11" />
                <Text style={styles.modalOptionText}>Создать новый рецепт</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOption} onPress={() => { setShowAddRecipeModal(false); router.push("/select-user-recipes"); }}>
                <Ionicons name="book" size={24} color="#FF9800" />
                <Text style={styles.modalOptionText}>Из моих рецептов</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <Modal animationType="slide" transparent visible={showRationSelectModal} onRequestClose={() => setShowRationSelectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Выбрать рацион</Text>
              <TouchableOpacity onPress={() => setShowRationSelectModal(false)}><Ionicons name="close" size={24} color="#666" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalText}>Как вы хотите сформировать рацион на сегодня?</Text>
              <TouchableOpacity style={styles.modalOption} onPress={() => { setShowRationSelectModal(false); handleGenerateNewRation(); }} disabled={isGeneratingPlan}>
                <Ionicons name="flash-outline" size={24} color="#9BDF11" />
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>Сгенерировать новый</Text>
                  <Text style={styles.modalOptionDescription}>На основе ваших предпочтений и норм КБЖУ</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOption} onPress={() => { setShowRationSelectModal(false); router.push("/saved-plans"); }}>
                <Ionicons name="bookmark-outline" size={24} color="#6A9AA9" />
                <View style={styles.modalOptionTextContainer}>
                  <Text style={styles.modalOptionTitle}>Выбрать из сохраненных</Text>
                  <Text style={styles.modalOptionDescription}>Использовать ранее сохраненный рацион</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      <Modal animationType="fade" transparent visible={showSaveSuccessModal} onRequestClose={() => setShowSaveSuccessModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContainer}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={60} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Рацион сохранен!</Text>
            <Text style={styles.successMessage}>Ваш рацион сохранен в "Мои планы питания"</Text>
            <View style={styles.successButtons}>
              <TouchableOpacity style={[styles.successButton, styles.stayButton]} onPress={() => setShowSaveSuccessModal(false)}>
                <Text style={styles.stayButtonText}>Остаться здесь</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.successButton, styles.goToPlansButton]} onPress={() => { setShowSaveSuccessModal(false); router.push("/saved-plans"); }}>
                <Text style={styles.goToPlansButtonText}>К сохраненным планам</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({ 
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8f8f8" }, 
  loadingText: { marginTop: 10, fontSize: 16, color: "#6A9AA9", fontFamily: "Playfair Display Regular" }, 
  rootContainer: { flex: 1, backgroundColor: "#fff" }, 
  container: { flex: 1 }, 
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: "#FFF", borderBottomWidth: 2, borderBottomColor: "#6A9AA9" }, 
  headerTextContainer: { flex: 1, marginRight: 15 }, 
  greetingText: { fontSize: 24, color: "#1a1a1a", marginBottom: 4, fontFamily: "Playfair Display Bold" }, 
  dietText: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular" }, 
  userInfo: { alignItems: "center", minWidth: 60 }, 
  userName: { fontSize: 12, color: "#666", fontFamily: "Playfair Display Regular", marginTop: 4, textAlign: "center" }, 
  caloriesSection: { padding: 20, backgroundColor: "rgba(255,255,255,0.95)" }, 
  caloriesTitle: { fontSize: 16, color: "#000", fontFamily: "Playfair Display Regular", marginBottom: 12 }, 
  remainingCaloriesContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10 }, 
  remainingCaloriesLabel: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular" }, 
  remainingCaloriesValue: { fontSize: 18, color: "#9BDF11", fontFamily: "Playfair Display Bold" }, 
  progressBar: { height: 12, backgroundColor: "#C2DAE2", borderRadius: 6, overflow: "hidden", marginBottom: 20 }, 
  progressFill: { height: "100%", backgroundColor: "#9BDF11", borderRadius: 6 }, 
  planNameContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#F0F7F0", borderRadius: 12, borderWidth: 1, borderColor: "#C2DAE2" },
  planNameValue: { fontSize: 13, color: "#4CAF50", fontFamily: "Playfair Display Bold", flex: 1, textAlign: "center" },
  buttonsRow: { flexDirection: "row", gap: 12, marginBottom: 10 }, 
  selectRationButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#E5F0F5", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "#C2DAE2", gap: 8 }, 
  selectRationButtonText: { fontSize: 14, color: "#6A9AA9", fontFamily: "Playfair Display Regular" }, 
  saveRationButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#6A9AA9", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 8 },
  saveRationButtonUpdate: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#FF9800", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, gap: 8 },
  saveRationButtonSaving: { opacity: 0.7 }, 
  saveRationButtonText: { fontSize: 14, color: "#FFF", fontFamily: "Playfair Display Regular" }, 
  kbruContainer: { paddingHorizontal: 5, borderWidth: 1, borderColor: "#C2DAE2", borderRadius: 8, backgroundColor: "#F7F7F7", marginBottom: 20 }, 
  kbruRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" }, 
  targetKBRURow: { borderBottomWidth: 0, backgroundColor: "#DDEEF4", borderRadius: 8, marginHorizontal: -1, paddingHorizontal: 6 }, 
  kbruHeader: { fontSize: 12, color: "#6A9AA9", fontFamily: "Playfair Display Bold", textAlign: "center", width: "23%" }, 
  kbruLabel: { fontSize: 14, color: "#212529", fontFamily: "Playfair Display Regular", width: "23%" }, 
  kbruValue: { fontSize: 14, color: "#212529", fontFamily: "Playfair Display Bold", textAlign: "center", width: "23%" }, 
  sectionDivider: { height: 2, backgroundColor: "#6A9AA9", marginHorizontal: -20, marginTop: 10 }, 
  mealsTitleSection: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }, 
  mealsTitle: { fontSize: 20, color: "#1a1a1a", fontFamily: "Playfair Display Bold", flex: 1 }, 
  addRecipeButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#E5F0F5", borderWidth: 1, borderColor: "#C2DAE2", marginLeft: 12 }, 
  addRecipeText: { fontSize: 14, color: "#6A9AA9", fontFamily: "Playfair Display Regular", marginLeft: 6 }, 
  mealsSection: { paddingHorizontal: 20, paddingBottom: 40 }, 
  emptyPlanContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 }, 
  emptyPlanTitle: { fontSize: 20, color: "#212529", fontFamily: "Playfair Display Bold", marginTop: 16, marginBottom: 8 }, 
  emptyPlanText: { fontSize: 14, color: "#6C757D", fontFamily: "Playfair Display Regular", textAlign: "center", marginBottom: 8 }, 
  emptyPlanHint: { fontSize: 12, color: "#999", fontFamily: "Playfair Display Regular", textAlign: "center", marginBottom: 20 }, 
  emptyPlanButton: { backgroundColor: "#6A9AA9", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 25 }, 
  emptyPlanButtonText: { color: "#FFF", fontSize: 14, fontFamily: "Playfair Display Bold" }, 
  recipesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 16 }, 
  recipeColumn: { width: CARD_WIDTH, marginBottom: 16 }, 
  recipeCard: { backgroundColor: "#C2DAE2", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5, height: 300, borderWidth: 1, borderColor: "#A8C8D4" }, 
  imageContainer: { position: "relative", height: 140 }, 
  recipeImage: { width: "100%", height: "100%" }, 
  recipeImagePlaceholder: { width: "100%", height: "100%", backgroundColor: "#E5F0F5", justifyContent: "center", alignItems: "center" }, 
  deleteButton: { position: "absolute", bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,107,107,0.9)", alignItems: "center", justifyContent: "center", zIndex: 10, borderWidth: 1, borderColor: "#FFF" }, 
  customBadge: { position: "absolute", bottom: 8, left: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(155,223,17,0.9)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: "#FFF" }, 
  customBadgeText: { fontSize: 9, color: "#FFF", fontFamily: "Playfair Display Bold", marginLeft: 2 }, 
  difficultyBadge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 }, 
  difficultyText: { fontSize: 10, color: "#FFF", fontFamily: "Playfair Display Bold" }, 
  bookmarkButton: { position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 }, 
  ratingBadge: { position: "absolute", top: 35, left: 8, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: "#E0E0E0" }, 
  ratingText: { fontSize: 10, color: "#000", fontFamily: "Playfair Display Bold", marginLeft: 2 }, 
  recipeContent: { padding: 12, flex: 1, justifyContent: "space-between" }, 
  recipeName: { fontSize: 14, color: "#212529", marginBottom: 4, fontFamily: "Playfair Display Regular", lineHeight: 18, minHeight: 36 }, 
  recipeCategory: { fontSize: 11, color: "#6A9AA9", fontFamily: "Playfair Display Regular", fontStyle: "italic", marginBottom: 6 }, 
  recipeDetails: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 4 }, 
  recipeCalories: { fontSize: 12, color: "#000", fontFamily: "Playfair Display Bold", marginRight: 8 }, 
  timeIcon: { marginRight: 4 }, 
  recipeTime: { fontSize: 12, color: "#6C757D", fontFamily: "Playfair Display Regular", marginRight: 12 }, 
  markButton: { backgroundColor: "#9BDF11", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, alignItems: "center", justifyContent: "center", minHeight: 36, marginTop: 8, borderWidth: 2, borderColor: "#C2DAE2" }, 
  markButtonActive: { backgroundColor: "rgba(155,223,17,0.6)" }, 
  markButtonText: { color: "#000", fontSize: 12, fontFamily: "Playfair Display Regular" }, 
  checkmarkIcon: { width: 16, height: 16, tintColor: "#000" }, 
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 }, 
  modalContainer: { backgroundColor: "#FFF", borderRadius: 20, width: "90%", maxHeight: "80%", overflow: "hidden" }, 
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" }, 
  modalTitle: { fontSize: 18, fontFamily: "Playfair Display Bold", color: "#1a1a1a" }, 
  modalContent: { padding: 20 }, 
  modalText: { fontSize: 16, color: "#666", fontFamily: "Playfair Display Regular", marginBottom: 20, textAlign: "center" }, 
  modalOption: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F8F8", padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E0E0E0" }, 
  modalOptionTextContainer: { flex: 1, marginLeft: 12 }, 
  modalOptionTitle: { fontSize: 16, color: "#1a1a1a", fontFamily: "Playfair Display Bold", marginBottom: 2 }, 
  modalOptionDescription: { fontSize: 12, color: "#666", fontFamily: "Playfair Display Regular" }, 
  modalOptionText: { fontSize: 16, color: "#1a1a1a", fontFamily: "Playfair Display Regular", marginLeft: 12, flex: 1 }, 
  successModalContainer: { backgroundColor: "#FFF", borderRadius: 20, width: "85%", padding: 24, alignItems: "center" }, 
  successModalContent: { backgroundColor: '#FFFFFF', borderRadius: 20, width: '85%', padding: 24, alignItems: 'center' },
  successDescription: { fontSize: 14, color: '#666666', textAlign: 'center', marginBottom: 20, fontFamily: "Playfair Display Regular" },
  successModalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 25, alignItems: 'center' },
  modalButtonPrimary: { backgroundColor: '#9BDF11' },
  modalButtonSecondary: { backgroundColor: '#FFF', borderWidth: 2, borderColor: '#6A9AA9' },
  modalButtonPrimaryText: { color: '#000', fontSize: 14, fontWeight: '600', fontFamily: "Playfair Display Regular" },
  modalButtonSecondaryText: { color: '#6A9AA9', fontSize: 14, fontWeight: '600', fontFamily: "Playfair Display Regular" },
  nameInput: { width: '100%', backgroundColor: '#F5F5F5', borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#333', marginBottom: 20, fontFamily: "Playfair Display Regular" },
  successIconContainer: { marginBottom: 16 }, 
  successTitle: { fontSize: 22, fontFamily: "Playfair Display Bold", color: "#1a1a1a", marginBottom: 8 }, 
  successMessage: { fontSize: 14, color: "#666", fontFamily: "Playfair Display Regular", textAlign: "center", marginBottom: 24 }, 
  successButtons: { flexDirection: "row", gap: 12, width: "100%" }, 
  successButton: { flex: 1, paddingVertical: 12, borderRadius: 25, alignItems: "center" }, 
  stayButton: { backgroundColor: "#FFF", borderWidth: 2, borderColor: "#6A9AA9" }, 
  goToPlansButton: { backgroundColor: "#9BDF11" }, 
  stayButtonText: { color: "#6A9AA9", fontSize: 14, fontWeight: "600", fontFamily: "Playfair Display Regular" }, 
  goToPlansButtonText: { color: "#000", fontSize: 14, fontWeight: "600", fontFamily: "Playfair Display Regular" },
  saveChoiceOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 20 },
  saveChoiceContainer: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, width: '100%', maxWidth: 340, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  saveChoiceTitle: { fontSize: 18, fontWeight: 'bold', color: '#333333', marginBottom: 8, textAlign: 'center', fontFamily: "Playfair Display Bold" },
  saveChoiceText: { fontSize: 14, color: '#666666', textAlign: 'center', marginBottom: 24, lineHeight: 20, fontFamily: "Playfair Display Regular" },
  saveChoiceUpdateButton: { backgroundColor: '#6A9AA9', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, width: '100%', marginBottom: 10, alignItems: 'center' },
  saveChoiceUpdateButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15, fontFamily: "Playfair Display Regular" },
  saveChoiceNewButton: { backgroundColor: '#E4ECEF', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, width: '100%', marginBottom: 16, alignItems: 'center' },
  saveChoiceNewButtonText: { color: '#4A6B75', fontWeight: '600', fontSize: 15, fontFamily: "Playfair Display Regular" },
  saveChoiceCancelText: { color: '#999999', fontSize: 14, fontWeight: '500', fontFamily: "Playfair Display Regular" },
  saveButtonDisabled: { backgroundColor: '#E0E0E0', borderColor: '#D5D5D5', borderWidth: 1, shadowOpacity: 0, elevation: 0 },
  saveButtonTextDisabled: { color: '#999999' },
});