/**
 * FIREBASE FAMILY OPERATIONS — UID-CENTRIC v3.0
 * 
 * PATH ARCHITECTURE:
 *   families/{familyId}                     — Family group document
 *   families/{familyId}/members/{uid}       — Member documents (keyed by UID)
 *   users/{uid}/familyIds/{familyId}        — UID → familyId mapping (for rules)
 * 
 * Old model: devices/{id}/familyMembers/{memberId} (device-centric, reciprocal hell)
 * New model: One family group, members keyed by UID, bidirectional mapping via familyIds.
 * 
 * SECURITY RULE SUPPORT:
 *   isFamilyMember = exists(/databases/.../users/{request.auth.uid}/familyIds/{familyId})
 *   AND request.auth.uid in get(/databases/.../families/{familyId}).data.members
 * 
 * @version 3.0.0
 */

import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, onSnapshot, query, where, arrayRemove, arrayUnion, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { FamilyMember } from '../../types/family';

const logger = createLogger('FirebaseFamilyOps');
const TIMEOUT_MS = 10000;
const RETRY_CONFIG = { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 5000 };
const MIN_VALID_TIMESTAMP_MS = new Date('2000-01-01T00:00:00.000Z').getTime();
const FIREBASE_UID_REGEX = /^[A-Za-z0-9]{20,40}$/;

// ─── HELPERS ──────────────────────────────────────

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function getErrorCode(e: unknown): string | undefined {
  return (e as any)?.code;
}

function toFiniteNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toNullableFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeTimestampMs(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const normalized = value < 1e11 ? Math.round(value * 1000) : Math.round(value);
    return normalized >= MIN_VALID_TIMESTAMP_MS ? normalized : fallback;
  }

  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      const normalized = asNumber < 1e11 ? Math.round(asNumber * 1000) : Math.round(asNumber);
      return normalized >= MIN_VALID_TIMESTAMP_MS ? normalized : fallback;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed >= MIN_VALID_TIMESTAMP_MS) {
      return parsed;
    }
    return fallback;
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) && ms >= MIN_VALID_TIMESTAMP_MS ? ms : fallback;
  }

  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { toMillis?: () => number; seconds?: number };
    if (typeof maybeTimestamp.toMillis === 'function') {
      const ms = maybeTimestamp.toMillis();
      return Number.isFinite(ms) && ms >= MIN_VALID_TIMESTAMP_MS ? ms : fallback;
    }
    if (typeof maybeTimestamp.seconds === 'number' && Number.isFinite(maybeTimestamp.seconds) && maybeTimestamp.seconds > 0) {
      const ms = Math.round(maybeTimestamp.seconds * 1000);
      return ms >= MIN_VALID_TIMESTAMP_MS ? ms : fallback;
    }
  }

  return fallback;
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operationName} timeout`)), TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function handleFirestoreError(error: unknown, operationName: string): boolean {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  if (code === 'permission-denied' || message.includes('permission')) {
    logger.warn(`⚠️ ${operationName}: permission denied`);
    return false;
  }
  if (message.includes('timeout')) {
    logger.debug(`${operationName}: timed out`);
    return false;
  }
  logger.error(`${operationName} failed:`, error);
  return false;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: typeof RETRY_CONFIG,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (getErrorCode(error) === 'permission-denied') throw error;
      if (attempt < config.maxRetries) {
        const delay = Math.min(config.baseDelayMs * Math.pow(2, attempt), config.maxDelayMs);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Generate a family ID (UUID).
 */
async function generateFamilyId(): Promise<string> {
  try {
    const { default: Crypto } = await import('expo-crypto');
    return Crypto.randomUUID();
  } catch {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `fam-${ts}-${rand}`;
  }
}

// ─── FAMILY GROUP OPERATIONS ──────────────────────

/**
 * Create a new family group.
 * Creates families/{familyId} and adds creator as first member.
 * Also creates users/{uid}/familyIds/{familyId} mapping.
 */
export async function createFamily(
  myUid: string,
  myDisplayName: string,
  familyName: string = 'Ailem',
): Promise<string | null> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return null;

    const familyId = await generateFamilyId();
    const now = Date.now();

    // Create family group document
    await setDoc(doc(db, 'families', familyId), {
      name: familyName,
      members: [myUid],
      createdBy: myUid,
      createdAt: now,
      updatedAt: now,
    });

    // Add self as member
    await setDoc(doc(db, 'families', familyId, 'members', myUid), {
      uid: myUid,
      name: myDisplayName,
      role: 'admin',
      joinedAt: now,
      status: 'safe',
    });

    // Create UID → familyId mapping (for security rules)
    await setDoc(
      doc(db, 'users', myUid, 'familyIds', familyId),
      { active: true, joinedAt: now }
    );

    logger.info(`✅ Family created: families/${familyId}`);
    return familyId;
  } catch (error) {
    logger.error('Failed to create family:', error);
    return null;
  }
}

/**
 * Get or create a default family for the current user.
 * If user has no families, creates one automatically.
 */
export async function getOrCreateDefaultFamily(
  myUid: string,
  myDisplayName: string,
): Promise<string | null> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return null;

    // Check if user has any families
    const familyIdsRef = collection(db, 'users', myUid, 'familyIds');
    const snapshot = await getDocs(familyIdsRef);

    if (!snapshot.empty) {
      // Return first active family
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.active !== false) {
          return docSnap.id;
        }
      }
    }

    // No family — create default
    return createFamily(myUid, myDisplayName);
  } catch (error) {
    logger.warn('getOrCreateDefaultFamily failed:', error);
    return null;
  }
}

/**
 * Add a family member to a specific family group.
 * 
 * Path: families/{familyId}/members/{memberUid}
 * Also creates reciprocal familyIds mapping for the member.
 */
export async function saveFamilyMember(
  familyId: string,
  member: FamilyMember,
  myUid: string,
): Promise<boolean> {
  const memberUid = typeof member.uid === 'string' ? member.uid.trim() : '';
  if (!familyId || !memberUid || !FIREBASE_UID_REGEX.test(memberUid)) {
    logger.warn('saveFamilyMember: member UID is missing/invalid for V3 model');
    return false;
  }

  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return false;
    }

    const now = Date.now();
    const joinedAt = normalizeTimestampMs(member.createdAt, now);
    const updatedAt = normalizeTimestampMs(member.updatedAt, now);
    const lastSeen = normalizeTimestampMs(member.lastSeen, updatedAt);
    const latitude = toFiniteNumber(member.latitude ?? member.location?.latitude, 0);
    const longitude = toFiniteNumber(member.longitude ?? member.location?.longitude, 0);
    const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;
    const locationPayload = hasLocation
      ? {
        latitude,
        longitude,
        timestamp: normalizeTimestampMs(member.location?.timestamp, lastSeen || updatedAt),
        accuracy: toFiniteNumber(member.location?.accuracy, 0),
      }
      : null;

    // 1. Write member document
    const memberRef = doc(db, 'families', familyId, 'members', memberUid);
    await retryWithBackoff(
      () => withTimeout(
        () => setDoc(memberRef, {
          uid: memberUid,
          id: member.uid, // backward compat
          name: member.name,
          status: member.status || 'unknown',
          deviceId: member.deviceId || null,
          relationship: member.relationship || null,
          phoneNumber: member.phoneNumber || null,
          notes: member.notes || null,
          avatarUrl: member.avatarUrl || null,
          joinedAt,
          createdAt: joinedAt,
          updatedAt,
          lastSeen,
          latitude,
          longitude,
          location: locationPayload,
          batteryLevel: typeof member.batteryLevel === 'number' ? member.batteryLevel : null,
          isOnline: typeof member.isOnline === 'boolean'
            ? member.isOnline
            : (lastSeen > 0 ? now - lastSeen < 10 * 60 * 1000 : false),
        }, { merge: true }),
        'Aile üyesi kaydetme',
      ),
      RETRY_CONFIG,
    );

    // 2. Add to family members array
    const familyRef = doc(db, 'families', familyId);
    await updateDoc(familyRef, {
      members: arrayUnion(memberUid),
      updatedAt: now,
    }).catch(() => {
      // If updateDoc fails (doc may not exist yet), try setDoc with merge
      // CRITICAL: createdBy is required by Firestore rules for family create
      return setDoc(familyRef, {
        members: [memberUid, myUid],
        createdBy: myUid,
        updatedAt: now,
      }, { merge: true });
    });

    // 3. Create UID → familyId mapping for the new member
    await setDoc(
      doc(db, 'users', memberUid, 'familyIds', familyId),
      { active: true, joinedAt: now },
      { merge: true }
    ).catch((err) => {
      // May fail if we can't write to another user's doc — that's expected
      logger.debug(`familyIds mapping write for ${memberUid}: ${getErrorMessage(err)}`);
    });

    // 4. Create bidirectional familyMembers mapping (for Firestore rules)
    // users/{myUid}/familyMembers/{memberUid} and vice versa
    // CRITICAL: Include adderUid + adderName in the reverse doc so the target
    // user can identify who added them and join the correct family on sync.
    const adderName = await (async () => {
      try {
        const { identityService } = await import('../../services/IdentityService');
        return identityService.getDisplayName() || 'Aile Üyesi';
      } catch { return 'Aile Üyesi'; }
    })();
    await Promise.all([
      setDoc(
        doc(db, 'users', myUid, 'familyMembers', memberUid),
        { familyId, name: member.name, addedAt: now },
        { merge: true }
      ).catch(() => { }),
      setDoc(
        doc(db, 'users', memberUid, 'familyMembers', myUid),
        { familyId, adderUid: myUid, adderName, addedAt: now },
        { merge: true }
      ).catch(() => { }),
    ]);

    logger.info(`✅ Family member saved: families/${familyId}/members/${memberUid}`);
    return true;
  } catch (error: unknown) {
    return handleFirestoreError(error, 'saveFamilyMember');
  }
}

/**
 * Load family members from a family group.
 * Path: families/{familyId}/members/
 */
export async function loadFamilyMembers(
  familyId: string,
): Promise<FamilyMember[]> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available');
      return [];
    }

    const membersRef = collection(db, 'families', familyId, 'members');

    const snapshot = await retryWithBackoff(
      () => withTimeout(() => getDocs(membersRef), 'Aile üyelerini yükleme'),
      RETRY_CONFIG,
    );

    const members: FamilyMember[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const lastSeen = normalizeTimestampMs(data.lastSeen, 0);
      const createdAt = normalizeTimestampMs(data.joinedAt ?? data.createdAt, 0);
      const updatedAt = normalizeTimestampMs(data.updatedAt, createdAt || lastSeen || Date.now());
      const latitude = toFiniteNumber(data.latitude ?? data.location?.latitude, 0);
      const longitude = toFiniteNumber(data.longitude ?? data.location?.longitude, 0);
      const locationTimestamp = normalizeTimestampMs(data.location?.timestamp, lastSeen || updatedAt);
      const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;

      members.push({
        id: data.id || docSnap.id,
        uid: docSnap.id,
        familyId,
        name: data.name || 'Bilinmeyen',
        status: data.status || 'unknown',
        lastSeen,
        latitude,
        longitude,
        location: hasLocation
          ? {
            latitude,
            longitude,
            timestamp: locationTimestamp,
            accuracy: toFiniteNumber(data.location?.accuracy, 0),
          }
          : undefined,
        batteryLevel: toNullableFiniteNumber(data.batteryLevel) ?? undefined,
        isOnline: typeof data.isOnline === 'boolean'
          ? data.isOnline
          : (lastSeen > 0 ? Date.now() - lastSeen < 10 * 60 * 1000 : false),
        deviceId: typeof data.deviceId === 'string' ? data.deviceId : undefined,
        avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
        relationship: typeof data.relationship === 'string' ? data.relationship : undefined,
        phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : undefined,
        notes: typeof data.notes === 'string' ? data.notes : undefined,
        createdAt,
        updatedAt,
      } as FamilyMember);
    });

    logger.debug(`Loaded ${members.length} members from families/${familyId}`);
    return members;
  } catch (error: unknown) {
    handleFirestoreError(error, 'loadFamilyMembers');
    return [];
  }
}

/**
 * Delete family member from a family group.
 * myUid is optional — when provided, directly cleans up the bidirectional link.
 */
export async function deleteFamilyMember(
  familyId: string,
  memberUid: string,
  myUid?: string,
): Promise<boolean> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return false;

    // 1. Remove member doc
    await retryWithBackoff(
      () => withTimeout(
        () => deleteDoc(doc(db, 'families', familyId, 'members', memberUid)),
        'Aile üyesi silme',
      ),
      RETRY_CONFIG,
    );

    // 2. Remove from members array
    const familyRef = doc(db, 'families', familyId);
    await updateDoc(familyRef, {
      members: arrayRemove(memberUid),
      updatedAt: Date.now(),
    }).catch(() => { /* best-effort */ });

    // 3. Remove UID → familyId mapping
    await deleteDoc(
      doc(db, 'users', memberUid, 'familyIds', familyId)
    ).catch(() => { /* best-effort — may not have permission */ });

    // 4. Remove bidirectional familyMembers mapping (best-effort)
    // Direct cleanup if we know who is removing whom
    if (myUid) {
      await deleteDoc(doc(db, 'users', myUid, 'familyMembers', memberUid)).catch(() => { });
      await deleteDoc(doc(db, 'users', memberUid, 'familyMembers', myUid)).catch(() => { });
    }
    // Also enumerate remaining family members for thorough cleanup
    try {
      const membersSnap = await getDocs(collection(db, 'families', familyId, 'members'));
      for (const mDoc of membersSnap.docs) {
        const otherUid = mDoc.id;
        if (otherUid === memberUid) continue;
        await deleteDoc(doc(db, 'users', otherUid, 'familyMembers', memberUid)).catch(() => { });
        await deleteDoc(doc(db, 'users', memberUid, 'familyMembers', otherUid)).catch(() => { });
      }
    } catch { /* best-effort cleanup */ }

    logger.info(`✅ Member ${memberUid} deleted from families/${familyId}`);
    return true;
  } catch (error: unknown) {
    return handleFirestoreError(error, 'deleteFamilyMember');
  }
}

/**
 * Subscribe to real-time family member updates.
 * Path: families/{familyId}/members/
 */
export async function subscribeToFamilyMembers(
  familyId: string,
  callback: (members: FamilyMember[]) => void,
  onError?: (error: any) => void,
): Promise<() => void> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) {
      logger.warn('Firestore not available for family subscription');
      return () => { };
    }

    const membersRef = collection(db, 'families', familyId, 'members');

    const unsubscribe = onSnapshot(
      membersRef,
      (snapshot) => {
        try {
          const members: FamilyMember[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const lastSeen = normalizeTimestampMs(data.lastSeen, 0);
            const createdAt = normalizeTimestampMs(data.joinedAt ?? data.createdAt, 0);
            const updatedAt = normalizeTimestampMs(data.updatedAt, createdAt || lastSeen || Date.now());
            const latitude = toFiniteNumber(data.latitude ?? data.location?.latitude, 0);
            const longitude = toFiniteNumber(data.longitude ?? data.location?.longitude, 0);
            const locationTimestamp = normalizeTimestampMs(data.location?.timestamp, lastSeen || updatedAt);
            const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;

            members.push({
              id: data.id || docSnap.id,
              uid: docSnap.id,
              familyId,
              name: data.name || 'Bilinmeyen',
              status: data.status || 'unknown',
              lastSeen,
              latitude,
              longitude,
              location: hasLocation
                ? {
                  latitude,
                  longitude,
                  timestamp: locationTimestamp,
                  accuracy: toFiniteNumber(data.location?.accuracy, 0),
                }
                : undefined,
              batteryLevel: toNullableFiniteNumber(data.batteryLevel) ?? undefined,
              isOnline: typeof data.isOnline === 'boolean'
                ? data.isOnline
                : (lastSeen > 0 ? Date.now() - lastSeen < 10 * 60 * 1000 : false),
              deviceId: typeof data.deviceId === 'string' ? data.deviceId : undefined,
              avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
              relationship: typeof data.relationship === 'string' ? data.relationship : undefined,
              phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : undefined,
              notes: typeof data.notes === 'string' ? data.notes : undefined,
              createdAt,
              updatedAt,
            } as FamilyMember);
          });
          callback(members);
        } catch (error) {
          logger.error('Error processing family member snapshot:', error);
          onError?.(error);
        }
      },
      (error: any) => {
        if (error?.code === 'permission-denied') {
          logger.debug(`Family subscription for ${familyId}: permission denied`);
          return;
        }
        logger.warn(`Family subscription error for ${familyId}:`, error);
        onError?.(error);
      },
    );

    logger.info(`✅ Subscribed to family members: families/${familyId}`);
    return unsubscribe;
  } catch (error) {
    logger.error('Failed to subscribe to family members:', error);
    return () => { };
  }
}

// ─── BIDIRECTIONAL SYNC ──────────────────────────────

/**
 * Sync remote family additions on app launch.
 * Reads users/{myUid}/familyMembers to find families that others have added us to.
 * For each, ensures:
 *   - users/{myUid}/familyIds/{familyId} mapping exists (so we can read the family)
 *   - We are in the families/{familyId}/members array
 *   - Returns the list of family members from all linked families
 */
export async function syncRemoteFamilyAdditions(
  myUid: string,
  myDisplayName: string,
): Promise<FamilyMember[]> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return [];

    // Read all familyMembers links pointing to me
    const linksRef = collection(db, 'users', myUid, 'familyMembers');
    const linksSnap = await withTimeout(() => getDocs(linksRef), 'Sync remote family links');

    if (linksSnap.empty) return [];

    const now = Date.now();
    const allMembers: FamilyMember[] = [];
    const seenFamilyIds = new Set<string>();

    for (const linkDoc of linksSnap.docs) {
      const data = linkDoc.data();
      const familyId = data.familyId;
      if (!familyId || typeof familyId !== 'string') continue;
      if (seenFamilyIds.has(familyId)) continue;
      seenFamilyIds.add(familyId);

      // Ensure I have the familyIds mapping (only owner can write, so this is for MY doc)
      try {
        await setDoc(
          doc(db, 'users', myUid, 'familyIds', familyId),
          { active: true, joinedAt: now },
          { merge: true }
        );
      } catch (err) {
        logger.debug(`familyIds self-mapping: ${getErrorMessage(err)}`);
      }

      // Ensure I'm in the family members array
      try {
        const familyRef = doc(db, 'families', familyId);
        await updateDoc(familyRef, {
          members: arrayUnion(myUid),
          updatedAt: now,
        });
      } catch {
        // May fail if family doc doesn't exist or permission — best effort
      }

      // Ensure I have a member doc in the family
      try {
        const myMemberRef = doc(db, 'families', familyId, 'members', myUid);
        const myMemberDoc = await getDoc(myMemberRef);
        if (!myMemberDoc.exists()) {
          await setDoc(myMemberRef, {
            uid: myUid,
            name: myDisplayName,
            status: 'unknown',
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
          }, { merge: true });
        }
      } catch {
        // best effort
      }

      // Load members from this family
      try {
        const members = await loadFamilyMembers(familyId);
        for (const m of members) {
          if (m.uid && m.uid !== myUid) {
            allMembers.push(m);
          }
        }
      } catch {
        // best effort — will retry next launch
      }
    }

    if (allMembers.length > 0) {
      logger.info(`✅ Synced ${allMembers.length} remote family members from ${seenFamilyIds.size} families`);
    }

    return allMembers;
  } catch (error) {
    logger.warn('syncRemoteFamilyAdditions failed:', error);
    return [];
  }
}

/**
 * Subscribe to real-time changes on users/{myUid}/familyMembers.
 * Detects when another user adds us to their family.
 * Calls onNewMember for each newly detected family member link.
 */
export async function subscribeToFamilyMemberLinks(
  myUid: string,
  myDisplayName: string,
  onNewMember: (member: FamilyMember, familyId: string) => void,
): Promise<() => void> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return () => { };

    const linksRef = collection(db, 'users', myUid, 'familyMembers');
    const knownLinks = new Set<string>();
    let isFirstSnapshot = true;

    const unsubscribe = onSnapshot(
      linksRef,
      async (snapshot) => {
        try {
          const now = Date.now();

          for (const change of snapshot.docChanges()) {
            if (change.type !== 'added') continue;

            const otherUid = change.doc.id;
            if (otherUid === myUid) continue;
            if (knownLinks.has(otherUid)) continue;
            knownLinks.add(otherUid);

            // Skip processing on first snapshot (handled by syncRemoteFamilyAdditions)
            if (isFirstSnapshot) continue;

            const data = change.doc.data();
            const familyId = data.familyId;
            if (!familyId || typeof familyId !== 'string') continue;

            logger.info(`📥 Remote family addition detected: ${otherUid} added me to family ${familyId}`);

            // Create my own familyIds mapping
            try {
              await setDoc(
                doc(db, 'users', myUid, 'familyIds', familyId),
                { active: true, joinedAt: now },
                { merge: true }
              );
            } catch { /* best effort */ }

            // Add myself to the family members array
            try {
              const familyRef = doc(db, 'families', familyId);
              await updateDoc(familyRef, {
                members: arrayUnion(myUid),
                updatedAt: now,
              });
            } catch { /* best effort */ }

            // Ensure my member doc exists in the family
            try {
              const myMemberRef = doc(db, 'families', familyId, 'members', myUid);
              const myMemberDoc = await getDoc(myMemberRef);
              if (!myMemberDoc.exists()) {
                await setDoc(myMemberRef, {
                  uid: myUid,
                  name: myDisplayName,
                  status: 'unknown',
                  joinedAt: now,
                  createdAt: now,
                  updatedAt: now,
                }, { merge: true });
              }
            } catch { /* best effort */ }

            // Resolve the adder's info to create a FamilyMember
            const adderName = typeof data.adderName === 'string' ? data.adderName : 'Aile Üyesi';
            const member: FamilyMember = {
              id: otherUid,
              uid: otherUid,
              familyId,
              name: adderName,
              status: 'unknown',
              lastSeen: 0,
              latitude: 0,
              longitude: 0,
              createdAt: typeof data.addedAt === 'number' ? data.addedAt : now,
              updatedAt: now,
            } as FamilyMember;

            onNewMember(member, familyId);
          }

          isFirstSnapshot = false;
        } catch (error) {
          logger.error('Error processing familyMemberLinks snapshot:', error);
        }
      },
      (error: any) => {
        if (error?.code === 'permission-denied') {
          logger.debug('familyMemberLinks subscription: permission denied');
          return;
        }
        logger.warn('familyMemberLinks subscription error:', error);
      },
    );

    logger.info(`✅ Subscribed to family member links: users/${myUid}/familyMembers`);
    return unsubscribe;
  } catch (error) {
    logger.error('Failed to subscribe to family member links:', error);
    return () => { };
  }
}

// ─── LEGACY COMPAT ──────────────────────────────────

/**
 * @deprecated Load family members from OLD devices/{id}/familyMembers path.
 * Used during migration to read existing data.
 */
export async function loadFamilyMembersLegacy(
  userDeviceId: string,
): Promise<FamilyMember[]> {
  try {
    const db = await getFirestoreInstanceAsync();
    if (!db) return [];

    const membersRef = collection(db, 'devices', userDeviceId, 'familyMembers');
    const snapshot = await withTimeout(() => getDocs(membersRef), 'Legacy family load');

    const members: FamilyMember[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const lastSeen = normalizeTimestampMs(data.lastSeen, 0);
      const createdAt = normalizeTimestampMs(data.createdAt, 0);
      const updatedAt = normalizeTimestampMs(data.updatedAt, createdAt || lastSeen || Date.now());
      const latitude = toFiniteNumber(data.latitude ?? data.location?.latitude, 0);
      const longitude = toFiniteNumber(data.longitude ?? data.location?.longitude, 0);
      const locationTimestamp = normalizeTimestampMs(data.location?.timestamp, lastSeen || updatedAt);
      const hasLocation = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude !== 0 && longitude !== 0;

      members.push({
        id: data.id || docSnap.id,
        uid: data.uid || data.id || docSnap.id,
        familyId: data.familyId || undefined,
        name: data.name || 'Bilinmeyen',
        status: data.status || 'unknown',
        lastSeen,
        latitude,
        longitude,
        location: hasLocation
          ? {
            latitude,
            longitude,
            timestamp: locationTimestamp,
            accuracy: toFiniteNumber(data.location?.accuracy, 0),
          }
          : undefined,
        batteryLevel: toNullableFiniteNumber(data.batteryLevel) ?? undefined,
        isOnline: typeof data.isOnline === 'boolean'
          ? data.isOnline
          : (lastSeen > 0 ? Date.now() - lastSeen < 10 * 60 * 1000 : false),
        deviceId: typeof data.deviceId === 'string' ? data.deviceId : undefined,
        avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
        relationship: typeof data.relationship === 'string' ? data.relationship : undefined,
        phoneNumber: typeof data.phoneNumber === 'string' ? data.phoneNumber : undefined,
        notes: typeof data.notes === 'string' ? data.notes : undefined,
        createdAt,
        updatedAt,
      } as FamilyMember);
    });

    return members;
  } catch (error) {
    handleFirestoreError(error, 'loadFamilyMembersLegacy');
    return [];
  }
}
