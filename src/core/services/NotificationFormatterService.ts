/**
 * NOTIFICATION FORMATTER SERVICE
 * ELITE: Tüm bildirimlerin özel ve profesyonel formatta gönderilmesi
 * Her bildirim türü için özel formatlar, emoji'ler ve mesajlar
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';
import { useSettingsStore } from '../stores/settingsStore';

const logger = createLogger('NotificationFormatterService');

export type NotificationType =
  | 'earthquake'
  | 'eew'
  | 'seismic_detection'
  | 'message'
  | 'family_location'
  | 'family_safety'
  | 'sos'
  | 'emergency'
  | 'news'
  | 'system'
  | 'premium'
  | 'checkin'
  | 'beacon'
  | 'network'
  | 'battery';

export interface FormattedNotification {
  title: string;
  body: string;
  emoji: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  sound?: string;
  vibrationPattern?: number[];
  ttsText?: string;
  data?: Record<string, unknown>;
}

/**
 * ELITE: Bildirim formatlayıcı servisi
 * Tüm bildirimlerin tutarlı ve profesyonel olmasını sağlar
 */
class NotificationFormatterService {
  /**
   * Deprem bildirimi formatla
   */
  formatEarthquakeNotification(
    magnitude: number,
    location: string,
    time?: Date,
    isEEW: boolean = false,
    timeAdvance?: number
  ): FormattedNotification {
    const settings = useSettingsStore.getState();
    
    let emoji: string;
    let title: string;
    let body: string;
    let priority: 'low' | 'normal' | 'high' | 'critical';
    let ttsText: string;

    if (isEEW && timeAdvance && timeAdvance >= 10) {
      // ERKEN UYARI - P ve S dalga uyarısı
      emoji = '⚠️';
      title = `⚠️ ERKEN UYARI: ${timeAdvance} Saniye Sonra Deprem!`;
      body = `📍 ${location}\n📊 Şiddet: ${magnitude.toFixed(1)} M\n⏱️ ${timeAdvance} saniye içinde deprem bekleniyor!\n\n🚨 Hemen güvenli bir yere geçin!`;
      priority = magnitude >= 6.0 ? 'critical' : magnitude >= 5.0 ? 'high' : 'normal';
      ttsText = `ERKEN UYARI! ${timeAdvance} saniye içinde deprem bekleniyor. Şiddet ${magnitude.toFixed(1)}. Hemen güvenli bir yere geçin!`;
    } else if (magnitude >= 6.0) {
      // KRİTİK DEPREM
      emoji = '🚨';
      title = `🚨 KRİTİK DEPREM: ${magnitude.toFixed(1)} M`;
      body = `📍 ${location}\n📊 Şiddet: ${magnitude.toFixed(1)} M\n⏰ ${time ? new Date(time).toLocaleTimeString('tr-TR') : 'Az önce'}\n\n🚨 KRİTİK SEVİYE! Hemen güvenli bir yere geçin!`;
      priority = 'critical';
      ttsText = `KRİTİK DEPREM! Şiddet ${magnitude.toFixed(1)}. Konum ${location}. Hemen güvenli bir yere geçin!`;
    } else if (magnitude >= 5.0) {
      // BÜYÜK DEPREM
      emoji = '⚠️';
      title = `⚠️ BÜYÜK DEPREM: ${magnitude.toFixed(1)} M`;
      body = `📍 ${location}\n📊 Şiddet: ${magnitude.toFixed(1)} M\n⏰ ${time ? new Date(time).toLocaleTimeString('tr-TR') : 'Az önce'}\n\n⚠️ Büyük şiddetli deprem tespit edildi!`;
      priority = 'high';
      ttsText = `Büyük deprem! Şiddet ${magnitude.toFixed(1)}. Konum ${location}.`;
    } else if (magnitude >= 4.0) {
      // ORTA ŞİDDET DEPREM
      emoji = '📢';
      title = `📢 Deprem: ${magnitude.toFixed(1)} M`;
      body = `📍 ${location}\n📊 Şiddet: ${magnitude.toFixed(1)} M\n⏰ ${time ? new Date(time).toLocaleTimeString('tr-TR') : 'Az önce'}`;
      priority = 'normal';
      ttsText = `Deprem tespit edildi. Şiddet ${magnitude.toFixed(1)}. Konum ${location}.`;
    } else {
      // DÜŞÜK ŞİDDET (varsayılan)
      emoji = '📢';
      title = `📢 Deprem: ${magnitude.toFixed(1)} M`;
      body = `📍 ${location}\n📊 Şiddet: ${magnitude.toFixed(1)} M`;
      priority = 'low';
      ttsText = `Deprem tespit edildi. Şiddet ${magnitude.toFixed(1)}.`;
    }

    return {
      title,
      body,
      emoji,
      priority,
      sound: magnitude >= 6.0 ? 'siren' : magnitude >= 5.0 ? 'alarm' : 'chime',
      vibrationPattern: magnitude >= 6.0 
        ? [0, 1000, 100, 1000, 100, 1000]
        : magnitude >= 5.0
        ? [0, 500, 200, 500, 200, 500]
        : [0, 200, 100, 200],
      ttsText,
      data: {
        type: 'earthquake',
        magnitude,
        location,
        time: time?.getTime() || Date.now(),
        isEEW,
        timeAdvance,
      },
    };
  }

