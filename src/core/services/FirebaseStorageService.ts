/**
 * FIREBASE STORAGE SERVICE
 * File upload/download for profile images, SOS attachments, etc.
 * CRITICAL: Lazy imports to prevent module loading errors
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('FirebaseStorage');

// CRITICAL: Lazy load Firebase modules to prevent module loading errors
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let storage: any = null;

async function getFirebaseAppAsync() {
  try {
    const firebaseModule = await import('../../lib/firebase');
    return firebaseModule.getFirebaseAppAsync ? await firebaseModule.getFirebaseAppAsync() : null;
  } catch (error) {
    if (__DEV__) {
      logger.debug('Firebase app not available:', error);
    }
    return null;
  }
}

async function getStorageInstance() {
  if (!storage) {
    try {
      // CRITICAL: Lazy load Firebase Storage module
      const { getStorage } = await import('firebase/storage');
      const firebaseApp = await getFirebaseAppAsync();
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
      const firebaseApp = await getFirebaseAppAsync();
      if (!firebaseApp) {
        logger.warn('Firebase app not initialized - Storage disabled');
        return;
      }

      const storageInstance = await getStorageInstance();
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
    metadata?: { contentType?: string; customMetadata?: Record<string, string> },
  ): Promise<string | null> {
    if (!this._isInitialized) {
      logger.warn('FirebaseStorageService not initialized');
      return null;
    }

    try {
      const storageInstance = await getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return null;
      }

      // CRITICAL: Lazy load Firebase Storage functions
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
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
      const storageInstance = await getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return null;
      }

      // CRITICAL: Lazy load Firebase Storage functions
      const { ref, getDownloadURL } = await import('firebase/storage');
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
      const storageInstance = await getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return false;
      }

      // CRITICAL: Lazy load Firebase Storage functions
      const { ref, deleteObject } = await import('firebase/storage');
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
      const storageInstance = await getStorageInstance();
      if (!storageInstance) {
        logger.warn('Storage not available');
        return [];
      }

      // CRITICAL: Lazy load Firebase Storage functions
      const { ref, listAll } = await import('firebase/storage');
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

