/**
 * INSTALLATION ID UTILITY — ELITE
 * Generates and persists a stable installation identifier.
 * 
 * Unlike deviceId (which may change across reinstalls), installationId
 * survives within a single app installation. Used as the key for
 * push_tokens/{uid}/devices/{installationId}.
 * 
 * Priority: SecureStore (survives updates) > AsyncStorage > generate new
 */

import * as SecureStore from 'expo-secure-store';
import { DirectStorage } from '../core/utils/storage';
import * as Crypto from 'expo-crypto';
import { createLogger } from '../core/utils/logger';

const logger = createLogger('InstallationId');

const INSTALLATION_ID_KEY = '@afetnet:installation_id_v1';
const INSTALLATION_ID_SECURE_KEY = 'afetnet_installation_id';

let cachedInstallationId: string | null = null;

/**
 * Generate a random installation ID: inst-{16 hex chars}
 */
async function generateInstallationId(): Promise<string> {
    try {
        const bytes = await Crypto.getRandomBytesAsync(8); // 64 bits
        const hex = Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        return `inst-${hex}`;
    } catch {
        // Fallback
        const ts = Date.now().toString(36);
        const rand = Math.random().toString(36).substring(2, 10);
        return `inst-${ts}${rand}`.substring(0, 21);
    }
}

/**
 * Get or create a stable installation ID.
 * This ID persists across app updates but resets on reinstall.
 */
export async function getInstallationId(): Promise<string> {
    if (cachedInstallationId) return cachedInstallationId;

    try {
        // 1. Try SecureStore (survives app updates)
        try {
            const secureId = await SecureStore.getItemAsync(INSTALLATION_ID_SECURE_KEY);
            if (secureId && secureId.startsWith('inst-')) {
                cachedInstallationId = secureId;
                return secureId;
            }
        } catch {
            // SecureStore unavailable (Expo Go, simulator) — fall through
        }

        // 2. Try DirectStorage fallback
        const asyncId = DirectStorage.getString(INSTALLATION_ID_KEY);
        if (asyncId && asyncId.startsWith('inst-')) {
            cachedInstallationId = asyncId;
            // Replicate to SecureStore for durability
            try {
                await SecureStore.setItemAsync(INSTALLATION_ID_SECURE_KEY, asyncId);
            } catch { /* best-effort */ }
            return asyncId;
        }

        // 3. Generate new
        const newId = await generateInstallationId();

        try {
            await SecureStore.setItemAsync(INSTALLATION_ID_SECURE_KEY, newId);
        } catch { /* best-effort */ }
        DirectStorage.setString(INSTALLATION_ID_KEY, newId);

        cachedInstallationId = newId;
        logger.info(`🆔 New installation ID generated: ${newId}`);
        return newId;
    } catch (error) {
        logger.error('Installation ID error:', error);
        const fallback = await generateInstallationId();
        cachedInstallationId = fallback;
        return fallback;
    }
}

/**
 * Clear installation ID (for account deletion/full reset)
 */
export async function clearInstallationId(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(INSTALLATION_ID_SECURE_KEY);
    } catch { /* best-effort */ }
    try {
        DirectStorage.delete(INSTALLATION_ID_KEY);
    } catch { /* best-effort */ }
    cachedInstallationId = null;
    logger.info('🗑️ Installation ID cleared');
}
