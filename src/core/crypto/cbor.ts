import * as cbor from 'cbor';
import { Priority, ResourceType } from '../data/models';

export type MessageType = 'HELP' | 'SAFE' | 'RES' | 'PING';

export interface MessagePayload {
  t: MessageType;
  id: string;
  ts: number;
  loc: [number, number, number?]; // [lat, lon, accuracy?]
  prio?: number;
  flags?: {
    rubble?: boolean;
    injury?: boolean;
  };
  ppl?: number;
  note?: string;
  batt?: number;
  ttl: number;
  sig: string;
}

export interface HelpMessagePayload extends MessagePayload {
  t: 'HELP';
  prio: number;
  flags: {
    rubble: boolean;
    injury: boolean;
  };
  ppl: number;
}

export interface SafeMessagePayload extends MessagePayload {
  t: 'SAFE';
  note?: string;
}

export interface ResourceMessagePayload extends MessagePayload {
  t: 'RES';
  type: ResourceType;
  qty?: string;
  desc?: string;
}

export interface PingMessagePayload extends MessagePayload {
  t: 'PING';
}

export class CBOREncoder {
  static encode(message: MessagePayload): Uint8Array {
    try {
      return cbor.encode(message);
    } catch (error) {
      throw new Error(`Failed to encode CBOR message: ${error}`);
    }
  }

  static decode(data: Uint8Array): MessagePayload {
    try {
      const decoded = cbor.decode(data);
      return decoded as MessagePayload;
    } catch (error) {
      throw new Error(`Failed to decode CBOR message: ${error}`);
    }
  }

  static encodeHelpMessage(
    id: string,
    lat: number,
    lon: number,
    accuracy: number,
    priority: Priority,
    underRubble: boolean,
    injured: boolean,
    peopleCount: number,
    note: string,
    battery?: number,
    ttl: number = 6, // 6 hours default
  ): Uint8Array {
    const message: HelpMessagePayload = {
      t: 'HELP',
      id,
      ts: Date.now(),
      loc: [lat, lon, accuracy],
      prio: priority,
      flags: {
        rubble: underRubble,
        injury: injured,
      },
      ppl: peopleCount,
      note,
      batt: battery,
      ttl,
      sig: '', // Will be filled by crypto layer
    };

    return this.encode(message);
  }

  static encodeSafeMessage(
    id: string,
    lat: number,
    lon: number,
    accuracy: number,
    note?: string,
    battery?: number,
    ttl: number = 6,
  ): Uint8Array {
    const message: SafeMessagePayload = {
      t: 'SAFE',
      id,
      ts: Date.now(),
      loc: [lat, lon, accuracy],
      note,
      batt: battery,
      ttl,
      sig: '',
    };

    return this.encode(message);
  }

  static encodeResourceMessage(
    id: string,
    type: ResourceType,
    lat: number,
    lon: number,
    accuracy: number,
    qty?: string,
    desc?: string,
    ttl: number = 12, // 12 hours for resources
  ): Uint8Array {
    const message: ResourceMessagePayload = {
      t: 'RES',
      id,
      ts: Date.now(),
      loc: [lat, lon, accuracy],
      type,
      qty,
      desc,
      ttl,
      sig: '',
    };

    return this.encode(message);
  }

  static encodePingMessage(
    id: string,
    lat: number,
    lon: number,
    accuracy: number,
    battery?: number,
    ttl: number = 1, // 1 hour for pings
  ): Uint8Array {
    const message: PingMessagePayload = {
      t: 'PING',
      id,
      ts: Date.now(),
      loc: [lat, lon, accuracy],
      batt: battery,
      ttl,
      sig: '',
    };

    return this.encode(message);
  }

  // Validation methods
  static validateMessage(payload: MessagePayload): boolean {
    try {
      // Check required fields
      if (!payload.t || !payload.id || !payload.ts || !payload.loc || !payload.ttl || !payload.sig) {
        return false;
      }

      // Check message type
      if (!['HELP', 'SAFE', 'RES', 'PING'].includes(payload.t)) {
        return false;
      }

      // Check location format
      if (!Array.isArray(payload.loc) || payload.loc.length < 2) {
        return false;
      }

      // Check TTL
      if (payload.ttl < 0 || payload.ttl > 8) {
        return false;
      }

      // Type-specific validation
      if (payload.t === 'HELP') {
        const helpPayload = payload as HelpMessagePayload;
        if (typeof helpPayload.prio !== 'number' || helpPayload.prio < 0 || helpPayload.prio > 2) {
          return false;
        }
        if (typeof helpPayload.ppl !== 'number' || helpPayload.ppl < 1 || helpPayload.ppl > 20) {
          return false;
        }
        if (!helpPayload.flags || typeof helpPayload.flags.rubble !== 'boolean' || typeof helpPayload.flags.injury !== 'boolean') {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Get message size estimate
  static estimateSize(payload: MessagePayload): number {
    try {
      const encoded = this.encode(payload);
      return encoded.length;
    } catch (error) {
      return 0;
    }
  }

  // Check if message is too large for transmission
  static isTooLarge(payload: MessagePayload, maxSize: number = 200): boolean {
    return this.estimateSize(payload) > maxSize;
  }
}