  /**
   * EEW (Erken Uyarı) bildirimi formatla
   */
  formatEEWNotification(
    magnitude: number,
    location: string,
    timeAdvance: number,
    pWaveTime?: number,
    sWaveTime?: number
  ): FormattedNotification {
    let emoji: string;
    let title: string;
    let body: string;
    let priority: 'low' | 'normal' | 'high' | 'critical';

    if (timeAdvance >= 30) {
      emoji = '🌊';
      title = `🌊 P-DALGA TESPİT EDİLDİ`;
      body = `📍 ${location}\n📊 Şiddet: ${magnitude.toFixed(1)} M\n⏱️ P-dalga: ${pWaveTime ? Math.round(pWaveTime) : '?'}s\n⏱️ S-dalga: ${sWaveTime ? Math.round(sWaveTime) : '?'}s\n\n⚠️ Erken uyarı - Hazırlıklı olun!`;
      priority = magnitude >= 6.0 ? 'critical' : 'high';
    } else if (timeAdvance >= 10) {
      emoji = '⚠️';
      title = `⚠️ ERKEN UYARI: ${Math.round(timeAdvance)} Saniye!`;
      body = `📍 ${location}\n📊 Şiddet: ${magnitude.toFixed(1)} M\n⏱️ ${Math.round(timeAdvance)} saniye içinde deprem!\n\n🚨 Hemen güvenli bir yere geçin!`;
      priority = magnitude >= 6.0 ? 'critical' : 'high';
    } else {
      emoji = '🚨';
      title = `🚨 DEPREM GELİYOR!`;
      body = `📍 ${location}\n📊 Şiddet: ${magnitude.toFixed(1)} M\n⏱️ ${Math.round(timeAdvance)} saniye!\n\n🚨 KRİTİK! Hemen güvenli bir yere geçin!`;
      priority = 'critical';
    }

    return {
      title,
      body,
      emoji,
      priority,
      sound: 'siren',
      vibrationPattern: [0, 1000, 100, 1000, 100, 1000],
      ttsText: `ERKEN UYARI! ${Math.round(timeAdvance)} saniye içinde deprem bekleniyor. Şiddet ${magnitude.toFixed(1)}. Hemen güvenli bir yere geçin!`,
      data: {
        type: 'eew',
        magnitude,
        location,
        timeAdvance,
        pWaveTime,
        sWaveTime,
      },
    };
  }

  /**
   * Sismik sensör bildirimi formatla
   */
  formatSeismicDetectionNotification(
    magnitude: number,
    confidence: number,
    location: string
  ): FormattedNotification {
    const emoji = '🌊';
    const title = `🌊 P-DALGA TESPİT EDİLDİ`;
    const body = `📍 ${location}\n📊 Tahmini Şiddet: ${magnitude.toFixed(1)} M\n🎯 Güven: %${confidence}\n\n⚠️ P-dalga algılandı - Erken uyarı aktif!`;
    const priority: 'low' | 'normal' | 'high' | 'critical' = 
      confidence >= 80 && magnitude >= 5.0 ? 'high' : 'normal';

    return {
      title,
      body,
      emoji,
      priority,
      sound: confidence >= 80 ? 'alarm' : 'chime',
      vibrationPattern: [0, 300, 100, 300],
      ttsText: `P-dalga tespit edildi. Tahmini şiddet ${magnitude.toFixed(1)}.`,
      data: {
        type: 'seismic_detection',
        magnitude,
        confidence,
        location,
      },
    };
  }

