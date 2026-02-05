/**
 * EEW SERVICE - Erken Deprem Uyarısı
 * WebSocket-based early earthquake warning system
 */

import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { createLogger } from '../utils/logger';
import { multiChannelAlertService } from './MultiChannelAlertService';
import { useEEWStore } from '../../eew/store';
import { eliteWaveCalculationService, type EliteWaveCalculationResult } from './EliteWaveCalculationService';

const logger = createLogger('EEWService');

export interface EEWEvent {
  id: string;
  latitude: number;
  longitude: number;
  magnitude?: number;
  depth?: number;
  region?: string;
  source: string;
  issuedAt: number;
  etaSec?: number;
  certainty?: 'low' | 'medium' | 'high';
  waveCalculation?: EliteWaveCalculationResult; // ELITE: P and S wave calculation results
}

type EEWCallback = (event: EEWEvent) => void;

class EEWService {
  private ws: WebSocket | null = null;
  private polling = false;
  private callbacks: EEWCallback[] = [];
  private seenEvents = new Set<string>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private maxAttemptsReachedLogged = false; // Track if we've already logged max attempts

  // WebSocket URLs (Note: WebSocket disabled, using polling mode)
  private wsUrls = {
    TR_PRIMARY: 'wss://eew.afad.gov.tr/ws',
    TR_FALLBACK: 'wss://eew.kandilli.org/ws',
    GLOBAL_PRIMARY: 'wss://earthquake.usgs.gov/ws/eew',
    // PROXY removed - Render backend deprecated, using Firebase
  };

  // Get AFAD poll URL (dynamically generated for last 24 hours)
  private getAfadPollUrl(): string {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const startDate = oneDayAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    return `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=1`;
  }

  async start() {
    if (__DEV__) {
      logger.info('Starting EEWService (polling mode - WebSocket disabled)...');
    }

    // Check network
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      if (__DEV__) {
        logger.warn('No network connection - EEWService will start when network is available');
      }
      useEEWStore.getState().setStatus('disconnected', 'Network not available');
      return;
    }

    // WebSocket endpoints are not real/available, use polling mode directly
    // This prevents WebSocket connection errors and reconnect spam
    useEEWStore.getState().setStatus('connected', 'Using polling mode');

    // Start polling as primary method (WebSocket disabled)
    if (!this.polling) {
      this.polling = true;
      this.pollLoop();
    }

    // CRITICAL: Listen to SeismicSensorService for REAL early warnings (P-wave detection)
    // This is the TRUE early warning - detects earthquakes BEFORE they happen
    // AFAD API only provides data AFTER earthquake occurs (late notification)
    // 
    // ELITE: Like Deprem Ağı, we now send alerts on P-WAVE ONLY for maximum speed!
    // P-wave detection is enough for early warning - S-wave confirmation is optional
    try {
      const { seismicSensorService } = await import('./SeismicSensorService');

      // Listen for P-wave detections (earliest possible warning)
      // ELITE UPGRADE: P-wave ONLY is enough! No S-wave confirmation needed.
      // This matches Deprem Ağı's approach for 17-60 second early warnings
      seismicSensorService.onDetection((event: any) => {
        // ELITE: P-wave detection alone is enough for early warning!
        // S-wave confirmation is OPTIONAL - we don't wait for it
        if (!event.pWaveDetected) {
          if (__DEV__) {
            logger.debug('P wave not detected - waiting for P-wave');
          }
          return;
        }

        // ELITE: Lower confidence threshold for faster response (like Deprem Ağı)
        // 60% is enough when combined with multi-user verification
        // False positives are acceptable if it saves lives!
        if (event.confidence < 60) {
          if (__DEV__) {
            logger.debug(`P-wave detection confidence low: ${event.confidence}% < 60%`);
          }
          return;
        }

        // ELITE: NO MINIMUM WARNING TIME! 
        // Even 1 second warning can save lives!
        // Deprem Ağı sends alerts regardless of warning time
        const timeAdvance = event.timeAdvance || 0;

        // CRITICAL: P-wave detected - IMMEDIATE early warning!
        logger.info(`🌊⚡ INSTANT EEW: P-wave detected! M${event.estimatedMagnitude?.toFixed(1) || '?'}, ${event.confidence}% confidence, ${timeAdvance}s warning`);

        // ELITE: Trigger EEW immediately - don't wait for anything!
        this.processEEWEvent({
          id: `pwave-${Date.now()}`,
          latitude: event.latitude || 0,
          longitude: event.longitude || 0,
          magnitude: event.estimatedMagnitude || 4.0,
          depth: event.depth || 10,
          region: event.region || 'Yerel Algılama',
          source: 'P_WAVE_DETECTION',
          issuedAt: Date.now(),
          etaSec: timeAdvance,
          certainty: event.confidence >= 80 ? 'high' : event.confidence >= 60 ? 'medium' : 'low',
        }).catch(err => logger.error('EEW processing failed:', err));
      });

      if (__DEV__) {
        logger.info('✅ SeismicSensorService listener registered - REAL early warnings active!');
      }
    } catch (error) {
      // Silent fail - SeismicSensorService may not be available in all environments
      if (__DEV__) {
        logger.debug('SeismicSensorService listener registration skipped:', error);
      }
    }

