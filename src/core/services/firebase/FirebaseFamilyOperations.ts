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

import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, onSnapshot, query, where, arrayRemove, arrayUnion, updateDoc, limit, writeBatch } from 'firebase/firestore';
import { createLogger } from '../../utils/logger';
import { getFirestoreInstanceAsync } from './FirebaseInstanceManager';
import type { FamilyMember } from '../../types/family';
import { isLikelyFirebaseUid } from '../../utils/messaging/identityUtils';

const logger = createLogger('FirebaseFamilyOps');
const TIMEOUT_MS = 10000;
const RETRY_CONFIG = { maxRetries: 2, baseDelayMs: 500, maxDelayMs: 5000 };
const MIN_VALID_TIMESTAMP_MS = new Date('2000-01-01T00:00:00.000Z').getTime();

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

function isMutualFamilyLinkData(data: Record<string, unknown> | null | undefined): boolean {
  return data?.approvalState === 'mutual'
    || data?.relationshipStatus === 'accepted'
    || data?.isMutual === true;
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
      { active: true, joinedAt: now, ownerUid: myUid, role: 'owner' }
    );

    logger.info(`✅ Family created: families/${familyId}`);

    // AUTO-CREATE FAMILY GROUP CHAT
    // When a family is created, automatically create a group chat so all members
    // can communicate immediately. Store the groupId in the family document.
    try {
      const { groupChatService } = await import('../GroupChatService');
      const { identityService } = await import('../IdentityService');
      const myDeviceId = identityService.getMeshDeviceId?.() || identityService.getMyId?.() || myUid;

      const groupId = await groupChatService.createGroup(
        familyName,
        [myUid],
        { [myUid]: myDisplayName },
        { [myUid]: myDeviceId },
      );

      if (groupId) {
        // Store the family group chat ID in the family document for easy lookup
        await updateDoc(doc(db, 'families', familyId), {
          familyGroupChatId: groupId,
        }).catch(e => { if (__DEV__) logger.debug('familyGroupChatId update failed:', e); });
        logger.info(`✅ Family group chat auto-created: ${groupId} for family ${familyId}`);
      }
    } catch (groupError) {
      // Non-blocking — FamilyGroupChatScreen creates on-demand as fallback
      logger.warn('Auto-create family group chat failed (non-blocking):', groupError);
    }

    return familyId;
  } catch (error) {
    logger.error('Failed to create family:', error);
    return null;
  }
}

/**
 * Get or create a default family for the current user.
 * If user has no families, creates one automatically.
 * Uses in-memory dedup to prevent concurrent calls creating duplicate families.
 */
let _pendingFamilyCreation: Promise<string | null> | null = null;

export async function getOrCreateDefaultFamily(
  myUid: string,
  myDisplayName: string,
): Promise<string | null> {
  // Dedup: if another call is already in-flight, wait for it
  if (_pendingFamilyCreation) return _pendingFamilyCreation;

  _pendingFamilyCreation = _getOrCreateDefaultFamilyImpl(myUid, myDisplayName);
  try {
    return await _pendingFamilyCreation;
  } finally {
    _pendingFamilyCreation = null;
  }
}

