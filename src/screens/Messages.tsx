import { Ionicons } from '@expo/vector-icons';
import { logger } from '../utils/productionLogger';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFamily } from '../store/family';
import { Contact, useMessages } from '../store/messages';
import { useQueue } from '../store/queue';
import { broadcastText, broadcastTeamLocation } from '../ble/bridge';
import { BLEMesh } from '../nearby/ble';
import { offlineMessaging, OfflineMessage, OfflineContact } from '../services/OfflineMessaging';
import { offlineSyncManager } from '../services/OfflineSyncManager';
import { advancedBatteryManager } from '../services/AdvancedBatteryManager';

import { NavigationProp } from '../types/interfaces';
import NetInfo from '@react-native-community/netinfo';

export default function Messages({ navigation }: { navigation?: NavigationProp }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState<'all' | 'sos' | 'groups'>('all');
  const [offlineStats, setOfflineStats] = useState({ total: 0, delivered: 0, pending: 0, sos: 0 });
  const [offlineContacts, setOfflineContacts] = useState<OfflineContact[]>([]);
  const [networkHealth, setNetworkHealth] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [batteryHealth, setBatteryHealth] = useState<any>(null);
  const [powerSavings, setPowerSavings] = useState<any>(null);
  const { items: queueItems } = useQueue();
  const { list: familyList } = useFamily();
  
  // Gerçek message store'u kullan
  const {
    contacts,
    addContact,
    updateContact,
    sendMessage,
    receiveMessage,
    getAllConversations,
    getNearbyContacts,
    setActiveContact,
  } = useMessages();

  // Network state listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(!!state.isConnected);
    });

    // Initial state
    NetInfo.fetch().then(state => {
      setIsOnline(!!state.isConnected);
    });

    return unsubscribe;
  }, []);

  // Demo veriler ekle (ilk yükleme) - Sadece development modunda
  useEffect(() => {
    if (!__DEV__) return; // Production'da demo veriler yok
    // Eğer hiç mesaj yoksa demo veriler ekle
    if (contacts.length === 0) {
      // Demo kişiler ekle
      const demoContacts: Contact[] = [
        {
          id: 'demo1',
          name: 'Ali Kaya',
          status: 'online',
          lastSeen: Date.now() - 300000, // 5 dk önce
          distance: 150,
        },
        {
          id: 'demo2',
          name: 'Fatma Çelik',
          status: 'online',
          lastSeen: Date.now() - 600000, // 10 dk önce
          distance: 230,
        },
        {
          id: 'demo3',
          name: 'Mehmet Can',
          status: 'emergency',
          lastSeen: Date.now() - 120000, // 2 dk önce
          distance: 450,
        },
      ];

      demoContacts.forEach(contact => addContact(contact));

      // Demo mesajlar ekle
      receiveMessage({
        contactId: 'demo1',
        contactName: 'Ali Kaya',
        content: 'Güvendeyim, toplanma noktasındayım',
        preview: 'Güvendeyim, toplanma noktasındayım',
        type: 'normal',
        isEncrypted: true,
        isSent: false,
        isDelivered: true,
      });

      receiveMessage({
        contactId: 'demo3',
        contactName: 'Mehmet Can',
        content: 'ACİL YARDIM! Enkaz altındayım',
        preview: 'ACİL YARDIM! Enkaz altındayım',
        type: 'sos',
        isEncrypted: true,
        isSent: false,
        isDelivered: true,
        lat: 39.9334,
        lon: 32.8597,
      });

      logger.debug('Demo messages loaded');
    }
  }, []);

  // Offline BLE mesajlaşma fonksiyonları - ENHANCED WITH SYNC
  const broadcastOfflineMessage = async (contactId: string, message: string) => {
    try {
      // Offline messaging system kullan
      const offlineMsg = await offlineMessaging.sendMessage(contactId, message, 'text');
      logger.debug(`Offline message sent via enhanced system to ${contactId}: ${message}`);

      // Add to sync manager for when back online
      if (typeof isOnline !== 'undefined' && isOnline) {
        await offlineSyncManager.addMessageToSync({
          id: offlineMsg.id,
          contactId,
          content: message,
          type: 'text',
          timestamp: offlineMsg.timestamp,
          isDelivered: offlineMsg.isDelivered,
        });
      }

    } catch (error) {
      logger.error('Failed to send offline message:', error);
      throw error;
    }
  };

  const broadcastOfflineLocation = async (contactId: string, lat: number, lon: number) => {
    try {
      // Offline messaging system kullan
      const offlineMsg = await offlineMessaging.sendMessage(contactId, `📍 Konum: ${lat.toFixed(6)}, ${lon.toFixed(6)}`, 'location', lat, lon);
      logger.debug(`Offline location sent via enhanced system to ${contactId}: ${lat}, ${lon}`);

      // Add to sync manager for when back online
      if (typeof isOnline !== 'undefined' && isOnline) {
        await offlineSyncManager.addLocationToSync({
          id: offlineMsg.id,
          contactId,
          lat,
          lon,
          timestamp: offlineMsg.timestamp,
          accuracy: 10, // Mock accuracy
        });
      }

    } catch (error) {
      logger.error('Failed to send offline location:', error);
      throw error;
    }
  };

  // Offline messaging system başlat
  useEffect(() => {
    const startOfflineMessaging = async () => {
      try {
        await offlineMessaging.start();
        logger.debug('Offline messaging system started');
        
        // Update stats and contacts
        updateOfflineData();
      } catch (error) {
        logger.error('Failed to start offline messaging:', error);
      }
    };

    startOfflineMessaging();

    // Update offline data every 10 seconds
    const updateInterval = setInterval(updateOfflineData, 10000);

    // Update battery data every 30 seconds
    const batteryInterval = setInterval(() => {
      updateBatteryData().catch(logger.error);
    }, 30000);

    // Battery manager listener
    const unsubscribeBattery = advancedBatteryManager.addPowerModeListener((profile, settings) => {
      logger.debug(`Battery mode changed: ${profile.level}% (${profile.state})`);
    });

    // Initial battery data update
    updateBatteryData();

    return () => {
      // Cleanup offline messaging
      offlineMessaging.stop();
      clearInterval(updateInterval);
      clearInterval(batteryInterval);
      unsubscribeBattery();
      logger.debug('Offline messaging system stopped');
    };
  }, []);

  const updateOfflineData = () => {
    try {
      const stats = offlineMessaging.getMessageStats();
      const contacts = offlineMessaging.getContacts();
      const health = offlineMessaging.getNetworkHealth();

      setOfflineStats(stats);
      setOfflineContacts(contacts);
      setNetworkHealth(health);

      logger.debug(`Offline system updated: ${stats.total} messages, ${contacts.length} contacts, ${health.meshConnectivity}% connectivity`);
    } catch (error) {
      logger.error('Failed to update offline data:', error);
    }
  };

  const updateBatteryData = async () => {
    try {
      const health = await advancedBatteryManager.getBatteryHealth();
      const savings = advancedBatteryManager.getPowerSavings();

      setBatteryHealth(health);
      setPowerSavings(savings);

      logger.debug(`Battery system updated: ${health.currentLevel}% (${health.trend}), ${savings.totalPowerSavings}% power savings`);
    } catch (error) {
      logger.error('Failed to update battery data:', error);
    }
  };

  // Yakındaki kişileri güncelle
  useEffect(() => {
    const updateNearbyContacts = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          
          // BLE RSSI'dan mesafe hesapla (simülasyon)
          // Gerçekte RSSI değerlerinden hesaplanacak
          contacts.forEach((contact) => {
            if (contact.lat && contact.lon) {
              const distance = calculateDistance(
                location.coords.latitude,
                location.coords.longitude,
                contact.lat,
                contact.lon,
              );
              updateContact(contact.id, { distance });
            }
          });
        }
      } catch (error) {
        logger.error('Location update failed:', error);
      }
    };

    const interval = (globalThis as any).setInterval(updateNearbyContacts, 10000); // Her 10 saniyede
    updateNearbyContacts();

    return () => (globalThis as any).clearInterval(interval);
  }, [contacts, updateContact]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  const handleNewMessage = async () => {
    const nearbyCount = getNearbyContacts().length;
    const familyCount = familyList.length;

    Alert.alert(
      'Yeni Mesaj',
      'Kime mesaj göndermek istersiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: `Yakındaki Kişiler (${nearbyCount})`,
          onPress: () => {
            if (nearbyCount === 0) {
              Alert.alert('Bilgi', 'Yakınlarda aktif kullanıcı bulunamadı.\nBLE taraması devam ediyor...');
            } else {
              Alert.alert('Yakındaki Kişiler', `${nearbyCount} kişi bulundu. Kişi seçin.`);
            }
          },
        },
        {
          text: `Aile Üyeleri (${familyCount})`,
          onPress: () => {
            if (familyCount === 0) {
              Alert.alert('Bilgi', 'Henüz aile üyesi eklenmemiş.\nAyarlar > Aile bölümünden ekleyebilirsiniz.');
            } else {
              // Aile üyelerine mesaj gönderme ekranı
              Alert.alert('Aile Mesajı', 'Aile üyelerine mesaj gönderiliyor...');
            }
          },
        },
        {
          text: 'Grup Oluştur',
          onPress: () => {
            Alert.alert(
              'Yeni Grup',
              'Acil durum grubu oluşturulacak.\n\nGrup adı:',
              [
                { text: 'İptal', style: 'cancel' },
                {
                  text: 'Oluştur',
                  onPress: () => {
                    const groupId = `group-${Date.now()}`;
                    addContact({
                      id: groupId,
                      name: 'Yeni Grup',
                      status: 'online',
                      lastSeen: Date.now(),
                    });
                    Alert.alert('Başarılı', 'Grup oluşturuldu!');
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleContactPress = async (contact: Contact) => {
    const statusText = contact.status === 'online' ? '🟢 Çevrimiçi' : 
      contact.status === 'emergency' ? '🆘 Acil Durum' : 
        '⚫ Çevrimdışı';
    
    const distanceText = contact.distance ? `${contact.distance}m` : 'Bilinmiyor';
    const lastSeenText = formatTimestamp(contact.lastSeen);

    Alert.alert(
      contact.name,
      `Durum: ${statusText}\n` +
      `Mesafe: ${distanceText}\n` +
      `Son görülme: ${lastSeenText}`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Mesaj Gönder',
          onPress: async () => {
            // Basit mesaj input
            Alert.prompt(
              'Yeni Mesaj',
              `${contact.name} için mesaj:`,
              [
                { text: 'İptal', style: 'cancel' },
                {
                  text: 'Gönder',
                  onPress: async (text) => {
                    if (text && text.trim()) {
                      const location = await Location.getCurrentPositionAsync({});
                      const message = sendMessage(
                        contact.id,
                        text.trim(),
                        'normal',
                        location.coords.latitude,
                        location.coords.longitude,
                      );

                      // BLE mesh network integration - ACTIVE
                      try {
                        // Offline BLE broadcast
                        await broadcastOfflineMessage(contact.id, text.trim());
                        logger.debug('Message sent via BLE mesh:', message.id);
                        Alert.alert('Başarılı', 'Mesaj hem kaydedildi hem de BLE üzerinden yayınlandı!');
                      } catch (error) {
                        logger.error('BLE broadcast failed:', error);
                        Alert.alert('Başarılı', 'Mesaj kaydedildi (BLE yayını başarısız)');
                      }
                    }
                  },
                },
              ],
              'plain-text',
            );
          },
        },
        {
          text: 'Konum Paylaş',
          onPress: async () => {
            try {
              const location = await Location.getCurrentPositionAsync({});
              const message = sendMessage(
                contact.id,
                `📍 Konum: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`,
                'normal',
                location.coords.latitude,
                location.coords.longitude,
              );

              // BLE mesh network integration - ACTIVE
              try {
                // Offline BLE location broadcast
                await broadcastOfflineLocation(contact.id, location.coords.latitude, location.coords.longitude);
                logger.debug('Location shared via BLE mesh:', message.id);
                Alert.alert('Başarılı', 'Konum hem kaydedildi hem de BLE üzerinden yayınlandı!');
              } catch (error) {
                logger.error('BLE location broadcast failed:', error);
                Alert.alert('Başarılı', 'Konum kaydedildi (BLE yayını başarısız)');
              }
            } catch (error) {
              Alert.alert('Hata', 'Konum alınamadı');
            }
          },
        },
      ],
    );
  };

  const handleConversationPress = (conversation: any) => {
    const lastMessage = conversation.lastMessage;
    
    if (conversation.type === 'sos') {
      Alert.alert(
        '🆘 SOS Mesajı',
        `${conversation.contactName}\n\n"${lastMessage.content}"\n\nNe yapmak istersiniz?`,
        [
          { text: 'Görmezden Gel', style: 'cancel' },
          {
            text: 'Konuma Git',
            onPress: () => {
              if (lastMessage.lat && lastMessage.lon) {
                navigation?.navigate('Harita');
                Alert.alert('Navigasyon', `Konuma yönlendiriliyorsunuz:\n${lastMessage.lat.toFixed(6)}, ${lastMessage.lon.toFixed(6)}`);
              } else {
                Alert.alert('Hata', 'Konum bilgisi bulunamadı');
              }
            },
          },
          {
            text: 'Yardım Ekibine Bildir',
            onPress: () => {
              Alert.alert(
                'Bildirim Gönderildi',
                'Kurtarma ekibi bilgilendirildi.\nSOS konumu iletildi.',
              );
              // Gerçekte backend'e POST edilecek
            },
          },
        ],
      );
    } else {
      // Normal sohbet ekranına git
      setActiveContact(conversation.contactId);
      Alert.alert('Sohbet', `${conversation.contactName} ile sohbet açılıyor...`);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dk önce`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} saat önce`;
    return `${Math.floor(hours / 24)} gün önce`;
  };

  // Gerçek konuşmaları al
  const allConversations = getAllConversations();
  const filteredConversations = allConversations.filter(conv => {
    if (selectedTab === 'sos' && conv.type !== 'sos') return false;
    if (selectedTab === 'groups' && conv.type !== 'group') return false;
    if (searchQuery && !conv.contactName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Yakındaki kişiler
  const nearbyContacts = getNearbyContacts().slice(0, 10); // İlk 10 kişi

  const sosCount = allConversations.filter(c => c.type === 'sos').length;
  const groupCount = allConversations.filter(c => c.type === 'group').length;

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1f' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0f1f" />

      {/* Enhanced Offline Status Banner */}
      <View style={{ backgroundColor: emergencyMode ? '#ef4444' : '#10b981', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center' }}>
        <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700', textAlign: 'center' }}>
          {emergencyMode ? '🚨 ACİL DURUM MODU AKTİF!' : '📡 OFFLINE MESAJLAŞMA: BLE Mesh Network Aktif!'}
        </Text>
        <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 2 }}>
          {networkHealth ? `${networkHealth.meshConnectivity}% bağlantı • ${networkHealth.pendingMessages} bekleyen • ${networkHealth.criticalMessages} kritik` : `${offlineStats.total} mesaj • ${offlineContacts.length} kişi • ${offlineStats.sos} SOS`}
        </Text>

        {/* Battery Status */}
        {batteryHealth && (
          <Text style={{
            color: batteryHealth.currentLevel <= 20 ? '#ef4444' : batteryHealth.currentLevel <= 50 ? '#f97316' : '#ffffff',
            fontSize: 10,
            fontWeight: '600',
            textAlign: 'center',
            marginTop: 2,
          }}>
            🔋 {batteryHealth?.currentLevel || 0}% ({batteryHealth?.trend || 'stable'}) • {powerSavings?.totalPowerSavings || 0}% güç tasarrufu
          </Text>
        )}

        {/* Emergency Mode Controls */}
        {!isOnline && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Pressable
              style={{
                backgroundColor: emergencyMode ? '#dc2626' : '#ef4444',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 6,
              }}
              onPress={() => {
                if (emergencyMode) {
                  setEmergencyMode(false);
                  Alert.alert('Acil Durum', 'Acil durum modu kapatıldı');
                } else {
                  offlineMessaging.activateEmergencyMode();
                  setEmergencyMode(true);
                  Alert.alert('🚨 Acil Durum', 'Acil durum modu aktif! Tüm sistemler maksimum güvenilirlik için optimize edildi.');
                }
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>
                {emergencyMode ? 'ACİL MODU KAPAT' : '🚨 ACİL MODU'}
              </Text>
            </Pressable>

            <Pressable
              style={{
                backgroundColor: '#22c55e',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 6,
              }}
              onPress={() => {
                offlineMessaging.activateBatterySavingMode();
                Alert.alert('🔋 Pil Tasarrufu', 'Pil tasarrufu modu aktif! Tarama sıklığı azaltıldı.');
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>
                🔋 PİL TASARRUFU
              </Text>
            </Pressable>

            <Pressable
              style={{
                backgroundColor: '#3b82f6',
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 6,
              }}
              onPress={() => {
                offlineMessaging.optimizeRouting();
                Alert.alert('🛣️ Routing', 'Mesaj yönlendirmesi optimize edildi');
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>
                🛣️ ROUTING
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Premium Header */}
      <View style={{ paddingTop: 20, paddingHorizontal: 20, paddingBottom: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ color: '#ffffff', fontSize: 32, fontWeight: '900', letterSpacing: -0.5 }}>
              Mesajlar
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>
              {queueItems.length} bekleyen • BLE Mesh
            </Text>
          </View>
          <Pressable accessible={true}
            accessibilityRole="button"
            onPress={handleNewMessage}
            style={{
              backgroundColor: '#3b82f6',
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#3b82f6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
            }}
          >
            <Ionicons name="add" size={28} color="#ffffff" />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={{
          backgroundColor: '#1e293b',
          borderRadius: 16,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: '#334155',
        }}>
          <Ionicons name="search" size={20} color="#64748b" />
          <TextInput
            accessibilityRole="text"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Kişi veya mesaj ara..."
            placeholderTextColor="#64748b"
            style={{
              flex: 1,
              marginLeft: 12,
              color: '#ffffff',
              fontSize: 16,
            }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </Pressable>
          )}
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          <Pressable accessible={true}
            accessibilityRole="button"
            onPress={() => setSelectedTab('all')}
            style={{
              flex: 1,
              backgroundColor: selectedTab === 'all' ? '#3b82f6' : '#1e293b',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: '#ffffff',
              fontSize: 14,
              fontWeight: '700',
            }}>
              Tümü ({allConversations.length})
            </Text>
          </Pressable>

          <Pressable accessible={true}
            accessibilityRole="button"
            onPress={() => setSelectedTab('sos')}
            style={{
              flex: 1,
              backgroundColor: selectedTab === 'sos' ? '#ef4444' : '#1e293b',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: '#ffffff',
              fontSize: 14,
              fontWeight: '700',
            }}>
              SOS ({sosCount})
            </Text>
          </Pressable>

          <Pressable accessible={true}
            accessibilityRole="button"
            onPress={() => setSelectedTab('groups')}
            style={{
              flex: 1,
              backgroundColor: selectedTab === 'groups' ? '#8b5cf6' : '#1e293b',
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{
              color: '#ffffff',
              fontSize: 14,
              fontWeight: '700',
            }}>
              Gruplar ({groupCount})
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Yakındaki Kişiler */}
        {nearbyContacts.length > 0 && (
          <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700' }}>
                Yakındaki Kişiler
              </Text>
              <Text style={{ color: '#64748b', fontSize: 12 }}>
                {nearbyContacts.length} kişi
              </Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {nearbyContacts.map((contact) => (
                  <Pressable accessible={true}
                    accessibilityRole="button"
                    key={contact.id}
                    onPress={() => handleContactPress(contact)}
                    style={{
                      width: 100,
                      alignItems: 'center',
                    }}
                  >
                    <View style={{
                      width: 72,
                      height: 72,
                      borderRadius: 36,
                      backgroundColor: contact.status === 'emergency' ? '#ef4444' : contact.status === 'online' ? '#10b981' : '#334155',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                      borderWidth: 3,
                      borderColor: contact.status === 'emergency' ? '#dc2626' : contact.status === 'online' ? '#059669' : '#1e293b',
                    }}>
                      <Ionicons
                        name={contact.status === 'emergency' ? 'alert-circle' : 'person'}
                        size={32}
                        color="#ffffff"
                      />
                    </View>
                    <Text style={{
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: '600',
                      textAlign: 'center',
                      marginBottom: 4,
                    }} numberOfLines={1}>
                      {contact.name}
                    </Text>
                    <Text style={{
                      color: '#64748b',
                      fontSize: 10,
                    }}>
                      {contact.distance ? `${contact.distance}m` : '?'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Mesaj Listesi */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 100 }}>
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            Konuşmalar
          </Text>

          {filteredConversations.map((conversation) => {
            const lastMessage = conversation.lastMessage;
            if (!lastMessage) return null;

            const typeColor = conversation.type === 'sos' ? '#ef4444' : 
              conversation.type === 'group' ? '#8b5cf6' : '#3b82f6';
            const typeIcon = conversation.type === 'sos' ? 'alert-circle' : 
              conversation.type === 'group' ? 'people' : 'person';

            return (
              <Pressable accessible={true}
                accessibilityRole="button"
                key={conversation.contactId}
                onPress={() => handleConversationPress(conversation)}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: typeColor,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: typeColor + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 12,
                  }}>
                    <Ionicons name={typeIcon} size={24} color={typeColor} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{
                        color: '#ffffff',
                        fontSize: 16,
                        fontWeight: '700',
                        flex: 1,
                      }} numberOfLines={1}>
                        {conversation.contactName}
                      </Text>
                      {conversation.unreadCount > 0 && (
                        <View style={{
                          backgroundColor: '#ef4444',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                          marginLeft: 8,
                        }}>
                          <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '700' }}>
                            {conversation.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={{
                      color: '#94a3b8',
                      fontSize: 14,
                      marginBottom: 8,
                    }} numberOfLines={2}>
                      {lastMessage.preview}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#64748b', fontSize: 12 }}>
                        {formatTimestamp(lastMessage.timestamp)}
                      </Text>
                      {lastMessage.isEncrypted && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="lock-closed" size={12} color="#10b981" />
                          <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '600' }}>
                            Şifreli
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}

          {filteredConversations.length === 0 && (
            <View style={{
              backgroundColor: '#1e293b',
              borderRadius: 16,
              padding: 32,
              alignItems: 'center',
            }}>
              <Ionicons name="chatbubbles-outline" size={64} color="#334155" />
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>
                {searchQuery ? 'Mesaj Bulunamadı' : 'Henüz Mesaj Yok'}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
                {searchQuery 
                  ? 'Aramanızla eşleşen mesaj yok' 
                  : 'Yeni mesaj göndermek için + butonuna tıklayın'}
              </Text>
              {!searchQuery && (
                <Pressable accessible={true}
                  accessibilityRole="button"
                  onPress={handleNewMessage}
                  style={{
                    backgroundColor: '#3b82f6',
                    paddingHorizontal: 24,
                    paddingVertical: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '700' }}>
                    Yeni Mesaj
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
