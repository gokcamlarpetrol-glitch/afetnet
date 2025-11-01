/**
 * EEW SERVICE - Erken Deprem Uyarısı
 * WebSocket-based early earthquake warning system
 */

import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import * as Localization from 'expo-localization';

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
    console.log('[EEWService] Starting...');

    // Check network
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      console.warn('[EEWService] No network connection');
      return;
    }

    // Detect region
    const region = await this.detectRegion();
    console.log('[EEWService] Detected region:', region);

    // Start WebSocket
    await this.startWebSocket(region);

    // Start polling as fallback
    if (!this.polling) {
      this.polling = true;
      this.pollLoop();
    }
  }

  stop() {
    console.log('[EEWService] Stopping...');
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.polling = false;
    this.reconnectAttempts = 0;
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
      console.error('[EEWService] Region detection failed:', error);
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
        console.log('[EEWService] Connecting to:', url);
        
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('[EEWService] WebSocket connected');
          this.reconnectAttempts = 0;
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eewEvent = this.normalizeEvent(data);
            
            if (eewEvent && !this.seenEvents.has(eewEvent.id)) {
              this.seenEvents.add(eewEvent.id);
              this.notifyCallbacks(eewEvent);
            }
          } catch (error) {
            console.error('[EEWService] Message parse error:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[EEWService] WebSocket error:', error);
        };

        this.ws.onclose = () => {
          console.log('[EEWService] WebSocket closed');
          this.ws = null;
          this.handleReconnect();
        };

        // Successfully connected
        break;
      } catch (error) {
        console.error('[EEWService] WebSocket connection failed:', error);
        this.ws = null;
      }
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[EEWService] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`[EEWService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.detectRegion().then((region) => {
        this.startWebSocket(region);
      });
    }, delay);
  }

  private async pollLoop() {
    while (this.polling) {
      const netState = await NetInfo.fetch();
      
      if (netState.isConnected) {
        for (const url of this.pollUrls) {
          try {
            const response = await fetch(url);
            const data = await response.json();
            const events = this.normalizeEvents(data);

            for (const event of events) {
              if (!this.seenEvents.has(event.id)) {
                this.seenEvents.add(event.id);
                this.notifyCallbacks(event);
              }
            }
          } catch (error) {
            console.error('[EEWService] Poll error:', error);
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
      console.error('[EEWService] Event normalization error:', error);
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
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('[EEWService] Callback error:', error);
      }
    }
  }
}

export const eewService = new EEWService();

