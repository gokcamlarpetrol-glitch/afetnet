export const UID_REGEX = /^[A-Za-z0-9_.\-+:]{1,128}$/;

/**
 * Accept Firebase Auth UIDs from multiple providers:
 * - Standard Firebase UIDs (20-40 alnum)
 * - Phone-auth style IDs (+905...)
 * - Custom provider IDs that may include "-", "_", "."
 *
 * Explicitly rejects UUIDv4 hardware/device identifiers.
 */
export const isLikelyFirebaseUid = (value?: string | null): boolean => {
    const normalized = normalizeIdentityValue(value);
    if (!normalized || normalized.length < 5) return false;

    // Phone-auth like identifiers
    if (/^\+[1-9]\d{5,14}$/.test(normalized)) return true;

    // Common Firebase UID format
    if (/^[A-Za-z0-9]{20,40}$/.test(normalized)) return true;

    // Custom auth provider IDs with punctuation
    if (normalized.length >= 20 && /^[A-Za-z0-9\-_.]+$/.test(normalized)) {
        const isUuidV4 = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/.test(normalized);
        if (!isUuidV4) return true;
    }

    return false;
};

export const normalizeIdentityValue = (value?: string | null): string => {
    if (!value) return '';
    return value.trim();
};
