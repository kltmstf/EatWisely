// scripts/uniqueRecipesGenerator.js
// scripts/uniqueRecipesGenerator.js
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// Используем уже инициализированный Firebase из основного приложения
let db = null;

// Инициализируем Firestore один раз
export const initializeFirestore = (firebaseApp) => {
  if (!db && firebaseApp) {
    db = getFirestore(firebaseApp);
  }
  return db;
};

// ================== БАЗА ДАННЫХ ИНГРЕДИЕНТОВ ==================
const INGREDIENTS_DATABASE = {
  // ОВОЩИ
  vegetables: [
    { name: 'брокколи', calories: 34, protein: 2.8, carbs: 7, fat: 0.4, category: 'зелень' },
    { name: 'шпинат', calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, category: 'зелень' },
    { name: 'морковь', calories: 41, protein: 0.9, carbs: 10, fat: 0.2, category: 'корнеплод' },
    { name: 'цветная капуста', calories: 25, protein: 1.9, carbs: 5, fat: 0.3, category: 'крестоцветные' },
    { name: 'сладкий перец', calories: 31, protein: 1, carbs: 6, fat: 0.3, category: 'овощ' },
    { name: 'помидоры', calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, category: 'овощ' },
    { name: 'огурцы', calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, category: 'овощ' },
    { name: 'кабачки', calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, category: 'тыквенные' },
    { name: 'баклажаны', calories: 25, protein: 1, carbs: 6, fat: 0.2, category: 'пасленовые' },
    { name: 'лук репчатый', calories: 40, protein: 1.1, carbs: 9, fat: 0.1, category: 'луковичные' },
    { name: 'чеснок', calories: 149, protein: 6.4, carbs: 33, fat: 0.5, category: 'специя' },
    { name: 'авокадо', calories: 160, protein: 2, carbs: 9, fat: 15, category: 'фрукт' },
    { name: 'тыква', calories: 26, protein: 1, carbs: 7, fat: 0.1, category: 'тыквенные' },
    { name: 'сельдерей', calories: 16, protein: 0.7, carbs: 3, fat: 0.2, category: 'зелень' },
    { name: 'руккола', calories: 25, protein: 2.6, carbs: 3.7, fat: 0.7, category: 'зелень' },
  ],
  
  // БЕЛКИ
  proteins: [
    { name: 'куриная грудка', calories: 165, protein: 31, carbs: 0, fat: 3.6, category: 'птица' },
    { name: 'индейка', calories: 135, protein: 29, carbs: 0, fat: 1, category: 'птица' },
    { name: 'говядина постная', calories: 250, protein: 26, carbs: 0, fat: 17, category: 'красное мясо' },
    { name: 'свинина нежирная', calories: 242, protein: 25, carbs: 0, fat: 16, category: 'красное мясо' },
    { name: 'лосось', calories: 208, protein: 20, carbs: 0, fat: 13, category: 'рыба' },
    { name: 'тунец', calories: 184, protein: 30, carbs: 0, fat: 6, category: 'рыба' },
    { name: 'треска', calories: 82, protein: 18, carbs: 0, fat: 0.7, category: 'рыба' },
    { name: 'креветки', calories: 99, protein: 24, carbs: 0.2, fat: 0.3, category: 'морепродукты' },
    { name: 'яйца куриные', calories: 155, protein: 13, carbs: 1.1, fat: 11, category: 'яйца' },
    { name: 'тофу', calories: 76, protein: 8, carbs: 1.9, fat: 4.8, category: 'растительный белок' },
    { name: 'нут', calories: 364, protein: 19, carbs: 61, fat: 6, category: 'бобовые' },
    { name: 'чечевица', calories: 116, protein: 9, carbs: 20, fat: 0.4, category: 'бобовые' },
    { name: 'фасоль красная', calories: 127, protein: 8.7, carbs: 23, fat: 0.5, category: 'бобовые' },
    { name: 'творог 5%', calories: 121, protein: 17, carbs: 3.4, fat: 5, category: 'молочные' },
    { name: 'греческий йогурт', calories: 59, protein: 10, carbs: 3.6, fat: 0.4, category: 'молочные' },
  ],
  
  // УГЛЕВОДЫ
  carbs: [
    { name: 'гречка', calories: 343, protein: 13, carbs: 72, fat: 3.4, category: 'крупа' },
    { name: 'киноа', calories: 120, protein: 4.4, carbs: 21, fat: 1.9, category: 'псевдозерновая' },
    { name: 'бурый рис', calories: 111, protein: 2.6, carbs: 23, fat: 0.9, category: 'рис' },
    { name: 'овсяные хлопья', calories: 389, protein: 17, carbs: 66, fat: 7, category: 'зерновые' },
    { name: 'цельнозерновые макароны', calories: 131, protein: 5.3, carbs: 25, fat: 1.1, category: 'макароны' },
    { name: 'картофель', calories: 77, protein: 2, carbs: 17, fat: 0.1, category: 'корнеплод' },
    { name: 'батат', calories: 86, protein: 1.6, carbs: 20, fat: 0.1, category: 'корнеплод' },
    { name: 'кускус', calories: 112, protein: 3.8, carbs: 23, fat: 0.2, category: 'крупа' },
    { name: 'булгур', calories: 83, protein: 3.1, carbs: 19, fat: 0.2, category: 'крупа' },
    { name: 'ячневая крупа', calories: 324, protein: 10, carbs: 66, fat: 2.3, category: 'крупа' },
    { name: 'чечевица красная', calories: 116, protein: 9, carbs: 20, fat: 0.4, category: 'бобовые' },
  ],
  
  // ЖИРЫ
  fats: [
    { name: 'оливковое масло', calories: 884, protein: 0, carbs: 0, fat: 100, category: 'масло' },
    { name: 'авокадо', calories: 160, protein: 2, carbs: 9, fat: 15, category: 'фрукт' },
    { name: 'орехи грецкие', calories: 654, protein: 15, carbs: 14, fat: 65, category: 'орехи' },
    { name: 'миндаль', calories: 579, protein: 21, carbs: 22, fat: 50, category: 'орехи' },
    { name: 'семена чиа', calories: 486, protein: 17, carbs: 42, fat: 31, category: 'семена' },
    { name: 'семена льна', calories: 534, protein: 18, carbs: 29, fat: 42, category: 'семена' },
    { name: 'орехи кешью', calories: 553, protein: 18, carbs: 30, fat: 44, category: 'орехи' },
    { name: 'арахисовая паста', calories: 588, protein: 25, carbs: 20, fat: 50, category: 'паста' },
    { name: 'сыр фета', calories: 264, protein: 14, carbs: 4.1, fat: 21, category: 'сыр' },
    { name: 'сливочное масло', calories: 717, protein: 0.9, carbs: 0.1, fat: 81, category: 'животный жир' },
  ],
  
  // ФРУКТЫ И ЯГОДЫ
  fruits: [
    { name: 'банан', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, category: 'фрукт' },
    { name: 'яблоко', calories: 52, protein: 0.3, carbs: 14, fat: 0.2, category: 'фрукт' },
    { name: 'апельсин', calories: 47, protein: 0.9, carbs: 12, fat: 0.1, category: 'цитрусовые' },
    { name: 'клубника', calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, category: 'ягоды' },
    { name: 'черника', calories: 57, protein: 0.7, carbs: 14, fat: 0.3, category: 'ягоды' },
    { name: 'малина', calories: 52, protein: 1.2, carbs: 12, fat: 0.7, category: 'ягоды' },
    { name: 'груша', calories: 57, protein: 0.4, carbs: 15, fat: 0.1, category: 'фрукт' },
    { name: 'киви', calories: 61, protein: 1.1, carbs: 15, fat: 0.5, category: 'фрукт' },
    { name: 'ананас', calories: 50, protein: 0.5, carbs: 13, fat: 0.1, category: 'тропический' },
    { name: 'манго', calories: 60, protein: 0.8, carbs: 15, fat: 0.4, category: 'тропический' },
  ],
  
  // СПЕЦИИ И ПРИПРАВЫ
  spices: [
    'соль', 'перец черный', 'паприка', 'куркума', 'кориандр', 
    'тмин', 'корица', 'имбирь молотый', 'чесночный порошок', 
    'луковый порошок', 'базилик сушеный', 'орегано', 'розмарин', 
    'тимьян', 'укроп сушеный', 'петрушка сушеная', 'лавровый лист'
  ]
};

