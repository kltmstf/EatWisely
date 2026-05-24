// app/create-recipe.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { recipeService, DietType } from '@/app/services/recipeService';
import { cloudinaryService, UploadProgress } from '@/app/services/cloudinaryService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Тип для ингредиента
interface Ingredient {
  id: string;
  amount: string;
  unit: string;
  name: string;
}

// Тип для шага приготовления
interface Step {
  id: string;
  text: string;
}

// Доступные категории
const AVAILABLE_CATEGORIES = [
  'Завтрак', 'Обед', 'Ужин', 'Перекус',
  'Супы', 'Салаты', 'Горячее', 'Десерты',
  'Напитки', 'Соусы', 'Выпечка'
];

// Доступные типы питания с описанием
const DIET_TYPES_WITH_INFO = [
  { id: 'Обычное', name: 'Обычное', description: 'Стандартное питание без ограничений. Подходит для большинства людей.' },
  { id: 'Вегетарианское', name: 'Вегетарианское', description: 'Без мяса и рыбы. Разрешены яйца, молочные продукты и мед.' },
  { id: 'Веганское', name: 'Веганское', description: 'Полный отказ от продуктов животного происхождения. Только растительная пища.' },
  { id: 'Безглютеновое', name: 'Безглютеновое', description: 'Исключение глютена (пшеница, рожь, ячмень).' },
  { id: 'Безлактозное', name: 'Безлактозное', description: 'Исключение молочных продуктов и лактозы.' },
  { id: 'Низкоуглеводное', name: 'Низкоуглеводное', description: 'Ограничение углеводов до 50-100г в день. Акцент на белках и жирах.' },
  { id: 'Высокобелковое', name: 'Высокобелковое', description: 'Повышенное содержание белка для роста мышц и восстановления.' },
  { id: 'Средиземноморское', name: 'Средиземноморское', description: 'Много овощей, рыбы, оливкового масла.' },
  { id: 'Кето', name: 'Кето', description: 'Очень низкое содержание углеводов (менее 20г), высокое содержание жиров (70-80%).' }
];

