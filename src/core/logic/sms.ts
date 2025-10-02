import { Linking, Platform } from 'react-native';
import { MessageData } from '../p2p/message';

export class SMSEncoder {
  private static readonly BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  private static readonly MAX_SMS_LENGTH = 160;
  private static readonly HEADER_LENGTH = 10; // "AFETNET:" + separator

  static encodeMessage(message: MessageData): string {
    try {
      // Create compact representation
      const compact = {
        t: message.t, // type
        id: this.encodeId(message.id),
        ts: Math.floor(message.ts / 1000), // timestamp in seconds
        lat: Math.round(message.loc.lat * 10000), // 4 decimal places
        lon: Math.round(message.loc.lon * 10000),
        acc: Math.round(message.loc.acc / 10), // accuracy in 10m units
        p: message.prio, // priority
        f: this.encodeFlags(message.flags),
        pp: message.ppl, // people count
        tt: message.ttl,
      };

      // Add optional fields if they exist
      if (message.note) {
        compact.n = this.truncateNote(message.note);
      }
      if (message.batt !== undefined) {
        compact.b = message.batt;
      }

      // Convert to base32
      const jsonString = JSON.stringify(compact);
      const base32Encoded = this.toBase32(jsonString);

      // Add header
      const smsMessage = `AFETNET:${base32Encoded}`;

      // Check length
      if (smsMessage.length > this.MAX_SMS_LENGTH) {
        throw new Error('Message too long for SMS');
      }

      return smsMessage;
    } catch (error) {
      console.error('Failed to encode SMS message:', error);
      throw error;
    }
  }

  static decodeMessage(smsMessage: string): Partial<MessageData> | null {
    try {
      if (!smsMessage.startsWith('AFETNET:')) {
        throw new Error('Invalid SMS format');
      }

      const base32Data = smsMessage.substring(8); // Remove "AFETNET:" prefix
      const jsonString = this.fromBase32(base32Data);
      const compact = JSON.parse(jsonString);

      // Convert back to full message format
      const message: Partial<MessageData> = {
        t: compact.t,
        id: this.decodeId(compact.id),
        ts: compact.ts * 1000, // Convert back to milliseconds
        loc: {
          lat: compact.lat / 10000,
          lon: compact.lon / 10000,
          acc: compact.acc * 10,
        },
        prio: compact.p,
        flags: this.decodeFlags(compact.f),
        ppl: compact.pp,
        ttl: compact.tt,
      };

      if (compact.n) {
        message.note = compact.n;
      }
      if (compact.b !== undefined) {
        message.batt = compact.b;
      }

      return message;
    } catch (error) {
      console.error('Failed to decode SMS message:', error);
      return null;
    }
  }

  private static encodeId(id: string): string {
    // Convert UUID to shorter format (first 8 chars)
    return id.substring(0, 8);
  }

  private static decodeId(shortId: string): string {
    // In real implementation, this would need a mapping
    // For now, return the short ID
    return shortId;
  }

  private static encodeFlags(flags: MessageData['flags']): number {
    let encoded = 0;
    if (flags.underRubble) encoded |= 1;
    if (flags.injured) encoded |= 2;
    if (flags.anonymity) encoded |= 4;
    return encoded;
  }

  private static decodeFlags(encoded: number): MessageData['flags'] {
    return {
      underRubble: (encoded & 1) !== 0,
      injured: (encoded & 2) !== 0,
      anonymity: (encoded & 4) !== 0,
    };
  }

  private static truncateNote(note: string): string {
    const maxLength = 20; // Limit note length for SMS
    return note.length > maxLength ? note.substring(0, maxLength) + '...' : note;
  }

  private static toBase32(input: string): string {
    const bytes = Buffer.from(input, 'utf8');
    let result = '';
    let buffer = 0;
    let bitsLeft = 0;

    for (let i = 0; i < bytes.length; i++) {
      buffer = (buffer << 8) | bytes[i];
      bitsLeft += 8;

      while (bitsLeft >= 5) {
        result += this.BASE32_CHARS[(buffer >> (bitsLeft - 5)) & 31];
        bitsLeft -= 5;
      }
    }

    if (bitsLeft > 0) {
      result += this.BASE32_CHARS[(buffer << (5 - bitsLeft)) & 31];
    }

    return result;
  }