// ================== ТИПЫ ПИТАНИЯ И ШАБЛОНЫ ==================
const MEAL_PATTERNS = {
  'Завтрак': {
    descriptionTemplates: [
      "Сытный и питательный завтрак, который зарядит энергией на весь день",
      "Легкий и полезный завтрак для активного начала дня",
      "Богатый белком завтрак для поддержания мышечной массы",
      "Быстрый и удобный завтрак для занятых людей",
      "Традиционный завтрак с современными нотками"
    ],
    cookingMethods: ['варить', 'запекать', 'готовить на сковороде', 'тушить', 'готовить на пару'],
    timeRange: [5, 25],
    calorieRange: [250, 500],
    proteinFocus: true,
    ingredientPattern: {
      base: ['carbs', 'proteins', 'fruits'],
      required: 1,
      optional: 2,
      spices: 2
    }
  },
  
  'Обед': {
    descriptionTemplates: [
      "Сбалансированный обед для поддержания энергии во второй половине дня",
      "Питательный обед, богатый белком и клетчаткой",
      "Традиционное блюдо с современной интерпретацией",
      "Легкий обед, не вызывающий сонливость",
      "Блюдо, идеально подходящее для рабочего перерыва"
    ],
    cookingMethods: ['варить', 'тушить', 'запекать', 'готовить на гриле', 'жарить'],
    timeRange: [15, 60],
    calorieRange: [400, 700],
    proteinFocus: true,
    ingredientPattern: {
      base: ['proteins', 'carbs', 'vegetables'],
      required: 3,
      optional: 3,
      spices: 3
    }
  },
  
  'Ужин': {
    descriptionTemplates: [
      "Легкий ужин, который не перегрузит желудок перед сном",
      "Богатый белком ужин для восстановления мышц",
      "Ужин с низким содержанием углеводов для контроля веса",
      "Теплое и уютное блюдо для завершения дня",
      "Быстрый ужин для занятых вечеров"
    ],
    cookingMethods: ['запекать', 'готовить на пару', 'тушить', 'варить', 'готовить на гриле'],
    timeRange: [10, 45],
    calorieRange: [300, 550],
    proteinFocus: true,
    ingredientPattern: {
      base: ['proteins', 'vegetables'],
      required: 2,
      optional: 2,
      spices: 2
    }
  },
  
  'Перекусы': {
    descriptionTemplates: [
      "Полезный перекус для поддержания энергии между приемами пищи",
      "Быстрый перекус, богатый питательными веществами",
      "Низкокалорийный перекус для контроля аппетита",
      "Белковый перекус для восстановления мышц",
      "Сладкий, но полезный перекус без чувства вины"
    ],
    cookingMethods: ['смешивать', 'нарезать', 'готовить без обработки', 'запекать'],
    timeRange: [2, 15],
    calorieRange: [100, 250],
    proteinFocus: false,
    ingredientPattern: {
      base: ['fruits', 'proteins', 'fats'],
      required: 1,
      optional: 2,
      spices: 1
    }
  }
};

