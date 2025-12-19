import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

// ========== КОНФИГУРАЦИЯ ==========
const CLOUDINARY_CONFIGS = {
  // Для рецептов
  recipes: {
    cloudName: 'df88pkxud',
    uploadPreset: 'recipe_upload_app',
    targetFolder: 'recipes',
    uploadUrl: 'https://api.cloudinary.com/v1_1/df88pkxud/image/upload',
  },
  // Для сообщества
  community: {
    cloudName: 'df88pkxud',
    uploadPreset: 'community_upload_app',
    targetFolder: 'community_photos',
    uploadUrl: 'https://api.cloudinary.com/v1_1/df88pkxud/image/upload',
  },
  // Для аватаров
  avatars: {
    cloudName: 'df88pkxud',
    uploadPreset: 'user_avatar_app',
    targetFolder: 'avatars',
    uploadUrl: 'https://api.cloudinary.com/v1_1/df88pkxud/image/upload',
  }
};

// Типы конфигураций
export type CloudinaryServiceType = 'recipes' | 'community' | 'avatars';

// ========== ТИПЫ ==========
export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  error?: string;
  errorCode?: string;
  rawError?: any;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  compressQuality?: number; // 0.1 - 1.0
  maxWidth?: number;
  maxHeight?: number;
  fileName?: string;
  folder?: string;
}

export interface DeleteResult {
  success: boolean;
  message: string;
  error?: string;
}

// ========== КЛАСС СЕРВИСА ==========
class CloudinaryService {
  private cloudName: string;
  private uploadPreset: string;
  private targetFolder: string;
  private uploadUrl: string;
  private serviceType: CloudinaryServiceType;

  constructor(serviceType: CloudinaryServiceType = 'recipes') {
    const config = CLOUDINARY_CONFIGS[serviceType];
    
    this.serviceType = serviceType;
    this.cloudName = config.cloudName;
    this.uploadPreset = config.uploadPreset;
    this.targetFolder = config.targetFolder;
    this.uploadUrl = config.uploadUrl;
    
    console.log(`🌥 Cloudinary Service (${serviceType}):`);
    console.log('Cloud Name:', this.cloudName);
    console.log('Upload Preset:', this.uploadPreset);
    console.log('Target Folder:', this.targetFolder);
  }

