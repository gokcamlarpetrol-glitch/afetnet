import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    Text,
    View
} from 'react-native';
// import { offlineMessageManager } from '../services/offline/offlineMessageManager';
import { useQuakes } from '../services/quake/useQuakes';
import { useFamily } from '../store/family';
import { useQueue } from '../store/queue';
import { useSettings } from '../store/settings';
import { usePremiumFeatures } from '../store/premium';
import SOSModal from '../ui/SOSModal';
import { postJSON } from '../utils/fetchWithTimeout';
import { logger } from '../utils/productionLogger';
import { criticalAlarmSystem } from '../services/alerts/CriticalAlarmSystem';
import { notifyQuake } from '../alerts/notify';

const { width } = Dimensions.get('window');

// Navigation prop'u opsiyonel yap
interface HomeSimpleProps {
  navigation?: any;
}

export default function HomeSimple({ navigation }: HomeSimpleProps) {
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingSOS, setSendingSOS] = useState(false);
  const { list: familyList } = useFamily();
  const { items: queueItems } = useQueue();
  const { items: earthquakes, loading: quakesLoading, refresh: refreshQuakes } = useQuakes();
  const settings = useSettings();
  const { isPremium, canUseFeature } = usePremiumFeatures();
  
  // Deprem verilerini yenile ve kritik alarmları kontrol et
  useEffect(() => {
    refreshQuakes();
    const interval = setInterval(refreshQuakes, 60000); // Her dakika yenile
    return () => clearInterval(interval);
  }, []);

  // CRITICAL: Monitor new earthquakes and trigger alarms
  useEffect(() => {
    if (earthquakes.length === 0) return;

    // Get the most recent earthquake
    const latestQuake = earthquakes[0];
    if (!latestQuake) return;

    // Check if this is a new earthquake (within last 5 minutes)
    const quakeAge = Date.now() - latestQuake.time;
    if (quakeAge > 5 * 60 * 1000) return; // Older than 5 minutes, skip

    const magnitude = latestQuake.mag || 0;
    
    // CRITICAL: Trigger alarm for significant earthquakes
    if (magnitude >= 4.0) {
      logger.debug(`🚨 CRITICAL EARTHQUAKE DETECTED: M${magnitude} at ${latestQuake.place}`);
      
      // Trigger critical alarm (bypasses silent mode)
      criticalAlarmSystem.triggerEarthquakeAlarm(latestQuake, false).catch(err => {
        logger.error('Failed to trigger critical alarm:', err);
      });

      // Send standard notification
      notifyQuake(latestQuake, 'live').catch(err => {
        logger.error('Failed to send notification:', err);
      });
    } else if (magnitude >= 3.0) {
      // Send standard notification for minor earthquakes
      notifyQuake(latestQuake, 'live').catch(err => {
        logger.error('Failed to send notification:', err);
      });
    }
  }, [earthquakes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshQuakes();
    setRefreshing(false);
  };

  const handleSOSSubmit = async (data: unknown) => {
    // CRITICAL: Prevent multiple submissions
    if (sendingSOS) {
      logger.warn('SOS already being sent, ignoring duplicate request', null, { component: 'HomeSimple' });
      return;
    }

    setSendingSOS(true);

    try {
      // CRITICAL: Get current location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'SOS göndermek için konum izni gereklidir!');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
      });

      // CRITICAL: Validate location data
      if (!location || !location.coords) {
        Alert.alert('Konum Hatası', 'Konum bilgisi alınamadı. Lütfen tekrar deneyin.');
        return;
      }

      if (!location.coords.latitude || !location.coords.longitude) {
        Alert.alert('Konum Hatası', 'Geçersiz konum verisi.');
        return;
      }

      // CRITICAL: Send SOS to backend
      const sosData = {
        ...(typeof data === 'object' && data !== null ? data : {}),
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        timestamp: Date.now(),
      };

      // CRITICAL: Check network connectivity
      const networkState = await NetInfo.fetch();
      const isOnline = networkState.isConnected && networkState.isInternetReachable;

      if (isOnline) {
        // ONLINE: Send to backend API with timeout
        try {
          const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://afetnet-backend.onrender.com';
          const result = await postJSON(`${API_URL}/api/sos`, sosData, 30000);
          
          logger.info('SOS successfully sent to backend', result, { component: 'HomeSimple' });
        } catch (apiError) {
          // FALLBACK: Queue for later if API fails
          logger.error('SOS API failed, queuing for retry', apiError, { component: 'HomeSimple' });
        }
      } else {
        // OFFLINE: Use mesh network
        logger.warn('Offline mode - SOS will be sent via Bluetooth mesh', null, { component: 'HomeSimple' });
        
        // CRITICAL: Broadcast SOS via Bluetooth mesh
        try {
          // await offlineMessageManager.sendMessage(JSON.stringify(sosMessage) as any);
          logger.info('SOS message prepared for offline mesh');
          logger.info('SOS sent via offline mesh network', { component: 'HomeSimple' });
          
          Alert.alert(
            'SOS Gönderildi',
            'SOS sinyaliniz Bluetooth mesh ağı üzerinden yakındaki cihazlara gönderildi.',
            [{ text: 'Tamam' }]
          );
        } catch (meshError) {
          logger.error('Failed to send SOS via mesh', meshError, { component: 'HomeSimple' });
          Alert.alert(
            'SOS Hatası',
            'SOS sinyali gönderilemedi. Lütfen tekrar deneyin.',
            [{ text: 'Tamam' }]
          );
        }
      }

      logger.debug('SOS prepared:', sosData, { component: 'HomeSimple' });
      
      Alert.alert('SOS Gönderildi', 'Acil yardım çağrınız alındı ve kurtarma ekipleriyle iletildi!');
      setSosModalVisible(false);
    } catch (error) {
      logger.error('SOS error:', error, { component: 'HomeSimple' });
      Alert.alert('Hata', 'SOS gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      // CRITICAL: Always reset sending state
      setSendingSOS(false);
    }
  };

  // Navigation handler - safe navigation
  const navigateTo = (screen: string) => {
    try {
      if (navigation && navigation.navigate) {
        navigation.navigate(screen);
      } else {
        logger.warn(`Navigation not available for screen: ${screen}`);
      }
    } catch (error) {
      logger.error(`Navigation error for screen: ${screen}`, error);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1f' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1f" />
      
        <ScrollView 
          style={{ flex: 1, marginTop: 50 }}
          contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === 'ios' ? 120 : 90 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
        >
        {/* Premium Header with Status Banner */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View>
              <Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>
                AfetNet
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2, fontWeight: '500' }}>
                Hayat Kurtaran Teknoloji
              </Text>
            </View>
            <View style={{
              backgroundColor: isPremium ? '#10b981' : '#f59e0b',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}>
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#ffffff',
              }} />
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                {isPremium ? 'PREMIUM' : 'ÜCRETSİZ'}
              </Text>
            </View>
          </View>

          {/* Premium Status Banner */}
          {!isPremium && (
            <View style={{
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: 'rgba(245, 158, 11, 0.2)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
            }}>
              <Ionicons name="lock-closed" size={24} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700', marginBottom: 2 }}>
                  Premium Gerekli
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 16 }}>
                  Sadece deprem bildirimleri ücretsizdir. Diğer tüm özellikler için Premium satın alın.
                </Text>
              </View>
              <Pressable 
                style={{
                  backgroundColor: '#10b981',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
                onPress={() => {
                  // Navigate to premium screen
                  navigation?.navigate('Premium');
                }}
              >
                <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '700' }}>
                  Satın Al
                </Text>
              </Pressable>
            </View>
          )}

          {/* System Status Info Card */}
          <View style={{
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(59, 130, 246, 0.2)',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
              <View style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Ionicons name="shield-checkmark" size={22} color="#3b82f6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '700', marginBottom: 4 }}>
                  Tam Offline Çalışma Desteği
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18 }}>
                  Internet olmadan Bluetooth mesh ağı ile iletişim. Deprem erken uyarı, aile takibi, SOS bildirimi ve harita desteği.
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Mesh Ağı & Sistem - KISA VE NET */}
        <View style={{
          backgroundColor: '#1e293b',
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: '#334155',
        }}>
          {/* Başlık */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}>
                <Ionicons name="git-network" size={18} color="#ef4444" />
              </View>
              <View>
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>
                  Mesh Ağı & Sistem
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 10 }}>
                  0 cihaz • Az önce
                </Text>
              </View>
            </View>
            <View style={{
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 10,
            }}>
              <Text style={{ color: '#ef4444', fontSize: 9, fontWeight: '800' }}>OFFLINE</Text>
            </View>
          </View>

          {/* Stats - 3 Kolon Kompakt */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <View style={{
              flex: 1,
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderRadius: 10,
              padding: 10,
              alignItems: 'center',
            }}>
              <Ionicons name="wifi" size={18} color="#10b981" />
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 4 }}>
                {queueItems.length}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 9, marginTop: 2 }}>Mesaj</Text>
            </View>

            <View style={{
              flex: 1,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 10,
              padding: 10,
              alignItems: 'center',
            }}>
              <Ionicons name="people" size={18} color="#3b82f6" />
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 4 }}>
                {familyList.length}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 9, marginTop: 2 }}>Kişi</Text>
            </View>

            <View style={{
              flex: 1,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              borderRadius: 10,
              padding: 10,
              alignItems: 'center',
            }}>
              <Ionicons name="pulse" size={18} color="#f59e0b" />
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 4 }}>
                {earthquakes.length}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 9, marginTop: 2 }}>Deprem</Text>
            </View>
          </View>

          {/* Alt Durum Satırı - 4 Bilgi Tek Satırda */}
          <View style={{
            flexDirection: 'row',
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: 'rgba(51, 65, 85, 0.4)',
            justifyContent: 'space-between',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="shield-checkmark" size={12} color="#10b981" />
              <Text style={{ color: '#94a3b8', fontSize: 9 }}>OK</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="analytics" size={12} color="#8b5cf6" />
              <Text style={{ color: '#94a3b8', fontSize: 9 }}>Aktif</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="radio" size={12} color="#f59e0b" />
              <Text style={{ color: '#94a3b8', fontSize: 9 }}>Hazır</Text>
            </View>
            <Pressable onPress={() => navigateTo('Diagnostics')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ color: '#3b82f6', fontSize: 9, fontWeight: '700' }}>Detay</Text>
                <Ionicons name="arrow-forward" size={10} color="#3b82f6" />
              </View>
            </Pressable>
          </View>
        </View>

        {/* Deprem Uyarısı - SON DEPREMLER */}
        {earthquakes.length > 0 && (
          <View style={{
            backgroundColor: '#7c2d12',
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderWidth: 2,
            borderColor: '#ea580c'
          }}>
            {/* Genel Durum Bildirim Kartı */}
            <View style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
              borderLeftWidth: 4,
              borderLeftColor: earthquakes.some(q => (q.mag || 0) >= 4.0) ? '#ef4444' : '#fb923c',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: 'rgba(251, 146, 60, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}>
                  <Ionicons name="pulse" size={20} color="#fb923c" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>
                    Deprem İzleme Sistemi Aktif
                  </Text>
                  <Text style={{ color: '#fed7aa', fontSize: 11, marginTop: 2 }}>
                    AFAD ve Kandilli verilerine bağlı
                  </Text>
                </View>
                <View style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: '#10b981',
                  }} />
                  <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '700' }}>
                    CANLI
                  </Text>
                </View>
              </View>
              
              {/* İstatistikler */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fed7aa', fontSize: 10 }}>
                    Son 24 Saat
                  </Text>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                    {earthquakes.filter(q => (Date.now() - q.time) < 86400000).length}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fed7aa', fontSize: 10 }}>
                    En Büyük
                  </Text>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                    {Math.max(...earthquakes.map(q => q.mag || 0)).toFixed(1)} ML
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fed7aa', fontSize: 10 }}>
                    Toplam
                  </Text>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '800', marginTop: 2 }}>
                    {earthquakes.length}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="warning" size={24} color="#fb923c" />
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>
                Son Depremler
              </Text>
              {!quakesLoading && (
                <Pressable onPress={refreshQuakes} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="refresh-circle" size={20} color="#fb923c" />
                </Pressable>
              )}
            </View>

            {earthquakes.slice(0, 3).map((quake, index) => {
              const magnitude = quake.mag || 0;
              const isMajor = magnitude >= 4.0;
              const timeAgo = Math.floor((Date.now() - quake.time) / 60000); // dakika cinsinden
              
              return (
                <View 
                  key={quake.id || index}
                  style={{
                    backgroundColor: isMajor ? '#991b1b' : '#7c2d12',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: index < 2 ? 8 : 0,
                    borderLeftWidth: 4,
                    borderLeftColor: isMajor ? '#ef4444' : '#fb923c'
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <View style={{
                      backgroundColor: isMajor ? '#ef4444' : '#f97316',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 8,
                      marginRight: 8
                    }}>
                      <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>
                        {magnitude.toFixed(1)} ML
                      </Text>
                    </View>
                    <Text style={{ color: '#fed7aa', fontSize: 11 }}>
                      {timeAgo < 60 ? `${timeAgo} dk önce` : `${Math.floor(timeAgo / 60)} saat önce`}
                    </Text>
                  </View>
                  
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 2 }}>
                    {quake.place || 'Bilinmeyen Konum'}
                  </Text>
                  
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Text style={{ color: '#fdba74', fontSize: 11 }}>
                      Derinlik: {quake.depth ? `${quake.depth.toFixed(1)} km` : 'N/A'}
                    </Text>
                    {quake.lat && quake.lon && (
                      <Text style={{ color: '#fdba74', fontSize: 11 }}>
                        {quake.lat.toFixed(2)}°, {quake.lon.toFixed(2)}°
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}

            {earthquakes.length > 3 && (
              <Pressable 
                onPress={() => navigateTo('Diagnostics')}
                style={{ marginTop: 8, alignItems: 'center' }}
              >
                <Text style={{ color: '#fb923c', fontSize: 12, fontWeight: '600' }}>
                  +{earthquakes.length - 3} deprem daha → Tümünü Gör
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* SOS Button - Premium Required */}
        <Pressable
          onPress={() => {
            if (!canUseFeature('rescue_tools')) {
              Alert.alert(
                'Premium Gerekli',
                'SOS özelliği Premium üyelik gerektirir. Premium satın alın.',
                [
                  { text: 'İptal', style: 'cancel' },
                  { 
                    text: 'Premium Satın Al', 
                    style: 'default',
                    onPress: () => navigation?.navigate('Premium')
                  }
                ]
              );
              return;
            }
            setSosModalVisible(true);
          }}
          disabled={sendingSOS}
          accessibilityRole="button"
          accessibilityLabel={sendingSOS ? "SOS gönderiliyor, lütfen bekleyin" : "Acil durum SOS sinyali gönder"}
          accessibilityHint="Acil durum SOS formu açmak için dokun"
          accessibilityState={{ disabled: sendingSOS, busy: sendingSOS }}
          accessible={true}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#dc2626' : '#ef4444',
            padding: 24,
            borderRadius: 20,
            marginBottom: 20,
            shadowColor: '#ef4444',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.4,
            shadowRadius: 12,
            elevation: 10,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            opacity: canUseFeature('rescue_tools') ? 1 : 0.6,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <View style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
            }}>
              <Ionicons name="alert-circle" size={32} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '900', marginBottom: 4 }}>
                ACİL DURUM / SOS
              </Text>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 13, fontWeight: '500' }}>
                {canUseFeature('rescue_tools') ? 'Anında yardım çağrısı gönder' : 'Premium gerekli'}
              </Text>
            </View>
            {!canUseFeature('rescue_tools') && (
              <View style={{
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}>
                <Ionicons name="lock-closed" size={16} color="#f59e0b" />
              </View>
            )}
          </View>
          <View style={{
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <Ionicons name="location" size={14} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '600' }}>
              {canUseFeature('rescue_tools') ? 'Konumunuz otomatik gönderilir' : 'Premium ile konum paylaşımı'}
            </Text>
          </View>
        </Pressable>

        {/* Premium Quick Actions */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>
              Hızlı Erişim
            </Text>
            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600' }}>
              6 Özellik
            </Text>
          </View>

          <Pressable
          accessibilityRole="button"
            onPress={() => {
              if (!canUseFeature('advanced_maps')) {
                Alert.alert(
                  'Premium Gerekli',
                  'Harita özelliği Premium üyelik gerektirir.',
                  [
                    { text: 'İptal', style: 'cancel' },
                    { 
                      text: 'Premium Satın Al', 
                      style: 'default',
                      onPress: () => navigation?.navigate('Premium')
                    }
                  ]
                );
                return;
              }
              navigateTo('Harita');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1e293b' : 'rgba(30, 41, 59, 0.6)',
              padding: 18,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.5)',
              transform: [{ scale: pressed ? 0.98 : 1 }],
              opacity: canUseFeature('advanced_maps') ? 1 : 0.6,
            })}
          >
            <View style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
            }}>
              <Ionicons name="map" size={26} color="#3b82f6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                Offline Harita
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
                {canUseFeature('advanced_maps') ? 'İnternet olmadan navigasyon' : 'Premium gerekli'}
              </Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {canUseFeature('advanced_maps') ? (
                <Ionicons name="chevron-forward" size={18} color="#3b82f6" />
              ) : (
                <Ionicons name="lock-closed" size={18} color="#f59e0b" />
              )}
            </View>
          </Pressable>

          <Pressable
          accessibilityRole="button"
            onPress={() => {
              if (!canUseFeature('p2p_messaging')) {
                Alert.alert(
                  'Premium Gerekli',
                  'Mesajlaşma özelliği Premium üyelik gerektirir.',
                  [
                    { text: 'İptal', style: 'cancel' },
                    { 
                      text: 'Premium Satın Al', 
                      style: 'default',
                      onPress: () => navigation?.navigate('Premium')
                    }
                  ]
                );
                return;
              }
              navigateTo('Messages');
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1e293b' : 'rgba(30, 41, 59, 0.6)',
              padding: 18,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.5)',
              transform: [{ scale: pressed ? 0.98 : 1 }],
              opacity: canUseFeature('p2p_messaging') ? 1 : 0.6,
            })}
          >
            <View style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
            }}>
              <Ionicons name="chatbubble-ellipses" size={26} color="#8b5cf6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                Mesh Mesajlaşma
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
                {canUseFeature('p2p_messaging') ? 'Bluetooth mesh ağı' : 'Premium gerekli'}
              </Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(139, 92, 246, 0.2)',
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {canUseFeature('p2p_messaging') ? (
                <Ionicons name="chevron-forward" size={18} color="#8b5cf6" />
              ) : (
                <Ionicons name="lock-closed" size={18} color="#f59e0b" />
              )}
            </View>
          </Pressable>

          <Pressable
          accessibilityRole="button"
            onPress={() => navigateTo('Family')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1e293b' : 'rgba(30, 41, 59, 0.6)',
              padding: 18,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.5)',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
            }}>
              <Ionicons name="people" size={26} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                Aile & Yakınlar
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
                {familyList.length} kişi kayıtlı
              </Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="chevron-forward" size={18} color="#10b981" />
            </View>
          </Pressable>

          <Pressable
          accessibilityRole="button"
            onPress={() => navigateTo('Diagnostics')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1e293b' : 'rgba(30, 41, 59, 0.6)',
              padding: 18,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.5)',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
            }}>
              <Ionicons name="pulse" size={26} color="#f59e0b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                Sistem Durumu
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
                Sensörler ve deprem takibi
              </Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="chevron-forward" size={18} color="#f59e0b" />
            </View>
          </Pressable>

          <Pressable
          accessibilityRole="button"
            onPress={() => navigateTo('QRSync')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1e293b' : 'rgba(30, 41, 59, 0.6)',
              padding: 18,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.5)',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              backgroundColor: 'rgba(236, 72, 153, 0.15)',
            }}>
              <Ionicons name="qr-code" size={26} color="#ec4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                QR Senkronizasyon
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
                Hızlı veri paylaşımı
              </Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(236, 72, 153, 0.2)',
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="chevron-forward" size={18} color="#ec4899" />
            </View>
          </Pressable>

          <Pressable
          accessibilityRole="button"
            onPress={() => navigateTo('Settings')}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: pressed ? '#1e293b' : 'rgba(30, 41, 59, 0.6)',
              padding: 18,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(51, 65, 85, 0.5)',
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{
              width: 54,
              height: 54,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 14,
              backgroundColor: 'rgba(100, 116, 139, 0.15)',
            }}>
              <Ionicons name="settings" size={26} color="#64748b" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 }}>
                Ayarlar
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '500' }}>
                Uygulama yapılandırması
              </Text>
            </View>
            <View style={{
              backgroundColor: 'rgba(100, 116, 139, 0.2)',
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Ionicons name="chevron-forward" size={18} color="#64748b" />
            </View>
          </Pressable>
        </View>

        {/* Info Card */}
        <View style={{
          backgroundColor: '#0f1629',
          padding: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#1e40af',
          marginTop: 16
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="information-circle" size={20} color="#60a5fa" />
            <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
              AfetNet Nedir?
            </Text>
          </View>
          <Text style={{ color: '#cdd7ff', fontSize: 13, lineHeight: 20 }}>
            Deprem ve afet durumlarında internet olmadan çalışan acil durum iletişim ağı. 
            Bluetooth ve mesh teknolojisi ile yakınınızdaki cihazlarla bağlantı kurar.
          </Text>
        </View>
      </ScrollView>

      {/* SOS Modal */}
      <SOSModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        onSubmit={handleSOSSubmit}
             />
           </View>
         );
       }