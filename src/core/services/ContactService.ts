/**
 * CONTACT SERVICE - ELITE FIREBASE EDITION
 * Complete contact management with Firebase Firestore sync
 * 
 * Features:
 * - Add/Remove/Edit contacts with Firebase persistence
 * - QR code based contact adding
 * - Favorite contacts with cloud sync
 * - Block list management
 * - Offline-first with automatic sync
 * - Conflict resolution via timestamps
 * 
 * @author AfetNet Elite Messaging System
 * @version 2.0.0 - Firebase Integration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { initializeFirebase } from '../../lib/firebase';
import { createLogger } from '../utils/logger';
import { identityService, QRPayload } from './IdentityService';

const logger = createLogger('ContactService');

// Lazy import to avoid circular dependency
let contactRequestService: any = null;
const getContactRequestService = async () => {
    if (!contactRequestService) {
        const module = await import('./ContactRequestService');
        contactRequestService = module.contactRequestService;
    }
    return contactRequestService;
};

// Storage keys for offline-first
const CONTACTS_CACHE_KEY = '@afetnet:contacts_cache_v2';
const BLOCKED_CACHE_KEY = '@afetnet:blocked_cache_v2';
const PENDING_SYNC_KEY = '@afetnet:contacts_pending_sync';

/**
 * Contact Interface - The Contact Record
 */
export interface Contact {
    id: string;                    // QR ID (AFN-XXXXXXXX)
    cloudUid: string;              // Firebase UID (required for Firebase sync)
    deviceId: string;              // Physical device ID for mesh routing
    displayName: string;           // Contact name
    nickname?: string;             // User-assigned nickname
    email?: string;                // Contact email
    photoURL?: string;             // Avatar URL
    status?: string;               // Status message
    lastSeen?: number;             // Last seen timestamp
    addedAt: number;               // When contact was added
    updatedAt: number;             // Last update timestamp
    addedVia: 'qr' | 'id' | 'ble' | 'invite' | 'sync';
    isFavorite: boolean;           // Favorite/starred status
    isVerified: boolean;           // ID verified via QR or mutual add
    publicKey?: string;            // Public encryption key
    notes?: string;                // User notes about contact
    tags?: string[];               // Custom tags
    isMutual?: boolean;            // Both users added each other
}

/**
 * Blocked Contact Interface
 */
export interface BlockedContact {
    id: string;
    cloudUid: string;
    displayName: string;
    blockedAt: number;
    reason?: string;
}

/**
 * Pending Sync Operation
 */
interface PendingSync {
    operation: 'add' | 'update' | 'delete' | 'block' | 'unblock';
    contactId: string;
    data?: Partial<Contact> | BlockedContact;
    timestamp: number;
}

class ContactService {
    private contacts: Map<string, Contact> = new Map();
    private blockedContacts: Map<string, BlockedContact> = new Map();
    private pendingSync: PendingSync[] = [];
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize the contact service
     */
    async initialize(): Promise<void> {
        if (this.initPromise) return this.initPromise;
        if (this.isInitialized) return;

        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    private async _doInitialize(): Promise<void> {
        try {
            logger.info('📇 Initializing ContactService...');

            // Initialize identity first
            await identityService.initialize();

            // Load from local cache first (offline-first)
            await this.loadFromCache();

            // If user is authenticated, sync from Firebase
            if (identityService.isCloudAuthenticated()) {
                await this.syncFromFirebase();
                await this.processPendingSync();
            }

            this.isInitialized = true;
            logger.info(`✅ ContactService initialized with ${this.contacts.size} contacts`);

        } catch (error) {
            logger.error('❌ Failed to initialize ContactService:', error);
            this.isInitialized = true;
        } finally {
            this.initPromise = null;
        }
    }

    // ==================== CACHE OPERATIONS ====================

    /**
     * Load contacts from local cache
     */
    private async loadFromCache(): Promise<void> {
        try {
            // Load contacts
            const contactsData = await AsyncStorage.getItem(CONTACTS_CACHE_KEY);
            if (contactsData) {
                const parsed = JSON.parse(contactsData) as Contact[];
                parsed.forEach(c => this.contacts.set(c.id, c));
                logger.info(`📂 Loaded ${this.contacts.size} contacts from cache`);
            }

            // Load blocked list
            const blockedData = await AsyncStorage.getItem(BLOCKED_CACHE_KEY);
            if (blockedData) {
                const parsed = JSON.parse(blockedData) as BlockedContact[];
                parsed.forEach(b => this.blockedContacts.set(b.id, b));
            }

            // Load pending sync operations
            const pendingData = await AsyncStorage.getItem(PENDING_SYNC_KEY);
            if (pendingData) {
                this.pendingSync = JSON.parse(pendingData);
                logger.info(`📤 ${this.pendingSync.length} pending sync operations`);
            }

        } catch (error) {
            logger.error('Failed to load from cache:', error);
        }
    }

    /**
     * Save contacts to local cache
     */
    private async saveToCache(): Promise<void> {
        try {
            await AsyncStorage.setItem(
                CONTACTS_CACHE_KEY,
                JSON.stringify(Array.from(this.contacts.values()))
            );
            await AsyncStorage.setItem(
                BLOCKED_CACHE_KEY,
                JSON.stringify(Array.from(this.blockedContacts.values()))
            );
        } catch (error) {
            logger.error('Failed to save to cache:', error);
        }
    }

    /**
     * Save pending sync operations
     */
    private async savePendingSync(): Promise<void> {
        try {
            await AsyncStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(this.pendingSync));
        } catch (error) {
            logger.error('Failed to save pending sync:', error);
        }
    }

