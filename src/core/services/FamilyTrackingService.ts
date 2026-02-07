/**
 * FAMILY TRACKING SERVICE - ELITE EDITION
 * Real-time location sharing and status updates for family members.
 *
 * Features:
 * - Real-time Location Sharing
 * - Battery Level Monitoring
 * - Safety Status Updates
 * - Check-in Reminders
 * - Offline Mesh Location Sharing
 */

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../utils/logger';
import { bleMeshService } from './BLEMeshService';
import { firebaseDataService } from './FirebaseDataService';
import { identityService } from './IdentityService';
import { LOCATION_TASK_NAME } from '../tasks/BackgroundLocationTask';
import { useFamilyStore } from '../stores/familyStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getDeviceId as getDeviceIdFromLib } from '../../lib/device';

const logger = createLogger('FamilyTrackingService');

const STORAGE_KEY = '@afetnet:family_members';
const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
const MIN_SHARE_INTERVAL_MS = 20 * 1000; // 20 seconds
const CLOUD_RETRY_ATTEMPTS = 3;
const CLOUD_RETRY_BACKOFF_MS = 800;

export interface FamilyMember {
  id: string;
  name: string;
  deviceId?: string;
  phone?: string;
  photo?: string;
  location?: {
    latitude: number;
    longitude: number;
    timestamp: number;
    accuracy?: number;
  };
  // ELITE: Find My-grade Last Known Location (persisted when battery dies)
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
    batteryLevelAtCapture: number;
    source: 'gps' | 'mesh' | 'cloud' | 'manual';
  };
  batteryLevel?: number;
  status: 'safe' | 'danger' | 'unknown' | 'offline' | 'need-help' | 'critical';
  lastSeen: number;
  isOnline: boolean;
}

export interface FamilyGroup {
  id: string;
  name: string;
  members: FamilyMember[];
  createdAt: number;
}

class FamilyTrackingService {
  private members: FamilyMember[] = [];
  private isTracking = false;
  private locationInterval: NodeJS.Timeout | null = null;
  private statusCallbacks: Array<(member: FamilyMember) => void> = [];
  private shareInFlight: Promise<boolean> | null = null;
  private lastShareTimestamp = 0;
  private shareThrottleMs = MIN_SHARE_INTERVAL_MS;
  private trackingConsumers: Set<string> = new Set();

  private syncMembersFromStore(): void {
    const storeMembers = useFamilyStore.getState().members;
    if (!Array.isArray(storeMembers)) {
      this.members = [];
      return;
    }

    this.members = storeMembers.map((member) => {
      const location = member.location
        ? {
          latitude: member.location.latitude,
          longitude: member.location.longitude,
          timestamp: member.location.timestamp || member.lastSeen || Date.now(),
          accuracy: member.location.accuracy,
        }
        : (
          Number.isFinite(member.latitude) && Number.isFinite(member.longitude)
            ? {
              latitude: member.latitude,
              longitude: member.longitude,
              timestamp: member.lastSeen || Date.now(),
            }
            : undefined
        );

      return {
        id: member.id,
        name: member.name,
        deviceId: member.deviceId,
        phone: member.phoneNumber,
        location,
        lastKnownLocation: member.lastKnownLocation,
        batteryLevel: member.batteryLevel,
        status: member.status,
        lastSeen: member.lastSeen || location?.timestamp || Date.now(),
        isOnline: member.isOnline ?? true,
      };
    });
  }

