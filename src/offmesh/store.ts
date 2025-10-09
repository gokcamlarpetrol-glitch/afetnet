import AsyncStorage from '@react-native-async-storage/async-storage';
import { Envelope, JournalEvent, MsgType } from './types';

const QUEUE_KEY = 'afetnet:mesh:queue';
const JOURNAL_KEY = 'afetnet:mesh:journal';
const DEDUP_KEY = 'afetnet:mesh:dedup';

interface DedupEntry {
  id: string;
  ts: number;
  hop: number;
}

interface QueueEntry {
  envelope: Envelope;
  attempts: number;
  lastAttempt: number;
  nextRetry: number;
}

class MeshStore {
  private dedupMap = new Map<string, DedupEntry>();
  private queue: QueueEntry[] = [];
  private journal: JournalEvent[] = [];
  private maxDedupSize = 2000;
  private maxQueueSize = 200;
  private maxJournalSize = 500;

  constructor() {
    this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    try {
      // Load queue
      const queueData = await AsyncStorage.getItem(QUEUE_KEY);
      if (queueData) {
        this.queue = JSON.parse(queueData);
      }

      // Load journal
      const journalData = await AsyncStorage.getItem(JOURNAL_KEY);
      if (journalData) {
        this.journal = JSON.parse(journalData);
      }

      // Load dedup (only recent entries)
      const dedupData = await AsyncStorage.getItem(DEDUP_KEY);
      if (dedupData) {
        const entries: DedupEntry[] = JSON.parse(dedupData);
        // Keep only recent entries (last 24 hours)
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        entries
          .filter(entry => entry.ts > cutoff)
          .forEach(entry => this.dedupMap.set(entry.id, entry));
      }
    } catch (error) {
      console.warn('Failed to load mesh store:', error);
    }
  }

  private async saveToStorage(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue)),
        AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(this.journal)),
        AsyncStorage.setItem(DEDUP_KEY, JSON.stringify(Array.from(this.dedupMap.values()))),
      ]);
    } catch (error) {
      console.warn('Failed to save mesh store:', error);
    }
  }

  // Check if message is duplicate
  isDuplicate(envelope: Envelope): boolean {
    const existing = this.dedupMap.get(envelope.id);
    if (!existing) {
      return false;
    }

    // Update hop count if this is a better path
    if (envelope.hop < existing.hop) {
      existing.hop = envelope.hop;
      existing.ts = Date.now();
    }

    return true;
  }

  // Add message to dedup cache
  addToDedup(envelope: Envelope): void {
    // Clean up old entries if needed
    if (this.dedupMap.size >= this.maxDedupSize) {
      const entries = Array.from(this.dedupMap.entries());
      entries.sort((a, b) => a[1].ts - b[1].ts);
      
      // Remove oldest 25%
      const toRemove = Math.floor(this.maxDedupSize * 0.25);
      for (let i = 0; i < toRemove; i++) {
        this.dedupMap.delete(entries[i][0]);
      }
    }

    this.dedupMap.set(envelope.id, {
      id: envelope.id,
      ts: Date.now(),
      hop: envelope.hop,
    });
  }

  // Add message to outbound queue
  enqueue(envelope: Envelope): void {
    if (this.queue.length >= this.maxQueueSize) {
      // Remove oldest entry
      this.queue.shift();
    }

    this.queue.push({
      envelope,
      attempts: 0,
      lastAttempt: 0,
      nextRetry: Date.now(),
    });

    this.saveToStorage();
  }

  // Get next message to send
  getNextToSend(): Envelope | null {
    const now = Date.now();
    const entry = this.queue.find(e => e.nextRetry <= now);
    
    if (!entry) {
      return null;
    }

    // Check TTL
    if (this.isExpired(entry.envelope)) {
      this.dropExpired(entry.envelope);
      return this.getNextToSend(); // Try next
    }

    return entry.envelope;
  }

  // Mark message as sent
  markSent(envelope: Envelope): void {
    const index = this.queue.findIndex(e => e.envelope.id === envelope.id);
    if (index >= 0) {
      this.queue.splice(index, 1);
      this.saveToStorage();
    }
  }

  // Mark message as failed, schedule retry
  markFailed(envelope: Envelope, error: string): void {
    const entry = this.queue.find(e => e.envelope.id === envelope.id);
    if (entry) {
      entry.attempts++;
      entry.lastAttempt = Date.now();
      
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
      const delay = Math.min(1000 * Math.pow(2, entry.attempts - 1), 60000);
      entry.nextRetry = Date.now() + delay;
      
      this.logEvent({
        id: envelope.id,
        ts: Date.now(),
        type: 'retry',
        msgType: envelope.type,
        size: JSON.stringify(envelope.payload).length,
        hop: envelope.hop,
        error,
      });
      
      this.saveToStorage();
    }
  }

  // Check if message is expired
  isExpired(envelope: Envelope): boolean {
    const now = Date.now();
    const age = now - envelope.ts;
    const maxAge = envelope.ttl * 60 * 1000; // TTL in minutes
    
    return age > maxAge || envelope.hop >= 8;
  }

  // Drop expired message
  dropExpired(envelope: Envelope): void {
    const index = this.queue.findIndex(e => e.envelope.id === envelope.id);
    if (index >= 0) {
      this.queue.splice(index, 1);
      this.saveToStorage();
    }

    this.logEvent({
      id: envelope.id,
      ts: Date.now(),
      type: 'drop',
      msgType: envelope.type,
      size: JSON.stringify(envelope.payload).length,
      hop: envelope.hop,
      error: 'expired',
    });
  }

  // Increment hop count for forwarding
  incrementHop(envelope: Envelope): Envelope {
    return {
      ...envelope,
      hop: envelope.hop + 1,
    };
  }

  // Log event to journal
  logEvent(event: JournalEvent): void {
    this.journal.unshift(event);
    
    // Keep only recent events
    if (this.journal.length > this.maxJournalSize) {
      this.journal = this.journal.slice(0, this.maxJournalSize);
    }
    
    this.saveToStorage();
  }

  // Get queue stats
  getQueueStats(): { count: number; oldestAge: number } {
    if (this.queue.length === 0) {
      return { count: 0, oldestAge: 0 };
    }

    const now = Date.now();
    const oldest = Math.min(...this.queue.map(e => e.envelope.ts));
    
    return {
      count: this.queue.length,
      oldestAge: now - oldest,
    };
  }

  // Get dedup stats
  getDedupStats(): { count: number } {
    return { count: this.dedupMap.size };
  }

  // Get recent journal events
  getRecentEvents(limit = 50): JournalEvent[] {
    return this.journal.slice(0, limit);
  }

  // Export journal for diagnostics
  async exportJournal(): Promise<string> {
    try {
      const exportData = {
        timestamp: new Date().toISOString(),
        events: this.journal,
        stats: {
          queue: this.getQueueStats(),
          dedup: this.getDedupStats(),
        },
      };
      
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.warn('Failed to export journal:', error);
      return '{}';
    }
  }

  // Clear all data
  async clear(): Promise<void> {
    this.dedupMap.clear();
    this.queue = [];
    this.journal = [];
    
    try {
      await Promise.all([
        AsyncStorage.removeItem(QUEUE_KEY),
        AsyncStorage.removeItem(JOURNAL_KEY),
        AsyncStorage.removeItem(DEDUP_KEY),
      ]);
    } catch (error) {
      console.warn('Failed to clear mesh store:', error);
    }
  }
}

// Singleton instance
export const meshStore = new MeshStore();



