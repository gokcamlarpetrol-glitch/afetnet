/**
 * EMERGENCY HEALTH SHARING SERVICE
 * Broadcasts critical health data via BLE mesh when SOS is activated.
 *
 * PRIVACY FIRST (P0-2, Phase 0, v1.6.1):
 * Health data (blood type, allergies, chronic conditions, medications) is
 * sensitive personal data under KVKK Art. 6 (sağlık verisi) and must be
 * shared on a strict allowlist basis. Earlier versions BROADCAST this data
 * over BLE mesh to every nearby device, which is a KVKK violation
 * (sınırsız ifşa) even with explicit user opt-in.
 *
 * New gating model (`shouldShareWith(peerId)`):
 *   1. User must have opted-in (`isEnabled === true`)            — existing
 *   2. The user's own SOS must be active (`isBroadcasting`)      — existing
 *   3. The receiving peer must be either:
 *        (a) a mutual-approved family member (uid or deviceId), or
 *        (b) a rescue responder who has sent an explicit rescue ACK
 *            for the active SOS signal
 *
 * Discovered peers that fail (3) receive NOTHING. There is no fallback
 * broadcast — silence is the privacy-safe default.
 *
 * Minimal data is unchanged: initials only (no full name), blood type,
 * allergies, conditions, medications. No phone, no insurance, no UID.
 */

import { DirectStorage } from '../utils/storage';
import { logger } from '../utils/logger';
import { MeshProtocol, MeshMessageType } from './mesh/MeshProtocol';
import { getDeviceId } from '../utils/device';
import { getFirebaseAuth } from '../../lib/firebase';
import { isApprovedFamilyMember } from '../utils/familyApproval';

/**
 * H9 (anonymous UID hardening): when no user is signed in, return null so
 * callers fail-closed (sharing OFF) instead of reading/writing a shared
 * 'anonymous' bucket. The previous fallback meant any logged-out activity
 * could touch — or worse, leak — the previous owner's opt-in state.
 *
 * Behavior contract:
 *   - signed in:   `@afetnet:health_sharing_enabled:${uid}` (per-UID, isolated)
 *   - signed out:  null  →  isEnabled stays false, broadcast disabled
 *
 * On re-login the per-UID key is restored automatically, so a returning user
 * sees their own previously-saved opt-in state. New users always start OFF.
 */
const getSettingsKey = (): string | null => {
    const uid = getFirebaseAuth()?.currentUser?.uid;
    if (!uid) return null;
    return `@afetnet:health_sharing_enabled:${uid}`;
};

export interface HealthSOSData {
    initials: string;
    bloodType: string;
    allergies: string[];
    conditions: string[];
    medications: string[];
    deviceId: string;
    timestamp: number;
    distance?: number; // Estimated distance in meters
}

class EmergencyHealthSharingService {
    private isEnabled: boolean = false;
    private isBroadcasting: boolean = false;
    private broadcastInterval: NodeJS.Timeout | null = null;
    private deviceId: string = '';
    private meshService: any = null;

    // P0-2: Allowlist of peer IDs (deviceId or uid) that have explicitly
    // acknowledged the active SOS as a rescuer. Populated by addRescuerPeer()
    // when a rescue ACK is observed. Cleared on stopBroadcast().
    private rescuerAllowlist: Set<string> = new Set();

    // Listeners for received health SOS data
    private listeners: Set<(data: HealthSOSData) => void> = new Set();

    /**
     * Initialize the service
     */
    async initialize(): Promise<void> {
        try {
            // H9: fail-closed — no UID = no sharing. Avoids cross-account leak
            // through the legacy 'anonymous' bucket.
            const settingsKey = getSettingsKey();
            const enabled = settingsKey ? DirectStorage.getString(settingsKey) : null;
            this.isEnabled = enabled === 'true';

            // Get device ID
            this.deviceId = await getDeviceId();

            // Try to get mesh service
            try {
                const { meshNetworkService } = await import('./mesh/MeshNetworkService');
                this.meshService = meshNetworkService;
            } catch {
                logger.debug('Mesh service not available for health sharing');
            }

            logger.info('EmergencyHealthSharingService initialized', { enabled: this.isEnabled });
        } catch (error) {
            logger.error('Failed to initialize EmergencyHealthSharingService:', error);
        }
    }

    /**
     * Check if health sharing is enabled by user
     */
    isHealthSharingEnabled(): boolean {
        return this.isEnabled;
    }

    /**
     * Enable/disable health sharing
     */
    async setEnabled(enabled: boolean): Promise<void> {
        // H9: if no UID, persist nothing — toggle remains in-memory only and
        // resets on app restart. We never write to the anonymous bucket.
        const settingsKey = getSettingsKey();
        this.isEnabled = enabled;
        if (settingsKey) {
            DirectStorage.setString(settingsKey, enabled ? 'true' : 'false');
        } else {
            logger.warn('Health sharing toggle requested without auth — in-memory only');
        }
        logger.info('Health sharing preference updated:', { enabled, persisted: !!settingsKey });
    }

