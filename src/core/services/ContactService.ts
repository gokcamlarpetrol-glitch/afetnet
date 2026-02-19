/**
 * CONTACT SERVICE — SINGLE-UID ARCHITECTURE v4.0
 * 
 * Every contact is identified by Firebase Auth UID.
 * uid is the ONLY primary key — no id, cloudUid, or deviceId confusion.
 * 
 * Features:
 * - Add/Remove/Edit contacts with Firebase persistence
 * - QR code based contact adding (uid extraction)
 * - Favorite contacts with cloud sync
 * - Block list management
 * - Offline-first with automatic sync
 * 
 * @version 4.0.0 — Single-UID Clean Architecture
 */

import { DirectStorage } from '../utils/storage';
import { getAuth } from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import { initializeFirebase } from '../../lib/firebase';
import { createLogger } from '../utils/logger';
import { identityService, QRPayload } from './IdentityService';

const logger = createLogger('ContactService');
const UID_REGEX = /^[A-Za-z0-9]{20,40}$/;

// Lazy import to avoid circular dependency
let contactRequestService: any = null;
const getContactRequestService = async () => {
    if (!contactRequestService) {
        const module = await import('./ContactRequestService');
        contactRequestService = module.contactRequestService;
    }
    return contactRequestService;
};

// Storage keys (UID-scoped)
const CONTACTS_CACHE_KEY_BASE = '@afetnet:contacts_cache_v4';
const BLOCKED_CACHE_KEY_BASE = '@afetnet:blocked_cache_v4';
const PENDING_SYNC_KEY_BASE = '@afetnet:contacts_pending_sync_v4';
const STORAGE_GUEST_SCOPE = 'guest';
const STORAGE_USER_PREFIX = 'user:';

/**
 * Contact — Single-UID Model
 * uid is the ONLY identifier.
 */
export interface Contact {
    /** Firebase Auth UID — TEK BİRİNCİL ANAHTAR */
    uid: string;
    displayName: string;
    nickname?: string;
    email?: string;
    photoURL?: string;
    status?: string;
    lastSeen?: number;
    addedAt: number;
    updatedAt: number;
    addedVia: 'qr' | 'id' | 'ble' | 'invite' | 'sync';
    isFavorite: boolean;
    isVerified: boolean;
    notes?: string;
    tags?: string[];
    isMutual?: boolean;
}

/**
 * Blocked Contact
 */
export interface BlockedContact {
    uid: string;
    displayName: string;
    blockedAt: number;
    reason?: string;
}

/**
 * Pending Sync Operation
 */
interface PendingSync {
    operation: 'add' | 'update' | 'delete' | 'block' | 'unblock';
    contactUid: string;
    data?: Partial<Contact> | BlockedContact;
    timestamp: number;
}

class ContactService {
    private contacts: Map<string, Contact> = new Map();
    private blockedContacts: Map<string, BlockedContact> = new Map();
    private pendingSync: PendingSync[] = [];
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;
    private activeScope = STORAGE_GUEST_SCOPE;

    private getStorageScope(): string {
        const rawUid = identityService.getUid();
        const uid = rawUid ? rawUid.trim() : '';
        if (uid && uid.length > 0) return `${STORAGE_USER_PREFIX}${uid}`;

        try {
            const app = initializeFirebase();
            if (!app) return STORAGE_GUEST_SCOPE;
            const authUid = getAuth(app).currentUser?.uid?.trim();
            return authUid ? `${STORAGE_USER_PREFIX}${authUid}` : STORAGE_GUEST_SCOPE;
        } catch {
            return STORAGE_GUEST_SCOPE;
        }
    }

    private getScopedKey(base: string, scope: string = this.activeScope): string {
        return `${base}:${scope}`;
    }

    private getStorageKeys(scope: string = this.activeScope) {
        return {
            contacts: this.getScopedKey(CONTACTS_CACHE_KEY_BASE, scope),
            blocked: this.getScopedKey(BLOCKED_CACHE_KEY_BASE, scope),
            pending: this.getScopedKey(PENDING_SYNC_KEY_BASE, scope),
        };
    }

    private resetInMemoryState(): void {
        this.contacts.clear();
        this.blockedContacts.clear();
        this.pendingSync = [];
    }

    // ==================== INITIALIZATION ====================

