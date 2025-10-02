import { HelpRequestRepository } from '../data/repositories';
import { P2PManager } from '../p2p';
import { HelpRequest, Priority } from '../data/models';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { TriageService } from './triage';
import { Preferences } from '../storage/prefs';

export class EmergencyService {
  private static instance: EmergencyService;
  private helpRequestRepository: HelpRequestRepository;
  private p2pManager: P2PManager;
  private triageService: TriageService;

  private constructor() {
    this.helpRequestRepository = new HelpRequestRepository();
    this.p2pManager = P2PManager.getInstance();
    this.triageService = TriageService.getInstance();
  }

  static getInstance(): EmergencyService {
    if (!EmergencyService.instance) {
      EmergencyService.instance = new EmergencyService();
    }
    return EmergencyService.instance;
  }

  async prepareEmergencyPing(): Promise<void> {
    try {
      // Check if shake detection is enabled
      const isShakeDetectionEnabled = await Preferences.get('shakeDetectionEnabled');
      if (!isShakeDetectionEnabled) {
        console.log('Shake detection is disabled in settings');
        return;
      }

      // Show confirmation dialog
      Alert.alert(
        'Sarsıntı Algılandı',
        'Cihazınızda sarsıntı algılandı. Acil yardım çağrısı göndermek ister misiniz?',
        [
          {
            text: 'İptal',
            style: 'cancel',
            onPress: () => {
              console.log('Emergency ping cancelled by user');
            },
          },
          {
            text: 'Yardım İste',
            onPress: () => this.sendEmergencyPing(),
          },
        ],
        { cancelable: false }
      );
    } catch (error) {
      console.error('Failed to prepare emergency ping:', error);
    }
  }

  private async sendEmergencyPing(): Promise<void> {
    try {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Konum İzni Gerekli',
          'Acil yardım çağrısı göndermek için konum izni vermelisiniz.'
        );
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy } = location.coords;

      // Create help request with shake detection flag
      const helpRequest: Partial<HelpRequest> = {
        ts: Date.now(),
        lat: latitude,
        lon: longitude,
        accuracy: accuracy || 0,
        priority: Priority.Critical, // Default to critical for shake detection
        underRubble: false, // User can specify this
        injured: false, // User can specify this
        peopleCount: 1,
        note: 'Sarsıntı algılandı - otomatik yardım çağrısı',
        battery: 0, // Will be updated by P2P manager
        anonymity: false,
        ttl: 8, // Higher TTL for emergency
        signature: '', // Will be signed by P2P manager
        delivered: false,
        hops: 0,
        source: 'self',
      };

      // Use triage service to determine priority
      const calculatedPriority = this.triageService.calculatePriority({
        injured: helpRequest.injured || false,
        underRubble: helpRequest.underRubble || false,
        lowBattery: false, // Would get from battery service
        repeatedCalls: 0,
        volunteerNearby: false,
        timeElapsed: 0,
        peopleCount: helpRequest.peopleCount || 1,
        locationAccuracy: helpRequest.accuracy || 0,
      });

      helpRequest.priority = calculatedPriority;

      // Save to database
      const savedRequest = await this.helpRequestRepository.create(helpRequest);

      // Enqueue for P2P broadcast
      await this.p2pManager.enqueueMessage({
        id: savedRequest.id,
        type: 'HELP_REQUEST',
        payload: savedRequest,
        ttl: savedRequest.ttl,
        hops: 0,
        timestamp: savedRequest.ts,
        signature: savedRequest.signature,
        source: 'self',
      });

      // Show success message
      Alert.alert(
        'Yardım Çağrısı Gönderildi',
        'Acil yardım çağrınız başarıyla gönderildi. Yardım ekibi bilgilendirildi.'
      );

      console.log('Emergency ping sent successfully:', savedRequest);
    } catch (error) {
      console.error('Failed to send emergency ping:', error);
      Alert.alert(
        'Hata',
        'Acil yardım çağrısı gönderilirken bir hata oluştu. Lütfen tekrar deneyin.'
      );
    }
  }

  async promptUser(): Promise<void> {
    try {
      Alert.alert(
        'Acil Durum Tespit Edildi',
        'Sarsıntı algılandı. Durumunuzu kontrol edin ve gerekirse yardım isteyin.',
        [
          {
            text: 'İyiyim',
            onPress: () => this.sendStatusUpdate('İyiyim, yardım gerekmiyor'),
          },
          {
            text: 'Yardım İste',
            onPress: () => this.sendEmergencyPing(),
          },
          {
            text: 'Daha Sonra',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Failed to prompt user:', error);
    }
  }

  private async sendStatusUpdate(note: string): Promise<void> {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy } = location.coords;

      // Create status ping
      const statusPing = {
        ts: Date.now(),
        lat: latitude,
        lon: longitude,
        battery: 0, // Would get from battery service
        note,
      };

      // Save status ping
      await this.helpRequestRepository.create({
        ...statusPing,
        priority: Priority.Normal,
        underRubble: false,
        injured: false,
        peopleCount: 1,
        anonymity: false,
        ttl: 3,
        signature: '',
        delivered: false,
        hops: 0,
        source: 'self',
      });

      console.log('Status update sent:', statusPing);
    } catch (error) {
      console.error('Failed to send status update:', error);
    }
  }

  // Utility methods
  async isShakeDetectionEnabled(): Promise<boolean> {
    return await Preferences.get('shakeDetectionEnabled');
  }

  async setShakeDetectionEnabled(enabled: boolean): Promise<void> {
    await Preferences.set('shakeDetectionEnabled', enabled);
  }

  async getShakeDetectionStats(): Promise<{
    enabled: boolean;
    lastTriggered?: number;
    triggerCount: number;
  }> {
    const enabled = await this.isShakeDetectionEnabled();
    const lastTriggered = await Preferences.get('lastShakeTriggered');
    const triggerCount = await Preferences.get('shakeTriggerCount') || 0;

    return {
      enabled,
      lastTriggered,
      triggerCount,
    };
  }

  async recordShakeTrigger(): Promise<void> {
    const currentCount = await Preferences.get('shakeTriggerCount') || 0;
    await Preferences.set('shakeTriggerCount', currentCount + 1);
    await Preferences.set('lastShakeTriggered', Date.now());
  }
}