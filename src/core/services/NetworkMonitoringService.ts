/**
 * NETWORK MONITORING SERVICE
 * Monitors network status and sends notifications for connectivity changes
 */

import NetInfo from '@react-native-community/netinfo';
import { createLogger } from '../utils/logger';
import { notificationService } from './NotificationService';

const logger = createLogger('NetworkMonitoringService');

class NetworkMonitoringService {
  private isRunning = false;
  private unsubscribe: (() => void) | null = null;
  private lastStatus: boolean | null = null;

  async start() {
    if (this.isRunning) return;

    this.isRunning = true;
    logger.info('Starting network monitoring...');

    // Get initial status
    const netState = await NetInfo.fetch();
    this.lastStatus = netState.isConnected ?? false;

    // Subscribe to network state changes
    this.unsubscribe = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected ?? false;
      
      // Only notify on status change
      if (this.lastStatus !== null && this.lastStatus !== isConnected) {
        logger.info(`Network status changed: ${isConnected ? 'connected' : 'disconnected'}`);
        void this.handleNetworkStatusChange(isConnected);
      }
      
      this.lastStatus = isConnected;
    });
  }

  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    logger.info('Stopping network monitoring...');

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private async handleNetworkStatusChange(isConnected: boolean) {
    try {
      await notificationService.showNetworkStatusNotification(isConnected);
    } catch (error) {
      logger.error('Failed to send network status notification:', error);
    }
  }

  /**
   * Get current network status
   */
  async getCurrentStatus(): Promise<boolean> {
    try {
      const netState = await NetInfo.fetch();
      return netState.isConnected ?? false;
    } catch (error) {
      logger.error('Failed to get network status:', error);
      return false;
    }
  }
}

export const networkMonitoringService = new NetworkMonitoringService();

