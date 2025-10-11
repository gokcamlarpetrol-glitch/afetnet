import { Alert } from 'react-native';
import { logger } from '../utils/productionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DeadManConfig {
  enabled: boolean;
  intervalMinutes: number;
  lastCheck: number;
  sosActive: boolean;
}

class DeadManSwitch {
  private config: DeadManConfig = {
    enabled: true,
    intervalMinutes: 10,
    lastCheck: 0,
    sosActive: false
  };
  private intervalId: NodeJS.Timeout | null = null;
  private onSOSCallback?: () => void;

  constructor() {
    this.loadConfig();
  }

  private async loadConfig() {
    try {
      const stored = await AsyncStorage.getItem('afn/deadman/config');
      if (stored) {
        this.config = { ...this.config, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.warn('Failed to load deadman config:', error);
    }
  }

  private async saveConfig() {
    try {
      await AsyncStorage.setItem('afn/deadman/config', JSON.stringify(this.config));
    } catch (error) {
      logger.warn('Failed to save deadman config:', error);
    }
  }

  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    this.saveConfig();
    
    if (enabled && this.config.sosActive) {
      this.start();
    } else if (!enabled) {
      this.stop();
    }
  }

  setInterval(intervalMinutes: number) {
    this.config.intervalMinutes = Math.max(1, Math.min(60, intervalMinutes));
    this.saveConfig();
    
    if (this.config.enabled && this.config.sosActive) {
      this.stop();
      this.start();
    }
  }

  setSOSActive(active: boolean) {
    this.config.sosActive = active;
    this.saveConfig();
    
    if (active && this.config.enabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  setSOSCallback(callback: () => void) {
    this.onSOSCallback = callback;
  }

  private start() {
    this.stop(); // Clear any existing interval
    
    if (!this.config.enabled || !this.config.sosActive) {
      return;
    }

    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    
    this.intervalId = setInterval(() => {
      this.checkDeadMan();
    }, intervalMs);

    logger.debug(`Dead man switch started: ${this.config.intervalMinutes} minute intervals`);
  }

  private stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.debug('Dead man switch stopped');
    }
  }

  private async checkDeadMan() {
    if (!this.config.enabled || !this.config.sosActive) {
      return;
    }

    const now = Date.now();
    const timeSinceLastCheck = now - this.config.lastCheck;
    
    // Show unobtrusive prompt
    Alert.alert(
      'Durum Kontrolü',
      'İyisin mi?',
      [
        {
          text: 'Evet, iyiyim',
          onPress: () => {
            this.config.lastCheck = now;
            this.saveConfig();
            this.logResponse('confirmed');
          }
        },
        {
          text: 'Hayır, yardım gerekli',
          onPress: () => {
            this.config.lastCheck = now;
            this.saveConfig();
            this.logResponse('help_needed');
            // Trigger additional SOS if needed
            if (this.onSOSCallback) {
              this.onSOSCallback();
            }
          }
        }
      ],
      {
        cancelable: false,
        onDismiss: () => {
          // If user dismisses without responding, consider it a non-response
          this.logResponse('no_response');
        }
      }
    );

    // Auto-dismiss after 30 seconds if no response
    setTimeout(() => {
      this.logResponse('timeout');
    }, 30000);
  }

  private async logResponse(response: 'confirmed' | 'help_needed' | 'no_response' | 'timeout') {
    try {
      const logEntry = {
        timestamp: Date.now(),
        response,
        intervalMinutes: this.config.intervalMinutes,
        sosActive: this.config.sosActive
      };

      // Get existing logs
      const existingLogs = await AsyncStorage.getItem('afn/deadman/logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      
      // Add new entry
      logs.push(logEntry);
      
      // Keep only last 100 entries
      const recentLogs = logs.slice(-100);
      
      await AsyncStorage.setItem('afn/deadman/logs', JSON.stringify(recentLogs));
      
      logger.debug(`Dead man response logged: ${response}`);
      
      // If no response or timeout, consider triggering automatic re-broadcast
      if (response === 'no_response' || response === 'timeout') {
        this.handleNoResponse();
      }
      
    } catch (error) {
      logger.warn('Failed to log dead man response:', error);
    }
  }

  private async handleNoResponse() {
    logger.debug('Dead man switch: No response received, may trigger automatic SOS');
    
    // In a real implementation, you might want to:
    // 1. Automatically re-broadcast SOS
    // 2. Increase SOS frequency
    // 3. Notify emergency contacts
    // 4. Log the incident
    
    try {
      const incidentLog = {
        timestamp: Date.now(),
        type: 'deadman_no_response',
        intervalMinutes: this.config.intervalMinutes,
        sosActive: this.config.sosActive
      };

      const existingIncidents = await AsyncStorage.getItem('afn/deadman/incidents');
      const incidents = existingIncidents ? JSON.parse(existingIncidents) : [];
      
      incidents.push(incidentLog);
      const recentIncidents = incidents.slice(-50);
      
      await AsyncStorage.setItem('afn/deadman/incidents', JSON.stringify(recentIncidents));
      
    } catch (error) {
      logger.warn('Failed to log incident:', error);
    }
  }

  async getLogs(): Promise<any[]> {
    try {
      const logs = await AsyncStorage.getItem('afn/deadman/logs');
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      logger.warn('Failed to get dead man logs:', error);
      return [];
    }
  }

  async getIncidents(): Promise<any[]> {
    try {
      const incidents = await AsyncStorage.getItem('afn/deadman/incidents');
      return incidents ? JSON.parse(incidents) : [];
    } catch (error) {
      logger.warn('Failed to get dead man incidents:', error);
      return [];
    }
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      intervalMinutes: this.config.intervalMinutes,
      sosActive: this.config.sosActive,
      isRunning: this.intervalId !== null,
      lastCheck: this.config.lastCheck
    };
  }

  reset() {
    this.stop();
    this.config = {
      enabled: true,
      intervalMinutes: 10,
      lastCheck: 0,
      sosActive: false
    };
    this.saveConfig();
  }
}

export const deadManSwitch = new DeadManSwitch();
