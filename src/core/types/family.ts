/**
 * FAMILY TYPES — SINGLE-UID ARCHITECTURE v4.0
 * 
 * Every member is identified by Firebase Auth UID.
 * uid is the ONLY primary key. No legacy id field.
 */

export interface FamilyMember {
  /** Firebase Auth UID — TEK BİRİNCİL ANAHTAR */
  uid: string;
  /** Family group ID this member belongs to */
  familyId?: string;
  name: string;
  status: 'safe' | 'need-help' | 'unknown' | 'critical' | 'danger' | 'offline';
  /**
   * Last time the member explicitly updated their safety status.
   * Critical for life-safety: a "safe" status from 3 days ago is unreliable
   * and should be visually degraded by the UI to prevent false reassurance.
   */
  statusUpdatedAt?: number;
  /**
   * HATA 5 FIX: Mutual approval state.
   * - 'mutual' = karşılıklı onaylanmış (her iki taraf da görüyor)
   * - 'pending' = davet gönderildi, karşı taraf henüz kabul etmedi
   * - 'declined' = karşı taraf reddetti (yeni davet gönderilebilir)
   *
   * pending durumunda:
   *  - Uye listede gri renkli + "Onay bekliyor" badge ile gosterilir
   *  - Lokasyonu GORUNMEZ (KVKK + stalking koruma)
   *  - Durumu sadece "Bilinmiyor" olarak gosterilir
   *  - SOS gonderildiginde dahil edilmez (rıza yok)
   */
  approvalState?: 'mutual' | 'pending' | 'declined';
  lastSeen: number;
  latitude: number;
  longitude: number;
  location?: {
    latitude: number;
    longitude: number;
    timestamp?: number;
    accuracy?: number;
  };
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
    batteryLevelAtCapture: number;
    source: 'gps' | 'mesh' | 'cloud' | 'manual';
  };
  batteryLevel?: number;
  isOnline?: boolean;
  deviceId?: string; // BLE mesh device ID — sadece offline mesh routing için
  avatarUrl?: string;
  relationship?: string;
  phoneNumber?: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
  locationHistory?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  }[];
}
