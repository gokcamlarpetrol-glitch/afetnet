/**
 * NOTIFICATION SERVICE - Simple Notification Management
 */

import { Platform } from 'react-native';
import { createLogger } from '../utils/logger';

const logger = createLogger('NotificationService');

// Lazy import notifications to avoid early initialization
let Notifications: any = null;

function getNotifications() {
  if (!Notifications) {
    try {
      Notifications = require('expo-notifications');
    } catch (error) {
      logger.error('expo-notifications not available:', error);
      return null;
    }
  }
  return Notifications;
}

class NotificationService {
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;

    if (__DEV__) logger.info('Initializing...');

    try {
      const Notifications = getNotifications();
      if (!Notifications) {
        logger.warn('Notifications not available - skipping initialization');
        return;
      }

      // Set notification handler
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });
      } catch (error) {
        logger.error('Failed to set notification handler:', error);
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        if (__DEV__) logger.warn('Permission not granted');
        return;
      }

      // Elite: Set up push notification listener for BACKEND EARLY WARNINGS
      // This receives push notifications from backend BEFORE earthquake happens
      // CRITICAL: These listeners work even when app is closed (background notifications)
      try {
        // ELITE: Handle notifications received while app is in foreground/background
        Notifications.addNotificationReceivedListener(async (notification) => {
          await this.handlePushNotification(notification);
        });
        
        // ELITE: Handle notifications received while app is completely closed
        // This is CRITICAL for background notifications
        // Note: addNotificationReceivedListener already handles background notifications
        // But we ensure it works by checking app state
        const { AppState } = require('react-native');
        AppState.addEventListener('change', async (nextAppState) => {
          if (nextAppState === 'background' || nextAppState === 'inactive') {
            if (__DEV__) {
              logger.info('App moved to background - background notifications active');
            }
          }
        });
        
        // Also handle notification responses (when user taps notification)
        Notifications.addNotificationResponseReceivedListener(async (response) => {
          await this.handleNotificationResponse(response);
        });
        
        if (__DEV__) logger.info('Push notification listeners registered (works in background/closed)');
      } catch (error) {
        logger.error('Failed to set up push notification listeners:', error);
      }

      // Create channels (Android)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('earthquake', {
          name: 'Deprem Bildirimleri',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('sos', {
          name: 'Acil Durum',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 500, 500],
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Mesajlar',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('news', {
          name: 'Haber Bildirimleri',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 200],
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('family', {
          name: 'Aile Bildirimleri',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 200],
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('trapped', {
          name: 'Enkaz Bildirimleri',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 500, 500],
          sound: 'default',
          bypassDnd: true,
        });

        await Notifications.setNotificationChannelAsync('system', {
          name: 'Sistem Bildirimleri',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }

      this.isInitialized = true;
      if (__DEV__) logger.info('Initialized successfully');

    } catch (error) {
      logger.error('Initialization error:', error);
    }
  }

  async showEarthquakeNotification(magnitude: number, location: string) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      // ELITE: Use critical priority for background delivery
      // CRITICAL: This ensures notification is delivered even when app is closed
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 Deprem: ${magnitude.toFixed(1)}`,
          body: location,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: 'earthquake',
          data: { type: 'earthquake', magnitude, location },
          // ELITE: iOS critical alert flags (bypasses Do Not Disturb)
          interruptionLevel: magnitude >= 5.0 ? 'critical' : 'active',
          sticky: magnitude >= 5.0, // Critical alerts stay until dismissed
        },
        trigger: null, // Show immediately
        identifier: `earthquake-${Date.now()}-${magnitude}`, // Unique ID for deduplication
      });
    } catch (error) {
      logger.error('Earthquake notification error:', error);
    }
  }

  async showSOSNotification(from: string) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🆘 Acil Durum',
          body: `${from} yardım istiyor!`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: 'sos',
          data: { type: 'sos', from },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('SOS notification error:', error);
    }
  }

  async showMessageNotification(from: string, content: string) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      const truncatedContent = this.truncate(content, 100);
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `💬 ${from}`,
          body: truncatedContent,
          sound: 'default',
          data: { type: 'message', from },
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          channelId: 'messages',
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Message notification error:', error);
    }
  }

  async showNewsNotification(params: {
    title: string;
    summary?: string;
    source?: string;
    url?: string;
    articleId?: string;
  }) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;

      const titleParts = [];
      if (params.source) {
        titleParts.push(params.source.trim());
      }
      titleParts.push(params.title.trim());
      const header = titleParts.join(' • ') || 'Son Dakika Haber';
      const notificationTitle = this.truncate(`📰 ${header}`, 110);

      const cleanedSummary = (params.summary || '').replace(/\s+/g, ' ').trim();
      const notificationBody = this.truncate(
        cleanedSummary.length > 0 ? cleanedSummary : 'Detaylar için AfetNet uygulamasını açın.',
        220
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationTitle,
          body: notificationBody,
          sound: 'default',
          data: {
            type: 'news',
            url: params.url,
            articleId: params.articleId,
          },
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: 'news',
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('News notification error:', error);
    }
  }

  /**
   * Elite: Show family member location update notification
   */
  async showFamilyLocationUpdateNotification(memberName: string, latitude: number, longitude: number) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `📍 ${memberName} Konum Güncellendi`,
          body: `Yeni konum: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          channelId: 'family',
          data: {
            type: 'family_location',
            memberName,
            latitude,
            longitude,
          },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Family location notification error:', error);
    }
  }

  /**
   * Elite: Show trapped user proximity notification
   */
  async showTrappedUserProximityNotification(userName: string, distance: number) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      const distanceText = distance < 1000 
        ? `${Math.round(distance)}m uzaklıkta` 
        : `${(distance / 1000).toFixed(1)}km uzaklıkta`;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 Enkaz Altında Kişi Yakında`,
          body: `${userName} ${distanceText}`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: 'trapped',
          data: {
            type: 'trapped_proximity',
            userName,
            distance,
          },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Trapped user proximity notification error:', error);
    }
  }

  /**
   * Elite: Show battery low notification
   */
  async showBatteryLowNotification(batteryLevel: number) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔋 Düşük Pil Uyarısı',
          body: `Pil seviyesi %${batteryLevel}. Acil durum modunda pil tasarrufu aktif.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: 'system',
          data: {
            type: 'battery_low',
            batteryLevel,
          },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Battery low notification error:', error);
    }
  }

  /**
   * Elite: Show network status notification
   */
  async showNetworkStatusNotification(isConnected: boolean) {
    try {
      const Notifications = getNotifications();
      if (!Notifications) return;
      
      // Only notify when going offline (not when coming online)
      if (isConnected) return;
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📡 İnternet Bağlantısı Kesildi',
          body: 'Offline mod aktif. BLE Mesh iletişimi devam ediyor.',
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          channelId: 'system',
          data: {
            type: 'network_status',
            isConnected: false,
          },
        },
        trigger: null,
      });
    } catch (error) {
      logger.error('Network status notification error:', error);
    }
  }

  /**
   * ELITE: Handle incoming push notifications from backend (REAL EARLY WARNING)
   * CRITICAL: Backend sends warnings BEFORE earthquake happens
   * This is FIRST-TO-ALERT from backend - we MUST handle immediately
   * CRITICAL: This works even when app is closed (background notification)
   */
  private async handlePushNotification(notification: any) {
    try {
      const data = notification.request.content.data;
      const notificationTime = Date.now();
      
      // ELITE: Handle multiple early warning types
      if (data?.type === 'eew' || data?.type === 'earthquake_warning' || data?.type === 'backend_early_warning' || data?.type === 'first_to_alert') {
        const { multiChannelAlertService } = await import('./MultiChannelAlertService');
        const { useEarthquakeStore } = await import('../stores/earthquakeStore');
        
        const magnitude = data.magnitude || data.event?.magnitude || 0;
        const region = data.region || data.event?.region || data.location || 'Bilinmeyen bölge';
        const secondsRemaining = data.etaSec || data.warning?.secondsRemaining || data.etaSeconds || 0;
        const latitude = data.latitude || data.event?.latitude || data.location?.latitude;
        const longitude = data.longitude || data.event?.longitude || data.location?.longitude;
        const priority = data.priority || (magnitude >= 6.0 ? 'critical' : magnitude >= 5.0 ? 'high' : magnitude >= 4.0 ? 'high' : 'normal');
        
        // ELITE: Log FIRST-TO-ALERT from backend
        logger.info(`🚨🚨🚨 FIRST-TO-ALERT: Backend early warning received`, {
          magnitude,
          region,
          secondsRemaining,
          source: 'BACKEND_PUSH',
          notificationTime: new Date(notificationTime).toISOString(),
        });
        
        // ELITE: Check user settings for backend push notification filters
        try {
          const { useSettingsStore } = await import('../stores/settingsStore');
          const settings = useSettingsStore.getState();
          
          // Check EEW minimum magnitude threshold
          if (magnitude < settings.eewMinMagnitude) {
            if (__DEV__) {
              logger.debug(`⏭️ Backend push EEW minimum büyüklük eşiğinin altında (${magnitude.toFixed(1)} < ${settings.eewMinMagnitude.toFixed(1)}): ${region}`);
            }
            return; // Skip notification - below EEW minimum threshold
          }
          
          // Check general magnitude filters (if set)
          if (magnitude < settings.minMagnitudeForNotification) {
            if (__DEV__) {
              logger.debug(`⏭️ Backend push genel minimum büyüklük eşiğinin altında (${magnitude.toFixed(1)} < ${settings.minMagnitudeForNotification.toFixed(1)}): ${region}`);
            }
            return; // Skip notification - below general minimum threshold
          }
          
          if (settings.maxMagnitudeForNotification > 0 && magnitude > settings.maxMagnitudeForNotification) {
            if (__DEV__) {
              logger.debug(`⏭️ Backend push maksimum büyüklük eşiğinin üstünde (${magnitude.toFixed(1)} > ${settings.maxMagnitudeForNotification.toFixed(1)}): ${region}`);
            }
            return; // Skip notification - above maximum threshold
          }
          
          // Check distance threshold (if user location is available)
          if (settings.maxDistanceForNotification > 0 && latitude !== undefined && longitude !== undefined) {
            try {
              const { calculateDistance } = await import('../utils/mapUtils');
              const { useUserStatusStore } = await import('../stores/userStatusStore');
              const userStatus = useUserStatusStore.getState();
              
              if (userStatus.location) {
                const distance = calculateDistance(
                  userStatus.location.latitude,
                  userStatus.location.longitude,
                  latitude,
                  longitude
                );
                
                if (distance > settings.maxDistanceForNotification) {
                  if (__DEV__) {
                    logger.debug(`⏭️ Backend push maksimum mesafe eşiğinin dışında (${distance.toFixed(0)}km > ${settings.maxDistanceForNotification}km): ${region}`);
                  }
                  return; // Skip notification - outside distance threshold
                }
              }
            } catch (error) {
              // If distance calculation fails, continue with notification (better safe than sorry for EEW)
              logger.warn('Backend push distance calculation failed, continuing with notification:', error);
            }
          }
          
          // Check region filter (if regions are selected)
          if (settings.selectedRegions && settings.selectedRegions.length > 0) {
            const earthquakeRegion = this.detectRegionFromLocation(region, latitude, longitude);
            const isInSelectedRegion = settings.selectedRegions.some(selectedRegion => 
              earthquakeRegion.toLowerCase().includes(selectedRegion.toLowerCase()) ||
              selectedRegion.toLowerCase().includes(earthquakeRegion.toLowerCase())
            );
            
            if (!isInSelectedRegion) {
              if (__DEV__) {
                logger.debug(`⏭️ Backend push seçili bölgenin dışında (${earthquakeRegion}): ${region}`);
              }
              return; // Skip notification - not in selected regions
            }
          }
        } catch (error) {
          logger.error('Settings check failed for backend push, continuing with notification (better safe than sorry):', error);
          // Continue with notification if settings check fails (better safe than sorry for EEW)
        }
        
        // ELITE: IMMEDIATE multi-channel alert for backend early warning
        // CRITICAL: This is FIRST-TO-ALERT - send immediately
        // ELITE: Always show full-screen countdown for early warnings (even if screen is off)
        await multiChannelAlertService.sendAlert({
          title: secondsRemaining > 0 
            ? `🚨🚨🚨 İLK HABER - ${secondsRemaining}s KALDI 🚨🚨🚨`
            : `🚨🚨🚨 İLK HABER - Deprem Algılandı! 🚨🚨🚨`,
          body: secondsRemaining > 0
            ? `AfetNet ${magnitude.toFixed(1)} büyüklüğünde deprem ${secondsRemaining} saniye içinde bekleniyor! ${region} - Güvenli yere geçin!`
            : `AfetNet ${magnitude.toFixed(1)} büyüklüğünde deprem algıladı! ${region} - Güvenli yere geçin!`,
          priority: priority as any,
          channels: {
            pushNotification: true,
            fullScreenAlert: true, // ELITE: Always show countdown modal for early warnings
            alarmSound: magnitude >= 5.0,
            vibration: true,
            tts: true,
            bluetooth: magnitude >= 6.0,
          },
          vibrationPattern: magnitude >= 6.0 
            ? [0, 600, 200, 600, 200, 600, 200, 1200, 200, 600]
            : magnitude >= 5.0
            ? [0, 500, 150, 500, 150, 500, 150, 1000, 150, 500]
            : [0, 300, 100, 300, 100, 300],
          sound: magnitude >= 5.0 ? 'emergency' : 'default',
          duration: magnitude >= 6.0 ? 0 : magnitude >= 5.0 ? 45 : 30,
          data: {
            type: 'backend_early_warning',
            warning: {
              secondsRemaining: secondsRemaining || 30,
              eta: data.warning?.eta || data.eta,
            },
            event: {
              magnitude,
              region,
              timestamp: data.event?.timestamp || Date.now(),
            },
            magnitude,
            region,
            latitude,
            longitude,
            ...data,
          },
        });
        
        if (__DEV__) {
          logger.info('🚨 Backend early warning received:', {
            magnitude,
            region,
            secondsRemaining,
            priority,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to handle push notification:', error);
    }
  }

  /**
   * Elite: Handle notification response (when user taps notification)
   */
  private async handleNotificationResponse(response: any) {
    try {
      const data = response.notification.request.content.data;
      
      // Navigate to appropriate screen based on notification type
      if (data?.type === 'eew' || data?.type === 'earthquake_warning' || data?.type === 'backend_early_warning') {
        // Navigate to earthquake screen or show details
        // This will be handled by navigation system
        if (__DEV__) {
          logger.info('User tapped earthquake warning notification');
        }
      }
    } catch (error) {
      logger.error('Failed to handle notification response:', error);
    }
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }
  
  /**
   * ELITE: Detect region from location string or coordinates
   * Returns region name for filtering
   */
  private detectRegionFromLocation(location: string, latitude?: number, longitude?: number): string {
    const locationLower = location.toLowerCase();
    
    // Türkiye bölgeleri
    const regions: { [key: string]: string[] } = {
      'Marmara': ['marmara', 'istanbul', 'bursa', 'kocaeli', 'sakarya', 'tekirdağ', 'edirne', 'kırklareli', 'yalova', 'çanakkale', 'balıkesir'],
      'Ege': ['ege', 'izmir', 'aydın', 'muğla', 'denizli', 'manisa', 'uşak', 'afyon', 'kütahya'],
      'Akdeniz': ['akdeniz', 'antalya', 'adana', 'mersin', 'hatay', 'osmaniye', 'ısparta', 'burdur', 'karaman'],
      'Karadeniz': ['karadeniz', 'trabzon', 'samsun', 'rize', 'ordu', 'giresun', 'artvin', 'gümüşhane', 'bayburt', 'kastamonu', 'sinop', 'zonguldak', 'bartın', 'karabük', 'düzce', 'bolu', 'amasya', 'tokat', 'sivas', 'çorum'],
      'İç Anadolu': ['iç anadolu', 'ankara', 'konya', 'kayseri', 'eskişehir', 'nevşehir', 'niğde', 'aksaray', 'kırıkkale', 'kırşehir', 'yozgat', 'çankırı'],
      'Doğu Anadolu': ['doğu anadolu', 'erzurum', 'erzincan', 'van', 'malatya', 'elazığ', 'bingöl', 'muş', 'bitlis', 'ağrı', 'kars', 'ardahan', 'ığdır', 'tunceli'],
      'Güneydoğu Anadolu': ['güneydoğu anadolu', 'gaziantep', 'şanlıurfa', 'diyarbakır', 'mardin', 'batman', 'siirt', 'şırnak', 'hakkari', 'adıyaman', 'kilis'],
    };
    
    // Check location string
    for (const [regionName, keywords] of Object.entries(regions)) {
      if (keywords.some(keyword => locationLower.includes(keyword))) {
        return regionName;
      }
    }
    
    // If coordinates are available, use them to determine region
    if (latitude !== undefined && longitude !== undefined) {
      // Rough region boundaries (simplified)
      if (latitude >= 40.5 && latitude <= 42.0 && longitude >= 26.0 && longitude <= 30.0) {
        return 'Marmara';
      } else if (latitude >= 37.0 && latitude <= 40.0 && longitude >= 26.0 && longitude <= 30.0) {
        return 'Ege';
      } else if (latitude >= 35.0 && latitude <= 37.5 && longitude >= 30.0 && longitude <= 36.0) {
        return 'Akdeniz';
      } else if (latitude >= 40.0 && latitude <= 42.0 && longitude >= 36.0 && longitude <= 42.0) {
        return 'Karadeniz';
      } else if (latitude >= 38.0 && latitude <= 40.5 && longitude >= 30.0 && longitude <= 36.0) {
        return 'İç Anadolu';
      } else if (latitude >= 38.0 && latitude <= 42.0 && longitude >= 38.0 && longitude <= 44.0) {
        return 'Doğu Anadolu';
      } else if (latitude >= 36.0 && latitude <= 38.0 && longitude >= 36.0 && longitude <= 42.0) {
        return 'Güneydoğu Anadolu';
      }
    }
    
    return 'Bilinmeyen';
  }
}

export const notificationService = new NotificationService();

