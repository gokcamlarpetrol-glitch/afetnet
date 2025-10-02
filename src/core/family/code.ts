import bs58 from 'bs58';
import { generateKeyPair, sign, verify } from '../crypto/sign';
import { KeyPair } from '../crypto/keys';

const SHARE_CODE_VERSION = 1;
const SHARE_CODE_TTL_HOURS = 24; // Validity of the share code

export interface ShareCodePayload {
  version: number;
  timestamp: number;
  publicKey: string; // Base58 encoded public key of the device
  expiresAt: number;
}

export interface FamilyShareCode {
  code: string;
  payload: ShareCodePayload;
  deviceId: string;
  generatedAt: number;
  expiresAt: number;
}

export class ShareCodeGenerator {
  private static instance: ShareCodeGenerator;
  private deviceKeyPair: KeyPair;

  private constructor() {
    // In a real implementation, this would load from secure storage
    this.deviceKeyPair = generateKeyPair();
  }

  static getInstance(): ShareCodeGenerator {
    if (!ShareCodeGenerator.instance) {
      ShareCodeGenerator.instance = new ShareCodeGenerator();
    }
    return ShareCodeGenerator.instance;
  }

  async generateShareCode(deviceName: string): Promise<string> {
    try {
      const timestamp = Date.now();
      const expiresAt = timestamp + SHARE_CODE_TTL_HOURS * 60 * 60 * 1000; // 24 hours from now

      const payload: ShareCodePayload = {
        version: SHARE_CODE_VERSION,
        timestamp,
        publicKey: bs58.encode(this.deviceKeyPair.publicKey),
        expiresAt,
      };

      const payloadString = JSON.stringify(payload);
      const signature = await sign(payloadString, this.deviceKeyPair.secretKey);

      const signedData = {
        payload: payloadString,
        signature: bs58.encode(signature),
      };

      const shareCode = bs58.encode(Buffer.from(JSON.stringify(signedData), 'utf8'));
      
      console.log(`Generated share code for ${deviceName}: ${shareCode}`);
      return shareCode;
    } catch (error) {
      console.error('Failed to generate share code:', error);
      throw error;
    }
  }

  async verifyShareCode(shareCode: string): Promise<ShareCodePayload | null> {
    try {
      const decoded = Buffer.from(bs58.decode(shareCode)).toString('utf8');
      const signedData = JSON.parse(decoded);

      const { payload: payloadString, signature: encodedSignature } = signedData;
      const signature = bs58.decode(encodedSignature);

      const payload: ShareCodePayload = JSON.parse(payloadString);

      // Check expiration
      if (payload.expiresAt < Date.now()) {
        console.warn('Share code expired');
        return null;
      }

      const publicKey = bs58.decode(payload.publicKey);

      // Verify signature
      const isValid = await verify(payloadString, signature, publicKey);
      if (!isValid) {
        console.warn('Share code signature invalid');
        return null;
      }

      console.log('Share code verified successfully');
      return payload;
    } catch (error) {
      console.error('Failed to verify share code:', error);
      return null;
    }
  }

  async generateFamilyShareCode(familyMemberName: string): Promise<FamilyShareCode> {
    try {
      const code = await this.generateShareCode(familyMemberName);
      const payload = await this.verifyShareCode(code);
      
      if (!payload) {
        throw new Error('Failed to verify generated share code');
      }

      const familyShareCode: FamilyShareCode = {
        code,
        payload,
        deviceId: bs58.encode(this.deviceKeyPair.publicKey),
        generatedAt: payload.timestamp,
        expiresAt: payload.expiresAt,
      };

      console.log(`Generated family share code for ${familyMemberName}`);
      return familyShareCode;
    } catch (error) {
      console.error('Failed to generate family share code:', error);
      throw error;
    }
  }

  async createShareCodeQR(familyShareCode: FamilyShareCode): Promise<string> {
    try {
      // Create QR code data with metadata
      const qrData = {
        type: 'family_share_code',
        version: SHARE_CODE_VERSION,
        code: familyShareCode.code,
        deviceId: familyShareCode.deviceId,
        expiresAt: familyShareCode.expiresAt,
      };

      const qrString = JSON.stringify(qrData);
      
      console.log('Created QR code data for family share code');
      return qrString;
    } catch (error) {
      console.error('Failed to create share code QR:', error);
      throw error;
    }
  }

  async parseShareCodeQR(qrData: string): Promise<FamilyShareCode | null> {
    try {
      const parsed = JSON.parse(qrData);
      
      if (parsed.type !== 'family_share_code') {
        console.warn('Invalid QR code type');
        return null;
      }

      // Verify the share code
      const payload = await this.verifyShareCode(parsed.code);
      if (!payload) {
        console.warn('Invalid share code in QR');
        return null;
      }

      const familyShareCode: FamilyShareCode = {
        code: parsed.code,
        payload,
        deviceId: parsed.deviceId,
        generatedAt: payload.timestamp,
        expiresAt: parsed.expiresAt,
      };

      console.log('Parsed family share code from QR');
      return familyShareCode;
    } catch (error) {
      console.error('Failed to parse share code QR:', error);
      return null;
    }
  }

  async isShareCodeValid(shareCode: string): Promise<boolean> {
    const payload = await this.verifyShareCode(shareCode);
    return payload !== null;
  }

  async getShareCodeInfo(shareCode: string): Promise<{
    isValid: boolean;
    expiresAt?: number;
    timeUntilExpiry?: number;
    isExpired: boolean;
  }> {
    const payload = await this.verifyShareCode(shareCode);
    
    if (!payload) {
      return {
        isValid: false,
        isExpired: true,
      };
    }

    const now = Date.now();
    const timeUntilExpiry = payload.expiresAt - now;
    const isExpired = timeUntilExpiry <= 0;

    return {
      isValid: !isExpired,
      expiresAt: payload.expiresAt,
      timeUntilExpiry: Math.max(0, timeUntilExpiry),
      isExpired,
    };
  }

  async refreshShareCode(oldShareCode: string): Promise<string> {
    try {
      // Verify old share code first
      const oldPayload = await this.verifyShareCode(oldShareCode);
      if (!oldPayload) {
        throw new Error('Invalid old share code');
      }

      // Generate new share code with same public key
      const newPayload: ShareCodePayload = {
        ...oldPayload,
        timestamp: Date.now(),
        expiresAt: Date.now() + SHARE_CODE_TTL_HOURS * 60 * 60 * 1000,
      };

      const payloadString = JSON.stringify(newPayload);
      const signature = await sign(payloadString, this.deviceKeyPair.secretKey);

      const signedData = {
        payload: payloadString,
        signature: bs58.encode(signature),
      };

      const newShareCode = bs58.encode(Buffer.from(JSON.stringify(signedData), 'utf8'));
      
      console.log('Share code refreshed successfully');
      return newShareCode;
    } catch (error) {
      console.error('Failed to refresh share code:', error);
      throw error;
    }
  }

  getDevicePublicKey(): string {
    return bs58.encode(this.deviceKeyPair.publicKey);
  }

  getDeviceId(): string {
    return bs58.encode(this.deviceKeyPair.publicKey);
  }
}