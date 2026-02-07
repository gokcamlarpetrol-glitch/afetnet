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
    getFirestore,
    collection,
    doc,
    setDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { initializeFirebase } from '../../lib/firebase';
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
    createdAt: number;
    updatedAt: number;
    message?: string;
}

// Request listener callback
export type RequestCallback = (requests: ContactRequest[]) => void;

class ContactRequestService {
    private isInitialized = false;
    private unsubscribe: (() => void) | null = null;
    private listeners: RequestCallback[] = [];
    private pendingRequests: ContactRequest[] = [];

    /**
     * Initialize the service
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            await identityService.initialize();
            const cloudUid = identityService.getCloudUid();

            if (!cloudUid) {
                logger.warn('Cannot init: not authenticated');
                return;
            }

            // Subscribe to incoming requests
            await this.subscribeToIncomingRequests();

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
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) return;

        try {
            const app = initializeFirebase();
            if (!app) return;

            const db = getFirestore(app);
            const requestsRef = collection(db, 'users', cloudUid, 'contactRequests');
            const q = query(
                requestsRef,
                where('status', '==', 'pending'),
                orderBy('createdAt', 'desc')
            );

            this.unsubscribe = onSnapshot(q, (snapshot) => {
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
                        createdAt: data.createdAt?.toMillis?.() || data.createdAt,
                        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
                        message: data.message,
                    } as ContactRequest;
                });

                // Notify all listeners
                this.listeners.forEach(cb => cb(this.pendingRequests));

                if (this.pendingRequests.length > 0) {
                    logger.info(`📬 ${this.pendingRequests.length} pending contact requests`);
                }
            });

        } catch (error) {
            logger.error('Failed to subscribe to requests:', error);
        }
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
        const myQrId = identityService.getMyId();
        const myName = identityService.getDisplayName();
        const myPhoto = identityService.getPhotoURL();

        if (!cloudUid) {
            logger.warn('Cannot send request: not authenticated');
            return false;
        }

        try {
            const app = initializeFirebase();
            if (!app) return false;

            const db = getFirestore(app);

            // Create request in recipient's collection
            const requestRef = doc(db, 'users', toUserId, 'contactRequests', cloudUid);

            await setDoc(requestRef, {
                fromUserId: cloudUid,
                fromQrId: myQrId,
                fromName: myName,
                fromPhotoURL: myPhoto || null,
                toUserId,
                status: 'pending',
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
            const app = initializeFirebase();
            if (!app) return false;

            const db = getFirestore(app);

            // 1. Update request status
            const requestRef = doc(db, 'users', cloudUid, 'contactRequests', request.fromUserId);
            await setDoc(requestRef, {
                status: 'accepted',
                updatedAt: serverTimestamp(),
            }, { merge: true });

            // 2. Add sender as my contact (if not already)
            const existingContact = contactService.getContact(request.fromQrId);
            if (!existingContact) {
                await contactService.addContact(
                    request.fromQrId,
                    request.fromUserId,
                    request.fromName,
                    {
                        addedVia: 'invite',
                        isVerified: true,
                        photoURL: request.fromPhotoURL,
                    }
                );
            }

            // 3. Update mutual status on both sides
            await this.updateMutualStatus(request.fromUserId, request.fromQrId, true);

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
            const app = initializeFirebase();
            if (!app) return false;

            const db = getFirestore(app);
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
    private async updateMutualStatus(otherUserId: string, otherQrId: string, isMutual: boolean): Promise<void> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) return;

        try {
            const app = initializeFirebase();
            if (!app) return;

            const db = getFirestore(app);
            if (!otherQrId) {
                logger.warn(`Missing fromQrId for user ${otherUserId}, skipping mutual status update`);
                return;
            }

            // Update my contact
            const myContactRef = doc(db, 'users', cloudUid, 'contacts', otherQrId);
            await setDoc(myContactRef, { isMutual, updatedAt: serverTimestamp() }, { merge: true });

        } catch (error) {
            logger.error('Failed to update mutual status:', error);
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
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }

        this.listeners = [];
        this.pendingRequests = [];
        this.isInitialized = false;

        logger.info('🗑️ ContactRequestService cleaned up');
    }
}

export const contactRequestService = new ContactRequestService();