// ================== УНИКАЛЬНЫЕ КОМБИНАЦИИ ==================
const CUISINE_STYLES = [
  { name: 'Средиземноморская', spices: ['орегано', 'базилик', 'розмарин', 'тимьян'] },
  { name: 'Азиатская', spices: ['имбирь молотый', 'чесночный порошок', 'кориандр'] },
  { name: 'Мексиканская', spices: ['тмин', 'паприка', 'кориандр'] },
  { name: 'Индийская', spices: ['куркума', 'тмин', 'кориандр'] },
  { name: 'Славянская', spices: ['укроп сушеный', 'петрушка сушеная', 'лавровый лист'] },
  { name: 'Итальянская', spices: ['базилик сушеный', 'орегано', 'розмарин'] },
  { name: 'Американская', spices: ['паприка', 'чесночный порошок', 'луковый порошок'] }
];

const DIETARY_STYLES = [
  { name: 'Высокобелковая', proteinMultiplier: 1.5, carbMultiplier: 0.8 },
  { name: 'Низкоуглеводная', proteinMultiplier: 1.2, carbMultiplier: 0.6 },
  { name: 'Сбалансированная', proteinMultiplier: 1.0, carbMultiplier: 1.0 },
  { name: 'Вегетарианская', proteinMultiplier: 0.9, carbMultiplier: 1.1 },
  { name: 'Фитнес', proteinMultiplier: 1.3, carbMultiplier: 0.9 }
];

