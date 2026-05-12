/**
 * FAMILY STORE — SINGLE-UID ARCHITECTURE v4.0
 * 
 * Every family member is identified by Firebase Auth UID.
 * uid is the ONLY primary key. No family-* IDs, no id field.
 * 
 * Persistent storage with encrypted MMKV (DirectStorage) + Firebase Firestore sync.
 * Data survives app restarts and syncs across devices.
 * 
 * @version 4.0.0 — Single-UID Clean Architecture
 */

import { create } from 'zustand';
import { DirectStorage } from '../utils/storage';
import { getFirebaseAuth } from '../../lib/firebase';
import { FamilyMember } from '../types/family';
import { createLogger } from '../utils/logger';
import { identityService } from '../services/IdentityService';
import { normalizeTimestampMs } from '../utils/dateUtils';
import { isLikelyFirebaseUid } from '../utils/messaging/identityUtils';
import { readCachedAuthUid } from '../utils/authSessionCache';

const logger = createLogger('FamilyStore');

// ─── Firebase Service Interface (lazy loaded) ──────────────────────
interface FirebaseDataServiceType {
  isInitialized: boolean;
  saveDeviceId: (deviceId: string) => Promise<boolean>;
  loadFamilyMembers: (ownerUid: string) => Promise<FamilyMember[]>;
  saveFamilyMember: (ownerUid: string, member: FamilyMember) => Promise<boolean>;
  deleteFamilyMember: (ownerUid: string, memberUid: string) => Promise<boolean>;
  subscribeToUserLocation?: (uid: string, callback: (location: unknown) => void, onError?: (error: any) => void) => Promise<() => void>;
  subscribeToFamilyMembers?: (
    ownerUid: string,
    callback: (members: FamilyMember[]) => void,
    onError?: (error: Error) => void
  ) => Promise<(() => void) | null>;
}

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

