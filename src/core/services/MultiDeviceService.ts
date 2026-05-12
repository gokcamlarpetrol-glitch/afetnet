/**
 * MULTI-DEVICE SERVICE
 *
 * Sprint 18-19: Multi-device support.
 *
 * Kullanici birden fazla cihazda ayni hesapla giris yaptiginda:
 *   - Sadece BIRINCIL cihaz SOS baslatabilir (kazara cifte SOS engellenir)
 *   - Diger cihazlar IKINCIL — SOS UI'i gizlenir veya disabled olur
 *   - Birincil cihaz secimi: kullanici Settings'ten manuel veya otomatik
 *     (en son aktif + en yuksek pil + en iyi konum dogrulugu)
 *
 * Senkronizasyon:
 *   - `users/{uid}/devices/{deviceId}` Firestore'da her cihaz kayitli
 *   - `users/{uid}/primaryDeviceId` alanı birincil cihazi belirtir
 *   - Cihaz onAuthStateChanged'de kendi deviceId'sini bu degerle karsilastirir
 *
 * Bu servis Sprint 18 tasarim skeleti olarak uretildi. Tam entegrasyon
 * (SOS UI gating, Settings UI for selection) ileride yapilacak.
 */

import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { getFirebaseAuth } from '../../lib/firebase';
import { getDeviceId } from '../utils/device';
import { DirectStorage } from '../utils/storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('MultiDeviceService');

const PRIMARY_DEVICE_STORAGE_KEY = '@afetnet:primary_device_id';

export interface DeviceRecord {
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  lastActiveAt: number;
  batteryLevel: number | null;
  isCurrentDevice?: boolean;
  isPrimary?: boolean;
}

class MultiDeviceService {
  private currentDeviceId: string | null = null;
  private primaryDeviceId: string | null = null;
  private isInitialized = false;
  private unsubscribePrimary: (() => void) | null = null;
  private listeners: Set<(isPrimary: boolean) => void> = new Set();

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    try {
      this.currentDeviceId = await getDeviceId();
      const cached = DirectStorage.getString(PRIMARY_DEVICE_STORAGE_KEY);
      if (cached) this.primaryDeviceId = cached;
      await this.subscribeToCloud();
      this.isInitialized = true;
      logger.info('MultiDeviceService initialized', {
        currentDeviceId: this.currentDeviceId?.substring(0, 8),
        primaryDeviceId: this.primaryDeviceId?.substring(0, 8),
        isPrimary: this.isPrimaryDevice(),
      });
    } catch (error) {
      logger.error('MultiDeviceService init failed:', error);
    }
  }

  async destroy(): Promise<void> {
    if (this.unsubscribePrimary) {
      this.unsubscribePrimary();
      this.unsubscribePrimary = null;
    }
    this.isInitialized = false;
  }

  /**
   * Su anki cihaz birincil mi?
   * Birden fazla cihazi olan kullanicilarda SOS aktivasyonu sadece bu cihazdan.
   * Tek-cihaz kullanicilarinda her zaman true.
   */
  isPrimaryDevice(): boolean {
    if (!this.primaryDeviceId) return true; // hic atanmamissa default primary
    return this.primaryDeviceId === this.currentDeviceId;
  }

  getCurrentDeviceId(): string | null {
    return this.currentDeviceId;
  }

  getPrimaryDeviceId(): string | null {
    return this.primaryDeviceId;
  }

  /**
   * Bu cihazi birincil yap (kullanici Settings'ten secer).
   */
  async setAsPrimary(): Promise<boolean> {
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!uid || !this.currentDeviceId) {
      logger.warn('Cannot set primary: not authenticated or no device ID');
      return false;
    }

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return false;

      await setDoc(
        doc(db, 'users', uid),
        {
          primaryDeviceId: this.currentDeviceId,
          primaryDeviceUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      this.primaryDeviceId = this.currentDeviceId;
      DirectStorage.setString(PRIMARY_DEVICE_STORAGE_KEY, this.currentDeviceId);
      this.notifyListeners();
      logger.info('This device set as primary', { deviceId: this.currentDeviceId.substring(0, 8) });
      return true;
    } catch (error) {
      logger.error('setAsPrimary failed:', error);
      return false;
    }
  }

  /**
   * Birincil cihaz degisikliklerini dinle.
   */
  subscribe(callback: (isPrimary: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // =========================================================================
  // PRIVATE
  // =========================================================================

  private async subscribeToCloud(): Promise<void> {
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!uid) return;

    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return;

      const userRef = doc(db, 'users', uid);
      this.unsubscribePrimary = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const newPrimaryId = typeof data.primaryDeviceId === 'string'
              ? data.primaryDeviceId
              : null;
            if (newPrimaryId !== this.primaryDeviceId) {
              const wasPrimary = this.isPrimaryDevice();
              this.primaryDeviceId = newPrimaryId;
              if (newPrimaryId) {
                DirectStorage.setString(PRIMARY_DEVICE_STORAGE_KEY, newPrimaryId);
              }
              const isPrimary = this.isPrimaryDevice();
              if (wasPrimary !== isPrimary) {
                logger.info(`Primary device changed: ${wasPrimary ? 'this' : 'other'} → ${isPrimary ? 'this' : 'other'}`);
                this.notifyListeners();
              }
            }
          }
        },
        (error) => {
          logger.warn('Primary device listener error:', error);
        },
      );
    } catch (error) {
      logger.warn('subscribeToCloud failed:', error);
    }
  }

  private notifyListeners(): void {
    const isPrimary = this.isPrimaryDevice();
    this.listeners.forEach((cb) => {
      try { cb(isPrimary); } catch (e) { logger.warn('listener error:', e); }
    });
  }

  private async getDoc(): Promise<DeviceRecord | null> {
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!uid || !this.currentDeviceId) return null;
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db) return null;
      const deviceDoc = await getDoc(doc(db, 'users', uid, 'devices', this.currentDeviceId));
      return deviceDoc.exists() ? (deviceDoc.data() as DeviceRecord) : null;
    } catch {
      return null;
    }
  }
}

export const multiDeviceService = new MultiDeviceService();