async function _getOrCreateDefaultFamilyImpl(
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
      // Return the user's own active family. Remote family links are relationship
      // metadata and must not become the default write target for this user.
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.active === false) continue;

        if (data.role === 'owner' || data.ownerUid === myUid) {
          return docSnap.id;
        }

        try {
          const familyDoc = await getDoc(doc(db, 'families', docSnap.id));
          if (familyDoc.exists() && familyDoc.data()?.createdBy === myUid) {
            await setDoc(
              doc(db, 'users', myUid, 'familyIds', docSnap.id),
              { active: true, ownerUid: myUid, role: 'owner', updatedAt: Date.now() },
              { merge: true },
            );
            return docSnap.id;
          }
        } catch {
          // Ignore unreadable remote family mappings; they are not default write targets.
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
  if (!familyId || !memberUid || !isLikelyFirebaseUid(memberUid)) {
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
    const approvalState = member.approvalState === 'mutual' ? 'mutual' : 'pending';
    const adderName = await (async () => {
      try {
        const { identityService } = await import('../../services/IdentityService');
        return identityService.getDisplayName() || 'Aile Üyesi';
      } catch { return 'Aile Üyesi'; }
    })();

    if (approvalState !== 'mutual') {
      await setDoc(
        doc(db, 'users', myUid, 'familyMembers', memberUid),
        {
          familyId,
          name: member.name,
          approvalState: 'pending',
          relationshipStatus: 'pending',
          requestedBy: myUid,
          requestedAt: now,
          addedAt: now,
          updatedAt: now,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, 'users', memberUid, 'familyMembers', myUid),
        {
          familyId,
          adderUid: myUid,
          adderName,
          approvalState: 'pending',
          relationshipStatus: 'pending',
          requestedBy: myUid,
          requestedAt: now,
          addedAt: now,
          updatedAt: now,
        },
        { merge: true }
      ).catch(e => { if (__DEV__) logger.debug('pending familyMembers reverse link write failed:', e); });

      logger.info(`⏳ Pending family invitation saved for ${memberUid}; live data stays locked until acceptance`);
      return true;
    }

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
          approvalState,
          batteryLevel: typeof member.batteryLevel === 'number' ? member.batteryLevel : null,
          isOnline: typeof member.isOnline === 'boolean'
            ? member.isOnline
            : (lastSeen > 0 ? now - lastSeen < 10 * 60 * 1000 : false),
        }, { merge: true }),
        'Aile üyesi kaydetme',
      ),
      RETRY_CONFIG,
    );

    // 2. Add to family members array (with retry for transient failures)
    const familyRef = doc(db, 'families', familyId);
    await retryWithBackoff(
      () => withTimeout(
        async () => {
          await updateDoc(familyRef, {
            members: arrayUnion(memberUid),
            updatedAt: now,
          }).catch(() => {
            // If updateDoc fails (doc may not exist yet), try setDoc with merge
            // CRITICAL: createdBy is required by Firestore rules for family create
            return setDoc(familyRef, {
              members: arrayUnion(memberUid, myUid),
              createdBy: myUid,
              updatedAt: now,
            }, { merge: true });
          });
        },
        'Aile üyesi dizisi güncelleme',
      ),
      RETRY_CONFIG,
    );

    // 3. Create UID → familyId mapping for the new member
    await setDoc(
      doc(db, 'users', memberUid, 'familyIds', familyId),
      { active: true, joinedAt: now, ownerUid: myUid, role: 'member' },
      { merge: true }
    ).catch((err) => {
      // May fail if we can't write to another user's doc — that's expected
      logger.debug(`familyIds mapping write for ${memberUid}: ${getErrorMessage(err)}`);
    });

    // 4. Create bidirectional familyMembers mapping (for Firestore rules)
    // users/{myUid}/familyMembers/{memberUid} and vice versa
    await Promise.all([
      setDoc(
        doc(db, 'users', myUid, 'familyMembers', memberUid),
        {
          familyId,
          name: member.name,
          approvalState: 'mutual',
          relationshipStatus: 'accepted',
          requestedBy: myUid,
          addedAt: now,
          acceptedAt: now,
          updatedAt: now,
        },
        { merge: true }
      ).catch(e => { if (__DEV__) logger.debug('familyMembers forward link write failed:', e); }),
      setDoc(
        doc(db, 'users', memberUid, 'familyMembers', myUid),
        {
          familyId,
          adderUid: myUid,
          adderName,
          approvalState: 'mutual',
          relationshipStatus: 'accepted',
          requestedBy: myUid,
          addedAt: now,
          acceptedAt: now,
          updatedAt: now,
        },
        { merge: true }
      ).catch(e => { if (__DEV__) logger.debug('familyMembers reverse link write failed:', e); }),
    ]);

    logger.info(`✅ Family member saved: families/${familyId}/members/${memberUid}`);

    // AUTO-ADD TO FAMILY GROUP CHAT
    // When a member is added to the family, automatically add them to the family group chat.
    // This ensures all family members are in the group without manual intervention.
    try {
      const familyDoc = await getDoc(doc(db, 'families', familyId));
      const familyData = familyDoc.data();
      const familyGroupChatId = familyData?.familyGroupChatId;

      if (familyGroupChatId && typeof familyGroupChatId === 'string') {
        const { groupChatService } = await import('../GroupChatService');
        const memberDeviceId = member.deviceId || memberUid;
        await groupChatService.addMemberToGroup(
          familyGroupChatId,
          memberUid,
          member.name,
          memberDeviceId,
        );
        logger.info(`✅ Auto-added ${member.name} to family group chat ${familyGroupChatId}`);
      } else {
        // CRITICAL FIX: Auto-create family group chat if it doesn't exist.
        // This handles the case where createFamily() group creation failed.
        try {
          const { groupChatService } = await import('../GroupChatService');
          const { identityService } = await import('../IdentityService');
          const ownerDeviceId = identityService.getMeshDeviceId?.() || identityService.getMyId?.() || myUid;
          const ownerName = identityService.getDisplayName() || 'Aile Üyesi';
          const familyName = familyData?.name || 'Ailem';

          const newGroupId = await groupChatService.createGroup(
            familyName,
            [myUid, memberUid],
            { [myUid]: ownerName, [memberUid]: member.name },
            { [myUid]: ownerDeviceId, [memberUid]: member.deviceId || memberUid },
          );

          if (newGroupId) {
            await updateDoc(doc(db, 'families', familyId), {
              familyGroupChatId: newGroupId,
            }).catch(e => { if (__DEV__) logger.debug('familyGroupChatId write failed:', e); });
            logger.info(`✅ Auto-created missing family group chat: ${newGroupId} for family ${familyId}`);
          }
        } catch (createGroupError) {
          logger.warn('Auto-create family group chat on member add failed (non-blocking):', createGroupError);
        }
      }
    } catch (groupError) {
      // Non-blocking — member will see the group when FamilyGroupChatScreen reconciles
      logger.warn('Auto-add to family group chat failed (non-blocking):', groupError);
    }

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
    const membersQuery = query(membersRef, limit(100));

    const snapshot = await retryWithBackoff(
      () => withTimeout(() => getDocs(membersQuery), 'Aile üyelerini yükleme'),
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
        approvalState: data.approvalState === 'mutual' ? 'mutual' : 'pending',
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
    if (!familyId || !memberUid) {
      logger.warn('deleteFamilyMember: familyId or memberUid is missing');
      return false;
    }
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
    }).catch(e => { if (__DEV__) logger.debug('arrayRemove from family failed:', e); });

    // 3. Remove UID → familyId mapping
    await deleteDoc(
      doc(db, 'users', memberUid, 'familyIds', familyId)
    ).catch(e => { if (__DEV__) logger.debug('familyIds mapping delete failed:', e); });

    // 4. Remove bidirectional familyMembers mapping (best-effort)
    // Direct cleanup if we know who is removing whom
    if (myUid) {
      await deleteDoc(doc(db, 'users', myUid, 'familyMembers', memberUid)).catch(e => { if (__DEV__) logger.debug('familyMembers cleanup (my→member) failed:', e); });
      await deleteDoc(doc(db, 'users', memberUid, 'familyMembers', myUid)).catch(e => { if (__DEV__) logger.debug('familyMembers cleanup (member→my) failed:', e); });
    }
    // Also enumerate remaining family members for thorough cleanup — use writeBatch
    // to avoid N+1 sequential writes (2 deletes per remaining member).
    try {
      const membersSnap = await getDocs(query(collection(db, 'families', familyId, 'members'), limit(100)));
      const batch = writeBatch(db);
      let opCount = 0;
      for (const mDoc of membersSnap.docs) {
        const otherUid = mDoc.id;
        if (otherUid === memberUid) continue;
        batch.delete(doc(db, 'users', otherUid, 'familyMembers', memberUid));
        batch.delete(doc(db, 'users', memberUid, 'familyMembers', otherUid));
        opCount += 2;
      }
      if (opCount > 0) {
        await batch.commit().catch(e => { if (__DEV__) logger.debug('familyMembers batch cleanup failed:', e); });
      }
    } catch { /* best-effort cleanup */ }

    // 5. Remove from family group chat (best-effort)
    // Without this, removed members still see messages in the family group chat
    // and other members still see the removed member in the group.
    try {
      const familyDoc = await getDoc(doc(db, 'families', familyId));
      const familyData = familyDoc.data();
      const familyGroupChatId = familyData?.familyGroupChatId;
      if (familyGroupChatId && typeof familyGroupChatId === 'string') {
        const { groupChatService } = await import('../GroupChatService');
        // Resolve member name from the member doc we just deleted (use best-effort lookup)
        const memberName = 'Aile Üyesi'; // Name was already deleted; use generic label
        await groupChatService.removeMemberFromGroup(familyGroupChatId, memberUid, memberName);
        logger.info(`✅ Removed ${memberUid} from family group chat ${familyGroupChatId}`);
      }
    } catch (groupError) {
      // Non-blocking — group chat cleanup is best-effort
      logger.debug('Family group chat removal failed (non-blocking):', groupError);
    }

    logger.info(`✅ Member ${memberUid} deleted from families/${familyId}`);
    return true;
  } catch (error: unknown) {
    return handleFirestoreError(error, 'deleteFamilyMember');
  }
}

