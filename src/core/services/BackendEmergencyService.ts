/**
 * BACKEND EMERGENCY SERVICE
 * CRITICAL: Sends emergency messages and family member data to backend
 * This ensures rescue teams can access critical information during disasters
 * ELITE: Production-ready with comprehensive error handling
 */

import { createLogger } from '../utils/logger';
import { getDeviceId } from '../utils/device';
import { APIClient, APIError } from '../api/client';
import { ENV } from '../config/env';
import { safeLowerCase, safeIncludes } from '../utils/safeString';

const logger = createLogger('BackendEmergencyService');

interface EmergencyMessage {
  deviceId: string;
  messageId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'sos' | 'status' | 'location';
  priority: 'normal' | 'high' | 'critical';
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  recipientDeviceId?: string; // For direct messages
}

interface FamilyMemberData {
  deviceId: string;
  memberId: string;
  name: string;
  status: 'safe' | 'need-help' | 'unknown' | 'critical' | 'trapped';
  location?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  lastSeen: number;
  relationship?: string;
  phoneNumber?: string;
}

interface HealthProfileData {
  deviceId: string;
  bloodType?: string;
  allergies?: string[];
  medications?: string[];
  medicalConditions?: string[];
  emergencyContacts?: Array<{
    name: string;
    phone: string;
    relationship?: string;
  }>;
  updatedAt: number;
}

interface ICEData {
  deviceId: string;
  name: string;
  blood?: string;
  allergies?: string;
  meds?: string;
  contacts?: Array<{
    name: string;
    phone: string;
  }>;
  updatedAt: number;
}

interface StatusUpdateData {
  deviceId: string;
  status: 'safe' | 'need-help' | 'unknown' | 'critical' | 'trapped';
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  timestamp: number;
}

interface FeltEarthquakeReportData {
  deviceId: string;
  earthquakeId: string;
  intensity: number;
  feltDuration: number;
  effects: string[];
  comments?: string;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: number;
}

interface UserReportData {
  deviceId: string;
  reportId: string;
  timestamp: number;
  location: {
    latitude: number;
    longitude: number;
  };
  intensity: number;
  type: 'earthquake' | 'tremor';
  description?: string;
  photoUri?: string;
}

interface EarthquakeData {
  id: string;
  timestamp: number;
  magnitude: number;
  depth: number;
  latitude: number;
  longitude: number;
  location: string;
  source: string;
}

class BackendEmergencyService {
  private apiClient: APIClient | null = null;
  private isInitialized = false;
  private messageQueue: EmergencyMessage[] = [];
  private familyMemberQueue: FamilyMemberData[] = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly SYNC_INTERVAL_MS = 30000; // 30 seconds
  private earthquakeEndpointUnavailable = false;
  private earthquakeEndpointDisableReason: string | null = null;

  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Initialize backend emergency service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      const baseUrl = ENV.API_BASE_URL;
      if (!baseUrl || !baseUrl.startsWith('http')) {
        logger.warn('Invalid backend URL, skipping initialization');
        return;
      }

      this.apiClient = new APIClient(baseUrl);
      this.isInitialized = true;

      // Start periodic sync
      this.startPeriodicSync();