  /**
   * Mesaj bildirimi formatla
   */
  formatMessageNotification(
    senderName: string,
    messageContent: string,
    isSOS: boolean = false,
    isCritical: boolean = false
  ): FormattedNotification {
    const truncatedContent = messageContent.length > 100
      ? messageContent.substring(0, 100) + '...'
      : messageContent;

    let emoji: string;
    let title: string;
    let body: string;
    let priority: 'low' | 'normal' | 'high' | 'critical';

    if (isSOS) {
      emoji = '🚨';
      title = `🚨 SOS MESAJI: ${senderName}`;
      body = `🚨 ACİL DURUM MESAJI\n\n${truncatedContent}\n\n🚨 Hemen yardım edin!`;
      priority = 'critical';
    } else if (isCritical) {
      emoji = '⚠️';
      title = `⚠️ ÖNEMLİ MESAJ: ${senderName}`;
      body = `⚠️ ${truncatedContent}`;
      priority = 'high';
    } else {
      emoji = '💬';
      title = `💬 ${senderName}`;
      body = truncatedContent;
      priority = 'normal';
    }

    return {
      title,
      body,
      emoji,
      priority,
      sound: isSOS ? 'siren' : isCritical ? 'alarm' : 'default',
      vibrationPattern: isSOS 
        ? [0, 1000, 200, 1000, 200, 1000]
        : isCritical
        ? [0, 500, 200, 500]
        : [0, 200],
      ttsText: isSOS 
        ? `SOS mesajı! ${senderName} acil yardım istiyor!`
        : `${senderName}: ${truncatedContent}`,
      data: {
        type: 'message',
        senderName,
        messageContent,
        isSOS,
        isCritical,
      },
    };
  }

  /**
   * Aile üyesi konum bildirimi formatla
   */
  formatFamilyLocationNotification(
    memberName: string,
    latitude: number,
    longitude: number,
    isUpdate: boolean = true
  ): FormattedNotification {
    const emoji = '📍';
    const title = isUpdate 
      ? `📍 ${memberName} Konum Güncellendi`
      : `📍 ${memberName} Yeni Konum`;
    const body = `👤 ${memberName}\n📍 Konum: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}\n⏰ ${new Date().toLocaleTimeString('tr-TR')}`;
    const priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';

    return {
      title,
      body,
      emoji,
      priority,
      sound: 'chime',
      vibrationPattern: [0, 200],
      ttsText: `${memberName} konum güncellendi.`,
      data: {
        type: 'family_location',
        memberName,
        latitude,
        longitude,
        isUpdate,
      },
    };
  }

  /**
   * Aile üyesi güvenlik bildirimi formatla
   */
  formatFamilySafetyNotification(
    memberName: string,
    status: 'safe' | 'unsafe' | 'unknown',
    lastSeen?: Date
  ): FormattedNotification {
    let emoji: string;
    let title: string;
    let body: string;
    let priority: 'low' | 'normal' | 'high' | 'critical';

    if (status === 'safe') {
      emoji = '✅';
      title = `✅ ${memberName} Güvende`;
      body = `👤 ${memberName}\n✅ Güvenlik durumu: Güvende\n⏰ ${lastSeen ? new Date(lastSeen).toLocaleTimeString('tr-TR') : 'Az önce'}`;
      priority = 'normal';
    } else if (status === 'unsafe') {
      emoji = '⚠️';
      title = `⚠️ ${memberName} Güvende Değil`;
      body = `👤 ${memberName}\n⚠️ Güvenlik durumu: Güvende değil\n⏰ Son görülme: ${lastSeen ? new Date(lastSeen).toLocaleTimeString('tr-TR') : 'Bilinmiyor'}\n\n🚨 Hemen kontrol edin!`;
      priority = 'high';
    } else {
      emoji = '❓';
      title = `❓ ${memberName} Durum Bilinmiyor`;
      body = `👤 ${memberName}\n❓ Güvenlik durumu: Bilinmiyor\n⏰ Son görülme: ${lastSeen ? new Date(lastSeen).toLocaleTimeString('tr-TR') : 'Bilinmiyor'}`;
      priority = 'normal';
    }

    return {
      title,
      body,
      emoji,
      priority,
      sound: status === 'unsafe' ? 'alarm' : 'chime',
      vibrationPattern: status === 'unsafe' ? [0, 500, 200, 500] : [0, 200],
      ttsText: status === 'safe'
        ? `${memberName} güvende.`
        : status === 'unsafe'
        ? `${memberName} güvende değil! Hemen kontrol edin!`
        : `${memberName} durumu bilinmiyor.`,
      data: {
        type: 'family_safety',
        memberName,
        status,
        lastSeen: lastSeen?.getTime(),
      },
    };
  }