/**
 * Subscribe to real-time family member updates.
 * Path: families/{familyId}/members/
 * Uses retry-with-backoff for transient errors.
 */
export async function subscribeToFamilyMembers(
  familyId: string,
  callback: (members: FamilyMember[]) => void,
  onError?: (error: any) => void,
): Promise<() => void> {
  let isDisposed = false;
  let currentUnsub: (() => void) | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  // CRITICAL FIX: Was 5 — subscription died permanently after 5 errors (network blips,
  // auth token refresh). Now 20 with longer backoff so even sustained outages recover.
  const MAX_RETRIES = 20;

  const cleanup = () => {
    isDisposed = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } currentUnsub = null; }
  };

  const startSnapshot = async (): Promise<boolean> => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db || isDisposed) return false;

      const membersRef = collection(db, 'families', familyId, 'members');

      const unsubscribe = onSnapshot(
        membersRef,
        (snapshot) => {
          if (isDisposed) return;
          retryCount = 0; // Reset on successful snapshot
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
                approvalState: data.approvalState === 'mutual' ? 'mutual' : 'pending',
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
          if (isDisposed) return;
          currentUnsub = null;
          const code = error?.code || '';
          if (code === 'permission-denied' || code === 'unauthenticated') {
            // Only treat as permanent if we're actually authenticated
            // During cold start, auth may not be ready yet → retry instead of giving up
            let isAuthenticated = false;
            try {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const { getFirebaseAuth } = require('../../../lib/firebase');
              isAuthenticated = !!getFirebaseAuth()?.currentUser;
            } catch { /* auth check failed, treat as transient */ }
            if (isAuthenticated) {
              logger.error(`subscribeToFamilyMembers: permanent error (${code}) for ${familyId} (user authenticated)`);
              onError?.(error);
              return;
            }
            logger.warn(`subscribeToFamilyMembers: auth error (${code}) for ${familyId} but user not authenticated yet, retrying...`);
            onError?.(error);
            scheduleRetry();
            return;
          }
          logger.warn(`subscribeToFamilyMembers: transient error for ${familyId}, scheduling retry`, error);
          onError?.(error);
          scheduleRetry();
        },
      );

      if (isDisposed) {
        try { unsubscribe(); } catch { /* no-op */ }
        return false;
      }

      if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } }
      currentUnsub = unsubscribe;
      logger.info(`✅ Subscribed to family members: families/${familyId}`);
      return true;
    } catch (error: unknown) {
      if (isDisposed) return false;
      const code = getErrorCode(error);
      if (code === 'permission-denied') {
        logger.debug(`Family subscription for ${familyId}: permission denied`);
        return false;
      }
      logger.warn('subscribeToFamilyMembers startSnapshot error:', error);
      onError?.(error);
      return false;
    }
  };

  const scheduleRetry = () => {
    if (isDisposed || retryCount >= MAX_RETRIES) {
      if (retryCount >= MAX_RETRIES) {
        logger.error(`subscribeToFamilyMembers: exhausted ${MAX_RETRIES} retries for ${familyId}`);
      }
      return;
    }
    retryCount++;
    const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 60000);
    logger.info(`subscribeToFamilyMembers: retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (!isDisposed) {
        await startSnapshot();
      }
    }, delay);
  };

  const success = await startSnapshot();
  if (!success && !isDisposed) {
    scheduleRetry();
  }

  return cleanup;
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
    const seenMemberUids = new Set<string>();

    for (const linkDoc of linksSnap.docs) {
      const data = linkDoc.data();
      if (!isMutualFamilyLinkData(data)) continue;

      const otherUid = linkDoc.id;
      if (!otherUid || otherUid === myUid || seenMemberUids.has(otherUid)) continue;

      const familyId = data.familyId;
      if (!familyId || typeof familyId !== 'string') continue;
      seenMemberUids.add(otherUid);

      const ownerUid = typeof data.requestedBy === 'string'
        ? data.requestedBy
        : (typeof data.adderUid === 'string' ? data.adderUid : otherUid);

      // Keep remote family mapping as relationship metadata only.
      // getOrCreateDefaultFamily() intentionally ignores role='member' mappings.
      try {
        await setDoc(
          doc(db, 'users', myUid, 'familyIds', familyId),
          { active: true, joinedAt: now, ownerUid, role: 'member' },
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

      const displayName = typeof data.adderName === 'string'
        ? data.adderName
        : (typeof data.name === 'string' ? data.name : 'Aile Üyesi');

      allMembers.push({
        id: otherUid,
        uid: otherUid,
        familyId,
        name: displayName,
        status: 'unknown',
        approvalState: 'mutual',
        lastSeen: 0,
        latitude: 0,
        longitude: 0,
        createdAt: normalizeTimestampMs(data.addedAt ?? data.acceptedAt, now),
        updatedAt: now,
      } as FamilyMember);
    }

    if (allMembers.length > 0) {
      logger.info(`✅ Synced ${allMembers.length} accepted remote family links`);
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
 * Uses retry-with-backoff for transient errors.
 */
export async function subscribeToFamilyMemberLinks(
  myUid: string,
  myDisplayName: string,
  onNewMember: (member: FamilyMember, familyId: string) => void,
): Promise<() => void> {
  let isDisposed = false;
  let currentUnsub: (() => void) | null = null;
  let retryCount = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  // CRITICAL FIX: Was 5 — subscription died permanently after 5 errors. Now 20.
  const MAX_RETRIES = 20;
  const knownLinks = new Set<string>();
  let isFirstSnapshot = true;

  const cleanup = () => {
    isDisposed = true;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } currentUnsub = null; }
  };

  const startSnapshot = async (): Promise<boolean> => {
    try {
      const db = await getFirestoreInstanceAsync();
      if (!db || isDisposed) return false;

      const linksRef = collection(db, 'users', myUid, 'familyMembers');

      const unsubscribe = onSnapshot(
        linksRef,
        async (snapshot) => {
          if (isDisposed) return;
          retryCount = 0; // Reset on successful snapshot
          try {
            const now = Date.now();

            for (const change of snapshot.docChanges()) {
              const otherUid = change.doc.id;
              if (otherUid === myUid) continue;

              const data = change.doc.data();
              if (change.type === 'removed') {
                knownLinks.delete(otherUid);
                continue;
              }
              if (change.type !== 'added' && change.type !== 'modified') continue;

              if (!isMutualFamilyLinkData(data)) continue;
              if (knownLinks.has(otherUid)) continue;

              // Skip processing accepted links on first snapshot (handled by syncRemoteFamilyAdditions)
              if (isFirstSnapshot) {
                knownLinks.add(otherUid);
                continue;
              }

              knownLinks.add(otherUid);
              const familyId = data.familyId;
              if (!familyId || typeof familyId !== 'string') continue;

              logger.info(`Remote family addition detected: ${otherUid} added me to family ${familyId}`);

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
                approvalState: 'mutual',
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
          if (isDisposed) return;
          currentUnsub = null;
          const code = error?.code || '';
          if (code === 'permission-denied' || code === 'unauthenticated') {
            logger.error(`subscribeToFamilyMemberLinks: permanent error (${code}) for ${myUid}`);
            return;
          }
          logger.warn(`subscribeToFamilyMemberLinks: transient error for ${myUid}, scheduling retry`, error);
          scheduleRetry();
        },
      );

      if (isDisposed) {
        try { unsubscribe(); } catch { /* no-op */ }
        return false;
      }

      if (currentUnsub) { try { currentUnsub(); } catch { /* no-op */ } }
      currentUnsub = unsubscribe;
      logger.info(`✅ Subscribed to family member links: users/${myUid}/familyMembers`);
      return true;
    } catch (error: unknown) {
      if (isDisposed) return false;
      const code = getErrorCode(error);
      if (code === 'permission-denied') {
        logger.debug('familyMemberLinks subscription: permission denied');
        return false;
      }
      logger.warn('subscribeToFamilyMemberLinks startSnapshot error:', error);
      return false;
    }
  };

  const scheduleRetry = () => {
    if (isDisposed || retryCount >= MAX_RETRIES) {
      if (retryCount >= MAX_RETRIES) {
        logger.error(`subscribeToFamilyMemberLinks: exhausted ${MAX_RETRIES} retries for ${myUid}`);
      }
      return;
    }
    retryCount++;
    const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 60000);
    logger.info(`subscribeToFamilyMemberLinks: retry ${retryCount}/${MAX_RETRIES} in ${delay}ms`);
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      if (!isDisposed) {
        await startSnapshot();
      }
    }, delay);
  };

  const success = await startSnapshot();
  if (!success && !isDisposed) {
    scheduleRetry();
  }

  return cleanup;
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