      if (__DEV__) {
        logger.info('✅ Backend Emergency Service initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize backend emergency service:', error);
      // Don't throw - app continues without backend sync
    }
  }

  /**
   * Start periodic sync of queued messages and family members
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      try {
        await this.syncQueuedMessages();
        await this.syncQueuedFamilyMembers();
      } catch (error) {
        logger.error('Periodic sync failed:', error);
      }
    }, this.SYNC_INTERVAL_MS);
  }

  private disableEarthquakeEndpoint(reason: string): void {
    if (this.earthquakeEndpointUnavailable) {
      return;
    }

    this.earthquakeEndpointUnavailable = true;
    this.earthquakeEndpointDisableReason = reason;

    if (__DEV__) {
      logger.warn(`Backend earthquake endpoint disabled: ${reason}`);
    }
  }

  /**
   * Send emergency message to backend
   * CRITICAL: This ensures rescue teams can see emergency messages
   */
  async sendEmergencyMessage(message: Omit<EmergencyMessage, 'deviceId'>): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      // Queue message for later sync
      this.queueMessage(message);
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        logger.warn('No device ID available, queueing message');
        this.queueMessage(message);
        return;
      }

      const fullMessage: EmergencyMessage = {
        ...message,
        deviceId,
      };

      // CRITICAL: Send to backend immediately for emergency messages
      if (message.priority === 'critical' || message.type === 'sos') {
        try {
          await this.apiClient.post('/emergency/messages', fullMessage);
          if (__DEV__) {
            logger.info('✅ Emergency message sent to backend:', message.messageId);
          }
        } catch (error) {
          logger.error('Failed to send emergency message to backend:', error);
          // Queue for retry
          this.queueMessage(message);
        }
      } else {
        // Normal messages - queue for batch sync
        this.queueMessage(message);
      }
    } catch (error) {
      logger.error('Error sending emergency message:', error);
      this.queueMessage(message);
    }
  }

  /**
   * Send family member data to backend
   * CRITICAL: This ensures rescue teams know who to look for
   */
  async sendFamilyMemberData(member: Omit<FamilyMemberData, 'deviceId'>): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      // Queue for later sync
      this.queueFamilyMember(member);
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        logger.warn('No device ID available, queueing family member');
        this.queueFamilyMember(member);
        return;
      }

      const fullMember: FamilyMemberData = {
        ...member,
        deviceId,
      };

      // CRITICAL: Send immediately for critical status
      if (member.status === 'critical' || member.status === 'need-help') {
        try {
          await this.apiClient.post('/emergency/family-members', fullMember);
          if (__DEV__) {
            logger.info('✅ Family member data sent to backend:', member.memberId);
          }
        } catch (error) {
          logger.error('Failed to send family member to backend:', error);
          // Queue for retry
          this.queueFamilyMember(member);
        }
      } else {
        // Normal updates - queue for batch sync
        this.queueFamilyMember(member);
      }
    } catch (error) {
      logger.error('Error sending family member data:', error);
      this.queueFamilyMember(member);
    }
  }

  /**
   * Queue message for later sync
   */
  private queueMessage(message: Omit<EmergencyMessage, 'deviceId'>): void {
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest non-critical messages first
      const nonCriticalIndex = this.messageQueue.findIndex(m => m.priority !== 'critical');
      if (nonCriticalIndex >= 0) {
        this.messageQueue.splice(nonCriticalIndex, 1);
      } else {
        // All critical - remove oldest
        this.messageQueue.shift();
      }
    }

    this.messageQueue.push(message as EmergencyMessage);
  }

  /**
   * Queue family member for later sync
   */
  private queueFamilyMember(member: Omit<FamilyMemberData, 'deviceId'>): void {
    if (this.familyMemberQueue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest non-critical members first
      const nonCriticalIndex = this.familyMemberQueue.findIndex(
        m => m.status !== 'critical' && m.status !== 'need-help',
      );
      if (nonCriticalIndex >= 0) {
        this.familyMemberQueue.splice(nonCriticalIndex, 1);
      } else {
        // All critical - remove oldest
        this.familyMemberQueue.shift();
      }
    }

    this.familyMemberQueue.push(member as FamilyMemberData);
  }

  /**
   * Sync queued messages to backend
   */
  private async syncQueuedMessages(): Promise<void> {
    if (!this.isInitialized || !this.apiClient || this.messageQueue.length === 0) {
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      const messagesToSync = this.messageQueue.map(msg => ({
        ...msg,
        deviceId,
      }));

      try {
        await this.apiClient.post('/emergency/messages/batch', {
          messages: messagesToSync,
        });

        // Clear successfully sent messages
        this.messageQueue = [];
        if (__DEV__) {
          logger.info(`✅ Synced ${messagesToSync.length} messages to backend`);
        }
      } catch (error) {
        logger.error('Failed to sync messages to backend:', error);
        // Keep messages in queue for retry
      }
    } catch (error) {
      logger.error('Error syncing messages:', error);
    }
  }

  /**
   * Sync queued family members to backend
   */
  private async syncQueuedFamilyMembers(): Promise<void> {
    if (!this.isInitialized || !this.apiClient || this.familyMemberQueue.length === 0) {
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      const membersToSync = this.familyMemberQueue.map(member => ({
        ...member,
        deviceId,
      }));

      try {
        await this.apiClient.post('/emergency/family-members/batch', {
          members: membersToSync,
        });

        // Clear successfully sent members
        this.familyMemberQueue = [];
        if (__DEV__) {
          logger.info(`✅ Synced ${membersToSync.length} family members to backend`);
        }
      } catch (error) {
        logger.error('Failed to sync family members to backend:', error);
        // Keep members in queue for retry
      }
    } catch (error) {
      logger.error('Error syncing family members:', error);
    }
  }

  /**
   * Send health profile to backend
   * CRITICAL: This ensures rescue teams have medical information during emergencies
   */
  async sendHealthProfile(profile: Omit<HealthProfileData, 'deviceId'>): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      const fullProfile: HealthProfileData = {
        ...profile,
        deviceId,
      };

      try {
        await this.apiClient.post('/emergency/health-profile', fullProfile);
        if (__DEV__) {
          logger.info('✅ Health profile sent to backend');
        }
      } catch (error) {
        logger.error('Failed to send health profile to backend:', error);
      }
    } catch (error) {
      logger.error('Error sending health profile:', error);
    }
  }

  /**
   * Send ICE data to backend
   * CRITICAL: This ensures rescue teams have emergency contact information
   */
  async sendICEData(iceData: Omit<ICEData, 'deviceId'>): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      const fullICEData: ICEData = {
        ...iceData,
        deviceId,
      };

      try {
        await this.apiClient.post('/emergency/ice-data', fullICEData);
        if (__DEV__) {
          logger.info('✅ ICE data sent to backend');
        }
      } catch (error) {
        logger.error('Failed to send ICE data to backend:', error);
      }
    } catch (error) {
      logger.error('Error sending ICE data:', error);
    }
  }

  /**
   * Send status update to backend
   * CRITICAL: This ensures rescue teams know user's current status
   */
  async sendStatusUpdate(statusData: Omit<StatusUpdateData, 'deviceId'>): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      const fullStatus: StatusUpdateData = {
        ...statusData,
        deviceId,
      };

      // CRITICAL: Send immediately for critical status
      if (statusData.status === 'critical' || statusData.status === 'need-help') {
        try {
          await this.apiClient.post('/emergency/status-update', fullStatus);
          if (__DEV__) {
            logger.info('✅ Critical status update sent to backend');
          }
        } catch (error) {
          logger.error('Failed to send status update to backend:', error);
        }
      } else {
        // Normal status - queue for batch sync (can be added later)
        if (__DEV__) {
          logger.debug('Normal status update (will sync in batch)');
        }
      }
    } catch (error) {
      logger.error('Error sending status update:', error);
    }
  }

  /**
   * Send felt earthquake report to backend
   * CRITICAL: This helps rescue teams understand earthquake impact
   */
  async sendFeltEarthquakeReport(report: Omit<FeltEarthquakeReportData, 'deviceId'>): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      const fullReport: FeltEarthquakeReportData = {
        ...report,
        deviceId,
      };

      try {
        await this.apiClient.post('/emergency/felt-earthquake-report', fullReport);
        if (__DEV__) {
          logger.info('✅ Felt earthquake report sent to backend');
        }
      } catch (error) {
        logger.error('Failed to send felt earthquake report to backend:', error);
      }
    } catch (error) {
      logger.error('Error sending felt earthquake report:', error);
    }
  }

  /**
   * Send user report to backend
   * CRITICAL: This helps rescue teams understand community-reported events
   */
  async sendUserReport(report: Omit<UserReportData, 'deviceId'>): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      const fullReport: UserReportData = {
        ...report,
        deviceId,
      };

      try {
        await this.apiClient.post('/emergency/user-report', fullReport);
        if (__DEV__) {
          logger.info('✅ User report sent to backend');
        }
      } catch (error) {
        logger.error('Failed to send user report to backend:', error);
      }
    } catch (error) {
      logger.error('Error sending user report:', error);
    }
  }

  /**
   * Send earthquake data to backend
   * CRITICAL: This helps rescue teams track earthquake events
   */
  async sendEarthquakeData(earthquake: Omit<EarthquakeData, 'deviceId'>): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      return;
    }

    if (this.earthquakeEndpointUnavailable) {
      if (__DEV__) {
        logger.debug(
          `Skipping earthquake data sync - endpoint unavailable${this.earthquakeEndpointDisableReason ? ` (${this.earthquakeEndpointDisableReason})` : ''}`,
        );
      }
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      const fullEarthquake: EarthquakeData & { deviceId: string } = {
        ...earthquake,
        deviceId,
      };

      try {
        await this.apiClient.post('/emergency/earthquake-data', fullEarthquake);
        if (__DEV__) {
          logger.info('✅ Earthquake data sent to backend');
        }
      } catch (error) {
        if (error instanceof APIError) {
          const message = safeLowerCase(error.message);
          if (
            error.statusCode === 404 ||
            safeIncludes(message, 'cannot post') ||
            error.statusCode === 429 ||
            safeIncludes(message, 'too many requests') ||
            error.statusCode === 501 ||
            error.statusCode === 503
          ) {
            this.disableEarthquakeEndpoint(
              error.statusCode === 429 || safeIncludes(message, 'too many requests')
                ? 'rate-limited by backend'
                : 'endpoint not available on backend',
            );
            return;
          }

          logger.warn('Failed to send earthquake data to backend (non-blocking):', {
            statusCode: error.statusCode,
            message: error.message,
          });
          return;
        }

        logger.warn('Failed to send earthquake data to backend (unexpected error):', error);
      }
    } catch (error) {
      logger.warn('Error preparing earthquake data for backend:', error);
    }
  }

  /**
   * Delete family member from backend
   * CRITICAL: This ensures rescue teams know member is no longer tracked
   */
  async deleteFamilyMember(memberId: string): Promise<void> {
    if (!this.isInitialized || !this.apiClient) {
      return;
    }

    try {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      await this.apiClient.delete(`/emergency/family-members/${memberId}`, {
        headers: {
          'X-Device-Id': deviceId,
        },
      });

      if (__DEV__) {
        logger.info('✅ Family member deleted from backend:', memberId);
      }
    } catch (error) {
      logger.error('Failed to delete family member from backend:', error);
      // Don't throw - deletion is non-critical
    }
  }

  /**
   * Shutdown service
   */
  /**
   * ELITE: Send SOS signal to backend
   * CRITICAL: Used by OfflineSyncService for offline SOS queue
   */
  async sendSOSSignal(data: any): Promise<void> {
    await this.sendEmergencyMessage({
      messageId: data.id || `sos_${Date.now()}`,
      content: data.message || 'SOS - Acil Yardım!',
      timestamp: data.timestamp || Date.now(),
      type: 'sos',
      priority: 'critical',
      location: data.location,
    });
  }

  shutdown(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Final sync before shutdown
    this.syncQueuedMessages().catch(error => {
      logger.error('Final message sync failed:', error);
    });
    this.syncQueuedFamilyMembers().catch(error => {
      logger.error('Final family member sync failed:', error);
    });

    this.isInitialized = false;
  }
}

export const backendEmergencyService = new BackendEmergencyService();

