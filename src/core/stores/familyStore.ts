/**
 * FAMILY STORE - Family Member Tracking
 * Persistent storage with AsyncStorage + Firebase Firestore sync
 * Data survives app restarts and syncs across devices
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { getDeviceId } from '../../lib/device';
import { initializeFirebase } from '../../lib/firebase';
import { FamilyMember } from '../types/family';
import { createLogger } from '../utils/logger';

const logger = createLogger('FamilyStore');

// ELITE: Type definition for lazy imported FirebaseDataService
interface FirebaseDataServiceType {
  isInitialized: boolean;
  saveDeviceId: (deviceId: string) => Promise<boolean>;
  loadFamilyMembers: (deviceId: string) => Promise<FamilyMember[]>;
  saveFamilyMember: (deviceId: string, member: FamilyMember) => Promise<boolean>;
  deleteFamilyMember: (deviceId: string, memberId: string) => Promise<boolean>;
  subscribeToDeviceLocation?: (
    deviceId: string,
    callback: (location: any) => void
  ) => Promise<() => void>;
  subscribeToFamilyMembers?: (
    deviceId: string,
    callback: (members: FamilyMember[]) => void,
    onError?: (error: Error) => void
  ) => Promise<(() => void) | null>;
}

// ELITE: Lazy import to break circular dependency
let firebaseDataService: FirebaseDataServiceType | null = null;
const getFirebaseDataService = (): FirebaseDataServiceType | null => {
  if (!firebaseDataService) {
    try {
      firebaseDataService = require('../services/FirebaseDataService').firebaseDataService;
    } catch {
      return null;
    }
  }
  return firebaseDataService;
};

const memberLocationSubscriptions = new Map<string, () => void>();

const clearMemberLocationSubscriptions = () => {
  memberLocationSubscriptions.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch {
      // no-op
    }
  });
  memberLocationSubscriptions.clear();
};

// Re-export for backward compatibility
export type { FamilyMember };

interface FamilyState {
  members: FamilyMember[];
  // ELITE: Store Firebase unsubscribe function for cleanup
  firebaseUnsubscribe: (() => void) | null;
}

interface FamilyActions {
  initialize: () => Promise<void>;
  addMember: (member: Omit<FamilyMember, 'id'> & { id?: string }) => Promise<void>;
  updateMember: (id: string, updates: Partial<FamilyMember>) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  updateMemberLocation: (id: string, latitude: number, longitude: number) => Promise<void>;
  updateMemberStatus: (id: string, status: FamilyMember['status']) => Promise<void>;
  clear: () => Promise<void>;
}

const STORAGE_KEY_BASE = '@afetnet:family_members';
const STORAGE_GUEST_SCOPE = 'guest';

const getScopedStorageKey = (): string => {
  try {
    const app = initializeFirebase();
    if (!app) return `${STORAGE_KEY_BASE}:${STORAGE_GUEST_SCOPE}`;
    const uid = getAuth(app).currentUser?.uid;
    return uid ? `${STORAGE_KEY_BASE}:user:${uid}` : `${STORAGE_KEY_BASE}:${STORAGE_GUEST_SCOPE}`;
  } catch {
    return `${STORAGE_KEY_BASE}:${STORAGE_GUEST_SCOPE}`;
  }
};

const initialState: FamilyState = {
  members: [],
  firebaseUnsubscribe: null,
};

// Load from storage
const loadMembers = async (): Promise<FamilyMember[]> => {
  try {
    const scopedKey = getScopedStorageKey();
    let data = await AsyncStorage.getItem(scopedKey);
    if (!data) {
      data = await AsyncStorage.getItem(STORAGE_KEY_BASE);
      if (data) {
        await AsyncStorage.setItem(scopedKey, data);
      }
    }
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to load family members:', error);
  }
  return [];
};

// Save to storage
const saveMembers = async (members: FamilyMember[]) => {
  try {
    await AsyncStorage.setItem(getScopedStorageKey(), JSON.stringify(members));
  } catch (error) {
    logger.error('Failed to save family members:', error);
  }
};

const syncMemberLocationSubscriptions = async (
  members: FamilyMember[],
  onLocation: (memberId: string, latitude: number, longitude: number) => void,
) => {
  const firebaseService = getFirebaseDataService();
  if (!firebaseService?.isInitialized || !firebaseService.subscribeToDeviceLocation) {
    clearMemberLocationSubscriptions();
    return;
  }

  const desiredKeys = new Set<string>();

  for (const member of members) {
    const targetDeviceId = member.deviceId || member.id;
    if (!targetDeviceId) {
      continue;
    }

    const key = `${member.id}:${targetDeviceId}`;
    desiredKeys.add(key);

    if (memberLocationSubscriptions.has(key)) {
      continue;
    }

    try {
      const unsubscribe = await firebaseService.subscribeToDeviceLocation(targetDeviceId, (location) => {
        if (
          location &&
          typeof location.latitude === 'number' &&
          !isNaN(location.latitude) &&
          typeof location.longitude === 'number' &&
          !isNaN(location.longitude)
        ) {
          onLocation(member.id, location.latitude, location.longitude);
        }
      });

      if (typeof unsubscribe === 'function') {
        memberLocationSubscriptions.set(key, unsubscribe);
      }
    } catch (error) {
      logger.warn(`Failed to subscribe location for member ${member.id}:`, error);
    }
  }

  Array.from(memberLocationSubscriptions.keys()).forEach((key) => {
    if (desiredKeys.has(key)) {
      return;
    }
    const unsubscribe = memberLocationSubscriptions.get(key);
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch {
        // no-op
      }
    }
    memberLocationSubscriptions.delete(key);
  });
};

export const useFamilyStore = create<FamilyState & FamilyActions>((set, get) => ({
  ...initialState,

  // Initialize by loading from storage and Firebase
  initialize: async () => {
    // ELITE: Cleanup existing Firebase subscription before re-initializing
    const { firebaseUnsubscribe } = get();
    if (firebaseUnsubscribe && typeof firebaseUnsubscribe === 'function') {
      try {
        firebaseUnsubscribe();
      } catch (error) {
        if (__DEV__) {
          logger.debug('Error unsubscribing from old Firebase family subscription:', error);
        }
      }
      set({ firebaseUnsubscribe: null });
    }
    clearMemberLocationSubscriptions();

    // First load from AsyncStorage (fast)
    const localMembers = await loadMembers();
    set({ members: localMembers });
    await syncMemberLocationSubscriptions(localMembers, (memberId, latitude, longitude) => {
      void get().updateMemberLocation(memberId, latitude, longitude);
    });

    // Then try to sync from Firebase (lazy load to avoid circular dependency)
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          // Save device ID to Firebase
          await firebaseService.saveDeviceId(deviceId);

          // Load family members from Firebase
          const cloudMembers = await firebaseService.loadFamilyMembers(deviceId);

          // Merge: Firebase takes precedence if both exist
          if (cloudMembers && cloudMembers.length > 0) {
            set({ members: cloudMembers });
            // Save merged data to AsyncStorage
            await saveMembers(cloudMembers);
            await syncMemberLocationSubscriptions(cloudMembers, (memberId, latitude, longitude) => {
              void get().updateMemberLocation(memberId, latitude, longitude);
            });
          }

          // ELITE: Subscribe to real-time family member updates
          try {
            const unsubscribe = await firebaseService.subscribeToFamilyMembers?.(deviceId, async (firebaseMembers) => {
              try {
                // ELITE: Merge Firebase members with local state
                const currentMembers = get().members;
                const memberMap = new Map(currentMembers.map(m => [m.id, m]));

                // Update or add Firebase members
                firebaseMembers.forEach((member: FamilyMember) => {
                  if (member && member.id) {
                    memberMap.set(member.id, member);
                  }
                });

                const mergedMembers = Array.from(memberMap.values());
                set({ members: mergedMembers });
                await saveMembers(mergedMembers);
                await syncMemberLocationSubscriptions(mergedMembers, (memberId, latitude, longitude) => {
                  void get().updateMemberLocation(memberId, latitude, longitude);
                });
              } catch (error) {
                logger.error('Error processing real-time family members:', error);
              }
            });

            // ELITE: Store unsubscribe function for cleanup
            if (unsubscribe && typeof unsubscribe === 'function') {
              set({ firebaseUnsubscribe: unsubscribe });
            }
          } catch (subscribeError: unknown) {
            // ELITE: Don't log permission errors as errors - they're expected in offline-first apps
            const errorObj = subscribeError as { code?: string; message?: string };
            if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission') || errorObj?.message?.includes('Missing or insufficient permissions')) {
              if (__DEV__) {
                logger.debug('Firebase family subscription permission denied (app continues with local storage)');
              }
            } else {
              logger.error('Firebase family subscription error:', subscribeError);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Firebase sync failed, using local data:', error);
    }
  },

  addMember: async (member) => {
    const { members } = get();
    // ELITE: Allow explicit ID (e.g. from QR code) or generate new one
    const newMember: FamilyMember = {
      ...member,
      id: member.id || `family-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    const updatedMembers = [...members, newMember];
    set({ members: updatedMembers });
    await syncMemberLocationSubscriptions(updatedMembers, (memberId, latitude, longitude) => {
      void get().updateMemberLocation(memberId, latitude, longitude);
    });

    // Save to AsyncStorage
    await saveMembers(updatedMembers);

    // ELITE: Save to Firebase with offline sync queue
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          // Try direct save first, fallback to sync queue
          const success = await firebaseService.saveFamilyMember(deviceId, newMember);
          if (!success) {
            // Queue for offline sync
            const { offlineSyncService } = await import('../services/OfflineSyncService');
            await offlineSyncService.queueOperation({
              type: 'save',
              data: {
                ownerDeviceId: deviceId,
                member: newMember,
              },
              priority: 'normal',
            });
          }
        } else {
          // Firebase not initialized - queue for later
          const { offlineSyncService } = await import('../services/OfflineSyncService');
          await offlineSyncService.queueOperation({
            type: 'save',
            data: {
              ownerDeviceId: deviceId,
              member: newMember,
            },
            priority: 'normal',
          });
        }
      }
    } catch (error) {
      logger.error('Failed to save to Firebase:', error);
      // Queue for offline sync on error
      try {
        const { offlineSyncService } = await import('../services/OfflineSyncService');
        await offlineSyncService.queueOperation({
          type: 'save',
          data: {
            ownerDeviceId: await getDeviceId(),
            member: newMember,
          },
          priority: 'normal',
        });
      } catch (syncError) {
        logger.error('Failed to queue for sync:', syncError);
      }
    }

    // CRITICAL: Send to backend for rescue coordination
    // ELITE: This ensures rescue teams know who to look for during disasters
    try {
      const { backendEmergencyService } = await import('../services/BackendEmergencyService');
      if (backendEmergencyService.initialized) {
        await backendEmergencyService.sendFamilyMemberData({
          memberId: newMember.id,
          name: newMember.name,
          status: newMember.status,
          location: newMember.location ? {
            latitude: newMember.location.latitude,
            longitude: newMember.location.longitude,
            timestamp: newMember.location?.timestamp || Date.now() || Date.now(),
          } : undefined,
          lastSeen: newMember.lastSeen,
          relationship: newMember.relationship,
          phoneNumber: newMember.phoneNumber,
        }).catch((error) => {
          // ELITE: Backend save failures are logged but don't block app
          logger.error('Failed to send family member to backend:', error);
        });
      }
    } catch (error) {
      // ELITE: Backend save is optional - app continues without it
      logger.error('Failed to send family member to backend:', error);
    }
  },

  updateMember: async (id, updates) => {
    const { members } = get();
    const updatedMembers = members.map(m => m.id === id ? { ...m, ...updates, lastSeen: Date.now() } : m);
    const updatedMember = updatedMembers.find(m => m.id === id);
    set({ members: updatedMembers });
    await syncMemberLocationSubscriptions(updatedMembers, (memberId, latitude, longitude) => {
      void get().updateMemberLocation(memberId, latitude, longitude);
    });

    // Save to AsyncStorage
    await saveMembers(updatedMembers);

    // ELITE: Save to Firebase with offline sync queue
    if (updatedMember) {
      try {
        const deviceId = await getDeviceId();
        if (deviceId) {
          const firebaseService = getFirebaseDataService();
          if (firebaseService?.isInitialized) {
            const success = await firebaseService.saveFamilyMember(deviceId, updatedMember);
            if (!success) {
              // Queue for offline sync
              const { offlineSyncService } = await import('../services/OfflineSyncService');
              await offlineSyncService.queueOperation({
                type: 'update',
                data: {
                  ownerDeviceId: deviceId,
                  member: updatedMember,
                },
                priority: 'normal',
              });
            }
          } else {
            // Queue for offline sync
            const { offlineSyncService } = await import('../services/OfflineSyncService');
            await offlineSyncService.queueOperation({
              type: 'update',
              data: {
                ownerDeviceId: deviceId,
                member: updatedMember,
              },
              priority: 'normal',
            });
          }
        }
      } catch (error) {
        logger.error('Failed to update in Firebase:', error);
        // Queue for offline sync on error
        try {
          const { offlineSyncService } = await import('../services/OfflineSyncService');
          await offlineSyncService.queueOperation({
            type: 'update',
            data: {
              ownerDeviceId: await getDeviceId(),
              member: updatedMember,
            },
            priority: 'normal',
          });
        } catch (syncError) {
          logger.error('Failed to queue for sync:', syncError);
        }
      }

      // CRITICAL: Send update to backend for rescue coordination
      try {
        const { backendEmergencyService } = await import('../services/BackendEmergencyService');
        if (backendEmergencyService.initialized) {
          await backendEmergencyService.sendFamilyMemberData({
            memberId: updatedMember.id,
            name: updatedMember.name,
            status: updatedMember.status,
            location: updatedMember.location ? {
              latitude: updatedMember.location.latitude,
              longitude: updatedMember.location.longitude,
              timestamp: updatedMember.location?.timestamp || Date.now() || Date.now(),
            } : undefined,
            lastSeen: updatedMember.lastSeen,
            relationship: updatedMember.relationship,
            phoneNumber: updatedMember.phoneNumber,
          }).catch((error) => {
            logger.error('Failed to send member update to backend:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to send member update to backend:', error);
      }
    }
  },

  removeMember: async (id) => {
    const { members } = get();
    const updatedMembers = members.filter(m => m.id !== id);
    set({ members: updatedMembers });
    await syncMemberLocationSubscriptions(updatedMembers, (memberId, latitude, longitude) => {
      void get().updateMemberLocation(memberId, latitude, longitude);
    });

    // Save to AsyncStorage
    await saveMembers(updatedMembers);

    // ELITE: Delete from Firebase with offline sync queue
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          const success = await firebaseService.deleteFamilyMember(deviceId, id);
          if (!success) {
            // Queue for offline sync
            const { offlineSyncService } = await import('../services/OfflineSyncService');
            await offlineSyncService.queueOperation({
              type: 'delete',
              data: {
                ownerDeviceId: deviceId,
                memberId: id,
              },
              priority: 'normal',
            });
          }
        } else {
          // Queue for offline sync
          const { offlineSyncService } = await import('../services/OfflineSyncService');
          await offlineSyncService.queueOperation({
            type: 'delete',
            data: {
              ownerDeviceId: deviceId,
              memberId: id,
            },
            priority: 'normal',
          });
        }
      }
    } catch (error) {
      logger.error('Failed to delete from Firebase:', error);
      // Queue for offline sync on error
      try {
        const { offlineSyncService } = await import('../services/OfflineSyncService');
        await offlineSyncService.queueOperation({
          type: 'delete',
          data: {
            ownerDeviceId: await getDeviceId(),
            memberId: id,
          },
          priority: 'normal',
        });
      } catch (syncError) {
        logger.error('Failed to queue for sync:', syncError);
      }
    }

    // CRITICAL: Delete from backend for rescue coordination
    try {
      const { backendEmergencyService } = await import('../services/BackendEmergencyService');
      if (backendEmergencyService.initialized) {
        await backendEmergencyService.deleteFamilyMember(id).catch((error) => {
          logger.error('Failed to delete family member from backend:', error);
        });
      }
    } catch (error) {
      logger.error('Failed to delete family member from backend:', error);
    }
  },

  updateMemberLocation: async (id, latitude, longitude) => {
    // ELITE: Validate inputs
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      logger.error('Invalid member ID for location update:', id);
      return;
    }

    if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
      logger.error('Invalid latitude:', latitude);
      return;
    }

    if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
      logger.error('Invalid longitude:', longitude);
      return;
    }

    const { members } = get();
    // OPTIMIZED: Check if update is actually needed (prevents unnecessary re-renders)
    const existingMember = members.find(m => m.id === id);
    if (!existingMember) {
      logger.warn('Member not found for location update:', id);
      return;
    }

    const locationChanged =
      existingMember.latitude !== latitude ||
      existingMember.longitude !== longitude ||
      existingMember.location?.latitude !== latitude ||
      existingMember.location?.longitude !== longitude;

    if (!locationChanged) {
      // Location unchanged - no need to update
      return;
    }

    // ELITE: Update both latitude/longitude (for backward compatibility) and location object
    const updatedMembers = members.map(m =>
      m.id === id
        ? {
          ...m,
          latitude, // Update direct properties for backward compatibility
          longitude,
          location: { latitude, longitude, timestamp: Date.now() }, // Update location object
          lastSeen: Date.now(),
        }
        : m,
    );
    const updatedMember = updatedMembers.find(m => m.id === id);
    set({ members: updatedMembers });

    // Save to AsyncStorage
    await saveMembers(updatedMembers);

    // Save to Firebase (lazy load to avoid circular dependency)
    if (updatedMember) {
      try {
        const deviceId = await getDeviceId();
        if (deviceId) {
          const firebaseService = getFirebaseDataService();
          if (firebaseService?.isInitialized) {
            await firebaseService.saveFamilyMember(deviceId, updatedMember);
          }
        }
      } catch (error) {
        logger.error('Failed to update location in Firebase:', error);
      }

      // CRITICAL: Send location update to backend for rescue coordination
      try {
        const { backendEmergencyService } = await import('../services/BackendEmergencyService');
        if (backendEmergencyService.initialized) {
          await backendEmergencyService.sendFamilyMemberData({
            memberId: updatedMember.id,
            name: updatedMember.name,
            status: updatedMember.status,
            location: {
              latitude,
              longitude,
              timestamp: Date.now(),
            },
            lastSeen: updatedMember.lastSeen,
            relationship: updatedMember.relationship,
            phoneNumber: updatedMember.phoneNumber,
          }).catch((error) => {
            logger.error('Failed to send location update to backend:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to send location update to backend:', error);
      }
    }

    // ELITE: Send notification for significant location changes (only if member is in critical status)
    if (locationChanged && updatedMember && (updatedMember.status === 'critical' || updatedMember.status === 'need-help')) {
      try {
        const { notificationService } = await import('../services/NotificationService');
        await notificationService.showFamilyLocationUpdateNotification(
          updatedMember.name,
          { latitude, longitude },
        ).catch((error) => {
          logger.error('Failed to send location update notification:', error);
        });
      } catch (error) {
        logger.error('Failed to import notification service:', error);
      }
    }
  },

  updateMemberStatus: async (id, status) => {
    const { members } = get();
    // OPTIMIZED: Check if update is actually needed (prevents unnecessary re-renders)
    const existingMember = members.find(m => m.id === id);
    const statusChanged = existingMember && existingMember.status !== status;
    if (!statusChanged && existingMember && existingMember.status === status) {
      // Status unchanged, skip update - Zustand will prevent re-render anyway, but this is more efficient
      return;
    }

    const updatedMembers = members.map(m => m.id === id ? { ...m, status, lastSeen: Date.now() } : m);
    const updatedMember = updatedMembers.find(m => m.id === id);
    set({ members: updatedMembers });

    // Save to AsyncStorage
    await saveMembers(updatedMembers);

    // Save to Firebase (lazy load to avoid circular dependency)
    if (updatedMember) {
      try {
        const deviceId = await getDeviceId();
        if (deviceId) {
          const firebaseService = getFirebaseDataService();
          if (firebaseService?.isInitialized) {
            await firebaseService.saveFamilyMember(deviceId, updatedMember);
          }
        }
      } catch (error) {
        logger.error('Failed to update status in Firebase:', error);
      }

      // CRITICAL: Send status update to backend for rescue coordination
      try {
        const { backendEmergencyService } = await import('../services/BackendEmergencyService');
        if (backendEmergencyService.initialized) {
          await backendEmergencyService.sendFamilyMemberData({
            memberId: updatedMember.id,
            name: updatedMember.name,
            status,
            location: updatedMember.location ? {
              latitude: updatedMember.location.latitude,
              longitude: updatedMember.location.longitude,
              timestamp: updatedMember.location?.timestamp || Date.now() || Date.now(),
            } : undefined,
            lastSeen: updatedMember.lastSeen,
            relationship: updatedMember.relationship,
            phoneNumber: updatedMember.phoneNumber,
          }).catch((error) => {
            logger.error('Failed to send status update to backend:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to send status update to backend:', error);
      }
    }

    // ELITE: Send notification for critical status changes
    if (statusChanged && updatedMember && (status === 'critical' || status === 'need-help')) {
      try {
        const { multiChannelAlertService } = await import('../services/MultiChannelAlertService');
        const statusText = status === 'critical' ? 'KRİTİK DURUM' : 'YARDIM GEREKİYOR';
        await multiChannelAlertService.sendAlert({
          title: `⚠️ ${updatedMember.name} - ${statusText}`,
          body: `${updatedMember.name} durumu "${status}" olarak güncellendi.`,
          priority: status === 'critical' ? 'critical' : 'high',
          channels: {
            pushNotification: true,
            fullScreenAlert: status === 'critical',
            alarmSound: status === 'critical',
            vibration: true,
            tts: true,
          },
          data: {
            type: 'family_status',
            memberId: id,
            memberName: updatedMember.name,
            status,
          },
        }).catch((error) => {
          logger.error('Failed to send family status alert:', error);
        });
      } catch (error) {
        logger.error('Failed to import multi-channel alert service:', error);
      }
    }
  },

  clear: async () => {
    // ELITE: Cleanup Firebase subscription before clearing
    const { firebaseUnsubscribe } = get();
    if (firebaseUnsubscribe && typeof firebaseUnsubscribe === 'function') {
      try {
        firebaseUnsubscribe();
      } catch (error) {
        logger.error('Error unsubscribing from Firebase family members:', error);
      }
    }
    clearMemberLocationSubscriptions();

    set({ ...initialState, firebaseUnsubscribe: null });
    await AsyncStorage.removeItem(getScopedStorageKey()).catch((error) => {
      logger.error('Failed to clear AsyncStorage:', error);
    });
    await AsyncStorage.removeItem(STORAGE_KEY_BASE).catch(() => {
      // legacy key cleanup
    });

    // Clear Firebase data (lazy load to avoid circular dependency)
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          const members = get().members;
          for (const member of members) {
            await firebaseService.deleteFamilyMember(deviceId, member.id);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to clear Firebase:', error);
    }
  },
}));