  /**
   * SOS bildirimi formatla
   */
  formatSOSNotification(
    senderName: string,
    location?: { latitude: number; longitude: number },
    message?: string
  ): FormattedNotification {
    const emoji = '🚨';
    const title = `🚨 SOS SİNYALİ: ${senderName}`;
    const body = location
      ? `🚨 ACİL YARDIM İSTİYOR!\n\n👤 ${senderName}\n📍 Konum: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}\n${message ? `\n💬 ${message}` : ''}\n\n🚨 HEMEN YARDIM EDİN!`
      : `🚨 ACİL YARDIM İSTİYOR!\n\n👤 ${senderName}\n${message ? `\n💬 ${message}` : ''}\n\n🚨 HEMEN YARDIM EDİN!`;
    const priority: 'low' | 'normal' | 'high' | 'critical' = 'critical';

    return {
      title,
      body,
      emoji,
      priority,
      sound: 'siren',
      vibrationPattern: [0, 1000, 200, 1000, 200, 1000, 200, 1000],
      ttsText: `SOS SİNYALİ! ${senderName} acil yardım istiyor! Hemen yardım edin!`,
      data: {
        type: 'sos',
        senderName,
        location,
        message,
      },
    };
  }

  /**
   * Acil durum bildirimi formatla
   */
  formatEmergencyNotification(
    title: string,
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): FormattedNotification {
    const emoji = severity === 'critical' ? '🚨' : severity === 'high' ? '⚠️' : '📢';
    const priority: 'low' | 'normal' | 'high' | 'critical' = 
      severity === 'critical' ? 'critical' : severity === 'high' ? 'high' : 'normal';

    return {
      title: `${emoji} ${title}`,
      body: message,
      emoji,
      priority,
      sound: severity === 'critical' ? 'siren' : severity === 'high' ? 'alarm' : 'chime',
      vibrationPattern: severity === 'critical'
        ? [0, 1000, 100, 1000, 100, 1000]
        : severity === 'high'
        ? [0, 500, 200, 500]
        : [0, 200],
      ttsText: message,
      data: {
        type: 'emergency',
        severity,
      },
    };
  }

  /**
   * Haber bildirimi formatla
   */
  formatNewsNotification(
    headline: string,
    summary: string,
    source: string
  ): FormattedNotification {
    const emoji = '📰';
    const title = `📰 ${headline}`;
    const body = `${summary}\n\n📰 Kaynak: ${source}`;
    const priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';

    return {
      title,
      body,
      emoji,
      priority,
      sound: 'chime',
      vibrationPattern: [0, 200],
      ttsText: `${headline}. ${summary}`,
      data: {
        type: 'news',
        headline,
        summary,
        source,
      },
    };
  }

  /**
   * Sistem bildirimi formatla
   */
  formatSystemNotification(
    message: string,
    type: 'info' | 'warning' | 'error' | 'success'
  ): FormattedNotification {
    const emoji = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
    const title = `${emoji} ${message}`;
    const priority: 'low' | 'normal' | 'high' | 'critical' = 
      type === 'error' ? 'high' : type === 'warning' ? 'normal' : 'low';

    return {
      title,
      body: message,
      emoji,
      priority,
      sound: type === 'error' ? 'alarm' : 'chime',
      vibrationPattern: type === 'error' ? [0, 500] : [0, 200],
      data: {
        type: 'system',
        systemType: type,
      },
    };
  }

  /**
   * Premium bildirimi formatla
   */
  formatPremiumNotification(
    message: string,
    type: 'unlocked' | 'expired' | 'trial_ending'
  ): FormattedNotification {
    const emoji = type === 'unlocked' ? '⭐' : type === 'expired' ? '⏰' : '⚠️';
    const title = `${emoji} Premium ${type === 'unlocked' ? 'Aktif' : type === 'expired' ? 'Süresi Doldu' : 'Deneme Bitiyor'}`;
    const body = message;
    const priority: 'low' | 'normal' | 'high' | 'critical' = 'normal';

    return {
      title,
      body,
      emoji,
      priority,
      sound: 'chime',
      vibrationPattern: [0, 200],
      data: {
        type: 'premium',
        premiumType: type,
      },
    };
  }

