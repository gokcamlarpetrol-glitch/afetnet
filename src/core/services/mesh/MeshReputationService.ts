/**
 * MESH REPUTATION SERVICE
 *
 * Sprint 16-17: Mesh hierarchy v2 — Peer reputation score.
 *
 * Her peer'in guvenilirligini hesaplar:
 *   reputation = (received_ACKs / sent_messages_to_peer) * decay_factor
 *
 * Yuksek reputation peer'ler oncelikle relay icin tercih edilir.
 * Adversarial peer'ler (sahte ACK, fake heartbeat) reputation'i dusurur.
 *
 * Reputation 0-1 araliginda:
 *   1.0  = mukemmel (her gonderim ACK donduruyor)
 *   0.7+ = guvenilir
 *   0.4+ = orta — relay'de oncelik vermez
 *   <0.3 = unreliable — relay kullanma
 *   <0.1 = potansiyel adversarial — block
 *
 * NOT: Bu servis Sprint 17 hierarchy v2 tasarim skeleti. MeshNetworkService
 * relay karar verirken bu servisin getReputation() degerini kullanmalidir.
 * Future-work: persistent storage (mevcut sadece RAM).
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('MeshReputationService');

interface PeerStats {
  sent: number;            // bu peer'e gonderdigimiz paket sayisi
  acked: number;           // peer'den dondu ACK
  failed: number;          // timeout veya delivery fail
  lastInteraction: number;
  /** Adversarial davranis sayaclari */
  invalidSignatureCount: number;
  duplicatePacketCount: number;
}

const DECAY_HALF_LIFE_MS = 24 * 60 * 60 * 1000; // 24h sonra reputation %50'ye dusur
const ADVERSARIAL_THRESHOLD = 3; // 3+ kotu paket → block

class MeshReputationService {
  private peers = new Map<string, PeerStats>();
  private listeners: Set<(peerId: string, reputation: number) => void> = new Set();

  /**
   * Paket gonderim kaydet (ACK beklerken).
   */
  recordSent(peerId: string): void {
    const stats = this.getOrCreate(peerId);
    stats.sent++;
    stats.lastInteraction = Date.now();
  }

  /**
   * Peer'den ACK alindi.
   */
  recordAck(peerId: string): void {
    const stats = this.getOrCreate(peerId);
    stats.acked++;
    stats.lastInteraction = Date.now();
    this.notifyChange(peerId);
  }

  /**
   * Peer'e gonderim basarisiz (timeout).
   */
  recordFailure(peerId: string): void {
    const stats = this.getOrCreate(peerId);
    stats.failed++;
    stats.lastInteraction = Date.now();
    this.notifyChange(peerId);
  }

  /**
   * Adversarial sinyal: peer kotu imzali paket gonderdi.
   */
  recordInvalidSignature(peerId: string): void {
    const stats = this.getOrCreate(peerId);
    stats.invalidSignatureCount++;
    stats.lastInteraction = Date.now();
    if (stats.invalidSignatureCount >= ADVERSARIAL_THRESHOLD) {
      logger.warn(`Peer ${peerId.slice(0, 8)} BLOCKED for adversarial signatures`);
    }
    this.notifyChange(peerId);
  }

  /**
   * Adversarial sinyal: ayni paket cok kez (DoS amaci).
   */
  recordDuplicatePacket(peerId: string): void {
    const stats = this.getOrCreate(peerId);
    stats.duplicatePacketCount++;
    if (stats.duplicatePacketCount % 10 === 0) {
      logger.warn(`Peer ${peerId.slice(0, 8)} suspicious duplicate count: ${stats.duplicatePacketCount}`);
    }
  }

  /**
   * 0-1 araliginda reputation skoru.
   * 1 = mukemmel, 0 = guvenilmez, <0.1 = block
   */
  getReputation(peerId: string): number {
    const stats = this.peers.get(peerId);
    if (!stats) return 0.5; // bilinmeyen peer → baseline trust

    // Adversarial blocked?
    if (stats.invalidSignatureCount >= ADVERSARIAL_THRESHOLD) return 0;

    if (stats.sent === 0) return 0.5; // hic gonderim yok

    // Base score: ACK ratio
    const ackRatio = stats.acked / Math.max(1, stats.sent);
    let score = Math.max(0, Math.min(1, ackRatio));

    // Decay: eski etkilesimlere agirlik azalir
    const age = Date.now() - stats.lastInteraction;
    const decay = Math.pow(0.5, age / DECAY_HALF_LIFE_MS);
    score = score * decay + 0.5 * (1 - decay); // baseline 0.5'e geri donus

    // Duplicate penalty: 50+ duplicate paketse %20 puan dus
    if (stats.duplicatePacketCount > 50) {
      score *= 0.8;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Peer relay icin guvenilir mi?
   */
  isReliable(peerId: string): boolean {
    return this.getReputation(peerId) >= 0.4;
  }

  /**
   * Peer adversarial olarak isaretlenmis mi? Block edilmeli mi?
   */
  isBlocked(peerId: string): boolean {
    const stats = this.peers.get(peerId);
    if (!stats) return false;
    return stats.invalidSignatureCount >= ADVERSARIAL_THRESHOLD;
  }

  /**
   * En guvenilir N peer'leri reputation sirasinda dondur.
   * Relay paket dagitiminda oncelik icin kullanilir.
   */
  getTopPeers(limit: number = 10): Array<{ peerId: string; reputation: number }> {
    return Array.from(this.peers.entries())
      .map(([peerId, _stats]) => ({ peerId, reputation: this.getReputation(peerId) }))
      .filter((p) => p.reputation > 0)
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, limit);
  }

  /**
   * Mode degisiklik subscriber'i.
   */
  subscribe(callback: (peerId: string, reputation: number) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Logout/account-switch sirasinda temizle.
   */
  reset(): void {
    this.peers.clear();
    logger.info('Reputation state reset');
  }

  /**
   * Tum stats (debug + analytics).
   */
  getAllStats(): Record<string, PeerStats> {
    const result: Record<string, PeerStats> = {};
    this.peers.forEach((stats, peerId) => {
      result[peerId] = { ...stats };
    });
    return result;
  }

  // =========================================================================
  // PRIVATE
  // =========================================================================

  private getOrCreate(peerId: string): PeerStats {
    let stats = this.peers.get(peerId);
    if (!stats) {
      stats = {
        sent: 0,
        acked: 0,
        failed: 0,
        lastInteraction: Date.now(),
        invalidSignatureCount: 0,
        duplicatePacketCount: 0,
      };
      this.peers.set(peerId, stats);
    }
    return stats;
  }

  private notifyChange(peerId: string): void {
    const reputation = this.getReputation(peerId);
    this.listeners.forEach((cb) => {
      try { cb(peerId, reputation); } catch (e) { logger.warn('listener error:', e); }
    });
  }
}

export const meshReputationService = new MeshReputationService();
