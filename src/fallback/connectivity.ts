import NetInfo from '@react-native-community/netinfo';
import * as SMS from 'expo-sms';
import { Alert } from 'react-native';
import { useIce } from '../store/ice';

class ConnectivityWatcher {
  private unsubscribe: (() => void) | null = null;
  private isWatching = false;
  private lastBannerTime = 0;
  private bannerCooldown = 30000; // 30 seconds

  startWatching() {
    if (this.isWatching) return;

    this.isWatching = true;
    this.unsubscribe = NetInfo.addEventListener(state => {
      this.checkSMSAvailability(state);
    });

    // Initial check
    NetInfo.fetch().then(state => {
      this.checkSMSAvailability(state);
    });
  }

  stopWatching() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isWatching = false;
  }

  private async checkSMSAvailability(netInfo: any) {
    const { queue, getNextQueued, markSent } = useIce.getState();
    
    // Check if we have queued messages
    const nextQueued = getNextQueued();
    if (!nextQueued) return;

    // Check connectivity
    const hasCellular = netInfo.type === 'cellular' && netInfo.isConnected;
    if (!hasCellular) return;

    // Check SMS availability
    try {
      const isSMSAvailable = await SMS.isAvailableAsync();
      if (!isSMSAvailable) return;

      // Check banner cooldown
      const now = Date.now();
      if (now - this.lastBannerTime < this.bannerCooldown) return;

      this.lastBannerTime = now;
      this.showSMSBanner(nextQueued);

    } catch (error) {
      console.warn('Failed to check SMS availability:', error);
    }
  }

  private showSMSBanner(queueItem: any) {
    const { queue } = useIce.getState();
    const queueLength = queue.filter(item => !item.sent).length;

    Alert.alert(
      'SMS Gönderime Hazır',
      `${queueLength} mesaj sıra bekliyor. İlk mesajı göndermek için dokunun.`,
      [
        {
          text: 'Daha Sonra',
          style: 'cancel'
        },
        {
          text: 'Gönder',
          onPress: () => this.sendQueuedSMS(queueItem)
        }
      ]
    );
  }

  private async sendQueuedSMS(queueItem: any) {
    try {
      const { markSent, getNextQueued } = useIce.getState();
      
      // Open SMS composer
      await SMS.sendSMSAsync([queueItem.phone], queueItem.body);
      
      // Ask user if it was sent
      Alert.alert(
        'SMS Gönderildi mi?',
        `${queueItem.phone} numarasına mesaj gönderildi mi?`,
        [
          {
            text: 'Hayır',
            style: 'cancel'
          },
          {
            text: 'Evet',
            onPress: () => {
              markSent(queueItem.id);
              
              // Check for next queued item
              const nextQueued = getNextQueued();
              if (nextQueued) {
                setTimeout(() => {
                  this.showSMSBanner(nextQueued);
                }, 2000);
              }
            }
          }
        ]
      );

    } catch (error) {
      console.error('Failed to send SMS:', error);
      Alert.alert('Hata', 'SMS gönderilemedi');
    }
  }

  async sendQueuedManually(): Promise<boolean> {
    const { getNextQueued } = useIce.getState();
    const nextQueued = getNextQueued();
    
    if (!nextQueued) {
      Alert.alert('Bilgi', 'Sıra bekleyen SMS bulunamadı');
      return false;
    }

    try {
      const isSMSAvailable = await SMS.isAvailableAsync();
      if (!isSMSAvailable) {
        Alert.alert('Hata', 'SMS gönderimi bu cihazda desteklenmiyor');
        return false;
      }

      await this.sendQueuedSMS(nextQueued);
      return true;
    } catch (error) {
      console.error('Failed to send SMS manually:', error);
      Alert.alert('Hata', 'SMS gönderilemedi');
      return false;
    }
  }

  getLastBannerTime(): number {
    return this.lastBannerTime;
  }

  isWatching(): boolean {
    return this.isWatching;
  }
}

export const connectivityWatcher = new ConnectivityWatcher();