  /**
   * Оптимизация изображения с учетом типа сервиса
   */
  private async optimizeImage(
    uri: string, 
    options?: {
      compressQuality?: number;
      maxWidth?: number;
      maxHeight?: number;
    }
  ): Promise<string> {
    try {
      console.log(`🔧 Оптимизация изображения для ${this.serviceType}...`);
      
      // Разные настройки для разных типов изображений
      let compress = 0.8;
      let maxWidth = 1200;
      let maxHeight = 1200;
      let format = ImageManipulator.SaveFormat.JPEG;
      
      switch (this.serviceType) {
        case 'avatars':
          compress = 0.9; // Высокое качество для аватаров
          maxWidth = 800;
          maxHeight = 800;
          break;
        case 'recipes':
          compress = 0.8;
          maxWidth = 1200;
          maxHeight = 1200;
          break;
        case 'community':
          compress = 0.75; // Немного меньше для быстрой загрузки
          maxWidth = 1200;
          maxHeight = 1200;
          break;
      }
      
      // Переопределяем настройки если переданы в options
      if (options?.compressQuality) compress = options.compressQuality;
      if (options?.maxWidth) maxWidth = options.maxWidth;
      if (options?.maxHeight) maxHeight = options.maxHeight;
      
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            resize: {
              width: maxWidth,
              height: maxHeight,
            },
          },
        ],
        {
          compress,
          format,
          base64: true,
        }
      );
      
      console.log('✅ Изображение оптимизировано');
      return result.base64 || '';
      
    } catch (error) {
      console.warn('⚠️  Optimization failed:', error);
      return '';
    }
  }

  /**
   * Создание FormData для Cloudinary
   */
  private createFormData(base64Image: string, fileName?: string): FormData {
    console.log('📝 Создание FormData...');
    
    // Определяем MIME тип
    const mimeType = 'image/jpeg'; // Всегда JPEG после оптимизации
    
    // Формат данных для Cloudinary: 'data:image/jpeg;base64,XXXXX'
    const dataUrl = `data:${mimeType};base64,${base64Image}`;
    
    const formData = new FormData();
    
    // Основные поля
    formData.append('file', dataUrl);
    formData.append('upload_preset', this.uploadPreset);
    
    // Дополнительные параметры
    if (fileName) {
      formData.append('public_id', `${this.targetFolder}/${fileName}`);
    }
    
    console.log('✅ FormData создан');
    console.log('Upload Preset:', this.uploadPreset);
    console.log('Target Folder:', this.targetFolder);
    
    return formData;
  }

  /**
   * Основной метод загрузки изображения
   */
  async uploadImage(
    imageUri: string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    console.log(`🚀 Начало загрузки в Cloudinary (${this.serviceType})...`);
    console.log('Source:', imageUri);
    console.log('Cloud Name:', this.cloudName);

    try {
      // Проверяем конфигурацию
      if (!this.uploadPreset) {
        return {
          success: false,
          error: 'Upload Preset не настроен. Проверьте конфигурацию Cloudinary.',
          errorCode: 'NO_UPLOAD_PRESET',
        };
      }

      // 1. Оптимизация и получение base64
      const base64Image = await this.optimizeImage(imageUri, {
        compressQuality: options?.compressQuality,
        maxWidth: options?.maxWidth,
        maxHeight: options?.maxHeight,
      });
      
      if (!base64Image) {
        return {
          success: false,
          error: 'Не удалось обработать изображение',
          errorCode: 'IMAGE_PROCESSING_FAILED',
        };
      }

      // 2. Подготовка FormData
      const formData = this.createFormData(base64Image, options?.fileName);

      // 3. Отправка на Cloudinary
      console.log('📤 Отправка запроса на Cloudinary...');
      
      let response: Response;
      
      if (Platform.OS !== 'web' && options?.onProgress) {
        // С отслеживанием прогресса для React Native
        response = await this.sendWithProgress(formData, options.onProgress);
      } else {
        // Простая отправка
        response = await fetch(this.uploadUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      // Получаем ответ как текст для отладки
      const responseText = await response.text();
      console.log('📨 Ответ Cloudinary:', response.status, response.statusText);
      
      if (!response.ok) {
        console.error('❌ Cloudinary ошибка:', responseText);
        
        let errorMessage = 'Ошибка загрузки изображения';
        let errorCode = 'UPLOAD_FAILED';
        
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage = errorJson.error?.message || errorMessage;
          
          // Детальная диагностика
          if (errorMessage.includes('upload preset')) {
            errorMessage = `Upload Preset "${this.uploadPreset}" не найден. Проверьте настройки Cloudinary Dashboard.`;
            errorCode = 'INVALID_UPLOAD_PRESET';
          } else if (errorMessage.includes('unsigned')) {
            errorMessage = 'Upload Preset должен быть "Unsigned" для мобильных приложений.';
            errorCode = 'PRESET_NOT_UNSIGNED';
          } else if (response.status === 400) {
            errorMessage = `Неверный запрос к Cloudinary (400). Проверьте Upload Preset: ${this.uploadPreset}`;
            errorCode = 'BAD_REQUEST';
          }
          
        } catch (parseError) {
          errorMessage = `Cloudinary ошибка ${response.status}: ${responseText.substring(0, 100)}`;
        }
        
        return {
          success: false,
          error: errorMessage,
          errorCode,
          rawError: responseText,
        };
      }

      // 4. Обработка успешного ответа
      const result = JSON.parse(responseText);
      
      console.log('✅ Успешно загружено!');
      console.log('URL:', result.secure_url);
      console.log('Public ID:', result.public_id);
      console.log('Size:', result.bytes ? `${Math.round(result.bytes / 1024)} KB` : 'N/A');
      
      // Проверяем папку
      const expectedFolderPrefix = `${this.targetFolder}/`;
      if (!result.public_id.startsWith(expectedFolderPrefix)) {
        console.warn(`⚠️  Файл не в папке ${this.targetFolder}!`);
        console.warn('Public ID:', result.public_id);
        console.warn('Expected prefix:', expectedFolderPrefix);
      } else {
        console.log(`✅ Файл в папке ${this.targetFolder}`);
      }

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      };

    } catch (error: any) {
      console.error('❌ Неожиданная ошибка:', error);
      
      return {
        success: false,
        error: `Неожиданная ошибка: ${error.message || 'Неизвестная ошибка'}`,
        errorCode: 'UNEXPECTED_ERROR',
        rawError: error,
      };
    }
  }

  /**
   * Удаление изображения из Cloudinary
   */
  async deleteImage(publicId: string): Promise<DeleteResult> {
    console.log(`🗑️ Удаление изображения из Cloudinary (${this.serviceType})...`);
    console.log('Public ID:', publicId);
    
    try {
      // Проверяем, что publicId не пустой
      if (!publicId || publicId.trim() === '') {
        return {
          success: false,
          message: 'Не указан Public ID для удаления',
          error: 'EMPTY_PUBLIC_ID',
        };
      }

      // Проверяем конфигурацию
      if (!this.cloudName || this.cloudName === 'your-cloud-name') {
        return {
          success: false,
          message: 'Cloud Name не настроен',
          error: 'NO_CLOUD_NAME',
        };
      }

      // Формируем URL для удаления
      // Cloudinary API для удаления: https://api.cloudinary.com/v1_1/{cloud_name}/image/destroy
      const deleteUrl = `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`;
      
      console.log('Delete URL:', deleteUrl);

      // Для unsigned uploads достаточно public_id
      const formData = new FormData();
      formData.append('public_id', publicId);
      
      // Примечание: Для production рекомендуется использовать signed requests с API key
      // Для этого потребуется добавить:
      // - api_key
      // - timestamp
      // - signature (рассчитанная по алгоритму Cloudinary)
      
      console.log('📤 Отправка запроса на удаление...');

      const response = await fetch(deleteUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log('📨 Ответ Cloudinary (удаление):', response.status, response.statusText);

      if (!response.ok) {
        console.error('❌ Ошибка удаления:', responseText);
        
        let errorMessage = 'Ошибка удаления изображения';
        
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage = errorJson.error?.message || errorMessage;
          
          // Специфичные ошибки Cloudinary
          if (errorMessage.includes('Resource not found')) {
            errorMessage = `Изображение не найдено: ${publicId}`;
          } else if (errorMessage.includes('Invalid signature')) {
            errorMessage = 'Неверная подпись. Требуется аутентификация.';
          } else if (response.status === 401) {
            errorMessage = 'Требуется аутентификация. Настройте API Key для удаления.';
          }
          
        } catch (parseError) {
          errorMessage = `Cloudinary ошибка ${response.status}: ${responseText.substring(0, 100)}`;
        }
        
        return {
          success: false,
          message: errorMessage,
          error: 'DELETE_FAILED',
        };
      }

      // Обработка успешного ответа
      try {
        const result = JSON.parse(responseText);
        
        if (result.result === 'ok' || result.result === 'not found') {
          console.log('✅ Изображение удалено или не найдено:', result.result);
          
          return {
            success: true,
            message: result.result === 'ok' 
              ? 'Изображение успешно удалено' 
              : 'Изображение не найдено (возможно уже удалено)',
          };
        } else {
          console.warn('⚠️ Неожиданный ответ:', result);
          
          return {
            success: false,
            message: `Неожиданный ответ: ${result.result || 'unknown'}`,
            error: 'UNEXPECTED_RESPONSE',
          };
        }
        
      } catch (parseError) {
        console.error('❌ Ошибка парсинга ответа:', parseError);
        
        return {
          success: false,
          message: 'Не удалось обработать ответ Cloudinary',
          error: 'PARSE_ERROR',
        };
      }

    } catch (error: any) {
      console.error('❌ Неожиданная ошибка при удалении:', error);
      
      return {
        success: false,
        message: `Неожиданная ошибка: ${error.message || 'Неизвестная ошибка'}`,
        error: 'UNEXPECTED_ERROR',
      };
    }
  }

  /**
   * Удаление изображения по URL
   * (извлекает public_id из URL Cloudinary)
   */
  async deleteImageByUrl(imageUrl: string): Promise<DeleteResult> {
    try {
      console.log(`🗑️ Удаление изображения по URL (${this.serviceType})...`);
      console.log('Image URL:', imageUrl);
      
      // Извлекаем public_id из URL Cloudinary
      // Пример URL: https://res.cloudinary.com/cloudname/image/upload/v1234567890/folder/filename.jpg
      
      // Проверяем, что это Cloudinary URL
      if (!imageUrl.includes('cloudinary.com')) {
        return {
          success: false,
          message: 'Неверный формат URL. Ожидается Cloudinary URL.',
          error: 'NOT_CLOUDINARY_URL',
        };
      }

      const urlParts = imageUrl.split('/');
      const uploadIndex = urlParts.indexOf('upload');
      
      if (uploadIndex === -1 || uploadIndex >= urlParts.length - 1) {
        return {
          success: false,
          message: 'Неверный формат URL Cloudinary',
          error: 'INVALID_URL_FORMAT',
        };
      }
      
      // Получаем часть после 'upload/'
      const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
      
      // Убираем версию если есть (v1234567890/)
      let publicId = pathAfterUpload;
      if (pathAfterUpload.startsWith('v')) {
        const versionEnd = pathAfterUpload.indexOf('/');
        if (versionEnd !== -1) {
          publicId = pathAfterUpload.substring(versionEnd + 1);
        }
      }
      
      // Убираем расширение файла
      const dotIndex = publicId.lastIndexOf('.');
      if (dotIndex !== -1) {
        publicId = publicId.substring(0, dotIndex);
      }
      
      console.log('Извлеченный Public ID:', publicId);
      
      // Проверяем, что public_id начинается с правильной папки
      const expectedPrefix = `${this.targetFolder}/`;
      if (!publicId.startsWith(expectedPrefix)) {
        console.warn(`⚠️ Public ID не начинается с папки ${this.targetFolder}`);
        console.warn('Public ID:', publicId);
        console.warn('Expected prefix:', expectedPrefix);
      }
      
      return await this.deleteImage(publicId);
      
    } catch (error: any) {
      console.error('❌ Ошибка обработки URL:', error);
      
      return {
        success: false,
        message: `Ошибка обработки URL: ${error.message}`,
        error: 'URL_PROCESSING_ERROR',
      };
    }
  }

  /**
   * Отправка с отслеживанием прогресса
   */
  private async sendWithProgress(
    formData: FormData,
    onProgress: (progress: UploadProgress) => void
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open('POST', this.uploadUrl);
      
      // Отслеживание прогресса
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent: (event.loaded / event.total) * 100,
          });
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
          }));
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };
      
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData as any);
    });
  }

  /**
   * Проверка конфигурации
   */
  checkConfig(): { isValid: boolean; message: string; config: any } {
    const issues: string[] = [];
    
    if (!this.cloudName || this.cloudName === 'your-cloud-name') {
      issues.push('Cloud Name не настроен');
    }
    
    if (!this.uploadPreset || this.uploadPreset === 'your-upload-preset') {
      issues.push('Upload Preset не настроен');
    }
    
    if (issues.length > 0) {
      return {
        isValid: false,
        message: `Cloudinary ${this.serviceType}: ${issues.join(', ')}`,
        config: {
          cloudName: this.cloudName,
          uploadPreset: this.uploadPreset,
          targetFolder: this.targetFolder,
          serviceType: this.serviceType,
        }
      };
    }
    
    return {
      isValid: true,
      message: `Cloudinary ${this.serviceType} настроен корректно`,
      config: {
        cloudName: this.cloudName,
        uploadPreset: this.uploadPreset,
        targetFolder: this.targetFolder,
        serviceType: this.serviceType,
      }
    };
  }

  /**
   * Получение URL для изображения с трансформациями
   */
  getImageUrl(publicId: string, size: 'original' | 'thumbnail' | 'medium' = 'original'): string {
    let transformations = '';
    
    switch (size) {
      case 'thumbnail':
        transformations = this.serviceType === 'avatars' 
          ? 'c_fill,w_150,h_150,r_max,q_auto:good'
          : 'c_fill,w_300,h_200,q_auto:good';
        break;
      case 'medium':
        transformations = this.serviceType === 'avatars'
          ? 'c_fill,w_400,h_400,r_max,q_auto:good'
          : 'c_fill,w_800,h_600,q_auto:good';
        break;
      case 'original':
      default:
        transformations = 'q_auto:good';
    }
    
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformations}/${publicId}`;
  }

  /**
   * Получение аватара пользователя
   */
  getUserAvatarUrl(userId: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    const sizes = {
      small: 'c_fill,w_100,h_100,r_max',
      medium: 'c_fill,w_200,h_200,r_max',
      large: 'c_fill,w_400,h_400,r_max',
    };
    
    const transformation = `${sizes[size]},q_auto:good`;
    const publicId = `avatars/user_${userId}`;
    
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transformation}/${publicId}`;
  }
}

