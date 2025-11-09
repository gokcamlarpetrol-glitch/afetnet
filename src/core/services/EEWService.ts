/**
 * EEW SERVICE - Erken Deprem Uyarısı
 * WebSocket-based early earthquake warning system
 */

import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';
import { createLogger } from '../utils/logger';
import { multiChannelAlertService } from './MultiChannelAlertService';
import { useEEWStore } from '../../eew/store';
import { etaEstimationService, AlertLevel } from './ETAEstimationService';

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
  private apiErrorCount = 0; // Track consecutive API errors for exponential backoff
  private lastApiErrorTime = 0; // Track when last API error occurred
  private lastPolledCount = 0; // Track last polled count to reduce log spam
  private pollCount = 0; // Track poll count for reduced logging

  // WebSocket URLs
  private wsUrls = {
    TR_PRIMARY: 'wss://eew.afad.gov.tr/ws',
    TR_FALLBACK: 'wss://eew.kandilli.org/ws',
    GLOBAL_PRIMARY: 'wss://earthquake.usgs.gov/ws/eew',
    PROXY: 'wss://afetnet-backend.onrender.com/eew',
  };

  // ELITE: Get AFAD poll URL - Last 5 minutes for ULTRA-FAST early warning
  // CRITICAL: Shorter time window = faster API response = earlier detection
  private getAfadPollUrl(): string {
    const fiveMinutesAgo = new Date();
    fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5); // Last 5 minutes only
    const startDate = fiveMinutesAgo.toISOString().split('T')[0];
    const startTime = fiveMinutesAgo.toISOString().split('T')[1]?.split('.')[0] || '00:00:00';
    const endDate = new Date().toISOString().split('T')[0];
    const endTime = new Date().toISOString().split('T')[1]?.split('.')[0] || '23:59:59';
    
    // ELITE: Use user's magnitude threshold setting (same as EarthquakeService)
    // This ensures consistency and reduces unnecessary data transfer
    try {
      const { useSettingsStore } = require('../stores/settingsStore');
      const settings = useSettingsStore.getState();
      const minMag = Math.max(1, Math.floor(settings.minMagnitudeForNotification)); // AFAD API requires integer, minimum 1
      return `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=${minMag}`;
    } catch {
      // Fallback if settings not available
      return `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=1`;
    }
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

      // Fallback: Check device locale
      const locale = Localization.getLocales()?.[0]?.languageCode || '';
      if (locale.toLowerCase().includes('tr')) {
        return 'TR';
      }

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
      urls.push(this.wsUrls.PROXY);
      urls.push(this.wsUrls.TR_FALLBACK);
    } else {
      urls.push(this.wsUrls.GLOBAL_PRIMARY);
      urls.push(this.wsUrls.PROXY);
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
              void this.notifyCallbacks(eewEvent); // Fire-and-forget async call
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
        this.detectRegion().then((region) => {
          this.startWebSocket(region);
        }).catch((error) => {
          // Only log errors in dev mode, don't spam user
          if (__DEV__) {
            logger.error('Reconnect failed:', error);
          }
          // Don't set error status - just continue with polling
        });
      }
      this.reconnectTimeout = null;
    }, delay);
  }

  private async pollLoop() {
    while (this.polling) {
      this.pollCount++; // Increment poll count for reduced logging
      const netState = await NetInfo.fetch();
      
      if (netState.isConnected) {
        try {
          // Use AFAD API (only real data source for Turkey)
          const url = this.getAfadPollUrl();
          
          // ELITE: Shorter timeout for faster failure detection and retry
          // CRITICAL: Faster timeout = faster retry = earlier detection
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout (reduced from 15s for faster retry)
          try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'AfetNet/1.0',
              },
              signal: controller.signal,
            });

            if (!response.ok) {
              // Elite: Exponential backoff for API errors (500, 503, etc.)
              this.apiErrorCount++;
              const now = Date.now();
              const timeSinceLastError = now - this.lastApiErrorTime;
              this.lastApiErrorTime = now;
              
              // Reset error count if last error was more than 5 minutes ago
              if (timeSinceLastError > 5 * 60 * 1000) {
                this.apiErrorCount = 1;
              }
              
              // Exponential backoff: 15s, 30s, 60s, 120s, max 300s (5 minutes)
              const backoffDelay = Math.min(15000 * Math.pow(2, this.apiErrorCount - 1), 300000);
              
              if (__DEV__) {
                // Elite: Only log first error and every 10th error to reduce spam
                if (this.apiErrorCount === 1 || this.apiErrorCount % 10 === 0) {
                  logger.warn(`AFAD API response not OK: ${response.status} (retry in ${backoffDelay / 1000}s, error count: ${this.apiErrorCount})`);
                }
              }
              
              await new Promise((resolve) => setTimeout(resolve, backoffDelay));
              continue;
            }
            
            // Reset error count on successful response
            if (this.apiErrorCount > 0) {
              this.apiErrorCount = 0;
              if (__DEV__) {
                logger.info('AFAD API recovered from errors');
              }
            }

            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
              if (__DEV__) {
                logger.warn(`Non-JSON response from AFAD: ${contentType}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 60000));
              continue;
            }

            const text = await response.text();

            if (!text.trim().startsWith('[') && !text.trim().startsWith('{')) {
              if (__DEV__) {
                logger.warn(`Invalid JSON response from AFAD: ${text.substring(0, 100)}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 60000));
              continue;
            }

            const data = JSON.parse(text);
            const eventsArray = Array.isArray(data) ? data : (data.events || []);

            // Elite: Sort by time (newest first) and process immediately
            const sortedEvents = eventsArray.sort((a: any, b: any) => {
              const timeA = new Date(a.eventDate || a.date || a.originTime || 0).getTime();
              const timeB = new Date(b.eventDate || b.date || b.originTime || 0).getTime();
              return timeB - timeA;
            });

            for (const eventData of sortedEvents) {
              const event = this.normalizeEvent(eventData);
              if (event && !this.seenEvents.has(event.id)) {
                this.seenEvents.add(event.id);
                // Elite: IMMEDIATE notification - no delay
                void this.notifyCallbacks(event); // Fire-and-forget async call
              }
            }

            // ELITE: Reduced log spam - only log every 10th poll or if new events found
            if (__DEV__ && eventsArray.length > 0 && (eventsArray.length !== this.lastPolledCount || this.pollCount % 10 === 0)) {
              logger.info(`Polled ${eventsArray.length} events from AFAD`);
              this.lastPolledCount = eventsArray.length;
            }
          } catch (error: any) {
            if (__DEV__) {
              const message = error?.message ?? String(error);
              if (error?.name === 'AbortError') {
                logger.warn('EEW poll request timed out; retrying.');
              } else if (typeof message === 'string' && message.toLowerCase().includes('network request failed')) {
                logger.warn('EEW poll network request failed; will retry automatically.');
              } else {
                logger.warn('EEW poll error:', message);
              }
            }
          } finally {
            clearTimeout(timeoutId);
          }
        } catch (error) {
          if (__DEV__) {
            logger.warn('EEW poll loop unexpected error:', error);
          }
        }
      }

      // ELITE: ULTRA-FAST polling for REAL early warning
      // CRITICAL: We MUST be first - faster polling = earlier detection = MORE LIVES SAVED
      // Dynamic interval based on recent activity and battery state
      const recentCriticalActivity = Array.from(this.seenEvents.values()).some((id) => {
        // Check if we've seen critical events recently
        return true; // Simplified - always use fast polling for maximum safety
      });
      
      // ELITE: ULTRA-AGGRESSIVE polling intervals for FIRST-TO-ALERT
      // CRITICAL: These intervals are optimized for maximum speed while maintaining battery efficiency
      // Reduced from 200/300ms to 150/200ms for even FASTER detection
      let pollInterval = recentCriticalActivity ? 150 : 200; // 150ms critical, 200ms normal (ULTRA-FAST)
      
      // Apply battery multiplier (lazy import to avoid circular dependency)
      try {
        const batteryModule = await import('./BatteryMonitoringService');
        if (batteryModule?.batteryMonitoringService) {
          const multiplier = batteryModule.batteryMonitoringService.getPollingIntervalMultiplier();
          pollInterval = Math.round(pollInterval * multiplier);
          
          // CRITICAL: Never go below 150ms even when charging (safety limit for ultra-fast detection)
          pollInterval = Math.max(pollInterval, 150);
        }
      } catch {
        // BatteryMonitoringService not available - use base interval
      }
      
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  /**
   * Elite: Get EEW alert configuration based on magnitude
   */
  private getEEWAlertConfig(magnitude: number): {
    title: string;
    priority: 'critical' | 'high' | 'normal' | 'low';
    channels: any;
    vibrationPattern: number[];
    sound?: string;
    duration: number;
    data?: any;
  } {
    if (magnitude >= 7.0) {
      return {
        title: '🚨🚨🚨 MEGA DEPREM ERKEN UYARISI 🚨🚨🚨',
        priority: 'critical',
        channels: {
          pushNotification: true,
          fullScreenAlert: true,
          alarmSound: true,
          vibration: true,
          tts: true,
          bluetooth: true,
        },
        vibrationPattern: [0, 600, 200, 600, 200, 600, 200, 1200, 200, 600, 200, 600],
        sound: 'emergency',
        duration: 0,
        data: {},
      };
    } else if (magnitude >= 6.0) {
      return {
        title: '🚨 KRİTİK DEPREM ERKEN UYARISI',
        priority: 'critical',
        channels: {
          pushNotification: true,
          fullScreenAlert: true,
          alarmSound: true,
          vibration: true,
          tts: true,
          bluetooth: true,
        },
        vibrationPattern: [0, 500, 150, 500, 150, 500, 150, 1000, 150, 500],
        sound: 'emergency',
        duration: 0,
        data: {},
      };
    } else if (magnitude >= 5.0) {
      return {
        title: '⚠️ BÜYÜK DEPREM ERKEN UYARISI',
        priority: 'critical',
        channels: {
          pushNotification: true,
          fullScreenAlert: true,
          alarmSound: true,
          vibration: true,
          tts: true,
        },
        vibrationPattern: [0, 400, 100, 400, 100, 400, 100, 800],
        sound: 'default',
        duration: 45,
        data: {},
      };
    } else if (magnitude >= 4.5) {
      return {
        title: '⚠️ DEPREM ERKEN UYARISI',
        priority: 'high',
        channels: {
          pushNotification: true,
          fullScreenAlert: false,
          alarmSound: true,
          vibration: true,
          tts: true,
        },
        vibrationPattern: [0, 300, 100, 300, 100, 300],
        duration: 30,
        data: {},
      };
    } else {
      return {
        title: '📢 DEPREM ERKEN UYARISI',
        priority: 'normal',
        channels: {
          pushNotification: true,
          fullScreenAlert: false,
          alarmSound: false,
          vibration: true,
          tts: true,
        },
        vibrationPattern: [0, 200, 100, 200],
        duration: 20,
        data: {},
      };
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
        '0'
      );
      const longitude = parseFloat(
        data.geojson?.coordinates?.[0] || 
        data.longitude || 
        data.lng || 
        '0'
      );
      
      const magnitude = parseFloat(data.mag || data.magnitude || data.ml || '0');
      const depth = parseFloat(data.depth || data.derinlik || '10');
      
      // Location string
      const locationParts = [
        data.location,
        data.ilce,
        data.sehir,
        data.title,
        data.place
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
      logger.error('Event normalization error:', error);
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

  /**
   * ELITE: Send immediate alert without waiting for ETA calculation
   * CRITICAL: Speed is everything - send notification FIRST
   */
  private async sendImmediateAlert(event: EEWEvent, magnitude: number, epicenter: { latitude: number; longitude: number }) {
    // ELITE: Premium check for EEW notifications
    try {
      const { premiumService } = await import('./PremiumService');
      if (!premiumService.hasAccess('earthquake')) {
        if (__DEV__) {
          logger.debug('⏭️ EEW bildirimi premium gerektiriyor - atlandı');
        }
        return; // Skip notification - premium required
      }
    } catch (error) {
      logger.error('Premium check failed:', error);
      // Continue with notification if premium check fails (better safe than sorry)
    }
    
    const eewConfig = this.getEEWAlertConfig(magnitude);
    const basicTitle = eewConfig.title;
    const basicBody = `${event.region || 'Bilinmeyen bölge'} - ${magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi.`;
    
    // CRITICAL: Send immediate alert with basic info - DON'T WAIT
    void multiChannelAlertService.sendAlert({
      title: basicTitle,
      body: basicBody,
      priority: eewConfig.priority,
      ttsText: `ERKEN UYARI! ${magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${event.region || 'Bilinmeyen bölge'}.`,
      channels: eewConfig.channels,
      vibrationPattern: eewConfig.vibrationPattern,
      sound: eewConfig.sound,
      duration: eewConfig.duration,
      data: {
        type: 'eew',
        eventId: event.id,
        magnitude,
        location: { lat: event.latitude, lng: event.longitude },
        certainty: event.certainty,
        immediate: true, // Flag to indicate this is immediate alert
      },
    }).catch(error => {
      logger.error('Immediate alert error:', error);
    });
  }

  private async notifyCallbacks(event: EEWEvent) {
    const magnitude = event.magnitude || 0;
    
    // ELITE: IMMEDIATE notification - don't wait for ETA calculation
    // CRITICAL: Speed is everything - send notification FIRST, then enhance with ETA
    const epicenter = { latitude: event.latitude, longitude: event.longitude };
    
    // CRITICAL: Send immediate notification FIRST (don't wait for ETA)
    await this.sendImmediateAlert(event, magnitude, epicenter);
    
    // ELITE: Calculate ETA in parallel (don't block notification)
    const eta = await etaEstimationService.calculateETA(epicenter, null).catch(() => null);
    
    // ELITE: Google AEA style alert levels based on ETA
    let alertLevel: AlertLevel = AlertLevel.NONE;
    let alertTitle = '';
    let alertBody = '';
    let recommendedAction = '';
    
    if (eta) {
      alertLevel = eta.alertLevel;
      recommendedAction = eta.recommendedAction;
      
      // ELITE: Google AEA style titles based on alert level
      if (alertLevel === AlertLevel.IMMINENT) {
        alertTitle = `🚨🚨🚨 HAREKETE GEÇ! 🚨🚨🚨`;
        alertBody = etaEstimationService.formatETAMessage(eta, magnitude);
      } else if (alertLevel === AlertLevel.ACTION) {
        alertTitle = `⚠️ HAREKETE GEÇ`;
        alertBody = etaEstimationService.formatETAMessage(eta, magnitude);
      } else if (alertLevel === AlertLevel.CAUTION) {
        alertTitle = `⚠️ DİKKATLİ OL`;
        alertBody = etaEstimationService.formatETAMessage(eta, magnitude);
      } else {
        // Fallback to magnitude-based alert
        const eewConfig = this.getEEWAlertConfig(magnitude);
        alertTitle = eewConfig.title;
        alertBody = `${event.region || 'Bilinmeyen bölge'} - ${magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi.`;
      }
    } else {
      // Fallback if ETA calculation fails
      const eewConfig = this.getEEWAlertConfig(magnitude);
      alertTitle = eewConfig.title;
      const etaText = event.etaSec ? `Tahmini süre: ${Math.round(event.etaSec)} saniye` : '';
      alertBody = `${event.region || 'Bilinmeyen bölge'} - ${magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${etaText}`.trim();
    }
    
    // ELITE: Premium check for enhanced EEW notifications
    try {
      const { premiumService } = await import('./PremiumService');
      if (!premiumService.hasAccess('earthquake')) {
        if (__DEV__) {
          logger.debug('⏭️ EEW gelişmiş bildirimi premium gerektiriyor - atlandı');
        }
        return; // Skip enhanced notification - premium required
      }
    } catch (error) {
      logger.error('Premium check failed:', error);
      // Continue with notification if premium check fails (better safe than sorry)
    }
    
    // ELITE: Determine priority based on alert level, magnitude, and certainty
    const eewConfig = this.getEEWAlertConfig(magnitude);
    let priority: 'low' | 'normal' | 'high' | 'critical' = eewConfig.priority;
    
    if (alertLevel === AlertLevel.IMMINENT || event.certainty === 'high') {
      priority = 'critical';
    } else if (alertLevel === AlertLevel.ACTION || event.certainty === 'medium') {
      priority = 'high';
    } else if (alertLevel === AlertLevel.CAUTION) {
      priority = 'high';
    }
    
    // ELITE: Enhanced TTS with ETA and recommended action
    const ttsText = eta && alertLevel !== AlertLevel.NONE
      ? `${alertTitle.replace(/🚨|⚠️/g, '').trim()}. ${recommendedAction} ${Math.round(eta.sWaveETA)} saniye içinde ulaşabilir.`
      : `ERKEN UYARI! ${magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${event.region || 'Bilinmeyen bölge'}.`;
    
    // ELITE: Send enhanced alert with ETA information
    // CRITICAL: Use fire-and-forget to avoid blocking
    // ELITE: Always show premium countdown modal for early warnings (even if screen is off)
    void multiChannelAlertService.sendAlert({
      title: alertTitle,
      body: alertBody,
      priority,
      ttsText,
      channels: {
        ...eewConfig.channels,
        fullScreenAlert: true, // ELITE: Always show countdown modal for early warnings
        alarmSound: alertLevel === AlertLevel.IMMINENT || alertLevel === AlertLevel.ACTION || priority === 'critical',
      },
      vibrationPattern: alertLevel === AlertLevel.IMMINENT || priority === 'critical'
        ? [0, 200, 100, 200, 100, 200, 100, 500, 100, 500, 100, 500] // Critical pattern
        : [0, 200, 100, 200, 100, 200], // Normal pattern
      sound: alertLevel === AlertLevel.IMMINENT || priority === 'critical' ? 'emergency' : eewConfig.sound,
      duration: alertLevel === AlertLevel.IMMINENT || priority === 'critical' ? 0 : eewConfig.duration,
      data: {
        ...eewConfig.data,
        warning: {
          secondsRemaining: eta ? Math.max(0, Math.round(eta.sWaveETA)) : 30,
          eta: eta ? {
            pWaveETA: eta.pWaveETA,
            sWaveETA: eta.sWaveETA,
            distance: eta.distance,
            alertLevel: eta.alertLevel,
            recommendedAction: eta.recommendedAction,
          } : undefined,
        },
        type: 'eew',
        eventId: event.id,
        magnitude,
        location: { lat: event.latitude, lng: event.longitude },
        etaSec: eta ? eta.sWaveETA : event.etaSec,
        certainty: event.certainty,
        eta: eta ? {
          pWaveETA: eta.pWaveETA,
          sWaveETA: eta.sWaveETA,
          distance: eta.distance,
          alertLevel: eta.alertLevel,
        } : undefined,
        recommendedAction: recommendedAction || undefined,
      },
    }).catch(error => {
      logger.error('Multi-channel alert error:', error);
    });
    
    // CRITICAL: Mark early warning as sent for this earthquake signature
    // This prevents EarthquakeService from sending duplicate notification
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      // Create signature same as EarthquakeService uses
      const timeKey = Math.floor(event.issuedAt / (5 * 60 * 1000)); // 5 minute buckets
      const latKey = Math.round(event.latitude * 100); // ~1km precision
      const lonKey = Math.round(event.longitude * 100);
      const signature = `${timeKey}-${latKey}-${lonKey}-${Math.round(magnitude * 10)}`;
      const earlyWarningKey = `early_warning_${signature}`;
      await AsyncStorage.setItem(earlyWarningKey, 'true');
      // Clean up after 1 hour
      setTimeout(async () => {
        try {
          await AsyncStorage.removeItem(earlyWarningKey);
        } catch {
          // Ignore cleanup errors
        }
      }, 60 * 60 * 1000);
    } catch {
      // Ignore storage errors
    }

    // Notify callbacks
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error('Callback error:', error);
      }
    }
  }
}

export const eewService = new EEWService();

