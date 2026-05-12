/**
 * SENTRY SERVICE — Real Crash Reporting Adapter
 *
 * Köprüsel adapter: @sentry/react-native paketinin opsiyonel kullanımı.
 * Paket kurulu DEĞİLSE no-op çalışır (hiçbir şey kırılmaz, build engellemez).
 * Paket kurulu VE SENTRY_DSN env varsa init eder ve crash'leri Sentry'ye yollar.
 *
 * KURULUM (Sprint 1A finalize için):
 *   1. npx expo install @sentry/react-native
 *   2. app.config.ts → plugins: ['@sentry/react-native/expo']
 *   3. eas.json + .env → SENTRY_DSN, SENTRY_AUTH_TOKEN
 *   4. EAS build (native rebuild gerekir)
 *   5. Sentry dashboard'ta proje aç: https://sentry.io
 *
 * Bu adapter mevcut FirebaseCrashlyticsService ile ÇİFT yazım için tasarlandı:
 * yerel queue (offline diagnostic) + Sentry (remote aggregation).
 */

import { createLogger } from '../utils/logger';
import { Platform } from 'react-native';

const logger = createLogger('SentryService');

// Sentry SDK shape (we don't depend on the package directly to allow no-op fallback)
interface SentrySDK {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: Record<string, unknown>) => string | undefined;
  captureMessage: (message: string, level?: string) => string | undefined;
  setUser: (user: { id?: string | null } | null) => void;
  setTag: (key: string, value: string) => void;
  setContext: (name: string, context: Record<string, unknown>) => void;
  withScope: (callback: (scope: unknown) => void) => void;
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void;
  flush: (timeout?: number) => Promise<boolean>;
}

class SentryService {
  private sdk: SentrySDK | null = null;
  private isInitialized = false;
  private isAvailable = false;

  /**
   * Initialize Sentry if @sentry/react-native is installed and DSN is configured.
   * Falls back to no-op silently if either is missing.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Dynamic require to avoid hard dependency on @sentry/react-native.
      // Using string identifier to bypass type resolution (package may not be installed).
      const SentryModule = (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
          const req: NodeRequire = require;
          return req('@sentry/react-native');
        } catch {
          return null;
        }
      })();

      if (!SentryModule || typeof SentryModule.init !== 'function') {
        if (__DEV__) {
          logger.debug('Sentry SDK not installed (no-op mode). Run: npx expo install @sentry/react-native');
        }
        this.isInitialized = true; // mark initialized to skip repeated attempts
        return;
      }

      // Read DSN from env (expo-constants or process.env)
      const dsn = this.resolveDsn();
      if (!dsn) {
        if (__DEV__) {
          logger.warn('Sentry DSN not configured (set SENTRY_DSN in env). Skipping init.');
        }
        this.isInitialized = true;
        return;
      }

      SentryModule.init({
        dsn,
        environment: __DEV__ ? 'development' : 'production',
        tracesSampleRate: __DEV__ ? 1.0 : 0.1,        // 10% in production
        profilesSampleRate: __DEV__ ? 1.0 : 0.1,
        attachStacktrace: true,
        enableAutoSessionTracking: true,
        enableNativeCrashHandling: true,
        enableNativeNagger: false,
        debug: __DEV__,
        // PII REDACTION: AfetNet contains health/SOS data — never send personal info
        sendDefaultPii: false,
        beforeSend: (event: Record<string, unknown>) => {
          return this.redactPii(event);
        },
        ignoreErrors: [
          // Known noise from external SDKs we cannot fix
          'Network request failed',
          'Non-Error promise rejection captured',
        ],
      });

      this.sdk = SentryModule;
      this.isAvailable = true;
      this.isInitialized = true;
      logger.info('Sentry initialized', { environment: __DEV__ ? 'development' : 'production', platform: Platform.OS });
    } catch (error) {
      logger.error('Sentry initialization failed (falling back to no-op):', error);
      this.isInitialized = true;
    }
  }

  /**
   * Send an exception to Sentry. No-op if Sentry not available.
   */
  captureException(error: Error, context?: Record<string, unknown>): void {
    if (!this.isAvailable || !this.sdk) return;
    try {
      this.sdk.withScope((scope: unknown) => {
        if (context && scope && typeof (scope as { setContext?: unknown }).setContext === 'function') {
          (scope as { setContext: (name: string, ctx: Record<string, unknown>) => void }).setContext(
            'extra',
            this.redactObject(context),
          );
        }
        this.sdk?.captureException(error);
      });
    } catch (e) {
      logger.error('Sentry captureException failed:', e);
    }
  }

