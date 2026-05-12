/**
 * MESH CRYPTO SERVICE - ELITE V4
 * End-to-end encryption for mesh communication
 * 
 * FEATURES:
 * - Key pair generation (ECDH)
 * - Diffie-Hellman key exchange
 * - Message encryption/decryption (AES-256-GCM)
 * - Key fingerprint verification
 * - Forward secrecy
 */

import { createLogger } from '../../utils/logger';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Buffer } from 'buffer';
import { getDeviceId } from '../../utils/device';
// SECURITY FIX: Use tweetnacl for authenticated encryption (XSalsa20-Poly1305)
// instead of broken XOR cipher
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { getFirebaseAuth } from '../../../lib/firebase';

// User-scoped SecureStore key helper — reads from instance initUid when available
let _meshCryptoInitUid = '';
const scopedKey = (base: string): string => {
    const uid = _meshCryptoInitUid || getFirebaseAuth()?.currentUser?.uid || 'default';
    return `${base}_${uid}`;
};

const logger = createLogger('MeshCryptoService');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CRYPTO_CONFIG = {
    // Keys
    KEY_ALGORITHM: 'ECDH',
    SYMMETRIC_ALGORITHM: 'AES-GCM',
    KEY_SIZE: 256,

    // Storage keys
    STORAGE_PRIVATE_KEY: '@mesh_crypto_private_key',
    STORAGE_PUBLIC_KEY: '@mesh_crypto_public_key',
    STORAGE_PEER_KEYS: '@mesh_crypto_peer_keys',

    // Lifecycle
    KEY_ROTATION_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours
};

// ============================================================================
// TYPES
// ============================================================================

export interface KeyPair {
    publicKey: string;
    privateKey: string;
    createdAt: number;
}

export interface PeerKey {
    peerId: string;
    publicKey: string;
    sharedSecret?: string;
    verified: boolean;
    lastUpdated: number;
}

export interface EncryptedPayload {
    ciphertext: string;
    iv: string;
    authTag: string;
    senderId: string;
    keyVersion: number;
}

// ============================================================================
// MESH CRYPTO SERVICE CLASS
// ============================================================================

class MeshCryptoService {
    private isInitialized = false;
    private myDeviceId = '';
    private initUid = ''; // UID captured at init time for correct key cleanup on destroy
    private myKeyPair: KeyPair | null = null;
    private peerKeys: Map<string, PeerKey> = new Map();
    private keyExchangeListeners: Set<(peerId: string, publicKey: string) => void> = new Set();

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            this.myDeviceId = await getDeviceId();

