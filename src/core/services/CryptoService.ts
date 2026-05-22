/**
 * CRYPTO SERVICE - ELITE EDITION V3
 * React Native Compatible End-to-End Encryption
 * 
 * SECURITY FEATURES:
 * - Key pair generation using expo-crypto
 * - Secure key storage (expo-secure-store)
 * - HMAC-based signatures
 * - Compatible with React Native / Expo
 * 
 * NOTE: Uses expo-crypto as the primary cryptography provider
 * since libsodium-wrappers is not compatible with React Native.
 * 
 * @author Elite Messaging System
 */

import * as SecureStore from 'expo-secure-store';
import { DirectStorage } from '../utils/storage';
import { createLogger } from '../utils/logger';
import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import * as ExpoCrypto from 'expo-crypto';
// SECURITY FIX: Use tweetnacl for real cryptographic operations
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { getFirebaseAuth } from '../../lib/firebase';

const logger = createLogger('CryptoService');

// Storage keys — user-scoped to prevent cross-account key sharing.
// görev #29 ITEM 4: fail-closed — returns null when no UID is available.
// The '|| default' fallback is removed: during an auth-restore race it would
// scope keys to 'afetnet_crypto_*_default', allowing user B on the same device
// to load user A's private keys. All callers skip key ops when the key is null.
let _cryptoServiceInitUid = '';
const getUidSuffix = (): string | null =>
    _cryptoServiceInitUid || getFirebaseAuth()?.currentUser?.uid || null;
const getPrivateKeyStorage = (): string | null => { const u = getUidSuffix(); return u ? `afetnet_crypto_private_key_${u}` : null; };
const getPublicKeyStorage = (): string | null => { const u = getUidSuffix(); return u ? `afetnet_crypto_public_key_${u}` : null; };
const getSignPrivateKeyStorage = (): string | null => { const u = getUidSuffix(); return u ? `afetnet_crypto_sign_private_key_${u}` : null; };
const getSignPublicKeyStorage = (): string | null => { const u = getUidSuffix(); return u ? `afetnet_crypto_sign_public_key_${u}` : null; };
const getKnownKeysStorage = (): string | null => { const u = getUidSuffix(); return u ? `@afetnet:crypto_known_keys_v2:${u}` : null; };

// ELITE: Key pair interface (for encryption)
export interface EncryptionKeyPair {
    publicKey: string;  // Base64 encoded
    privateKey: string; // Base64 encoded
    createdAt: number;
}

// ELITE: Signing key pair interface
export interface SigningKeyPair {
    publicKey: string;
    privateKey: string;
    createdAt: number;
}

// ELITE: Encrypted message format
export interface EncryptedMessage {
    ciphertext: string;       // Base64 encoded
    nonce: string;            // Base64 encoded
    senderPublicKey: string;  // Base64 encoded sender's public key
    timestamp: number;
    signature: string;        // HMAC signature of ciphertext
}

// ELITE: Known public keys storage
export interface KnownPublicKey {
    userId: string;
    encryptionPublicKey: string;
    signingPublicKey?: string;
    addedAt: number;
    verified: boolean;
    fingerprint: string; // SHA256 hash for verification
}

// ELITE: Check if secure storage is available
const isSecureStoreAvailable = async (): Promise<boolean> => {
    try {
        // SecureStore not available in Expo Go or simulator on some platforms
        if (Platform.OS === 'web') return false;
        await SecureStore.isAvailableAsync();
        return true;
    } catch {
        return false;
    }
};

class CryptoService {
    private encryptionKeyPair: EncryptionKeyPair | null = null;
    private signingKeyPair: SigningKeyPair | null = null;
    private knownPublicKeys: Map<string, KnownPublicKey> = new Map();
    private isInitialized = false;
    private useSecureStorage = false;

