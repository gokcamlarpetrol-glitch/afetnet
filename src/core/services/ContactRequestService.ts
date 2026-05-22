/**
 * CONTACT REQUEST SERVICE - Elite Firebase Edition
 * Handles mutual contact requests and notifications
 * 
 * Features:
 * - Send contact request when adding someone
 * - Receive notifications for incoming requests
 * - Accept/Decline contact requests
 * - Automatic mutual status update
 * 
 * @author AfetNet Elite Messaging System
 * @version 1.0.0
 */

import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    arrayUnion,
    writeBatch
} from 'firebase/firestore';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';
import { identityService } from './IdentityService';
import { contactService } from './ContactService';
import { createLogger } from '../utils/logger';

const logger = createLogger('ContactRequestService');

// Contact request status
export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'expired';

// Contact request interface
export interface ContactRequest {
    id: string;
    fromUserId: string;
    fromQrId: string;
    fromName: string;
    fromPhotoURL?: string;
    toUserId: string;
    status: RequestStatus;
    familyId?: string;
    createdAt: number;
    updatedAt: number;
    message?: string;
}

// Request listener callback
export type RequestCallback = (requests: ContactRequest[]) => void;

class ContactRequestService {
    private isInitialized = false;
    private activeUid: string | null = null;
    private unsubscribe: (() => void) | null = null;
    private listeners: RequestCallback[] = [];
    private pendingRequests: ContactRequest[] = [];
    private retryTimer: ReturnType<typeof setTimeout> | null = null;
    private retryCount = 0;
    // CRITICAL FIX: Increased from 5 to 20 to match other Firestore onSnapshot retry patterns.
    // 5 retries with exponential backoff dies within minutes of network blips;
    // contact request subscription stays dead for the rest of the session.
    private static readonly MAX_RETRIES = 20;

    /**
     * Initialize the service
     */
    async initialize(): Promise<void> {
        try {
            await identityService.initialize();
            const cloudUid = identityService.getCloudUid();

            if (!cloudUid) {
                logger.warn('Cannot init: not authenticated');
                return;
            }

            if (this.isInitialized && this.activeUid === cloudUid) {
                return;
            }

            if (this.isInitialized && this.activeUid && this.activeUid !== cloudUid) {
                await this.cleanup();
            }

            // Subscribe to incoming requests
            await this.subscribeToIncomingRequests();

            this.activeUid = cloudUid;
            this.isInitialized = true;
            logger.info('✅ ContactRequestService initialized');

        } catch (error) {
            logger.error('Failed to initialize:', error);
        }
    }