// ================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==================
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomFloat = (min, max, decimals = 1) => 
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));

// Генерация уникального ID комбинации
const generateRecipeSignature = (ingredients, mealType, cuisine) => {
  const ingredientNames = ingredients.map(i => i.name).sort().join('-');
  return `${mealType}-${cuisine.name}-${ingredientNames}`;
};

// Кэш для отслеживания уникальности
const usedSignatures = new Set();

// Выбор уникальных ингредиентов
const selectUniqueIngredients = (categories, pattern, maxAttempts = 50) => {
  const selectedIngredients = [];
  const selectedCategories = [];
  
  // Выбираем обязательные категории
  for (let i = 0; i < pattern.required; i++) {
    let attempts = 0;
    let ingredientFound = false;
    
    while (attempts < maxAttempts && !ingredientFound) {
      const category = getRandomElement(pattern.base);
      if (!selectedCategories.includes(category)) {
        const categoryIngredients = INGREDIENTS_DATABASE[category];
        const ingredient = getRandomElement(categoryIngredients);
        
        if (!selectedIngredients.some(i => i.name === ingredient.name)) {
          selectedIngredients.push({
            ...ingredient,
            amount: getRandomInt(50, 200)
          });
          selectedCategories.push(category);
          ingredientFound = true;
        }
      }
      attempts++;
    }
  }
  
  // Выбираем дополнительные ингредиенты
  const allCategories = Object.keys(INGREDIENTS_DATABASE);
  for (let i = 0; i < pattern.optional; i++) {
    let attempts = 0;
    let ingredientFound = false;
    
    while (attempts < maxAttempts && !ingredientFound) {
      const randomCategory = getRandomElement(allCategories);
      const categoryIngredients = INGREDIENTS_DATABASE[randomCategory];
      const ingredient = getRandomElement(categoryIngredients);
      
      if (!selectedIngredients.some(i => i.name === ingredient.name)) {
        selectedIngredients.push({
          ...ingredient,
          amount: getRandomInt(20, 100)
        });
        ingredientFound = true;
      }
      attempts++;
    }
  }
  
  // Добавляем специи
  for (let i = 0; i < pattern.spices; i++) {
    const spice = getRandomElement(INGREDIENTS_DATABASE.spices);
    selectedIngredients.push({
      name: spice,
      amount: getRandomInt(1, 10),
      unit: 'г',
      category: 'специя'
    });
  }
  
  return selectedIngredients;
};