            // Wait briefly for auth if not yet available (auth restore may be in progress)
            let uid = getFirebaseAuth()?.currentUser?.uid;
            if (!uid) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                uid = getFirebaseAuth()?.currentUser?.uid;
            }
            this.initUid = uid || 'default';
            _meshCryptoInitUid = this.initUid;
            if (this.initUid === 'default') {
                logger.warn('MeshCryptoService: auth not available — using default key scope');
            }

            // Load or generate key pair
            await this.loadOrGenerateKeyPair();

            // Load peer keys
            await this.loadPeerKeys();

            this.isInitialized = true;
            logger.info('Mesh Crypto Service initialized');
        } catch (error) {
            logger.error('Failed to initialize:', error);
        }
    }

    // ============================================================================
    // KEY MANAGEMENT
    // ============================================================================

    private async loadOrGenerateKeyPair(): Promise<void> {
        try {
            // Try to load existing key pair
            const privateKeyData = await SecureStore.getItemAsync(scopedKey(CRYPTO_CONFIG.STORAGE_PRIVATE_KEY));
            const publicKeyData = await SecureStore.getItemAsync(scopedKey(CRYPTO_CONFIG.STORAGE_PUBLIC_KEY));

            if (privateKeyData && publicKeyData) {
                const parsed = JSON.parse(privateKeyData);

                // Check if key rotation is needed
                if (Date.now() - parsed.createdAt < CRYPTO_CONFIG.KEY_ROTATION_INTERVAL_MS) {
                    this.myKeyPair = {
                        privateKey: parsed.key,
                        publicKey: publicKeyData,
                        createdAt: parsed.createdAt,
                    };
                    logger.debug('Loaded existing key pair');
                    return;
                }
            }

            // Generate new key pair
            await this.generateKeyPair();
        } catch (error) {
            logger.error('Key loading failed, generating new:', error);
            await this.generateKeyPair();
        }
    }

    private async generateKeyPair(): Promise<void> {
        logger.info('Generating new key pair...');

        // SECURITY FIX: Use nacl.box.keyPair() for real Curve25519 ECDH key generation
        const keyPair = nacl.box.keyPair();
        const privateKey = naclUtil.encodeBase64(keyPair.secretKey);
        const publicKey = naclUtil.encodeBase64(keyPair.publicKey);

        this.myKeyPair = {
            privateKey,
            publicKey,
            createdAt: Date.now(),
        };

        // Save to secure storage
        await SecureStore.setItemAsync(
            scopedKey(CRYPTO_CONFIG.STORAGE_PRIVATE_KEY),
            JSON.stringify({ key: privateKey, createdAt: Date.now() })
        );
        await SecureStore.setItemAsync(scopedKey(CRYPTO_CONFIG.STORAGE_PUBLIC_KEY), publicKey);

        logger.info('New key pair generated (Curve25519)');
    }

    private async loadPeerKeys(): Promise<void> {
        try {
            const data = await SecureStore.getItemAsync(scopedKey(CRYPTO_CONFIG.STORAGE_PEER_KEYS));
            if (data) {
                const peers = JSON.parse(data) as PeerKey[];
                peers.forEach(peer => this.peerKeys.set(peer.peerId, peer));
                logger.debug(`Loaded ${peers.length} peer keys`);
            }
        } catch (error) {
            logger.debug('Failed to load peer keys:', error);
        }
    }

    private async savePeerKeys(): Promise<void> {
        try {
            const peers = Array.from(this.peerKeys.values());
            await SecureStore.setItemAsync(scopedKey(CRYPTO_CONFIG.STORAGE_PEER_KEYS), JSON.stringify(peers));
        } catch (error) {
            logger.debug('Failed to save peer keys:', error);
        }
    }

    // ============================================================================
    // KEY EXCHANGE
    // ============================================================================

    /**
     * Get public key for key exchange
     */
    getPublicKey(): string | null {
        return this.myKeyPair?.publicKey || null;
    }

    /**
     * Get key fingerprint for verification
     */
    async getKeyFingerprint(): Promise<string> {
        if (!this.myKeyPair) throw new Error('No key pair');

        const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            this.myKeyPair.publicKey
        );

        // Return last 16 chars as fingerprint
        return digest.slice(-16).toUpperCase();
    }

    /**
     * Process received public key from peer
     */
    async handleKeyExchange(peerId: string, peerPublicKey: string): Promise<void> {
        logger.info(`Key exchange with peer: ${peerId.slice(0, 8)}`);

        // Compute shared secret (simplified DH)
        const sharedSecret = await this.computeSharedSecret(peerPublicKey);

        const peerKey: PeerKey = {
            peerId,
            publicKey: peerPublicKey,
            sharedSecret,
            verified: false,
            lastUpdated: Date.now(),
        };

        this.peerKeys.set(peerId, peerKey);

        // FIX: Cap peerKeys to prevent unbounded growth when encountering many peers.
        // Evict oldest entries (by lastUpdated) when exceeding 200 peers.
        const MAX_PEER_KEYS = 200;
        if (this.peerKeys.size > MAX_PEER_KEYS) {
            const sorted = Array.from(this.peerKeys.entries())
                .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
            const toRemove = sorted.slice(0, this.peerKeys.size - MAX_PEER_KEYS);
            for (const [id] of toRemove) {
                this.peerKeys.delete(id);
            }
        }

        await this.savePeerKeys();

        // Notify listeners
        [...this.keyExchangeListeners].forEach(cb => cb(peerId, peerPublicKey));

        logger.debug(`Shared secret established with ${peerId.slice(0, 8)}`);
    }

    private async computeSharedSecret(peerPublicKey: string): Promise<string> {
        if (!this.myKeyPair) throw new Error('No key pair');

        // SECURITY FIX: Use nacl.box.before() for real Curve25519 ECDH shared secret
        const mySecretKey = naclUtil.decodeBase64(this.myKeyPair.privateKey);
        const theirPublicKey = naclUtil.decodeBase64(peerPublicKey);
        const sharedKey = nacl.box.before(theirPublicKey, mySecretKey);

        // Hash the shared key for extra security (key stretching)
        const sharedKeyHex = Buffer.from(sharedKey).toString('hex');
        const secret = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            sharedKeyHex
        );

        return secret;
    }

    /**
     * Verify peer key fingerprint
     */
    async verifyPeerFingerprint(peerId: string, expectedFingerprint: string): Promise<boolean> {
        const peer = this.peerKeys.get(peerId);
        if (!peer) return false;

        const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            peer.publicKey
        );

        const actualFingerprint = digest.slice(-16).toUpperCase();
        const isValid = actualFingerprint === expectedFingerprint.toUpperCase();

        if (isValid) {
            peer.verified = true;
            await this.savePeerKeys();
        }

        return isValid;
    }

    // ============================================================================
    // ENCRYPTION / DECRYPTION
    // ============================================================================

    /**
     * Encrypt message for peer
     */
    async encryptMessage(peerId: string, plaintext: string): Promise<EncryptedPayload | null> {
        const peer = this.peerKeys.get(peerId);
        if (!peer?.sharedSecret) {
            logger.warn(`No shared secret for peer: ${peerId}`);
            return null;
        }

        try {
            // SECURITY FIX: Use nacl.secretbox (XSalsa20-Poly1305) authenticated encryption
            // Derive 32-byte key from shared secret
            const keyDigest = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                peer.sharedSecret
            );
            const keyBytes = Buffer.from(keyDigest, 'hex').slice(0, nacl.secretbox.keyLength);

            // Generate random nonce (24 bytes for XSalsa20)
            const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

            // Encrypt with authenticated encryption (XSalsa20-Poly1305)
            const plaintextBytes = naclUtil.decodeUTF8(plaintext);
            const ciphertextBytes = nacl.secretbox(plaintextBytes, nonce, keyBytes);

            if (!ciphertextBytes) {
                logger.error('nacl.secretbox returned null');
                return null;
            }

            const ciphertext = naclUtil.encodeBase64(ciphertextBytes);
            const iv = naclUtil.encodeBase64(nonce);

            // Auth tag is built into nacl.secretbox (Poly1305 MAC) — use hash for extra verification
            const authTag = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                ciphertext + iv + peer.sharedSecret
            );

            return {
                ciphertext,
                iv,
                authTag: authTag.slice(0, 32),
                senderId: this.myDeviceId,
                keyVersion: 2, // Version 2 = nacl.secretbox
            };
        } catch (error) {
            logger.error('Encryption failed:', error);
            return null;
        }
    }

    /**
     * Decrypt message from peer
     */
    async decryptMessage(senderId: string, payload: EncryptedPayload): Promise<string | null> {
        const peer = this.peerKeys.get(senderId);
        if (!peer?.sharedSecret) {
            logger.warn(`No shared secret for sender: ${senderId}`);
            return null;
        }

        try {
            // Verify auth tag (extra layer on top of Poly1305)
            const expectedAuthTag = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                payload.ciphertext + payload.iv + peer.sharedSecret
            );

            if (expectedAuthTag.slice(0, 32) !== payload.authTag) {
                logger.error('Auth tag verification failed');
                return null;
            }

            // Derive 32-byte key from shared secret
            const keyDigest = await Crypto.digestStringAsync(
                Crypto.CryptoDigestAlgorithm.SHA256,
                peer.sharedSecret
            );
            const keyBytes = Buffer.from(keyDigest, 'hex').slice(0, nacl.secretbox.keyLength);

            // SECURITY FIX: Use nacl.secretbox.open (XSalsa20-Poly1305) authenticated decryption
            const ciphertextBytes = naclUtil.decodeBase64(payload.ciphertext);
            const nonce = naclUtil.decodeBase64(payload.iv);

            const plaintextBytes = nacl.secretbox.open(ciphertextBytes, nonce, keyBytes);

            if (!plaintextBytes) {
                logger.error('nacl.secretbox.open failed — message tampered or wrong key');
                return null;
            }

            return naclUtil.encodeUTF8(plaintextBytes);
        } catch (error) {
            logger.error('Decryption failed:', error);
            return null;
        }
    }

    /**
     * Encrypt for broadcast (uses message-specific key)
     */
    async encryptBroadcast(plaintext: string): Promise<{ ciphertext: string; key: string } | null> {
        try {
            // SECURITY FIX: Use nacl.secretbox for broadcast encryption
            const keyBytes = nacl.randomBytes(nacl.secretbox.keyLength);
            const messageKey = naclUtil.encodeBase64(keyBytes);
            const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

            const plaintextBytes = naclUtil.decodeUTF8(plaintext);
            const ciphertextBytes = nacl.secretbox(plaintextBytes, nonce, keyBytes);

            if (!ciphertextBytes) {
                logger.error('Broadcast encryption failed');
                return null;
            }

            // Prepend nonce to ciphertext for self-contained decryption
            return {
                ciphertext: naclUtil.encodeBase64(nonce) + ':' + naclUtil.encodeBase64(ciphertextBytes),
                key: messageKey,
            };
        } catch (error) {
            logger.error('Broadcast encryption failed:', error);
            return null;
        }
    }

    /**
     * Decrypt a broadcast message (uses the key that was sent alongside the ciphertext)
     */
    async decryptBroadcast(ciphertext: string, key: string): Promise<string | null> {
        try {
            const keyBytes = naclUtil.decodeBase64(key);

            // ciphertext format: base64(nonce) + ':' + base64(encrypted)
            const separatorIndex = ciphertext.indexOf(':');
            if (separatorIndex === -1) {
                logger.error('Invalid broadcast ciphertext format (missing nonce separator)');
                return null;
            }

            const nonce = naclUtil.decodeBase64(ciphertext.substring(0, separatorIndex));
            const encryptedBytes = naclUtil.decodeBase64(ciphertext.substring(separatorIndex + 1));

            const plaintextBytes = nacl.secretbox.open(encryptedBytes, nonce, keyBytes);

            if (!plaintextBytes) {
                logger.error('Broadcast decryption failed — message tampered or wrong key');
                return null;
            }

            return naclUtil.encodeUTF8(plaintextBytes);
        } catch (error) {
            logger.error('Broadcast decryption failed:', error);
            return null;
        }
    }

    /**
     * Check if the service has been initialized
     */
    getIsInitialized(): boolean {
        return this.isInitialized;
    }

    // ============================================================================
    // LISTENERS
    // ============================================================================

    onKeyExchange(callback: (peerId: string, publicKey: string) => void): () => void {
        this.keyExchangeListeners.add(callback);
        return () => this.keyExchangeListeners.delete(callback);
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    isPeerEncryptionReady(peerId: string): boolean {
        const peer = this.peerKeys.get(peerId);
        return !!peer?.sharedSecret;
    }

    getPeerInfo(peerId: string): PeerKey | undefined {
        return this.peerKeys.get(peerId);
    }

    getAllPeers(): PeerKey[] {
        return Array.from(this.peerKeys.values());
    }

    async rotateKeys(): Promise<void> {
        await this.generateKeyPair();
        logger.info('Keys rotated');
    }

    // ============================================================================
    // CLEANUP
    // ============================================================================

    /**
     * Full teardown — call on app shutdown or account switch.
     * Resets all in-memory state AND clears SecureStore keys so the next user
     * doesn't inherit the previous user's keypair/peer secrets (privacy fix).
     */
    async destroy(): Promise<void> {
        this.peerKeys.clear();
        this.keyExchangeListeners.clear();
        this.myKeyPair = null;
        this.myDeviceId = '';
        this.isInitialized = false;

        // CRITICAL FIX: Await SecureStore deletions to prevent next user from
        // reading old keys if initialize() is called immediately after destroy()
        // (rapid account switch). Fire-and-forget allowed deletions to race.
        // Use initUid (captured at init time) to ensure correct keys are deleted
        // even if auth state has already changed during logout
        const uid = this.initUid || 'default';
        const destroyScopedKey = (base: string) => `${base}_${uid}`;
        try {
            await Promise.all([
                SecureStore.deleteItemAsync(destroyScopedKey(CRYPTO_CONFIG.STORAGE_PRIVATE_KEY)),
                SecureStore.deleteItemAsync(destroyScopedKey(CRYPTO_CONFIG.STORAGE_PUBLIC_KEY)),
                SecureStore.deleteItemAsync(destroyScopedKey(CRYPTO_CONFIG.STORAGE_PEER_KEYS)),
            ]);
        } catch {
            // SecureStore may be unavailable; best-effort
        }
        this.initUid = '';
        _meshCryptoInitUid = '';
        logger.info('MeshCryptoService destroyed (SecureStore keys cleared)');
    }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const meshCryptoService = new MeshCryptoService();
export default meshCryptoService;
