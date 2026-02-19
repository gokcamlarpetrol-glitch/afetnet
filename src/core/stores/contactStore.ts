/**
 * CONTACT STORE - Elite Firebase Edition
 * Zustand store for contact state management
 * 
 * Features:
 * - Real-time contact state with Firebase sync
 * - Persistence with AsyncStorage (offline-first)
 * - Integration with Firebase-enabled ContactService
 * - Automatic sync status tracking
 * 
 * @author AfetNet Elite Messaging System
 * @version 2.0.0 - Firebase Integration
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DirectStorage } from '../utils/storage';
import { getAuth } from 'firebase/auth';
import { initializeFirebase } from '../../lib/firebase';
import { contactService, Contact, BlockedContact } from '../services/ContactService';
import { identityService } from '../services/IdentityService';
import { createLogger } from '../utils/logger';

const logger = createLogger('ContactStore');
const CONTACT_STORE_KEY_BASE = 'afetnet-contacts-v2';
const CONTACT_STORE_GUEST_SCOPE = 'guest';

const getContactStoreScope = (): string => {
    try {
        const app = initializeFirebase();
        if (!app) return CONTACT_STORE_GUEST_SCOPE;
        const uid = getAuth(app).currentUser?.uid;
        return uid ? `user:${uid}` : CONTACT_STORE_GUEST_SCOPE;
    } catch {
        return CONTACT_STORE_GUEST_SCOPE;
    }
};

const getScopedContactStoreKey = (base: string): string => `${base}:${getContactStoreScope()}`;

const scopedContactStoreStorage = {
    getItem: (name: string): string | null => {
        const scopedKey = getScopedContactStoreKey(name);
        const scopedData = DirectStorage.getString(scopedKey) ?? null;
        if (scopedData) {
            return scopedData;
        }

        // One-time migration from legacy global store key.
        const legacyData = DirectStorage.getString(name) ?? null;
        if (!legacyData) {
            return null;
        }

        try { DirectStorage.setString(scopedKey, legacyData); } catch { /* best effort */ }
        try { DirectStorage.delete(name); } catch { /* best effort */ }
        logger.info(`♻️ ContactStore cache migrated to ${scopedKey}`);
        return legacyData;
    },
    setItem: (name: string, value: string): void => {
        DirectStorage.setString(getScopedContactStoreKey(name), value);
    },
    removeItem: (name: string): void => {
        try { DirectStorage.delete(getScopedContactStoreKey(name)); } catch { /* best effort */ }
        try { DirectStorage.delete(name); } catch { /* best effort */ }
    },
};

interface ContactState {
    // State
    contacts: Contact[];
    favorites: Contact[];
    blocked: BlockedContact[];
    isLoading: boolean;
    isSyncing: boolean;
    error: string | null;
    searchQuery: string;
    selectedContactId: string | null;
    pendingSyncCount: number;
    lastSyncTime: number | null;

    // Actions
    initialize: () => Promise<void>;
    addContact: (qrId: string, cloudUid: string, name: string, options?: {
        deviceId?: string;
        addedVia?: Contact['addedVia'];
        isVerified?: boolean;
        photoURL?: string;
        email?: string;
    }) => Promise<Contact | null>;
    addContactFromQR: (qrData: string) => Promise<Contact | null>;
    removeContact: (id: string) => Promise<void>;
    updateContact: (id: string, updates: Partial<Contact>) => Promise<void>;
    toggleFavorite: (id: string) => Promise<void>;
    blockContact: (id: string, reason?: string) => Promise<void>;
    unblockContact: (id: string) => Promise<void>;
    setSearchQuery: (query: string) => void;
    selectContact: (id: string | null) => void;
    refreshContacts: () => void;
    forceSync: () => Promise<void>;
    getContact: (id: string) => Contact | undefined;
    clearLocalCache: () => Promise<void>;
}