// Расчет питательных веществ
const calculateNutrition = (ingredients) => {
  return ingredients.reduce((total, ing) => {
    const ratio = ing.amount / 100;
    return {
      calories: total.calories + (ing.calories || 0) * ratio,
      protein: total.protein + (ing.protein || 0) * ratio,
      carbs: total.carbs + (ing.carbs || 0) * ratio,
      fat: total.fat + (ing.fat || 0) * ratio
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
};

// Генерация уникального рецепта
const generateUniqueRecipe = (mealType, userId, attempt = 0) => {
  if (attempt > 100) {
    throw new Error('Не удалось сгенерировать уникальный рецепт после 100 попыток');
  }
  
  const pattern = MEAL_PATTERNS[mealType];
  const cuisine = getRandomElement(CUISINE_STYLES);
  const dietaryStyle = getRandomElement(DIETARY_STYLES);
  
  // Выбираем ингредиенты
  const ingredients = selectUniqueIngredients(INGREDIENTS_DATABASE, pattern.ingredientPattern);
  
  // Проверяем уникальность комбинации
  const signature = generateRecipeSignature(ingredients, mealType, cuisine);
  if (usedSignatures.has(signature)) {
    return generateUniqueRecipe(mealType, userId, attempt + 1);
  }
  
  usedSignatures.add(signature);
  
  // Расчет нутриентов
  const baseNutrition = calculateNutrition(ingredients);
  const adjustedNutrition = {
    calories: Math.round(baseNutrition.calories * 
      (getRandomFloat(pattern.calorieRange[0], pattern.calorieRange[1]) / baseNutrition.calories)),
    protein: Math.round(baseNutrition.protein * dietaryStyle.proteinMultiplier),
    carbs: Math.round(baseNutrition.carbs * dietaryStyle.carbMultiplier),
    fats: Math.round(baseNutrition.fat * 1.0) // Жиры не меняем
  };
  
  // Генерация данных
  const now = new Date();
  const daysAgo = getRandomInt(1, 180);
  const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  
  // Генерация заголовка
  const mainProtein = ingredients.find(i => i.category && 
    ['птица', 'рыба', 'красное мясо', 'растительный белок', 'бобовые'].includes(i.category));
  const mainVeggie = ingredients.find(i => i.category === 'зелень' || i.category === 'овощ');
  const mainCarb = ingredients.find(i => i.category === 'крупа' || i.category === 'рис');
  
  const titleParts = [];
  if (mainProtein) titleParts.push(mainProtein.name);
  if (mainVeggie) titleParts.push(`с ${mainVeggie.name}`);
  if (mainCarb) titleParts.push(`и ${mainCarb.name}`);
  
  const title = `${mealType}: ${titleParts.join(' ')} ${getRandomInt(1, 50)}`;
  
  // Генерация описания
  const description = getRandomElement(pattern.descriptionTemplates);
  const cookingMethod = getRandomElement(pattern.cookingMethods);
  
  // Генерация шагов
  const steps = [
    { order: 1, text: `Подготовьте все ингредиенты для ${mealType.toLowerCase()}.` },
    { order: 2, text: `${cookingMethod.charAt(0).toUpperCase() + cookingMethod.slice(1)} основные ингредиенты.` },
    { order: 3, text: `Добавьте специи и готовьте еще ${getRandomInt(5, 20)} минут.` },
    { order: 4, text: 'Подавайте блюдо горячим или охлажденным, по желанию.' }
  ];
  
  // Теги
  const tags = [
    dietaryStyle.name.toLowerCase(),
    cuisine.name.toLowerCase(),
    mealType.toLowerCase(),
    ...cuisine.spices.slice(0, 2)
  ];
  
  // Генерация рецепта
  return {
    title,
    description: `${description} Стиль: ${cuisine.name}.`,
    mealType,
    difficultyLevel: getRandomElement(['Легко', 'Средне', 'Сложно']),
    cookingTime: getRandomInt(pattern.timeRange[0], pattern.timeRange[1]),
    calories: adjustedNutrition.calories,
    proteins: adjustedNutrition.protein,
    carbohydrates: adjustedNutrition.carbs,
    fats: adjustedNutrition.fats,
    ingredients: ingredients.map((ing, index) => ({
      name: ing.name,
      amount: ing.amount,
      unit: getRandomElement(['г', 'мл', 'шт', 'ст.л.', 'ч.л.'])
    })),
    ingredientsText: ingredients.map(ing => ing.name).join(', '),
    steps,
    tags,
    averageRating: getRandomFloat(3.5, 5.0),
    ratingsCount: getRandomInt(5, 150),
    likesCount: getRandomInt(10, 300),
    savesCount: getRandomInt(20, 500),
    isPublic: true,
    userId,
    createdAt,
    updatedAt: now,
    imageUrl: `https://source.unsplash.com/600x400/?${encodeURIComponent(
      `${mealType} ${mainProtein ? mainProtein.name : ''} ${cuisine.name} food`
    )}`,
    weight: `${getRandomInt(200, 600)} гр.`
  };
};

// ================== ОСНОВНАЯ ФУНКЦИЯ ==================
export const generateAndSaveUniqueRecipes = async (userId, count = 50) => {
  try {
    console.log('🍳 Начинаем генерацию уникальных рецептов...');
    
    const recipes = [];
    const mealTypes = Object.keys(MEAL_PATTERNS);
    const distribution = {};
    
    // Распределяем рецепты по типам питания
    for (let i = 0; i < count; i++) {
      const mealType = mealTypes[i % mealTypes.length];
      distribution[mealType] = (distribution[mealType] || 0) + 1;
      
      try {
        const recipe = generateUniqueRecipe(mealType, userId);
        recipes.push(recipe);
        console.log(`✅ Создан уникальный рецепт: ${recipe.title}`);
      } catch (error) {
        console.warn(`⚠️ Пропущена попытка ${i + 1}: ${error.message}`);
        i--; // Повторяем попытку
      }
    }
    
    // Сохранение в базу данных
    console.log('\n💾 Сохраняем рецепты в базу данных...');
    const savedRecipes = [];
    
    for (const recipe of recipes) {
      try {
        const docRef = await addDoc(collection(db, 'recipes'), recipe);
        savedRecipes.push({
          id: docRef.id,
          title: recipe.title,
          mealType: recipe.mealType,
          calories: recipe.calories
        });
      } catch (error) {
        console.error(`❌ Ошибка сохранения: ${error.message}`);
      }
    }
    
    // Вывод статистики
    console.log('\n📊 ====== СТАТИСТИКА ГЕНЕРАЦИИ ======');
    console.log(`✅ Успешно сгенерировано: ${savedRecipes.length} рецептов`);
    console.log(`📈 Уникальных комбинаций: ${usedSignatures.size}`);
    
    console.log('\n🍽️  Распределение по типам питания:');
    Object.entries(distribution).forEach(([type, amount]) => {
      console.log(`   ${type}: ${amount} рецептов`);
    });
    
    // Анализ разнообразия
    console.log('\n🎯 Анализ разнообразия:');
    
    const allIngredients = new Set();
    const allCuisines = new Set();
    recipes.forEach(recipe => {
      recipe.ingredients.forEach(ing => allIngredients.add(ing.name));
      recipe.tags.forEach(tag => {
        if (CUISINE_STYLES.some(c => c.name.toLowerCase() === tag)) {
          allCuisines.add(tag);
        }
      });
    });
    
    console.log(`   Уникальных ингредиентов: ${allIngredients.size}`);
    console.log(`   Кухонь мира: ${allCuisines.size}`);
    console.log(`   Средняя калорийность: ${Math.round(
      recipes.reduce((sum, r) => sum + r.calories, 0) / recipes.length
    )} ккал`);
    
    return {
      success: true,
      count: savedRecipes.length,
      recipes: savedRecipes,
      statistics: {
        uniqueIngredients: allIngredients.size,
        cuisines: allCuisines.size,
        distribution
      }
    };
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ================== КОМПОНЕНТ ДЛЯ РЕАКТ НАТИВ ==================
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ScrollView 
} from 'react-native';
import { Feather } from '@expo/vector-icons';

export const RecipeGeneratorButton = ({ userId, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState(null);
  
  const handleGenerateRecipes = async () => {
    if (!userId) {
      Alert.alert('Ошибка', 'Пользователь не авторизован');
      return;
    }
    
    Alert.alert(
      'Генерация рецептов',
      'Создать 50 уникальных рецептов для тестирования рациона?',
      [
        { text: 'Отмена', style: 'cancel' },
        { 
          text: 'Создать', 
          onPress: async () => {
            setLoading(true);
            setProgress(0);
            
            try {
              const result = await generateAndSaveUniqueRecipes(userId, 50);
              
              if (result.success) {
                setStats(result.statistics);
                Alert.alert(
                  '✅ Успешно!',
                  `Создано ${result.count} уникальных рецептов\n\n` +
                  `Уникальных ингредиентов: ${result.statistics.uniqueIngredients}\n` +
                  `Различных кухонь: ${result.statistics.cuisines}`
                );
                
                if (onComplete) {
                  onComplete(result);
                }
              } else {
                Alert.alert('Ошибка', result.error);
              }
            } catch (error) {
              Alert.alert('Ошибка', error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };
  
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleGenerateRecipes}
        disabled={loading}
      >
        <Feather name="plus-circle" size={24} color="#fff" />
        <Text style={styles.buttonText}>
          {loading ? 'Генерация...' : 'Создать тестовые рецепты'}
        </Text>
      </TouchableOpacity>
      
      {stats && (
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Статистика:</Text>
          <Text>Уникальных ингредиентов: {stats.uniqueIngredients}</Text>
          <Text>Кухонь мира: {stats.cuisines}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef'
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  statsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6'
  },
  statsTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    fontSize: 16
  }
});

export default generateAndSaveUniqueRecipes;