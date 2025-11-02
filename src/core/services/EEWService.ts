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

  // WebSocket URLs
  private wsUrls = {
    TR_PRIMARY: 'wss://eew.afad.gov.tr/ws',
    TR_FALLBACK: 'wss://eew.kandilli.org/ws',
    GLOBAL_PRIMARY: 'wss://earthquake.usgs.gov/ws/eew',
    PROXY: 'wss://afetnet-backend.onrender.com/eew',
  };

  // Poll URLs
  private pollUrls = [
    'https://deprem.afad.gov.tr/EventService/GetEventsByFilter',
    'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=10',
  ];

  async start() {
    if (__DEV__) {
      logger.info('Starting...');
    }

    // Check network
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      if (__DEV__) {
        logger.warn('No network connection');
      }
      return;
    }

    // Detect region
    const region = await this.detectRegion();
    if (__DEV__) {
      logger.info(`Detected region: ${region}`);
    }

    // Set status to connecting
    useEEWStore.getState().setStatus('connecting');

    // Start WebSocket
    await this.startWebSocket(region);

    // Start polling as fallback
    if (!this.polling) {
      this.polling = true;
      this.pollLoop();
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
    
    // If all URLs fail
    const finalError = `All WebSocket connection attempts failed for region ${region}.`;
    logger.error(finalError);
    useEEWStore.getState().setStatus('error', finalError);
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnect attempts reached');
      return;
    }

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    if (__DEV__) {
      logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    }

    useEEWStore.getState().setStatus('connecting', `Reconnecting... (Attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      if (this.polling) {
        this.detectRegion().then((region) => {
          this.startWebSocket(region);
        }).catch((error) => {
          logger.error('Reconnect failed:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown reconnect error';
          useEEWStore.getState().setStatus('error', `Reconnect failed: ${errorMessage}`);
        });
      }
      this.reconnectTimeout = null;
    }, delay);
  }

  private async pollLoop() {
    while (this.polling) {
      const netState = await NetInfo.fetch();
      
      if (netState.isConnected) {
        for (const url of this.pollUrls) {
          try {
            const response = await fetch(url, {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'AfetNet/1.0',
              },
            });

            // Check if response is JSON
            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
              if (__DEV__) {
                logger.warn(`Non-JSON response from ${url}: ${contentType}`);
              }
              continue;
            }

            const text = await response.text();
            
            // Validate JSON before parsing
            if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
              if (__DEV__) {
                logger.warn(`Invalid JSON response from ${url}: ${text.substring(0, 100)}`);
              }
              continue;
            }

            const data = JSON.parse(text);
            const events = this.normalizeEvents(data);

            for (const event of events) {
              if (!this.seenEvents.has(event.id)) {
                this.seenEvents.add(event.id);
                this.notifyCallbacks(event);
              }
            }
          } catch (error) {
            logger.error('Poll error:', error);
          }
        }
      }

      // Poll every 60 seconds
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }

  private normalizeEvent(data: any): EEWEvent | null {
    try {
      const id = data.id || data.eventId || data.code || String(Date.now());
      const latitude = parseFloat(data.lat ?? data.latitude);
      const longitude = parseFloat(data.lng ?? data.longitude);
      const magnitude = parseFloat(data.mag ?? data.magnitude ?? 0);
      const depth = parseFloat(data.depth ?? data.depth_km ?? 10);
      const issuedAt = data.ts || data.time || Date.now();
      const source = (data.src || data.source || 'AFAD').toUpperCase();

      if (isNaN(latitude) || isNaN(longitude)) {
        return null;
      }

      return {
        id: String(id),
        latitude,
        longitude,
        magnitude,
        depth,
        region: data.region || data.place || 'Unknown',
        source,
        issuedAt,
        etaSec: data.etaSec,
        certainty: data.certainty,
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