  /**
     * Initialize service and load saved members
     */
  async initialize() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        this.members = JSON.parse(data);
        logger.info(`Loaded ${this.members.length} family members`);
      }
      this.syncMembersFromStore();
    } catch (e) {
      logger.error('Failed to load family members', e);
    }
  }

  /**
     * Start location tracking and sharing
     */
  async startTracking(consumerId: string = 'default') {
    if (!useSettingsStore.getState().locationEnabled) {
      logger.info('Family tracking start skipped: location disabled in settings');
      return;
    }

    this.trackingConsumers.add(consumerId);
    if (this.isTracking) {
      return;
    }

    logger.info('Starting Family Tracking');
    this.syncMembersFromStore();

    // Check and request background permissions BEFORE setting isTracking
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
      if (reqStatus !== 'granted') {
        logger.warn('Foreground location permission denied');
        this.trackingConsumers.delete(consumerId);
        return; // Don't set isTracking
      }
    }

    // CRITICAL: Only set isTracking after permissions are granted
    this.isTracking = true;

    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      const { status: reqBgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (reqBgStatus !== 'granted') {
        logger.warn('Background location permission denied - fallback to foreground only');
        // Don't return, we can still try foreground
      }
    }

    // Start Background Location Updates (ELITE 24/7)
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50, // Update every 50 meters
          deferredUpdatesInterval: 60 * 1000, // Minimum time between updates (1 min) - Battery saving
          pausesUpdatesAutomatically: false, // CRITICAL: Keep running
          showsBackgroundLocationIndicator: true, // Required for iOS
          foregroundService: {
            notificationTitle: "AfetNet Aktif",
            notificationBody: "Konumunuz güvende kalmanız için izleniyor.",
            notificationColor: "#C62828",
          },
        });
        logger.info('Background location task started');
      }
    } catch (e) {
      logger.error('Failed to start background location task:', e);
      // Fallback to old interval method if native task fails
      const fallbackIntervalMs = Math.max(10 * 1000, this.shareThrottleMs);
      this.locationInterval = setInterval(() => {
        void this.shareMyLocation({ reason: 'fallback-interval' });
      }, fallbackIntervalMs);
    }

    // FIX #4: Location subscriptions are managed centrally by familyStore.
    // This prevents duplicate Firestore listeners.

    // Share immediately
    await this.shareMyLocation({ force: true, reason: 'startTracking' });
  }

  /**
     * Stop tracking
     */
  stopTracking(consumerId?: string) {
    if (consumerId) {
      this.trackingConsumers.delete(consumerId);
      if (this.trackingConsumers.size > 0) {
        if (__DEV__) {
          logger.debug(`Tracking still active for ${this.trackingConsumers.size} consumer(s)`);
        }
        return;
      }
    } else {
      this.trackingConsumers.clear();
    }

    // Stop native background task
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
      .then((started) => {
        if (!started) return;
        return Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      })
      .catch(err => {
        logger.warn('Failed to stop background updates', err);
      });

    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }

    this.isTracking = false;
    logger.info('Family Tracking Stopped');
  }

  setShareThrottleMs(intervalMs: number): void {
    const normalized = Math.max(10 * 1000, Math.min(5 * 60 * 1000, Math.floor(intervalMs)));
    this.shareThrottleMs = normalized;
  }

  /**
     * Add a family member
     */
  async addMember(member: Omit<FamilyMember, 'status' | 'lastSeen' | 'isOnline'>) {
    const newMember: FamilyMember = {
      ...member,
      status: 'unknown',
      lastSeen: 0,
      isOnline: false,
    };
    this.members.push(newMember);
    await this.saveMembers();
    logger.info(`Added family member: ${member.name}`);
  }

  /**
     * Remove a family member
     */
  async removeMember(id: string) {
    this.members = this.members.filter((m) => m.id !== id);
    await this.saveMembers();
  }

  /**
     * Get all family members
     * ELITE: Returns lastKnownLocation coordinates when member is offline
     */
  getMembers(): FamilyMember[] {
    this.syncMembersFromStore();
    const now = Date.now();
    return this.members.map((m) => {
      const isOnline = now - m.lastSeen < STALE_THRESHOLD;
      const memberStatus = now - m.lastSeen > STALE_THRESHOLD ? 'offline' : m.status;

      // ELITE: If offline and we have lastKnownLocation, use those coordinates
      // This is the "Find My" magic - battery died but we still show the last position
      let effectiveLatitude = m.location?.latitude;
      let effectiveLongitude = m.location?.longitude;

      if (!isOnline && m.lastKnownLocation) {
        effectiveLatitude = m.lastKnownLocation.latitude;
        effectiveLongitude = m.lastKnownLocation.longitude;
        logger.debug(`📍 Using lastKnownLocation for ${m.name} (captured at ${m.lastKnownLocation.batteryLevelAtCapture}%)`);
      }

      // ELITE: Use proper undefined check instead of || to handle 0 coordinates correctly
      const finalLatitude = effectiveLatitude !== undefined ? effectiveLatitude : (m.location?.latitude ?? 0);
      const finalLongitude = effectiveLongitude !== undefined ? effectiveLongitude : (m.location?.longitude ?? 0);

      return {
        ...m,
        latitude: finalLatitude,
        longitude: finalLongitude,
        isOnline,
        status: memberStatus,
      };
    });
  }

  /**
     * Update member location (from mesh network or server)
     */
  /**
     * Update member location (Hybrid: Mesh or Cloud)
     * ELITE: Conflict Resolution - Always keep the freshest data
     */
  updateMemberLocation(
    memberId: string,
    location: { latitude: number; longitude: number; timestamp?: number },
    batteryLevel?: number,
    source: 'gps' | 'mesh' | 'cloud' | 'manual' = 'cloud',
  ) {
    this.syncMembersFromStore();
    const member = this.members.find((m) => m.id === memberId);
    if (member) {
      const newTimestamp = location.timestamp || Date.now();

      // ELITE: Only update if new data is newer than what we have
      const currentTimestamp = member.location?.timestamp || 0;
      if (newTimestamp < currentTimestamp) {
        return; // Ignore stale update
      }

      member.location = {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: newTimestamp,
      };
      member.lastSeen = newTimestamp;
      member.isOnline = true;

      if (batteryLevel !== undefined) {
        member.batteryLevel = batteryLevel;

        // ELITE: Auto-capture lastKnownLocation when battery is critically low
        // This is the "Find My" feature: even if battery dies, we have the last location
        if (batteryLevel <= 15) {
          member.lastKnownLocation = {
            latitude: location.latitude,
            longitude: location.longitude,
            timestamp: newTimestamp,
            batteryLevelAtCapture: batteryLevel,
            source: source,
          };
          logger.info(`📍 LAST KNOWN LOCATION CAPTURED for ${member.name} (Battery: ${batteryLevel}%)`);
        }
      }

      // Notify callbacks
      this.notifyStatusChange(member);
      this.saveMembers();

      useFamilyStore.getState().updateMemberLocation(memberId, location.latitude, location.longitude).catch((error) => {
        logger.warn('Failed to sync member location to FamilyStore', error);
      });
    } else if (__DEV__) {
      logger.debug(`Member not found for location update: ${memberId}`);
    }
  }

  /**
     * Update member safety status
     */
  updateMemberStatus(memberId: string, status: FamilyMember['status']) {
    this.syncMembersFromStore();
    const member = this.members.find((m) => m.id === memberId);
    if (member) {
      member.status = status;
      member.lastSeen = Date.now();
      this.notifyStatusChange(member);
      this.saveMembers();

      const normalizedStatus: 'safe' | 'need-help' | 'critical' | 'unknown' =
        status === 'danger'
          ? 'need-help'
          : status === 'offline'
            ? 'unknown'
            : (status as 'safe' | 'need-help' | 'critical' | 'unknown');

      useFamilyStore.getState().updateMemberStatus(memberId, normalizedStatus).catch((error) => {
        logger.warn('Failed to sync member status to FamilyStore', error);
      });
    }
  }

  /**
     * Share my location with family (via mesh and/or server)
     */
  async shareMyLocation(options: { force?: boolean; reason?: string } = {}): Promise<boolean> {
    const { force = false, reason = 'manual' } = options;

    if (!useSettingsStore.getState().locationEnabled) {
      if (__DEV__) {
        logger.debug('Skipping location share because location is disabled in settings');
      }
      return false;
    }

    if (this.shareInFlight) {
      return this.shareInFlight;
    }

    const now = Date.now();
    if (!force && this.lastShareTimestamp > 0 && now - this.lastShareTimestamp < this.shareThrottleMs) {
      if (__DEV__) {
        logger.debug(`Skipping location share (${reason}) due to throttle window`);
      }
      return false;
    }

    this.shareInFlight = (async () => {
      try {
        const loc = await this.getCurrentPositionWithTimeout();
        if (!loc?.coords) {
          logger.warn('Location fetch timed out or returned empty coordinates');
          return false;
        }

        const latitude = loc.coords.latitude;
        const longitude = loc.coords.longitude;
        if (!this.isValidCoordinatePair(latitude, longitude)) {
          logger.warn('Location share aborted due to invalid coordinates', { latitude, longitude });
          return false;
        }

        const timestamp = Date.now();
        const identity = identityService.getIdentity();
        const cloudTargetIds = new Set<string>();
        if (identity?.id && identity.id !== 'unknown') {
          cloudTargetIds.add(identity.id);
        }
        if (identity?.deviceId && identity.deviceId !== 'unknown') {
          cloudTargetIds.add(identity.deviceId);
        }
        try {
          const physicalDeviceId = await getDeviceIdFromLib();
          if (physicalDeviceId) {
            cloudTargetIds.add(physicalDeviceId);
          }
        } catch (error) {
          logger.debug('Could not resolve physical device ID for location fan-out', error);
        }

        // 1. Share via Mesh first (offline-first)
        try {
          bleMeshService.shareLocation(latitude, longitude);
        } catch (meshError) {
          logger.warn('Mesh location share failed', meshError);
        }

        this.lastShareTimestamp = timestamp;

        // 2. Share via Cloud (QR ID + physical device ID fan-out for compatibility)
        // Cloud fan-out runs only when auth is ready.
        const { getAuth } = await import('firebase/auth');
        const currentUser = getAuth().currentUser;
        if (cloudTargetIds.size > 0 && currentUser) {
          const payload = {
            latitude,
            longitude,
            timestamp,
            accuracy: loc.coords.accuracy || 0,
            speed: loc.coords.speed || 0,
            heading: loc.coords.heading || 0,
          };

          const targetIds = Array.from(cloudTargetIds);
          const results = await Promise.all(
            targetIds.map((targetId) => this.saveLocationWithRetry(targetId, payload)),
          );

          const successCount = results.filter(Boolean).length;
          if (successCount === 0) {
            logger.warn('Cloud location fan-out failed for all target IDs');
          } else if (successCount < targetIds.length) {
            logger.warn(`Cloud location fan-out partial success: ${successCount}/${targetIds.length}`);
          }
        } else if (cloudTargetIds.size > 0 && !currentUser) {
          logger.debug('Cloud fan-out skipped: auth not ready (mesh still active)');
        }

        logger.debug(`Location shared (Hybrid, reason: ${reason})`);
        return true;
      } catch (e) {
        logger.warn('Failed to share location', e);
        return false;
      } finally {
        this.shareInFlight = null;
      }
    })();

    return this.shareInFlight;
  }

  /**
     * Broadcast bio-status (Heart Rate & Battery)
     * ELITE: Real-time health monitoring for family safety
     */
  async broadcastBioStatus(data: { hr: number; battery: number }) {
    // 1. Update local member state (myself)
    // We typically don't store "myself" in members array, but if we did:
    // const myId = identityService.getMyId();
    // this.updateMemberBio(myId, data);

    // 2. Share via Mesh (for offline peer-to-peer communication)
    // ELITE: Using broadcastMessage with BIO type for mesh network propagation
    bleMeshService.broadcastMessage({
      type: 'BIO',
      content: JSON.stringify({ hr: data.hr, battery: data.battery, ts: Date.now() }),
      priority: 'high',
      ttl: 3,  // Limited TTL for bio updates
    });

    // 3. Share via Cloud (Firebase)
    const myId = identityService.getMyId();
    if (myId && myId !== 'unknown') {
      try {
        await firebaseDataService.saveStatusUpdate(myId, {
          heartRate: data.hr,
          batteryLevel: data.battery,
          lastBioUpdate: Date.now(),
          status: 'online', // Implicitly online if sending data
        });
        logger.debug(`Bio-status broadcasted: HR ${data.hr} | Bat ${data.battery}%`);
      } catch (e) {
        logger.warn('Failed to broadcast bio-status to cloud', e);
      }
    }
  }

  /**
   * Send check-in request to a family member
   * CRITICAL: Real multi-channel delivery (Firebase + BLE mesh)
   */
  async requestCheckIn(memberId: string) {
    this.syncMembersFromStore();
    const member = this.members.find(m => m.id === memberId);
    if (!member) {
      logger.warn(`Check-in request failed: member ${memberId} not found`);
      return;
    }

    const targetDeviceId = member.deviceId || member.id;
    logger.info(`📤 Sending check-in request to ${member.name} (${targetDeviceId})`);

    let sent = false;

    // CHANNEL 1: Firebase cloud message (works online)
    try {
      if (firebaseDataService.isInitialized) {
        const myDeviceId = await getDeviceIdFromLib();
        const messageData = {
          id: `checkin_${Date.now()}_${targetDeviceId}`,
          fromDeviceId: myDeviceId,
          toDeviceId: targetDeviceId,
          content: '📍 Güvende misiniz? Lütfen durumunuzu bildirin.',
          timestamp: Date.now(),
          type: 'status' as const,
          status: 'sent' as const,
          priority: 'high' as const,
        };

        // FIX: Write to RECIPIENT's inbox so they actually receive it
        await firebaseDataService.saveMessage(targetDeviceId, messageData);

        // Also save sender's copy for conversation history
        await firebaseDataService.saveMessage(myDeviceId, messageData);

        sent = true;
        logger.info(`✅ Check-in request sent to ${member.name} via Firebase`);
      }
    } catch (fbError) {
      logger.warn(`Firebase check-in request failed for ${member.name}:`, fbError);
    }

    // CHANNEL 2: BLE mesh message (works offline)
    try {
      await bleMeshService.broadcastMessage({
        type: 'status',
        content: JSON.stringify({
          action: 'CHECK_IN_REQUEST',
          targetDeviceId,
          targetName: member.name,
          timestamp: Date.now(),
        }),
        priority: 'high',
        ttl: 5,
      });
      sent = true;
      logger.info(`✅ Check-in request sent to ${member.name} via BLE mesh`);
    } catch (bleError) {
      logger.warn(`BLE check-in request failed for ${member.name}:`, bleError);
    }

    if (!sent) {
      logger.error(`❌ Failed to send check-in request to ${member.name} via any channel`);
    }
  }

  /**
     * Register callback for status changes
     */
  onStatusChange(callback: (member: FamilyMember) => void) {
    this.statusCallbacks.push(callback);
    return () => {
      const idx = this.statusCallbacks.indexOf(callback);
      if (idx > -1) this.statusCallbacks.splice(idx, 1);
    };
  }

  // Private Methods

  private async saveMembers() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.members));
    } catch (e) {
      logger.error('Failed to save family members', e);
    }
  }

  private notifyStatusChange(member: FamilyMember) {
    for (const cb of this.statusCallbacks) {
      try {
        cb(member);
      } catch (e) {
        logger.error('Status callback error', e);
      }
    }
  }

  private isValidCoordinatePair(latitude: number, longitude: number): boolean {
    return Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && latitude >= -90
      && latitude <= 90
      && longitude >= -180
      && longitude <= 180;
  }

  private async getCurrentPositionWithTimeout(timeoutMs: number = 12000): Promise<Location.LocationObject | null> {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timeoutPromise = new Promise<Location.LocationObject | null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      });

      return await Promise.race([locationPromise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async saveLocationWithRetry(
    targetId: string,
    payload: {
      latitude: number;
      longitude: number;
      timestamp: number;
      accuracy: number;
      speed: number;
      heading: number;
    },
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= CLOUD_RETRY_ATTEMPTS; attempt++) {
      try {
        const ok = await firebaseDataService.saveLocationUpdate(targetId, payload);
        if (ok) {
          return true;
        }
      } catch (error) {
        if (__DEV__) {
          logger.debug(`Cloud location save attempt ${attempt} failed for ${targetId}`, error);
        }
      }

      if (attempt < CLOUD_RETRY_ATTEMPTS) {
        const backoffMs = CLOUD_RETRY_BACKOFF_MS * attempt;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
    return false;
  }
}

export const familyTrackingService = new FamilyTrackingService();
