import { getPublicKey } from '../identity/keypair';
import { logger } from '../utils/productionLogger';
import { pubKeyToAfnId, validateAfnId } from '../identity/afnId';
import { usePeople } from '../store/people';

export interface PairRequest {
  t: 'PAIR_REQ';
  id: string;
  fromAfn: string;
  toAfn: string;
  fromPubB64: string;
  ts: number;
}

export interface PairAck {
  t: 'PAIR_ACK';
  ref: string;
  toAfn: string;
  toPubB64: string;
  ts: number;
}

export interface PairHandshake {
  requestId: string;
  fromAfn: string;
  toAfn: string;
  fromPubB64: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
}

class IdHandshakeManager {
  private pendingRequests = new Map<string, PairHandshake>();
  private seenIds = new Set<string>();

  async initiatePairing(targetAfnId: string): Promise<string> {
    try {
      // Validate target AFN-ID
      const validation = validateAfnId(targetAfnId);
      if (!validation.ok) {
        throw new Error('Geçersiz AFN-ID');
      }

      // Get my public key and AFN-ID
      const myPubKey = await getPublicKey();
      const myAfnId = pubKeyToAfnId(myPubKey);

      // Generate unique request ID
      const requestId = `pair_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Create handshake record
      const handshake: PairHandshake = {
        requestId,
        fromAfn: myAfnId,
        toAfn: targetAfnId,
        fromPubB64: myPubKey,
        timestamp: Date.now(),
        status: 'pending',
      };

      this.pendingRequests.set(requestId, handshake);

      // Create PAIR_REQ message
      const pairRequest: PairRequest = {
        t: 'PAIR_REQ',
        id: requestId,
        fromAfn: myAfnId,
        toAfn: targetAfnId,
        fromPubB64: myPubKey,
        ts: Date.now(),
      };

      // Send via mesh relay (this would be integrated with existing mesh system)
      await this.sendPairRequest(pairRequest);

      return requestId;
    } catch (error) {
      logger.error('Failed to initiate pairing:', error);
      throw error;
    }
  }

  async handlePairRequest(pairRequest: PairRequest): Promise<boolean> {
    try {
      // Check if we've already seen this request
      if (this.seenIds.has(pairRequest.id)) {
        return false;
      }

      // Validate the request
      const now = Date.now();
      const ageMinutes = (now - pairRequest.ts) / (1000 * 60);
      
      if (ageMinutes > 10 || ageMinutes < -1) {
        // Reject old or future requests
        return false;
      }

      // Validate AFN-IDs
      const fromValidation = validateAfnId(pairRequest.fromAfn);
      const toValidation = validateAfnId(pairRequest.toAfn);
      
      if (!fromValidation.ok || !toValidation.ok) {
        return false;
      }

      // Check if this is for me
      const { meAfnId } = usePeople.getState();
      if (pairRequest.toAfn !== meAfnId) {
        return false;
      }

      this.seenIds.add(pairRequest.id);

      // Show pairing request to user (this would trigger UI)
      await this.showPairingRequest(pairRequest);

      return true;
    } catch (error) {
      logger.error('Failed to handle pair request:', error);
      return false;
    }
  }

  async acceptPairing(requestId: string): Promise<boolean> {
    try {
      const handshake = this.pendingRequests.get(requestId);
      if (!handshake || handshake.status !== 'pending') {
        return false;
      }

      // Get my public key and AFN-ID
      const myPubKey = await getPublicKey();

      // Create PAIR_ACK message
      const pairAck: PairAck = {
        t: 'PAIR_ACK',
        ref: requestId,
        toAfn: handshake.fromAfn,
        toPubB64: myPubKey,
        ts: Date.now(),
      };

      // Send ACK via mesh relay
      await this.sendPairAck(pairAck);

      // Mark as accepted
      handshake.status = 'accepted';
      this.pendingRequests.set(requestId, handshake);

      return true;
    } catch (error) {
      logger.error('Failed to accept pairing:', error);
      return false;
    }
  }

  async handlePairAck(pairAck: PairAck): Promise<boolean> {
    try {
      // Find the corresponding request
      const handshake = this.pendingRequests.get(pairAck.ref);
      if (!handshake || handshake.status !== 'pending') {
        return false;
      }

      // Validate the ACK
      const now = Date.now();
      const ageMinutes = (now - pairAck.ts) / (1000 * 60);
      
      if (ageMinutes > 10 || ageMinutes < -1) {
        return false;
      }

      // Verify AFN-ID matches
      const ackAfnId = pubKeyToAfnId(pairAck.toPubB64);
      if (ackAfnId !== handshake.fromAfn) {
        return false;
      }

      // Both parties now have each other's public keys
      // Add to people store as paired
      const { markPaired, addOrUpdate } = usePeople.getState();
      
      // Find or create person entry
      let personId = addOrUpdate({
        displayName: `AFN-${handshake.fromAfn.slice(-4)}`,
        afnId: handshake.fromAfn,
        pubKeyB64: handshake.fromPubB64,
        paired: false,
      });

      // Mark as paired
      markPaired(personId, handshake.fromPubB64, handshake.fromAfn);

      // Mark handshake as completed
      handshake.status = 'completed';
      this.pendingRequests.set(pairAck.ref, handshake);

      logger.debug(`Pairing completed with AFN-ID: ${handshake.fromAfn}`);
      return true;
    } catch (error) {
      logger.error('Failed to handle pair ACK:', error);
      return false;
    }
  }

  private async sendPairRequest(pairRequest: PairRequest): Promise<void> {
    // This would integrate with the existing mesh relay system
    // For now, we'll just log it
    logger.debug('Sending PAIR_REQ:', pairRequest);
    
    // TODO: Integrate with mesh relay
    // await meshRelay.sendMessage(pairRequest, { ttl: 5, priority: 'NORMAL' });
  }

  private async sendPairAck(pairAck: PairAck): Promise<void> {
    // This would integrate with the existing mesh relay system
    logger.debug('Sending PAIR_ACK:', pairAck);
    
    // TODO: Integrate with mesh relay
    // await meshRelay.sendMessage(pairAck, { ttl: 5, priority: 'NORMAL' });
  }

  private async showPairingRequest(pairRequest: PairRequest): Promise<void> {
    // This would show a UI dialog to the user
    // For now, we'll just log it
    logger.debug(`Pairing request from AFN-ID: ${pairRequest.fromAfn}`);
    
    // TODO: Show UI dialog
    // Alert.alert(
    //   'Eşleşme İsteği',
    //   `${pairRequest.fromAfn} kişi eşleşmek istiyor`,
    //   [
    //     { text: 'Reddet', onPress: () => this.rejectPairing(pairRequest.id) },
    //     { text: 'Kabul Et', onPress: () => this.acceptPairing(pairRequest.id) }
    //   ]
    // );
  }

  getPendingRequests(): PairHandshake[] {
    return Array.from(this.pendingRequests.values()).filter(h => h.status === 'pending');
  }

  clearCompletedHandshakes(): void {
    for (const [id, handshake] of this.pendingRequests.entries()) {
      if (handshake.status === 'completed' || handshake.status === 'rejected') {
        this.pendingRequests.delete(id);
      }
    }
  }
}

export const idHandshakeManager = new IdHandshakeManager();
