/**
 * NOTIFICATION FORMATTER SERVICE - ELITE EDITION
 * Standardizes notification content across different channels and priorities.
 */

import { Platform } from 'react-native';

export interface FormattedNotification {
  title: string;
  body: string;
  priority: 'normal' | 'high' | 'critical';
  sound?: string;
  vibrationPattern?: number[];
  ttsText?: string;
  categoryId?: string; // ELITE: For interactive actions
  attachments?: { identifier: string; url: string; type: string }[]; // ELITE: For rich media
  data: any;
}

class NotificationFormatterService {

  formatEarthquakeNotification(
    magnitude: number,
    location: string,
    time: Date | undefined,
    isEEW: boolean,
    timeAdvance?: number,
  ): FormattedNotification {
    const timeStr = time ? time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '';
    const isCritical = magnitude >= 5.0 || isEEW;

    // Critical EEW Alert
    if (isEEW) {
      return {
        title: `🚨 DEPREM UYARISI (${magnitude.toFixed(1)})`,
        body: `Sarsıntı Bekleniyor! ${location} (~${timeAdvance || 0}sn)`,
        priority: 'critical',
        sound: 'siren.wav',
        vibrationPattern: [0, 500, 200, 500, 200, 500],
        ttsText: `Dikkat! Deprem uyarısı. ${location} bölgesinde ${magnitude.toFixed(1)} büyüklüğünde deprem bekleniyor. Güvenli yere geçin.`,
        categoryId: 'earthquake', // ELITE: Interactive actions
        data: { type: 'eew', magnitude, location, timestamp: time?.getTime() },
      };
    }

    // Standard Earthquake Alert
    return {
      title: `${magnitude >= 6.0 ? '🔴' : magnitude >= 5.0 ? '🟠' : '🟡'} Deprem: ${magnitude.toFixed(1)} ${location}`,
      body: `${timeStr} - Derinlik ve detaylar için dokunun.`,
      priority: isCritical ? 'high' : 'normal',
      sound: isCritical ? 'default' : undefined,
      vibrationPattern: isCritical ? [0, 250, 250, 250] : undefined,
      categoryId: 'earthquake', // ELITE: Interactive actions
      data: { type: 'earthquake', magnitude, location, timestamp: time?.getTime() },
    };
  }

  formatSOSNotification(from: string, location?: { latitude: number; longitude: number }, message?: string): FormattedNotification {
    return {
      title: `🆘 ACİL DURUM: ${from}`,
      body: message || 'Acil yardım çağrısı alındı. Konumu görmek için dokunun.',
      priority: 'critical',
      sound: 'siren.wav',
      vibrationPattern: [0, 1000, 500, 1000],
      ttsText: `Acil durum çağrısı! ${from} yardım istiyor.`,
      categoryId: 'sos', // ELITE: Interactive actions
      data: { type: 'sos', from, location },
    };
  }

  formatEEWNotification(magnitude: number, location: string, timeAdvance: number, pWaveTime?: number, sWaveTime?: number): FormattedNotification {
    return this.formatEarthquakeNotification(magnitude, location, new Date(), true, timeAdvance);
  }

  formatMessageNotification(from: string, message: string, isSOS?: boolean, isCritical?: boolean): FormattedNotification {
    return {
      title: isSOS ? `🆘 ${from}` : `💬 ${from}`,
      body: message,
      priority: isSOS || isCritical ? 'critical' : 'high',
      sound: 'default',
      ttsText: `${from} kişisinden yeni mesaj: ${message}`,
      data: { type: 'message', from, isSOS },
    };
  }

  formatNewsNotification(title: string, summary: string, source: string, imageUrl?: string): FormattedNotification {
    const notification: FormattedNotification = {
      title: `📰 ${title}`,
      body: summary.length > 100 ? summary.substring(0, 97) + '...' : summary,
      priority: 'normal',
      categoryId: 'news', // ELITE: Interactive actions
      data: { type: 'news', source, imageUrl },
    };

    // ELITE: Add rich media attachment if available
    if (imageUrl) {
      notification.attachments = [
        {
          identifier: 'news_image',
          url: imageUrl,
          type: 'image',
        },
      ];
    }

    return notification;
  }
}

export const notificationFormatterService = new NotificationFormatterService();