    /**
     * Subscribe to incoming contact requests
     */
    private async subscribeToIncomingRequests(): Promise<void> {
        // ELITE: Unsubscribe existing listener before creating new one
        // Prevents duplicate subscriptions if initialize() called twice
        if (this.unsubscribe) {
            try { this.unsubscribe(); } catch { /* no-op */ }
            this.unsubscribe = null;
        }

        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) return;

        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) return;
            const requestsRef = collection(db, 'users', cloudUid, 'contactRequests');
            const q = query(
                requestsRef,
                where('status', '==', 'pending'),
                orderBy('createdAt', 'desc')
            );

            this.unsubscribe = onSnapshot(q, (snapshot) => {
                this.retryCount = 0; // Subscription alive — reset retry counter
                this.pendingRequests = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        fromUserId: data.fromUserId,
                        fromQrId: data.fromQrId,
                        fromName: data.fromName,
                        fromPhotoURL: data.fromPhotoURL,
                        toUserId: data.toUserId || cloudUid,
                        status: data.status,
                        familyId: typeof data.familyId === 'string' ? data.familyId : undefined,
                        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
                        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
                        message: data.message,
                    } as ContactRequest;
                });

                // Notify all listeners
                // CRITICAL FIX: Spread to array before iterating — a listener callback may
                // call addListener() or unsubscribe, modifying this.listeners mid-iteration.
                [...this.listeners].forEach(cb => cb(this.pendingRequests));

                if (this.pendingRequests.length > 0) {
                    logger.info(`📬 ${this.pendingRequests.length} pending contact requests`);
                }
            }, (error) => {
                logger.warn('Contact requests listener error:', error);
                // CRITICAL FIX: Retry on subscription death (matches SOSAlertListener pattern)
                this.unsubscribe = null;
                this.scheduleRetry();
            });

        } catch (error) {
            logger.error('Failed to subscribe to requests:', error);
        }
    }

    /**
     * Schedule retry for dead subscription with exponential backoff
     */
    private scheduleRetry(): void {
        if (this.retryCount >= ContactRequestService.MAX_RETRIES) {
            logger.error(`ContactRequestService: exhausted ${ContactRequestService.MAX_RETRIES} retries`);
            return;
        }
        if (this.retryTimer) { clearTimeout(this.retryTimer); }
        this.retryCount++;
        const delay = Math.min(3000 * Math.pow(2, this.retryCount - 1), 60000);
        logger.info(`ContactRequestService: retry ${this.retryCount}/${ContactRequestService.MAX_RETRIES} in ${delay}ms`);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = null;
            if (!this.unsubscribe) {
                this.subscribeToIncomingRequests().catch(e => logger.error('Retry failed:', e));
            }
        }, delay);
    }

    /**
     * Send a contact request when adding someone
     */
    async sendContactRequest(
        toUserId: string,
        toQrId: string,
        message?: string
    ): Promise<boolean> {
        const cloudUid = identityService.getCloudUid();
        const myQrId = identityService.getUid() || identityService.getMyId();
        const myName = identityService.getDisplayName();
        const myPhoto = identityService.getPhotoURL();

        if (!cloudUid) {
            logger.warn('Cannot send request: not authenticated');
            return false;
        }

        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) return false;

            let familyId: string | null = null;
            try {
                const linkDoc = await getDoc(doc(db, 'users', cloudUid, 'familyMembers', toUserId));
                const linkData = linkDoc.exists() ? linkDoc.data() : null;
                familyId = typeof linkData?.familyId === 'string' ? linkData.familyId : null;
            } catch {
                // Non-blocking: the invite still works, but acceptance cannot unlock live data
                // until the family link is synced with a familyId.
            }

            // Create request in recipient's collection
            const requestRef = doc(db, 'users', toUserId, 'contactRequests', cloudUid);

            // Duplicate prevention: do not recreate already pending/accepted requests.
            const existingRequest = await getDoc(requestRef);
            if (existingRequest.exists()) {
                const existingStatus = existingRequest.data()?.status;
                if (existingStatus === 'pending' || existingStatus === 'accepted') {
                    logger.info(`Contact request skipped: already ${existingStatus} for ${toUserId}`);
                    return true;
                }
            }

            await setDoc(requestRef, {
                fromUserId: cloudUid,
                fromQrId: myQrId,
                fromName: myName,
                fromPhotoURL: myPhoto || null,
                toUserId,
                status: 'pending',
                familyId,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                message: message || null,
            });

            logger.info(`📤 Contact request sent to ${toQrId}`);
            return true;

        } catch (error) {
            logger.error('Failed to send contact request:', error);
            return false;
        }
    }

    /**
     * Accept a contact request
     */
    async acceptRequest(request: ContactRequest): Promise<boolean> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) return false;

        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) return false;

            // 1. Update request status
            const requestRef = doc(db, 'users', cloudUid, 'contactRequests', request.fromUserId);
            await setDoc(requestRef, {
                status: 'accepted',
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // 2. Finalize the mutual/family boundary before adding local contact state.
            const mutualStatusUpdated = await this.updateMutualStatus(request, true);
            if (!mutualStatusUpdated) {
                await setDoc(requestRef, {
                    status: 'expired',
                    updatedAt: serverTimestamp(),
                }, { merge: true }).catch((rollbackError) => {
                    logger.error('Failed to roll back accepted request after family approval failure:', rollbackError);
                });
                return false;
            }

            // 3. Add sender as my contact (if not already)
            const existingContact = contactService.getContact(request.fromUserId);
            if (!existingContact) {
                await contactService.addContact(
                    request.fromUserId,
                    request.fromName,
                    {
                        addedVia: 'invite',
                        isVerified: true,
                        photoURL: request.fromPhotoURL,
                        sendContactRequest: false,
                    }
                );
            }
            await this.refreshFamilyStoreAfterApproval();

            // 4. Create a notification for the sender
            const notifyRef = doc(db, 'users', request.fromUserId, 'notifications', `accept_${cloudUid}`);
            await setDoc(notifyRef, {
                type: 'contact_accepted',
                fromUserId: cloudUid,
                fromName: identityService.getDisplayName(),
                createdAt: serverTimestamp(),
                read: false,
            });

            logger.info(`✅ Accepted contact request from ${request.fromName}`);
            return true;

        } catch (error) {
            logger.error('Failed to accept request:', error);
            return false;
        }
    }

    /**
     * Decline a contact request
     */
    async declineRequest(request: ContactRequest): Promise<boolean> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) return false;

        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) return false;

            const requestRef = doc(db, 'users', cloudUid, 'contactRequests', request.fromUserId);

            await setDoc(requestRef, {
                status: 'declined',
                updatedAt: serverTimestamp(),
            }, { merge: true });

            logger.info(`❌ Declined contact request from ${request.fromName}`);
            return true;

        } catch (error) {
            logger.error('Failed to decline request:', error);
            return false;
        }
    }

    /**
     * Update mutual contact status
     */
    private async updateMutualStatus(request: ContactRequest, isMutual: boolean): Promise<boolean> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) return false;

        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) return false;

            if (isMutual) {
                const finalized = await this.finalizeFamilyApproval(request);
                if (!finalized) return false;
            }

            // Update my contact only after the family approval boundary is finalized.
            const myContactRef = doc(db, 'users', cloudUid, 'contacts', request.fromUserId);
            await setDoc(myContactRef, { isMutual, updatedAt: serverTimestamp() }, { merge: true });

            return true;
        } catch (error) {
            logger.error('Failed to update mutual status:', error);
            return false;
        }
    }

    /**
     * Convert a pending family invitation into a mutual link.
     * This is the consent boundary that unlocks live location/status reads in Firestore rules.
     */
    private async finalizeFamilyApproval(request: ContactRequest): Promise<boolean> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) return false;

        const db = await getFirestoreInstanceAsync();
        if (!db) return false;

        const incomingLinkRef = doc(db, 'users', cloudUid, 'familyMembers', request.fromUserId);
        const incomingLinkDoc = await getDoc(incomingLinkRef);
        const incomingLink = incomingLinkDoc.exists() ? incomingLinkDoc.data() : null;
        const familyId = request.familyId || (typeof incomingLink?.familyId === 'string' ? incomingLink.familyId : undefined);

        if (!familyId) {
            if (incomingLinkDoc.exists() || request.familyId) {
                logger.error(`Accepted family request from ${request.fromUserId}, but no familyId was available; approval cannot be finalized`);
                return false;
            }
            return true;
        }

        const myName = identityService.getDisplayName() || 'Aile Üyesi';
        const acceptedPayload = {
            familyId,
            approvalState: 'mutual',
            relationshipStatus: 'accepted',
            acceptedBy: cloudUid,
            acceptedByName: myName,
            acceptedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const batch = writeBatch(db);
        batch.set(incomingLinkRef, {
            ...acceptedPayload,
            adderUid: request.fromUserId,
            adderName: request.fromName,
            name: request.fromName,
        }, { merge: true });
        batch.set(doc(db, 'users', request.fromUserId, 'familyMembers', cloudUid), {
            ...acceptedPayload,
            name: myName,
        }, { merge: true });
        batch.set(doc(db, 'users', cloudUid, 'familyIds', familyId), {
            active: true,
            ownerUid: request.fromUserId,
            role: 'member',
            joinedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });
        batch.set(doc(db, 'families', familyId, 'members', cloudUid), {
            uid: cloudUid,
            id: cloudUid,
            name: myName,
            status: 'unknown',
            approvalState: 'mutual',
            joinedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastSeen: 0,
            latitude: 0,
            longitude: 0,
            location: null,
        }, { merge: true });
        await batch.commit();

        const familyRef = doc(db, 'families', familyId);
        await updateDoc(familyRef, {
            members: arrayUnion(cloudUid),
            updatedAt: serverTimestamp(),
        }).catch(error => {
            logger.debug('Family members array update after approval skipped:', error);
        });

        try {
            const familyDoc = await getDoc(familyRef);
            const familyGroupChatId = familyDoc.data()?.familyGroupChatId;
            if (typeof familyGroupChatId === 'string' && familyGroupChatId.length > 0) {
                const { groupChatService } = await import('./GroupChatService');
                const deviceId = identityService.getMeshDeviceId?.() || identityService.getMyId?.() || cloudUid;
                await groupChatService.addMemberToGroup(familyGroupChatId, cloudUid, myName, deviceId);
            }
        } catch (error) {
            logger.debug('Family group chat join after approval skipped:', error);
        }

        return true;
    }

    private async refreshFamilyStoreAfterApproval(): Promise<void> {
        try {
            const { useFamilyStore } = await import('../stores/familyStore');
            await useFamilyStore.getState().initialize(true);
        } catch (error) {
            logger.debug('Family store refresh after approval skipped:', error);
        }
    }

    /**
     * Add listener for incoming requests
     */
    addListener(callback: RequestCallback): () => void {
        this.listeners.push(callback);

        // Immediately call with current requests
        callback(this.pendingRequests);

        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    /**
     * Get pending requests count
     */
    getPendingCount(): number {
        return this.pendingRequests.length;
    }

    /**
     * Get all pending requests
     */
    getPendingRequests(): ContactRequest[] {
        return [...this.pendingRequests];
    }

    /**
     * Cleanup on logout
     */
    async cleanup(): Promise<void> {
        if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
        this.retryCount = 0;

        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.listeners = [];
        this.pendingRequests = [];
        this.isInitialized = false;
        this.activeUid = null;

        logger.info('🗑️ ContactRequestService cleaned up');
    }
}

export const contactRequestService = new ContactRequestService();