export const useContactStore = create<ContactState>()(
    persist(
        (set, get) => ({
            // Initial state
            contacts: [],
            favorites: [],
            blocked: [],
            isLoading: false,
            isSyncing: false,
            error: null,
            searchQuery: '',
            selectedContactId: null,
            pendingSyncCount: 0,
            lastSyncTime: null,

            // Initialize from ContactService (with Firebase sync)
            initialize: async () => {
                set({ isLoading: true, error: null });
                try {
                    // Initialize identity first
                    await identityService.initialize();

                    // Then initialize contacts (will sync from Firebase)
                    await contactService.initialize();

                    const contacts = contactService.getAllContacts();
                    const favorites = contactService.getFavorites();
                    const blocked = contactService.getBlockedContacts();
                    const syncStatus = contactService.getSyncStatus();

                    set({
                        contacts,
                        favorites,
                        blocked,
                        isLoading: false,
                        pendingSyncCount: syncStatus.pending,
                        lastSyncTime: Date.now(),
                    });

                    logger.info(`✅ Store initialized: ${contacts.length} contacts`);
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
                    set({ error: message, isLoading: false });
                    logger.error('Store initialization failed:', error);
                }
            },

            // Add new contact (with Firebase sync)
            addContact: async (qrId, cloudUid, name, options) => {
                set({ isLoading: true, error: null });
                try {
                    const contact = await contactService.addContact(qrId, name, { ...options, addedVia: options?.addedVia || 'qr' });

                    set(state => ({
                        contacts: [...state.contacts.filter(c => c.uid !== qrId), contact],
                        isLoading: false,
                    }));

                    logger.info(`✅ Added contact: ${name}`);
                    return contact;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Kişi eklenemedi';
                    set({ error: message, isLoading: false });
                    logger.error('Add contact failed:', error);
                    return null;
                }
            },

            // Add from QR scan (with Firebase profile fetch)
            addContactFromQR: async (qrData) => {
                set({ isLoading: true, error: null });
                try {
                    const contact = await contactService.addContactFromQR(qrData);

                    set(state => ({
                        contacts: [...state.contacts.filter(c => c.uid !== contact.uid), contact],
                        isLoading: false,
                    }));

                    logger.info(`✅ Added from QR: ${contact.displayName}`);
                    return contact;
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'QR kod okunamadı';
                    set({ error: message, isLoading: false });
                    logger.error('Add from QR failed:', error);
                    return null;
                }
            },

            // Remove contact (with Firebase sync)
            removeContact: async (id) => {
                try {
                    await contactService.removeContact(id);

                    set(state => ({
                        contacts: state.contacts.filter(c => c.uid !== id),
                        favorites: state.favorites.filter(c => c.uid !== id),
                    }));

                    logger.info(`🗑️ Removed: ${id}`);
                } catch (error) {
                    logger.error('Remove contact failed:', error);
                }
            },

            // Update contact (with Firebase sync)
            updateContact: async (id, updates) => {
                try {
                    await contactService.updateContact(id, updates);

                    set(state => ({
                        contacts: state.contacts.map(c =>
                            c.uid === id ? { ...c, ...updates } : c
                        ),
                        favorites: updates.isFavorite !== undefined
                            ? state.favorites.map(c => c.uid === id ? { ...c, ...updates } : c)
                            : state.favorites,
                    }));
                } catch (error) {
                    logger.error('Update contact failed:', error);
                }
            },

            // Toggle favorite (with Firebase sync)
            toggleFavorite: async (id) => {
                const contact = get().contacts.find(c => c.uid === id);
                if (!contact) return;

                const newFavoriteStatus = !contact.isFavorite;
                await contactService.setFavorite(id, newFavoriteStatus);

                set(state => {
                    const updatedContacts = state.contacts.map(c =>
                        c.uid === id ? { ...c, isFavorite: newFavoriteStatus } : c
                    );
                    return {
                        contacts: updatedContacts,
                        favorites: updatedContacts.filter(c => c.isFavorite),
                    };
                });
            },

            // Block contact (with Firebase sync)
            blockContact: async (id, reason) => {
                try {
                    await contactService.blockContact(id, reason);
                    const blockedList = contactService.getBlockedContacts();

                    set(state => ({
                        contacts: state.contacts.filter(c => c.uid !== id),
                        favorites: state.favorites.filter(c => c.uid !== id),
                        blocked: blockedList,
                    }));

                    logger.info(`🚫 Blocked: ${id}`);
                } catch (error) {
                    logger.error('Block contact failed:', error);
                }
            },

            // Unblock contact (with Firebase sync)
            unblockContact: async (id) => {
                try {
                    await contactService.unblockContact(id);

                    set(state => ({
                        blocked: state.blocked.filter(b => b.uid !== id),
                    }));

                    logger.info(`✅ Unblocked: ${id}`);
                } catch (error) {
                    logger.error('Unblock contact failed:', error);
                }
            },

            // Search
            setSearchQuery: (query) => set({ searchQuery: query }),

            // Selection
            selectContact: (id) => set({ selectedContactId: id }),

            // Refresh from service (re-read from cache/Firebase)
            refreshContacts: () => {
                const contacts = contactService.getAllContacts();
                const favorites = contactService.getFavorites();
                const blocked = contactService.getBlockedContacts();
                const syncStatus = contactService.getSyncStatus();

                set({
                    contacts,
                    favorites,
                    blocked,
                    pendingSyncCount: syncStatus.pending,
                });
            },

            // Force sync with Firebase
            forceSync: async () => {
                set({ isSyncing: true });
                try {
                    await contactService.forceSync();

                    const contacts = contactService.getAllContacts();
                    const favorites = contactService.getFavorites();
                    const blocked = contactService.getBlockedContacts();
                    const syncStatus = contactService.getSyncStatus();

                    set({
                        contacts,
                        favorites,
                        blocked,
                        isSyncing: false,
                        pendingSyncCount: syncStatus.pending,
                        lastSyncTime: Date.now(),
                    });

                    logger.info('🔄 Force sync completed');
                } catch (error) {
                    set({ isSyncing: false });
                    logger.error('Force sync failed:', error);
                }
            },

            // Get single contact
            getContact: (id) => get().contacts.find(c => c.uid === id),

            clearLocalCache: async () => {
                set({
                    contacts: [],
                    favorites: [],
                    blocked: [],
                    isLoading: false,
                    isSyncing: false,
                    error: null,
                    searchQuery: '',
                    selectedContactId: null,
                    pendingSyncCount: 0,
                    lastSyncTime: null,
                });
                try { DirectStorage.delete(getScopedContactStoreKey(CONTACT_STORE_KEY_BASE)); } catch { /* best effort */ }
                try { DirectStorage.delete(CONTACT_STORE_KEY_BASE); } catch { /* best effort */ }
            },
        }),
        {
            name: CONTACT_STORE_KEY_BASE,
            storage: createJSONStorage(() => scopedContactStoreStorage),
            partialize: (state) => ({
                // Only persist these fields (cache for offline)
                contacts: state.contacts,
                favorites: state.favorites,
                blocked: state.blocked,
                lastSyncTime: state.lastSyncTime,
            }),
        }
    )
);