export default function CreateRecipeModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [dietInfoModalVisible, setDietInfoModalVisible] = useState(false);
  const [selectedDietInfo, setSelectedDietInfo] = useState<{ name: string; description: string } | null>(null);

  const isEditMode = params.isEditMode === "true";
  const recipeId = params.recipeId as string | undefined;

  // Форма
  const [form, setForm] = useState({
    title: params.title as string || '',
    description: params.description as string || '',
    mealType: params.mealType as string || 'Завтрак',
    difficulty: params.difficulty as string || 'Легко',
    cookingTime: params.cookingTime as string || '',
    totalCalories: params.totalCalories as string || '',
    totalProteins: params.totalProteins as string || '0',
    totalFats: params.totalFats as string || '0',
    totalCarbohydrates: params.totalCarbohydrates as string || '0',
    weight: params.weight as string || '300',
    servings: params.servings as string || '1',
  });
  
  const [dietType, setDietType] = useState<DietType>('Обычное');
  const [prepTime, setPrepTime] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (params.categories) {
      try {
        return JSON.parse(params.categories as string);
      } catch {
        return [];
      }
    }
    return [];
  });
  
  const [image, setImage] = useState<string | null>(params.imageUrl as string || null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [isPublic, setIsPublic] = useState(
    params.isPublic === "true" || params.isPublic === "1" || false
  );
  
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    if (params.ingredients && typeof params.ingredients === 'string' && params.ingredients !== '') {
      try {
        const parsed = JSON.parse(params.ingredients);
        if (Array.isArray(parsed)) {
          if (typeof parsed[0] === 'string') {
            return parsed.map((item: string, index: number) => {
              const parts = item.split(' ');
              return {
                id: (index + 1).toString(),
                amount: parts[0] || '',
                unit: parts[1] || 'гр',
                name: parts.slice(2).join(' ') || '',
              };
            });
          } else {
            return parsed.map((item: any, index: number) => ({
              id: (index + 1).toString(),
              amount: String(item.amount || item.quantity || ''),
              unit: item.unit || 'гр',
              name: item.name || item.text || '',
            }));
          }
        }
      } catch (error) {
        console.log('Ошибка парсинга ингредиентов:', error);
      }
    }
    return [{ id: '1', amount: '', unit: '', name: '' }];
  });
  
  const [steps, setSteps] = useState<Step[]>(() => {
    if (params.instructions && typeof params.instructions === 'string' && params.instructions !== '') {
      try {
        const parsed = JSON.parse(params.instructions);
        if (Array.isArray(parsed)) {
          return parsed.map((item: any, index: number) => ({
            id: (index + 1).toString(),
            text: String(item.text || item.description || item || ''),
          }));
        }
      } catch (error) {
        console.log('Ошибка парсинга шагов:', error);
        try {
          const arrayParsed = JSON.parse(params.instructions);
          if (Array.isArray(arrayParsed)) {
            return arrayParsed.map((text: string, index: number) => ({
              id: (index + 1).toString(),
              text: String(text || ''),
            }));
          }
        } catch (e) {
          console.log('Не удалось распарсить инструкции:', e);
        }
      }
    }
    return [{ id: '1', text: '' }];
  });

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleClose = () => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      setTimeout(() => router.back(), 50);
    });
  };

  const showDietInfo = (dietTypeInfo: typeof DIET_TYPES_WITH_INFO[0]) => {
    setSelectedDietInfo({ name: dietTypeInfo.name, description: dietTypeInfo.description });
    setDietInfoModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Доступ к галерее', 'Для выбора фото рецепта необходимо разрешение');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        selectionLimit: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Ошибка выбора изображения:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
  };

  const uploadImageToCloudinary = async (): Promise<{ url: string | null; publicId: string | null }> => {
    if (!image) return { url: null, publicId: null };
    if (image.startsWith('http')) return { url: image, publicId: null };

    try {
      setUploadingImage(true);
      setUploadProgress(0);
      setUploadStage('Подготовка изображения...');

      const onProgress = (progress: UploadProgress) => {
        setUploadProgress(progress.percent);
        setUploadStage(`Загрузка: ${Math.round(progress.percent)}%`);
      };

      const result = await cloudinaryService.uploadImage(image, { onProgress });

      if (result.success && result.url && result.publicId) {
        setUploadStage('Завершение...');
        await new Promise(resolve => setTimeout(resolve, 300));
        return { url: result.url, publicId: result.publicId };
      }
      throw new Error(result.error || 'Не удалось загрузить изображение');
    } catch (error: any) {
      console.error('Ошибка при загрузке:', error);
      throw error;
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  const addIngredient = () => {
    const newId = (ingredients.length + 1).toString();
    setIngredients([...ingredients, { id: newId, amount: '', unit: '', name: '' }]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, [field]: value } : ing
    ));
  };

  const removeIngredient = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter(ing => ing.id !== id));
    }
  };

  const addStep = () => {
    const newId = (steps.length + 1).toString();
    setSteps([...steps, { id: newId, text: '' }]);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const updateStep = (id: string, value: string) => {
    setSteps(steps.map(step => step.id === id ? { ...step, text: value } : step));
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(step => step.id !== id));
    }
  };

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter(c => c !== category));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const validateForm = (): string | null => {
    if (!form.title.trim()) return 'Введите название рецепта';
    if (!form.description.trim()) return 'Введите описание рецепта';
    if (!form.cookingTime.trim() && !prepTime.trim()) return 'Введите время приготовления';
    if (!form.weight.trim()) return 'Введите вес блюда';
    if (!form.totalCalories.trim()) return 'Введите количество калорий на всё блюдо';
    
    for (const ing of ingredients) {
      if (!ing.amount.trim() || !ing.name.trim()) {
        return 'Заполните все поля ингредиентов';
      }
    }
    
    for (const step of steps) {
      if (!step.text.trim()) {
        return 'Заполните все шаги приготовления';
      }
    }
    
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Ошибка', error);
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      let imageUrl: string | undefined = undefined;
      let cloudinaryPublicId: string | null = (params.cloudinaryPublicId as string) || null;
      
      if (image && !image.startsWith('http')) {
        try {
          const uploadResult = await uploadImageToCloudinary();
          if (uploadResult.url) {
            imageUrl = uploadResult.url;
            cloudinaryPublicId = uploadResult.publicId;
          }
        } catch (uploadError: any) {
          const shouldContinue = await new Promise((resolve) => {
            Alert.alert(
              'Не удалось загрузить фото',
              'Хотите продолжить без изменения фото?',
              [
                { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Продолжить', onPress: () => resolve(true) },
              ]
            );
          });
          if (!shouldContinue) {
            setLoading(false);
            return;
          }
        }
      } else if (image && image.startsWith('http')) {
        imageUrl = image;
      }

      const ingredientsArray = ingredients.map(ing => 
        `${ing.amount} ${ing.unit} ${ing.name}`
      );
      
      const stepsArray = steps.map(step => step.text.trim());

      // Получаем общий вес блюда
      const totalWeight = parseFloat(form.weight) || 0;
      
      // Рассчитываем КБЖУ на 100г
      const totalCalories = parseFloat(form.totalCalories) || 0;
      const totalProteins = parseFloat(form.totalProteins) || 0;
      const totalFats = parseFloat(form.totalFats) || 0;
      const totalCarbs = parseFloat(form.totalCarbohydrates) || 0;
      
      const nutritionPer100g = {
        protein: totalWeight > 0 ? Math.round((totalProteins / totalWeight) * 100 * 10) / 10 : 0,
        fat: totalWeight > 0 ? Math.round((totalFats / totalWeight) * 100 * 10) / 10 : 0,
        carbs: totalWeight > 0 ? Math.round((totalCarbs / totalWeight) * 100 * 10) / 10 : 0,
        calories: totalWeight > 0 ? Math.round((totalCalories / totalWeight) * 100) : 0,
      };

      // Получаем общее время приготовления
      const totalPrepTime = parseInt(prepTime) || parseInt(form.cookingTime) || 20;

      const recipeData: any = {
        title: form.title.trim(),
        description: form.description.trim(),
        categories: selectedCategories,
        dietType: dietType,
        prepTime: totalPrepTime,
        cookingTime: totalPrepTime,
        difficulty: form.difficulty,
        ingredientsList: ingredientsArray.map(ing => ing.toLowerCase()),
        steps: stepsArray,
        nutritionPer100g: nutritionPer100g,
        isPublic: isPublic,
        imageUrl: imageUrl || null,
        cloudinaryPublicId: cloudinaryPublicId,
        mealType: form.mealType,
        weight: form.weight.trim(),
        servings: parseInt(form.servings) || 1,
        // Сохраняем полные значения на порцию для отображения
        totalCalories: totalCalories,
        totalProteins: totalProteins,
        totalFats: totalFats,
        totalCarbohydrates: totalCarbs,
        calories: totalCalories, // для обратной совместимости
        proteins: totalProteins,
        fats: totalFats,
        carbohydrates: totalCarbs,
        ingredients: ingredientsArray,
        ingredientsText: ingredientsArray.join('\n'),
        tags: [],
      };

      if (isEditMode && recipeId) {
        await recipeService.updateRecipe(recipeId, recipeData);
        Alert.alert('✅ Успех!', 'Рецепт успешно обновлен', [{ text: 'ОК', onPress: handleClose }]);
      } else {
        await recipeService.createRecipe(recipeData);
        Alert.alert('🎉 Успех!', 'Рецепт успешно создан', [{ text: 'ОК', onPress: handleClose }]);
      }
      
    } catch (error: any) {
      console.error(`Ошибка ${isEditMode ? 'обновления' : 'создания'} рецепта:`, error);
      Alert.alert('Ошибка', error.message || `Не удалось ${isEditMode ? 'обновить' : 'создать'} рецепт`);
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const mealTypes = ['Завтрак', 'Обед', 'Ужин', 'Перекусы'];
  const difficulties = ['Легко', 'Средне', 'Сложно'];

  // Автоматический расчет КБЖУ на 100г при изменении веса или общего КБЖУ
  const calculatePer100g = () => {
    const weight = parseFloat(form.weight) || 0;
    if (weight === 0) return { calories: 0, proteins: 0, fats: 0, carbs: 0 };
    
    const totalCalories = parseFloat(form.totalCalories) || 0;
    const totalProteins = parseFloat(form.totalProteins) || 0;
    const totalFats = parseFloat(form.totalFats) || 0;
    const totalCarbs = parseFloat(form.totalCarbohydrates) || 0;
    
    return {
      calories: Math.round((totalCalories / weight) * 100),
      proteins: Math.round((totalProteins / weight) * 100 * 10) / 10,
      fats: Math.round((totalFats / weight) * 100 * 10) / 10,
      carbs: Math.round((totalCarbs / weight) * 100 * 10) / 10,
    };
  };

  const per100g = calculatePer100g();

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <Animated.View 
            style={[
              styles.modalContainer,
              { transform: [{ translateY: slideAnim }] }
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? 'Редактировать рецепт' : 'Создать рецепт'}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6A9AA9" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardView}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
            >
              <ScrollView 
                ref={scrollViewRef}
                style={styles.scrollView}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                bounces={true}
                nestedScrollEnabled={true}
              >
                <View style={styles.form}>
                  {/* Название */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Название рецепта *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Вкусная овсянка с ягодами"
                      placeholderTextColor="#999"
                      value={form.title}
                      onChangeText={(value) => updateForm('title', value)}
                      maxLength={100}
                    />
                  </View>

                  {/* Описание */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Описание *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Краткое описание рецепта..."
                      placeholderTextColor="#999"
                      value={form.description}
                      onChangeText={(value) => updateForm('description', value)}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  {/* Изображение */}
                  <View style={styles.inputGroup}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.label}>
                        Фотография рецепта
                        <Text style={styles.optionalText}> (необязательно)</Text>
                      </Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={[styles.imageButton, uploadingImage && styles.imageButtonDisabled]}
                      onPress={pickImage}
                      disabled={uploadingImage}
                    >
                      <Ionicons name={image ? "image" : "image-outline"} size={24} color={uploadingImage ? "#999" : "#6A9AA9"} />
                      <Text style={[styles.imageButtonText, uploadingImage && styles.imageButtonTextDisabled]}>
                        {image ? (image.startsWith('http') ? 'Изменить фото' : 'Заменить фото') : 'Добавить фото'}
                      </Text>
                    </TouchableOpacity>
                    
                    {uploadingImage && (
                      <View style={styles.uploadStatusContainer}>
                        <View style={styles.uploadStatusHeader}>
                          <ActivityIndicator size="small" color="#6A9AA9" style={styles.uploadSpinner} />
                          <Text style={styles.uploadStatusTitle}>Загрузка фотографии</Text>
                        </View>
                        <View style={styles.progressContainer}>
                          <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
                          </View>
                          <View style={styles.progressInfo}>
                            <Text style={styles.progressText}>{uploadStage || `Загрузка: ${Math.round(uploadProgress)}%`}</Text>
                            <Text style={styles.progressPercent}>{Math.round(uploadProgress)}%</Text>
                          </View>
                        </View>
                        <Text style={styles.uploadHint}>Пожалуйста, не закрывайте приложение</Text>
                      </View>
                    )}
                    
                    {image && !uploadingImage && (
                      <View style={styles.previewContainer}>
                        <Image source={{ uri: image }} style={styles.previewImage} resizeMode="cover" />
                        <View style={styles.previewOverlay}>
                          <Ionicons name={image.startsWith('http') ? "checkmark-circle" : "cloud-upload"} size={20} color={image.startsWith('http') ? "#4CAF50" : "#6A9AA9"} />
                          <Text style={styles.previewStatus}>{image.startsWith('http') ? 'Загружено' : 'Готово к загрузке'}</Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Категории */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Категории</Text>
                    <Text style={styles.hint}>Выберите одну или несколько категорий</Text>
                    <View style={styles.optionsContainer}>
                      {AVAILABLE_CATEGORIES.map((category) => (
                        <TouchableOpacity
                          key={category}
                          style={[
                            styles.optionButton,
                            selectedCategories.includes(category) && styles.optionButtonActive,
                          ]}
                          onPress={() => toggleCategory(category)}
                        >
                          <Text style={[
                            styles.optionText,
                            selectedCategories.includes(category) && styles.optionTextActive,
                          ]}>
                            {category}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Тип питания с иконкой информации */}
                  <View style={styles.inputGroup}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.label}>Тип питания *</Text>
                      <TouchableOpacity 
                        style={styles.infoIcon}
                        onPress={() => {
                          const allTypes = DIET_TYPES_WITH_INFO.map(d => `${d.name}: ${d.description}`).join('\n\n');
                          Alert.alert('Типы питания', allTypes);
                        }}
                      >
                        <Ionicons name="information-circle-outline" size={20} color="#6A9AA9" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.hint}>Выберите подходящий тип питания</Text>
                    <View style={styles.optionsContainer}>
                      {DIET_TYPES_WITH_INFO.map((type) => (
                        <TouchableOpacity
                          key={type.id}
                          style={[
                            styles.optionButton,
                            dietType === type.id && styles.optionButtonActive,
                          ]}
                          onPress={() => setDietType(type.id as DietType)}
                        >
                          <Text style={[
                            styles.optionText,
                            dietType === type.id && styles.optionTextActive,
                          ]}>
                            {type.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Время приготовления и сложность */}
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.equalInput]}>
                      <Text style={styles.label}>Время (мин) *</Text>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="30"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        value={prepTime || form.cookingTime}
                        onChangeText={setPrepTime}
                      />
                    </View>

                    <View style={[styles.inputGroup, styles.equalInput]}>
                      <Text style={styles.label}>Сложность *</Text>
                      <View style={styles.optionsRow}>
                        {difficulties.map((diff) => (
                          <TouchableOpacity
                            key={diff}
                            style={[
                              styles.smallOptionButton,
                              form.difficulty === diff && styles.optionButtonActive,
                            ]}
                            onPress={() => updateForm('difficulty', diff)}
                          >
                            <Text style={[
                              styles.smallOptionText,
                              form.difficulty === diff && styles.optionTextActive,
                            ]}>
                              {diff}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  {/* Вес и порции */}
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.equalInput]}>
                      <Text style={styles.label}>Вес блюда (гр) *</Text>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="300"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        value={form.weight}
                        onChangeText={(value) => updateForm('weight', value)}
                      />
                    </View>

                    <View style={[styles.inputGroup, styles.equalInput]}>
                      <Text style={styles.label}>Количество порций *</Text>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="1"
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        value={form.servings}
                        onChangeText={(value) => updateForm('servings', value)}
                      />
                    </View>
                  </View>

                  {/* КБЖУ на всё блюдо */}
                  <View style={styles.inputGroup}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.label}>Пищевая ценность на всё блюдо *</Text>
                    </View>
                    <Text style={styles.hint}>Укажите общие значения для всего блюда</Text>
                    
                    <View style={styles.nutritionGrid}>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>Калории (ккал)</Text>
                        <TextInput
                          style={styles.nutritionInput}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={form.totalCalories}
                          onChangeText={(value) => updateForm('totalCalories', value)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>Белки (г)</Text>
                        <TextInput
                          style={styles.nutritionInput}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={form.totalProteins}
                          onChangeText={(value) => updateForm('totalProteins', value)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>Жиры (г)</Text>
                        <TextInput
                          style={styles.nutritionInput}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={form.totalFats}
                          onChangeText={(value) => updateForm('totalFats', value)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>Углеводы (г)</Text>
                        <TextInput
                          style={styles.nutritionInput}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={form.totalCarbohydrates}
                          onChangeText={(value) => updateForm('totalCarbohydrates', value)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                    
                    {/* Показываем рассчитанные значения на 100г */}
                    {form.weight && parseFloat(form.weight) > 0 && (
                      <View style={styles.per100gContainer}>
                        <Text style={styles.per100gTitle}>
                          <Ionicons name="calculator-outline" size={14} color="#6A9AA9" /> 
                          {' '}Рассчитано на 100г:
                        </Text>
                        <Text style={styles.per100gText}>
                          {per100g.calories} ккал • {per100g.proteins}г белков • {per100g.fats}г жиров • {per100g.carbs}г углеводов
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Ингредиенты с количеством */}
                  <View style={styles.inputGroup}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.label}>Ингредиенты *</Text>
                      <TouchableOpacity style={styles.addButton} onPress={addIngredient}>
                        <Ionicons name="add-circle" size={24} color="#6A9AA9" />
                      </TouchableOpacity>
                    </View>
                    
                    {ingredients.map((ingredient, index) => (
                      <View key={ingredient.id} style={styles.ingredientRow}>
                        <View style={styles.ingredientInputGroup}>
                          <Text style={styles.smallLabel}>Количество</Text>
                          <TextInput
                            style={[styles.smallInput, styles.ingredientInput]}
                            placeholder="100"
                            placeholderTextColor="#999"
                            value={ingredient.amount}
                            onChangeText={(value) => updateIngredient(ingredient.id, 'amount', value)}
                            keyboardType="numeric"
                          />
                        </View>
                        
                        <View style={styles.ingredientInputGroup}>
                          <Text style={styles.smallLabel}>Ед. изм.</Text>
                          <TextInput
                            style={[styles.smallInput, styles.ingredientInput]}
                            placeholder="гр"
                            placeholderTextColor="#999"
                            value={ingredient.unit}
                            onChangeText={(value) => updateIngredient(ingredient.id, 'unit', value)}
                          />
                        </View>
                        
                        <View style={[styles.ingredientInputGroup, styles.ingredientName]}>
                          <Text style={styles.smallLabel}>Название</Text>
                          <TextInput
                            style={[styles.smallInput, styles.ingredientInput]}
                            placeholder="мука"
                            placeholderTextColor="#999"
                            value={ingredient.name}
                            onChangeText={(value) => updateIngredient(ingredient.id, 'name', value)}
                          />
                        </View>
                        
                        {ingredients.length > 1 && (
                          <TouchableOpacity style={styles.removeButton} onPress={() => removeIngredient(ingredient.id)}>
                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Шаги приготовления */}
                  <View style={styles.inputGroup}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.label}>Шаги приготовления *</Text>
                      <TouchableOpacity style={styles.addButton} onPress={addStep}>
                        <Ionicons name="add-circle" size={24} color="#6A9AA9" />
                      </TouchableOpacity>
                    </View>
                    
                    {steps.map((step, index) => (
                      <View key={step.id} style={styles.stepRow}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.stepInputContainer}>
                          <TextInput
                            style={[styles.input, styles.stepInput]}
                            placeholder={`Шаг ${index + 1}`}
                            placeholderTextColor="#999"
                            value={step.text}
                            onChangeText={(value) => updateStep(step.id, value)}
                            multiline
                          />
                        </View>
                        {steps.length > 1 && (
                          <TouchableOpacity style={styles.removeButton} onPress={() => removeStep(step.id)}>
                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>

                  {/* Видимость рецепта */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Видимость рецепта</Text>
                    <View style={styles.visibilityButtons}>
                      <TouchableOpacity
                        style={[styles.visibilityButton, isPublic && styles.visibilityButtonActive]}
                        onPress={() => setIsPublic(true)}
                      >
                        <Ionicons name={isPublic ? "earth" : "earth-outline"} size={20} color={isPublic ? "#000000" : "#666"} />
                        <Text style={[styles.visibilityButtonText, isPublic && styles.visibilityButtonTextActive]}>Публичный</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.visibilityButton, !isPublic && styles.visibilityButtonActive]}
                        onPress={() => setIsPublic(false)}
                      >
                        <Ionicons name={!isPublic ? "lock-closed" : "lock-closed-outline"} size={20} color={!isPublic ? "#000000" : "#666"} />
                        <Text style={[styles.visibilityButtonText, !isPublic && styles.visibilityButtonTextActive]}>Приватный</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Кнопка сохранения */}
                  <TouchableOpacity 
                    style={[styles.submitButton, (loading || uploadingImage) && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading || uploadingImage}
                  >
                    {(loading || uploadingImage) ? (
                      <View style={styles.submitButtonContent}>
                        <ActivityIndicator color="#FFFFFF" size="small" style={styles.buttonSpinner} />
                        <Text style={styles.submitButtonText}>
                          {uploadingImage ? 'Загрузка фото...' : (isEditMode ? 'Сохранение...' : 'Создание...')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.submitButtonContent}>
                        <Ionicons name={isEditMode ? "checkmark-circle" : "add-circle"} size={20} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>
                          {isEditMode ? 'Сохранить изменения' : 'Создать рецепт'}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.hintText}>* - обязательные поля для заполнения</Text>
                  <Text style={styles.hintText}>📊 КБЖУ на 100г рассчитываются автоматически</Text>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#FFFFFF' },
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: { fontSize: 18, fontFamily: 'Playfair Display Bold', color: '#1a1a1a', textAlign: 'center', flex: 1 },
  closeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8F8F8', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E0E0E0' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContainer: { paddingBottom: 40, paddingTop: 8 },
  form: { paddingHorizontal: 16 },
  inputGroup: { marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  equalInput: { flex: 1 },
  label: { fontSize: 14, color: '#666', marginBottom: 8, fontFamily: 'Playfair Display Bold' },
  optionalText: { color: '#999', fontSize: 12, fontFamily: 'Playfair Display Regular' },
  smallLabel: { fontSize: 11, color: '#999', marginBottom: 4, fontFamily: 'Playfair Display Regular' },
  hint: { fontSize: 12, color: '#999', marginBottom: 8, fontFamily: 'Playfair Display Regular' },
  input: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#C2DAE2', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#1a1a1a', minHeight: 50, fontFamily: 'Playfair Display Regular' },
  smallInput: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#C2DAE2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1a1a1a', fontFamily: 'Playfair Display Regular' },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: 12, paddingBottom: 12 },
  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionsRow: { flexDirection: 'row', gap: 8 },
  optionButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F8F8F8', borderWidth: 2, borderColor: '#C2DAE2', minWidth: 80, alignItems: 'center' },
  optionButtonActive: { backgroundColor: '#9BDF11', borderColor: '#9BDF11' },
  optionText: { fontSize: 14, color: '#666', fontFamily: 'Playfair Display Regular' },
  smallOptionButton: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F8F8F8', borderWidth: 2, borderColor: '#C2DAE2', alignItems: 'center' },
  smallOptionText: { fontSize: 12, color: '#666', fontFamily: 'Playfair Display Regular' },
  optionTextActive: { color: '#000000', fontFamily: 'Playfair Display Bold' },
  imageButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', borderWidth: 2, borderColor: '#C2DAE2', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  imageButtonDisabled: { opacity: 0.6, backgroundColor: '#F0F0F0' },
  imageButtonText: { fontSize: 16, color: '#6A9AA9', fontFamily: 'Playfair Display Regular' },
  imageButtonTextDisabled: { color: '#999' },
  uploadStatusContainer: { marginTop: 12, padding: 16, backgroundColor: '#F8F8F8', borderRadius: 12, borderWidth: 1, borderColor: '#C2DAE2' },
  uploadStatusHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  uploadSpinner: { marginRight: 8 },
  uploadStatusTitle: { fontSize: 14, color: '#1a1a1a', fontFamily: 'Playfair Display Bold' },
  progressContainer: { marginBottom: 8 },
  progressBar: { height: 6, backgroundColor: '#E0E0E0', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#6A9AA9', borderRadius: 3 },
  progressInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontSize: 12, color: '#666', flex: 1, fontFamily: 'Playfair Display Regular' },
  progressPercent: { fontSize: 12, color: '#6A9AA9', marginLeft: 8, fontFamily: 'Playfair Display Bold' },
  uploadHint: { fontSize: 11, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 4, fontFamily: 'Playfair Display Regular' },
  previewContainer: { marginTop: 12, position: 'relative' },
  previewImage: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F8F8F8' },
  previewOverlay: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, gap: 4 },
  previewStatus: { fontSize: 11, color: '#4CAF50', fontFamily: 'Playfair Display Regular' },
  nutritionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  nutritionItem: { width: '48%', marginBottom: 8 },
  nutritionLabel: { fontSize: 12, color: '#666', marginBottom: 4, fontFamily: 'Playfair Display Regular' },
  nutritionInput: { backgroundColor: '#F8F8F8', borderWidth: 1, borderColor: '#C2DAE2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlign: 'center', fontFamily: 'Playfair Display Regular' },
  per100gContainer: { marginTop: 12, padding: 12, backgroundColor: '#E8F5E9', borderRadius: 10, borderWidth: 1, borderColor: '#C8E6C9' },
  per100gTitle: { fontSize: 12, fontWeight: '600', color: '#2E7D32', marginBottom: 6, fontFamily: 'Playfair Display Bold' },
  per100gText: { fontSize: 12, color: '#1B5E20', fontFamily: 'Playfair Display Regular', lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  infoIcon: { padding: 4 },
  addButton: { padding: 4 },
  ingredientRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  ingredientInputGroup: { flex: 1 },
  ingredientName: { flex: 2 },
  ingredientInput: { minHeight: 44 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#6A9AA9', justifyContent: 'center', alignItems: 'center', marginTop: 12 },
  stepNumberText: { fontSize: 12, color: '#FFFFFF', fontFamily: 'Playfair Display Bold' },
  stepInputContainer: { flex: 1 },
  stepInput: { minHeight: 80 },
  removeButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F8F8F8', justifyContent: 'center', alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  visibilityButtons: { flexDirection: 'row', gap: 12 },
  visibilityButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F8F8', borderWidth: 2, borderColor: '#C2DAE2', borderRadius: 12, paddingVertical: 12, gap: 8 },
  visibilityButtonActive: { backgroundColor: '#9BDF11', borderColor: '#9BDF11' },
  visibilityButtonText: { fontSize: 14, color: '#666', fontFamily: 'Playfair Display Regular' },
  visibilityButtonTextActive: { color: '#000000', fontFamily: 'Playfair Display Bold' },
  submitButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#9BDF11', paddingVertical: 18, borderRadius: 16, gap: 12, marginBottom: 12, borderWidth: 2, borderColor: '#C2DAE2' },
  submitButtonDisabled: { backgroundColor: '#C2DAE2' },
  submitButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonSpinner: { marginRight: 8 },
  submitButtonText: { color: '#000000', fontSize: 16, fontFamily: 'Playfair Display Bold' },
  hintText: { fontSize: 12, color: '#999', textAlign: 'center', fontStyle: 'italic', marginTop: 8, fontFamily: 'Playfair Display Regular' },
});