    /**
     * Initialize the crypto service with expo-crypto
     */
    async initialize(): Promise<boolean> {
        if (this.isInitialized) return true;

        try {
            // Wait briefly for auth if not available (prevents 'default' key scope race)
            let uid = getFirebaseAuth()?.currentUser?.uid;
            if (!uid) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                uid = getFirebaseAuth()?.currentUser?.uid;
            }
            if (!uid) {
                logger.warn('CryptoService: no auth UID — deferring initialization');
                return false;
            }
            _cryptoServiceInitUid = uid;
            logger.info('Initializing CryptoService with expo-crypto');

            // 1. Check if secure storage is available
            this.useSecureStorage = await isSecureStoreAvailable();
            logger.info(`Secure storage: ${this.useSecureStorage ? 'enabled' : 'fallback to AsyncStorage'}`);

            // 2. Load or generate encryption key pair
            // görev #29 ITEM 4: null-guard — skip load if UID not yet available
            const _encPrivKey = getPrivateKeyStorage();
            const _encPubKey = getPublicKeyStorage();
            const storedEncKey = _encPrivKey ? await this.loadSecurely(_encPrivKey) : null;
            const storedEncPubKey = _encPubKey ? await this.loadSecurely(_encPubKey) : null;

            if (storedEncKey && storedEncPubKey) {
                this.encryptionKeyPair = {
                    privateKey: storedEncKey,
                    publicKey: storedEncPubKey,
                    createdAt: Date.now(),
                };
                logger.info('Loaded existing encryption key pair');
            } else {
                await this.generateEncryptionKeyPair();
                logger.info('Generated new encryption key pair');
            }

            // 3. Load or generate signing key pair
            // görev #29 ITEM 4: null-guard — skip load if UID not yet available
            const _signPrivKey = getSignPrivateKeyStorage();
            const _signPubKey = getSignPublicKeyStorage();
            const storedSignKey = _signPrivKey ? await this.loadSecurely(_signPrivKey) : null;
            const storedSignPubKey = _signPubKey ? await this.loadSecurely(_signPubKey) : null;

            if (storedSignKey && storedSignPubKey) {
                this.signingKeyPair = {
                    privateKey: storedSignKey,
                    publicKey: storedSignPubKey,
                    createdAt: Date.now(),
                };
                logger.info('Loaded existing signing key pair');
            } else {
                await this.generateSigningKeyPair();
                logger.info('Generated new signing key pair');
            }

            // 4. Load known public keys
            await this.loadKnownPublicKeys();

            this.isInitialized = true;
            logger.info('🔐 CryptoService V3 (expo-crypto) initialized');
            return true;
        } catch (error) {
            logger.error('CryptoService initialization failed:', error);
            // Still mark as initialized so app can run
            this.isInitialized = true;
            return false;
        }
    }

    /**
     * Generate a new encryption key pair using expo-crypto
     */
    async generateEncryptionKeyPair(): Promise<EncryptionKeyPair> {
        // SECURITY FIX: Use nacl.box.keyPair for real Curve25519 ECDH key pair
        const keyPair = nacl.box.keyPair();

        this.encryptionKeyPair = {
            publicKey: naclUtil.encodeBase64(keyPair.publicKey),
            privateKey: naclUtil.encodeBase64(keyPair.secretKey),
            createdAt: Date.now(),
        };

        // Store securely — private key sensitive (SecureStore zorunlu)
        // görev #29 ITEM 4: null-guard — skip persist if no UID available
        const _storePriv = getPrivateKeyStorage();
        const _storePub = getPublicKeyStorage();
        if (_storePriv) await this.storeSecurely(_storePriv, this.encryptionKeyPair.privateKey, true);
        if (_storePub) await this.storeSecurely(_storePub, this.encryptionKeyPair.publicKey);

        return this.encryptionKeyPair;
    }

    /**
     * Generate a new signing key pair using expo-crypto
     */
    async generateSigningKeyPair(): Promise<SigningKeyPair> {
        // SECURITY FIX: Use nacl.sign.keyPair for real Ed25519 signing key pair
        const keyPair = nacl.sign.keyPair();

        this.signingKeyPair = {
            publicKey: naclUtil.encodeBase64(keyPair.publicKey),
            privateKey: naclUtil.encodeBase64(keyPair.secretKey),
            createdAt: Date.now(),
        };

        // Store securely — signing private key sensitive (SecureStore zorunlu)
        // görev #29 ITEM 4: null-guard — skip persist if no UID available
        const _storeSignPriv = getSignPrivateKeyStorage();
        const _storeSignPub = getSignPublicKeyStorage();
        if (_storeSignPriv) await this.storeSecurely(_storeSignPriv, this.signingKeyPair.privateKey, true);
        if (_storeSignPub) await this.storeSecurely(_storeSignPub, this.signingKeyPair.publicKey);

        return this.signingKeyPair;
    }

    /**
     * Get my public keys for sharing
     */
    getMyPublicKeys(): { encryption: string | null; signing: string | null } {
        return {
            encryption: this.encryptionKeyPair?.publicKey || null,
            signing: this.signingKeyPair?.publicKey || null,
        };
    }

    /**
     * Get my encryption public key (for compatibility)
     */
    getMyPublicKey(): string | null {
        return this.encryptionKeyPair?.publicKey || null;
    }

    /**
     * Generate key fingerprint for verification using SHA256
     */
    async generateFingerprint(publicKey: string): Promise<string> {
        const hash = await ExpoCrypto.digestStringAsync(
            ExpoCrypto.CryptoDigestAlgorithm.SHA256,
            publicKey
        );
        return hash.substring(0, 16).toUpperCase();
    }

    /**
     * Add a known public key for a user
     */
    async addPublicKey(
        userId: string,
        encryptionPublicKey: string,
        signingPublicKey?: string,
        verified = false
    ): Promise<void> {
        const fingerprint = await this.generateFingerprint(encryptionPublicKey);

        this.knownPublicKeys.set(userId, {
            userId,
            encryptionPublicKey,
            signingPublicKey,
            addedAt: Date.now(),
            verified,
            fingerprint,
        });

        await this.saveKnownPublicKeys();
        logger.info(`Added public key for user: ${userId} (fingerprint: ${fingerprint})`);
    }

    /**
     * Get public key for a user
     */
    getPublicKey(userId: string): string | null {
        return this.knownPublicKeys.get(userId)?.encryptionPublicKey || null;
    }

    /**
     * Get known public key details
     */
    getKnownPublicKey(userId: string): KnownPublicKey | undefined {
        return this.knownPublicKeys.get(userId);
    }

    /**
     * Get all known public keys
     */
    getAllKnownPublicKeys(): KnownPublicKey[] {
        return Array.from(this.knownPublicKeys.values());
    }

    /**
     * SECURITY FIX: Authenticated encryption using nacl.box (Curve25519 + XSalsa20-Poly1305)
     * Replaces broken XOR cipher with real public-key authenticated encryption.
     */
    async encryptMessage(
        message: string,
        recipientPublicKey: string
    ): Promise<EncryptedMessage> {
        if (!this.encryptionKeyPair || !this.signingKeyPair) {
            throw new Error('Keys not initialized');
        }

        const messageBytes = naclUtil.decodeUTF8(message);
        const nonce = nacl.randomBytes(nacl.box.nonceLength);

        // Real Curve25519 ECDH + XSalsa20-Poly1305 authenticated encryption
        const mySecretKey = naclUtil.decodeBase64(this.encryptionKeyPair.privateKey);
        const theirPublicKey = naclUtil.decodeBase64(recipientPublicKey);
        const encrypted = nacl.box(messageBytes, nonce, theirPublicKey, mySecretKey);

        if (!encrypted) {
            throw new Error('Encryption failed');
        }

        const ciphertext = naclUtil.encodeBase64(encrypted);
        const nonceB64 = naclUtil.encodeBase64(nonce);

        // Real Ed25519 digital signature
        const signingKey = naclUtil.decodeBase64(this.signingKeyPair.privateKey);
        const signatureData = naclUtil.decodeUTF8(`${ciphertext}:${nonceB64}:${Date.now()}`);
        const signatureBytes = nacl.sign.detached(signatureData, signingKey);
        const signature = naclUtil.encodeBase64(signatureBytes);

        return {
            ciphertext,
            nonce: nonceB64,
            senderPublicKey: this.encryptionKeyPair.publicKey,
            timestamp: Date.now(),
            signature,
        };
    }

    /**
     * SECURITY FIX: Authenticated decryption using nacl.box.open (Curve25519 + XSalsa20-Poly1305)
     */
    async decryptMessage(
        encryptedMessage: EncryptedMessage
    ): Promise<string> {
        if (!this.encryptionKeyPair) {
            throw new Error('Keys not initialized');
        }

        const ciphertextBytes = naclUtil.decodeBase64(encryptedMessage.ciphertext);
        const nonce = naclUtil.decodeBase64(encryptedMessage.nonce);
        const mySecretKey = naclUtil.decodeBase64(this.encryptionKeyPair.privateKey);
        const senderPublicKey = naclUtil.decodeBase64(encryptedMessage.senderPublicKey);

        // Real authenticated decryption
        const decrypted = nacl.box.open(ciphertextBytes, nonce, senderPublicKey, mySecretKey);

        if (!decrypted) {
            throw new Error('Decryption failed — message tampered or wrong key');
        }

        return naclUtil.encodeUTF8(decrypted);
    }

    /**
     * SECURITY FIX: Real Ed25519 digital signature using nacl.sign.detached
     */
    async signMessage(message: string): Promise<string> {
        if (!this.signingKeyPair) {
            throw new Error('Signing key not initialized');
        }

        const messageBytes = naclUtil.decodeUTF8(message);
        const secretKey = naclUtil.decodeBase64(this.signingKeyPair.privateKey);
        const signatureBytes = nacl.sign.detached(messageBytes, secretKey);
        return naclUtil.encodeBase64(signatureBytes);
    }

    /**
     * SECURITY FIX: Real Ed25519 signature verification using nacl.sign.detached.verify
     * Can now verify ANY user's signature (not just our own) given their public key.
     */
    async verifySignature(
        message: string,
        signature: string,
        signerPublicKey: string
    ): Promise<boolean> {
        try {
            const messageBytes = naclUtil.decodeUTF8(message);
            const signatureBytes = naclUtil.decodeBase64(signature);
            const publicKeyBytes = naclUtil.decodeBase64(signerPublicKey);
            return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
        } catch (error) {
            logger.warn('Signature verification failed:', error);
            return false;
        }
    }

    /**
     * Generate a cryptographically secure UUID (RFC4122 v4).
     *
     * H5/H6 hardening: previously the variant nibble (`[8,9,a,b]`) was selected
     * with Math.random — that leaked entropy in exactly the bits callers later
     * treat as a high-uniqueness fingerprint. Now we apply the RFC bitmask
     * directly to the CSPRNG bytes per RFC4122 §4.4:
     *   - byte 6: high-nibble = 0100 (version 4)
     *   - byte 8: high-bits  = 10xx  (variant 10)
     */
    generateUUID(): string {
        const bytes = ExpoCrypto.getRandomBytes(16);
        bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
        bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
        const hex = Buffer.from(bytes).toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }

    /**
     * Hash a password using SHA256 with salt
     */
    async hashPassword(password: string): Promise<string> {
        const saltBytes = ExpoCrypto.getRandomBytes(16);
        const salt = Buffer.from(saltBytes).toString('hex');

        // Multiple rounds of hashing for key stretching
        let hash = password + salt;
        for (let i = 0; i < 10000; i++) {
            hash = await ExpoCrypto.digestStringAsync(
                ExpoCrypto.CryptoDigestAlgorithm.SHA256,
                hash
            );
        }

        return `${salt}:${hash}`;
    }

    /**
     * Verify a password against a hash
     */
    async verifyPassword(password: string, storedHash: string): Promise<boolean> {
        const [salt, expectedHash] = storedHash.split(':');
        if (!salt || !expectedHash) return false;

        let hash = password + salt;
        for (let i = 0; i < 10000; i++) {
            hash = await ExpoCrypto.digestStringAsync(
                ExpoCrypto.CryptoDigestAlgorithm.SHA256,
                hash
            );
        }

        return hash === expectedHash;
    }

    // ==================== PRIVATE HELPERS ====================

    /**
     * Store data securely. Hassas veri (private key) yalnızca SecureStore
     * (Keychain/Keystore) ile saklanır; SecureStore yoksa düz depoya yazmak
     * yerine hata fırlatır — E2EE devre dışı kalır ama anahtar açığa çıkmaz.
     * Hassas olmayan veri (public key) SecureStore yoksa DirectStorage'a düşebilir.
     */
    private async storeSecurely(key: string, value: string, sensitive = false): Promise<void> {
        try {
            if (this.useSecureStorage) {
                await SecureStore.setItemAsync(key, value);
            } else if (sensitive) {
                // SECURITY (P0): Güvenli depolama yoksa private key ASLA düz MMKV'ye
                // yazılmaz — cihaz ele geçirilse şifreli mesajların anahtarı sızardı.
                logger.error(`Secure storage unavailable — '${key}' düz metin olarak yazılmadı (E2EE devre dışı)`);
                throw new Error('SECURE_STORAGE_UNAVAILABLE');
            } else {
                DirectStorage.setString(key, value);
            }
        } catch (error) {
            logger.error(`Failed to store ${key}:`, error);
            throw error;
        }
    }

    /**
     * Load data securely
     */
    private async loadSecurely(key: string): Promise<string | null> {
        try {
            if (this.useSecureStorage) {
                return await SecureStore.getItemAsync(key);
            } else {
                return DirectStorage.getString(key) ?? null;
            }
        } catch (error) {
            logger.error(`Failed to load ${key}:`, error);
            return null;
        }
    }

    /**
     * Save known public keys to storage
     */
    private async saveKnownPublicKeys(): Promise<void> {
        try {
            // görev #29 ITEM 4: null-guard — skip persist if no UID
            const _knownKey = getKnownKeysStorage();
            if (!_knownKey) { logger.warn('saveKnownPublicKeys: no UID — skipping persist'); return; }
            const data = JSON.stringify(Array.from(this.knownPublicKeys.entries()));
            DirectStorage.setString(_knownKey, data);
        } catch (error) {
            logger.error('Failed to save known public keys:', error);
        }
    }

    /**
     * Load known public keys from storage
     */
    private async loadKnownPublicKeys(): Promise<void> {
        try {
            // görev #29 ITEM 4: null-guard — skip if no UID
            const _knownKey2 = getKnownKeysStorage();
            if (!_knownKey2) { logger.warn('loadKnownPublicKeys: no UID — skipping load'); return; }
            const data = DirectStorage.getString(_knownKey2) ?? null;
            if (data) {
                const entries = JSON.parse(data) as [string, KnownPublicKey][];
                this.knownPublicKeys = new Map(entries);
                logger.info(`Loaded ${this.knownPublicKeys.size} known public keys`);
            }
        } catch (error) {
            logger.error('Failed to load known public keys:', error);
        }
    }

    /**
     * Clear all keys (for testing/reset)
     */
    async clearAllKeys(): Promise<void> {
        this.encryptionKeyPair = null;
        this.signingKeyPair = null;
        this.knownPublicKeys.clear();

        // görev #29 ITEM 4: filter nulls — key-getters return null when no UID
        const keysToRemove = [
            getPrivateKeyStorage(),
            getPublicKeyStorage(),
            getSignPrivateKeyStorage(),
            getSignPublicKeyStorage(),
            getKnownKeysStorage(),
        ].filter((k): k is string => k !== null);

        for (const key of keysToRemove) {
            try {
                if (this.useSecureStorage) {
                    await SecureStore.deleteItemAsync(key);
                } else {
                    try { DirectStorage.delete(key); } catch { /* best effort */ }
                }
            } catch (error) {
                logger.warn(`Failed to remove ${key}:`, error);
            }
        }

        logger.info('Cleared all crypto keys');
    }

    /**
     * Export public keys for sharing
     */
    exportPublicKeys(): { encryption: string; signing: string } | null {
        if (!this.encryptionKeyPair || !this.signingKeyPair) {
            return null;
        }

        return {
            encryption: this.encryptionKeyPair.publicKey,
            signing: this.signingKeyPair.publicKey,
        };
    }

    /**
     * Check if crypto is initialized
     */
    isReady(): boolean {
        return this.isInitialized && !!this.encryptionKeyPair && !!this.signingKeyPair;
    }

    /**
     * Clear all crypto state and delete stored keys on logout
     */
    async destroy(): Promise<void> {
        const uid = _cryptoServiceInitUid || getFirebaseAuth()?.currentUser?.uid || '';
        this.encryptionKeyPair = null;
        this.signingKeyPair = null;
        this.knownPublicKeys.clear();
        this.isInitialized = false;

        // Delete stored keys from SecureStore (privacy: don't leave private keys on device)
        if (uid) {
            const keysToDelete = [
                `afetnet_crypto_private_key_${uid}`,
                `afetnet_crypto_public_key_${uid}`,
                `afetnet_crypto_sign_private_key_${uid}`,
                `afetnet_crypto_sign_public_key_${uid}`,
            ];
            for (const key of keysToDelete) {
                try { await SecureStore.deleteItemAsync(key); } catch { /* best effort */ }
            }
        }
        _cryptoServiceInitUid = '';
    }
}

// Export singleton instance
export const cryptoService = new CryptoService();
export default cryptoService;
