/**
 * REACTION SERVICE - ELITE FIREBASE EDITION
 * Message reactions with mesh network AND Firebase synchronization
 * 
 * Features:
 * - 5 reaction types (❤️ 👍 😊 🙏 🆘)
 * - Mesh network broadcast (offline)
 * - Firebase Firestore sync (cloud backup)
 * - Real-time sync via onSnapshot
 * - Toggle behavior (tap same = remove)
 * - Offline-first with pending sync queue
 */

import { createLogger } from '../utils/logger';
import { useMeshStore, MessageReaction, MeshMessageReaction } from './mesh/MeshStore';
import { meshNetworkService } from './mesh/MeshNetworkService';
import { MeshMessageType } from './mesh/MeshProtocol';
import { identityService } from './IdentityService';
import { doc, setDoc, deleteDoc, collection, onSnapshot, getDocs } from 'firebase/firestore';
import { getFirestoreInstanceAsync } from './firebase/FirebaseInstanceManager';

const logger = createLogger('ReactionService');

// ELITE: Available reactions
export const AVAILABLE_REACTIONS: MessageReaction[] = ['❤️', '👍', '😊', '🙏', '🆘'];

// ELITE: Reaction broadcast payload
interface ReactionPayload {
    type: 'reaction';
    action: 'add' | 'remove';
    messageId: string;
    emoji: MessageReaction;
    userId: string;
    userName?: string;
    timestamp: number;
}

// ELITE: Firebase reaction document
interface FirebaseReaction {
    messageId: string;
    emoji: MessageReaction;
    userId: string;
    userName?: string;
    createdAt: string;
}

class ReactionService {
    private isInitialized = false;
    private firebaseUnsubscribe: (() => void) | null = null;
    private pendingSyncs: ReactionPayload[] = [];

    /**
     * Initialize reaction service
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Subscribe to incoming reaction messages (Mesh)
        meshNetworkService.onMessage((message) => {
            if (message.type === 'CHAT' && typeof message.content === 'string') {
                try {
                    const parsed = JSON.parse(message.content);
                    if (parsed.type === 'reaction') {
                        this.handleIncomingReaction(parsed as ReactionPayload);
                    }
                } catch {
                    // Not a reaction message, ignore
                }
            }
        });

        // Subscribe to Firebase reactions
        await this.subscribeToFirebaseReactions();

        // Sync pending reactions
        await this.syncPendingToFirebase();

        this.isInitialized = true;
        logger.info('🎯 ReactionService initialized with Firebase sync');
    }

    /**
     * Add reaction to a message
     */
    async addReaction(messageId: string, emoji: MessageReaction): Promise<void> {
        const identity = identityService.getIdentity();
        if (!identity) {
            logger.warn('Cannot add reaction: Identity not initialized');
            return;
        }

        // Add to local store
        useMeshStore.getState().addReaction(messageId, emoji, identity.id);

        // Broadcast to mesh
        const payload: ReactionPayload = {
            type: 'reaction',
            action: 'add',
            messageId,
            emoji,
            userId: identity.id,
            userName: identity.displayName,
            timestamp: Date.now(),
        };

        try {
            meshNetworkService.broadcastMessage(
                JSON.stringify(payload),
                MeshMessageType.TEXT
            );
            logger.debug(`Reaction broadcasted: ${emoji} on ${messageId}`);
        } catch (error) {
            logger.error('Failed to broadcast reaction:', error);
        }

        // ELITE: Sync to Firebase
        await this.syncReactionToFirebase(payload);
    }

    /**
     * Remove reaction from a message
     */
    async removeReaction(messageId: string): Promise<void> {
        const identity = identityService.getIdentity();
        if (!identity) return;

        // Remove from local store
        useMeshStore.getState().removeReaction(messageId, identity.id);

        // Broadcast removal to mesh
        const payload: ReactionPayload = {
            type: 'reaction',
            action: 'remove',
            messageId,
            emoji: '❤️', // Emoji not needed for removal
            userId: identity.id,
            timestamp: Date.now(),
        };

        try {
            meshNetworkService.broadcastMessage(
                JSON.stringify(payload),
                MeshMessageType.TEXT
            );
            logger.debug(`Reaction removal broadcasted for ${messageId}`);
        } catch (error) {
            logger.error('Failed to broadcast reaction removal:', error);
        }

        // ELITE: Remove from Firebase
        await this.removeReactionFromFirebase(messageId, identity.id);
    }

