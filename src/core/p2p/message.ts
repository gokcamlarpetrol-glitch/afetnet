import * as cbor from 'cbor';
import { sign, verify } from 'tweetnacl';
import { Priority } from '../data/models';

export interface MessageData {
  t: number; // type: 0=help_request, 1=status_ping, 2=resource_post, 3=EEW_P, 4=EEW_ACK
  id: string; // unique message ID
  ts: number; // timestamp
  loc: {
    lat: number;
    lon: number;
    acc: number; // accuracy in meters
  };
  prio: Priority; // priority: 0=normal, 1=high, 2=critical
  flags: {
    underRubble: boolean;
    injured: boolean;
    anonymity: boolean;
  };
  ppl: number; // people count
  note?: string; // optional note (max 100 chars)
  batt?: number; // battery level (0-100)
  ttl: number; // time to live (hops)
  sig: string; // signature (base64)
  // EEW-specific fields
  str?: number; // strength (STA/LTA ratio) for EEW_P messages
  ref?: string; // reference ID for EEW_ACK messages
}

export interface EncodedMessage {
  data: Uint8Array;
  size: number;
}

export class MessageEncoder {
  private static readonly MAX_NOTE_LENGTH = 100;
  private static readonly MAX_MESSAGE_SIZE = 200;

  static encode(messageData: Omit<MessageData, 'sig'>): EncodedMessage {
    try {
      // Validate message data
      this.validateMessage(messageData);

      // Convert to CBOR
      const cborData = cbor.encode(messageData);
      
      // Check size limit
      if (cborData.length > this.MAX_MESSAGE_SIZE) {
        throw new Error(`Message too large: ${cborData.length} bytes`);
      }

      return {
        data: cborData,
        size: cborData.length,
      };
    } catch (error) {
      throw new Error(`Failed to encode message: ${error}`);
    }
  }

  static decode(data: Uint8Array): MessageData {
    try {
      const decoded = cbor.decode(data);
      
      // Validate decoded message structure
      this.validateMessageStructure(decoded);
      
      return decoded as MessageData;
    } catch (error) {
      throw new Error(`Failed to decode message: ${error}`);
    }
  }

  static signMessage(
    messageData: Omit<MessageData, 'sig'>,
    privateKey: Uint8Array
  ): MessageData {
    const message = this.encode(messageData);
    const signature = sign(message.data, privateKey);
    
    return {
      ...messageData,
      sig: Buffer.from(signature).toString('base64'),
    };
  }

  static verifyMessage(message: MessageData, publicKey: Uint8Array): boolean {
    try {
      const { sig, ...messageWithoutSig } = message;
      const encodedMessage = this.encode(messageWithoutSig);
      const signature = Buffer.from(sig, 'base64');
      
      const verified = verify(encodedMessage.data, signature, publicKey);
      return verified.length > 0;
    } catch (error) {
      console.error('Message verification failed:', error);
      return false;
    }
  }

  private static validateMessage(message: Omit<MessageData, 'sig'>): void {
    if (message.t < 0 || message.t > 4) {
      throw new Error('Invalid message type');
    }
    
    if (!message.id || message.id.length === 0) {
      throw new Error('Message ID is required');
    }
    
    if (message.ts <= 0) {
      throw new Error('Invalid timestamp');
    }
    
    if (message.loc.lat < -90 || message.loc.lat > 90) {
      throw new Error('Invalid latitude');
    }
    
    if (message.loc.lon < -180 || message.loc.lon > 180) {
      throw new Error('Invalid longitude');
    }
    
    if (message.prio < 0 || message.prio > 2) {
      throw new Error('Invalid priority');
    }
    
    if (message.ppl < 1 || message.ppl > 100) {
      throw new Error('Invalid people count');
    }
    
    if (message.note && message.note.length > this.MAX_NOTE_LENGTH) {
      throw new Error('Note too long');
    }
    
    if (message.batt !== undefined && (message.batt < 0 || message.batt > 100)) {
      throw new Error('Invalid battery level');
    }
    
    if (message.ttl < 0 || message.ttl > 10) {
      throw new Error('Invalid TTL');
    }
  }