  /**
   * Check-in bildirimi formatla
   */
  formatCheckinNotification(
    memberName: string,
    location: string,
    isSafe: boolean
  ): FormattedNotification {
    const emoji = isSafe ? '✅' : '⚠️';
    const title = `${emoji} ${memberName} Check-in`;
    const body = isSafe
      ? `👤 ${memberName}\n✅ Güvende\n📍 ${location}\n⏰ ${new Date().toLocaleTimeString('tr-TR')}`
      : `👤 ${memberName}\n⚠️ Güvende değil\n📍 ${location}\n⏰ ${new Date().toLocaleTimeString('tr-TR')}`;
    const priority: 'low' | 'normal' | 'high' | 'critical' = isSafe ? 'normal' : 'high';

    return {
      title,
      body,
      emoji,
      priority,
      sound: isSafe ? 'chime' : 'alarm',
      vibrationPattern: isSafe ? [0, 200] : [0, 500, 200, 500],
      data: {
        type: 'checkin',
        memberName,
        location,
        isSafe,
      },
    };
  }

  /**
   * Beacon bildirimi formatla
   */
  formatBeaconNotification(
    beaconName: string,
    distance: number,
    isNearby: boolean
  ): FormattedNotification {
    const emoji = isNearby ? '📍' : '📡';
    const title = `${emoji} Beacon: ${beaconName}`;
    const body = isNearby
      ? `📍 ${beaconName} yakında!\n📏 Mesafe: ${distance.toFixed(0)}m\n⏰ ${new Date().toLocaleTimeString('tr-TR')}`
      : `📡 ${beaconName} tespit edildi\n📏 Mesafe: ${distance.toFixed(0)}m`;
    const priority: 'low' | 'normal' | 'high' | 'critical' = isNearby ? 'normal' : 'low';

    return {
      title,
      body,
      emoji,
      priority,
      sound: isNearby ? 'chime' : undefined,
      vibrationPattern: isNearby ? [0, 200] : undefined,
      data: {
        type: 'beacon',
        beaconName,
        distance,
        isNearby,
      },
    };
  }

  /**
   * Network bildirimi formatla
   */
  formatNetworkNotification(
    status: 'connected' | 'disconnected' | 'slow',
    networkType?: string
  ): FormattedNotification {
    const emoji = status === 'connected' ? '✅' : status === 'disconnected' ? '❌' : '⚠️';
    const title = `${emoji} Ağ ${status === 'connected' ? 'Bağlandı' : status === 'disconnected' ? 'Kesildi' : 'Yavaş'}`;
    const body = networkType
      ? `🌐 ${networkType}\n${status === 'connected' ? '✅ Bağlantı başarılı' : status === 'disconnected' ? '❌ Bağlantı kesildi' : '⚠️ Yavaş bağlantı'}`
      : status === 'connected' ? '✅ Ağ bağlantısı başarılı' : status === 'disconnected' ? '❌ Ağ bağlantısı kesildi' : '⚠️ Yavaş ağ bağlantısı';
    const priority: 'low' | 'normal' | 'high' | 'critical' = status === 'disconnected' ? 'normal' : 'low';

    return {
      title,
      body,
      emoji,
      priority,
      sound: status === 'disconnected' ? 'chime' : undefined,
      data: {
        type: 'network',
        status,
        networkType,
      },
    };
  }

  /**
   * Battery bildirimi formatla
   */
  formatBatteryNotification(
    level: number,
    isLow: boolean,
    isCharging: boolean
  ): FormattedNotification {
    const emoji = isLow ? '🔋' : isCharging ? '⚡' : '🔋';
    const title = isLow
      ? `🔋 Düşük Pil: %${level}`
      : isCharging
      ? `⚡ Şarj Oluyor: %${level}`
      : `🔋 Pil: %${level}`;
    const body = isLow
      ? `🔋 Pil seviyesi düşük!\n📊 Mevcut: %${level}\n\n⚠️ Güç tasarrufu modunu açın!`
      : isCharging
      ? `⚡ Şarj oluyor\n📊 Seviye: %${level}`
      : `🔋 Pil durumu\n📊 Seviye: %${level}`;
    const priority: 'low' | 'normal' | 'high' | 'critical' = isLow ? 'normal' : 'low';

    return {
      title,
      body,
      emoji,
      priority,
      sound: isLow ? 'chime' : undefined,
      data: {
        type: 'battery',
        level,
        isLow,
        isCharging,
      },
    };
  }
}

export const notificationFormatterService = new NotificationFormatterService();








