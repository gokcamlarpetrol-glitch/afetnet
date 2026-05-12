/**
 * HEALTH PROFILE STORE - Critical Medical Information
 * Stores blood type, allergies, chronic conditions, emergency medications
 * Accessible offline for rescue teams
 */

import { create } from 'zustand';
import { getFirebaseAuth } from '../../lib/firebase';
import { DirectStorage } from '../utils/storage';
import { logger } from '../utils/logger';
import { readCachedAuthUid } from '../utils/authSessionCache';

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

  // KVKK Madde 6 — Özel Nitelikli Kişisel Veri (Sağlık) Açık Rıza
  // Yasal gereklilik: Sağlık verisi sunucuya yüklemek için kullanıcının
  // her bir alıcı için ayrı açık rıza vermesi gerekir. Default: false.
  // Rıza verilmeden sadece cihaz içinde şifrelenmiş olarak saklanır.
  cloudSyncConsent?: boolean;      // Firebase Firestore'a yedekleme rızası
  backendShareConsent?: boolean;   // AfetNet kurtarma backend'ine paylaşma rızası
  consentTimestamp?: number;       // Rızanın verildiği zaman (audit trail)
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
  // KVKK Madde 6: Default kapalı — açık rıza olmadan sunucuya yüklenmez
  cloudSyncConsent: false,
  backendShareConsent: false,
};

const STORAGE_KEY_BASE = '@afetnet:health_profile';
const STORAGE_GUEST_SCOPE = 'guest';

// Debounce saveProfile to prevent burst Firebase writes during rapid form edits
let saveDebounceTimer: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 300;

const getScopedStorageKey = (): string => {
  try {
    const cachedUid = readCachedAuthUid();
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (uid) return `${STORAGE_KEY_BASE}:user:${uid}`;
    return cachedUid ? `${STORAGE_KEY_BASE}:user:${cachedUid}` : `${STORAGE_KEY_BASE}:${STORAGE_GUEST_SCOPE}`;
  } catch {
    const cachedUid = readCachedAuthUid();
    return cachedUid ? `${STORAGE_KEY_BASE}:user:${cachedUid}` : `${STORAGE_KEY_BASE}:${STORAGE_GUEST_SCOPE}`;
  }
};