    /**
     * Start broadcasting health data (called when SOS is activated).
     *
     * P0-2: This no longer performs an unfiltered BLE mesh broadcast.
     * The interval below scans the allowlist (family + rescuer ACKs) and
     * sends DIRECTED health packets only to authorised peers. If no peer
     * qualifies, nothing leaves the device — silence is the safe default.
     */
    async startBroadcast(): Promise<void> {
        if (!this.isEnabled) {
            logger.info('Health sharing disabled, skipping broadcast');
            return;
        }

        if (this.isBroadcasting) {
            logger.debug('Already broadcasting health data');
            return;
        }

        try {
            // Get health profile
            const { useHealthProfileStore } = await import('../stores/healthProfileStore');
            const profile = useHealthProfileStore.getState().profile;

            if (!profile) {
                logger.warn('No health profile to broadcast');
                return;
            }

            // Create initials from name
            const initials = this.createInitials(profile.firstName, profile.lastName);

            // Prepare minimal health data
            const healthData = {
                initials,
                bloodType: profile.bloodType || '',
                allergies: profile.allergies || [],
                conditions: profile.chronicConditions || [],
                medications: profile.medications || [],
            };

            this.isBroadcasting = true;

            // P0-2: send to currently authorised peers immediately
            await this.sendHealthToAuthorisedPeers(healthData);

            // Re-evaluate every 30s — new family members may come into range
            // and new rescue ACKs may arrive while SOS is active.
            this.broadcastInterval = setInterval(async () => {
                try { await this.sendHealthToAuthorisedPeers(healthData); } catch (e) { if (__DEV__) logger.debug('Health directed-send error:', e); }
            }, 30000);

            logger.info('Started gated health data sharing (family + rescue-ACK allowlist)', {
                bloodType: healthData.bloodType,
                allergyCount: healthData.allergies.length
            });
        } catch (error) {
            logger.error('Failed to start health broadcast:', error);
        }
    }

    /**
     * Stop broadcasting health data (called when SOS is cancelled)
     */
    async stopBroadcast(): Promise<void> {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
        this.isBroadcasting = false;
        // P0-2: clear the rescuer allowlist when SOS ends.
        this.rescuerAllowlist.clear();
        logger.info('Stopped health data broadcast');
    }

    /**
     * P0-2: Register a peer (by deviceId or uid) as an approved rescuer.
     * Called when a rescue ACK is observed for the user's active SOS signal.
     * The peer is then eligible to receive directed HEALTH_SOS packets.
     */
    addRescuerPeer(peerId: string): void {
        const id = (peerId || '').trim();
        if (!id) return;
        this.rescuerAllowlist.add(id);
        logger.info('Health sharing: rescuer added to allowlist', { peerIdSuffix: id.slice(-6) });
    }

    /**
     * P0-2: Privacy gate — is `peerId` (deviceId or uid) entitled to receive
     * this user's health data right now?
     *  (a) Mutual-approved family member, OR
     *  (b) Sent rescue ACK for the active SOS (allowlist)
     */
    async shouldShareWith(peerId: string): Promise<boolean> {
        const id = (peerId || '').trim();
        if (!id) return false;

        // (b) Rescuer allowlist — cheap check first.
        if (this.rescuerAllowlist.has(id)) return true;

        // (a) Mutual family — look up by uid OR deviceId.
        try {
            const { useFamilyStore } = await import('../stores/familyStore');
            const members = useFamilyStore.getState().members.filter(isApprovedFamilyMember);
            const match = members.find(m => m.uid === id || m.deviceId === id);
            if (match) return true;
        } catch (e) {
            // If family store is unavailable, do NOT fall through to permissive
            // broadcast — KVKK requires fail-closed behaviour for sensitive data.
            if (__DEV__) logger.debug('Health shouldShareWith: family store read failed', e);
        }

        return false;
    }

    /**
     * Check if currently broadcasting
     */
    isBroadcastingHealth(): boolean {
        return this.isBroadcasting;
    }