// ==================== SELECTOR HOOKS ====================

export const useContacts = () => useContactStore(state => state.contacts);
export const useFavorites = () => useContactStore(state => state.favorites);
export const useBlocked = () => useContactStore(state => state.blocked);
export const useContactLoading = () => useContactStore(state => state.isLoading);
export const useContactSyncing = () => useContactStore(state => state.isSyncing);
export const useContactError = () => useContactStore(state => state.error);
export const usePendingSyncCount = () => useContactStore(state => state.pendingSyncCount);

// Filtered contacts selector
export const useFilteredContacts = () => useContactStore(state => {
    const { contacts, searchQuery } = state;
    if (!searchQuery.trim()) return contacts;

    const lower = searchQuery.toLowerCase();
    return contacts.filter(c =>
        c.displayName.toLowerCase().includes(lower) ||
        (c.nickname && c.nickname.toLowerCase().includes(lower)) ||
        (c.email && c.email.toLowerCase().includes(lower))
    );
});

// Recently active contacts
export const useRecentContacts = (limit = 5) => useContactStore(state => {
    return state.contacts
        .filter(c => c.lastSeen)
        .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
        .slice(0, limit);
});

// Verified contacts only
export const useVerifiedContacts = () => useContactStore(state =>
    state.contacts.filter(c => c.isVerified)
);

export default useContactStore;