// ========== СОЗДАЕМ ИНСТАНСЫ ДЛЯ РАЗНЫХ ТИПОВ ==========

// Для рецептов
export const recipeCloudinaryService = new CloudinaryService('recipes');

// Для сообщества
export const communityCloudinaryService = new CloudinaryService('community');

// Для аватаров
export const avatarCloudinaryService = new CloudinaryService('avatars');

// Основной сервис (по умолчанию для рецептов для обратной совместимости)
export const cloudinaryService = recipeCloudinaryService;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

/**
 * Тест конфигурации для всех типов сервисов
 */
export const testAllCloudinaryConfigs = async (): Promise<{
  success: boolean;
  results: Record<CloudinaryServiceType, {
    success: boolean;
    message: string;
    config?: any;
  }>;
}> => {
  const services = {
    recipes: recipeCloudinaryService,
    community: communityCloudinaryService,
    avatars: avatarCloudinaryService,
  };

  const results: Record<CloudinaryServiceType, any> = {
    recipes: { success: false, message: 'Не тестировался' },
    community: { success: false, message: 'Не тестировался' },
    avatars: { success: false, message: 'Не тестировался' },
  };

  let allSuccess = true;

  // Тестируем каждый сервис
  for (const [type, service] of Object.entries(services)) {
    try {
      const config = service.checkConfig();
      
      if (!config.isValid) {
        results[type as CloudinaryServiceType] = {
          success: false,
          message: config.message,
          config: config.config
        };
        allSuccess = false;
        continue;
      }

      // Тестовое изображение 1x1 пиксель
      const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      
      const formData = new FormData();
      formData.append('file', `data:image/png;base64,${testBase64}`);
      formData.append('upload_preset', config.config.uploadPreset);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${config.config.cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        results[type as CloudinaryServiceType] = {
          success: true,
          message: `✅ ${type} настроен корректно`,
          config: {
            cloudName: config.config.cloudName,
            uploadPreset: config.config.uploadPreset,
            targetFolder: config.config.targetFolder,
            testUpload: {
              publicId: result.public_id,
              folder: result.folder,
              bytes: result.bytes,
            }
          }
        };
      } else {
        const errorText = await response.text();
        results[type as CloudinaryServiceType] = {
          success: false,
          message: `❌ ${type} ошибка (${response.status}): ${errorText.substring(0, 100)}`,
          config: config.config
        };
        allSuccess = false;
      }

    } catch (error: any) {
      results[type as CloudinaryServiceType] = {
        success: false,
        message: `❌ ${type} ошибка теста: ${error.message}`,
      };
      allSuccess = false;
    }
  }

  return {
    success: allSuccess,
    results
  };
};