    // ==================== FIREBASE SYNC ====================

    /**
     * Sync contacts from Firebase
     */
    async syncFromFirebase(): Promise<void> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) {
            logger.warn('Cannot sync: not authenticated');
            return;
        }

        try {
            const app = initializeFirebase();
            if (!app) return;

            const db = getFirestore(app);

            // Get contacts collection
            const contactsRef = collection(db, 'users', cloudUid, 'contacts');
            const contactsQuery = query(contactsRef, orderBy('addedAt', 'desc'));
            const contactsSnap = await getDocs(contactsQuery);

            contactsSnap.forEach(docSnap => {
                const data = docSnap.data();
                const contact: Contact = {
                    id: data.id || docSnap.id,
                    cloudUid: data.cloudUid,
                    deviceId: data.deviceId,
                    displayName: data.displayName,
                    nickname: data.nickname,
                    email: data.email,
                    photoURL: data.photoURL,
                    status: data.status,
                    lastSeen: data.lastSeen,
                    addedAt: data.addedAt?.toMillis?.() || data.addedAt,
                    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
                    addedVia: data.addedVia || 'sync',
                    isFavorite: data.isFavorite || false,
                    isVerified: data.isVerified || false,
                    publicKey: data.publicKey,
                    notes: data.notes,
                    tags: data.tags,
                    isMutual: data.isMutual,
                };

                // Conflict resolution: keep newer version
                const existing = this.contacts.get(contact.id);
                if (!existing || contact.updatedAt > existing.updatedAt) {
                    this.contacts.set(contact.id, contact);
                }
            });

            // Get blocked collection
            const blockedRef = collection(db, 'users', cloudUid, 'blocked');
            const blockedSnap = await getDocs(blockedRef);

            blockedSnap.forEach(docSnap => {
                const data = docSnap.data();
                this.blockedContacts.set(docSnap.id, {
                    id: docSnap.id,
                    cloudUid: data.cloudUid,
                    displayName: data.displayName,
                    blockedAt: data.blockedAt?.toMillis?.() || data.blockedAt,
                    reason: data.reason,
                });
            });

            await this.saveToCache();
            logger.info(`🔄 Synced ${this.contacts.size} contacts from Firebase`);

        } catch (error) {
            logger.error('Failed to sync from Firebase:', error);
        }
    }

    /**
     * Sync a single contact to Firebase
     */
    private async syncContactToFirebase(contact: Contact): Promise<void> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) {
            // Queue for later sync
            this.pendingSync.push({
                operation: 'add',
                contactId: contact.id,
                data: contact,
                timestamp: Date.now(),
            });
            await this.savePendingSync();
            return;
        }

        try {
            const app = initializeFirebase();
            if (!app) return;

            const db = getFirestore(app);
            const contactRef = doc(db, 'users', cloudUid, 'contacts', contact.id);

            await setDoc(contactRef, {
                ...contact,
                addedAt: Timestamp.fromMillis(contact.addedAt),
                updatedAt: Timestamp.fromMillis(contact.updatedAt),
                lastSeen: contact.lastSeen ? Timestamp.fromMillis(contact.lastSeen) : null,
            });

            logger.info(`☁️ Contact synced to Firebase: ${contact.displayName}`);

        } catch (error) {
            logger.error('Failed to sync contact to Firebase:', error);
            // Queue for retry
            this.pendingSync.push({
                operation: 'add',
                contactId: contact.id,
                data: contact,
                timestamp: Date.now(),
            });
            await this.savePendingSync();
        }
    }

    /**
     * Delete contact from Firebase
     */
    private async deleteContactFromFirebase(contactId: string): Promise<void> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) {
            this.pendingSync.push({
                operation: 'delete',
                contactId,
                timestamp: Date.now(),
            });
            await this.savePendingSync();
            return;
        }

        try {
            const app = initializeFirebase();
            if (!app) return;

            const db = getFirestore(app);
            await deleteDoc(doc(db, 'users', cloudUid, 'contacts', contactId));

            logger.info(`🗑️ Contact deleted from Firebase: ${contactId}`);

        } catch (error) {
            logger.error('Failed to delete contact from Firebase:', error);
        }
    }

    /**
     * Process pending sync operations
     */
    async processPendingSync(): Promise<void> {
        if (this.pendingSync.length === 0) return;
        if (!identityService.isCloudAuthenticated()) return;

        logger.info(`📤 Processing ${this.pendingSync.length} pending sync operations...`);

        const toProcess = [...this.pendingSync];
        this.pendingSync = [];

        for (const op of toProcess) {
            try {
                switch (op.operation) {
                    case 'add':
                    case 'update':
                        if (op.data) {
                            await this.syncContactToFirebase(op.data as Contact);
                        }
                        break;
                    case 'delete':
                        await this.deleteContactFromFirebase(op.contactId);
                        break;
                    case 'block':
                        await this.syncBlockedToFirebase(op.data as BlockedContact);
                        break;
                    case 'unblock':
                        await this.deleteBlockedFromFirebase(op.contactId);
                        break;
                }
            } catch (error) {
                logger.error(`Failed to process pending sync: ${op.operation}`, error);
                // Re-queue failed operation
                this.pendingSync.push(op);
            }
        }

        await this.savePendingSync();
    }

    // ==================== CONTACT OPERATIONS ====================

    /**
     * Add a new contact
     */
    async addContact(
        qrId: string,
        cloudUid: string,
        displayName: string,
        options: {
            deviceId?: string;
            addedVia?: Contact['addedVia'];
            publicKey?: string;
            isVerified?: boolean;
            photoURL?: string;
            email?: string;
            sendContactRequest?: boolean;
        } = {}
    ): Promise<Contact> {
        if (!this.isInitialized) await this.initialize();

        // Validate
        const myId = identityService.getMyId();
        if (qrId === myId) {
            throw new Error('Kendi kendinizi kişi olarak ekleyemezsiniz');
        }

        if (this.blockedContacts.has(qrId)) {
            throw new Error('Bu kişi engellendi. Önce engeli kaldırın.');
        }

        // Check if exists
        if (this.contacts.has(qrId)) {
            logger.info(`Contact ${qrId} exists, updating...`);
            return this.updateContact(qrId, { displayName, ...options });
        }

        const now = Date.now();
        const contact: Contact = {
            id: qrId,
            cloudUid: cloudUid,
            deviceId: options.deviceId || qrId,
            displayName,
            email: options.email,
            photoURL: options.photoURL,
            addedAt: now,
            updatedAt: now,
            addedVia: options.addedVia || 'id',
            isFavorite: false,
            isVerified: options.isVerified || false,
            publicKey: options.publicKey,
        };

        this.contacts.set(qrId, contact);
        await this.saveToCache();
        await this.syncContactToFirebase(contact);

        // ELITE: Send contact request notification if requested
        if (options.sendContactRequest && cloudUid) {
            try {
                const requestService = await getContactRequestService();
                await requestService.sendContactRequest(cloudUid, qrId);
                logger.info(`📬 Contact request sent to ${displayName}`);
            } catch (error) {
                logger.warn('Failed to send contact request:', error);
            }
        }

        logger.info(`✅ Added contact: ${displayName} (${qrId})`);
        return contact;
    }

    /**
     * Add contact from QR code scan
     */
    async addContactFromQR(qrData: string): Promise<Contact> {
        const payload = identityService.parseQRPayload(qrData);

        if (!payload || !payload.id) {
            throw new Error('Geçersiz QR kod');
        }

        // Fetch contact profile from Firebase for richer data
        let photoURL: string | undefined;
        let email: string | undefined;

        if (payload.uid) {
            try {
                const app = initializeFirebase();
                if (app) {
                    const db = getFirestore(app);
                    const userDoc = await getDoc(doc(db, 'users', payload.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        photoURL = userData.photoURL;
                        email = userData.email;
                    }
                }
            } catch (error) {
                logger.warn('Could not fetch contact profile:', error);
            }
        }

        return this.addContact(
            payload.id,
            payload.uid,
            payload.name || 'Bilinmeyen Kullanıcı',
            {
                deviceId: payload.did || payload.id,
                addedVia: 'qr',
                isVerified: true,
                photoURL,
                email,
                sendContactRequest: true, // Trigger contact request
            }
        );
    }

    /**
     * Update existing contact
     */
    async updateContact(
        id: string,
        updates: Partial<Omit<Contact, 'id' | 'addedAt' | 'cloudUid'>>
    ): Promise<Contact> {
        if (!this.isInitialized) await this.initialize();

        const existing = this.contacts.get(id);
        if (!existing) {
            throw new Error('Kişi bulunamadı');
        }

        const updated: Contact = {
            ...existing,
            ...updates,
            updatedAt: Date.now(),
        };

        this.contacts.set(id, updated);
        await this.saveToCache();
        await this.syncContactToFirebase(updated);

        logger.info(`✏️ Updated contact: ${id}`);
        return updated;
    }

    /**
     * Remove a contact
     */
    async removeContact(id: string): Promise<void> {
        if (!this.isInitialized) await this.initialize();

        if (!this.contacts.has(id)) {
            logger.warn(`Contact ${id} not found`);
            return;
        }

        this.contacts.delete(id);
        await this.saveToCache();
        await this.deleteContactFromFirebase(id);

        logger.info(`🗑️ Removed contact: ${id}`);
    }

    /**
     * Set contact as favorite
     */
    async setFavorite(id: string, isFavorite: boolean): Promise<void> {
        await this.updateContact(id, { isFavorite });
    }

    /**
     * Set nickname for contact
     */
    async setNickname(id: string, nickname: string): Promise<void> {
        await this.updateContact(id, { nickname });
    }

    /**
     * Update contact notes
     */
    async setNotes(id: string, notes: string): Promise<void> {
        await this.updateContact(id, { notes });
    }

    /**
     * Update last seen timestamp
     */
    updateLastSeen(id: string): void {
        const contact = this.contacts.get(id);
        if (contact) {
            contact.lastSeen = Date.now();
            contact.updatedAt = Date.now();
            this.saveToCache().catch(e => logger.error('Save lastSeen failed:', e));
            this.syncContactToFirebase(contact).catch(e => logger.warn('Sync lastSeen failed:', e));
        }
    }

    // ==================== BLOCK OPERATIONS ====================

    /**
     * Block a contact
     */
    async blockContact(id: string, reason?: string): Promise<void> {
        if (!this.isInitialized) await this.initialize();

        const contact = this.contacts.get(id);
        const displayName = contact?.displayName || 'Bilinmeyen';
        const cloudUid = contact?.cloudUid || id;

        // Remove from contacts
        if (contact) {
            this.contacts.delete(id);
            await this.deleteContactFromFirebase(id);
        }

        // Add to blocked list
        const blocked: BlockedContact = {
            id,
            cloudUid,
            displayName,
            blockedAt: Date.now(),
            reason,
        };

        this.blockedContacts.set(id, blocked);
        await this.saveToCache();
        await this.syncBlockedToFirebase(blocked);

        logger.info(`🚫 Blocked: ${id}`);
    }

    /**
     * Sync blocked contact to Firebase
     */
    private async syncBlockedToFirebase(blocked: BlockedContact): Promise<void> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) {
            this.pendingSync.push({
                operation: 'block',
                contactId: blocked.id,
                data: blocked,
                timestamp: Date.now(),
            });
            await this.savePendingSync();
            return;
        }

        try {
            const app = initializeFirebase();
            if (!app) return;

            const db = getFirestore(app);
            await setDoc(doc(db, 'users', cloudUid, 'blocked', blocked.id), {
                ...blocked,
                blockedAt: Timestamp.fromMillis(blocked.blockedAt),
            });

        } catch (error) {
            logger.error('Failed to sync blocked to Firebase:', error);
        }
    }

    /**
     * Delete blocked from Firebase
     */
    private async deleteBlockedFromFirebase(blockedId: string): Promise<void> {
        const cloudUid = identityService.getCloudUid();
        if (!cloudUid) return;

        try {
            const app = initializeFirebase();
            if (!app) return;

            const db = getFirestore(app);
            await deleteDoc(doc(db, 'users', cloudUid, 'blocked', blockedId));

        } catch (error) {
            logger.error('Failed to delete blocked from Firebase:', error);
        }
    }

    /**
     * Unblock a contact
     */
    async unblockContact(id: string): Promise<void> {
        if (!this.isInitialized) await this.initialize();

        if (!this.blockedContacts.has(id)) {
            logger.warn(`${id} not in blocked list`);
            return;
        }

        this.blockedContacts.delete(id);
        await this.saveToCache();
        await this.deleteBlockedFromFirebase(id);

        logger.info(`✅ Unblocked: ${id}`);
    }

    /**
     * Check if contact is blocked
     */
    isBlocked(id: string): boolean {
        return this.blockedContacts.has(id);
    }

    // ==================== GETTERS ====================

    getContact(id: string): Contact | undefined {
        return this.contacts.get(id);
    }

    getAllContacts(): Contact[] {
        return Array.from(this.contacts.values());
    }

    getFavorites(): Contact[] {
        return this.getAllContacts().filter(c => c.isFavorite);
    }

    getVerifiedContacts(): Contact[] {
        return this.getAllContacts().filter(c => c.isVerified);
    }

    getBlockedContacts(): BlockedContact[] {
        return Array.from(this.blockedContacts.values());
    }

    searchContacts(query: string): Contact[] {
        const lower = query.toLowerCase();
        return this.getAllContacts().filter(c =>
            c.displayName.toLowerCase().includes(lower) ||
            (c.nickname && c.nickname.toLowerCase().includes(lower)) ||
            (c.email && c.email.toLowerCase().includes(lower))
        );
    }

    getRecentContacts(limit = 10): Contact[] {
        return this.getAllContacts()
            .filter(c => c.lastSeen)
            .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
            .slice(0, limit);
    }

    getContactCount(): number {
        return this.contacts.size;
    }

    // ==================== UTILITY ====================

    /**
     * Get my QR code data
     */
    getMyQRData(): string {
        return identityService.getQRPayload();
    }

    /**
     * Force sync with Firebase
     */
    async forceSync(): Promise<void> {
        if (!identityService.isCloudAuthenticated()) {
            logger.warn('Cannot force sync: not authenticated');
            return;
        }

        await this.syncFromFirebase();
        await this.processPendingSync();
        logger.info('🔄 Force sync completed');
    }

    /**
     * Clear all contacts (for logout/reset)
     */
    async clearAll(): Promise<void> {
        this.contacts.clear();
        this.blockedContacts.clear();
        this.pendingSync = [];
        await this.saveToCache();
        await AsyncStorage.removeItem(PENDING_SYNC_KEY);
        logger.info('🗑️ Cleared all contacts');
    }

    /**
     * Get sync status
     */
    getSyncStatus(): { pending: number; lastSync: number | null } {
        return {
            pending: this.pendingSync.length,
            lastSync: null, // Could track this
        };
    }
}

// Export singleton
export const contactService = new ContactService();
export default contactService;
