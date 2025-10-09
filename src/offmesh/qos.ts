import * as Battery from 'expo-battery';
import * as Device from 'expo-device';
import { MsgType } from './types';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per minute
}

interface RateLimits {
  sos: number; // per minute
  chat: number;
  pos: number;
}

class QoSManager {
  private buckets = new Map<MsgType, TokenBucket>();
  private rateLimits: RateLimits = {
    sos: 1,    // 1 SOS per minute
    chat: 10,  // 10 chat messages per minute
    pos: 2,    // 2 position updates per minute
  };
  private batteryThreshold = 10; // percentage
  private lastBatteryCheck = 0;
  private lastBatteryLevel = 100;
  private isHighTemp = false;

  constructor() {
    this.initializeBuckets();
    this.startBatteryMonitoring();
  }

  private initializeBuckets(): void {
    Object.entries(this.rateLimits).forEach(([type, limit]) => {
      this.buckets.set(type as MsgType, {
        tokens: limit,
        lastRefill: Date.now(),
        capacity: limit,
        refillRate: limit,
      });
    });
  }

  private startBatteryMonitoring(): void {
    // Check battery level every 30 seconds
    setInterval(async () => {
      try {
        const batteryLevel = await Battery.getBatteryLevelAsync();
        this.lastBatteryLevel = Math.round(batteryLevel * 100);
        this.lastBatteryCheck = Date.now();
        
        // Check for high temperature (simulated)
        this.checkTemperature();
      } catch (error) {
        console.warn('Battery monitoring failed:', error);
      }
    }, 30000);
  }

  private async checkTemperature(): Promise<void> {
    try {
      // Simulate temperature check (expo-device doesn't have direct temp API)
      // In real implementation, you'd use device-specific APIs
      const isHighTemp = Math.random() < 0.05; // 5% chance of high temp
      this.isHighTemp = isHighTemp;
      
      if (isHighTemp) {
        console.warn('High temperature detected, reducing mesh activity');
      }
    } catch (error) {
      console.warn('Temperature check failed:', error);
    }
  }

  // Check if message can be sent based on rate limits
  canSend(type: MsgType): boolean {
    const bucket = this.buckets.get(type);
    if (!bucket) {
      return false;
    }

    // Refill tokens based on time elapsed
    this.refillBucket(bucket);

    return bucket.tokens >= 1;
  }

  // Consume a token for sending
  consumeToken(type: MsgType): boolean {
    const bucket = this.buckets.get(type);
    if (!bucket) {
      return false;
    }

    this.refillBucket(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = (timeElapsed / 60000) * bucket.refillRate; // per minute
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  // Check if mesh should be active based on battery and temperature
  shouldActivateMesh(): boolean {
    // Check battery level
    if (this.lastBatteryLevel <= this.batteryThreshold) {
      console.warn(`Battery low (${this.lastBatteryLevel}%), mesh discovery only`);
      return false;
    }

    // Check temperature
    if (this.isHighTemp) {
      console.warn('High temperature, mesh discovery only');
      return false;
    }

    return true;
  }

  // Check if bulk operations should be limited
  shouldLimitBulkOperations(): boolean {
    return this.lastBatteryLevel <= this.batteryThreshold || this.isHighTemp;
  }

  // Get time until next token is available
  getTimeUntilNextToken(type: MsgType): number {
    const bucket = this.buckets.get(type);
    if (!bucket) {
      return 0;
    }

    this.refillBucket(bucket);

    if (bucket.tokens >= 1) {
      return 0;
    }

    const tokensNeeded = 1 - bucket.tokens;
    const timeNeeded = (tokensNeeded / bucket.refillRate) * 60000; // milliseconds
    
    return Math.ceil(timeNeeded);
  }

  // Get current status
  getStatus(): {
    batteryLevel: number;
    isHighTemp: boolean;
    canActivateMesh: boolean;
    rateLimits: Record<MsgType, { tokens: number; capacity: number; timeUntilNext: number }>;
  } {
    const rateLimits: Record<MsgType, { tokens: number; capacity: number; timeUntilNext: number }> = {} as any;
    
    for (const [type, bucket] of this.buckets.entries()) {
      this.refillBucket(bucket);
      rateLimits[type] = {
        tokens: Math.floor(bucket.tokens),
        capacity: bucket.capacity,
        timeUntilNext: this.getTimeUntilNextToken(type),
      };
    }

    return {
      batteryLevel: this.lastBatteryLevel,
      isHighTemp: this.isHighTemp,
      canActivateMesh: this.shouldActivateMesh(),
      rateLimits,
    };
  }

  // Update rate limits
  updateRateLimits(limits: Partial<RateLimits>): void {
    this.rateLimits = { ...this.rateLimits, ...limits };
    this.initializeBuckets();
  }

  // Set battery threshold
  setBatteryThreshold(threshold: number): void {
    this.batteryThreshold = Math.max(0, Math.min(100, threshold));
  }
}

// Singleton instance
export const qosManager = new QoSManager();



