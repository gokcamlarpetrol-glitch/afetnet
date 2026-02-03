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

const logger = createLogger('FamilyTrackingService');

const STORAGE_KEY = '@afetnet:family_members';
const LOCATION_UPDATE_INTERVAL = 60000; // 1 minute
const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export interface FamilyMember {
    id: string;
    name: string;
    phone?: string;
    photo?: string;
    location?: {
        latitude: number;
        longitude: number;
        timestamp: number;
        accuracy?: number;
    };
    batteryLevel?: number;
    status: 'safe' | 'danger' | 'unknown' | 'offline';
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
  private locationSubscriptions: Map<string, () => void> = new Map();

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
    } catch (e) {
      logger.error('Failed to load family members', e);
    }
  }

  /**
     * Start location tracking and sharing
     */
  async startTracking() {
    if (this.isTracking) return;

    logger.info('Starting Family Tracking');
    this.isTracking = true;

    // Check and request background permissions
    const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      const { status: reqStatus } = await Location.requestForegroundPermissionsAsync();
      if (reqStatus !== 'granted') {
        logger.warn('Foreground location permission denied');
        return;
      }
    }

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
    } catch (e) {
      logger.error('Failed to start background location task:', e);
      // Fallback to old interval method if native task fails
      this.locationInterval = setInterval(() => {
        this.shareMyLocation();
      }, LOCATION_UPDATE_INTERVAL);
    }

    // Subscribe to online locations of all members
    await this.subscribeToMemberLocations();

    // Share immediately
    await this.shareMyLocation();
  }

  /**
     * Stop tracking
     */
  stopTracking() {
    // Stop native background task
    Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(err => {
      logger.warn('Failed to stop background updates', err);
    });

    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }

    // Unsubscribe from all online streams
    this.locationSubscriptions.forEach(unsubscribe => unsubscribe());
    this.locationSubscriptions.clear();

    this.isTracking = false;
    logger.info('Family Tracking Stopped');
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
     */
  getMembers(): FamilyMember[] {
    // Mark stale members as offline
    const now = Date.now();
    return this.members.map((m) => ({
      ...m,
      isOnline: now - m.lastSeen < STALE_THRESHOLD,
      status: now - m.lastSeen > STALE_THRESHOLD ? 'offline' : m.status,
    }));
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
    location: { latitude: number; longitude: number; timestamp?: number }, // Make timestamp optional for legacy calls
    batteryLevel?: number,
  ) {
    const member = this.members.find((m) => m.id === memberId);
    if (member) {
      const newTimestamp = location.timestamp || Date.now();

      // ELITE: Only update if new data is newer than what we have
      const currentTimestamp = member.location?.timestamp || 0;
      if (newTimestamp < currentTimestamp) {
        // Ignore stale update (e.g. old mesh packet arrived after new cloud update)
        return;
      }

      member.location = {
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: newTimestamp,
      };
      member.lastSeen = newTimestamp;
      // Online/Offline status is determined by staleness in getMembers()
      // But we can eagerly set it here for UI responsiveness
      member.isOnline = true;

      if (batteryLevel !== undefined) {
        member.batteryLevel = batteryLevel;
      }

      // Notify callbacks
      this.notifyStatusChange(member);
      this.saveMembers();
    }
  }

  /**
     * Update member safety status
     */
  updateMemberStatus(memberId: string, status: FamilyMember['status']) {
    const member = this.members.find((m) => m.id === memberId);
    if (member) {
      member.status = status;
      member.lastSeen = Date.now();
      this.notifyStatusChange(member);
      this.saveMembers();
    }
  }

  /**
     * Share my location with family (via mesh and/or server)
     */
  async shareMyLocation() {
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timestamp = Date.now();
      const myId = identityService.getMyId();

      // 1. Share via Mesh (Always, for offline peer-to-peer)
      bleMeshService.shareLocation(loc.coords.latitude, loc.coords.longitude);

      // 2. Share via Cloud (If Online - ELITE "Find My")
      // This pushes to our own "devices/{myId}" doc which others subscribe to
      if (myId && myId !== 'unknown') {
        // Fire and forget - don't await to keep UI responsive
        firebaseDataService.saveLocationUpdate(myId, {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: timestamp, // Use number for consistency
          accuracy: loc.coords.accuracy || 0,
          speed: loc.coords.speed || 0,
          heading: loc.coords.heading || 0,
        }).catch(e => logger.warn('Failed to push online location', e));

        // Also update the main device doc for easy subscription
        // (Using saveDeviceId with merged location would be ideal, 
        // but saveLocationUpdate logic in firebase service might need adjustment 
        // or we assume saveLocationUpdate handles the "latest" field too.
        // Based on our plan, we'll rely on saveLocationUpdate updating the device doc)
      }

      logger.debug('Location shared (Hybrid)');
    } catch (e) {
      logger.warn('Failed to share location', e);
    }
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
     * subscribe to all family members' online locations
     */
  private async subscribeToMemberLocations() {
    // Clear existing
    this.locationSubscriptions.forEach(unsubscribe => unsubscribe());
    this.locationSubscriptions.clear();

    for (const member of this.members) {
      if (!member.id) continue;

      // Subscribe to each member's device location
      const unsubscribe = await firebaseDataService.subscribeToDeviceLocation(
        member.id,
        (location) => {
          if (location && location.latitude && location.longitude) {
            this.updateMemberLocation(
              member.id,
              {
                latitude: location.latitude,
                longitude: location.longitude,
                timestamp: location.timestamp,
              },
              location.batteryLevel, // Assuming Cloud location object includes battery
            );
          }
        },
      );

      this.locationSubscriptions.set(member.id, unsubscribe);
    }
  }

  /**
     * Send check-in request to a member
     */
  async requestCheckIn(memberId: string) {
    // In production, send push notification or mesh message
    logger.info(`Check-in request sent to ${memberId}`);
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
}

export const familyTrackingService = new FamilyTrackingService();
