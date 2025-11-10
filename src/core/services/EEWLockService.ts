/**
 * EEW LOCK SERVICE - Race Condition Prevention
 * Elite-level mutex/lock mechanism to prevent race conditions
 * Ensures only one notification is sent per event
 * Prevents duplicate alerts and ensures data integrity
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('EEWLockService');

interface Lock {
  eventId: string;
  timestamp: number;
  expiresAt: number;
}

class EEWLockService {
  private locks: Map<string, Lock> = new Map();
  private readonly LOCK_TTL = 60000; // 60 seconds lock duration
  private readonly CLEANUP_INTERVAL = 30000; // Cleanup every 30 seconds

  constructor() {
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredLocks(), this.CLEANUP_INTERVAL);
  }

  /**
   * ELITE: Acquire lock for event processing
   * Returns true if lock acquired, false if already locked
   */
  acquireLock(eventId: string): boolean {
    const now = Date.now();
    const existingLock = this.locks.get(eventId);

    // Check if lock exists and is still valid
    if (existingLock && existingLock.expiresAt > now) {
      if (__DEV__) {
        logger.debug(`Lock already held for event: ${eventId}`);
      }
      return false; // Lock already held
    }

    // Acquire new lock
    this.locks.set(eventId, {
      eventId,
      timestamp: now,
      expiresAt: now + this.LOCK_TTL,
    });

    if (__DEV__) {
      logger.debug(`Lock acquired for event: ${eventId}`);
    }

    return true;
  }

  /**
   * ELITE: Release lock early (before expiration)
   */
  releaseLock(eventId: string): void {
    if (this.locks.has(eventId)) {
      this.locks.delete(eventId);
      if (__DEV__) {
        logger.debug(`Lock released for event: ${eventId}`);
      }
    }
  }

  /**
   * ELITE: Check if event is locked
   */
  isLocked(eventId: string): boolean {
    const lock = this.locks.get(eventId);
    if (!lock) return false;

    const now = Date.now();
    if (lock.expiresAt <= now) {
      // Lock expired, remove it
      this.locks.delete(eventId);
      return false;
    }

    return true;
  }

  /**
   * ELITE: Cleanup expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [eventId, lock] of this.locks.entries()) {
      if (lock.expiresAt <= now) {
        this.locks.delete(eventId);
        cleaned++;
      }
    }

    if (cleaned > 0 && __DEV__) {
      logger.debug(`Cleaned up ${cleaned} expired locks`);
    }
  }

  /**
   * ELITE: Get lock statistics
   */
  getStats() {
    return {
      activeLocks: this.locks.size,
      locks: Array.from(this.locks.values()),
    };
  }
}

export const eewLockService = new EEWLockService();