// Debounced save helper to coalesce rapid mutations into a single Firebase write
const debouncedSave = (get: () => HealthProfileState) => {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null;
    get().saveProfile();
  }, SAVE_DEBOUNCE_MS);
};

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
    debouncedSave(get);
  },

  addAllergy: (allergy) => {
    const trimmed = allergy.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.profile.allergies.includes(trimmed)) return state;
      return {
        profile: {
          ...state.profile,
          allergies: [...state.profile.allergies, trimmed],
          lastUpdated: Date.now(),
        },
      };
    });
    debouncedSave(get);
  },

  removeAllergy: (allergy) => {
    set((state) => ({
      profile: {
        ...state.profile,
        allergies: state.profile.allergies.filter((a) => a !== allergy),
        lastUpdated: Date.now(),
      },
    }));
    debouncedSave(get);
  },

  addCondition: (condition) => {
    const trimmed = condition.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.profile.chronicConditions.includes(trimmed)) return state;
      return {
        profile: {
          ...state.profile,
          chronicConditions: [...state.profile.chronicConditions, trimmed],
          lastUpdated: Date.now(),
        },
      };
    });
    debouncedSave(get);
  },

  removeCondition: (condition) => {
    set((state) => ({
      profile: {
        ...state.profile,
        chronicConditions: state.profile.chronicConditions.filter((c) => c !== condition),
        lastUpdated: Date.now(),
      },
    }));
    debouncedSave(get);
  },

  addMedication: (medication) => {
    const trimmed = medication.trim();
    if (!trimmed) return;
    set((state) => {
      if (state.profile.medications.includes(trimmed)) return state;
      return {
        profile: {
          ...state.profile,
          medications: [...state.profile.medications, trimmed],
          lastUpdated: Date.now(),
        },
      };
    });
    debouncedSave(get);
  },

  removeMedication: (medication) => {
    set((state) => ({
      profile: {
        ...state.profile,
        medications: state.profile.medications.filter((m) => m !== medication),
        lastUpdated: Date.now(),
      },
    }));
    debouncedSave(get);
  },

  addEmergencyContact: (contact) => {
    set((state) => ({
      profile: {
        ...state.profile,
        emergencyContacts: [...state.profile.emergencyContacts, contact],
        lastUpdated: Date.now(),
      },
    }));
    debouncedSave(get);
  },

  removeEmergencyContact: (contactId) => {
    set((state) => ({
      profile: {
        ...state.profile,
        emergencyContacts: state.profile.emergencyContacts.filter((c) => c.id !== contactId),
        lastUpdated: Date.now(),
      },
    }));
    debouncedSave(get);
  },

  updateEmergencyContact: (contactId, updates) => {
    set((state) => ({
      profile: {
        ...state.profile,
        emergencyContacts: state.profile.emergencyContacts.map((c) =>
          c.id === contactId ? { ...c, ...updates } : c,
        ),
        lastUpdated: Date.now(),
      },
    }));
    debouncedSave(get);
  },

  setNotes: (notes) => {
    set((state) => ({
      profile: {
        ...state.profile,
        notes,
        lastUpdated: Date.now(),
      },
    }));
    debouncedSave(get);
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
      // SECURITY FIX: Use encrypted MMKV (DirectStorage) instead of unencrypted AsyncStorage
      const scopedKey = getScopedStorageKey();
      let stored = DirectStorage.getString(scopedKey) ?? null;
      // CRITICAL FIX: Do NOT migrate legacy global key — it may belong to a different
      // user account, causing cross-account health data bleed (privacy breach / KVKK violation).
      // Health data (blood type, allergies, medications) is especially sensitive.
      // Each account starts fresh with scoped storage; Firebase sync provides the data.
      if (stored) {
        const parsed = JSON.parse(stored);
        // CRITICAL: Validate parsed health profile — corrupt data could hide life-saving info
        const profile: HealthProfile = {
          ...DEFAULT_PROFILE,
          ...parsed,
          // Ensure critical array fields are always arrays (corrupt data protection)
          allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
          chronicConditions: Array.isArray(parsed.chronicConditions) ? parsed.chronicConditions : [],
          medications: Array.isArray(parsed.medications) ? parsed.medications : [],
          emergencyContacts: Array.isArray(parsed.emergencyContacts) ? parsed.emergencyContacts : [],
        };
        set({ profile, isLoaded: true });
        logger.info('HealthProfile loaded from local storage');
      } else {
        set({ isLoaded: true });
      }

      // Then try to sync from Firebase
      // FIX: Use Firebase Auth UID (not deviceId) — FirebaseHealthOperations path is users/{uid}/health/current
      try {
        const auth = getFirebaseAuth();
        const uid = auth?.currentUser?.uid;
        if (uid) {
          const { firebaseDataService } = await import('../services/FirebaseDataService');
          try { await firebaseDataService.initialize(); } catch { /* best effort */ }
          const cloudProfile = await firebaseDataService.loadHealthProfile(uid);
          if (cloudProfile) {
            // Merge: Firebase takes precedence
            set({ profile: cloudProfile, isLoaded: true });
            DirectStorage.setString(getScopedStorageKey(), JSON.stringify(cloudProfile));
            logger.info('HealthProfile loaded from Firebase');
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

      // 1) Her zaman cihaz içinde şifrelenmiş yerel storage'a kaydet (rıza gerekmez)
      DirectStorage.setString(getScopedStorageKey(), JSON.stringify(profile));

      // 2) KVKK Madde 6 — Firebase'e yedekleme SADECE açık rıza varsa
      // Default false: kullanıcı HealthProfileScreen'den açık rıza vermeden
      // sağlık verisi sunucuya yüklenmez. Yasal zorunluluk.
      if (profile.cloudSyncConsent === true) {
        try {
          const auth = getFirebaseAuth();
          const uid = auth?.currentUser?.uid;
          if (uid) {
            const { firebaseDataService } = await import('../services/FirebaseDataService');
            try { await firebaseDataService.initialize(); } catch { /* best effort */ }
            await firebaseDataService.saveHealthProfile(uid, profile);
            logger.info('HealthProfile synced to Firebase (with consent)');
          }
        } catch (error) {
          logger.error('Failed to save health profile to Firebase:', error);
        }
      } else {
        logger.info('HealthProfile cloud sync skipped (no consent — KVKK Madde 6)');
      }

      // 3) KVKK Madde 6 — Backend'e (AfetNet kurtarma koordinasyonu) SADECE açık rıza varsa
      // Bu daha hassas: kurtarma ekipleriyle paylaşım anlamına gelir
      if (profile.backendShareConsent === true) {
        try {
          const { backendEmergencyService } = await import('../services/BackendEmergencyService');
          if (backendEmergencyService.initialized) {
            await backendEmergencyService.sendHealthProfile({
              bloodType: profile.bloodType,
              allergies: profile.allergies,
              medications: profile.medications,
              medicalConditions: profile.chronicConditions,
              emergencyContacts: profile.emergencyContacts,
              updatedAt: Date.now(),
            }).catch((error) => {
              logger.error('Failed to send health profile to backend:', error);
            });
            logger.info('HealthProfile shared to rescue backend (with consent)');
          }
        } catch (error) {
          logger.error('Failed to send health profile to backend:', error);
        }
      } else {
        logger.info('HealthProfile backend share skipped (no consent — KVKK Madde 6)');
      }

      logger.info('HealthProfile saved locally');
    } catch (error) {
      logger.error('HealthProfile save failed:', error);
    }
  },

  clearProfile: async () => {
    try {
      DirectStorage.delete(getScopedStorageKey());
      try { DirectStorage.delete(STORAGE_KEY_BASE); } catch { /* legacy key cleanup */ }
      set({ profile: DEFAULT_PROFILE });

      // AUDIT FIX: Delete from correct Firestore path for GDPR/KVKK compliance
      // Path: users/{uid}/health/current (matches FirebaseHealthOperations)
      try {
        const auth = getFirebaseAuth();
        const uid = auth?.currentUser?.uid;
        if (uid) {
          const { doc, deleteDoc } = await import('firebase/firestore');
          const { getFirestoreInstanceAsync } = await import('../services/firebase/FirebaseInstanceManager');
          const db = await getFirestoreInstanceAsync();
          if (db) {
            await deleteDoc(doc(db, 'users', uid, 'health', 'current'));
          }
        }
      } catch { /* best-effort */ }

      logger.info('HealthProfile cleared');
    } catch (error) {
      logger.error('HealthProfile clear failed:', error);
    }
  },
}));
