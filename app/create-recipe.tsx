// app/modal/create-recipe.tsx
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { recipeService } from '@/app/services/recipeService'; // Исправлен путь
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

export default function CreateRecipeModal() {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Форма
  const [form, setForm] = useState({
    title: '',
    description: '',
    mealType: 'Завтрак',
    difficulty: 'Легко',
    cookingTime: '',
    calories: '',
    proteins: '',
    fats: '',
    carbohydrates: '',
    weight: '',
    servings: '1',
  });
  
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  
  // Ингредиенты и шаги как массивы
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: '1', amount: '', unit: '', name: '' }
  ]);
  
  const [steps, setSteps] = useState<Step[]>([
    { id: '1', text: '' }
  ]);

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
        Alert.alert('Ошибка', 'Необходимо разрешение для доступа к галерее');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Ошибка выбора изображения:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
  };

  // Загрузка изображения в Firebase Storage
  const uploadImage = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storage = getStorage();
      const fileName = `recipes/${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Ошибка загрузки изображения:', error);
      return null;
    }
  };

  // Управление ингредиентами
  const addIngredient = () => {
    const newId = (ingredients.length + 1).toString();
    setIngredients([...ingredients, { id: newId, amount: '', unit: '', name: '' }]);
    
    // Прокручиваем к новому элементу
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
    if (!form.proteins.trim()) return 'Введите количество белков';
    if (!form.fats.trim()) return 'Введите количество жиров';
    if (!form.carbohydrates.trim()) return 'Введите количество углеводов';
    
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

  // Создание рецепта
  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Ошибка', error);
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      let imageUrl = null;
      
      if (image) {
        const uploadedUrl = await uploadImage(image);
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      // Подготавливаем данные
      const recipeData = {
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
        
        // Формируем текстовое представление ингредиентов
        ingredientsText: ingredients.map(ing => 
          `${ing.amount} ${ing.unit} ${ing.name}`
        ).join('\n'),
        
        // Структурированные данные
        ingredients: ingredients.map((ing, index) => ({
          order: index + 1,
          amount: parseFloat(ing.amount) || 0,
          unit: ing.unit || 'гр',
          text: ing.name
        })),
        
        steps: steps.map((step, index) => ({
          order: index + 1,
          text: step.text.trim()
        })),
        
        imageUrl: imageUrl,
        isPublic: isPublic,
      };

      await recipeService.createRecipe(recipeData);
      
      Alert.alert(
        'Успех!',
        'Рецепт успешно создан',
        [{ text: 'ОК', onPress: handleClose }]
      );
      
    } catch (error: any) {
      console.error('Ошибка создания рецепта:', error);
      Alert.alert('Ошибка', error.message || 'Не удалось создать рецепт. Попробуйте еще раз.');
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
              <Text style={styles.modalTitle}>Создать рецепт</Text>
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
                    <Text style={styles.label}>Изображение</Text>
                    <TouchableOpacity 
                      style={styles.imageButton} 
                      onPress={pickImage}
                    >
                      <Ionicons 
                        name={image ? "image" : "image-outline"} 
                        size={24} 
                        color="#6A9AA9" 
                      />
                      <Text style={styles.imageButtonText}>
                        {image ? 'Изменить фото' : 'Добавить фото'}
                      </Text>
                    </TouchableOpacity>
                    {image && (
                      <Image 
                        source={{ uri: image }} 
                        style={styles.previewImage} 
                      />
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
                      <Text style={styles.label}>Вес *</Text>
                      <TextInput
                        style={styles.smallInput}
                        placeholder="300 гр"
                        placeholderTextColor="#999"
                        value={form.weight}
                        onChangeText={(value) => updateForm('weight', value)}
                        keyboardType="default" // Исправлено на default
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

                  {/* Кнопка создания */}
                  <TouchableOpacity 
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>Создать рецепт</Text>
                      </>
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
  imageButtonText: {
    fontSize: 16,
    color: '#6A9AA9',
    fontFamily: 'Playfair Display Regular',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 12,
    backgroundColor: '#F8F8F8',
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