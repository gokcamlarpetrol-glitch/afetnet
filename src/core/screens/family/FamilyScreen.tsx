/**
 * FAMILY SCREEN - Premium Design
 * Modern family safety chain with status buttons and member tracking
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { usePremiumStore } from '../../stores/premiumStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { multiChannelAlertService } from '../../services/MultiChannelAlertService';
import { StatusButton } from '../../components/family/StatusButton';
import { MemberCard } from '../../components/family/MemberCard';
import { colors, typography, spacing } from '../../theme';
import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';
import PremiumGate from '../../components/PremiumGate';

const logger = createLogger('FamilyScreen');


export default function FamilyScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [isPremium, setIsPremium] = useState(false);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [locationShareInterval, setLocationShareInterval] = useState<NodeJS.Timeout | null>(null);
  const [myStatus, setMyStatus] = useState<'safe' | 'need-help' | 'unknown' | 'critical'>('unknown');

  useEffect(() => {
    // Subscribe to store updates
    const unsubscribePremium = usePremiumStore.subscribe((state) => {
      setIsPremium(state.isPremium);
    });

    const unsubscribeFamily = useFamilyStore.subscribe((state) => {
      setMembers(state.members);
    });

    // Initial load
    setIsPremium(usePremiumStore.getState().isPremium);
    setMembers(useFamilyStore.getState().members);

    return () => {
      unsubscribePremium();
      unsubscribeFamily();
    };
  }, []);

  useEffect(() => {
    if (isSharingLocation) {
      startLocationSharing();
    } else {
      // Stop sharing when disabled
      if (locationShareInterval) {
        clearInterval(locationShareInterval);
        setLocationShareInterval(null);
      }
    }
    
    // Cleanup function - CRITICAL FOR MEMORY LEAK PREVENTION
    return () => {
      if (locationShareInterval) {
        clearInterval(locationShareInterval);
        setLocationShareInterval(null);
      }
    };
  }, [isSharingLocation, locationShareInterval]);

  const startLocationSharing = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Konum İzni', 'Konum paylaşımı için izin gereklidir');
        setIsSharingLocation(false);
        return;
      }

      const interval = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          await bleMeshService.sendMessage(JSON.stringify({
            type: 'family_location_update',
            status: myStatus,
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: Date.now(),
            },
          }));

          const deviceId = bleMeshService.getMyDeviceId();
          if (deviceId) {
            useFamilyStore.getState().updateMemberLocation(
              deviceId,
              location.coords.latitude,
              location.coords.longitude
            );
          }
        } catch (error) {
          logger.error('Location sharing error:', error);
        }
      }, 30000);
      
      // Store interval ID for cleanup
      setLocationShareInterval(interval);
    } catch (error) {
      logger.error('Start location sharing error:', error);
      setIsSharingLocation(false);
    }
  };

  const handleStatusUpdate = async (status: 'safe' | 'need-help' | 'critical') => {
    haptics.notificationSuccess();
    setMyStatus(status);

    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      let location: Location.LocationObject | null = null;

      if (locStatus === 'granted') {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      await bleMeshService.sendMessage(JSON.stringify({
        type: 'family_status_update',
        status,
        location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: Date.now(),
        } : null,
        timestamp: Date.now(),
      }));

      const statusText = status === 'safe' ? 'Güvendeyim' :
                        status === 'need-help' ? 'Yardıma İhtiyacım Var' :
                        'ACİL DURUM';
      
      Alert.alert('Durum Güncellendi', `${statusText} - Aile üyelerinize bildirildi`);

      if (status === 'critical') {
        await multiChannelAlertService.sendAlert({
          title: '🚨 ACİL DURUM',
          body: 'Aile üyesi acil durum bildirdi!',
          priority: 'critical',
          channels: {
            pushNotification: true,
            fullScreenAlert: true,
            alarmSound: true,
            vibration: true,
            tts: true,
          },
        });
      }

    } catch (error) {
      logger.error('Status update error:', error);
      haptics.notificationError();
      Alert.alert('Hata', 'Durum güncellenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleShareLocation = async () => {
    haptics.impactLight();
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Konum İzni', 'Konum paylaşımı için izin gereklidir');
      return;
    }

    setIsSharingLocation(!isSharingLocation);
    Alert.alert(
      'Konum Paylaşımı',
      isSharingLocation ? 'Konum paylaşımı durduruldu' : 'Konum paylaşımı başlatıldı - Aile üyeleriniz konumunuzu görebilir'
    );
  };

  const handleAddMember = () => {
    haptics.impactMedium();
    navigation.navigate('AddFamilyMember');
  };

  const getStatusColor = (status: FamilyMember['status']) => {
    switch (status) {
      case 'safe': return '#10b981';
      case 'need-help': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return colors.text.tertiary;
    }
  };

  const getStatusText = (status: FamilyMember['status']) => {
    switch (status) {
      case 'safe': return 'Güvende';
      case 'need-help': return 'Yardım Gerekiyor';
      case 'critical': return 'ACİL DURUM';
      default: return 'Bilinmiyor';
    }
  };

  const safeCount = members.filter(m => m.status === 'safe').length;

  const renderMember = ({ item, index }: { item: FamilyMember; index: number }) => (
    <MemberCard
      member={item}
      index={index}
      onPress={() => navigation.navigate('Map', { focusOnMember: item.id })}
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Aile Güvenlik Zinciri</Text>
          <Text style={styles.headerSubtitle}>
            {members.length} üye • {safeCount} güvende
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate('Map')}>
            <Ionicons name="map-outline" size={20} color={colors.text.primary} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} onPress={handleAddMember}>
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Buttons */}
        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>Durumunu Bildir</Text>
          <StatusButton status="safe" onPress={handleStatusUpdate} />
          <StatusButton status="need-help" onPress={handleStatusUpdate} />
          <StatusButton status="critical" onPress={handleStatusUpdate} />

          <Pressable
            style={({ pressed }) => [
              styles.locationButton,
              isSharingLocation && styles.locationButtonActive,
              pressed && styles.pressed,
            ]}
            onPress={handleShareLocation}
          >
            <Ionicons 
              name={isSharingLocation ? "location" : "location-outline"} 
              size={24} 
              color={isSharingLocation ? colors.brand.primary : colors.text.secondary} 
            />
            <Text style={[
              styles.locationButtonText,
              isSharingLocation && styles.locationButtonTextActive,
            ]}>
              Konumumu Paylaş
            </Text>
            {isSharingLocation && (
              <View style={styles.sharingIndicator}>
                <View style={styles.sharingDot} />
              </View>
            )}
          </Pressable>
        </View>

        {/* Member List */}
        <View style={styles.membersSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Aile Üyeleri</Text>
            <Text style={styles.sectionSubtitle}>{members.length} kişi</Text>
          </View>

          {members.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people" size={64} color={colors.text.tertiary} />
              </View>
              <Text style={styles.emptyText}>Henüz aile üyesi eklenmemiş</Text>
              <Text style={styles.emptySubtext}>
                Aile üyelerinizi ekleyerek acil durumlarda birbirinizle iletişim kurabilirsiniz
              </Text>
              <Pressable style={styles.emptyButton} onPress={handleAddMember}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.emptyButtonText}>İlk Üyeyi Ekle</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={members}
              renderItem={renderMember}
              keyExtractor={(item) => item.id}
              scrollEnabled={false} // Renders all items, useful for ScrollView parent
            />
          )}
        </View>
      </ScrollView>

      {/* Premium Gate */}
      {!isPremium && <PremiumGate featureName="Aile Güvenlik Zinciri" />}
    </View>
  );
}

const formatLastSeen = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Şimdi';
  if (minutes < 60) return `${minutes} dk önce`;
  if (hours < 24) return `${hours} saat önce`;
  return `${days} gün önce`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: colors.background.primary,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  addButton: {
    backgroundColor: colors.brand.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  statusSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  statusButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  statusButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  statusButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
  },
  locationButtonActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.primary + '20',
  },
  locationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  locationButtonTextActive: {
    color: colors.brand.primary,
  },
  sharingIndicator: {
    marginLeft: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.status.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  membersSection: {
    marginTop: 16,
  },
  memberList: {
    gap: 12,
  },
  memberCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  memberTime: {
    fontSize: 13,
    color: '#94a3b8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  viewMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  viewMapText: {
    fontSize: 14,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32 * 2,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
