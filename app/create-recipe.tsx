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
import { recipeService } from '@/app/services/recipeService';
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

// Тип для данных рецепта на основе интерфейса из recipeService
interface RecipeData {
  title: string;
  description?: string;
  mealType: string;
  difficultyLevel: string;
  cookingTime: number | string;
  calories: number;
  proteins: number;
  fats: number;
  carbohydrates: number;
  weight?: string;
  servings?: number;
  ingredients: string[]; // Массив строк
  ingredientsText?: string;
  steps: string[]; // Массив строк для шагов
  tags: string[]; // Обязательное поле
  imageUrl?: string;
  isPublic: boolean;
  cloudinaryPublicId?: string;
  imageMetadata?: any;
}

export default function CreateRecipeModal() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Определяем режим: редактирование или создание
  const isEditMode = params.isEditMode === "true";
  const recipeId = params.recipeId as string | undefined;

  // Форма
  const [form, setForm] = useState({
    title: params.title as string || '',
    description: params.description as string || '',
    mealType: params.mealType as string || 'Завтрак',
    difficulty: params.difficulty as string || 'Легко',
    cookingTime: params.cookingTime as string || '',
    calories: params.calories as string || '',
    proteins: params.proteins as string || '0',
    fats: params.fats as string || '0',
    carbohydrates: params.carbohydrates as string || '0',
    weight: params.weight as string || '300',
    servings: params.servings as string || '1',
  });
  
  // Состояния для изображения и загрузки
  const [image, setImage] = useState<string | null>(params.imageUrl as string || null);
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [isPublic, setIsPublic] = useState(
    params.isPublic === "true" || 
    params.isPublic === "1" || 
    false
  );
  
  // Ингредиенты и шаги как массивы
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    if (params.ingredients && typeof params.ingredients === 'string' && params.ingredients !== '') {
      try {
        const parsed = JSON.parse(params.ingredients);
        if (Array.isArray(parsed)) {
          // Если это массив строк
          if (typeof parsed[0] === 'string') {
            return parsed.map((item: string, index: number) => {
              // Парсим строку вида "100 гр мука"
              const parts = item.split(' ');
              return {
                id: (index + 1).toString(),
                amount: parts[0] || '',
                unit: parts[1] || 'гр',
                name: parts.slice(2).join(' ') || '',
              };
            });
          } else {
            // Если это массив объектов
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
        // Если инструкции переданы как массив строк
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

  // Анимация открытия
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Закрытие с анимацией
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

  // Выбор изображения
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Доступ к галерее', 'Для выбора фото рецепта необходимо разрешение на доступ к галерее');
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
        const selectedImage = result.assets[0];
        setImage(selectedImage.uri);
      }
    } catch (error) {
      console.error('Ошибка выбора изображения:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
  };

  // Загрузка изображения в Cloudinary
  const uploadImageToCloudinary = async (): Promise<{
    url: string | null;
    publicId: string | null;
  }> => {
    if (!image) {
      console.log('⚠️ Нет изображения для загрузки');
      return { url: null, publicId: null };
    }

    // Если изображение уже загружено (URL начинается с http), возвращаем его
    if (image.startsWith('http')) {
      console.log('✅ Изображение уже загружено, пропускаем загрузку');
      return { url: image, publicId: null };
    }

    try {
      console.log('🚀 Начинаем загрузку в Cloudinary...');
      setUploadingImage(true);
      setUploadProgress(0);
      setUploadStage('Подготовка изображения...');

      const onProgress = (progress: UploadProgress) => {
        setUploadProgress(progress.percent);
        setUploadStage(`Загрузка: ${Math.round(progress.percent)}%`);
        console.log(`📊 Прогресс загрузки: ${progress.percent.toFixed(1)}%`);
      };

      const result = await cloudinaryService.uploadImage(
        image,
        { onProgress }
      );

      if (result.success && result.url && result.publicId) {
        console.log('✅ Изображение успешно загружено!');
        setUploadStage('Завершение...');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        return {
          url: result.url,
          publicId: result.publicId,
        };
      } else {
        console.error('❌ Ошибка загрузки:', result.error);
        throw new Error(result.error || 'Не удалось загрузить изображение');
      }
    } catch (error: any) {
      console.error('❌ Критическая ошибка при загрузке:', error);
      throw error;
    } finally {
      setUploadingImage(false);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  // Управление ингредиентами
  const addIngredient = () => {
    const newId = (ingredients.length + 1).toString();
    setIngredients([...ingredients, { id: newId, amount: '', unit: '', name: '' }]);
    
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
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

  // Управление шагами
  const addStep = () => {
    const newId = (steps.length + 1).toString();
    setSteps([...steps, { id: newId, text: '' }]);
    
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const updateStep = (id: string, value: string) => {
    setSteps(steps.map(step => 
      step.id === id ? { ...step, text: value } : step
    ));
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(step => step.id !== id));
    }
  };

  // Валидация
  const validateForm = (): string | null => {
    if (!form.title.trim()) return 'Введите название рецепта';
    if (!form.description.trim()) return 'Введите описание рецепта';
    if (!form.cookingTime.trim()) return 'Введите время приготовления';
    if (!form.weight.trim()) return 'Введите вес блюда';
    if (!form.calories.trim()) return 'Введите количество калорий';
    
    // Проверяем ингредиенты
    for (const ing of ingredients) {
      if (!ing.amount.trim() || !ing.name.trim()) {
        return 'Заполните все поля ингредиентов';
      }
    }
    
    // Проверяем шаги
    for (const step of steps) {
      if (!step.text.trim()) {
        return 'Заполните все шаги приготовления';
      }
    }
    
    return null;
  };

  // Создание или обновление рецепта
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
      let cloudinaryPublicId: string | undefined = undefined;
      
      // Загружаем изображение если есть и оно новое
      if (image && !image.startsWith('http')) {
        console.log('📤 Загрузка нового изображения в Cloudinary...');
        
        try {
          const uploadResult = await uploadImageToCloudinary();
          
          if (uploadResult.url) {
            imageUrl = uploadResult.url;
            cloudinaryPublicId = uploadResult.publicId || undefined;
            
            console.log('✅ Изображение загружено успешно');
          }
        } catch (uploadError: any) {
          console.error('❌ Ошибка загрузки изображения:', uploadError);
          
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
        // Используем существующее изображение
        imageUrl = image;
        console.log('✅ Используем существующее изображение');
      }

      // Преобразуем ингредиенты в массив строк
      const ingredientsArray = ingredients.map(ing => 
        `${ing.amount} ${ing.unit} ${ing.name}`
      );
      
      // Преобразуем шаги в массив строк
      const stepsArray = steps.map(step => step.text.trim());

      // Подготавливаем данные для рецепта
      const recipeData: RecipeData = {
        title: form.title.trim(),
        description: form.description.trim(),
        mealType: form.mealType,
        difficultyLevel: form.difficulty,
        cookingTime: parseInt(form.cookingTime) || 20,
        calories: parseInt(form.calories) || 0,
        proteins: parseInt(form.proteins) || 0,
        fats: parseInt(form.fats) || 0,
        carbohydrates: parseInt(form.carbohydrates) || 0,
        weight: form.weight.trim(),
        servings: parseInt(form.servings) || 1,
        
        // Используем текстовое представление
        ingredientsText: ingredientsArray.join('\n'),
        
        // Массив строк для совместимости с типом Recipe
        ingredients: ingredientsArray,
        
        // Массив строк для шагов
        steps: stepsArray,
        
        // Обязательное поле tags
        tags: [],
        
        imageUrl: imageUrl,
        isPublic: isPublic,
        cloudinaryPublicId: cloudinaryPublicId,
        imageMetadata: imageUrl ? {
          source: 'cloudinary',
          publicId: cloudinaryPublicId,
          uploadedAt: new Date().toISOString(),
          inRecipesFolder: cloudinaryPublicId ? cloudinaryPublicId.startsWith('recipes/') : false,
        } : undefined,
      };

      console.log(`💾 ${isEditMode ? 'Обновление' : 'Создание'} рецепта...`);
      
      if (isEditMode && recipeId) {
        // Редактирование существующего рецепта
        await recipeService.updateRecipe(recipeId, recipeData);
        Alert.alert(
          '✅ Успех!',
          'Рецепт успешно обновлен',
          [{ text: 'ОК', onPress: handleClose }]
        );
      } else {
        // Создание нового рецепта
        // Используем Omit для исключения полей, которые добавляет сервис
        const createData = {
          ...recipeData,
          // Поля id, userId, createdAt, updatedAt и статистика будут добавлены в сервисе
        };
        
        const createdRecipe = await recipeService.createRecipe(createData);
        
        console.log('✅ Рецепт успешно создан! ID:', createdRecipe.id);
        Alert.alert(
          '🎉 Успех!',
          'Рецепт успешно создан',
          [{ text: 'ОК', onPress: handleClose }]
        );
      }
      
    } catch (error: any) {
      console.error(`❌ Ошибка ${isEditMode ? 'обновления' : 'создания'} рецепта:`, error);
      Alert.alert(
        'Ошибка', 
        error.message || `Не удалось ${isEditMode ? 'обновить' : 'создать'} рецепт. Попробуйте еще раз.`
      );
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const mealTypes = ['Завтрак', 'Обед', 'Ужин', 'Перекусы'];
  const difficulties = ['Легко', 'Средне', 'Сложно'];

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
            {/* Хедер с заголовком и крестиком */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditMode ? 'Редактировать рецепт' : 'Создать рецепт'}
              </Text>
              <TouchableOpacity 
                onPress={handleClose}
                style={styles.closeButton}
              >
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
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                scrollEventThrottle={16}
                bounces={true}
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
                      maxLength={500}
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
                    
                    {/* Кнопка выбора изображения */}
                    <TouchableOpacity 
                      style={[
                        styles.imageButton,
                        uploadingImage && styles.imageButtonDisabled
                      ]}
                      onPress={pickImage}
                      disabled={uploadingImage}
                    >
                      <Ionicons 
                        name={image ? "image" : "image-outline"} 
                        size={24} 
                        color={uploadingImage ? "#999" : "#6A9AA9"} 
                      />
                      <Text style={[
                        styles.imageButtonText,
                        uploadingImage && styles.imageButtonTextDisabled
                      ]}>
                        {image ? (image.startsWith('http') ? 'Изменить фото' : 'Заменить фото') : 'Добавить фото'}
                      </Text>
                    </TouchableOpacity>
                    
                    {/* Контейнер состояния загрузки */}
                    {uploadingImage && (
                      <View style={styles.uploadStatusContainer}>
                        <View style={styles.uploadStatusHeader}>
                          <ActivityIndicator size="small" color="#6A9AA9" style={styles.uploadSpinner} />
                          <Text style={styles.uploadStatusTitle}>Загрузка фотографии</Text>
                        </View>
                        
                        {/* Прогресс-бар */}
                        <View style={styles.progressContainer}>
                          <View style={styles.progressBar}>
                            <View 
                              style={[
                                styles.progressFill,
                                { width: `${uploadProgress}%` }
                              ]} 
                            />
                          </View>
                          <View style={styles.progressInfo}>
                            <Text style={styles.progressText}>
                              {uploadStage || `Загрузка: ${Math.round(uploadProgress)}%`}
                            </Text>
                            <Text style={styles.progressPercent}>{Math.round(uploadProgress)}%</Text>
                          </View>
                        </View>
                        
                        <Text style={styles.uploadHint}>
                          Пожалуйста, не закрывайте приложение
                        </Text>
                      </View>
                    )}
                    
                    {/* Предпросмотр изображения */}
                    {image && !uploadingImage && (
                      <View style={styles.previewContainer}>
                        <Image 
                          source={{ uri: image }} 
                          style={styles.previewImage} 
                          resizeMode="cover"
                        />
                        <View style={styles.previewOverlay}>
                          <Ionicons 
                            name={image.startsWith('http') ? "checkmark-circle" : "cloud-upload"} 
                            size={20} 
                            color={image.startsWith('http') ? "#4CAF50" : "#6A9AA9"} 
                          />
                          <Text style={styles.previewStatus}>
                            {image.startsWith('http') ? 'Загружено' : 'Готово к загрузке'}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Категория */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Категория *</Text>
                    <View style={styles.optionsContainer}>
                      {mealTypes.map((type) => (
                        <TouchableOpacity
                          key={type}
                          style={[
                            styles.optionButton,
                            form.mealType === type && styles.optionButtonActive,
                          ]}
                          onPress={() => updateForm('mealType', type)}
                        >
                          <Text style={[
                            styles.optionText,
                            form.mealType === type && styles.optionTextActive,
                          ]}>
                            {type}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Сложность */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Сложность *</Text>
                    <View style={styles.optionsContainer}>
                      {difficulties.map((diff) => (
                        <TouchableOpacity
                          key={diff}
                          style={[
                            styles.optionButton,
                            form.difficulty === diff && styles.optionButtonActive,
                          ]}
                          onPress={() => updateForm('difficulty', diff)}
                        >
                          <Text style={[
                            styles.optionText,
                            form.difficulty === diff && styles.optionTextActive,
                          ]}>
                            {diff}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Время приготовления, Вес и Порции */}
                  <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.equalInput]}>
                      <Text style={styles.label}>Время (мин) *</Text>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="20"
                        placeholderTextColor="#999"
                        value={form.cookingTime}
                        onChangeText={(value) => updateForm('cookingTime', value)}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={[styles.inputGroup, styles.equalInput]}>
                      <Text style={styles.label}>Вес (гр) *</Text>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="300 гр"
                        placeholderTextColor="#999"
                        value={form.weight}
                        onChangeText={(value) => updateForm('weight', value)}
                      />
                    </View>

                    <View style={[styles.inputGroup, styles.equalInput]}>
                      <Text style={styles.label}>Порции *</Text>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="1"
                        placeholderTextColor="#999"
                        value={form.servings}
                        onChangeText={(value) => updateForm('servings', value)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  {/* КБЖУ */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Пищевая ценность *</Text>
                    <View style={styles.nutritionGrid}>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>Калории</Text>
                        <TextInput
                          style={styles.nutritionInput}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={form.calories}
                          onChangeText={(value) => updateForm('calories', value)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>Белки (г)</Text>
                        <TextInput
                          style={styles.nutritionInput}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={form.proteins}
                          onChangeText={(value) => updateForm('proteins', value)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>Жиры (г)</Text>
                        <TextInput
                          style={styles.nutritionInput}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={form.fats}
                          onChangeText={(value) => updateForm('fats', value)}
                          keyboardType="numeric"
                        />
                      </View>
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionLabel}>Углеводы (г)</Text>
                        <TextInput
                          style={styles.nutritionInput}
                          placeholder="0"
                          placeholderTextColor="#999"
                          value={form.carbohydrates}
                          onChangeText={(value) => updateForm('carbohydrates', value)}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>

                  {/* Ингредиенты */}
                  <View style={styles.inputGroup}>
                    <View style={styles.sectionHeader}>
                      <Text style={styles.label}>Ингредиенты *</Text>
                      <TouchableOpacity 
                        style={styles.addButton}
                        onPress={addIngredient}
                      >
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
                          <TouchableOpacity 
                            style={styles.removeButton}
                            onPress={() => removeIngredient(ingredient.id)}
                          >
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
                      <TouchableOpacity 
                        style={styles.addButton}
                        onPress={addStep}
                      >
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
                          <TouchableOpacity 
                            style={styles.removeButton}
                            onPress={() => removeStep(step.id)}
                          >
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
                        style={[
                          styles.visibilityButton,
                          isPublic && styles.visibilityButtonActive,
                        ]}
                        onPress={() => setIsPublic(true)}
                      >
                        <Ionicons 
                          name={isPublic ? "earth" : "earth-outline"} 
                          size={20} 
                          color={isPublic ? "#000000" : "#666"} 
                        />
                        <Text style={[
                          styles.visibilityButtonText,
                          isPublic && styles.visibilityButtonTextActive,
                        ]}>
                          Публичный
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.visibilityButton,
                          !isPublic && styles.visibilityButtonActive,
                        ]}
                        onPress={() => setIsPublic(false)}
                      >
                        <Ionicons 
                          name={!isPublic ? "lock-closed" : "lock-closed-outline"} 
                          size={20} 
                          color={!isPublic ? "#000000" : "#666"} 
                        />
                        <Text style={[
                          styles.visibilityButtonText,
                          !isPublic && styles.visibilityButtonTextActive,
                        ]}>
                          Приватный
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Кнопка сохранения/создания */}
                  <TouchableOpacity 
                    style={[
                      styles.submitButton, 
                      (loading || uploadingImage) && styles.submitButtonDisabled
                    ]}
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

                  <Text style={styles.hintText}>
                    * - обязательные поля для заполнения
                  </Text>
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
  overlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20, 
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Playfair Display Bold',
    color: '#1a1a1a',
    textAlign: 'center',
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    paddingBottom: 100,
  },
  form: {
    paddingHorizontal: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  equalInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Playfair Display Regular',
  },
  optionalText: {
    color: '#999',
    fontSize: 12,
    fontFamily: 'Playfair Display Regular',
  },
  smallLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    fontFamily: 'Playfair Display Regular',
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#C2DAE2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    fontFamily: 'Playfair Display Regular',
    minHeight: 50,
  },
  smallInput: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#C2DAE2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
    fontFamily: 'Playfair Display Regular',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
    paddingBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F8F8F8',
    borderWidth: 2,
    borderColor: '#C2DAE2',
    minWidth: 80,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#9BDF11',
    borderColor: '#9BDF11',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Playfair Display Regular',
  },
  optionTextActive: {
    color: '#000000',
    fontFamily: 'Playfair Display Bold',
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderWidth: 2,
    borderColor: '#C2DAE2',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  imageButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#F0F0F0',
  },
  imageButtonText: {
    fontSize: 16,
    color: '#6A9AA9',
    fontFamily: 'Playfair Display Regular',
  },
  imageButtonTextDisabled: {
    color: '#999',
  },
  // Новые стили для статуса загрузки
  uploadStatusContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C2DAE2',
  },
  uploadStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadSpinner: {
    marginRight: 8,
  },
  uploadStatusTitle: {
    fontSize: 14,
    color: '#1a1a1a',
    fontFamily: 'Playfair Display Bold',
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6A9AA9',
    borderRadius: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Playfair Display Regular',
    flex: 1,
  },
  progressPercent: {
    fontSize: 12,
    color: '#6A9AA9',
    fontFamily: 'Playfair Display Bold',
    marginLeft: 8,
  },
  uploadHint: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: 'Playfair Display Regular',
    marginTop: 4,
  },
  previewContainer: {
    marginTop: 12,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
  },
  previewOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  previewStatus: {
    fontSize: 11,
    color: '#4CAF50',
    fontFamily: 'Playfair Display Regular',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  nutritionItem: {
    width: '48%',
    marginBottom: 8,
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'Playfair Display Regular',
  },
  nutritionInput: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#C2DAE2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1a1a1a',
    fontFamily: 'Playfair Display Regular',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    padding: 4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  ingredientInputGroup: {
    flex: 1,
  },
  ingredientName: {
    flex: 2,
  },
  ingredientInput: {
    minHeight: 44,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6A9AA9',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  stepNumberText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Playfair Display Bold',
  },
  stepInputContainer: {
    flex: 1,
  },
  stepInput: {
    minHeight: 80,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8F8F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  visibilityButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  visibilityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    borderWidth: 2,
    borderColor: '#C2DAE2',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  visibilityButtonActive: {
    backgroundColor: '#9BDF11',
    borderColor: '#9BDF11',
  },
  visibilityButtonText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Playfair Display Regular',
  },
  visibilityButtonTextActive: {
    color: '#000000',
    fontFamily: 'Playfair Display Bold',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9BDF11',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#C2DAE2',
  },
  submitButtonDisabled: {
    backgroundColor: '#C2DAE2',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonSpinner: {
    marginRight: 8,
  },
  submitButtonText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: 'Playfair Display Bold',
  },
  hintText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontFamily: 'Playfair Display Regular',
    fontStyle: 'italic',
    marginTop: 8,
  },
});