    /**
     * Add listener for received health SOS data
     */
    addListener(callback: (data: HealthSOSData) => void): () => void {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    /**
     * Handle received HEALTH_SOS packet from mesh network
     */
    handleReceivedPacket(sourceId: string, payload: Buffer, rssi?: number): void {
        try {
            const parsed = MeshProtocol.parseHealthSOSPayload(payload);
            if (!parsed) {
                logger.warn('Failed to parse health SOS payload');
                return;
            }

            // Estimate distance from RSSI if available
            const distance = rssi ? this.estimateDistance(rssi) : undefined;

            const healthData: HealthSOSData = {
                ...parsed,
                deviceId: sourceId,
                timestamp: Date.now(),
                distance,
            };

            // Notify all listeners
            this.listeners.forEach(listener => {
                try {
                    listener(healthData);
                } catch (e) {
                    logger.error('Health listener error:', e);
                }
            });

            logger.info('Received health SOS data', {
                initials: parsed.initials,
                bloodType: parsed.bloodType,
                distance,
            });
        } catch (error) {
            logger.error('Error handling health SOS packet:', error);
        }
    }

    // =========================================================================
    // PRIVATE METHODS
    // =========================================================================

    /**
     * P0-2: Send a health packet ONLY to peers on the allowlist.
     *
     * Implementation note: We still serialize a single HEALTH_SOS packet,
     * but we resolve the set of authorised peers first and only send to
     * those. If the underlying mesh transport doesn't expose a directed
     * `sendToPeer(packetId, peerId)` API, we fall back to building a
     * recipientId-tagged payload and rely on receivers to drop packets
     * whose recipientId does not match their own deviceId/uid. Either way,
     * the unauthorised majority will not surface this data to a UI.
     */
    private async sendHealthToAuthorisedPeers(healthData: {
        initials: string;
        bloodType: string;
        allergies: string[];
        conditions: string[];
        medications: string[];
    }): Promise<void> {
        if (!this.meshService) {
            if (__DEV__) logger.debug('Mesh service not available for health share');
            return;
        }

        // Resolve the union of authorised peers (family + rescuer allowlist).
        let authorisedPeerIds: string[] = [];
        try {
            const { useFamilyStore } = await import('../stores/familyStore');
            const members = useFamilyStore.getState().members.filter(isApprovedFamilyMember);
            for (const m of members) {
                if (m.uid) authorisedPeerIds.push(m.uid);
                if (m.deviceId) authorisedPeerIds.push(m.deviceId);
            }
        } catch (e) {
            if (__DEV__) logger.debug('Health share: family store unavailable', e);
        }
        for (const id of this.rescuerAllowlist) authorisedPeerIds.push(id);
        // Dedup
        authorisedPeerIds = Array.from(new Set(authorisedPeerIds.filter(Boolean)));

        if (authorisedPeerIds.length === 0) {
            // KVKK fail-closed: no authorised peer => no send.
            if (__DEV__) logger.debug('Health share: no authorised peers in range — nothing sent');
            return;
        }

        try {
            const payload = MeshProtocol.createHealthSOSPayload(
                healthData.initials,
                healthData.bloodType,
                healthData.allergies,
                healthData.conditions,
                healthData.medications
            );

            const packet = MeshProtocol.serialize(
                MeshMessageType.HEALTH_SOS,
                this.deviceId,
                payload,
                3, // TTL: 3 hops
                100 // High Q-Score for emergency
            );

            // SECURITY (KVKK md.6 — özel nitelikli sağlık verisi): Sağlık paketi
            // YALNIZCA yönlendirilmiş (directed) peer transport ile gönderilir.
            // broadcastPacket fallback'i KALDIRILDI: broadcastPacket gated/recipientIds
            // parametrelerini uygulamıyordu, bu yüzden sağlık verisi (kan grubu, alerji,
            // ilaç) BLE menzilindeki TÜM cihazlara sızıyordu. Directed transport yoksa
            // fail-closed davranır — hiç gönderme.
            const meshAny = this.meshService as {
                sendToPeer?: (peerId: string, packet: Buffer) => Promise<void>;
            };
            if (typeof meshAny.sendToPeer !== 'function') {
                logger.warn('Health share: yönlendirilmiş peer transport yok — sağlık verisi gönderilmedi (fail-closed)');
                return;
            }
            for (const peerId of authorisedPeerIds) {
                try { await meshAny.sendToPeer(peerId, packet); }
                catch (e) { if (__DEV__) logger.debug('Health directed-send peer failed', { peerId: peerId.slice(-6), e }); }
            }

            if (__DEV__) logger.debug('Health SOS packet sent to authorised peers', { count: authorisedPeerIds.length });
        } catch (error) {
            logger.error('Failed to send health packet:', error);
        }
    }

    private createInitials(firstName?: string, lastName?: string): string {
        const first = (firstName || 'X')[0].toUpperCase();
        const last = (lastName || 'X')[0].toUpperCase();
        return `${first}${last}`;
    }

    private estimateDistance(rssi: number): number {
        // Simple RSSI to distance estimation
        // RSSI at 1m is typically around -50 to -60 dBm
        const txPower = -59; // Assumed TX power at 1m
        const ratio = rssi / txPower;

        if (ratio < 1.0) {
            return Math.pow(ratio, 10);
        }

        const distance = 0.89976 * Math.pow(ratio, 7.7095) + 0.111;
        return Math.round(distance);
    }
}

// Singleton instance
export const emergencyHealthSharingService = new EmergencyHealthSharingService();
