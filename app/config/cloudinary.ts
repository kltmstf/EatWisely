
export const CLOUDINARY_CONFIG = {
  // Ваш Cloud Name из Dashboard
  cloudName: 'df88pkxud',
  
  // Имя Upload Preset который мы создали
  uploadPreset: 'recipe_upload_app',
  
  // URL для загрузки
  uploadUrl: 'https://api.cloudinary.com/v1_1/df88pkxud/image/upload',
};

/**
 * Настройки изображений
 */
export const IMAGE_SETTINGS = {
  // Максимальные размеры
  maxWidth: 1200,
  maxHeight: 1200,
  
  // Качество сжатия (0.1 - 1.0)
  quality: 0.8,
  
  // Формат для сохранения
  format: 'JPEG' as const,
  
  // Папка для загрузки (совпадает с Upload Preset)
  folder: 'recipes',
  
  // Максимальный размер файла (10MB - Cloudinary бесплатный лимит)
  maxFileSize: 10 * 1024 * 1024, // 10MB в байтах
  
  // Разрешенные типы файлов
  allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
  
  // Автоматические преобразования Cloudinary
  cloudinaryTransformations: 'f_auto,q_auto:good',
};

/**
 * Генерация имени файла
 */
export const generateFileName = (originalName?: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10); // 8 символов
  
  let baseName = 'recipe';
  
  if (originalName) {
    // Очищаем имя файла от небезопасных символов
    const cleanName = originalName
      .replace(/[^a-zA-Z0-9]/g, '_') // Заменяем спецсимволы на _
      .toLowerCase()
      .substring(0, 50); // Ограничиваем длину
    
    baseName = cleanName;
  }
  
  return `${baseName}_${timestamp}_${random}`;
};

/**
 * Проверка типа файла
 */
export const isValidImageType = (uri: string): boolean => {
  const extension = uri.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension);
};

/**
 * Форматирование размера файла
 */
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};