const waitForFirebaseInit = async (maxRetries = 5, delayMs = 2000): Promise<FirebaseDataServiceType | null> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const svc = getFirebaseDataService();
    if (svc?.isInitialized) return svc;
    if (attempt < maxRetries) {
      logger.debug(`Firebase not ready, retry ${attempt + 1}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  logger.warn('Firebase init wait exhausted — local-only mode');
  return null;
};

// ─── Subscriptions ──────────────────────────────────────
const memberLocationSubscriptions = new Map<string, () => void>();
const statusUpdateSubscriptions = new Map<string, () => void>();
const statusRetryTimers: NodeJS.Timeout[] = [];
let familyLinksUnsubscribe: (() => void) | null = null;

// Debounced merge pattern to prevent concurrent set() race from dual subscriptions
let _pendingMergeMembers: FamilyMember[] | null = null;
let _mergeTimer: ReturnType<typeof setTimeout> | null = null;
const MERGE_DEBOUNCE_MS = 100;

// ELITE: Prevent auto-restoration of recently deleted members by real-time listeners
const sessionDeletedUids = new Set<string>();

// AUDIT FIX: Track retrySubscription timer so it can be cleared on logout
let retrySubscriptionTimer: ReturnType<typeof setTimeout> | null = null;

const debouncedMergeAndSet = (
  incoming: FamilyMember[],
  getState: () => FamilyState & FamilyActions,
  setState: (partial: Partial<FamilyState>) => void,
) => {
  // Filter out any members we've explicitly deleted this session
  const filteredIncoming = incoming.filter(m => m.uid && !sessionDeletedUids.has(m.uid));

  // Accumulate incoming members
  if (_pendingMergeMembers) {
    for (const m of filteredIncoming) {
      if (!_pendingMergeMembers.some(p => p.uid === m.uid)) {
        _pendingMergeMembers.push(m);
      }
    }
  } else {
    _pendingMergeMembers = [...filteredIncoming];
  }

  if (_mergeTimer) clearTimeout(_mergeTimer);
  _mergeTimer = setTimeout(async () => {
    const pending = _pendingMergeMembers;
    _pendingMergeMembers = null;
    _mergeTimer = null;
    if (!pending || pending.length === 0) return;

    const merged = mergeMembers(getState().members, pending);
    setState({ members: merged });
    await saveMembers(merged);
    await syncLocationSubscriptions(merged, (uid, lat, lng, observedAt) => {
      void getState().updateMemberLocation(uid, lat, lng, 'remote', observedAt);
    });
    await syncStatusUpdateListeners(merged);
  }, MERGE_DEBOUNCE_MS);
};

const clearSubscriptions = (map: Map<string, () => void>) => {
  map.forEach(unsub => { try { unsub(); } catch (e) { logger.debug('Cleanup failed:', e); } });
  map.clear();
};

// ─── Status Update Listeners ──────────────────────────────
const syncStatusUpdateListeners = async (members: FamilyMember[]) => {
  const desiredKeys = new Set<string>();

  for (const member of members) {
    if (!member.uid) continue;
    if (!isApprovedFamilyMember(member)) continue;
    const key = `status:${member.uid}`;
    desiredKeys.add(key);
    if (statusUpdateSubscriptions.has(key)) continue;

    try {
      const { getFirestoreInstanceAsync } = await import('../services/firebase/FirebaseInstanceManager');
      const db = await getFirestoreInstanceAsync();
      if (!db) continue;

      const { doc, onSnapshot } = await import('firebase/firestore');
      const statusRef = doc(db, 'users', member.uid, 'status', 'current');

      const unsubscribe = onSnapshot(
        statusRef,
        (snapshot) => {
          if (!snapshot.exists()) return;

          const data = snapshot.data();
          if (!data?.status) return;

          const validStatuses = ['safe', 'need-help', 'critical', 'unknown', 'danger'];
          if (!validStatuses.includes(data.status)) return;

          const currentMembers = useFamilyStore.getState().members;
          const existing = currentMembers.find(m => m.uid === member.uid);
          if (existing && existing.status !== data.status) {
            useFamilyStore.getState().updateMemberStatus(member.uid, data.status, 'remote').catch(e => { if (__DEV__) logger.debug('Status update from listener failed:', e); });
            logger.info(`📥 Status: ${member.name} → ${data.status}`);
          }
        },
        (error: unknown) => {
          const code = (error as { code?: string })?.code || '';
          const message = (error as { message?: string })?.message || '';
          if (code === 'permission-denied') {
            logger.debug(`Status listener for ${member.uid}: permission denied`);
          } else if (code === 'failed-precondition' || message.includes('index')) {
            logger.warn(`Status listener for ${member.uid}: missing Firestore index. Check Firebase console to create the required index.`);
          } else {
            logger.warn(`Status listener error for ${member.uid}:`, error);
          }
          // Auto-cleanup dead listener
          statusUpdateSubscriptions.delete(key);

          // Retry with exponential backoff (max 3 retries)
          const retryKey = `__retryCount_${key}`;
          const retryCount = ((globalThis as any)[retryKey] || 0) as number;
          if (retryCount < 3 && code !== 'permission-denied') {
            (globalThis as any)[retryKey] = retryCount + 1;
            const delay = Math.min(2000 * Math.pow(2, retryCount), 30000);
            statusRetryTimers.push(setTimeout(() => {
              syncStatusUpdateListeners(useFamilyStore.getState().members);
            }, delay));
          }
        },
      );

      statusUpdateSubscriptions.set(key, unsubscribe);
    } catch (error) {
      logger.warn(`Failed status subscription for ${member.uid}:`, error);
    }
  }

  // Cleanup stale
  for (const key of statusUpdateSubscriptions.keys()) {
    if (!desiredKeys.has(key)) {
      statusUpdateSubscriptions.get(key)?.();
      statusUpdateSubscriptions.delete(key);
    }
  }
};

export type { FamilyMember };

// ─── Store Interface ──────────────────────────────────────
interface FamilyState {
  members: FamilyMember[];
  firebaseUnsubscribe: (() => void) | null;
  isInitialized: boolean;
}

interface FamilyActions {
  initialize: (force?: boolean) => Promise<void>;
  addMember: (member: Omit<FamilyMember, 'uid'> & { uid: string }) => Promise<void>;
  updateMember: (uid: string, updates: Partial<FamilyMember>) => Promise<void>;
  removeMember: (uid: string) => Promise<void>;
  updateMemberLocation: (uid: string, latitude: number, longitude: number, source?: 'local' | 'remote', observedAt?: number) => Promise<void>;
  updateMemberStatus: (uid: string, status: FamilyMember['status'], source?: 'local' | 'remote') => Promise<void>;
  clear: () => Promise<void>;
}

// ─── Constants ──────────────────────────────────────
const STORAGE_KEY_BASE = '@afetnet:family_members_v4';
const STORAGE_GUEST_SCOPE = 'guest';
const MIN_TIMESTAMP_MS = new Date('2000-01-01T00:00:00.000Z').getTime();
const VALID_STATUSES: FamilyMember['status'][] = ['safe', 'need-help', 'unknown', 'critical', 'danger', 'offline'];

// ─── Helpers ──────────────────────────────────────

const isApprovedFamilyMember = (member: Partial<FamilyMember> | null | undefined): boolean => {
  if (!member?.uid) return false;
  const legacy = member as Partial<FamilyMember> & { relationshipStatus?: string; isMutual?: boolean };
  return member.approvalState === 'mutual'
    || legacy.relationshipStatus === 'accepted'
    || legacy.isMutual === true;
};

const getOwnerUid = (): string | null => {
  try {
    const uid = identityService.getUid();
    if (uid) return uid;
    const authUid = getFirebaseAuth()?.currentUser?.uid || null;
    if (authUid) return authUid;
  } catch {
    // best effort fallback below
  }
  return readCachedAuthUid();
};

const getScopedStorageKey = (): string => {
  const uid = getOwnerUid();
  return uid ? `${STORAGE_KEY_BASE}:user:${uid}` : `${STORAGE_KEY_BASE}:${STORAGE_GUEST_SCOPE}`;
};

const normalizeNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
};

const normalizeTimestamp = (value: unknown): number => {
  const n = normalizeTimestampMs(value as number | string | Date | null | undefined);
  if (!n || n < MIN_TIMESTAMP_MS) return 0;
  return n;
};

const hasValidLocationCoordinates = (member: Partial<FamilyMember> | null | undefined): boolean => {
  if (!member) return false;
  const latitude = typeof member.latitude === 'number' && Number.isFinite(member.latitude)
    ? member.latitude
    : (typeof member.location?.latitude === 'number' && Number.isFinite(member.location.latitude)
      ? member.location.latitude
      : 0);
  const longitude = typeof member.longitude === 'number' && Number.isFinite(member.longitude)
    ? member.longitude
    : (typeof member.location?.longitude === 'number' && Number.isFinite(member.location.longitude)
      ? member.location.longitude
      : 0);
  return latitude !== 0 && longitude !== 0;
};

const getMemberLocationFreshness = (member: Partial<FamilyMember> | null | undefined): number => {
  if (!member) return 0;
  return Math.max(
    normalizeTimestamp(member.lastSeen),
    normalizeTimestamp(member.updatedAt),
    normalizeTimestamp(member.location?.timestamp),
    normalizeTimestamp(member.lastKnownLocation?.timestamp),
  );
};

const preserveFresherLocationState = (
  existing: FamilyMember,
  incoming: FamilyMember,
  merged: FamilyMember,
): FamilyMember => {
  const existingHasLocation = hasValidLocationCoordinates(existing);
  if (!existingHasLocation) {
    return merged;
  }

  const incomingHasLocation = hasValidLocationCoordinates(incoming);
  const existingFreshness = getMemberLocationFreshness(existing);
  const incomingFreshness = getMemberLocationFreshness(incoming);

  if (incomingHasLocation && incomingFreshness >= existingFreshness) {
    return merged;
  }

  const mergedUpdatedAt = Math.max(normalizeTimestamp(merged.updatedAt), normalizeTimestamp(existing.updatedAt));

  return {
    ...merged,
    latitude: existing.latitude,
    longitude: existing.longitude,
    ...(existing.location ? { location: existing.location } : {}),
    ...(existing.lastKnownLocation ? { lastKnownLocation: existing.lastKnownLocation } : {}),
    lastSeen: Math.max(merged.lastSeen || 0, existing.lastSeen || 0),
    ...(mergedUpdatedAt > 0 ? { updatedAt: mergedUpdatedAt } : {}),
  };
};

const normalizeMember = (raw: unknown): FamilyMember | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<FamilyMember> & Record<string, unknown>;

  const uid = typeof r.uid === 'string' ? r.uid.trim() : '';
  if (!uid) return null; // UID required

  const name = typeof r.name === 'string' ? r.name.trim() : 'Aile Üyesi';
  const status = r.status && VALID_STATUSES.includes(r.status) ? r.status : 'unknown';

  const locObj = r.location && typeof r.location === 'object'
    ? r.location as Record<string, unknown>
    : undefined;
  const rawLat = typeof r.latitude === 'number' && Number.isFinite(r.latitude) ? r.latitude : undefined;
  const rawLng = typeof r.longitude === 'number' && Number.isFinite(r.longitude) ? r.longitude : undefined;
  const latitude = rawLat !== undefined ? rawLat : normalizeNumber(locObj?.latitude);
  const longitude = rawLng !== undefined ? rawLng : normalizeNumber(locObj?.longitude);
  const locTimestamp = locObj ? normalizeTimestamp(locObj.timestamp) : 0;

  const location = locObj ? {
    latitude: normalizeNumber(locObj.latitude, latitude),
    longitude: normalizeNumber(locObj.longitude, longitude),
    ...(locTimestamp > 0 ? { timestamp: locTimestamp } : {}),
  } : undefined;

  const lastKnownRaw = r.lastKnownLocation && typeof r.lastKnownLocation === 'object'
    ? r.lastKnownLocation as Record<string, unknown>
    : undefined;
  const lastKnownLocation = lastKnownRaw ? {
    latitude: normalizeNumber(lastKnownRaw.latitude),
    longitude: normalizeNumber(lastKnownRaw.longitude),
    timestamp: normalizeTimestamp(lastKnownRaw.timestamp) || Date.now(),
    batteryLevelAtCapture: normalizeNumber(lastKnownRaw.batteryLevelAtCapture, normalizeNumber(r.batteryLevel)),
    source: (['gps', 'mesh', 'cloud', 'manual'] as const).includes(lastKnownRaw.source as any)
      ? lastKnownRaw.source as 'gps' | 'mesh' | 'cloud' | 'manual'
      : 'manual' as const,
  } : undefined;

  return {
    ...(r as FamilyMember),
    uid,
    name,
    status,
    lastSeen: normalizeTimestamp(r.lastSeen),
    latitude,
    longitude,
    ...(location ? { location } : {}),
    ...(lastKnownLocation ? { lastKnownLocation } : {}),
    ...(normalizeTimestamp(r.createdAt) > 0 ? { createdAt: normalizeTimestamp(r.createdAt) } : {}),
    ...(normalizeTimestamp(r.updatedAt) > 0 ? { updatedAt: normalizeTimestamp(r.updatedAt) } : {}),
  };
};

// ─── Storage ──────────────────────────────────────

const loadMembers = async (): Promise<FamilyMember[]> => {
  try {
    const data = DirectStorage.getString(getScopedStorageKey()) ?? null;
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map(m => normalizeMember(m)).filter((m): m is FamilyMember => !!m);
      }
    }
  } catch (error) {
    logger.error('Failed to load family members:', error);
  }
  return [];
};

const saveMembers = async (members: FamilyMember[]) => {
  try {
    DirectStorage.setString(getScopedStorageKey(), JSON.stringify(members));
  } catch (error) {
    logger.error('Failed to save family members:', error);
  }
};

// ─── Location Subscriptions ──────────────────────────────

let _syncLocationInProgress = false;

const syncLocationSubscriptions = async (
  members: FamilyMember[],
  onLocation: (memberUid: string, latitude: number, longitude: number, observedAt?: number) => void,
) => {
  // Guard against concurrent calls (e.g., debouncedMergeAndSet firing while initialize is running)
  if (_syncLocationInProgress) return;
  _syncLocationInProgress = true;
  try {
    await _syncLocationSubscriptionsInner(members, onLocation);
  } finally {
    _syncLocationInProgress = false;
  }
};

const _syncLocationSubscriptionsInner = async (
  members: FamilyMember[],
  onLocation: (memberUid: string, latitude: number, longitude: number, observedAt?: number) => void,
) => {
  const firebase = getFirebaseDataService();
  if (!firebase?.subscribeToUserLocation) return;

  const desiredKeys = new Set<string>();

  for (const member of members) {
    if (!member.uid) continue;
    if (!isApprovedFamilyMember(member)) continue;
    const key = `loc:${member.uid}`;
    desiredKeys.add(key);

    if (memberLocationSubscriptions.has(key)) continue;

    try {
      const unsub = await firebase.subscribeToUserLocation(member.uid, (location: unknown) => {
        const loc = location && typeof location === 'object' ? location as Record<string, unknown> : null;
        const latRaw = loc?.latitude;
        const lngRaw = loc?.longitude;
        const lat = typeof latRaw === 'string' ? Number(latRaw) : latRaw;
        const lng = typeof lngRaw === 'string' ? Number(lngRaw) : lngRaw;
        if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
          const observedAt = normalizeTimestamp(loc?.timestamp ?? loc?.updatedAt);
          onLocation(member.uid, lat, lng, observedAt > 0 ? observedAt : undefined);
        }

        // Battery level from location doc
        const batteryRaw = loc?.battery;
        if (typeof batteryRaw === 'number' && batteryRaw >= 0 && batteryRaw <= 100) {
          const currentMembers = useFamilyStore.getState().members;
          const existing = currentMembers.find(m => m.uid === member.uid);
          if (existing && existing.batteryLevel !== batteryRaw) {
            useFamilyStore.getState().updateMember(member.uid, { batteryLevel: batteryRaw }).catch(e => {
              if (__DEV__) logger.debug('Battery update from location failed:', e);
            });
          }
        }

        // Status from location doc
        const deviceStatus = loc?._deviceStatus;
        if (typeof deviceStatus === 'string' && VALID_STATUSES.includes(deviceStatus as FamilyMember['status'])) {
          const currentMembers = useFamilyStore.getState().members;
          const existing = currentMembers.find(m => m.uid === member.uid);
          if (existing && existing.status !== deviceStatus) {
            useFamilyStore.getState().updateMemberStatus(member.uid, deviceStatus as FamilyMember['status'], 'remote').catch(e => { if (__DEV__) logger.debug('Device status update failed:', e); });
          }
        }
      }, (error: any) => {
        // Auto-cleanup dead listener so next sync cycle re-subscribes
        logger.warn(`Location listener died for ${member.uid}, will re-subscribe on next sync`);
        memberLocationSubscriptions.delete(key);
      });

      if (typeof unsub === 'function') {
        memberLocationSubscriptions.set(key, unsub);
      }
    } catch (error) {
      logger.warn(`Location subscription failed for ${member.uid}:`, error);
    }
  }

  // Cleanup stale
  for (const key of memberLocationSubscriptions.keys()) {
    if (!desiredKeys.has(key)) {
      memberLocationSubscriptions.get(key)?.();
      memberLocationSubscriptions.delete(key);
    }
  }
};

// ─── Merge Members (uid-based dedup) ──────────────────────

const mergeMembers = (local: FamilyMember[], remote: FamilyMember[]): FamilyMember[] => {
  const map = new Map<string, FamilyMember>();

  // Local first
  for (const m of local) {
    if (m.uid) map.set(m.uid, m);
  }

  // Remote overrides
  for (const m of remote) {
    if (!m.uid) continue;
    const existing = map.get(m.uid);
    if (!existing) {
      map.set(m.uid, m);
    } else {
      // Merge: prefer newer data, filter out undefined values from remote
      const filtered = Object.fromEntries(
        Object.entries(m).filter(([_, v]) => v !== undefined)
      );
      const mergedMember: FamilyMember = {
        ...existing,
        ...filtered,
        uid: m.uid,
      };
      map.set(m.uid, preserveFresherLocationState(existing, m, mergedMember));
    }
  }

  return Array.from(map.values());
};

// ─── Firebase Cloud Save Helper ──────────────────────

const saveToCloud = async (member: FamilyMember, operation: 'save' | 'update') => {
  const ownerUid = getOwnerUid();
  if (!ownerUid) return;
  if (!member.uid || !isLikelyFirebaseUid(member.uid)) {
    logger.warn(`Skipping cloud ${operation} for "${member.name}" (no valid UID)`);
    return;
  }

  const firebaseService = getFirebaseDataService();
  if (firebaseService?.isInitialized) {
    const success = await firebaseService.saveFamilyMember(ownerUid, member);
    if (!success) {
      const { offlineSyncService } = await import('../services/OfflineSyncService');
      await offlineSyncService.queueOperation({ type: operation, data: { ownerUid, member }, priority: 'normal' });
    }
  } else {
    const { offlineSyncService } = await import('../services/OfflineSyncService');
    await offlineSyncService.queueOperation({ type: operation, data: { ownerUid, member }, priority: 'normal' });
  }
};

const deleteFromCloud = async (memberUid: string) => {
  const ownerUid = getOwnerUid();
  if (!ownerUid || !memberUid || !isLikelyFirebaseUid(memberUid)) return;

  const firebaseService = getFirebaseDataService();
  if (firebaseService?.isInitialized) {
    const success = await firebaseService.deleteFamilyMember(ownerUid, memberUid);
    if (!success) {
      const { offlineSyncService } = await import('../services/OfflineSyncService');
      await offlineSyncService.queueOperation({ type: 'delete', data: { ownerUid, memberId: memberUid }, priority: 'normal' });
    }
  } else {
    const { offlineSyncService } = await import('../services/OfflineSyncService');
    await offlineSyncService.queueOperation({ type: 'delete', data: { ownerUid, memberId: memberUid }, priority: 'normal' });
  }
};

// ─── Backend Emergency Sync ──────────────────────

const sendToBackend = async (member: FamilyMember) => {
  if (!isApprovedFamilyMember(member)) return;

  try {
    const { backendEmergencyService } = await import('../services/BackendEmergencyService');
    if (backendEmergencyService.initialized) {
      await backendEmergencyService.sendFamilyMemberData({
        memberId: member.uid,
        name: member.name,
        status: member.status,
        location: member.location ? {
          latitude: member.location.latitude,
          longitude: member.location.longitude,
          timestamp: member.location.timestamp || Date.now(),
        } : undefined,
        lastSeen: member.lastSeen,
        relationship: member.relationship,
        phoneNumber: member.phoneNumber,
      });
    }
  } catch (error) {
    logger.error('Backend sync failed:', error);
  }
};

// ─── Synchronous Initial Load ──────────────────────────────
// CRITICAL FIX: Read family members from MMKV synchronously at module load time.
// Without this, the store starts with members=[] and the Family screen shows a
// loading spinner until initialize() completes (which waits for Firebase — up to 10s).
// By pre-loading from MMKV, cached family members are visible from first render.
const getInitialMembers = (): FamilyMember[] => {
  try {
    const uid = readCachedAuthUid();
    const key = uid ? `${STORAGE_KEY_BASE}:user:${uid}` : `${STORAGE_KEY_BASE}:${STORAGE_GUEST_SCOPE}`;
    const data = DirectStorage.getString(key);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed.map(m => normalizeMember(m)).filter((m): m is FamilyMember => !!m);
      }
    }
  } catch {
    // MMKV read failed — start empty, initialize() will load later
  }
  return [];
};

const cachedMembers = getInitialMembers();

// ─── Initial State ──────────────────────────────────

const initialState: FamilyState = { members: cachedMembers, firebaseUnsubscribe: null, isInitialized: false };

// ═══════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════

export const useFamilyStore = create<FamilyState & FamilyActions>((set, get) => ({
  ...initialState,

  // ─── Initialize ──────────────────────────────
  initialize: async (force?: boolean) => {
    // CRITICAL FIX: Skip re-initialization if already initialized.
    // init.ts Phase C calls initialize() first, then FamilyScreen calls it again on mount.
    // The second call was destroying subscriptions, re-loading MMKV, and waiting for Firebase
    // init again (up to 10s), causing a visible loading delay on the Family screen.
    // Use force=true for pull-to-refresh to bypass this guard.
    if (get().isInitialized && !force) {
      logger.debug('FamilyStore already initialized — skipping');
      return;
    }

    // FIX: Clear stale retry timer and session-deleted UIDs from previous session.
    // Without this, re-initialize (force=true, account switch) inherits stale state.
    if (retrySubscriptionTimer) { clearTimeout(retrySubscriptionTimer); retrySubscriptionTimer = null; }
    sessionDeletedUids.clear();

    // Cleanup existing subscriptions
    const { firebaseUnsubscribe } = get();
    if (firebaseUnsubscribe) {
      try { firebaseUnsubscribe(); } catch (e) { logger.debug('Cleanup failed:', e); }
      set({ firebaseUnsubscribe: null });
    }
    clearSubscriptions(memberLocationSubscriptions);
    clearSubscriptions(statusUpdateSubscriptions);
    statusRetryTimers.forEach(t => clearTimeout(t));
    statusRetryTimers.length = 0;
    if (familyLinksUnsubscribe) {
      try { familyLinksUnsubscribe(); } catch (e) { logger.debug('Cleanup failed:', e); }
      familyLinksUnsubscribe = null;
    }

    // Load from AsyncStorage (fast)
    const localMembers = await loadMembers();
    set({ members: localMembers });
    await saveMembers(localMembers);

    // Sync from Firebase
    try {
      await identityService.initialize().catch(e => { if (__DEV__) logger.debug('Identity init failed:', e); });
      const ownerUid = getOwnerUid();
      if (!ownerUid) return;

      const firebaseService = await waitForFirebaseInit();
      if (!firebaseService) return;

      const myDisplayName = identityService.getDisplayName() || 'Aile Üyesi';

      // Load cloud members from my own family
      const cloudMembers = await firebaseService.loadFamilyMembers(ownerUid);
      const normalizedCloud = cloudMembers.map(m => normalizeMember(m)).filter((m): m is FamilyMember => !!m);

      // BIDIRECTIONAL SYNC: Check users/{myUid}/familyMembers for remote additions
      // This handles: B was offline when A added them -> B opens app -> B sees A
      let remoteMembers: FamilyMember[] = [];
      try {
        const { syncRemoteFamilyAdditions } = await import('../services/firebase/FirebaseFamilyOperations');
        remoteMembers = await Promise.race([
          syncRemoteFamilyAdditions(ownerUid, myDisplayName),
          new Promise<FamilyMember[]>((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 10000)),
        ]);
      } catch (error) {
        logger.warn('Remote family sync failed:', (error as Error)?.message);
      }

      // Merge: local + cloud (my family) + remote additions (others' families)
      const allRemote = [...normalizedCloud];
      for (const rm of remoteMembers) {
        const normalized = normalizeMember(rm);
        if (normalized && !allRemote.some(m => m.uid === normalized.uid)) {
          allRemote.push(normalized);
        }
      }

      if (allRemote.length > 0) {
        const merged = mergeMembers(get().members, allRemote);
        set({ members: merged });
        await saveMembers(merged);
      }

      // Real-time subscription to families/{familyId}/members
      try {
        const unsubscribe = await firebaseService.subscribeToFamilyMembers?.(ownerUid, async (firebaseMembers) => {
          try {
            const normalized = firebaseMembers.map(m => normalizeMember(m)).filter((m): m is FamilyMember => !!m);
            debouncedMergeAndSet(normalized, get, set);
          } catch (error) {
            logger.error('Real-time family error:', error);
          }
        });

        if (unsubscribe && typeof unsubscribe === 'function') {
          set({ firebaseUnsubscribe: unsubscribe });
        }
      } catch (subError: unknown) {
        const errorObj = subError as { code?: string; message?: string };
        if (errorObj?.code === 'permission-denied' || errorObj?.message?.includes('permission')) {
          logger.warn('Family subscription: permission denied — skipping');
        } else {
          logger.error('Family subscription error:', subError);
          // Retry for non-permission errors (max 3 attempts, 5s delay)
          let retryCount = 0;
          const retrySubscription = async () => {
            if (retryCount >= 3) {
              logger.warn('Family subscription retry exhausted');
              return;
            }
            retryCount++;
            // AUDIT FIX: Track timer so it can be cleared on logout
            await new Promise<void>(r => { retrySubscriptionTimer = setTimeout(() => { retrySubscriptionTimer = null; r(); }, 5000); });
            try {
              const retryUnsub = await firebaseService.subscribeToFamilyMembers?.(ownerUid, async (firebaseMembers) => {
                try {
                  const normalized = firebaseMembers.map(m => normalizeMember(m)).filter((m): m is FamilyMember => !!m);
                  debouncedMergeAndSet(normalized, get, set);
                } catch (error) {
                  logger.error('Real-time family error:', error);
                }
              });
              if (retryUnsub && typeof retryUnsub === 'function') {
                set({ firebaseUnsubscribe: retryUnsub });
                logger.info(`Family subscription recovered on retry ${retryCount}`);
              }
            } catch (retryError: unknown) {
              const retryErr = retryError as { code?: string };
              if (retryErr?.code === 'permission-denied') {
                logger.warn('Family subscription retry: permission denied — stopping');
              } else {
                logger.warn(`Family subscription retry ${retryCount} failed:`, retryError);
                retrySubscription();
              }
            }
          };
          retrySubscription();
        }
      }

      // BIDIRECTIONAL SYNC: Real-time listener for users/{myUid}/familyMembers
      // Detects when someone adds us to their family in real-time
      try {
        const { subscribeToFamilyMemberLinks } = await import('../services/firebase/FirebaseFamilyOperations');
        familyLinksUnsubscribe = await subscribeToFamilyMemberLinks(
          ownerUid,
          myDisplayName,
          async (member, _familyId) => {
            try {
              const currentMembers = get().members;
              // Dedup: skip if already in our local store
              if (currentMembers.some(m => m.uid === member.uid)) {
                logger.debug(`Remote family member ${member.uid} already in local store, skipping`);
                return;
              }

              const normalized = normalizeMember(member);
              if (!normalized) return;

              debouncedMergeAndSet([normalized], get, set);
              logger.info(`📥 Auto-added remote family member: ${member.name} (${member.uid})`);
            } catch (error) {
              logger.error('Error adding remote family member:', error);
            }
          },
        );
      } catch (error) {
        logger.warn('Family member links subscription failed:', error);
      }

      // CRITICAL FIX: ALWAYS subscribe to locations_current/{memberUid} for real-time location.
      // The families/{familyId}/members subscription only has member metadata (name, status, etc.)
      // with stale/empty lat/lng. Real-time GPS location is ONLY in locations_current/{uid}.
      // Previously this was gated behind `if (!get().firebaseUnsubscribe)` — making it a fallback
      // that never ran when the family member subscription succeeded. This caused family members
      // to always show at the wrong location (0,0 or the joining location).
      {
        const current = get().members;
        if (current.length > 0) {
          await syncLocationSubscriptions(current, (uid, lat, lng, observedAt) => {
            void get().updateMemberLocation(uid, lat, lng, 'remote', observedAt);
          });
          await syncStatusUpdateListeners(current);
        }
      }
    } catch (error) {
      logger.error('Firebase sync failed, using local:', error);
      const fallback = get().members;
      if (fallback.length > 0) {
        await syncLocationSubscriptions(fallback, (uid, lat, lng, observedAt) => {
          void get().updateMemberLocation(uid, lat, lng, 'remote', observedAt);
        });
        await syncStatusUpdateListeners(fallback);
      }
    }

    set({ isInitialized: true });
  },

  // ─── Add Member ──────────────────────────────
  addMember: async (member) => {
    const { members } = get();

    // UID required
    if (!member.uid || !isLikelyFirebaseUid(member.uid)) {
      throw new Error('Geçerli bir UID gereklidir.');
    }

    // Self check
    const myUid = getOwnerUid();
    if (member.uid === myUid) {
      throw new Error('Aynı hesap aile üyesi olarak eklenemez.');
    }

    // Duplicate check
    if (members.some(m => m.uid === member.uid)) {
      logger.warn(`Member ${member.uid} already exists, skipping`);
      return;
    }

    // ELITE: Remove from blocklist if we are explicitly re-adding them
    sessionDeletedUids.delete(member.uid);

    const newMember: FamilyMember = { ...member };
    const updatedMembers = [...members, newMember];
    set({ members: updatedMembers });

    await syncLocationSubscriptions(updatedMembers, (uid, lat, lng, observedAt) => {
      void get().updateMemberLocation(uid, lat, lng, 'remote', observedAt);
    });
    await syncStatusUpdateListeners(updatedMembers);
    await saveMembers(updatedMembers);

    // Cloud save
    try {
      await saveToCloud(newMember, 'save');
    } catch (error) {
      logger.error('Cloud save failed:', error);
      try {
        const { offlineSyncService } = await import('../services/OfflineSyncService');
        await offlineSyncService.queueOperation({
          type: 'save', data: { ownerUid: getOwnerUid(), member: newMember }, priority: 'normal'
        });
      } catch (syncError) { logger.error('Queue failed:', syncError); }
    }

    // Backend emergency
    await sendToBackend(newMember);
  },

  // ─── Update Member ──────────────────────────────
  updateMember: async (uid, updates) => {
    const { members } = get();
    const existing = members.find(m => m.uid === uid);
    if (!existing) {
      logger.warn(`updateMember: "${uid}" not found`);
      return;
    }

    const preserveLastSeen = updates.lastSeen === undefined;
    const updatedMembers = members.map(m => {
      if (m.uid !== uid) return m;
      const merged = { ...m, ...updates };
      if (preserveLastSeen) merged.lastSeen = m.lastSeen;
      return merged;
    });
    const updated = updatedMembers.find(m => m.uid === uid);
    set({ members: updatedMembers });

    await syncLocationSubscriptions(updatedMembers, (uid, lat, lng, observedAt) => {
      void get().updateMemberLocation(uid, lat, lng, 'remote', observedAt);
    });
    await syncStatusUpdateListeners(updatedMembers);
    await saveMembers(updatedMembers);

    if (updated) {
      try { await saveToCloud(updated, 'update'); } catch (e) { logger.error('Cloud update failed:', e); }
      await sendToBackend(updated);
    }
  },

  // ─── Remove Member ──────────────────────────────
  removeMember: async (uid) => {
    // ELITE: Block this UID from being auto-restored by real-time listeners for the rest of the session
    sessionDeletedUids.add(uid);

    const { members } = get();
    const existing = members.find(m => m.uid === uid);
    if (!existing) {
      logger.warn(`removeMember: "${uid}" not found`);
      return;
    }

    const updatedMembers = members.filter(m => m.uid !== uid);
    set({ members: updatedMembers });

    await syncLocationSubscriptions(updatedMembers, (uid, lat, lng, observedAt) => {
      void get().updateMemberLocation(uid, lat, lng, 'remote', observedAt);
    });
    await syncStatusUpdateListeners(updatedMembers);
    await saveMembers(updatedMembers);

    try {
      await deleteFromCloud(uid);
    } catch (e) {
      logger.error('Cloud delete failed — queueing for offline sync:', e);
      try {
        const { offlineSyncService } = await import('../services/OfflineSyncService');
        offlineSyncService.queueOperation({ type: 'delete', data: { collection: 'familyMembers', uid } });
      } catch { /* offline sync unavailable */ }
    }

    try {
      const { backendEmergencyService } = await import('../services/BackendEmergencyService');
      if (backendEmergencyService.initialized) {
        await backendEmergencyService.deleteFamilyMember(uid);
      }
    } catch (e) { logger.error('Backend delete failed:', e); }
  },

  // ─── Update Location ──────────────────────────────
  updateMemberLocation: async (uid, latitude, longitude, source = 'local', observedAt) => {
    if (!uid) return;
    const latNum = typeof latitude === 'string' ? Number(latitude) : latitude;
    const lngNum = typeof longitude === 'string' ? Number(longitude) : longitude;
    if (typeof latNum !== 'number' || typeof lngNum !== 'number') return;
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) return;
    const eventTimestamp = normalizeTimestamp(observedAt) || Date.now();

    const { members } = get();
    const existing = members.find(m => m.uid === uid || m.deviceId === uid);
    if (!existing) return;

    const currentFreshness = getMemberLocationFreshness(existing);
    const sameCoordinates = existing.latitude === latNum && existing.longitude === lngNum;
    if (sameCoordinates && eventTimestamp <= currentFreshness) return;

    const updatedMembers = members.map(m => {
      if (m.uid !== uid && m.deviceId !== uid) return m;
      const prevHistory = m.locationHistory || [];
      const newEntry = { latitude: latNum, longitude: lngNum, timestamp: eventTimestamp };
      return {
        ...m,
        latitude: latNum,
        longitude: lngNum,
        location: { latitude: latNum, longitude: lngNum, timestamp: eventTimestamp },
        lastKnownLocation: {
          latitude: latNum,
          longitude: lngNum,
          timestamp: eventTimestamp,
          batteryLevelAtCapture: typeof m.batteryLevel === 'number' ? m.batteryLevel : 0,
          source: (source === 'remote' ? 'cloud' : 'gps') as 'cloud' | 'gps',
        },
        lastSeen: Math.max(m.lastSeen || 0, eventTimestamp),
        updatedAt: Math.max(normalizeTimestamp(m.updatedAt), eventTimestamp),
        locationHistory: sameCoordinates
          ? prevHistory
          : [...prevHistory, newEntry].slice(-100),
      };
    });
    const updated = updatedMembers.find(m => m.uid === uid);
    set({ members: updatedMembers });
    await saveMembers(updatedMembers);

    if (updated && source === 'local') {
      try {
        const ownerUid = getOwnerUid();
        if (ownerUid) {
          const firebase = getFirebaseDataService();
          if (firebase?.isInitialized) {
            await firebase.saveFamilyMember(ownerUid, updated);
          }
        }
      } catch (e) { logger.error('Cloud location update failed:', e); }
      await sendToBackend(updated);
    }

    // Notification for members that have updated location while in critical/need-help
    if (updated && (updated.status === 'critical' || updated.status === 'need-help')) {
      try {
        const { notificationCenter } = await import('../services/notifications/NotificationCenter');
        await notificationCenter.notify('family', {
          memberName: updated.name,
          memberId: updated.uid,
          type: 'location_update',
          location: { latitude: latNum, longitude: lngNum },
          status: updated.status,
          isSOS: updated.status === 'critical',
        }, 'familyStore');
      } catch { /* */ }
    }
  },

  // ─── Update Status ──────────────────────────────
  updateMemberStatus: async (uid, status, source = 'local') => {
    const { members } = get();
    const existing = members.find(m => m.uid === uid);
    if (!existing) return;
    if (existing.status === status) return;

    const updatedMembers = members.map(m => m.uid === uid ? { ...m, status, lastSeen: Date.now() } : m);
    const updated = updatedMembers.find(m => m.uid === uid);
    set({ members: updatedMembers });
    await saveMembers(updatedMembers);

    if (updated && source === 'local') {
      try {
        const ownerUid = getOwnerUid();
        if (ownerUid) {
          const firebase = getFirebaseDataService();
          if (firebase?.isInitialized) {
            await firebase.saveFamilyMember(ownerUid, updated);
          }
        }
      } catch (e) { logger.error('Cloud status update failed:', e); }
      await sendToBackend(updated);
    }

    // Notify user of status changes locally
    if (updated && ['safe', 'need-help', 'critical', 'danger'].includes(status)) {
      try {
        const { notificationCenter } = await import('../services/notifications/NotificationCenter');
        await notificationCenter.notify('family', {
          memberName: updated.name,
          memberId: uid,
          isSOS: status === 'critical' || status === 'danger',
          type: 'status_change',
          status,
          location: updated.location ? {
            latitude: updated.location.latitude,
            longitude: updated.location.longitude,
          } : undefined,
        }, 'familyStore-status');

        // Use MultiChannelAlertService to provide visceral feedback like the user expects
        if (source === 'remote') {
          const { multiChannelAlertService } = await import('../services/MultiChannelAlertService');

          if (status === 'safe' || status === 'need-help') {
            const isNeedHelp = status === 'need-help';
            await multiChannelAlertService.sendAlert({
              title: isNeedHelp ? '🆘 YARDIM ÇAĞRISI' : '✅ GÜVENDE',
              body: `${updated.name}: ${isNeedHelp ? 'Yardıma İhtiyacım Var' : 'Güvendeyim'}`,
              priority: isNeedHelp ? 'high' : 'normal',
              channels: {
                pushNotification: false,
                fullScreenAlert: false, // Don't block screen, but show something
                alarmSound: isNeedHelp,
                vibration: true,
                tts: true,
              },
              ttsText: `${updated.name} ${isNeedHelp ? 'yardıma ihtiyacı olduğunu' : 'güvende olduğunu'} bildirdi.`,
            });
          }
        }
      } catch (e) {
        logger.warn('Failed to dispatch local status notification', e);
      }
    }
  },

  // ─── Clear ──────────────────────────────
  clear: async () => {
    // ELITE: Clear merge timer to prevent stale callbacks after logout
    if (_mergeTimer) { clearTimeout(_mergeTimer); _mergeTimer = null; }
    _pendingMergeMembers = null;

    // AUDIT FIX: Clear retrySubscription timer to prevent post-logout retries
    if (retrySubscriptionTimer) { clearTimeout(retrySubscriptionTimer); retrySubscriptionTimer = null; }

    // AUDIT FIX: Clear sessionDeletedUids so next session starts fresh
    sessionDeletedUids.clear();

    const { firebaseUnsubscribe } = get();
    if (firebaseUnsubscribe) { try { firebaseUnsubscribe(); } catch { /* */ } }
    clearSubscriptions(memberLocationSubscriptions);
    clearSubscriptions(statusUpdateSubscriptions);
    // AUDIT FIX: Clear status retry timers to prevent post-logout Firestore subscriptions
    statusRetryTimers.forEach(t => clearTimeout(t));
    statusRetryTimers.length = 0;
    if (familyLinksUnsubscribe) { try { familyLinksUnsubscribe(); } catch { /* */ } familyLinksUnsubscribe = null; }

    try { const { stopSOSAlertListener } = await import('../services/sos/SOSAlertListener'); stopSOSAlertListener(); } catch { /* */ }
    try { const { stopNearbySOSListener } = await import('../services/sos/NearbySOSListener'); stopNearbySOSListener(); } catch { /* */ }

    set({ members: [], firebaseUnsubscribe: null, isInitialized: false });

    try { DirectStorage.delete(getScopedStorageKey()); } catch { /* best effort */ }

    // NOTE: Do NOT delete family members from Firestore on logout.
    // Cloud data must persist so other family members can still see this user.
    // Cloud data should only be deleted on explicit account deletion (GDPR/KVKK).
  },
}));