    async initialize(): Promise<void> {
        // If already initialized and scope hasn't changed, return cached promise
        if (this.initPromise && this.isInitialized) {
            const nextScope = this.getStorageScope();
            if (nextScope === this.activeScope) return this.initPromise;
            // Scope changed — need re-init
            this.initPromise = null;
        }
        if (this.initPromise) return this.initPromise;
        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    private async _doInitialize(): Promise<void> {
        try {
            await identityService.initialize();

            const nextScope = this.getStorageScope();
            if (this.isInitialized && nextScope === this.activeScope) return;

            if (this.activeScope !== nextScope) this.resetInMemoryState();
            this.activeScope = nextScope;
            logger.info(`📇 Initializing ContactService (scope=${this.activeScope})...`);

            await this.loadFromCache(this.activeScope);

            if (identityService.isCloudAuthenticated()) {
                await this.syncFromFirebase();
                await this.processPendingSync();
            }

            this.isInitialized = true;
            logger.info(`✅ ContactService: ${this.contacts.size} contacts`);
        } catch (error) {
            logger.error('❌ ContactService init failed:', error);
            this.isInitialized = true;
        }
        // NOTE: initPromise is NOT cleared here. Subsequent callers will
        // return the same (resolved/rejected) promise. The isInitialized
        // flag is checked separately in initialize() for re-init scenarios.
    }

    // ==================== CACHE OPERATIONS ====================

    private async loadFromCache(scope: string): Promise<void> {
        try {
            this.resetInMemoryState();
            const keys = this.getStorageKeys(scope);

            const contactsData = DirectStorage.getString(keys.contacts) ?? null;
            const blockedData = DirectStorage.getString(keys.blocked) ?? null;
            const pendingData = DirectStorage.getString(keys.pending) ?? null;

            if (contactsData) {
                const parsed = JSON.parse(contactsData);
                if (Array.isArray(parsed)) {
                    (parsed as Contact[]).forEach(c => this.contacts.set(c.uid, c));
                }
                logger.info(`📂 ${this.contacts.size} contacts from cache`);
            }
            if (blockedData) {
                const parsed = JSON.parse(blockedData);
                if (Array.isArray(parsed)) {
                    (parsed as BlockedContact[]).forEach(b => this.blockedContacts.set(b.uid, b));
                }
            }
            if (pendingData) {
                const parsed = JSON.parse(pendingData);
                if (Array.isArray(parsed)) {
                    this.pendingSync = parsed;
                }
            }
        } catch (error) {
            logger.error('Failed to load from cache:', error);
        }
    }

    private async saveToCache(): Promise<void> {
        try {
            const keys = this.getStorageKeys();
            DirectStorage.setString(keys.contacts, JSON.stringify(Array.from(this.contacts.values())));
            DirectStorage.setString(keys.blocked, JSON.stringify(Array.from(this.blockedContacts.values())));
        } catch (error) {
            logger.error('Failed to save to cache:', error);
        }
    }

    private async savePendingSync(): Promise<void> {
        try {
            DirectStorage.setString(this.getStorageKeys().pending, JSON.stringify(this.pendingSync));
        } catch (error) {
            logger.error('Failed to save pending sync:', error);
        }
    }

    // ==================== FIREBASE SYNC ====================

    async syncFromFirebase(): Promise<void> {
        const myUid = identityService.getUid();
        if (!myUid) {
            logger.warn('Cannot sync: not authenticated');
            return;
        }

        try {
            const app = initializeFirebase();
            if (!app) return;

            const db = getFirestore(app);

            // Contacts
            const contactsRef = collection(db, 'users', myUid, 'contacts');
            const contactsQuery = query(contactsRef, orderBy('addedAt', 'desc'));
            const contactsSnap = await getDocs(contactsQuery);

            contactsSnap.forEach(docSnap => {
                const data = docSnap.data();
                // Handle both new (uid) and old (cloudUid) format from Firestore
                const contactUid = (data.uid || data.cloudUid || docSnap.id || '').trim();
                if (!contactUid) return;

                const contact: Contact = {
                    uid: contactUid,
                    displayName: data.displayName || 'Bilinmeyen',
                    nickname: data.nickname,
                    email: data.email,
                    photoURL: data.photoURL,
                    status: data.status,
                    lastSeen: data.lastSeen?.toMillis?.() || data.lastSeen,
                    addedAt: data.addedAt?.toMillis?.() || data.addedAt || Date.now(),
                    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now(),
                    addedVia: data.addedVia || 'sync',
                    isFavorite: data.isFavorite || false,
                    isVerified: data.isVerified || false,
                    notes: data.notes,
                    tags: data.tags,
                    isMutual: data.isMutual,
                };

                const existing = this.contacts.get(contactUid);
                if (!existing || contact.updatedAt > existing.updatedAt) {
                    this.contacts.set(contactUid, contact);
                }
            });

            // Blocked
            const blockedRef = collection(db, 'users', myUid, 'blocked');
            const blockedSnap = await getDocs(blockedRef);

            blockedSnap.forEach(docSnap => {
                const data = docSnap.data();
                const blockedUid = data.uid || data.cloudUid || docSnap.id;
                this.blockedContacts.set(blockedUid, {
                    uid: blockedUid,
                    displayName: data.displayName || 'Bilinmeyen',
                    blockedAt: data.blockedAt?.toMillis?.() || data.blockedAt || Date.now(),
                    reason: data.reason,
                });
            });

            await this.saveToCache();
            logger.info(`🔄 Synced ${this.contacts.size} contacts from Firebase`);
        } catch (error) {
            logger.error('Failed to sync from Firebase:', error);
        }
    }

    private async _writeContactToFirebase(contact: Contact): Promise<void> {
        const myUid = identityService.getUid();
        if (!myUid) throw new Error('Not authenticated');

        const app = initializeFirebase();
        if (!app) throw new Error('Firebase not initialized');

        const db = getFirestore(app);
        const contactRef = doc(db, 'users', myUid, 'contacts', contact.uid);

        await setDoc(contactRef, {
            ...contact,
            addedAt: Timestamp.fromMillis(contact.addedAt),
            updatedAt: Timestamp.fromMillis(contact.updatedAt),
            lastSeen: contact.lastSeen ? Timestamp.fromMillis(contact.lastSeen) : null,
        });
    }

    private async syncContactToFirebase(contact: Contact): Promise<void> {
        const myUid = identityService.getUid();
        if (!myUid) {
            this.pendingSync.push({ operation: 'add', contactUid: contact.uid, data: contact, timestamp: Date.now() });
            await this.savePendingSync();
            return;
        }

        try {
            await this._writeContactToFirebase(contact);
            logger.info(`☁️ Contact synced: ${contact.displayName}`);
        } catch (error) {
            logger.error('Failed to sync contact:', error);
            this.pendingSync.push({ operation: 'add', contactUid: contact.uid, data: contact, timestamp: Date.now() });
            await this.savePendingSync();
        }
    }

    private async deleteContactFromFirebase(contactUid: string): Promise<void> {
        const myUid = identityService.getUid();
        if (!myUid) {
            this.pendingSync.push({ operation: 'delete', contactUid, timestamp: Date.now() });
            await this.savePendingSync();
            return;
        }

        try {
            const app = initializeFirebase();
            if (!app) return;
            const db = getFirestore(app);
            await deleteDoc(doc(db, 'users', myUid, 'contacts', contactUid));
            logger.info(`🗑️ Contact deleted from Firebase: ${contactUid}`);
        } catch (error) {
            logger.error('Failed to delete contact from Firebase:', error);
        }
    }

    async processPendingSync(): Promise<void> {
        if (this.pendingSync.length === 0) return;
        if (!identityService.isCloudAuthenticated()) return;

        logger.info(`📤 Processing ${this.pendingSync.length} pending ops...`);

        const toProcess = [...this.pendingSync];
        this.pendingSync = [];
        const failed: PendingSync[] = [];

        for (const op of toProcess) {
            try {
                switch (op.operation) {
                    case 'add':
                    case 'update':
                        if (op.data) await this._writeContactToFirebase(op.data as Contact);
                        break;
                    case 'delete':
                        await this.deleteContactFromFirebase(op.contactUid);
                        break;
                    case 'block':
                        await this.syncBlockedToFirebase(op.data as BlockedContact);
                        break;
                    case 'unblock':
                        await this.deleteBlockedFromFirebase(op.contactUid);
                        break;
                }
            } catch (error) {
                logger.error(`Pending sync failed: ${op.operation}`, error);
                failed.push(op);
            }
        }

        this.pendingSync = failed;
        await this.savePendingSync();
    }

    // ==================== CONTACT OPERATIONS ====================

    /**
     * Add a new contact by UID
     */
    async addContact(
        uid: string,
        displayName: string,
        options: {
            addedVia?: Contact['addedVia'];
            isVerified?: boolean;
            photoURL?: string;
            email?: string;
            sendContactRequest?: boolean;
        } = {}
    ): Promise<Contact> {
        if (!this.isInitialized) await this.initialize();

        const trimUid = uid.trim();
        if (!trimUid || !UID_REGEX.test(trimUid)) {
            throw new Error('Geçersiz kullanıcı kimliği');
        }

        // Self-check
        const myUid = identityService.getUid();
        if (trimUid === myUid) {
            throw new Error('Kendi kendinizi kişi olarak ekleyemezsiniz');
        }

        if (this.blockedContacts.has(trimUid)) {
            throw new Error('Bu kişi engellendi. Önce engeli kaldırın.');
        }

        // Existing → update
        if (this.contacts.has(trimUid)) {
            logger.info(`Contact ${trimUid} exists, updating...`);
            return this.updateContact(trimUid, { displayName, ...options });
        }

        const now = Date.now();
        const contact: Contact = {
            uid: trimUid,
            displayName,
            email: options.email,
            photoURL: options.photoURL,
            addedAt: now,
            updatedAt: now,
            addedVia: options.addedVia || 'id',
            isFavorite: false,
            isVerified: options.isVerified || false,
        };

        this.contacts.set(trimUid, contact);
        await this.saveToCache();
        await this.syncContactToFirebase(contact);

        // Send contact request
        const shouldSendRequest = options.sendContactRequest !== false;
        if (shouldSendRequest) {
            try {
                const requestService = await getContactRequestService();
                await requestService.sendContactRequest(trimUid, displayName || trimUid);
                logger.info(`📬 Contact request sent to ${displayName}`);
            } catch (error) {
                logger.warn('Failed to send contact request:', error);
            }
        }

        logger.info(`✅ Added contact: ${displayName} (${trimUid})`);
        return contact;
    }

    /**
     * Add contact from QR code scan — clean v4 flow
     */
    async addContactFromQR(qrData: string): Promise<Contact> {
        const payload = await identityService.parseQRPayload(qrData);

        if (!payload) throw new Error('Geçersiz QR kod');

        const uid = payload.uid?.trim();
        if (!uid || !UID_REGEX.test(uid)) {
            throw new Error('QR kod geçerli bir kullanıcı kimliği içermiyor');
        }

        return this.addContact(uid, payload.name || 'Bilinmeyen Kullanıcı', {
            addedVia: 'qr',
            isVerified: true,
            sendContactRequest: true,
        });
    }

    /**
     * Update existing contact
     */
    async updateContact(
        uid: string,
        updates: Partial<Omit<Contact, 'uid' | 'addedAt'>>
    ): Promise<Contact> {
        if (!this.isInitialized) await this.initialize();

        const existing = this.contacts.get(uid);
        if (!existing) throw new Error('Kişi bulunamadı');

        const updated: Contact = { ...existing, ...updates, updatedAt: Date.now() };
        this.contacts.set(uid, updated);
        await this.saveToCache();
        await this.syncContactToFirebase(updated);

        logger.info(`✏️ Updated contact: ${uid}`);
        return updated;
    }

    async removeContact(uid: string): Promise<void> {
        if (!this.isInitialized) await this.initialize();
        if (!this.contacts.has(uid)) return;

        this.contacts.delete(uid);
        await this.saveToCache();
        await this.deleteContactFromFirebase(uid);
        logger.info(`🗑️ Removed contact: ${uid}`);
    }

    async setFavorite(uid: string, isFavorite: boolean): Promise<void> {
        await this.updateContact(uid, { isFavorite });
    }

    async setNickname(uid: string, nickname: string): Promise<void> {
        await this.updateContact(uid, { nickname });
    }

    async setNotes(uid: string, notes: string): Promise<void> {
        await this.updateContact(uid, { notes });
    }

    updateLastSeen(uid: string): void {
        const contact = this.contacts.get(uid);
        if (contact) {
            const now = Date.now();
            const updated = { ...contact, lastSeen: now, updatedAt: now };
            this.contacts.set(uid, updated);
            this.saveToCache().catch(e => logger.error('Save lastSeen failed:', e));
            this.syncContactToFirebase(updated).catch(e => logger.warn('Sync lastSeen failed:', e));
        }
    }

    // ==================== BLOCK OPERATIONS ====================

    async blockContact(uid: string, reason?: string): Promise<void> {
        if (!this.isInitialized) await this.initialize();

        const contact = this.contacts.get(uid);
        const displayName = contact?.displayName || 'Bilinmeyen';

        if (contact) {
            this.contacts.delete(uid);
            await this.deleteContactFromFirebase(uid);
        }

        const blocked: BlockedContact = { uid, displayName, blockedAt: Date.now(), reason };
        this.blockedContacts.set(uid, blocked);
        await this.saveToCache();
        await this.syncBlockedToFirebase(blocked);
        logger.info(`🚫 Blocked: ${uid}`);
    }

    private async syncBlockedToFirebase(blocked: BlockedContact): Promise<void> {
        const myUid = identityService.getUid();
        if (!myUid) {
            this.pendingSync.push({ operation: 'block', contactUid: blocked.uid, data: blocked, timestamp: Date.now() });
            await this.savePendingSync();
            return;
        }

        try {
            const app = initializeFirebase();
            if (!app) return;
            const db = getFirestore(app);
            await setDoc(doc(db, 'users', myUid, 'blocked', blocked.uid), {
                ...blocked,
                blockedAt: Timestamp.fromMillis(blocked.blockedAt),
            });
        } catch (error) {
            logger.error('Failed to sync blocked to Firebase:', error);
        }
    }

    private async deleteBlockedFromFirebase(blockedUid: string): Promise<void> {
        const myUid = identityService.getUid();
        if (!myUid) return;

        try {
            const app = initializeFirebase();
            if (!app) return;
            const db = getFirestore(app);
            await deleteDoc(doc(db, 'users', myUid, 'blocked', blockedUid));
        } catch (error) {
            logger.error('Failed to delete blocked from Firebase:', error);
        }
    }

    async unblockContact(uid: string): Promise<void> {
        if (!this.isInitialized) await this.initialize();
        if (!this.blockedContacts.has(uid)) return;

        this.blockedContacts.delete(uid);
        await this.saveToCache();
        await this.deleteBlockedFromFirebase(uid);
        logger.info(`✅ Unblocked: ${uid}`);
    }

    isBlocked(uid: string): boolean {
        return this.blockedContacts.has(uid);
    }

    // ==================== GETTERS ====================

    getContact(uid: string): Contact | undefined {
        return this.contacts.get(uid);
    }

    /** Find contact by uid — single lookup, no multi-ID search */
    getContactByAnyId(uid: string): Contact | undefined {
        if (!uid) return undefined;
        return this.contacts.get(uid.trim());
    }

    /** Resolve uid for a contact — just returns the uid directly */
    resolveCloudUid(uid: string): string | undefined {
        const contact = this.contacts.get(uid.trim());
        return contact?.uid;
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

    searchContacts(queryStr: string): Contact[] {
        const lower = queryStr.toLowerCase();
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

    getMyQRData(): string {
        return identityService.getQRPayload();
    }

    async forceSync(): Promise<void> {
        if (!identityService.isCloudAuthenticated()) return;
        await this.syncFromFirebase();
        await this.processPendingSync();
        logger.info('🔄 Force sync completed');
    }

    async clearAll(): Promise<void> {
        this.resetInMemoryState();
        const keys = this.getStorageKeys();
        try {
            DirectStorage.delete(keys.contacts);
            DirectStorage.delete(keys.blocked);
            DirectStorage.delete(keys.pending);
        } catch (e) {
            logger.warn('Failed to clear storage:', e);
        }
        this.isInitialized = false;
        this.initPromise = null;
        this.activeScope = STORAGE_GUEST_SCOPE;
        logger.info('🗑️ Cleared all contacts');
    }

    getSyncStatus(): { pending: number; lastSync: number | null } {
        return { pending: this.pendingSync.length, lastSync: null };
    }
}

export const contactService = new ContactService();
export default contactService;
