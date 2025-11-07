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

  // WebSocket URLs
  private wsUrls = {
    TR_PRIMARY: 'wss://eew.afad.gov.tr/ws',
    TR_FALLBACK: 'wss://eew.kandilli.org/ws',
    GLOBAL_PRIMARY: 'wss://earthquake.usgs.gov/ws/eew',
    PROXY: 'wss://afetnet-backend.onrender.com/eew',
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
              this.notifyCallbacks(eewEvent);
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
      const netState = await NetInfo.fetch();
      
      if (netState.isConnected) {
        try {
          // Use AFAD API (only real data source for Turkey)
          const url = this.getAfadPollUrl();
          
          // Create AbortController for timeout (AbortSignal.timeout not available in React Native)
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
          try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'AfetNet/1.0',
              },
              signal: controller.signal,
            });

            if (!response.ok) {
              if (__DEV__) {
                logger.warn(`AFAD API response not OK: ${response.status}`);
              }
              await new Promise((resolve) => setTimeout(resolve, 60000));
              continue;
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

            for (const eventData of eventsArray) {
              const event = this.normalizeEvent(eventData);
              if (event && !this.seenEvents.has(event.id)) {
                this.seenEvents.add(event.id);
                this.notifyCallbacks(event);
              }
            }

            if (__DEV__ && eventsArray.length > 0) {
              logger.info(`Polled ${eventsArray.length} events from AFAD`);
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

      // Poll every 60 seconds
      await new Promise((resolve) => setTimeout(resolve, 60000));
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

  private notifyCallbacks(event: EEWEvent) {
    // Trigger multi-channel alert
    const priority = event.certainty === 'high' ? 'critical' : 
                     event.certainty === 'medium' ? 'high' : 'normal';
    
    const magnitude = event.magnitude || 0;
    const etaText = event.etaSec ? `Tahmini süre: ${Math.round(event.etaSec)} saniye` : '';
    
    multiChannelAlertService.sendAlert({
      title: magnitude >= 6.0 ? '🚨 KRİTİK DEPREM UYARISI' : 
             magnitude >= 4.5 ? '⚠️ DEPREM UYARISI' : '📢 DEPREM UYARISI',
      body: `${event.region || 'Bilinmeyen bölge'} - ${magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${etaText}`.trim(),
      priority: priority as 'critical' | 'high' | 'normal' | 'low',
      ttsText: `Deprem uyarısı! ${magnitude.toFixed(1)} büyüklüğünde deprem tespit edildi. ${etaText}`.trim(),
      channels: {
        pushNotification: true,
        fullScreenAlert: magnitude >= 5.0,
        alarmSound: magnitude >= 4.5,
        vibration: true,
        led: magnitude >= 6.0,
        tts: true,
      },
      data: {
        type: 'eew',
        eventId: event.id,
        magnitude,
        location: { lat: event.latitude, lng: event.longitude },
      },
      duration: magnitude >= 6.0 ? 0 : 30, // Critical alerts stay until dismissed
    }).catch(error => {
      logger.error('Multi-channel alert error:', error);
    });

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

