/**
 * HEALTH PROFILE STORE - Critical Medical Information
 * Stores blood type, allergies, chronic conditions, emergency medications
 * Accessible offline for rescue teams
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
}

export interface HealthProfile {
  // Personal Information
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // YYYY-MM-DD format
  gender?: string; // Erkek, Kadın, Diğer, Belirtmek istemiyorum
  height?: string; // cm
  weight?: string; // kg
  
  // Medical Information
  bloodType: string; // A+, A-, B+, B-, AB+, AB-, O+, O-
  allergies: string[]; // e.g., ['Penisilin', 'Fıstık']
  chronicConditions: string[]; // e.g., ['Diyabet', 'Hipertansiyon']
  chronicDiseases?: string[]; // Alias for chronicConditions
  medications: string[]; // e.g., ['İnsülin', 'Aspirin']
  emergencyMedications?: string[]; // Alias for medications
  medicalHistory?: string; // Surgeries, accidents, etc.
  
  // Insurance Information
  insuranceProvider?: string;
  insuranceNumber?: string;
  organDonorStatus?: string; // Evet, Hayır, Belirtmek istemiyorum
  
  // Emergency Contacts
  emergencyContacts: EmergencyContact[];
  
  // Additional Notes
  notes: string; // Additional medical notes
  lastUpdated: number;
}

interface HealthProfileState {
  profile: HealthProfile;
  isLoaded: boolean;
  
  // Actions
  setBloodType: (bloodType: string) => void;
  addAllergy: (allergy: string) => void;
  removeAllergy: (allergy: string) => void;
  addCondition: (condition: string) => void;
  removeCondition: (condition: string) => void;
  addMedication: (medication: string) => void;
  removeMedication: (medication: string) => void;
  addEmergencyContact: (contact: EmergencyContact) => void;
  removeEmergencyContact: (contactId: string) => void;
  updateEmergencyContact: (contactId: string, updates: Partial<EmergencyContact>) => void;
  setNotes: (notes: string) => void;
  updateProfile: (updates: Partial<HealthProfile>) => void;
  loadProfile: () => Promise<void>;
  saveProfile: () => Promise<void>;
  clearProfile: () => Promise<void>;
}

const DEFAULT_PROFILE: HealthProfile = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  height: '',
  weight: '',
  bloodType: '',
  allergies: [],
  chronicConditions: [],
  medications: [],
  medicalHistory: '',
  insuranceProvider: '',
  insuranceNumber: '',
  organDonorStatus: '',
  emergencyContacts: [],
  notes: '',
  lastUpdated: Date.now(),
};

const STORAGE_KEY = '@afetnet:health_profile';

export const useHealthProfileStore = create<HealthProfileState>((set, get) => ({
  profile: DEFAULT_PROFILE,
  isLoaded: false,

  setBloodType: (bloodType) => {
    set((state) => ({
      profile: {
        ...state.profile,
        bloodType,
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  addAllergy: (allergy) => {
    set((state) => ({
      profile: {
        ...state.profile,
        allergies: [...state.profile.allergies, allergy],
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  removeAllergy: (allergy) => {
    set((state) => ({
      profile: {
        ...state.profile,
        allergies: state.profile.allergies.filter((a) => a !== allergy),
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  addCondition: (condition) => {
    set((state) => ({
      profile: {
        ...state.profile,
        chronicConditions: [...state.profile.chronicConditions, condition],
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  removeCondition: (condition) => {
    set((state) => ({
      profile: {
        ...state.profile,
        chronicConditions: state.profile.chronicConditions.filter((c) => c !== condition),
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  addMedication: (medication) => {
    set((state) => ({
      profile: {
        ...state.profile,
        medications: [...state.profile.medications, medication],
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  removeMedication: (medication) => {
    set((state) => ({
      profile: {
        ...state.profile,
        medications: state.profile.medications.filter((m) => m !== medication),
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  addEmergencyContact: (contact) => {
    set((state) => ({
      profile: {
        ...state.profile,
        emergencyContacts: [...state.profile.emergencyContacts, contact],
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  removeEmergencyContact: (contactId) => {
    set((state) => ({
      profile: {
        ...state.profile,
        emergencyContacts: state.profile.emergencyContacts.filter((c) => c.id !== contactId),
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  updateEmergencyContact: (contactId, updates) => {
    set((state) => ({
      profile: {
        ...state.profile,
        emergencyContacts: state.profile.emergencyContacts.map((c) =>
          c.id === contactId ? { ...c, ...updates } : c
        ),
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  setNotes: (notes) => {
    set((state) => ({
      profile: {
        ...state.profile,
        notes,
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  updateProfile: (updates) => {
    set((state) => ({
      profile: {
        ...state.profile,
        ...updates,
        lastUpdated: Date.now(),
      },
    }));
    get().saveProfile();
  },

  loadProfile: async () => {
    try {
      // First load from AsyncStorage (fast)
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const profile = JSON.parse(stored);
        set({ profile, isLoaded: true });
        logger.info('HealthProfile loaded from local storage');
      } else {
        set({ isLoaded: true });
      }

      // Then try to sync from Firebase
      try {
        const { getDeviceId } = await import('../../lib/device');
        const deviceId = await getDeviceId();
        if (deviceId) {
          const { firebaseDataService } = await import('../services/FirebaseDataService');
          if (firebaseDataService.isInitialized) {
            const cloudProfile = await firebaseDataService.loadHealthProfile(deviceId);
            if (cloudProfile) {
              // Merge: Firebase takes precedence
              set({ profile: cloudProfile, isLoaded: true });
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cloudProfile));
              logger.info('HealthProfile loaded from Firebase');
            }
          }
        }
      } catch (error) {
        logger.error('Failed to load health profile from Firebase:', error);
      }
    } catch (error) {
      logger.error('HealthProfile load failed:', error);
      set({ isLoaded: true });
    }
  },

  saveProfile: async () => {
    try {
      const { profile } = get();
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      
      // Save to Firebase
      try {
        const { getDeviceId } = await import('../../lib/device');
        const deviceId = await getDeviceId();
        if (deviceId) {
          const { firebaseDataService } = await import('../services/FirebaseDataService');
          if (firebaseDataService.isInitialized) {
            await firebaseDataService.saveHealthProfile(deviceId, profile);
          }
        }
      } catch (error) {
        logger.error('Failed to save health profile to Firebase:', error);
      }

      // CRITICAL: Send to backend for rescue coordination
      // ELITE: This ensures rescue teams have medical information during emergencies
      try {
        const { backendEmergencyService } = await import('../services/BackendEmergencyService');
        if (backendEmergencyService.initialized) {
          await backendEmergencyService.sendHealthProfile({
            bloodType: profile.bloodType,
            allergies: profile.allergies,
            medications: profile.medications,
            medicalConditions: profile.medicalConditions,
            emergencyContacts: profile.emergencyContacts,
            updatedAt: Date.now(),
          }).catch((error) => {
            logger.error('Failed to send health profile to backend:', error);
          });
        }
      } catch (error) {
        logger.error('Failed to send health profile to backend:', error);
      }
      
      logger.info('HealthProfile saved');
    } catch (error) {
      logger.error('HealthProfile save failed:', error);
    }
  },

  clearProfile: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({ profile: DEFAULT_PROFILE });
      logger.info('HealthProfile cleared');
    } catch (error) {
      logger.error('HealthProfile clear failed:', error);
    }
  },
}));

