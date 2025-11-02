/**
 * CELL BROADCAST SERVICE
 * Device-based alerts integration (Android Cell Broadcast, iOS Emergency Alerts)
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import { multiChannelAlertService } from './MultiChannelAlertService';

const logger = createLogger('CellBroadcastService');

interface CellBroadcastMessage {
  message: string;
  channel: string;
  serialNumber: number;
  geocode?: {
    plmn: string[];
    lac: string[];
    cellId: string[];
  };
  priority: 'normal' | 'high' | 'emergency';
  language: string;
}

class CellBroadcastService {
  private isInitialized = false;
  private messageCallbacks: Array<(message: CellBroadcastMessage) => void> = [];

  async initialize() {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'android') {
        // Android Cell Broadcast API integration
        // Note: Requires native module or expo module
        // For now, we'll simulate the integration
        
        if (__DEV__) {
          logger.info('Cell Broadcast service initialized (Android)');
        }
      } else if (Platform.OS === 'ios') {
        // iOS Emergency Alerts
        // Note: iOS handles emergency alerts automatically
        // We can listen for UNNotification events
        
        if (__DEV__) {
          logger.info('Cell Broadcast service initialized (iOS)');
        }
      }

      this.isInitialized = true;
    } catch (error) {
      logger.error('Cell Broadcast initialization error:', error);
    }
  }

  /**
   * Register callback for incoming cell broadcast messages
   */
  onMessage(callback: (message: CellBroadcastMessage) => void): () => void {
    this.messageCallbacks.push(callback);
    return () => {
      const index = this.messageCallbacks.indexOf(callback);
      if (index > -1) {
        this.messageCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Handle incoming cell broadcast message
   */
  private async handleMessage(message: CellBroadcastMessage) {
    try {
      // Determine if this is an emergency alert
      const isEmergency = message.priority === 'emergency' || 
                         message.channel === '50' || // Emergency channel
                         message.message.toLowerCase().includes('deprem') ||
                         message.message.toLowerCase().includes('afet') ||
                         message.message.toLowerCase().includes('acil');

      if (isEmergency) {
        // Trigger multi-channel alert
        await multiChannelAlertService.sendAlert({
          title: '🚨 ACİL UYARI',
          body: message.message,
          priority: 'critical',
          channels: {
            pushNotification: true,
            fullScreenAlert: true,
            alarmSound: true,
            vibration: true,
            tts: true,
          },
          data: {
            type: 'cell_broadcast',
            channel: message.channel,
            priority: message.priority,
          },
        });
      }

      // Notify callbacks
      for (const callback of this.messageCallbacks) {
        try {
          callback(message);
        } catch (error) {
          logger.error('Callback error:', error);
        }
      }

      logger.info('Cell Broadcast message received:', message.message.substring(0, 50));
    } catch (error) {
      logger.error('Handle message error:', error);
    }
  }

  /**
   * Check if cell broadcast is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // In production, check native module availability
      return Platform.OS === 'android' || Platform.OS === 'ios';
    } catch (error) {
      logger.error('Availability check error:', error);
      return false;
    }
  }

  /**
   * Simulate cell broadcast message (for testing)
   */
  async simulateMessage(message: string, priority: 'normal' | 'high' | 'emergency' = 'emergency') {
    if (__DEV__) {
      const simulatedMessage: CellBroadcastMessage = {
        message,
        channel: priority === 'emergency' ? '50' : '0',
        serialNumber: Date.now(),
        priority,
        language: 'tr',
      };
      
      await this.handleMessage(simulatedMessage);
    }
  }

  stop() {
    this.messageCallbacks = [];
    this.isInitialized = false;
    
    if (__DEV__) {
      logger.info('Cell Broadcast service stopped');
    }
  }
}

export const cellBroadcastService = new CellBroadcastService();


