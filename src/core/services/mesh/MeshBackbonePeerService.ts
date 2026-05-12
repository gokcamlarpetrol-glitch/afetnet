/**
 * MESH BACKBONE PEER SERVICE
 *
 * Sprint 16-17: Mesh hierarchy v2 — Backbone Peer + Leaf hiyerarsi.
 *
 * Problem: Klasik flooding mesh, paketleri TUM peer'lere relay eder. Bu
 * - Pil tuketimi yuksek (her cihaz her paketi rebroadcast)
 * - Bandwidth israfi (kalabalik sehirde paket patlamasi)
 * - Battery-dusuk cihazlar (enkaz altinda survivor!) yuksek yuk altinda kalir
 *
 * Cozum: Hibrit BACKBONE + LEAF mimari:
 *   - BACKBONE peer: yuksek pil + sabit konum + iyi BLE radyo → relay yapar
 *   - LEAF peer: dusuk pil + mobil → sadece kendi paketlerini gonderir, relay yapmaz
 *
 * Election kriterleri (rastgele degil, davranisa dayali):
 *   1. Battery level >= 50%
 *   2. Cihaz son 10 dakikadir hareketsiz (sabit konumda)
 *   3. Sosyal: cevresinde 3+ peer var (orta yogun bolge)
 *   4. Son 5 dakikada paket basarili rebroadcast etti
 *
 * Backbone secimi her cihaz tarafindan KENDI kararidir (decentralized).
 * Network'un tum cihazlari ayni metric'i hesaplar → otomatik konsensus.
 *
 * NOT: Bu servis tasarim skeleti olarak Sprint 17 icin uretildi.
 * MeshNetworkService'e fiili entegrasyon (relay karari verirken bu servisin
 * isBackbone() kullanilmasi) future-work olarak gerceklestirilmelidir.
 */

import { createLogger } from '../../utils/logger';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';

const logger = createLogger('MeshBackbonePeerService');

interface BackboneCriteria {
  batteryLevel: number;        // 0-1
  isCharging: boolean;
  isStationary: boolean;       // son 10dk hareketsiz mi?
  peerCount: number;           // gorulen peer sayisi
  relaySuccessRate: number;    // 0-1 (basarili relay orani)
}

const BACKBONE_BATTERY_THRESHOLD = 0.5;
const BACKBONE_BATTERY_THRESHOLD_CHARGING = 0.2; // sarjda iken esnek
const BACKBONE_MIN_PEERS = 2;
const BACKBONE_STATIONARY_DURATION_MS = 10 * 60 * 1000;
const RECHECK_INTERVAL_MS = 60 * 1000; // 1dk

class MeshBackbonePeerService {
  private currentMode: 'backbone' | 'leaf' | 'unknown' = 'unknown';
  private lastBatteryCheck: number = 0;
  private cachedBatteryLevel: number = 0.5;
  private cachedIsCharging: boolean = false;
  private lastLocation: { lat: number; lng: number; timestamp: number } | null = null;
  private isStationary: boolean = false;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private relayAttempts: number = 0;
  private relaySuccesses: number = 0;
  private listeners: Set<(mode: 'backbone' | 'leaf') => void> = new Set();

