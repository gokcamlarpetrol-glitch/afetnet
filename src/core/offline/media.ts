import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
  format?: 'jpeg' | 'png';
}

export class MediaCompressor {
  private static instance: MediaCompressor;

  private constructor() {}

  static getInstance(): MediaCompressor {
    if (!MediaCompressor.instance) {
      MediaCompressor.instance = new MediaCompressor();
    }
    return MediaCompressor.instance;
  }

  async requestMediaLibraryPermissions(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request media library permissions:', error);
      return false;
    }
  }

  async requestCameraPermissions(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request camera permissions:', error);
      return false;
    }
  }

  async pickImageFromLibrary(): Promise<string | null> {
    try {
      const hasPermission = await this.requestMediaLibraryPermissions();
      if (!hasPermission) {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri izni gereklidir.');
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.error('Failed to pick image from library:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken bir hata oluştu.');
      return null;
    }
  }

  async takePhotoWithCamera(): Promise<string | null> {
    try {
      const hasPermission = await this.requestCameraPermissions();
      if (!hasPermission) {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera izni gereklidir.');
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        return result.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.error('Failed to take photo:', error);
      Alert.alert('Hata', 'Fotoğraf çekilirken bir hata oluştu.');
      return null;
    }
  }

  async compressImage(
    imageUri: string,
    options: CompressionOptions = {}
  ): Promise<string> {
    try {
      const {
        maxWidth = 1024,
        maxHeight = 1024,
        quality = 0.8,
        maxSizeKB = 200,
        format = 'jpeg',
      } = options;

      // First, resize the image
      let manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: maxWidth,
              height: maxHeight,
            },
          },
        ],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      // Check file size and compress further if needed
      let currentSize = await this.getFileSize(manipulatedImage.uri);
      let currentQuality = quality;

      while (currentSize > maxSizeKB * 1024 && currentQuality > 0.1) {
        currentQuality -= 0.1;
        
        manipulatedImage = await ImageManipulator.manipulateAsync(
          imageUri,
          [
            {
              resize: {
                width: Math.floor(maxWidth * currentQuality),
                height: Math.floor(maxHeight * currentQuality),
              },
            },
          ],
          {
            compress: currentQuality,
            format: ImageManipulator.SaveFormat.JPEG,
          }
        );

        currentSize = await this.getFileSize(manipulatedImage.uri);
      }

      console.log(`Image compressed: ${currentSize} bytes (${Math.round(currentSize / 1024)} KB)`);
      return manipulatedImage.uri;
    } catch (error) {
      console.error('Failed to compress image:', error);
      throw error;
    }
  }

  async getFileSize(fileUri: string): Promise<number> {
    try {
      // In a real implementation, you would use react-native-fs to get file size
      // For now, we'll return a placeholder
      return 100000; // 100KB placeholder
    } catch (error) {
      console.error('Failed to get file size:', error);
      return 0;
    }
  }

  async showImagePicker(): Promise<string | null> {
    try {
      Alert.alert(
        'Fotoğraf Seç',
        'Fotoğrafı nereden seçmek istiyorsunuz?',
        [
          {
            text: 'İptal',
            style: 'cancel',
          },
          {
            text: 'Kamera',
            onPress: async () => {
              const photoUri = await this.takePhotoWithCamera();
              if (photoUri) {
                return await this.compressImage(photoUri);
              }
              return null;
            },
          },
          {
            text: 'Galeri',
            onPress: async () => {
              const imageUri = await this.pickImageFromLibrary();
              if (imageUri) {
                return await this.compressImage(imageUri);
              }
              return null;
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to show image picker:', error);
      return null;
    }
  }

  async compressImageForDamageReport(imageUri: string): Promise<string> {
    return await this.compressImage(imageUri, {
      maxWidth: 800,
      maxHeight: 600,
      quality: 0.7,
      maxSizeKB: 150,
      format: 'jpeg',
    });
  }

  async compressImageForHelpRequest(imageUri: string): Promise<string> {
    return await this.compressImage(imageUri, {
      maxWidth: 600,
      maxHeight: 400,
      quality: 0.6,
      maxSizeKB: 100,
      format: 'jpeg',
    });
  }

  async compressImageForResourcePost(imageUri: string): Promise<string> {
    return await this.compressImage(imageUri, {
      maxWidth: 400,
      maxHeight: 300,
      quality: 0.5,
      maxSizeKB: 50,
      format: 'jpeg',
    });
  }

  // Utility method to get image dimensions
  async getImageDimensions(imageUri: string): Promise<{ width: number; height: number } | null> {
    try {
      // In a real implementation, you would use expo-image-manipulator or similar
      // For now, return placeholder dimensions
      return { width: 1024, height: 768 };
    } catch (error) {
      console.error('Failed to get image dimensions:', error);
      return null;
    }
  }

  // Utility method to validate image file
  async validateImage(imageUri: string): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    try {
      const dimensions = await this.getImageDimensions(imageUri);
      if (!dimensions) {
        return {
          isValid: false,
          error: 'Geçersiz görüntü dosyası',
        };
      }

      const size = await this.getFileSize(imageUri);
      if (size > 10 * 1024 * 1024) { // 10MB limit
        return {
          isValid: false,
          error: 'Dosya boyutu çok büyük (max 10MB)',
        };
      }

      return { isValid: true };
    } catch (error) {
      console.error('Failed to validate image:', error);
      return {
        isValid: false,
        error: 'Görüntü doğrulanırken hata oluştu',
      };
    }
  }
}

// Export convenience function
export const compressImage = async (imageUri: string, options?: CompressionOptions): Promise<string> => {
  const compressor = MediaCompressor.getInstance();
  return await compressor.compressImage(imageUri, options);
};