/**
 * CLOCK SKEW SERVICE
 *
 * Cihazın saatinin sunucu saatinden ne kadar farklı olduğunu tespit eder.
 * Firestore rules ±5dk client timestamp tolere eder; bunun ötesindeki sapma
 * tüm Firestore yazımlarını sessizce reddeder (kullanıcı için kafa karıştırıcı:
 * "mesaj gönderilmiyor ama hata da yok" tablosu).
 *
 * Bu servis:
 *   1. App start'ta sunucu saati ile cihaz saati arasındaki farkı ölçer
 *   2. Periyodik (10dk) yeniden kontrol eder
 *   3. Skew > 5dk olursa banner emit eder (ClockSkewBanner abonesi)
 *
 * Sunucu saati: Firebase Functions HEAD response Date header (RFC 7231).
 * NTP yerine HTTP date kullanıyoruz — eşitlik kabaca 1-2sn doğrulukta yeter,
 * 5dk tolerance için fazlasıyla yeterli.
 */

import { DeviceEventEmitter, Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('ClockSkewService');

const SKEW_CHECK_ENDPOINT = 'https://europe-west1-afetnet.cloudfunctions.net/health'; // existing endpoint
const SKEW_FALLBACK_ENDPOINT = 'https://www.google.com/generate_204';
const SKEW_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes — matches Firestore rules
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export interface ClockSkewState {
  skewMs: number;          // server - device (positive = device is behind)
  isCritical: boolean;     // |skewMs| > SKEW_THRESHOLD_MS
  lastCheckedAt: number;
}

class ClockSkewService {
  private state: ClockSkewState | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;

  /**
   * Start periodic clock skew monitoring.
   */
  async start(): Promise<void> {
    if (this.timer) return;
    logger.info('Clock skew monitor starting');
    // Run first check soon (after init), then periodic
    setTimeout(() => { void this.check(); }, 5000);
    this.timer = setInterval(() => { void this.check(); }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state = null;
    logger.info('Clock skew monitor stopped');
  }

  /**
   * Manual check — useful for re-checking after user changes device time.
   */
  async check(): Promise<ClockSkewState | null> {
    if (this.isChecking) return this.state;
    this.isChecking = true;
    try {
      const serverTimeMs = await this.fetchServerTime();
      if (serverTimeMs === null) {
        logger.debug('Clock skew check skipped (no server time available)');
        return this.state;
      }

      const deviceTimeMs = Date.now();
      const skewMs = serverTimeMs - deviceTimeMs;
      const isCritical = Math.abs(skewMs) > SKEW_THRESHOLD_MS;

      const newState: ClockSkewState = {
        skewMs,
        isCritical,
        lastCheckedAt: Date.now(),
      };

      // Emit event only when state transition happens (critical changed)
      const wasCritical = this.state?.isCritical ?? false;
      this.state = newState;

      if (isCritical && !wasCritical) {
        logger.error('🕰️ CLOCK SKEW CRITICAL', {
          skewMinutes: (skewMs / 60000).toFixed(1),
          deviceTime: new Date(deviceTimeMs).toISOString(),
          serverTime: new Date(serverTimeMs).toISOString(),
        });
        DeviceEventEmitter.emit('CLOCK_SKEW_CRITICAL', newState);
      } else if (!isCritical && wasCritical) {
        logger.info('Clock skew recovered (within tolerance)');
        DeviceEventEmitter.emit('CLOCK_SKEW_RECOVERED', newState);
      } else if (Math.abs(skewMs) > 30000) {
        logger.warn(`Minor clock skew detected: ${(skewMs / 1000).toFixed(0)}s`);
      }

      return newState;
    } catch (error) {
      logger.error('Clock skew check failed:', error);
      return this.state;
    } finally {
      this.isChecking = false;
    }
  }

  getState(): ClockSkewState | null {
    return this.state;
  }

  // =========================================================================
  // PRIVATE
  // =========================================================================

  private async fetchServerTime(): Promise<number | null> {
    // Try primary endpoint (our own Cloud Function)
    const primary = await this.tryEndpoint(SKEW_CHECK_ENDPOINT);
    if (primary !== null) return primary;
    // Fallback to Google's stable endpoint
    return this.tryEndpoint(SKEW_FALLBACK_ENDPOINT);
  }

  private async tryEndpoint(url: string): Promise<number | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      // HEAD avoids body download — only need the Date header
      const res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
        // Avoid auth headers — we just want HTTP Date
        headers: { 'X-Clock-Probe': '1' },
      });
      clearTimeout(timeoutId);
      const dateHeader = res.headers.get('date') || res.headers.get('Date');
      if (!dateHeader) return null;
      const t = Date.parse(dateHeader);
      if (Number.isNaN(t)) return null;
      return t;
    } catch (error) {
      logger.debug(`Clock probe failed for ${url}:`, error);
      return null;
    }
  }
}

export const clockSkewService = new ClockSkewService();