    /**
     * Toggle reaction (add if not exists, remove if exists)
     */
    async toggleReaction(messageId: string, emoji: MessageReaction): Promise<void> {
        const identity = identityService.getIdentity();
        if (!identity) return;

        const messages = useMeshStore.getState().messages;
        const message = messages.find(m => m.id === messageId);

        if (!message) return;

        const existingReaction = message.reactions?.find(
            r => r.userId === identity.id && r.emoji === emoji
        );

        if (existingReaction) {
            await this.removeReaction(messageId);
        } else {
            await this.addReaction(messageId, emoji);
        }
    }

    /**
     * Get reactions for a message
     */
    getReactions(messageId: string): MeshMessageReaction[] {
        const messages = useMeshStore.getState().messages;
        const message = messages.find(m => m.id === messageId);
        return message?.reactions || [];
    }

    /**
     * Get reaction count for a message
     */
    getReactionCount(messageId: string): number {
        return this.getReactions(messageId).length;
    }

    /**
     * Check if current user has reacted with specific emoji
     */
    hasReacted(messageId: string, emoji: MessageReaction): boolean {
        const identity = identityService.getIdentity();
        if (!identity) return false;

        const reactions = this.getReactions(messageId);
        return reactions.some(r => r.userId === identity.id && r.emoji === emoji);
    }

    /**
     * Get grouped reactions (for display)
     */
    getGroupedReactions(messageId: string): Record<MessageReaction, number> {
        const reactions = this.getReactions(messageId);
        const grouped: Record<MessageReaction, number> = {
            '❤️': 0,
            '👍': 0,
            '😊': 0,
            '🙏': 0,
            '🆘': 0,
        };

        reactions.forEach(r => {
            if (grouped[r.emoji] !== undefined) {
                grouped[r.emoji]++;
            }
        });

        return grouped;
    }

    /**
     * Cleanup on logout
     */
    cleanup(): void {
        if (this.firebaseUnsubscribe) {
            this.firebaseUnsubscribe();
            this.firebaseUnsubscribe = null;
        }
        this.pendingSyncs = [];
        this.isInitialized = false;
    }

    // ============================================================================
    // ELITE: Firebase Sync Methods
    // ============================================================================

    /**
     * Sync reaction to Firebase Firestore
     */
    private async syncReactionToFirebase(payload: ReactionPayload): Promise<boolean> {
        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) {
                // Queue for later sync
                this.pendingSyncs.push(payload);
                logger.debug('Reaction queued for Firebase sync');
                return false;
            }

            const identity = identityService.getIdentity();
            if (!identity?.cloudUid) {
                this.pendingSyncs.push(payload);
                return false;
            }

            const reactionId = `${payload.messageId}_${payload.userId}`;
            const reactionRef = doc(db, 'users', identity.cloudUid, 'reactions', reactionId);

            const reactionDoc: FirebaseReaction = {
                messageId: payload.messageId,
                emoji: payload.emoji,
                userId: payload.userId,
                userName: payload.userName,
                createdAt: new Date().toISOString(),
            };