  async start(): Promise<void> {
    if (this.checkTimer) return;
    logger.info('MeshBackbonePeerService starting');
    await this.evaluate();
    this.checkTimer = setInterval(() => { void this.evaluate(); }, RECHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.currentMode = 'unknown';
    logger.info('MeshBackbonePeerService stopped');
  }

  /**
   * Bu cihaz su an backbone peer mi? (relay yapmali mi?)
   */
  isBackbone(): boolean {
    return this.currentMode === 'backbone';
  }

  /**
   * Su an leaf mode'da mi? (relay yapmamali mi?)
   */
  isLeaf(): boolean {
    return this.currentMode === 'leaf';
  }

  getMode(): 'backbone' | 'leaf' | 'unknown' {
    return this.currentMode;
  }

  /**
   * Relay attempt sonucunu kaydet (success rate hesaplama icin).
   */
  recordRelayAttempt(success: boolean): void {
    this.relayAttempts++;
    if (success) this.relaySuccesses++;
    // Sliding window: son 100 attempt'i tut
    if (this.relayAttempts > 100) {
      this.relayAttempts = 100;
      this.relaySuccesses = Math.round(this.relaySuccesses * 0.99);
    }
  }

  /**
   * Mode degisikliklerini dinle.
   */
  subscribe(callback: (mode: 'backbone' | 'leaf') => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Backbone secim kriterlerini degerlendir + mode'u guncelle.
   */
  private async evaluate(): Promise<void> {
    try {
      const criteria = await this.gatherCriteria();
      const shouldBeBackbone = this.shouldElectBackbone(criteria);
      const newMode = shouldBeBackbone ? 'backbone' : 'leaf';

      if (newMode !== this.currentMode) {
        logger.info(`Backbone mode transition: ${this.currentMode} → ${newMode}`, criteria);
        this.currentMode = newMode;
        this.notifyListeners(newMode);
      }
    } catch (error) {
      logger.warn('Backbone evaluation failed:', error);
    }
  }

  private async gatherCriteria(): Promise<BackboneCriteria> {
    // Battery (cached 1dk)
    const now = Date.now();
    if (now - this.lastBatteryCheck > 60_000) {
      try {
        this.cachedBatteryLevel = await Battery.getBatteryLevelAsync();
        const batteryState = await Battery.getBatteryStateAsync();
        this.cachedIsCharging =
          batteryState === Battery.BatteryState.CHARGING ||
          batteryState === Battery.BatteryState.FULL;
        this.lastBatteryCheck = now;
      } catch {
        // Fallback to cached value
      }
    }

    // Stationary detection
    try {
      const loc = await Location.getLastKnownPositionAsync();
      if (loc) {
        const newLoc = {
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          timestamp: now,
        };
        if (this.lastLocation) {
          const dist = haversineDistance(
            this.lastLocation.lat, this.lastLocation.lng,
            newLoc.lat, newLoc.lng,
          );
          const timeDelta = now - this.lastLocation.timestamp;
          // <50m hareket + >5dk gecti → stationary
          if (dist < 50 && timeDelta > 5 * 60 * 1000) {
            this.isStationary = true;
          } else if (dist > 100) {
            this.isStationary = false;
            this.lastLocation = newLoc;
          }
        } else {
          this.lastLocation = newLoc;
        }
      }
    } catch {
      // Location not available → assume mobile
    }

    // Peer count (dynamic import to avoid circular)
    let peerCount = 0;
    try {
      const { useMeshStore } = await import('./MeshStore');
      peerCount = useMeshStore.getState().peers.length;
    } catch {
      peerCount = 0;
    }

    return {
      batteryLevel: this.cachedBatteryLevel,
      isCharging: this.cachedIsCharging,
      isStationary: this.isStationary,
      peerCount,
      relaySuccessRate: this.relayAttempts > 0
        ? this.relaySuccesses / this.relayAttempts
        : 1.0, // baseline trust
    };
  }

  private shouldElectBackbone(c: BackboneCriteria): boolean {
    // Sarjda → daha esnek battery threshold
    const batteryThreshold = c.isCharging
      ? BACKBONE_BATTERY_THRESHOLD_CHARGING
      : BACKBONE_BATTERY_THRESHOLD;

    if (c.batteryLevel < batteryThreshold) return false;
    if (c.peerCount < BACKBONE_MIN_PEERS) return false; // izole — relay anlamsiz
    if (c.relaySuccessRate < 0.3) return false; // BLE radyosu zayif

    // Hareketsiz cihaz tercih edilir ama olmazsa olmaz degil
    return true;
  }

  private notifyListeners(mode: 'backbone' | 'leaf'): void {
    this.listeners.forEach((cb) => {
      try { cb(mode); } catch (e) { logger.warn('listener error:', e); }
    });
  }
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const meshBackbonePeerService = new MeshBackbonePeerService();
