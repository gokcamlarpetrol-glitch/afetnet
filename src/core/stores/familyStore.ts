/**
 * FAMILY STORE - Family Member Tracking
 * Persistent storage with AsyncStorage + Firebase Firestore sync
 * Data survives app restarts and syncs across devices
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
// FIXED: Lazy import to break circular dependency
let firebaseDataService: any = null;
const getFirebaseDataService = () => {
  if (!firebaseDataService) {
    firebaseDataService = require('../services/FirebaseDataService').firebaseDataService;
  }
  return firebaseDataService;
};
import { getDeviceId } from '../../lib/device';
import { FamilyMember } from '../types/family';

// Re-export for backward compatibility
export type { FamilyMember };

interface FamilyState {
  members: FamilyMember[];
}

interface FamilyActions {
  initialize: () => Promise<void>;
  addMember: (member: Omit<FamilyMember, 'id'>) => Promise<void>;
  updateMember: (id: string, updates: Partial<FamilyMember>) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  updateMemberLocation: (id: string, latitude: number, longitude: number) => Promise<void>;
  updateMemberStatus: (id: string, status: FamilyMember['status']) => Promise<void>;
  clear: () => Promise<void>;
}

const STORAGE_KEY = '@afetnet:family_members';

const initialState: FamilyState = {
  members: [],
};

// Load from storage
const loadMembers = async (): Promise<FamilyMember[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load family members:', error);
  }
  return [];
};

// Save to storage
const saveMembers = async (members: FamilyMember[]) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(members));
  } catch (error) {
    console.error('Failed to save family members:', error);
  }
};

export const useFamilyStore = create<FamilyState & FamilyActions>((set, get) => ({
  ...initialState,
  
  // Initialize by loading from storage and Firebase
  initialize: async () => {
    // First load from AsyncStorage (fast)
    const localMembers = await loadMembers();
    set({ members: localMembers });

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
          }
        }
      }
    } catch (error) {
      console.error('Firebase sync failed, using local data:', error);
    }
  },
  
  addMember: async (member) => {
    const { members } = get();
    const newMember: FamilyMember = {
      ...member,
      id: `family-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    const updatedMembers = [...members, newMember];
    set({ members: updatedMembers });
    
    // Save to AsyncStorage
    await saveMembers(updatedMembers);
    
    // Save to Firebase (lazy load to avoid circular dependency)
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          await firebaseService.saveFamilyMember(deviceId, newMember);
        }
      }
    } catch (error) {
      console.error('Failed to save to Firebase:', error);
    }
  },
  
  updateMember: async (id, updates) => {
    const { members } = get();
    const updatedMembers = members.map(m => m.id === id ? { ...m, ...updates, lastSeen: Date.now() } : m);
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
        console.error('Failed to update in Firebase:', error);
      }
    }
  },
  
  removeMember: async (id) => {
    const { members } = get();
    const updatedMembers = members.filter(m => m.id !== id);
    set({ members: updatedMembers });
    
    // Save to AsyncStorage
    await saveMembers(updatedMembers);
    
    // Delete from Firebase (lazy load to avoid circular dependency)
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        const firebaseService = getFirebaseDataService();
        if (firebaseService?.isInitialized) {
          await firebaseService.deleteFamilyMember(deviceId, id);
        }
      }
    } catch (error) {
      console.error('Failed to delete from Firebase:', error);
    }
  },
  
  updateMemberLocation: async (id, latitude, longitude) => {
    const { members } = get();
    // OPTIMIZED: Check if update is actually needed (prevents unnecessary re-renders)
    const existingMember = members.find(m => m.id === id);
    const locationChanged = !existingMember || 
      existingMember.location?.latitude !== latitude || 
      existingMember.location?.longitude !== longitude;
    
    if (!locationChanged) {
      // Location unchanged - no need to update
      return;
    }
    
    const updatedMembers = members.map(m => 
      m.id === id 
        ? { ...m, location: { latitude, longitude, timestamp: Date.now() }, lastSeen: Date.now() }
        : m
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
        console.error('Failed to update location in Firebase:', error);
      }
    }

    // Elite: Send notification for significant location changes (only if member is in critical status)
    if (locationChanged && updatedMember && (updatedMember.status === 'critical' || updatedMember.status === 'need-help')) {
      try {
        const { notificationService } = await import('../services/NotificationService');
        await notificationService.showFamilyLocationUpdateNotification(
          updatedMember.name,
          latitude,
          longitude
        );
      } catch (error) {
        console.error('Failed to send location update notification:', error);
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
        console.error('Failed to update status in Firebase:', error);
      }
    }

    // Elite: Send notification for critical status changes
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
        });
      } catch (error) {
        console.error('Failed to send family status notification:', error);
      }
    }
  },
  
  clear: async () => {
    set(initialState);
    await AsyncStorage.removeItem(STORAGE_KEY).catch(console.error);
    
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
      console.error('Failed to clear Firebase:', error);
    }
  },
}));