            await setDoc(reactionRef, reactionDoc);
            logger.debug(`✅ Reaction synced to Firebase: ${payload.emoji} on ${payload.messageId}`);
            return true;
        } catch (error) {
            logger.error('Failed to sync reaction to Firebase:', error);
            this.pendingSyncs.push(payload);
            return false;
        }
    }

    /**
     * Remove reaction from Firebase
     */
    private async removeReactionFromFirebase(messageId: string, userId: string): Promise<boolean> {
        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) return false;

            const identity = identityService.getIdentity();
            if (!identity?.cloudUid) return false;

            const reactionId = `${messageId}_${userId}`;
            const reactionRef = doc(db, 'users', identity.cloudUid, 'reactions', reactionId);

            await deleteDoc(reactionRef);
            logger.debug(`✅ Reaction removed from Firebase: ${messageId}`);
            return true;
        } catch (error) {
            logger.error('Failed to remove reaction from Firebase:', error);
            return false;
        }
    }

    /**
     * Subscribe to Firebase reactions for real-time sync
     */
    private async subscribeToFirebaseReactions(): Promise<void> {
        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) return;

            const identity = identityService.getIdentity();
            if (!identity?.cloudUid) return;

            const reactionsRef = collection(db, 'users', identity.cloudUid, 'reactions');

            this.firebaseUnsubscribe = onSnapshot(
                reactionsRef,
                (snapshot) => {
                    snapshot.docChanges().forEach((change) => {
                        const data = change.doc.data() as FirebaseReaction;

                        if (change.type === 'added') {
                            // Add to local store if not already present
                            const existingReactions = this.getReactions(data.messageId);
                            const exists = existingReactions.some(
                                r => r.userId === data.userId && r.emoji === data.emoji
                            );

                            if (!exists && data.userId !== identity.id) {
                                useMeshStore.getState().addReaction(
                                    data.messageId,
                                    data.emoji,
                                    data.userId
                                );
                            }
                        } else if (change.type === 'removed') {
                            useMeshStore.getState().removeReaction(data.messageId, data.userId);
                        }
                    });
                },
                (error) => {
                    logger.error('Firebase reactions subscription error:', error);
                }
            );

            logger.info('✅ Subscribed to Firebase reactions');
        } catch (error) {
            logger.error('Failed to subscribe to Firebase reactions:', error);
        }
    }

    /**
     * Sync pending reactions to Firebase
     */
    private async syncPendingToFirebase(): Promise<number> {
        if (this.pendingSyncs.length === 0) return 0;

        let synced = 0;
        const pending = [...this.pendingSyncs];
        this.pendingSyncs = [];

        for (const payload of pending) {
            if (payload.action === 'add') {
                const success = await this.syncReactionToFirebase(payload);
                if (success) synced++;
            } else {
                await this.removeReactionFromFirebase(payload.messageId, payload.userId);
                synced++;
            }
        }

        if (synced > 0) {
            logger.info(`✅ Synced ${synced} pending reactions to Firebase`);
        }

        return synced;
    }

    /**
     * Load reactions from Firebase (for initial sync)
     */
    async loadReactionsFromFirebase(): Promise<number> {
        try {
            const db = await getFirestoreInstanceAsync();
            if (!db) return 0;

            const identity = identityService.getIdentity();
            if (!identity?.cloudUid) return 0;

            const reactionsRef = collection(db, 'users', identity.cloudUid, 'reactions');
            const snapshot = await getDocs(reactionsRef);

            let loaded = 0;
            snapshot.forEach((doc) => {
                const data = doc.data() as FirebaseReaction;
                useMeshStore.getState().addReaction(data.messageId, data.emoji, data.userId);
                loaded++;
            });

            logger.info(`✅ Loaded ${loaded} reactions from Firebase`);
            return loaded;
        } catch (error) {
            logger.error('Failed to load reactions from Firebase:', error);
            return 0;
        }
    }

    // PRIVATE METHODS

    private handleIncomingReaction(payload: ReactionPayload): void {
        const identity = identityService.getIdentity();

        // Don't process our own reactions (already handled locally)
        if (identity && payload.userId === identity.id) return;

        if (payload.action === 'add') {
            useMeshStore.getState().addReaction(
                payload.messageId,
                payload.emoji,
                payload.userId
            );
            logger.debug(`Received reaction: ${payload.emoji} from ${payload.userId}`);
        } else {
            useMeshStore.getState().removeReaction(
                payload.messageId,
                payload.userId
            );
            logger.debug(`Received reaction removal from ${payload.userId}`);
        }
    }
}

export const reactionService = new ReactionService();
