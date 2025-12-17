import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

// ========== КОНФИГУРАЦИЯ ==========
const CLOUDINARY_CONFIG = {
  cloudName: 'df88pkxud',
  uploadPreset: 'recipe_upload_app', // Убедитесь что preset создан и Unsigned
  uploadUrl: 'https://api.cloudinary.com/v1_1/df88pkxud/image/upload',
};

// ========== ТИПЫ ==========
export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  width?: number;
  height?: number;
  error?: string;
  errorCode?: string;
  rawError?: any;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

// ========== КЛАСС СЕРВИСА ==========
class CloudinaryService {
  private cloudName: string;
  private uploadPreset: string;
  private uploadUrl: string;

  constructor() {
    this.cloudName = CLOUDINARY_CONFIG.cloudName;
    this.uploadPreset = CLOUDINARY_CONFIG.uploadPreset;
    this.uploadUrl = CLOUDINARY_CONFIG.uploadUrl;
    
    console.log('🌥 Cloudinary Service:');
    console.log('Cloud Name:', this.cloudName);
    console.log('Upload Preset:', this.uploadPreset ? '✅ Указан' : '❌ Не указан');
  }

  /**
   * Оптимизация изображения
   */
  private async optimizeImage(uri: string): Promise<string> {
    try {
      console.log('🔧 Оптимизация изображения...');
      
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            resize: {
              width: 1200,
              height: 1200,
            },
          },
        ],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true, // ВАЖНО: просим вернуть base64
        }
      );
      
      console.log('✅ Изображение оптимизировано');
      return result.base64 || '';
      
    } catch (error) {
      console.warn('⚠️  Optimization failed:', error);
      // Возвращаем пустую строку, дальше будет обработано
      return '';
    }
  }

  /**
   * Создание FormData для Cloudinary
   */
  private createFormData(base64Image: string): FormData {
    console.log('📝 Создание FormData...');
    
    // Формат данных для Cloudinary: 'data:image/jpeg;base64,XXXXX'
    const dataUrl = `data:image/jpeg;base64,${base64Image}`;
    
    const formData = new FormData();
    
    // Ключевое поле: Cloudinary ожидает именно 'file' с data URL
    formData.append('file', dataUrl);
    formData.append('upload_preset', this.uploadPreset);
    
    console.log('✅ FormData создан');
    console.log('Upload Preset:', this.uploadPreset);
    
    return formData;
  }

  /**
   * Основной метод загрузки изображения
   */
  async uploadImage(
    imageUri: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    console.log('🚀 Начало загрузки в Cloudinary...');
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
      const base64Image = await this.optimizeImage(imageUri);
      
      if (!base64Image) {
        return {
          success: false,
          error: 'Не удалось обработать изображение',
          errorCode: 'IMAGE_PROCESSING_FAILED',
        };
      }

      // 2. Подготовка FormData
      const formData = this.createFormData(base64Image);

      // 3. Отправка на Cloudinary
      console.log('📤 Отправка запроса на Cloudinary...');
      
      let response: Response;
      
      if (Platform.OS !== 'web' && onProgress) {
        // С отслеживанием прогресса для React Native
        response = await this.sendWithProgress(formData, onProgress);
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
          // Пробуем распарсить JSON ошибки
          const errorJson = JSON.parse(responseText);
          errorMessage = errorJson.error?.message || errorMessage;
          
          // Детальная диагностика
          if (errorMessage.includes('upload preset')) {
            errorMessage = 'Upload Preset не найден или неверный. Проверьте настройки Cloudinary Dashboard.';
            errorCode = 'INVALID_UPLOAD_PRESET';
          } else if (errorMessage.includes('unsigned')) {
            errorMessage = 'Upload Preset должен быть "Unsigned" для мобильных приложений.';
            errorCode = 'PRESET_NOT_UNSIGNED';
          } else if (response.status === 400) {
            errorMessage = `Неверный запрос к Cloudinary (400). Проверьте Upload Preset: ${this.uploadPreset}`;
            errorCode = 'BAD_REQUEST';
          }
          
        } catch (parseError) {
          // Если не JSON, используем текст ответа
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
      
      // Проверяем папку
      if (!result.public_id.startsWith('recipes/')) {
        console.warn('⚠️  Файл не в папке recipes!');
        console.warn('Public ID:', result.public_id);
      } else {
        console.log('✅ Файл в папке recipes');
      }

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
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
  checkConfig(): { isValid: boolean; message: string } {
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
        message: issues.join(', '),
      };
    }
    
    return {
      isValid: true,
      message: 'Конфигурация Cloudinary проверена',
    };
  }
}

// Экспортируем singleton
export const cloudinaryService = new CloudinaryService();

// Вспомогательная функция для теста
export const testCloudinaryConfig = async (): Promise<{
  success: boolean;
  message: string;
  config?: any;
}> => {
  try {
    const config = cloudinaryService.checkConfig();
    
    if (!config.isValid) {
      return {
        success: false,
        message: config.message,
      };
    }
    
    // Простой тест: создаем мини-изображение
    const testBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const formData = new FormData();
    formData.append('file', `data:image/png;base64,${testBase64}`);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    
    const response = await fetch(CLOUDINARY_CONFIG.uploadUrl, {
      method: 'POST',
      body: formData,
    });
    
    if (response.ok) {
      return {
        success: true,
        message: 'Cloudinary настроен корректно',
        config: {
          cloudName: CLOUDINARY_CONFIG.cloudName,
          uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
        },
      };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        message: `Ошибка Cloudinary (${response.status}): ${errorText.substring(0, 100)}`,
      };
    }
    
  } catch (error: any) {
    return {
      success: false,
      message: `Ошибка теста: ${error.message}`,
    };
  }
};