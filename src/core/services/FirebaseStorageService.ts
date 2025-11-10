/**
 * FIREBASE STORAGE SERVICE
 * File upload/download for profile images, SOS attachments, etc.
 */

import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import getFirebaseApp from '../../lib/firebase';
import { createLogger } from '../utils/logger';

const logger = createLogger('FirebaseStorage');

let storage: any = null;

function getStorageInstance() {
  if (!storage) {
    try {
      const firebaseApp = getFirebaseApp();
      if (!firebaseApp) {
        logger.warn('Firebase app not initialized');
        return null;
      }
      storage = getStorage(firebaseApp);
      logger.info('Firebase Storage instance created');
    } catch (error) {
      logger.error('Storage initialization error:', error);
    }
  }
  return storage;
}

class FirebaseStorageService {
  private _isInitialized = false;
  
  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize() {
    if (this._isInitialized) return;

    try {
      const firebaseApp = getFirebaseApp();
      if (!firebaseApp) {
        logger.warn('Firebase app not initialized - Storage disabled');
        return;
      }

      const storageInstance = getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return;
      }

      this._isInitialized = true;
      logger.info('FirebaseStorageService initialized successfully');
    } catch (error) {
      logger.error('FirebaseStorageService init error:', error);
    }
  }

  /**
   * Upload file to Firebase Storage
   */
  async uploadFile(
    path: string,
    file: Blob | Uint8Array | ArrayBuffer,
    metadata?: { contentType?: string; customMetadata?: Record<string, string> }
  ): Promise<string | null> {
    if (!this._isInitialized) {
      logger.warn('FirebaseStorageService not initialized');
      return null;
    }

    try {
      const storageInstance = getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return null;
      }

      const storageRef = ref(storageInstance, path);
      await uploadBytes(storageRef, file, metadata || {});
      
      const downloadURL = await getDownloadURL(storageRef);
      
      if (__DEV__) {
        logger.info(`File uploaded: ${path}`);
      }
      
      return downloadURL;
    } catch (error) {
      logger.error('Failed to upload file:', error);
      return null;
    }
  }

  /**
   * Get download URL for a file
   */
  async getDownloadURL(path: string): Promise<string | null> {
    if (!this._isInitialized) {
      logger.warn('FirebaseStorageService not initialized');
      return null;
    }

    try {
      const storageInstance = getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return null;
      }

      const storageRef = ref(storageInstance, path);
      const url = await getDownloadURL(storageRef);
      
      return url;
    } catch (error) {
      logger.error('Failed to get download URL:', error);
      return null;
    }
  }

  /**
   * Delete file from Firebase Storage
   */
  async deleteFile(path: string): Promise<boolean> {
    if (!this._isInitialized) {
      logger.warn('FirebaseStorageService not initialized');
      return false;
    }

    try {
      const storageInstance = getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return false;
      }

      const storageRef = ref(storageInstance, path);
      await deleteObject(storageRef);
      
      if (__DEV__) {
        logger.info(`File deleted: ${path}`);
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to delete file:', error);
      return false;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string): Promise<string[]> {
    if (!this._isInitialized) {
      logger.warn('FirebaseStorageService not initialized');
      return [];
    }

    try {
      const storageInstance = getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return [];
      }

      const storageRef = ref(storageInstance, path);
      const result = await listAll(storageRef);
      
      const files = result.items.map(item => item.fullPath);
      
      return files;
    } catch (error) {
      logger.error('Failed to list files:', error);
      return [];
    }
  }
}

export const firebaseStorageService = new FirebaseStorageService();

