// app/(tabs)/profile/create-ration.tsx
import { Ionicons, Feather, MaterialIcons } from "@expo/vector-icons";
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useState, useEffect, useCallback } from "react"; // Добавляем useCallback
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Modal,
    FlatList,
    Image
} from "react-native";
import { rationPlanService, Meal, DayPlan } from '@/app/services/rationPlanService';
import { recipeService } from '@/app/services/recipeService';
import { recipeSelectionStore } from '@/app/utils/recipeSelectionStore';

export default function CreateRationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const planId = params.planId as string;
    
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'daily' | 'weekly'>('daily');
    const [category, setCategory] = useState('Общее');
    const [days, setDays] = useState<DayPlan[]>([{ 
        day: 1, 
        meals: [], 
        stats: { totalCalories: 0, totalProteins: 0, totalFats: 0, totalCarbs: 0, totalCookingTime: 0 }
    }]);
    const [isTemplate, setIsTemplate] = useState(true);
    const [showRecipeModal, setShowRecipeModal] = useState(false);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [selectedMealCategory, setSelectedMealCategory] = useState('Обед'); // Добавляем выбранную категорию блюда
    const [recipes, setRecipes] = useState<any[]>([]);
    const [userRecipes, setUserRecipes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showMealOptions, setShowMealOptions] = useState<{dayIndex: number, mealIndex: number} | null>(null);

    const categories = ['Общее', 'Похудение', 'Энергия', 'Здоровье', 'Спорт'];
    const mealCategories = ['Завтрак', 'Обед', 'Ужин', 'Перекус', 'Другое']; // Добавляем категории блюд

    // Функция для обработки выбранного рецепта
    const handleSelectedRecipe = useCallback((selection: any) => {
        if (selection && selection.selectedDayIndex === selectedDayIndex) {
            const { recipe, category: mealCategory } = selection;
            
            // Проверяем, не добавлен ли уже этот рецепт
            const existingMeal = days[selectedDayIndex]?.meals.find(
                meal => meal.recipeId === recipe.id
            );
            
            if (existingMeal) {
                Alert.alert('Внимание', 'Это блюдо уже добавлено в этот день');
                recipeSelectionStore.clearSelection();
                return;
            }
            
            const newMeal: Meal = {
                id: `${recipe.id}_${Date.now()}`,
                recipeId: recipe.id,
                name: recipe.title,
                category: mealCategory || selectedMealCategory,
                calories: recipe.calories || 0,
                proteins: recipe.proteins || 0,
                fats: recipe.fats || 0,
                carbohydrates: recipe.carbohydrates || 0,
                weight: recipe.weight || '300 гр',
                cookingTime: recipe.cookingTime || 20,
                difficultyLevel: recipe.difficultyLevel || 'Легко',
                imageUrl: recipe.imageUrl
            };

            addMealToDay(newMeal, selectedDayIndex);
            recipeSelectionStore.clearSelection();
            
            // Показываем уведомление
            Alert.alert('Успешно', `Блюдо "${newMeal.name}" добавлено в ${type === 'daily' ? 'рацион' : `день ${selectedDayIndex + 1}`}!`, [
                { text: 'OK' }
            ]);
        }
    }, [selectedDayIndex, days, type, selectedMealCategory]);

    // Следим за выбором рецепта из recipes
    useFocusEffect(
        React.useCallback(() => {
            // Проверяем при каждом фокусе на экране
            const selection = recipeSelectionStore.getSelection();
            handleSelectedRecipe(selection);

            // Подписываемся на изменения в store
            const unsubscribe = recipeSelectionStore.subscribe(handleSelectedRecipe);

            return () => {
                unsubscribe();
            };
        }, [handleSelectedRecipe])
    );

    useEffect(() => {
        if (planId) {
            loadPlan();
        }
        loadRecipes();
    }, [planId]);

    const loadPlan = async () => {
        try {
            const plan = await rationPlanService.getRationPlanById(planId);
            if (plan) {
                setTitle(plan.title);
                setDescription(plan.description);
                setType(plan.type);
                setCategory(plan.category);
                setDays(plan.days || []);
                setIsTemplate(plan.isTemplate);
            }
        } catch (error) {
            console.error('Error loading plan:', error);
        }
    };

    const loadRecipes = async () => {
        try {
            const allRecipes = await recipeService.getRecipesForPlanner();
            setRecipes(allRecipes || []);
            setUserRecipes(allRecipes || []);
        } catch (error) {
            console.error('Error loading recipes:', error);
        }
    };

    // Функция добавления блюда в день (НЕ закрывает модальное окно)
    const addMealToDay = (meal: Meal, dayIndex: number) => {
        const updatedDays = [...days];
        
        if (!updatedDays[dayIndex]) {
            updatedDays[dayIndex] = {
                day: dayIndex + 1,
                meals: [],
                stats: { totalCalories: 0, totalProteins: 0, totalFats: 0, totalCarbs: 0, totalCookingTime: 0 }
            };
        }

        updatedDays[dayIndex].meals.push(meal);
        updatedDays[dayIndex].stats = calculateDayStats(updatedDays[dayIndex].meals);
        setDays(updatedDays);
        
        // Не закрываем модальное окно, чтобы можно было добавить несколько блюд
        // setShowRecipeModal(false);
    };

    // Функция для добавления блюда из быстрого списка
    const addMealFromQuickList = (recipe: any) => {
        // Проверяем, не добавлен ли уже этот рецепт
        const existingMeal = days[selectedDayIndex]?.meals.find(
            meal => meal.recipeId === recipe.id
        );
        
        if (existingMeal) {
            Alert.alert('Внимание', 'Это блюдо уже добавлено в этот день');
            return;
        }
        
        const newMeal: Meal = {
            id: `${recipe.id}_${Date.now()}`,
            recipeId: recipe.id,
            name: recipe.title || recipe.name,
            category: selectedMealCategory,
            calories: recipe.calories || 0,
            proteins: recipe.proteins || 0,
            fats: recipe.fats || 0,
            carbohydrates: recipe.carbohydrates || recipe.carbs || 0,
            weight: recipe.weight || '300 гр',
            cookingTime: recipe.cookingTime || 20,
            difficultyLevel: recipe.difficultyLevel || 'Легко',
            imageUrl: recipe.imageUrl
        };

        addMealToDay(newMeal, selectedDayIndex);
        Alert.alert('Успешно', `Блюдо "${newMeal.name}" добавлено!`, [
            { text: 'OK' }
        ]);
    };

    const removeMeal = (dayIndex: number, mealId: string) => {
        const updatedDays = [...days];
        updatedDays[dayIndex].meals = updatedDays[dayIndex].meals.filter(meal => meal.id !== mealId);
        updatedDays[dayIndex].stats = calculateDayStats(updatedDays[dayIndex].meals);
        setDays(updatedDays);
        setShowMealOptions(null);
    };

    const editMealCategory = (dayIndex: number, mealIndex: number) => {
        Alert.prompt(
            'Изменить категорию блюда',
            'Введите новую категорию:',
            [
                { text: 'Отмена', style: 'cancel' },
                { 
                    text: 'Сохранить', 
                    onPress: (newCategory: string | undefined) => {
                        if (newCategory && newCategory.trim()) {
                            const updatedDays = [...days];
                            updatedDays[dayIndex].meals[mealIndex].category = newCategory.trim();
                            setDays(updatedDays);
                        }
                    }
                }
            ],
            'plain-text',
            days[dayIndex].meals[mealIndex].category
        );
        setShowMealOptions(null);
    };

    const navigateToRecipes = () => {
        setShowRecipeModal(false);
        router.push({
            pathname: '/recipes',
            params: { 
                fromCreateRation: 'true',
                selectedDayIndex: selectedDayIndex.toString(),
                mealCategory: selectedMealCategory
            }
        });
    };

    const navigateToUserRecipes = () => {
        setShowRecipeModal(false);
        router.push({
            pathname: '/recipes',
            params: { 
                fromCreateRation: 'true',
                selectedDayIndex: selectedDayIndex.toString(),
                mealCategory: selectedMealCategory,
                showUserRecipes: 'true'
            }
        });
    };

    const calculateDayStats = (meals: Meal[]) => {
        return meals.reduce((stats, meal) => ({
            totalCalories: stats.totalCalories + (meal.calories || 0),
            totalProteins: stats.totalProteins + (meal.proteins || 0),
            totalFats: stats.totalFats + (meal.fats || 0),
            totalCarbs: stats.totalCarbs + (meal.carbohydrates || 0),
            totalCookingTime: stats.totalCookingTime + (meal.cookingTime || 0)
        }), {
            totalCalories: 0,
            totalProteins: 0,
            totalFats: 0,
            totalCarbs: 0,
            totalCookingTime: 0
        });
    };

    const calculateTotalStats = () => {
        return days.reduce((total, day) => ({
            calories: total.calories + day.stats.totalCalories,
            proteins: total.proteins + day.stats.totalProteins,
            fats: total.fats + day.stats.totalFats,
            carbs: total.carbs + day.stats.totalCarbs,
            cookingTime: total.cookingTime + day.stats.totalCookingTime
        }), { calories: 0, proteins: 0, fats: 0, carbs: 0, cookingTime: 0 });
    };

    const handleSave = async () => {
        if (!title.trim()) {
            Alert.alert('Ошибка', 'Введите название плана');
            return;
        }

        setLoading(true);
        try {
            const totalStats = calculateTotalStats();
            const totalCalories = type === 'daily' 
                ? days[0]?.stats.totalCalories || 0 
                : Math.round(totalStats.calories / Math.max(days.length, 1));
            
            const planData = {
                title,
                description,
                type,
                days,
                isTemplate,
                category,
                totalCalories,
                totalDuration: type === 'weekly' ? '7 дней' : '1 день',
                mealsCount: days.reduce((total, day) => total + day.meals.length, 0)
            };

            if (planId) {
                await rationPlanService.updateRationPlan(planId, planData);
                Alert.alert('Успешно', 'План обновлен!', [
                    {
                        text: 'OK',
                        onPress: () => {
                            // Возвращаемся к списку планов
                            router.back();
                        }
                    }
                ]);
            } else {
                await rationPlanService.createRationPlan('user_002', planData);
                Alert.alert('Успешно', 'План создан!', [
                    {
                        text: 'OK',
                        onPress: () => {
                            // Возвращаемся к списку планов
                            router.back();
                        }
                    }
                ]);
            }
        } catch (error) {
            Alert.alert('Ошибка', 'Не удалось сохранить план');
        } finally {
            setLoading(false);
        }
    };

    const addDay = () => {
        if (type === 'weekly' && days.length < 7) {
            const newDay: DayPlan = {
                day: days.length + 1,
                meals: [],
                stats: { totalCalories: 0, totalProteins: 0, totalFats: 0, totalCarbs: 0, totalCookingTime: 0 }
            };
            setDays([...days, newDay]);
        }
    };

    const removeDay = (index: number) => {
        if (days.length > 1) {
            const updatedDays = days.filter((_, i) => i !== index);
            setDays(updatedDays.map((day, i) => ({ ...day, day: i + 1 })));
        }
    };

    const renderRecipeItem = ({ item }: { item: any }) => (
        <TouchableOpacity 
            style={styles.recipeItem}
            onPress={() => addMealFromQuickList(item)}
        >
            {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.recipeImage} />
            ) : (
                <View style={[styles.recipeImage, styles.recipeImagePlaceholder]}>
                    <Ionicons name="restaurant" size={24} color="#6A9AA9" />
                </View>
            )}
            <View style={styles.recipeInfo}>
                <Text style={styles.recipeName} numberOfLines={2}>
                    {item.title || item.name}
                </Text>
                <View style={styles.recipeDetails}>
                    <Text style={styles.recipeCalories}>{item.calories || 0} ккал</Text>
                    <Text style={styles.recipeTime}>{item.cookingTime || 20} мин</Text>
                </View>
                <Text style={styles.recipeCategory}>
                    {item.mealType || item.category || 'Обед'}
                </Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />
            
            {/* Заголовок */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {planId ? 'Редактировать план' : 'Создать план'}
                </Text>
                <TouchableOpacity 
                    style={styles.saveButton} 
                    onPress={handleSave}
                    disabled={loading}
                >
                    <Text style={styles.saveButtonText}>
                        {loading ? 'Сохранение...' : 'Сохранить'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
                {/* Основная информация */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Основная информация</Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Название плана"
                        value={title}
                        onChangeText={setTitle}
                    />
                    
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Описание (необязательно)"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        numberOfLines={3}
                    />
                    
                    <View style={styles.typeSelector}>
                        <TouchableOpacity
                            style={[styles.typeButton, type === 'daily' && styles.typeButtonActive]}
                            onPress={() => {
                                setType('daily');
                                if (days.length > 1) {
                                    setDays([days[0]]);
                                }
                            }}
                        >
                            <Ionicons name="today-outline" size={20} color={type === 'daily' ? '#000' : '#666'} />
                            <Text style={[styles.typeButtonText, type === 'daily' && styles.typeButtonTextActive]}>
                                На день
                            </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                            style={[styles.typeButton, type === 'weekly' && styles.typeButtonActive]}
                            onPress={() => setType('weekly')}
                        >
                            <Ionicons name="calendar-outline" size={20} color={type === 'weekly' ? '#000' : '#666'} />
                            <Text style={[styles.typeButtonText, type === 'weekly' && styles.typeButtonTextActive]}>
                                На неделю
                            </Text>
                        </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                        style={styles.categoryButton}
                        onPress={() => setShowCategoryModal(true)}
                    >
                        <Text style={styles.categoryButtonText}>Категория: {category}</Text>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                        style={styles.templateToggle}
                        onPress={() => setIsTemplate(!isTemplate)}
                    >
                        <View style={[styles.checkbox, isTemplate && styles.checkboxChecked]}>
                            {isTemplate && <Ionicons name="checkmark" size={16} color="#000" />}
                        </View>
                        <Text style={styles.templateText}>Сохранить как шаблон</Text>
                    </TouchableOpacity>
                </View>

                {/* Дни */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            {type === 'daily' ? 'Рацион на день' : 'Рацион по дням'}
                        </Text>
                        {type === 'weekly' && days.length < 7 && (
                            <TouchableOpacity style={styles.addDayButton} onPress={addDay}>
                                <Ionicons name="add-circle" size={24} color="#9BDF11" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {days.map((day, dayIndex) => (
                        <View key={dayIndex} style={styles.dayCard}>
                            <View style={styles.dayHeader}>
                                <Text style={styles.dayTitle}>
                                    {type === 'weekly' ? `День ${day.day}` : 'Рацион'}
                                </Text>
                                {type === 'weekly' && days.length > 1 && (
                                    <TouchableOpacity 
                                        style={styles.removeDayButton}
                                        onPress={() => removeDay(dayIndex)}
                                    >
                                        <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Блюда дня */}
                            {day.meals.length === 0 ? (
                                <View style={styles.emptyMeals}>
                                    <Ionicons name="restaurant-outline" size={40} color="#C2DAE2" />
                                    <Text style={styles.emptyMealsText}>Нет блюд</Text>
                                </View>
                            ) : (
                                <View style={styles.mealsList}>
                                    {day.meals.map((meal, mealIndex) => (
                                        <TouchableOpacity
                                            key={meal.id}
                                            style={styles.mealItem}
                                            onPress={() => setShowMealOptions({ dayIndex, mealIndex })}
                                        >
                                            <View style={styles.mealImageContainer}>
                                                {meal.imageUrl ? (
                                                    <Image source={{ uri: meal.imageUrl }} style={styles.mealImage} />
                                                ) : (
                                                    <View style={styles.mealImagePlaceholder}>
                                                        <Ionicons name="restaurant" size={20} color="#6A9AA9" />
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.mealInfo}>
                                                <Text style={styles.mealName} numberOfLines={1}>{meal.name}</Text>
                                                <Text style={styles.mealCategory}>{meal.category}</Text>
                                                <View style={styles.mealStats}>
                                                    <Text style={styles.mealStat}>{meal.calories} ккал</Text>
                                                    <Text style={styles.mealStat}>•</Text>
                                                    <Text style={styles.mealStat}>{meal.cookingTime} мин</Text>
                                                </View>
                                            </View>
                                            <Ionicons name="ellipsis-vertical" size={20} color="#666" />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}

                            {/* Статистика дня */}
                            {day.meals.length > 0 && (
                                <View style={styles.dayStats}>
                                    <View style={styles.statItem}>
                                        <Ionicons name="flame-outline" size={14} color="#FF6B6B" />
                                        <Text style={styles.statText}>{day.stats.totalCalories} ккал</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Ionicons name="barbell-outline" size={14} color="#6A9AA9" />
                                        <Text style={styles.statText}>{day.stats.totalProteins}г белков</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Ionicons name="time-outline" size={14} color="#9BDF11" />
                                        <Text style={styles.statText}>{day.stats.totalCookingTime} мин</Text>
                                    </View>
                                </View>
                            )}

                            <TouchableOpacity 
                                style={styles.addMealButton}
                                onPress={() => {
                                    setSelectedDayIndex(dayIndex);
                                    setShowRecipeModal(true);
                                }}
                            >
                                <Ionicons name="add" size={20} color="#000" />
                                <Text style={styles.addMealButtonText}>Добавить блюдо</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                {/* Общая статистика */}
                {days.some(day => day.meals.length > 0) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Общая статистика</Text>
                        <View style={styles.totalStats}>
                            <View style={styles.totalStatItem}>
                                <Ionicons name="flame-outline" size={20} color="#FF6B6B" />
                                <Text style={styles.totalStatValue}>
                                    {calculateTotalStats().calories} ккал
                                </Text>
                                <Text style={styles.totalStatLabel}>Всего калорий</Text>
                            </View>
                            <View style={styles.totalStatItem}>
                                <Ionicons name="restaurant-outline" size={20} color="#9BDF11" />
                                <Text style={styles.totalStatValue}>
                                    {days.reduce((total, day) => total + day.meals.length, 0)}
                                </Text>
                                <Text style={styles.totalStatLabel}>Блюд</Text>
                            </View>
                            <View style={styles.totalStatItem}>
                                <Ionicons name="time-outline" size={20} color="#6A9AA9" />
                                <Text style={styles.totalStatValue}>
                                    {calculateTotalStats().cookingTime} мин
                                </Text>
                                <Text style={styles.totalStatLabel}>Время готовки</Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Модальное окно выбора источника рецептов */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={showRecipeModal}
                onRequestClose={() => setShowRecipeModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Добавить блюдо</Text>
                            <TouchableOpacity 
                                style={styles.modalCloseButton}
                                onPress={() => setShowRecipeModal(false)}
                            >
                                <Ionicons name="close" size={24} color="#000" />
                            </TouchableOpacity>
                        </View>
                        
                        {/* Выбор категории блюда */}
                        <View style={styles.mealCategorySection}>
                            <Text style={styles.mealCategoryLabel}>Категория блюда:</Text>
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                style={styles.mealCategoriesContainer}
                            >
                                {mealCategories.map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={[
                                            styles.mealCategoryButton,
                                            selectedMealCategory === cat && styles.mealCategoryButtonActive
                                        ]}
                                        onPress={() => setSelectedMealCategory(cat)}
                                    >
                                        <Text style={[
                                            styles.mealCategoryText,
                                            selectedMealCategory === cat && styles.mealCategoryTextActive
                                        ]}>
                                            {cat}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                        
                        <View style={styles.recipeSourceContainer}>
                            <TouchableOpacity 
                                style={styles.sourceOption}
                                onPress={navigateToRecipes}
                            >
                                <View style={styles.sourceIconContainer}>
                                    <Ionicons name="book-outline" size={32} color="#6A9AA9" />
                                </View>
                                <Text style={styles.sourceTitle}>Список рецептов</Text>
                                <Text style={styles.sourceDescription}>
                                    Выберите из общей базы рецептов
                                </Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity 
                                style={styles.sourceOption}
                                onPress={navigateToUserRecipes}
                            >
                                <View style={styles.sourceIconContainer}>
                                    <Ionicons name="person-outline" size={32} color="#9BDF11" />
                                </View>
                                <Text style={styles.sourceTitle}>Мои рецепты</Text>
                                <Text style={styles.sourceDescription}>
                                    Выберите из ваших сохраненных рецептов
                                </Text>
                            </TouchableOpacity>
                        </View>
                        
                        <Text style={styles.sourceSectionTitle}>Или выберите из быстрого списка:</Text>
                        
                        <FlatList
                            data={recipes.slice(0, 10)}
                            renderItem={renderRecipeItem}
                            keyExtractor={(item) => item.id}
                            style={styles.recipesList}
                            contentContainerStyle={styles.recipesListContent}
                        />
                        
                        {/* Кнопка закрытия */}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity 
                                style={styles.closeModalButton}
                                onPress={() => setShowRecipeModal(false)}
                            >
                                <Text style={styles.closeModalButtonText}>Закрыть</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Модальное окно выбора категории плана */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={showCategoryModal}
                onRequestClose={() => setShowCategoryModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.smallModal}>
                        <Text style={styles.modalTitle}>Выберите категорию</Text>
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat}
                                style={styles.categoryOption}
                                onPress={() => {
                                    setCategory(cat);
                                    setShowCategoryModal(false);
                                }}
                            >
                                <Text style={styles.categoryOptionText}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity 
                            style={styles.modalCancelButton}
                            onPress={() => setShowCategoryModal(false)}
                        >
                            <Text style={styles.modalCancelButtonText}>Отмена</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Модальное окно опций блюда */}
            {showMealOptions && (
                <Modal
                    animationType="fade"
                    transparent={true}
                    visible={!!showMealOptions}
                    onRequestClose={() => setShowMealOptions(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.actionModal}>
                            <View style={styles.actionModalContent}>
                                <TouchableOpacity 
                                    style={styles.actionOption}
                                    onPress={() => editMealCategory(
                                        showMealOptions.dayIndex, 
                                        showMealOptions.mealIndex
                                    )}
                                >
                                    <Ionicons name="pencil-outline" size={20} color="#6A9AA9" />
                                    <Text style={styles.actionOptionText}>Изменить категорию</Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={[styles.actionOption, styles.deleteOption]}
                                    onPress={() => removeMeal(
                                        showMealOptions.dayIndex, 
                                        days[showMealOptions.dayIndex].meals[showMealOptions.mealIndex].id
                                    )}
                                >
                                    <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                                    <Text style={[styles.actionOptionText, styles.deleteOptionText]}>Удалить</Text>
                                </TouchableOpacity>
                            </View>
                            
                            <TouchableOpacity 
                                style={styles.actionModalCancel}
                                onPress={() => setShowMealOptions(null)}
                            >
                                <Text style={styles.actionModalCancelText}>Отмена</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}

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
        fontSize: 20,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
        textAlign: "center",
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: "#9BDF11",
        borderRadius: 20,
    },
    saveButtonText: {
        color: "#000000",
        fontSize: 14,
        fontWeight: "600",
        fontFamily: "Playfair Display Regular",
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    input: {
        backgroundColor: "#FFFFFF",
        borderWidth: 2,
        borderColor: "#6A9AA9",
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        fontFamily: "Playfair Display Regular",
        marginBottom: 12,
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: "top",
    },
    typeSelector: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 12,
    },
    typeButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 2,
        borderColor: "#6A9AA9",
        borderRadius: 10,
        paddingVertical: 12,
    },
    typeButtonActive: {
        backgroundColor: "#9BDF11",
        borderColor: "#9BDF11",
    },
    typeButtonText: {
        fontSize: 14,
        color: "#666",
        fontFamily: "Playfair Display Regular",
        fontWeight: "600",
    },
    typeButtonTextActive: {
        color: "#000000",
    },
    categoryButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#FFFFFF",
        borderWidth: 2,
        borderColor: "#6A9AA9",
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 12,
    },
    categoryButtonText: {
        fontSize: 16,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
    },
    templateToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: "#6A9AA9",
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
    },
    checkboxChecked: {
        backgroundColor: "#9BDF11",
        borderColor: "#9BDF11",
    },
    templateText: {
        fontSize: 16,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
    },
    addDayButton: {
        padding: 4,
    },
    dayCard: {
        backgroundColor: "#C2DAE2",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    dayHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    dayTitle: {
        fontSize: 16,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
    },
    removeDayButton: {
        padding: 4,
    },
    emptyMeals: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 20,
    },
    emptyMealsText: {
        fontSize: 14,
        color: "#6A9AA9",
        fontFamily: "Playfair Display Regular",
        marginTop: 8,
    },
    mealsList: {
        marginBottom: 12,
    },
    mealItem: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
    },
    mealImageContainer: {
        marginRight: 12,
    },
    mealImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
    },
    mealImagePlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 8,
        backgroundColor: "#6A9AA9",
        alignItems: "center",
        justifyContent: "center",
    },
    mealInfo: {
        flex: 1,
    },
    mealName: {
        fontSize: 14,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
        marginBottom: 4,
    },
    mealCategory: {
        fontSize: 12,
        color: "#6A9AA9",
        fontFamily: "Playfair Display Regular",
        marginBottom: 4,
    },
    mealStats: {
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
    },
    mealStat: {
        fontSize: 12,
        color: "#666",
        fontFamily: "Playfair Display Regular",
    },
    dayStats: {
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: "#FFFFFF",
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    statItem: {
        alignItems: "center",
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
    },
    addMealButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: "#9BDF11",
        borderRadius: 25,
        paddingVertical: 12,
    },
    addMealButtonText: {
        fontSize: 14,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
        fontWeight: "600",
    },
    totalStats: {
        flexDirection: "row",
        justifyContent: "space-between",
        backgroundColor: "#C2DAE2",
        borderRadius: 12,
        padding: 16,
    },
    totalStatItem: {
        alignItems: "center",
        flex: 1,
    },
    totalStatValue: {
        fontSize: 18,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
        marginVertical: 4,
    },
    totalStatLabel: {
        fontSize: 12,
        color: "#6A9AA9",
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
        maxHeight: "90%",
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
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
    },
    modalCloseButton: {
        padding: 4,
    },
    // Стили для выбора категории блюда
    mealCategorySection: {
        padding: 20,
        paddingBottom: 0,
        borderBottomWidth: 1,
        borderBottomColor: "#C2DAE2",
    },
    mealCategoryLabel: {
        fontSize: 16,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Regular",
        marginBottom: 12,
    },
    mealCategoriesContainer: {
        marginBottom: 16,
    },
    mealCategoryButton: {
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#6A9AA9",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
    },
    mealCategoryButtonActive: {
        backgroundColor: "#9BDF11",
        borderColor: "#9BDF11",
    },
    mealCategoryText: {
        fontSize: 14,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
        fontWeight: "600",
    },
    mealCategoryTextActive: {
        color: "#000000",
    },
    recipeSourceContainer: {
        padding: 20,
        flexDirection: "row",
        gap: 16,
    },
    sourceOption: {
        flex: 1,
        backgroundColor: "#C2DAE2",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
    },
    sourceIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    sourceTitle: {
        fontSize: 16,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
        marginBottom: 4,
        textAlign: "center",
    },
    sourceDescription: {
        fontSize: 12,
        color: "#6A9AA9",
        fontFamily: "Playfair Display Regular",
        textAlign: "center",
    },
    sourceSectionTitle: {
        fontSize: 16,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Regular",
        marginHorizontal: 20,
        marginBottom: 12,
        marginTop: 10,
    },
    recipesList: {
        flex: 1,
        maxHeight: 300,
    },
    recipesListContent: {
        padding: 20,
        paddingTop: 0,
    },
    recipeItem: {
        flexDirection: "row",
        backgroundColor: "#C2DAE2",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    recipeImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    recipeImagePlaceholder: {
        backgroundColor: "#6A9AA9",
        alignItems: "center",
        justifyContent: "center",
    },
    recipeInfo: {
        flex: 1,
        justifyContent: "center",
    },
    recipeName: {
        fontSize: 16,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
        marginBottom: 4,
    },
    recipeDetails: {
        flexDirection: "row",
        gap: 12,
        marginBottom: 4,
    },
    recipeCalories: {
        fontSize: 12,
        color: "#FF6B6B",
        fontFamily: "Playfair Display Regular",
    },
    recipeTime: {
        fontSize: 12,
        color: "#6A9AA9",
        fontFamily: "Playfair Display Regular",
    },
    recipeCategory: {
        fontSize: 12,
        color: "#9BDF11",
        fontFamily: "Playfair Display Regular",
        fontWeight: "600",
    },
    modalButtons: {
        padding: 20,
        paddingTop: 0,
    },
    closeModalButton: {
        backgroundColor: "#6A9AA9",
        borderRadius: 25,
        paddingVertical: 12,
        alignItems: "center",
    },
    closeModalButtonText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontFamily: "Playfair Display Regular",
        fontWeight: "600",
    },
    smallModal: {
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 20,
        marginTop: "40%",
    },
    categoryOption: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#C2DAE2",
    },
    categoryOptionText: {
        fontSize: 16,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Regular",
        textAlign: "center",
    },
    modalCancelButton: {
        marginTop: 16,
        paddingVertical: 12,
    },
    modalCancelButtonText: {
        fontSize: 16,
        color: "#6A9AA9",
        fontFamily: "Playfair Display Regular",
        textAlign: "center",
    },
    actionModal: {
        backgroundColor: "transparent",
        marginHorizontal: 20,
        marginBottom: 100,
    },
    actionModalContent: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        marginBottom: 8,
        overflow: "hidden",
    },
    actionOption: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#C2DAE2",
    },
    deleteOption: {
        borderBottomWidth: 0,
    },
    actionOptionText: {
        fontSize: 16,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Regular",
        flex: 1,
    },
    deleteOptionText: {
        color: "#FF6B6B",
    },
    actionModalCancel: {
        backgroundColor: "#FFFFFF",
        borderRadius: 12,
        paddingVertical: 16,
    },
    actionModalCancelText: {
        fontSize: 16,
        color: "#6A9AA9",
        fontFamily: "Playfair Display Regular",
        textAlign: "center",
        fontWeight: "600",
    },
});