  private static fromBase32(input: string): string {
    const bytes: number[] = [];
    let buffer = 0;
    let bitsLeft = 0;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const index = this.BASE32_CHARS.indexOf(char.toUpperCase());
      
      if (index === -1) {
        throw new Error('Invalid base32 character');
      }

      buffer = (buffer << 5) | index;
      bitsLeft += 5;

      while (bitsLeft >= 8) {
        bytes.push((buffer >> (bitsLeft - 8)) & 255);
        bitsLeft -= 8;
      }
    }

    return Buffer.from(bytes).toString('utf8');
  }

  static async openSmsComposer(
    shortCode: string,
    message: string
  ): Promise<void> {
    try {
      const smsUrl = `sms:${shortCode}&body=${encodeURIComponent(message)}`;
      await Linking.openURL(smsUrl);
    } catch (error) {
      console.error('Failed to open SMS composer:', error);
      throw error;
    }
  }

  static createEmergencySMS(
    message: MessageData,
    shortCode: string = '112'
  ): string {
    const priorityLabels = ['Normal', 'High', 'Critical'];
    const priorityLabel = priorityLabels[message.prio] || 'Unknown';
    
    let smsText = `AFETNET Emergency Alert\n`;
    smsText += `Priority: ${priorityLabel}\n`;
    smsText += `Location: ${message.loc.lat.toFixed(4)}, ${message.loc.lon.toFixed(4)}\n`;
    
    if (message.flags.injured) {
      smsText += `⚠️ INJURED\n`;
    }
    if (message.flags.underRubble) {
      smsText += `⚠️ UNDER RUBBLE\n`;
    }
    
    smsText += `People: ${message.ppl}\n`;
    
    if (message.note) {
      smsText += `Note: ${message.note}\n`;
    }
    
    smsText += `Time: ${new Date(message.ts).toLocaleString()}\n`;
    smsText += `ID: ${message.id}`;

    return smsText;
  }

  static createStatusSMS(
    message: MessageData,
    shortCode: string = '112'
  ): string {
    let smsText = `AFETNET Status Update\n`;
    smsText += `Location: ${message.loc.lat.toFixed(4)}, ${message.loc.lon.toFixed(4)}\n`;
    smsText += `Status: Safe\n`;
    smsText += `People: ${message.ppl}\n`;
    
    if (message.batt !== undefined) {
      smsText += `Battery: ${message.batt}%\n`;
    }
    
    if (message.note) {
      smsText += `Note: ${message.note}\n`;
    }
    
    smsText += `Time: ${new Date(message.ts).toLocaleString()}\n`;
    smsText += `ID: ${message.id}`;

    return smsText;
  }

  static createResourceSMS(
    message: MessageData,
    shortCode: string = '112'
  ): string {
    let smsText = `AFETNET Resource Available\n`;
    smsText += `Location: ${message.loc.lat.toFixed(4)}, ${message.loc.lon.toFixed(4)}\n`;
    
    if (message.note) {
      smsText += `Resources: ${message.note}\n`;
    }
    
    smsText += `Time: ${new Date(message.ts).toLocaleString()}\n`;
    smsText += `ID: ${message.id}`;

    return smsText;
  }

  static getSMSLength(message: string): number {
    // Calculate SMS length considering GSM 7-bit encoding
    return message.length;
  }

  static isMessageTooLong(message: string): boolean {
    return this.getSMSLength(message) > this.MAX_SMS_LENGTH;
  }

  static splitLongMessage(message: string): string[] {
    if (!this.isMessageTooLong(message)) {
      return [message];
    }

    const parts: string[] = [];
    const maxLength = this.MAX_SMS_LENGTH - 10; // Reserve space for part indicator
    
    let remaining = message;
    let partNumber = 1;
    const totalParts = Math.ceil(message.length / maxLength);

    while (remaining.length > 0) {
      const partLength = Math.min(maxLength, remaining.length);
      const part = remaining.substring(0, partLength);
      const partWithHeader = `(${partNumber}/${totalParts}) ${part}`;
      
      parts.push(partWithHeader);
      remaining = remaining.substring(partLength);
      partNumber++;
    }

    return parts;
  }
}