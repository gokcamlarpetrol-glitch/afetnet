/**
 * CONTEXT BUILDER - Elite AI Enhancement
 * Builds context for AI queries using location, time, and device state.
 * Enables situation-aware responses.
 */

import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Accelerometer } from 'expo-sensors';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ContextBuilder');

export interface UserContext {
    time: {
        hour: number;
        isNight: boolean;
        dayOfWeek: number;
    };
    location: {
        latitude: number | null;
        longitude: number | null;
        isIndoors: boolean;
        speed: number | null;
    };
    device: {
        batteryLevel: number;
        batteryLow: boolean;
        isCharging: boolean;
        networkAvailable: boolean;
        networkType: string | null;
    };
    activity: {
        isMoving: boolean;
        isRunning: boolean; // Potential panic/escape detection
    };
    emergency: {
        isSOSActive: boolean;
        recentEarthquake: boolean;
    };
}

class ContextBuilder {
  private currentContext: UserContext | null = null;
  private motionSubscription: any = null;
  private recentMotionData: number[] = [];
  private readonly MOTION_THRESHOLD_MOVING = 1.2;
  private readonly MOTION_THRESHOLD_RUNNING = 2.5;

  constructor() {
    this.startMotionMonitoring();
  }

  private startMotionMonitoring() {
    Accelerometer.setUpdateInterval(1000);
    this.motionSubscription = Accelerometer.addListener(data => {
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      this.recentMotionData.push(magnitude);
      if (this.recentMotionData.length > 10) {
        this.recentMotionData.shift();
      }
    });
  }

  /**
     * Build current context from available sensors and state
     */
  async build(): Promise<UserContext> {
    const now = new Date();
    const hour = now.getHours();

    // 1. Location & Speed
    let latitude: number | null = null;
    let longitude: number | null = null;
    let speed: number | null = null;

    try {
      const loc = await Location.getLastKnownPositionAsync();
      if (loc) {
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
        speed = loc.coords.speed;
      }
    } catch (e) {
      logger.warn('Could not get location for context');
    }

    // 2. Battery State
    let batteryLevel = -1;
    let isCharging = false;
    try {
      batteryLevel = await Battery.getBatteryLevelAsync();
      const batteryState = await Battery.getBatteryStateAsync();
      isCharging = batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL;
    } catch (e) {
      logger.warn('Could not get battery info');
    }

    // 3. Network State
    let networkAvailable = false;
    let networkType: string | null = null;
    try {
      const netState: NetInfoState = await NetInfo.fetch();
      networkAvailable = netState.isConnected ?? false;
      networkType = netState.type;
    } catch (e) {
      logger.warn('Could not get network info');
    }

    // 4. Motion Analysis
    const avgMotion = this.recentMotionData.length > 0
      ? this.recentMotionData.reduce((a, b) => a + b, 0) / this.recentMotionData.length
      : 1.0; // 1.0 is roughly gravity (standing still)

    const isMoving = avgMotion > this.MOTION_THRESHOLD_MOVING;
    const isRunning = avgMotion > this.MOTION_THRESHOLD_RUNNING;

    this.currentContext = {
      time: {
        hour,
        isNight: hour >= 22 || hour <= 6,
        dayOfWeek: now.getDay(),
      },
      location: {
        latitude,
        longitude,
        speed,
        isIndoors: speed !== null && speed < 1 && networkType === 'wifi', // Heuristic: Low speed + Wifi usually means indoors
      },
      device: {
        batteryLevel,
        batteryLow: batteryLevel >= 0 && batteryLevel < 0.20 && !isCharging,
        isCharging,
        networkAvailable,
        networkType,
      },
      activity: {
        isMoving,
        isRunning,
      },
      emergency: {
        isSOSActive: false, // Future: check SOSService state (wired in next phase)
        recentEarthquake: false, // Future: check EarthquakeStore
      },
    };

    return this.currentContext;
  }

  /**
     * Get priority tags based on context
     * Used to boost search relevance
     */
  getPriorityTags(context: UserContext): string[] {
    const tags: string[] = [];

    if (context.time.isNight) {
      tags.push('gece', 'fener', 'karanlık');
    }

    if (context.emergency.isSOSActive) {
      tags.push('acil', 'yardım', 'enkaz');
    }

    if (context.emergency.recentEarthquake) {
      tags.push('deprem', 'artçı', 'sarsıntı');
    }

    if (context.device.batteryLow) {
      tags.push('pil', 'enerji', 'tasarruf');
    }

    if (!context.device.networkAvailable) {
      tags.push('offline', 'çevrimdışı', 'harita');
    }

    if (context.activity.isRunning) {
      tags.push('kaçış', 'toplanma', 'yol');
    }

    return tags;
  }

  getContext(): UserContext | null {
    return this.currentContext;
  }
}

export const contextBuilder = new ContextBuilder();
