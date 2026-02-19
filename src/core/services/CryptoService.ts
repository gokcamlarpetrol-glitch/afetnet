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

const logger = createLogger('CryptoService');

// Storage keys
const PRIVATE_KEY_STORAGE = 'afetnet_crypto_private_key';
const PUBLIC_KEY_STORAGE = 'afetnet_crypto_public_key';
const SIGN_PRIVATE_KEY_STORAGE = 'afetnet_crypto_sign_private_key';
const SIGN_PUBLIC_KEY_STORAGE = 'afetnet_crypto_sign_public_key';
const KEY_PAIRS_STORAGE = '@afetnet:crypto_known_keys_v2';

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
            logger.info('Initializing CryptoService with expo-crypto');

            // 1. Check if secure storage is available
            this.useSecureStorage = await isSecureStoreAvailable();
            logger.info(`Secure storage: ${this.useSecureStorage ? 'enabled' : 'fallback to AsyncStorage'}`);

            // 2. Load or generate encryption key pair
            const storedEncKey = await this.loadSecurely(PRIVATE_KEY_STORAGE);
            const storedEncPubKey = await this.loadSecurely(PUBLIC_KEY_STORAGE);

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
            const storedSignKey = await this.loadSecurely(SIGN_PRIVATE_KEY_STORAGE);
            const storedSignPubKey = await this.loadSecurely(SIGN_PUBLIC_KEY_STORAGE);

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

        // Store securely
        await this.storeSecurely(PRIVATE_KEY_STORAGE, this.encryptionKeyPair.privateKey);
        await this.storeSecurely(PUBLIC_KEY_STORAGE, this.encryptionKeyPair.publicKey);

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

        // Store securely
        await this.storeSecurely(SIGN_PRIVATE_KEY_STORAGE, this.signingKeyPair.privateKey);
        await this.storeSecurely(SIGN_PUBLIC_KEY_STORAGE, this.signingKeyPair.publicKey);

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
     * Generate a cryptographically secure UUID
     */
    generateUUID(): string {
        const bytes = ExpoCrypto.getRandomBytes(16);
        const hex = Buffer.from(bytes).toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(12, 15)}-${['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)]}${hex.slice(15, 18)}-${hex.slice(18, 30)}`;
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
     * Store data securely (SecureStore or encrypted MMKV fallback)
     */
    private async storeSecurely(key: string, value: string): Promise<void> {
        try {
            if (this.useSecureStorage) {
                await SecureStore.setItemAsync(key, value);
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
            const data = JSON.stringify(Array.from(this.knownPublicKeys.entries()));
            DirectStorage.setString(KEY_PAIRS_STORAGE, data);
        } catch (error) {
            logger.error('Failed to save known public keys:', error);
        }
    }

    /**
     * Load known public keys from storage
     */
    private async loadKnownPublicKeys(): Promise<void> {
        try {
            const data = DirectStorage.getString(KEY_PAIRS_STORAGE) ?? null;
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

        const keysToRemove = [
            PRIVATE_KEY_STORAGE,
            PUBLIC_KEY_STORAGE,
            SIGN_PRIVATE_KEY_STORAGE,
            SIGN_PUBLIC_KEY_STORAGE,
            KEY_PAIRS_STORAGE,
        ];

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
}

// Export singleton instance
export const cryptoService = new CryptoService();
export default cryptoService;
