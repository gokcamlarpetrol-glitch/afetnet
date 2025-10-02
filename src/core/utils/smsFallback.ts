import * as SMS from 'expo-sms';
import { SMSEncoder } from '../logic/sms';
import { HelpRequestRepository } from '../data/repositories';
import { Priority } from '../data/models';

export interface SMSConfig {
  enabled: boolean;
  shortCode: string;
  maxRetries: number;
}

export class SMSFallback {
  private static instance: SMSFallback;
  private config: SMSConfig;

  private constructor() {
    this.config = {
      enabled: false,
      shortCode: '+90 555',
      maxRetries: 3,
    };
  }

  static getInstance(): SMSFallback {
    if (!SMSFallback.instance) {
      SMSFallback.instance = new SMSFallback();
    }
    return SMSFallback.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Check if SMS is available
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        console.warn('SMS is not available on this device');
        return;
      }

      console.log('SMS Fallback initialized');
    } catch (error) {
      console.error('Failed to initialize SMS fallback:', error);
    }
  }

  updateConfig(newConfig: Partial<SMSConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SMSConfig {
    return { ...this.config };
  }

  async sendHelpRequestSMS(
    priority: Priority,
    underRubble: boolean,
    injured: boolean,
    peopleCount: number,
    note: string,
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    },
    battery?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('SMS fallback is disabled');
      return false;
    }

    try {
      const message = SMSEncoder.createHelpMessage(
        location.latitude,
        location.longitude,
        priority,
        underRubble,
        injured,
        peopleCount,
        note,
        battery
      );

      const encodedMessage = SMSEncoder.encode(message);
      
      // Send SMS
      const result = await SMS.sendSMSAsync(
        [this.config.shortCode],
        encodedMessage
      );

      if (result.result === 'sent') {
        console.log('Help request SMS sent successfully');
        
        // Save to local database
        await HelpRequestRepository.create({
          ts: Date.now(),
          lat: location.latitude,
          lon: location.longitude,
          accuracy: location.accuracy,
          priority,
          underRubble,
          injured,
          peopleCount,
          note,
          battery,
          anonymity: false,
          ttl: 24,
          signature: 'sms_fallback',
          delivered: true,
          hops: 0,
          source: 'self',
        });

        return true;
      } else {
        console.error('Failed to send SMS:', result.result);
        return false;
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      return false;
    }
  }

  async sendSafePingSMS(
    note: string,
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    },
    battery?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('SMS fallback is disabled');
      return false;
    }

    try {
      const message = SMSEncoder.createSafeMessage(
        location.latitude,
        location.longitude,
        note,
        battery
      );

      const encodedMessage = SMSEncoder.encode(message);
      
      // Send SMS
      const result = await SMS.sendSMSAsync(
        [this.config.shortCode],
        encodedMessage
      );

      if (result.result === 'sent') {
        console.log('Safe ping SMS sent successfully');
        return true;
      } else {
        console.error('Failed to send SMS:', result.result);
        return false;
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      return false;
    }
  }

  async sendResourcePostSMS(
    type: 'water' | 'food' | 'blanket' | 'powerbank' | 'med',
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    },
    qty?: string,
    desc?: string
  ): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('SMS fallback is disabled');
      return false;
    }

    try {
      const message = SMSEncoder.createResourceMessage(
        type,
        location.latitude,
        location.longitude,
        location.accuracy,
        qty,
        desc
      );

      const encodedMessage = SMSEncoder.encode(message);
      
      // Send SMS
      const result = await SMS.sendSMSAsync(
        [this.config.shortCode],
        encodedMessage
      );

      if (result.result === 'sent') {
        console.log('Resource post SMS sent successfully');
        return true;
      } else {
        console.error('Failed to send SMS:', result.result);
        return false;
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      return false;
    }
  }

  async sendPingSMS(
    location: {
      latitude: number;
      longitude: number;
      accuracy: number;
    },
    battery?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('SMS fallback is disabled');
      return false;
    }

    try {
      const message = {
        type: 'PING' as const,
        lat: location.latitude,
        lon: location.longitude,
        ttl: 1,
      };

      const encodedMessage = SMSEncoder.encode(message);
      
      // Send SMS
      const result = await SMS.sendSMSAsync(
        [this.config.shortCode],
        encodedMessage
      );

      if (result.result === 'sent') {
        console.log('Ping SMS sent successfully');
        return true;
      } else {
        console.error('Failed to send SMS:', result.result);
        return false;
      }
    } catch (error) {
      console.error('SMS sending error:', error);
      return false;
    }
  }

  // Utility method to check if SMS is available
  async isAvailable(): Promise<boolean> {
    try {
      return await SMS.isAvailableAsync();
    } catch (error) {
      console.error('Error checking SMS availability:', error);
      return false;
    }
  }

  // Utility method to get SMS status
  async getStatus(): Promise<{
    available: boolean;
    enabled: boolean;
    shortCode: string;
  }> {
    const available = await this.isAvailable();
    return {
      available,
      enabled: this.config.enabled,
      shortCode: this.config.shortCode,
    };
  }
}