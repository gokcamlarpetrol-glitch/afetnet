import bs58 from 'bs58';
import { verify } from '../crypto/sign';
import { Buffer } from 'buffer';

// This public key would be bundled with the app for verifying volunteer QRs
// In a real scenario, this would be a well-known public key from the issuing authority
const BUNDLED_VOLUNTEER_PUBKEY_BS58 = 'YOUR_BUNDLED_VOLUNTEER_PUBLIC_KEY_BASE58_HERE'; // Placeholder

export interface VolunteerQRPayload {
  id: string;
  name: string;
  role: string; // e.g., "medic", "search_rescue", "coordinator"
  issuedAt: number;
  expiresAt: number;
  publicKey: string; // Volunteer's public key
}

export interface VolunteerProfile {
  id: string;
  name: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
  isValid: boolean;
  isExpired: boolean;
  timeUntilExpiry?: number;
}

export class VolunteerQRVerifier {
  private static instance: VolunteerQRVerifier;

  private constructor() {}

  static getInstance(): VolunteerQRVerifier {
    if (!VolunteerQRVerifier.instance) {
      VolunteerQRVerifier.instance = new VolunteerQRVerifier();
    }
    return VolunteerQRVerifier.instance;
  }

  async parseSignedQR(qrData: string): Promise<VolunteerProfile | null> {
    try {
      const decoded = Buffer.from(bs58.decode(qrData)).toString('utf8');
      const signedData = JSON.parse(decoded);

      const { payload: payloadString, signature: encodedSignature } = signedData;
      const signature = bs58.decode(encodedSignature);

      const payload: VolunteerQRPayload = JSON.parse(payloadString);

      // Check expiration
      const now = Date.now();
      const isExpired = payload.expiresAt < now;
      const timeUntilExpiry = payload.expiresAt - now;

      // Verify signature with bundled public key
      const issuerPublicKey = bs58.decode(BUNDLED_VOLUNTEER_PUBKEY_BS58);
      const isValid = await verify(payloadString, signature, issuerPublicKey);

      if (!isValid) {
        console.warn('Volunteer QR signature invalid');
        return null;
      }

      const profile: VolunteerProfile = {
        id: payload.id,
        name: payload.name,
        role: payload.role,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        isValid: !isExpired,
        isExpired,
        timeUntilExpiry: Math.max(0, timeUntilExpiry),
      };

      console.log('Volunteer QR verified successfully:', profile.name);
      return profile;
    } catch (error) {
      console.error('Failed to parse or verify volunteer QR:', error);
      return null;
    }
  }

  async verifyVolunteerQR(qrData: string): Promise<{
    isValid: boolean;
    profile?: VolunteerProfile;
    error?: string;
  }> {
    try {
      const profile = await this.parseSignedQR(qrData);
      
      if (!profile) {
        return {
          isValid: false,
          error: 'QR kodu geçersiz veya imza doğrulaması başarısız',
        };
      }

      if (profile.isExpired) {
        return {
          isValid: false,
          profile,
          error: 'QR kodu süresi dolmuş',
        };
      }

      return {
        isValid: true,
        profile,
      };
    } catch (error) {
      console.error('Failed to verify volunteer QR:', error);
      return {
        isValid: false,
        error: 'QR kodu işlenirken hata oluştu',
      };
    }
  }

  getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'medic': 'Tıbbi Personel',
      'search_rescue': 'Arama Kurtarma',
      'coordinator': 'Koordinatör',
      'firefighter': 'İtfaiyeci',
      'police': 'Polis',
      'civil_defense': 'Sivil Savunma',
      'volunteer': 'Gönüllü',
    };

    return roleNames[role] || role;
  }

  getRoleIcon(role: string): string {
    const roleIcons: { [key: string]: string } = {
      'medic': '🏥',
      'search_rescue': '🚁',
      'coordinator': '📋',
      'firefighter': '🚒',
      'police': '👮',
      'civil_defense': '🛡️',
      'volunteer': '🤝',
    };

    return roleIcons[role] || '👤';
  }

  getRoleColor(role: string): string {
    const roleColors: { [key: string]: string } = {
      'medic': '#FF3B30',
      'search_rescue': '#007AFF',
      'coordinator': '#34C759',
      'firefighter': '#FF9500',
      'police': '#5856D6',
      'civil_defense': '#8E8E93',
      'volunteer': '#FFCC00',
    };

    return roleColors[role] || '#8E8E93';
  }

  formatExpiryTime(expiresAt: number): string {
    const now = Date.now();
    const timeLeft = expiresAt - now;

    if (timeLeft <= 0) {
      return 'Süresi dolmuş';
    }

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} gün ${hours} saat kaldı`;
    } else if (hours > 0) {
      return `${hours} saat ${minutes} dakika kaldı`;
    } else {
      return `${minutes} dakika kaldı`;
    }
  }

  async validateVolunteerPermissions(profile: VolunteerProfile, requiredRole?: string): Promise<{
    hasPermission: boolean;
    reason?: string;
  }> {
    // Check if volunteer is still valid
    if (!profile.isValid || profile.isExpired) {
      return {
        hasPermission: false,
        reason: 'Gönüllü sertifikası geçersiz veya süresi dolmuş',
      };
    }

    // Check role permissions
    if (requiredRole && profile.role !== requiredRole) {
      return {
        hasPermission: false,
        reason: `Bu işlem için ${this.getRoleDisplayName(requiredRole)} yetkisi gerekli`,
      };
    }

    return {
      hasPermission: true,
    };
  }

  async logVolunteerActivity(profile: VolunteerProfile, activity: string): Promise<void> {
    try {
      // In a real implementation, this would log to a secure audit trail
      console.log(`Volunteer activity logged: ${profile.name} (${profile.id}) - ${activity}`);
      
      // Could also store locally for offline access
      const activityLog = {
        volunteerId: profile.id,
        volunteerName: profile.name,
        activity,
        timestamp: Date.now(),
      };

      // Store in local database or secure storage
      // await this.storeActivityLog(activityLog);
    } catch (error) {
      console.error('Failed to log volunteer activity:', error);
    }
  }

  async getVolunteerStats(profile: VolunteerProfile): Promise<{
    totalActivities: number;
    lastActivity?: number;
    trustScore: number;
  }> {
    try {
      // In a real implementation, this would query the database
      return {
        totalActivities: 0,
        lastActivity: undefined,
        trustScore: 5, // Default trust score
      };
    } catch (error) {
      console.error('Failed to get volunteer stats:', error);
      return {
        totalActivities: 0,
        trustScore: 1,
      };
    }
  }

  // Utility method to check if a role has specific permissions
  hasRolePermission(role: string, permission: string): boolean {
    const permissions: { [key: string]: string[] } = {
      'medic': ['medical_assistance', 'triage', 'emergency_care'],
      'search_rescue': ['search_operations', 'rescue_operations', 'equipment_access'],
      'coordinator': ['coordination', 'resource_management', 'communication'],
      'firefighter': ['fire_suppression', 'rescue_operations', 'hazard_control'],
      'police': ['security', 'traffic_control', 'investigation'],
      'civil_defense': ['civil_protection', 'emergency_response', 'public_safety'],
      'volunteer': ['basic_assistance', 'information_sharing'],
    };

    return permissions[role]?.includes(permission) || false;
  }
}