import { Priority } from '../database/models';

// Custom base32-like encoding optimized for SMS
const SMS_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SMS_CHAR_MAP: { [key: string]: number } = {};
SMS_CHARS.split('').forEach((char, index) => {
  SMS_CHAR_MAP[char] = index;
});

export interface SMSMessage {
  type: 'HELP' | 'SAFE' | 'RES' | 'PING';
  lat: number;
  lon: number;
  priority?: Priority;
  flags?: {
    rubble?: boolean;
    injury?: boolean;
  };
  peopleCount?: number;
  note?: string;
  battery?: number;
  ttl?: number;
}

export class SMSEncoder {
  private static readonly MAX_SMS_LENGTH = 300;
  private static readonly LAT_LON_PRECISION = 5; // ~1.1m precision
  private static readonly BATTERY_MAX = 100;
  private static readonly TTL_MAX = 86400000; // 24 hours in ms

  static encode(message: SMSMessage): string {
    const parts: string[] = [];

    // Type (2 chars)
    const typeMap = { HELP: 'H', SAFE: 'S', RES: 'R', PING: 'P' };
    parts.push(typeMap[message.type]);

    // Location (10 chars: 5 chars lat + 5 chars lon)
    const latEncoded = this.encodeCoordinate(message.lat, 90);
    const lonEncoded = this.encodeCoordinate(message.lon, 180);
    parts.push(latEncoded + lonEncoded);

    // Priority (1 char) - only for HELP messages
    if (message.type === 'HELP' && message.priority !== undefined) {
      parts.push(message.priority.toString());
    } else {
      parts.push('0'); // Default
    }

    // Flags (1 char) - only for HELP messages
    if (message.type === 'HELP' && message.flags) {
      let flags = 0;
      if (message.flags.rubble) flags |= 1;
      if (message.flags.injury) flags |= 2;
      parts.push(flags.toString());
    } else {
      parts.push('0');
    }

    // People count (1 char) - only for HELP messages
    if (message.type === 'HELP' && message.peopleCount !== undefined) {
      parts.push(Math.min(message.peopleCount, 9).toString());
    } else {
      parts.push('0');
    }

    // Battery (2 chars)
    if (message.battery !== undefined) {
      parts.push(this.encodeNumber(message.battery, 2));
    } else {
      parts.push('00');
    }

    // TTL (2 chars) - in hours
    const ttlHours = message.ttl ? Math.min(Math.floor(message.ttl / 3600000), 99) : 24;
    parts.push(this.encodeNumber(ttlHours, 2));

    // Note (remaining chars, truncated if needed)
    if (message.note && message.note.length > 0) {
      const remainingLength = this.MAX_SMS_LENGTH - parts.join('').length;
      if (remainingLength > 0) {
        const truncatedNote = message.note.substring(0, remainingLength - 1); // -1 for separator
        parts.push(truncatedNote);
      }
    }

    const encoded = parts.join('');
    
    if (encoded.length > this.MAX_SMS_LENGTH) {
      throw new Error(`Encoded message too long: ${encoded.length} chars (max: ${this.MAX_SMS_LENGTH})`);
    }

    return encoded;
  }

  static decode(encoded: string): SMSMessage {
    if (encoded.length < 10) {
      throw new Error('Invalid SMS message: too short');
    }

    let pos = 0;

    // Type
    const typeChar = encoded[pos++];
    const typeMap: { [key: string]: 'HELP' | 'SAFE' | 'RES' | 'PING' } = {
      'H': 'HELP', 'S': 'SAFE', 'R': 'RES', 'P': 'PING'
    };
    const type = typeMap[typeChar];
    if (!type) {
      throw new Error(`Invalid message type: ${typeChar}`);
    }

    // Location
    const latEncoded = encoded.substring(pos, pos + 5);
    const lonEncoded = encoded.substring(pos + 5, pos + 10);
    pos += 10;
    const lat = this.decodeCoordinate(latEncoded, 90);
    const lon = this.decodeCoordinate(lonEncoded, 180);

    // Priority
    const priority = parseInt(encoded[pos++]) as Priority;

    // Flags
    const flagsValue = parseInt(encoded[pos++]);
    const flags = {
      rubble: (flagsValue & 1) !== 0,
      injury: (flagsValue & 2) !== 0,
    };

    // People count
    const peopleCount = parseInt(encoded[pos++]);

    // Battery
    const batteryEncoded = encoded.substring(pos, pos + 2);
    pos += 2;
    const battery = this.decodeNumber(batteryEncoded);

    // TTL
    const ttlEncoded = encoded.substring(pos, pos + 2);
    pos += 2;
    const ttlHours = this.decodeNumber(ttlEncoded);
    const ttl = ttlHours * 3600000; // Convert to milliseconds

    // Note (remaining)
    const note = pos < encoded.length ? encoded.substring(pos) : undefined;

    const message: SMSMessage = {
      type,
      lat,
      lon,
      priority,
      flags,
      peopleCount,
      battery,
      ttl,
      note,
    };

    return message;
  }

  private static encodeCoordinate(value: number, maxRange: number): string {
    // Normalize to 0-1 range
    const normalized = (value + maxRange) / (2 * maxRange);
    // Convert to 5-character encoding (32^5 = 33,554,432 possible values)
    const encoded = Math.floor(normalized * Math.pow(SMS_CHARS.length, 5));
    return this.encodeNumber(encoded, 5);
  }

  private static decodeCoordinate(encoded: string, maxRange: number): number {
    const value = this.decodeNumber(encoded);
    const normalized = value / Math.pow(SMS_CHARS.length, 5);
    return (normalized * 2 * maxRange) - maxRange;
  }

  private static encodeNumber(value: number, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result = SMS_CHARS[value % SMS_CHARS.length] + result;
      value = Math.floor(value / SMS_CHARS.length);
    }
    return result;
  }

  private static decodeNumber(encoded: string): number {
    let result = 0;
    for (let i = 0; i < encoded.length; i++) {
      const char = encoded[i];
      const value = SMS_CHAR_MAP[char];
      if (value === undefined) {
        throw new Error(`Invalid character in SMS encoding: ${char}`);
      }
      result = result * SMS_CHARS.length + value;
    }
    return result;
  }

  // Utility function to validate SMS message length
  static validateLength(message: SMSMessage): boolean {
    try {
      const encoded = this.encode(message);
      return encoded.length <= this.MAX_SMS_LENGTH;
    } catch {
      return false;
    }
  }

  // Get estimated length without encoding
  static estimateLength(message: SMSMessage): number {
    let length = 10; // Type + Location + Priority + Flags + People
    length += 4; // Battery + TTL
    
    if (message.note) {
      length += message.note.length;
    }
    
    return length;
  }
}
