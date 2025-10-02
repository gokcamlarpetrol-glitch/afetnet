// EEW Event Types
export interface EEWLocalPWaveEvent {
  timestamp: number;
  strength: number;
  lat: number;
  lon: number;
  accuracy?: number;
  acceleration: {
    x: number;
    y: number;
    z: number;
    magnitude: number;
  };
  sta: number;
  lta: number;
}

export interface EEWClusterAlertEvent {
  timestamp: number;
  deviceCount: number;
  avgStrength: number;
  centerLat: number;
  centerLon: number;
  radius: number;
  etaSeconds?: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface EEWOfficialAlertEvent {
  timestamp: number;
  magnitude: number;
  epicenterLat: number;
  epicenterLon: number;
  originTime: number;
  etaSeconds: number;
  source: string;
  confidence: 'high' | 'very_high';
}

export interface EEWDetectionOptions {
  staMs?: number;
  ltaMs?: number;
  pThreshold?: number;
  minGapMs?: number;
  minAccelG?: number;
  updateIntervalMs?: number;
}

export class EventEmitter {
  private events: { [key: string]: Array<(...args: any[]) => void> } = {};

  on(event: string, listener: (...args: any[]) => void): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);

    // Return unsubscribe function
    return () => {
      this.off(event, listener);
    };
  }

  off(event: string, listener: (...args: any[]) => void): void {
    if (!this.events[event]) return;
    
    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    
    this.events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  once(event: string, listener: (...args: any[]) => void): () => void {
    const onceWrapper = (...args: any[]) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    
    return this.on(event, onceWrapper);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  listenerCount(event: string): number {
    return this.events[event]?.length || 0;
  }

  eventNames(): string[] {
    return Object.keys(this.events);
  }
}