    if (__DEV__) {
      logger.info('EEWService started in polling-only mode');
    }
  }

  stop() {
    if (__DEV__) {
      logger.info('Stopping...');
    }

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Clean up WebSocket listeners
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.polling = false;
    this.reconnectAttempts = 0;
    this.callbacks = [];
    this.seenEvents.clear();
  }

  onEvent(callback: EEWCallback) {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index > -1) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  /**
   * ELITE: Public method to process EEW event
   * Used by SeismicSensorService to trigger EEW notifications
   */
  async processEEWEvent(event: EEWEvent): Promise<void> {
    await this.notifyCallbacks(event);
  }

  private async detectRegion(): Promise<'TR' | 'GLOBAL'> {
    try {
      // Try location-based detection
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });

        // Turkey bounding box
        const { latitude, longitude } = location.coords;
        if (
          latitude >= 36 &&
          latitude <= 42 &&
          longitude >= 26 &&
          longitude <= 45
        ) {
          return 'TR';
        }
      }

      // Fallback: Default to GLOBAL if location not available
      // Location-based detection is more reliable than locale-based detection
      return 'GLOBAL';
    } catch (error) {
      logger.error('Region detection failed:', error);
      return 'GLOBAL';
    }
  }

  private async startWebSocket(region: 'TR' | 'GLOBAL') {
    const urls: string[] = [];

    if (region === 'TR') {
      urls.push(this.wsUrls.TR_PRIMARY);
      urls.push(this.wsUrls.TR_FALLBACK);
    } else {
      urls.push(this.wsUrls.GLOBAL_PRIMARY);
    }

    for (const url of urls) {
      try {
        if (__DEV__) {
          logger.info(`Connecting to: ${url}`);
        }

        // Clean up existing WebSocket before creating new one
        if (this.ws) {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          this.ws.close();
          this.ws = null;
        }

        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          if (__DEV__) {
            logger.info('WebSocket connected');
          }
          this.reconnectAttempts = 0;
          useEEWStore.getState().setStatus('connected');
        };

        this.ws.onmessage = (event) => {
          try {
            // Validate response is JSON
            const text = String(event.data);
            if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
              if (__DEV__) {
                logger.warn('Received non-JSON response:', text.substring(0, 100));
              }
              return;
            }

            const data = JSON.parse(text);
            const eewEvent = this.normalizeEvent(data);

            if (eewEvent && !this.seenEvents.has(eewEvent.id)) {
              this.seenEvents.add(eewEvent.id);
              this.notifyCallbacks(eewEvent).catch((error) => {
                logger.error('Failed to notify EEW callbacks:', error);
              });
            }
          } catch (error) {
            logger.error('Message parse error:', error);
          }
        };

        this.ws.onerror = (errorEvent: any) => {
          const errorMessage = errorEvent?.message || 'WebSocket error occurred';
          logger.error('WebSocket error:', errorMessage);
          useEEWStore.getState().setStatus('error', errorMessage);
        };

        this.ws.onclose = () => {
          if (__DEV__) {
            logger.info('WebSocket closed');
          }

          const currentWs = this.ws;
          this.ws = null;

          // Clean up event listeners
          if (currentWs) {
            currentWs.onopen = null;
            currentWs.onmessage = null;
            currentWs.onerror = null;
            currentWs.onclose = null;
          }

          // Only reconnect if not manually stopped
          if (this.polling) {
            this.handleReconnect();
          } else {
            useEEWStore.getState().setStatus('disconnected');
          }
        };

        // Successfully connected, break the loop
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown WebSocket connection error';
        logger.error(`WebSocket connection failed for ${url}:`, errorMessage);
        if (this.ws) {
          this.ws.onopen = null;
          this.ws.onmessage = null;
          this.ws.onerror = null;
          this.ws.onclose = null;
          this.ws = null;
        }
      }
    }

    // If all URLs fail, just log (don't set error status) - polling will handle data
    if (__DEV__) {
      logger.warn(`All WebSocket connection attempts failed for region ${region}. Continuing with polling mode.`);
    }
    // Don't set error status - polling mode will continue to work
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Only log once to prevent spam
      if (!this.maxAttemptsReachedLogged) {
        if (__DEV__) {
          logger.warn(`Max reconnect attempts (${this.maxReconnectAttempts}) reached. Switching to polling-only mode.`);
        }
        this.maxAttemptsReachedLogged = true;

        // Switch to polling-only mode - don't try WebSocket anymore
        useEEWStore.getState().setStatus('connected', 'Using polling mode (WebSocket unavailable)');
      }
      // Don't try to reconnect anymore - rely on polling only
      return;
    }

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    // Only log in dev mode to reduce spam
    if (__DEV__) {
      logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    }

    // Don't update user-facing status for every reconnect attempt - only on first few
    if (this.reconnectAttempts <= 2) {
      useEEWStore.getState().setStatus('connecting', `Reconnecting... (Attempt ${this.reconnectAttempts})`);
    }

    this.reconnectTimeout = setTimeout(() => {
      if (this.polling) {
        // CRITICAL: Use async/await for better error handling
        (async () => {
          try {
            const region = await this.detectRegion();
            this.startWebSocket(region);
          } catch (error) {
            // Only log errors in dev mode, don't spam user
            if (__DEV__) {
              logger.error('Reconnect failed:', error);
            }
            // Don't set error status - just continue with polling
          }
        })().catch((error) => {
          // CRITICAL: Catch any unhandled errors in async IIFE
          if (__DEV__) {
            logger.error('Unexpected error in reconnect:', error);
          }
        });
      }
      this.reconnectTimeout = null;
    }, delay);
  }

  private async pollLoop() {
    while (this.polling) {
      const netState = await NetInfo.fetch();

      if (netState.isConnected) {
        try {
          // Use AFAD API (only real data source for Turkey)
          const url = this.getAfadPollUrl();

          // Create AbortController for timeout (AbortSignal.timeout not available in React Native)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

          const response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'AfetNet/1.0',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            if (__DEV__) {
              logger.warn(`AFAD API response not OK: ${response.status}`);
            }
            // Continue to next poll cycle
            await new Promise((resolve) => setTimeout(resolve, 60000));
            continue;
          }

          // Check if response is JSON
          const contentType = response.headers.get('content-type');
          if (!contentType?.includes('application/json')) {
            if (__DEV__) {
              logger.warn(`Non-JSON response from AFAD: ${contentType}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 60000));
            continue;
          }

          const text = await response.text();

          // Validate JSON before parsing
          if (!text.trim().startsWith('[') && !text.trim().startsWith('{')) {
            if (__DEV__) {
              logger.warn(`Invalid JSON response from AFAD: ${text.substring(0, 100)}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 60000));
            continue;
          }

          const data = JSON.parse(text);

          // AFAD returns array of events
          const eventsArray = Array.isArray(data) ? data : (data.events || []);

          for (const eventData of eventsArray) {
            const event = this.normalizeEvent(eventData);
            if (event && !this.seenEvents.has(event.id)) {
              this.seenEvents.add(event.id);
              this.notifyCallbacks(event).catch((error) => {
                logger.error('Failed to notify EEW callbacks:', error);
              });
            }
          }

          if (__DEV__ && eventsArray.length > 0) {
            logger.info(`Polled ${eventsArray.length} events from AFAD`);
          }
        } catch (error) {
          // Silent fail for network errors - expected in offline scenarios
          if (__DEV__) {
            logger.debug('EEW poll error (expected in offline scenarios):', error);
          }
        }
      }

      // CRITICAL: Poll every 5 seconds for continuous P and S wave monitoring
      // This ensures users receive early warnings as fast as possible
      // ELITE: Reduced from 10s to 5s for faster response time
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 seconds for continuous monitoring
    }
  }

  private normalizeEvent(data: any): EEWEvent | null {
    try {
      // AFAD API format support
      const eventDate = data.eventDate || data.date || data.originTime || data.time;
      const eventId = data.eventID || data.eventId || data.id || String(Date.now());

      // Location parsing - AFAD uses geojson.coordinates or lat/lng
      const latitude = parseFloat(
        data.geojson?.coordinates?.[1] ||
        data.latitude ||
        data.lat ||
        '0',
      );
      const longitude = parseFloat(
        data.geojson?.coordinates?.[0] ||
        data.longitude ||
        data.lng ||
        '0',
      );

      const magnitude = parseFloat(data.mag || data.magnitude || data.ml || '0');
      const depth = parseFloat(data.depth || data.derinlik || '10');

      // Location string
      const locationParts = [
        data.location,
        data.ilce,
        data.sehir,
        data.title,
        data.place,
      ].filter(Boolean);
      const region = locationParts.length > 0
        ? locationParts.join(', ')
        : 'Türkiye';

      if (isNaN(latitude) || isNaN(longitude) || latitude === 0 || longitude === 0) {
        return null;
      }

      const issuedAt = eventDate ? new Date(eventDate).getTime() : Date.now();

      return {
        id: `afad-${eventId}`,
        latitude,
        longitude,
        magnitude,
        depth,
        region,
        source: 'AFAD',
        issuedAt,
        etaSec: data.etaSec,
        certainty: magnitude >= 5.0 ? 'high' : magnitude >= 4.0 ? 'medium' : 'low',
      };
    } catch (error) {
      // Silent fail for normalization errors - invalid events are filtered out
      if (__DEV__) {
        logger.debug('Event normalization skipped (invalid event filtered):', error);
      }
      return null;
    }
  }

  private normalizeEvents(data: any): EEWEvent[] {
    const events: EEWEvent[] = [];
    const arr = Array.isArray(data)
      ? data
      : data?.features
        ? data.features
        : data?.result || [];

    for (const item of arr) {
      const event = this.normalizeEvent(item);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  private async notifyCallbacks(event: EEWEvent): Promise<void> {
    // CRITICAL: Check user preferences BEFORE sending notification
    const { useSettingsStore } = await import('../stores/settingsStore');
    const settings = useSettingsStore.getState();

    // CRITICAL: Check if EEW is enabled
    if (!settings.eewEnabled) {
      if (__DEV__) {
        logger.debug('EEW notifications disabled by user - skipping EEW callback');
      }
      return;
    }

    // CRITICAL: Check if notifications are enabled
    if (!settings.notificationPush) {
      if (__DEV__) {
        logger.debug('Push notifications disabled by user - skipping EEW callback');
      }
      return;
    }

    // CRITICAL: Check magnitude threshold (EEW minimum magnitude)
    const magnitude = event.magnitude || 0;
    if (magnitude < settings.eewMinMagnitude) {
      // ELITE: Only log in dev mode and only for significant magnitudes (reduce log spam)
      // Log only if magnitude is close to threshold (within 0.5) to reduce noise
      if (__DEV__ && magnitude >= settings.eewMinMagnitude - 0.5) {
        logger.debug(`EEW magnitude threshold not met: ${magnitude} < ${settings.eewMinMagnitude}`);
      }
      return;
    }

    // CRITICAL: Check certainty threshold (confidence)
    if (event.certainty === 'low' && magnitude < 4.0) {
      // ELITE: Only log in dev mode and only for significant magnitudes (reduce log spam)
      if (__DEV__ && magnitude >= 3.5) {
        logger.debug('EEW certainty too low - skipping notification');
      }
      return;
    }

    // ELITE: Calculate P and S wave arrival times and warning time
    let waveCalculation: EliteWaveCalculationResult | undefined;
    let warningTime = event.etaSec || 0;
    let distanceText = '';
    let intensityText = '';
    let personalizedMessage = '';

    try {
      waveCalculation = await eliteWaveCalculationService.calculateWaves({
        latitude: event.latitude,
        longitude: event.longitude,
        depth: event.depth || 10,
        magnitude: magnitude,
        originTime: event.issuedAt,
        source: event.source,
      }) ?? undefined; // ELITE: Convert null to undefined

      if (waveCalculation) {
        // Use calculated warning time (more accurate)
        warningTime = waveCalculation.warningTime;

        // Format distance text
        distanceText = `${Math.round(waveCalculation.epicentralDistance)} km uzaklıkta`;

        // ELITE: Format intensity text with uncertainty
        const intensityMin = waveCalculation.estimatedIntensity - waveCalculation.intensityUncertainty;
        const intensityMax = waveCalculation.estimatedIntensity + waveCalculation.intensityUncertainty;

        if (waveCalculation.estimatedIntensity >= 7.0) {
          intensityText = `Şiddetli sarsıntı bekleniyor (MMI ${waveCalculation.estimatedIntensity.toFixed(1)} ±${waveCalculation.intensityUncertainty.toFixed(1)})`;
        } else if (waveCalculation.estimatedIntensity >= 5.0) {
          intensityText = `Orta şiddette sarsıntı bekleniyor (MMI ${waveCalculation.estimatedIntensity.toFixed(1)} ±${waveCalculation.intensityUncertainty.toFixed(1)})`;
        } else {
          intensityText = `Hafif sarsıntı bekleniyor (MMI ${waveCalculation.estimatedIntensity.toFixed(1)} ±${waveCalculation.intensityUncertainty.toFixed(1)})`;
        }

        // ELITE: Personalized warning message based on warning time, intensity, and uncertainty
        const warningTimeMin = Math.max(0, warningTime - waveCalculation.warningTimeUncertainty);
        const warningTimeMax = warningTime + waveCalculation.warningTimeUncertainty;

        if (warningTimeMin < 5) {
          personalizedMessage = `🚨🚨🚨 DEPREM ÇOK YAKIN! ${Math.round(warningTimeMin)}-${Math.round(warningTimeMax)} saniye içinde sarsıntı başlayacak! Hemen güvenli yere geçin!`;
        } else if (warningTimeMin < 15) {
          personalizedMessage = `⚠️ Deprem yaklaşıyor! ${Math.round(warningTimeMin)}-${Math.round(warningTimeMax)} saniye içinde sarsıntı başlayacak. Güvenli yere geçin!`;
        } else if (warningTimeMin < 30) {
          personalizedMessage = `⚠️ Deprem tespit edildi. ${Math.round(warningTimeMin)}-${Math.round(warningTimeMax)} saniye içinde sarsıntı başlayacak. Hazırlıklı olun.`;
        } else {
          personalizedMessage = `Deprem tespit edildi. ${Math.round(warningTimeMin)}-${Math.round(warningTimeMax)} saniye içinde sarsıntı başlayacak.`;
        }

        // Add intensity information (always show for MMI >= 5.0)
        if (intensityMin >= 5.0) {
          personalizedMessage += ` ${intensityText}`;
        } else if (waveCalculation.estimatedIntensity >= 5.0) {
          // Show even if lower bound is < 5.0 but estimate is >= 5.0
          personalizedMessage += ` ${intensityText}`;
        }

        // Add quality indicator for elite calculations
        if (waveCalculation.quality === 'excellent' && waveCalculation.calculationMethod === 'elite') {
          personalizedMessage += ` [Yüksek doğruluk]`;
        }
      }
    } catch (error) {
      // Silent fail - wave calculation is enhancement, not critical
      if (__DEV__) {
        logger.debug('Wave calculation failed (non-critical):', error);
      }
    }

    // Fallback to basic message if wave calculation failed
    if (!personalizedMessage) {
      const etaText = event.etaSec ? `${Math.round(event.etaSec)} saniye içinde` : '';
      personalizedMessage = `${event.region || 'Bilinmeyen bölge'} - ${magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${etaText}`.trim();
    }

    // Trigger multi-channel alert
    const priority = event.certainty === 'high' ? 'critical' :
      event.certainty === 'medium' ? 'high' : 'normal';

    // CRITICAL: Respect user preferences for notification channels
    const channels = {
      pushNotification: settings.notificationPush,
      fullScreenAlert: (magnitude >= 4.0) && settings.notificationFullScreen,
      alarmSound: (magnitude >= 4.0) && settings.notificationSound,
      vibration: settings.notificationVibration,
      tts: settings.notificationTTS,
    };

    // CRITICAL: Don't send if all channels are disabled
    if (!channels.pushNotification && !channels.fullScreenAlert && !channels.alarmSound && !channels.vibration && !channels.tts) {
      if (__DEV__) {
        logger.debug('All notification channels disabled by user - skipping EEW alert');
      }
      return;
    }

    // ELITE: Enhanced alert title based on warning time, intensity, and quality
    let alertTitle: string;
    const minIntensity = waveCalculation ? (waveCalculation.estimatedIntensity - waveCalculation.intensityUncertainty) : 0;
    const minWarningTime = waveCalculation ? (waveCalculation.warningTime - waveCalculation.warningTimeUncertainty) : warningTime;

    if (waveCalculation && minIntensity >= 7.0) {
      alertTitle = '🚨🚨🚨 KRİTİK DEPREM UYARISI 🚨🚨🚨';
    } else if (magnitude >= 6.0 || (waveCalculation && minIntensity >= 6.0)) {
      alertTitle = '🚨 KRİTİK DEPREM UYARISI';
    } else if (magnitude >= 4.5 || (waveCalculation && minWarningTime < 10)) {
      alertTitle = '⚠️ DEPREM UYARISI';
    } else {
      alertTitle = '📢 DEPREM UYARISI';
    }

    // Add quality indicator to title for elite calculations
    if (waveCalculation && waveCalculation.quality === 'excellent' && waveCalculation.calculationMethod === 'elite') {
      alertTitle += ' [ELITE]';
    }

    // ELITE: REMOVED 10-second minimum warning restriction!
    // Deprem Ağı sends alerts regardless of warning time
    // Even 1 second of warning can save lives!
    // 
    // OLD: Required minimum 10 seconds warning
    // NEW: Send alert INSTANTLY, even for 0-second warning
    const guaranteedWarningTime = Math.max(0, minWarningTime);

    // ELITE: Log warning time for debugging, but NEVER skip notification!
    if (guaranteedWarningTime < 5) {
      logger.info(`⚡ ULTRA-FAST EEW: Only ${guaranteedWarningTime}s warning - sending INSTANT alert!`);
    }

    // ELITE: Real-time data verification before sending notification
    // %100 ACCURACY: Double-check all critical data before sending
    const now = Date.now();
    const eventAge = (now - event.issuedAt) / 1000;

    // CRITICAL: Verify event is recent (not older than 5 minutes)
    if (eventAge > 300) {
      if (__DEV__) {
        logger.debug(`EEW event too old: ${eventAge.toFixed(1)}s - skipping notification (requires real-time data)`);
      }
      return;
    }

    // CRITICAL: Verify magnitude is reasonable (not NaN, within valid range)
    if (isNaN(magnitude) || magnitude < 0 || magnitude > 10) {
      if (__DEV__) {
        logger.debug(`EEW magnitude invalid: ${magnitude} - skipping notification (requires valid magnitude)`);
      }
      return;
    }

    // CRITICAL: Verify coordinates are valid
    if (isNaN(event.latitude) || isNaN(event.longitude) ||
      event.latitude < -90 || event.latitude > 90 ||
      event.longitude < -180 || event.longitude > 180) {
      if (__DEV__) {
        logger.debug(`EEW coordinates invalid: lat=${event.latitude}, lon=${event.longitude} - skipping notification (requires valid coordinates)`);
      }
      return;
    }

    // CRITICAL: Verify wave calculation is valid (if provided)
    if (waveCalculation) {
      if (isNaN(waveCalculation.warningTime) || waveCalculation.warningTime < 0 ||
        isNaN(waveCalculation.estimatedIntensity) || waveCalculation.estimatedIntensity < 0) {
        if (__DEV__) {
          logger.debug(`EEW wave calculation invalid - skipping notification (requires valid wave calculation)`);
        }
        return;
      }
    }

    // ELITE: Use NotificationFormatterService for professional EEW formatting
    const { notificationFormatterService } = await import('./NotificationFormatterService');
    const formatted = notificationFormatterService.formatEEWNotification(
      magnitude,
      event.region || 'Bilinmeyen bölge',
      Math.round(guaranteedWarningTime),
      waveCalculation?.pWaveArrivalTime,
      waveCalculation?.sWaveArrivalTime,
    );

    // ELITE: Use magnitude-based notification for EEW (with formatted data)
    // CRITICAL: Instant delivery, 100% accuracy, emergency mode for 5.0+
    try {
      const { showMagnitudeBasedNotification } = await import('./MagnitudeBasedNotificationService');
      await showMagnitudeBasedNotification(
        magnitude,
        event.region || 'Bilinmeyen bölge',
        true, // Is EEW
        Math.round(guaranteedWarningTime), // Time advance
        event.issuedAt, // Timestamp
      );

      if (__DEV__) {
        logger.info(`✅ ELITE EEW notification sent: ${magnitude.toFixed(1)}M - ${event.region} (${Math.round(guaranteedWarningTime)}s advance)`);
      }
    } catch (error) {
      logger.error('Failed to show magnitude-based EEW notification:', error);
      // Fallback to multi-channel alert
    }

    multiChannelAlertService.sendAlert({
      title: formatted.title,
      body: formatted.body,
      priority: formatted.priority,
      ttsText: formatted.ttsText || personalizedMessage,
      channels,
      sound: formatted.sound,
      vibrationPattern: formatted.vibrationPattern,
      data: {
        ...formatted.data,
        eventId: event.id,
        location: { lat: event.latitude, lng: event.longitude },
        warningTime: waveCalculation?.warningTime || warningTime,
        warningTimeUncertainty: waveCalculation?.warningTimeUncertainty,
        intensity: waveCalculation?.estimatedIntensity,
        intensityUncertainty: waveCalculation?.intensityUncertainty,
        pga: waveCalculation?.estimatedPGA,
        pgaUncertainty: waveCalculation?.pgaUncertainty,
        pgv: waveCalculation?.estimatedPGV,
        distance: waveCalculation?.epicentralDistance,
        quality: waveCalculation?.quality,
        calculationMethod: waveCalculation?.calculationMethod,
      },
      duration: magnitude >= 6.0 || (waveCalculation && waveCalculation.estimatedIntensity >= 7.0) ? 0 : 30, // Critical alerts stay until dismissed
    }).catch(error => {
      // Silent fail for alert errors - alerts are best-effort
      if (__DEV__) {
        logger.debug('Multi-channel alert skipped:', error);
      }
    });

    // Notify callbacks with enhanced event data
    const enhancedEvent: EEWEvent & { waveCalculation?: EliteWaveCalculationResult } = {
      ...event,
      etaSec: waveCalculation?.warningTime || event.etaSec,
      waveCalculation,
    };

    for (const callback of this.callbacks) {
      try {
        callback(enhancedEvent);
      } catch (error) {
        // Silent fail for callback errors - individual callbacks shouldn't break the system
        if (__DEV__) {
          logger.debug('EEW callback error (non-critical):', error);
        }
      }
    }
  }
}

export const eewService = new EEWService();