/**
 * Генерация имени файла для загрузки
 */
export const generateCloudinaryFileName = (
  prefix: string,
  userId?: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  let fileName = prefix.toLowerCase().replace(/[^a-z0-9]/g, '_');
  
  if (userId) {
    fileName += `_${userId.substring(0, 8)}`;
  }
  
  fileName += `_${timestamp}_${random}`;
  
  return fileName;
};

/**
 * Валидация изображения перед загрузкой
 */
export const validateImageForUpload = async (
  uri: string,
  type: CloudinaryServiceType = 'recipes'
): Promise<{
  isValid: boolean;
  message: string;
  errors: string[];
}> => {
  const errors: string[] = [];
  
  // Проверка расширения
  const extension = uri.toLowerCase().split('.').pop() || '';
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  
  if (!allowedExtensions.includes(extension)) {
    errors.push(`Неподдерживаемый формат: .${extension}. Разрешены: ${allowedExtensions.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    message: errors.length > 0 ? errors[0] : 'Изображение валидно для загрузки',
    errors
  };
};

/**
 * Быстрая загрузка аватара пользователя
 */
export const uploadUserAvatar = async (
  userId: string,
  imageUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const service = avatarCloudinaryService;
  const fileName = generateCloudinaryFileName('avatar', userId);
  
  return await service.uploadImage(imageUri, {
    onProgress,
    fileName,
    compressQuality: 0.9, // Высокое качество для аватара
    maxWidth: 800,
    maxHeight: 800,
  });
};

/**
 * Быстрая загрузка изображения для поста сообщества
 */
export const uploadCommunityPostImage = async (
  imageUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const service = communityCloudinaryService;
  const fileName = generateCloudinaryFileName('post');
  
  return await service.uploadImage(imageUri, {
    onProgress,
    fileName,
    compressQuality: 0.75,
    maxWidth: 1200,
    maxHeight: 1200,
  });
};

/**
 * Быстрая загрузка изображения рецепта
 */
export const uploadRecipeImage = async (
  imageUri: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> => {
  const service = recipeCloudinaryService;
  const fileName = generateCloudinaryFileName('recipe');
  
  return await service.uploadImage(imageUri, {
    onProgress,
    fileName,
    compressQuality: 0.8,
    maxWidth: 1200,
    maxHeight: 1200,
  });
};

/**
 * Удаление изображения сообщества
 */
export const deleteCommunityImage = async (
  publicId: string
): Promise<DeleteResult> => {
  return await communityCloudinaryService.deleteImage(publicId);
};

/**
 * Удаление аватара
 */
export const deleteAvatarImage = async (
  publicId: string
): Promise<DeleteResult> => {
  return await avatarCloudinaryService.deleteImage(publicId);
};

/**
 * Удаление изображения рецепта
 */
export const deleteRecipeImage = async (
  publicId: string
): Promise<DeleteResult> => {
  return await recipeCloudinaryService.deleteImage(publicId);
};

/**
 * Удаление изображения по URL (универсальный метод)
 */
export const deleteCloudinaryImageByUrl = async (
  imageUrl: string,
  serviceType: CloudinaryServiceType = 'recipes'
): Promise<DeleteResult> => {
  let service: CloudinaryService;
  
  switch (serviceType) {
    case 'community':
      service = communityCloudinaryService;
      break;
    case 'avatars':
      service = avatarCloudinaryService;
      break;
    case 'recipes':
    default:
      service = recipeCloudinaryService;
  }
  
  return await service.deleteImageByUrl(imageUrl);
};

/**
 * Удаление нескольких изображений сообщества
 */
export const deleteMultipleCommunityImages = async (
  imageUrls: string[]
): Promise<{
  success: boolean;
  message: string;
  deleted: number;
  failed: number;
  errors: Array<{ url: string; error: string }>;
}> => {
  const errors: Array<{ url: string; error: string }> = [];
  let deleted = 0;
  let failed = 0;

  for (const url of imageUrls) {
    try {
      const result = await communityCloudinaryService.deleteImageByUrl(url);
      
      if (result.success) {
        deleted++;
      } else {
        failed++;
        errors.push({ url, error: result.message || 'Unknown error' });
      }
    } catch (error: any) {
      failed++;
      errors.push({ url, error: error.message || 'Unknown error' });
    }
  }

  return {
    success: failed === 0,
    message: `Удалено ${deleted} из ${imageUrls.length} изображений`,
    deleted,
    failed,
    errors,
  };
};

/**
 * Проверка доступности Cloudinary API для удаления
 */
export const checkCloudinaryDeleteAccess = async (): Promise<{
  canDelete: boolean;
  message: string;
  requiresAuth: boolean;
}> => {
  try {
    // Пробуем удалить несуществующее изображение для проверки API
    const testPublicId = 'test_nonexistent_image_12345';
    const result = await communityCloudinaryService.deleteImage(testPublicId);
    
    if (result.error?.includes('authentication') || result.error?.includes('signature')) {
      return {
        canDelete: false,
        message: 'Требуется настройка API Key для удаления изображений',
        requiresAuth: true,
      };
    }
    
    // Даже если изображение не найдено, API работает
    return {
      canDelete: true,
      message: result.message || 'API доступен',
      requiresAuth: false,
    };
    
  } catch (error: any) {
    return {
      canDelete: false,
      message: `Ошибка проверки API: ${error.message}`,
      requiresAuth: true,
    };
  }
};

/**
 * Безопасное удаление изображения сообщества (с обработкой ошибок)
 */
export const safeDeleteCommunityImage = async (
  imageUrl: string
): Promise<{
  success: boolean;
  message: string;
  skipped?: boolean;
}> => {
  try {
    // Проверяем, что это валидный URL Cloudinary
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) {
      return {
        success: true,
        message: 'Пропущено (не Cloudinary URL)',
        skipped: true,
      };
    }

    const result = await communityCloudinaryService.deleteImageByUrl(imageUrl);
    
    // Если изображение не найдено, считаем успехом
    if (result.message?.includes('не найдено') || result.message?.includes('not found')) {
      return {
        success: true,
        message: 'Изображение уже удалено или не существует',
      };
    }
    
    return {
      success: result.success,
      message: result.message || (result.success ? 'Успешно удалено' : 'Ошибка удаления'),
    };
    
  } catch (error: any) {
    console.warn('Предупреждение при удалении изображения:', error);
    
    // Не блокируем удаление поста из-за ошибки удаления изображения
    return {
      success: false,
      message: `Ошибка удаления изображения: ${error.message}`,
      skipped: false,
    };
  }
};