  /**
   * Set the current user id (Firebase UID hash, never PII).
   */
  setUser(userId: string | null): void {
    if (!this.isAvailable || !this.sdk) return;
    try {
      this.sdk.setUser(userId ? { id: userId } : null);
    } catch (e) {
      logger.error('Sentry setUser failed:', e);
    }
  }

  /**
   * Add a breadcrumb (debug trail) for crash context.
   */
  addBreadcrumb(message: string, category: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (!this.isAvailable || !this.sdk) return;
    try {
      this.sdk.addBreadcrumb({ message, category, level, timestamp: Date.now() / 1000 });
    } catch {
      /* no-op */
    }
  }

  /**
   * Flush pending events (call on shutdown).
   */
  async flush(timeoutMs = 2000): Promise<void> {
    if (!this.isAvailable || !this.sdk) return;
    try {
      await this.sdk.flush(timeoutMs);
    } catch {
      /* no-op */
    }
  }

  isReady(): boolean {
    return this.isAvailable;
  }

  // =========================================================================
  // PRIVATE
  // =========================================================================

  private resolveDsn(): string | null {
    try {
      // 1) process.env (EAS Build secret)
      if (typeof process !== 'undefined' && process.env?.SENTRY_DSN) {
        return process.env.SENTRY_DSN;
      }
      // 2) expo-constants extras
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Constants = require('expo-constants').default;
      const extra = Constants?.expoConfig?.extra ?? Constants?.manifest?.extra;
      if (typeof extra?.SENTRY_DSN === 'string') return extra.SENTRY_DSN;
      if (typeof extra?.sentryDsn === 'string') return extra.sentryDsn;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Strip PII from Sentry event before transmission.
   * AfetNet contains health/location/SOS data which must never leave the device
   * to a third party without explicit consent.
   */
  private redactPii(event: Record<string, unknown>): Record<string, unknown> {
    try {
      // Drop request body (may contain message content / location)
      if (event.request && typeof event.request === 'object') {
        const req = event.request as Record<string, unknown>;
        delete req.data;
        delete req.cookies;
        delete req.headers;
      }
      // Drop user PII fields
      if (event.user && typeof event.user === 'object') {
        const user = event.user as Record<string, unknown>;
        delete user.email;
        delete user.username;
        delete user.ip_address;
      }
      // Redact known sensitive context keys
      if (event.contexts && typeof event.contexts === 'object') {
        event.contexts = this.redactObject(event.contexts as Record<string, unknown>);
      }
      if (event.extra && typeof event.extra === 'object') {
        event.extra = this.redactObject(event.extra as Record<string, unknown>);
      }
      return event;
    } catch {
      return event;
    }
  }

  private redactObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      'password', 'token', 'secret', 'key', 'auth', 'credential', 'apikey',
      'email', 'phone', 'lat', 'lng', 'latitude', 'longitude',
      'bloodtype', 'allergies', 'medications', 'conditions',
      'message', 'content', 'body',
    ];
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (sensitiveKeys.some((sk) => lower.includes(sk))) {
        redacted[k] = '***REDACTED***';
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        redacted[k] = this.redactObject(v as Record<string, unknown>);
      } else {
        redacted[k] = v;
      }
    }
    return redacted;
  }
}

export const sentryService = new SentryService();