  private static validateMessageStructure(data: any): void {
    const requiredFields = ['t', 'id', 'ts', 'loc', 'prio', 'flags', 'ppl', 'ttl', 'sig'];
    
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate location structure
    if (!data.loc || typeof data.loc.lat !== 'number' || typeof data.loc.lon !== 'number') {
      throw new Error('Invalid location structure');
    }
    
    // Validate flags structure
    if (!data.flags || typeof data.flags.underRubble !== 'boolean') {
      throw new Error('Invalid flags structure');
    }
  }

  // Utility methods for creating different message types
  static createHelpRequest(data: {
    id: string;
    lat: number;
    lon: number;
    accuracy: number;
    priority: Priority;
    underRubble: boolean;
    injured: boolean;
    peopleCount: number;
    note?: string;
    battery?: number;
    anonymity: boolean;
    ttl: number;
  }): Omit<MessageData, 'sig'> {
    return {
      t: 0, // help request
      id: data.id,
      ts: Date.now(),
      loc: {
        lat: data.lat,
        lon: data.lon,
        acc: data.accuracy,
      },
      prio: data.priority,
      flags: {
        underRubble: data.underRubble,
        injured: data.injured,
        anonymity: data.anonymity,
      },
      ppl: data.peopleCount,
      note: data.note,
      batt: data.battery,
      ttl: data.ttl,
    };
  }

  static createStatusPing(data: {
    id: string;
    lat: number;
    lon: number;
    accuracy: number;
    battery?: number;
    note?: string;
  }): Omit<MessageData, 'sig'> {
    return {
      t: 1, // status ping
      id: data.id,
      ts: Date.now(),
      loc: {
        lat: data.lat,
        lon: data.lon,
        acc: data.accuracy,
      },
      prio: 0, // normal priority for status pings
      flags: {
        underRubble: false,
        injured: false,
        anonymity: false,
      },
      ppl: 1,
      note: data.note,
      batt: data.battery,
      ttl: 3, // shorter TTL for status pings
    };
  }

  static createResourcePost(data: {
    id: string;
    lat: number;
    lon: number;
    accuracy: number;
    type: string;
    quantity: string;
    description?: string;
  }): Omit<MessageData, 'sig'> {
    return {
      t: 2, // resource post
      id: data.id,
      ts: Date.now(),
      loc: {
        lat: data.lat,
        lon: data.lon,
        acc: data.accuracy,
      },
      prio: 0, // normal priority for resource posts
      flags: {
        underRubble: false,
        injured: false,
        anonymity: false,
      },
      ppl: 1,
      note: `${data.type}: ${data.quantity}${data.description ? ` - ${data.description}` : ''}`,
      ttl: 6, // longer TTL for resource posts
    };
  }

  static createEEWPWave(data: {
    id: string;
    lat: number;
    lon: number;
    accuracy: number;
    strength: number;
    deviceId: string;
  }): Omit<MessageData, 'sig'> {
    return {
      t: 3, // EEW_P
      id: data.id,
      ts: Date.now(),
      loc: {
        lat: data.lat,
        lon: data.lon,
        acc: data.accuracy,
      },
      prio: 2, // critical priority for EEW messages
      flags: {
        underRubble: false,
        injured: false,
        anonymity: false,
      },
      ppl: 1,
      note: `EEW_P:${data.deviceId}`,
      ttl: 2, // small TTL for immediate propagation
      str: data.strength,
    };
  }

  static createEEWAck(data: {
    id: string;
    referenceId: string;
    lat: number;
    lon: number;
    accuracy: number;
  }): Omit<MessageData, 'sig'> {
    return {
      t: 4, // EEW_ACK
      id: data.id,
      ts: Date.now(),
      loc: {
        lat: data.lat,
        lon: data.lon,
        acc: data.accuracy,
      },
      prio: 1, // high priority for EEW acknowledgments
      flags: {
        underRubble: false,
        injured: false,
        anonymity: false,
      },
      ppl: 1,
      note: `EEW_ACK:${data.referenceId}`,
      ttl: 1, // very small TTL for acknowledgments
      ref: data.referenceId,
    };
  }
}
