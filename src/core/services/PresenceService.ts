/**
 * PRESENCE SERVICE - Elite Firebase Edition
 * Real-time online/offline status tracking
 * 
 * Features:
 * - Firebase Realtime Database for presence
 * - Automatic offline detection
 * - Last seen timestamps
 * - App state monitoring
 * 
 * @author AfetNet Elite Messaging System
 * @version 1.0.0
 */

import { AppState, AppStateStatus } from 'react-native';
import { getDatabase, ref, set, onValue, onDisconnect, serverTimestamp } from 'firebase/database';
import { initializeFirebase } from '../../lib/firebase';
import { identityService } from './IdentityService';
import { createLogger } from '../utils/logger';

const logger = createLogger('PresenceService');

// Presence status interface
export interface PresenceStatus {
    state: 'online' | 'offline' | 'away';
    lastChanged: number;
    lastSeen?: number;
    deviceType?: string;
}

// Presence listener callback
export type PresenceCallback = (userId: string, status: PresenceStatus) => void;

class PresenceService {
    private isInitialized = false;
    private myStatusRef: any = null;
    private listeners: Map<string, PresenceCallback[]> = new Map();
    private unsubscribers: Map<string, () => void> = new Map();
    private appStateSubscription: any = null;
    private currentState: 'online' | 'offline' | 'away' = 'offline';

    /**
     * Initialize presence tracking
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            await identityService.initialize();
            const cloudUid = identityService.getCloudUid();

            if (!cloudUid) {
                logger.warn('Cannot init presence: not authenticated');
                return;
            }

            const app = initializeFirebase();
            if (!app) {
                logger.warn('Cannot init presence: Firebase not initialized');
                return;
            }

            const db = getDatabase(app);
            this.myStatusRef = ref(db, `presence/${cloudUid}`);

            // Set up app state listener
            this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

            // Set initial online status
            await this.setOnline();

            // Set up onDisconnect handler
            const myStatusRefDisconnect = onDisconnect(this.myStatusRef);
            await myStatusRefDisconnect.set({
                state: 'offline',
                lastChanged: serverTimestamp(),
                lastSeen: serverTimestamp(),
            });

            this.isInitialized = true;
            logger.info('✅ PresenceService initialized');

        } catch (error) {
            logger.error('Failed to initialize PresenceService:', error);
        }
    }

    /**
     * Handle app state changes
     */
    private handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (!this.myStatusRef) return;

        if (nextAppState === 'active') {
            await this.setOnline();
        } else if (nextAppState === 'background') {
            await this.setAway();
        } else if (nextAppState === 'inactive') {
            // iOS specific - about to go to background
            await this.setAway();
        }
    };

    /**
     * Set user as online
     */
    async setOnline(): Promise<void> {
        if (!this.myStatusRef) return;

        try {
            this.currentState = 'online';
            await set(this.myStatusRef, {
                state: 'online',
                lastChanged: serverTimestamp(),
            });
        } catch (error) {
            logger.warn('Failed to set online:', error);
        }
    }

    /**
     * Set user as away (app in background)
     */
    async setAway(): Promise<void> {
        if (!this.myStatusRef) return;

        try {
            this.currentState = 'away';
            await set(this.myStatusRef, {
                state: 'away',
                lastChanged: serverTimestamp(),
                lastSeen: serverTimestamp(),
            });
        } catch (error) {
            logger.warn('Failed to set away:', error);
        }
    }

    /**
     * Set user as offline
     */
    async setOffline(): Promise<void> {
        if (!this.myStatusRef) return;

        try {
            this.currentState = 'offline';
            await set(this.myStatusRef, {
                state: 'offline',
                lastChanged: serverTimestamp(),
                lastSeen: serverTimestamp(),
            });
        } catch (error) {
            logger.warn('Failed to set offline:', error);
        }
    }

    /**
     * Subscribe to a user's presence
     */
    subscribeToPresence(userId: string, callback: PresenceCallback): () => void {
        try {
            const app = initializeFirebase();
            if (!app) {
                logger.warn('Cannot subscribe: Firebase not initialized');
                return () => { };
            }

            const db = getDatabase(app);
            const statusRef = ref(db, `presence/${userId}`);

            // Add to listeners
            if (!this.listeners.has(userId)) {
                this.listeners.set(userId, []);
            }
            this.listeners.get(userId)!.push(callback);

            // If first listener for this user, set up Firebase listener
            if (!this.unsubscribers.has(userId)) {
                const unsubscribe = onValue(statusRef, (snapshot) => {
                    const status = snapshot.val() as PresenceStatus | null;
                    const callbacks = this.listeners.get(userId) || [];

                    const resolvedStatus: PresenceStatus = status || {
                        state: 'offline',
                        lastChanged: Date.now(),
                    };

                    callbacks.forEach(cb => cb(userId, resolvedStatus));
                });

                this.unsubscribers.set(userId, unsubscribe);
            }

            // Return unsubscribe function
            return () => {
                const callbacks = this.listeners.get(userId) || [];
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }

                // If no more listeners, remove Firebase listener
                if (callbacks.length === 0) {
                    const unsub = this.unsubscribers.get(userId);
                    if (unsub) {
                        unsub();
                        this.unsubscribers.delete(userId);
                    }
                    this.listeners.delete(userId);
                }
            };

        } catch (error) {
            logger.error('Failed to subscribe to presence:', error);
            return () => { };
        }
    }

    /**
     * Get a user's current presence (one-time fetch)
     */
    async getPresence(userId: string): Promise<PresenceStatus | null> {
        try {
            const app = initializeFirebase();
            if (!app) return null;

            const db = getDatabase(app);
            const statusRef = ref(db, `presence/${userId}`);

            return new Promise((resolve) => {
                onValue(statusRef, (snapshot) => {
                    resolve(snapshot.val() as PresenceStatus | null);
                }, { onlyOnce: true });
            });

        } catch (error) {
            logger.error('Failed to get presence:', error);
            return null;
        }
    }

    /**
     * Get my current state
     */
    getMyState(): 'online' | 'offline' | 'away' {
        return this.currentState;
    }

    /**
     * Cleanup on logout
     */
    async cleanup(): Promise<void> {
        // Set offline before cleanup
        await this.setOffline();

        // Remove app state listener
        if (this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        // Clear all listeners
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers.clear();
        this.listeners.clear();

        this.myStatusRef = null;
        this.isInitialized = false;

        logger.info('🗑️ PresenceService cleaned up');
    }
}

export const presenceService = new PresenceService();
