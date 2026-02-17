/**
 * DATE UTILITIES
 * Centralized functions for date and time formatting.
 */

const MIN_VALID_TIMESTAMP_MS = new Date('2000-01-01T00:00:00.000Z').getTime();

export const normalizeTimestampMs = (timestamp: number | string | Date | null | undefined): number | null => {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    if (timestamp <= 0) return null;
    return timestamp < 1e11 ? Math.round(timestamp * 1000) : timestamp;
  }

  if (typeof timestamp === 'string') {
    const asNumber = Number(timestamp);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber < 1e11 ? Math.round(asNumber * 1000) : asNumber;
    }

    const parsed = Date.parse(timestamp);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return null;
  }

  if (timestamp instanceof Date) {
    const ms = timestamp.getTime();
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }

  return null;
};

export const formatLastSeen = (timestamp: number | string | Date | null | undefined): string => {
  const normalized = normalizeTimestampMs(timestamp);
  if (!normalized || normalized < MIN_VALID_TIMESTAMP_MS) {
    return 'Bilinmiyor';
  }

  const now = Date.now();
  const safeTimestamp = Math.min(normalized, now);
  const diff = now - safeTimestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Şimdi';
  if (minutes < 60) return `${minutes} dk önce`;
  if (hours < 24) return `${hours} saat önce`;
  return `${days} gün önce`;
};
