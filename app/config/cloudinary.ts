/**
 * Конфигурация Cloudinary для приложения рецептов
 * Cloud Name: df88pkxud
 * Upload Preset: recipe_upload_app (настроен с папкой recipes)
 */

// Основная конфигурация
export const CLOUDINARY_CONFIG = {
  // Ваш Cloud Name
  cloudName: 'df88pkxud',
  
  // Имя Upload Preset (убедитесь что он настроен с папкой recipes)
  uploadPreset: 'recipe_upload_app',
  
  // URL для загрузки (автоматически генерируется)
  get uploadUrl() {
    return `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`;
  },
  
  // URL для удаления (если понадобится)
  get deleteUrl() {
    return `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`;
  },
  
  // Флаги для проверки настроек Upload Preset
  expectedPresetSettings: {
    useFilename: true,           // Использовать имя файла
    uniqueFilename: true,        // Добавлять уникальный суффикс
    prependPath: true,           // Добавлять путь к public_id
    targetFolder: 'recipes',     // Целевая папка
    overwrite: false,            // Не перезаписывать файлы
  },
};

/**
 * Настройки изображений для оптимизации
 */
export const IMAGE_SETTINGS = {
  // Максимальные размеры (Cloudinary бесплатно до 10MB, но оптимизируем)
  maxWidth: 1200,
  maxHeight: 1200,
  
  // Качество сжатия
  quality: 0.85,
  
  // Формат для сохранения
  format: 'JPEG' as const,
  
  // Целевая папка в Cloudinary (должна совпадать с Upload Preset)
  targetFolder: 'recipes',
  
  // Максимальный размер файла (10MB - Cloudinary бесплатный лимит)
  maxFileSize: 10 * 1024 * 1024, // 10MB
  
  // Разрешенные типы файлов
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  
  // Параметры для Cloudinary трансформаций
  cloudinaryTransformations: 'f_auto,q_auto:good',
  
  // Настройки имен файлов
  fileNameOptions: {
    maxLength: 100,                    // Максимальная длина имени
    replaceSpaces: true,               // Заменять пробелы на _
    preserveExtension: true,           // Сохранять расширение
    addTimestamp: true,                // Добавлять timestamp
    addRandomSuffix: true,             // Добавлять случайный суффикс
  },
};

/**
 * Генерация безопасного имени файла
 */
export const generateSafeFileName = (
  originalName?: string,
  options?: {
    addTimestamp?: boolean;
    addRandomSuffix?: boolean;
    maxLength?: number;
  }
): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 10); // 8 символов
  
  // Базовое имя
  let baseName = 'recipe_image';
  
  if (originalName) {
    // Очищаем имя файла
    baseName = originalName
      .replace(/[^a-zA-Z0-9а-яА-ЯёЁ\s\-\.]/g, '') // Удаляем опасные символы
      .replace(/\s+/g, '_')                      // Заменяем пробелы на _
      .toLowerCase()
      .replace(/\.(jpg|jpeg|png|webp|gif)$/i, ''); // Убираем расширение
  }
  
  // Ограничиваем длину
  const maxLen = options?.maxLength || IMAGE_SETTINGS.fileNameOptions.maxLength;
  if (baseName.length > maxLen) {
    baseName = baseName.substring(0, maxLen);
  }
  
  // Собираем финальное имя
  let finalName = baseName;
  
  if (options?.addTimestamp !== false) {
    finalName += `_${timestamp}`;
  }
  
  if (options?.addRandomSuffix !== false) {
    finalName += `_${randomSuffix}`;
  }
  
  return finalName;
};

/**
 * Проверка типа файла
 */
export const isValidImageFile = (uri: string): boolean => {
  try {
    const extension = uri.toLowerCase().split('.').pop() || '';
    return IMAGE_SETTINGS.allowedExtensions.includes(extension);
  } catch {
    return false;
  }
};

/**
 * Получение MIME типа по расширению
 */
export const getMimeTypeFromUri = (uri: string): string => {
  const extension = uri.toLowerCase().split('.').pop() || '';
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
};

/**
 * Форматирование размера файла
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Информация о текущей конфигурации (для отладки)
 */
export const getCloudinaryConfigInfo = () => {
  return {
    cloudName: CLOUDINARY_CONFIG.cloudName,
    uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
    uploadUrl: CLOUDINARY_CONFIG.uploadUrl,
    targetFolder: IMAGE_SETTINGS.targetFolder,
    maxFileSize: formatFileSize(IMAGE_SETTINGS.maxFileSize),
    expectedSettings: CLOUDINARY_CONFIG.expectedPresetSettings,
  };
};