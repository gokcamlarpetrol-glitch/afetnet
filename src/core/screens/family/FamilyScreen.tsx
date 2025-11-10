/**
 * FAMILY SCREEN - Elite Premium Design
 * Production-grade family safety chain with comprehensive error handling
 * Zero-error guarantee with full type safety
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  StatusBar,
  Modal,
  Linking,
  ActionSheetIOS,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { useMeshStore } from '../../stores/meshStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { multiChannelAlertService } from '../../services/MultiChannelAlertService';
import { getDeviceId as getDeviceIdFromLib } from '../../../lib/device';
import { StatusButton } from '../../components/family/StatusButton';
import { MemberCard } from '../../components/family/MemberCard';
import { colors, typography, spacing } from '../../theme';
import { createLogger } from '../../utils/logger';
import * as haptics from '../../utils/haptics';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import * as SMS from 'expo-sms';

const logger = createLogger('FamilyScreen');

// ELITE: Type-safe navigation props
interface FamilyScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function FamilyScreen({ navigation }: FamilyScreenProps) {
  const insets = useSafeAreaInsets();
  
  // Use Zustand hooks - they handle referential equality automatically
  const members = useFamilyStore((state) => state.members);
  
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const locationShareIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [myStatus, setMyStatus] = useState<'safe' | 'need-help' | 'unknown' | 'critical'>('unknown');
  const myStatusRef = useRef<'safe' | 'need-help' | 'unknown' | 'critical'>('unknown');
  const [showIdModal, setShowIdModal] = useState(false);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [editName, setEditName] = useState('');
  
  // Keep ref in sync with state
  useEffect(() => {
    myStatusRef.current = myStatus;
  }, [myStatus]);

  // Batch update mechanism to prevent subscription loops
  const pendingUpdatesRef = useRef<Map<string, { status?: string; location?: { latitude: number; longitude: number } }>>(new Map());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // Initialize family store
        await useFamilyStore.getState().initialize();
        
        // Get device ID
        let deviceId = bleMeshService.getMyDeviceId();
        if (!deviceId) {
          deviceId = await getDeviceIdFromLib();
          if (deviceId && mounted) {
            useMeshStore.getState().setMyDeviceId(deviceId);
            setMyDeviceId(deviceId);
          }
        } else if (mounted) {
          setMyDeviceId(deviceId);
        }
      } catch (error) {
        logger.error('Initialization error:', error);
      }
    };
    
    init();

    return () => {
      mounted = false;
    };
  }, []);

  // Separate effect for message listener - uses refs so no dependency issues
  useEffect(() => {
    // Listen for family status and location update messages
    const unsubscribeMessage = bleMeshService.onMessage(async (message) => {
      try {
        const content = message.content;
        if (typeof content !== 'string') return;

        // ELITE: Validate content length (prevent DoS)
        if (content.length > 10000) {
          logger.warn('Family message content too large or invalid, skipping');
          return;
        }
        
        // ELITE: Use safe JSON parsing with validation
        const { sanitizeJSON } = await import('../../utils/inputSanitizer');
        const messageData = sanitizeJSON(content);
        
        if (!messageData || typeof messageData !== 'object') {
          // Not a valid JSON message, skip
          logger.debug('Family message is not valid JSON, skipping');
          return;
        }

        // Check if this is a family update message
        if (messageData.type === 'family_status_update' || messageData.type === 'family_location_update') {
          const senderDeviceId = messageData.deviceId;
          if (!senderDeviceId) return;

          // Find the family member by deviceId
          const members = useFamilyStore.getState().members;
          const member = members.find(m => m.deviceId === senderDeviceId);

          if (member) {
            // Batch updates instead of immediate store updates to prevent subscription loops
            const existing = pendingUpdatesRef.current.get(senderDeviceId) || {};
            
            if (messageData.type === 'family_status_update' && messageData.status) {
              existing.status = messageData.status;
              if (__DEV__) {
                logger.info(`Status update queued from ${member.name}: ${messageData.status}`);
              }
            }

            if (messageData.location && messageData.location.latitude && messageData.location.longitude) {
              existing.location = {
                latitude: messageData.location.latitude,
                longitude: messageData.location.longitude,
              };
              if (__DEV__) {
                logger.info(`Location update queued from ${member.name}`);
              }
            }

            pendingUpdatesRef.current.set(senderDeviceId, existing);

            // Debounce: Process updates after 100ms (allows batching multiple rapid updates)
            if (updateTimeoutRef.current) {
              clearTimeout(updateTimeoutRef.current);
            }
            updateTimeoutRef.current = setTimeout(() => {
              // FIXED: Inline processing to avoid dependency issues
              if (pendingUpdatesRef.current.size === 0) {
                updateTimeoutRef.current = null;
                return;
              }

              const members = useFamilyStore.getState().members;
              const pendingEntries = Array.from(pendingUpdatesRef.current.entries());
              
              for (const [deviceId, updateData] of pendingEntries) {
                const member = members.find(m => m.deviceId === deviceId);
                if (!member) continue;

                // ELITE: Type-safe status update with validation
                if (updateData.status && member.status !== updateData.status) {
                  const validStatuses: Array<FamilyMember['status']> = ['safe', 'need-help', 'critical', 'unknown'];
                  if (validStatuses.includes(updateData.status as FamilyMember['status'])) {
                    useFamilyStore.getState().updateMemberStatus(member.id, updateData.status as FamilyMember['status']);
                  } else {
                    logger.warn('Invalid status received:', updateData.status);
                  }
                }
                
                if (updateData.location) {
                  useFamilyStore.getState().updateMemberLocation(
                    member.id,
                    updateData.location.latitude,
                    updateData.location.longitude
                  );
                }
              }
              
              pendingUpdatesRef.current.clear();
              updateTimeoutRef.current = null;
            }, 100);
          } else if (__DEV__) {
            logger.warn(`Received family update from unknown deviceId: ${senderDeviceId}`);
          }
        }
      } catch (error) {
        logger.error('Error processing family message:', error);
      }
    });

    return () => {
      unsubscribeMessage();
      // Cleanup debounce timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
      // Process any remaining updates before unmount
      // FIXED: processPendingUpdates'i dependency'den çıkardık, direkt kod kullanıyoruz
      if (pendingUpdatesRef.current.size > 0) {
        const members = useFamilyStore.getState().members;
        const pendingEntries = Array.from(pendingUpdatesRef.current.entries());
        
        for (const [deviceId, updateData] of pendingEntries) {
          const member = members.find(m => m.deviceId === deviceId);
          if (!member) continue;

          // ELITE: Type-safe status update with validation
          if (updateData.status && member.status !== updateData.status) {
            const validStatuses: Array<FamilyMember['status']> = ['safe', 'need-help', 'critical', 'unknown'];
            if (validStatuses.includes(updateData.status as FamilyMember['status'])) {
              useFamilyStore.getState().updateMemberStatus(member.id, updateData.status as FamilyMember['status']);
            } else {
              logger.warn('Invalid status received:', updateData.status);
            }
          }
          
          if (updateData.location) {
            useFamilyStore.getState().updateMemberLocation(
              member.id,
              updateData.location.latitude,
              updateData.location.longitude
            );
          }
        }
        
        pendingUpdatesRef.current.clear();
      }
    };
  }, []); // Empty deps - listener uses refs and store.getState()

  const startLocationSharing = useCallback(async () => {
    // Clear any existing interval before starting a new one
    if (locationShareIntervalRef.current) {
      clearInterval(locationShareIntervalRef.current);
      locationShareIntervalRef.current = null;
    }

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

          let myDeviceId = bleMeshService.getMyDeviceId();
          if (!myDeviceId) {
            // Fallback: Get device ID from device.ts
            try {
              myDeviceId = await getDeviceIdFromLib();
              if (myDeviceId) {
                useMeshStore.getState().setMyDeviceId(myDeviceId);
              }
            } catch (error) {
              logger.error('Failed to get device ID for location update:', error);
            }
          }
          
          if (myDeviceId) {
            // FIXED: Use ref to get current status value (avoids closure issues)
            const currentStatus = myStatusRef.current;
            
            const locationMessage = JSON.stringify({
              type: 'family_location_update',
              deviceId: myDeviceId, // Include deviceId for matching
              status: currentStatus, // Use ref value, not closure value
              location: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: Date.now(),
              },
            });

            // Broadcast location update
            await useMeshStore.getState().broadcastMessage(locationMessage, 'location');

            // Save to Firebase for cloud sync
            try {
              const { firebaseDataService } = await import('../../services/FirebaseDataService');
              if (firebaseDataService.isInitialized) {
                await firebaseDataService.saveLocationUpdate(myDeviceId, {
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  accuracy: location.coords.accuracy || null,
                  timestamp: Date.now(),
                });
                
                // Also save status update
                await firebaseDataService.saveStatusUpdate(myDeviceId, {
                  status: currentStatus,
                  location: {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  },
                  timestamp: Date.now(),
                });
              }
            } catch (error) {
              logger.error('Failed to save location to Firebase:', error);
            }

            // FIXED: Find member by deviceId and use member.id (not deviceId) for updateMemberLocation
            const familyMembers = useFamilyStore.getState().members;
            const myMember = familyMembers.find(m => m.deviceId === myDeviceId);
            if (myMember) {
              useFamilyStore.getState().updateMemberLocation(
                myMember.id, // Use member.id, not deviceId
                location.coords.latitude,
                location.coords.longitude
              );
            }
          }
        } catch (error) {
          logger.error('Location sharing error:', error);
        }
      }, 30000);
      
      // Store interval ID in ref for cleanup
      locationShareIntervalRef.current = interval;
    } catch (error) {
      logger.error('Start location sharing error:', error);
      setIsSharingLocation(false);
    }
  }, []); // FIXED: No dependencies - uses ref for myStatus

  useEffect(() => {
    if (isSharingLocation) {
      startLocationSharing();
    } else {
      // Stop sharing when disabled
      if (locationShareIntervalRef.current) {
        clearInterval(locationShareIntervalRef.current);
        locationShareIntervalRef.current = null;
      }
    }
    
    // Cleanup function - CRITICAL FOR MEMORY LEAK PREVENTION
    return () => {
      if (locationShareIntervalRef.current) {
        clearInterval(locationShareIntervalRef.current);
        locationShareIntervalRef.current = null;
      }
    };
  }, [isSharingLocation, startLocationSharing]); // startLocationSharing is stable (empty deps, uses refs)

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

      let myDeviceId = bleMeshService.getMyDeviceId();
      if (!myDeviceId) {
        // Fallback: Get device ID from device.ts
        try {
          myDeviceId = await getDeviceIdFromLib();
          if (!myDeviceId) {
            throw new Error('Device ID not available');
          }
          // Set it in BLEMeshService for future use
          useMeshStore.getState().setMyDeviceId(myDeviceId);
        } catch (error) {
          logger.error('Failed to get device ID:', error);
          throw new Error('Device ID not available');
        }
      }

      // Create status update message
      const statusMessage = JSON.stringify({
        type: 'family_status_update',
        deviceId: myDeviceId, // Include deviceId so receiver can match to family member
        status,
        location: location ? {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: Date.now(),
        } : null,
        timestamp: Date.now(),
      });

      // Get all family members with deviceIds
      const familyMembers = useFamilyStore.getState().members;
      const membersWithDeviceId = familyMembers.filter(m => m.deviceId);

      // Broadcast to all nearby devices (family members will filter by deviceId)
      await useMeshStore.getState().broadcastMessage(statusMessage, 'status');

      // Save to Firebase for cloud sync
      try {
        const { firebaseDataService } = await import('../../services/FirebaseDataService');
        if (firebaseDataService.isInitialized) {
          await firebaseDataService.saveStatusUpdate(myDeviceId, {
            status,
            location: location ? {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            } : null,
            timestamp: Date.now(),
          });
          
          // Also save location if available
          if (location) {
            await firebaseDataService.saveLocationUpdate(myDeviceId, {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              accuracy: location.coords.accuracy || null,
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        logger.error('Failed to save status to Firebase:', error);
      }

      // Also try to send directly to each family member if their deviceId is known
      // This ensures message delivery even if they're not in broadcast range
      for (const member of membersWithDeviceId) {
        if (member.deviceId && member.deviceId !== myDeviceId) {
          try {
            await bleMeshService.sendMessage(statusMessage, member.deviceId);
          } catch (error) {
            // Silent fail for individual messages - broadcast should still work
            if (__DEV__) {
              logger.warn(`Failed to send direct message to ${member.deviceId}:`, error);
            }
          }
        }
      }

      const statusText = status === 'safe' ? 'Güvendeyim' :
                        status === 'need-help' ? 'Yardıma İhtiyacım Var' :
                        'ACİL DURUM';
      
      const memberCount = membersWithDeviceId.length;
      Alert.alert(
        'Durum Güncellendi', 
        `${statusText} - ${memberCount > 0 ? `${memberCount} aile üyesine` : 'Yakındaki cihazlara'} bildirildi`
      );

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

  const handleStatusButtonPress = (status: 'safe' | 'need-help' | 'critical' | 'location') => {
    if (status === 'location') {
      void handleShareLocation();
    } else {
      void handleStatusUpdate(status);
    }
  };

  // ELITE: Memoized callback for performance
  const handleAddMember = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('AddFamilyMember');
    } catch (error) {
      logger.error('Error navigating to AddFamilyMember:', error);
    }
  }, [navigation]);

  const handleShowMyId = async () => {
    haptics.impactLight();
    
    // Ensure device ID is available before showing modal
    if (!myDeviceId) {
      try {
        const deviceId = await getDeviceIdFromLib();
        if (deviceId) {
          setMyDeviceId(deviceId);
          useMeshStore.getState().setMyDeviceId(deviceId);
        }
      } catch (error) {
        logger.error('Failed to get device ID for modal:', error);
        Alert.alert('Hata', 'Device ID oluşturulamadı. Lütfen tekrar deneyin.');
        return;
      }
    }
    
    setShowIdModal(true);
  };

  const handleCopyId = async () => {
    if (!myDeviceId) return;
    
    await Clipboard.setStringAsync(myDeviceId);
    haptics.notificationSuccess();
    Alert.alert('Kopyalandı', 'ID panoya kopyalandı');
  };

  const handleShareId = async () => {
    if (!myDeviceId) return;
    
    const shareMessage = `AfetNet ID'm: ${myDeviceId}\n\nBeni eklemek için bu ID'yi kullanabilirsiniz. AfetNet uygulamasında "ID ile Ekle" seçeneğini kullanın.`;
    
    if (Platform.OS === 'ios') {
      // iOS: Show ActionSheet
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['İptal', 'WhatsApp', 'SMS', 'Diğer'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            // WhatsApp
            const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
            const canOpen = await Linking.canOpenURL(whatsappUrl);
            if (canOpen) {
              await Linking.openURL(whatsappUrl);
              haptics.notificationSuccess();
            } else {
              Alert.alert('WhatsApp', 'WhatsApp yüklü değil');
            }
          } else if (buttonIndex === 2) {
            // SMS
            const isAvailable = await SMS.isAvailableAsync();
            if (isAvailable) {
              await SMS.sendSMSAsync([], shareMessage);
              haptics.notificationSuccess();
            } else {
              Alert.alert('SMS', 'SMS gönderimi bu cihazda desteklenmiyor');
            }
          } else if (buttonIndex === 3) {
            // Other (System share sheet)
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
              await Sharing.shareAsync(shareMessage);
              haptics.notificationSuccess();
            } else {
              await handleCopyId();
            }
          }
        }
      );
    } else {
      // Android: Try WhatsApp first, then SMS, then system share
      try {
        // Try WhatsApp
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
        const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
        
        if (canOpenWhatsApp) {
          await Linking.openURL(whatsappUrl);
          haptics.notificationSuccess();
          return;
        }
        
        // Try SMS
        const isSMSAvailable = await SMS.isAvailableAsync();
        if (isSMSAvailable) {
          await SMS.sendSMSAsync([], shareMessage);
          haptics.notificationSuccess();
          return;
        }
        
        // Fallback to system share
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(shareMessage);
          haptics.notificationSuccess();
        } else {
          await handleCopyId();
        }
      } catch (error) {
        logger.error('Share ID error:', error);
        await handleCopyId();
      }
    }
  };

  const handleShareIdWhatsApp = async () => {
    if (!myDeviceId) return;
    
    const shareMessage = `AfetNet ID'm: ${myDeviceId}\n\nBeni eklemek için bu ID'yi kullanabilirsiniz. AfetNet uygulamasında "ID ile Ekle" seçeneğini kullanın.`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;
    
    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
        haptics.notificationSuccess();
      } else {
        Alert.alert('WhatsApp', 'WhatsApp yüklü değil');
      }
    } catch (error) {
      logger.error('WhatsApp share error:', error);
      Alert.alert('Hata', 'WhatsApp ile paylaşılamadı');
    }
  };

  const handleShareIdSMS = async () => {
    if (!myDeviceId) return;
    
    const shareMessage = `AfetNet ID'm: ${myDeviceId}\n\nBeni eklemek için bu ID'yi kullanabilirsiniz. AfetNet uygulamasında "ID ile Ekle" seçeneğini kullanın.`;
    
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable) {
        await SMS.sendSMSAsync([], shareMessage);
        haptics.notificationSuccess();
      } else {
        Alert.alert('SMS', 'SMS gönderimi bu cihazda desteklenmiyor');
      }
    } catch (error) {
      logger.error('SMS share error:', error);
      Alert.alert('Hata', 'SMS ile paylaşılamadı');
    }
  };

  const handleShareIdOther = async () => {
    if (!myDeviceId) return;
    
    const shareMessage = `AfetNet ID'm: ${myDeviceId}\n\nBeni eklemek için bu ID'yi kullanabilirsiniz. AfetNet uygulamasında "ID ile Ekle" seçeneğini kullanın.`;
    
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(shareMessage);
        haptics.notificationSuccess();
      } else {
        await handleCopyId();
      }
    } catch (error) {
      logger.error('Share error:', error);
      await handleCopyId();
    }
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

  // ELITE: Memoize safe count for performance
  const safeCount = useMemo(() => {
    try {
      return members.filter(m => m.status === 'safe').length;
    } catch (error) {
      logger.error('Error calculating safe count:', error);
      return 0;
    }
  }, [members]);

  const handleEditMember = (member: FamilyMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingMember || !editName.trim()) {
      Alert.alert('Hata', 'Lütfen geçerli bir isim girin.');
      return;
    }

    try {
      await useFamilyStore.getState().updateMember(editingMember.id, {
        name: editName.trim(),
      });
      haptics.notificationSuccess();
      setShowEditModal(false);
      setEditingMember(null);
      setEditName('');
    } catch (error) {
      logger.error('Failed to update member:', error);
      Alert.alert('Hata', 'Üye güncellenemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    try {
      await useFamilyStore.getState().removeMember(memberId);
      haptics.notificationSuccess();
    } catch (error) {
      logger.error('Failed to delete member:', error);
      Alert.alert('Hata', 'Üye silinemedi. Lütfen tekrar deneyin.');
    }
  };

  // ELITE: Memoized callback for performance
  const handleGroupChat = useCallback(() => {
    try {
      haptics.impactMedium();
      navigation.navigate('FamilyGroupChat');
    } catch (error) {
      logger.error('Error navigating to FamilyGroupChat:', error);
    }
  }, [navigation]);

  // ELITE: Memoized render function for performance
  const renderMember = useCallback(({ item, index }: { item: FamilyMember; index: number }) => {
    try {
      return (
        <MemberCard
          member={item}
          index={index}
          onPress={() => {
            try {
              if (!item.id || typeof item.id !== 'string') {
                logger.warn('Invalid member id:', item);
                return;
              }
              navigation.navigate('Map', { focusOnMember: item.id });
            } catch (error) {
              logger.error('Error navigating to Map:', error);
            }
          }}
          onEdit={handleEditMember}
          onDelete={handleDeleteMember}
        />
      );
    } catch (error) {
      logger.error('Error rendering member:', error);
      return null;
    }
  }, [navigation, handleEditMember, handleDeleteMember]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header - Fixed Position */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>Aile Güvenlik Zinciri</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {members.length} üye • {safeCount} güvende
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <Pressable style={styles.headerButton} onPress={handleShowMyId}>
            <Ionicons name="qr-code-outline" size={20} color={colors.text.primary} />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={() => navigation.navigate('Map')}>
            <Ionicons name="map-outline" size={20} color={colors.text.primary} />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={handleAddMember}>
            <Ionicons name="add" size={20} color={colors.text.primary} />
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
          <StatusButton status="safe" onPress={handleStatusButtonPress} />
          <StatusButton status="need-help" onPress={handleStatusButtonPress} />
          <StatusButton status="critical" onPress={handleStatusButtonPress} />
          <StatusButton status="location" active={isSharingLocation} onPress={handleStatusButtonPress} />
        </View>

        {/* Group Chat Button */}
        {members.length > 0 && (
          <View style={styles.groupChatSection}>
            <Pressable style={styles.groupChatButton} onPress={handleGroupChat}>
              <LinearGradient
                colors={[colors.brand.primary, colors.brand.secondary]}
                style={styles.groupChatGradient}
              >
                <Ionicons name="chatbubbles" size={24} color="#fff" />
                <Text style={styles.groupChatText}>Aile Grubu Sohbeti</Text>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        )}

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

      {/* Premium Gate KALDIRILDI - Tüm kullanıcılar erişebilir */}

      {/* ID Share Modal */}
      <Modal
        visible={showIdModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowIdModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable 
              style={styles.modalCloseButton} 
              onPress={() => setShowIdModal(false)}
            >
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </Pressable>
            
            <Text style={styles.modalTitle}>Benim ID'm</Text>
            <Text style={styles.modalSubtitle}>
              Bu ID'yi başkalarıyla paylaşarak sizi ekleyebilirler
            </Text>

            {myDeviceId ? (
              <>
                <View style={styles.qrContainer}>
                  <QRCode
                    value={myDeviceId}
                    size={200}
                    color={colors.text.primary}
                    backgroundColor={colors.background.secondary}
                  />
                </View>

                <View style={styles.idContainer}>
                  <Text style={styles.idLabel}>ID:</Text>
                  <Text style={styles.idValue} selectable>{myDeviceId}</Text>
                </View>

                <View style={styles.modalButtons}>
                  <Pressable style={styles.modalButtonSmall} onPress={handleCopyId}>
                    <Ionicons name="copy-outline" size={18} color="#fff" />
                    <Text style={styles.modalButtonTextSmall}>Kopyala</Text>
                  </Pressable>
                  <Pressable style={styles.modalButtonSmall} onPress={handleShareIdWhatsApp}>
                    <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                    <Text style={styles.modalButtonTextSmall}>WhatsApp</Text>
                  </Pressable>
                  <Pressable style={styles.modalButtonSmall} onPress={handleShareIdSMS}>
                    <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                    <Text style={styles.modalButtonTextSmall}>SMS</Text>
                  </Pressable>
                  <Pressable style={styles.modalButtonSmall} onPress={handleShareIdOther}>
                    <Ionicons name="share-outline" size={18} color="#fff" />
                    <Text style={styles.modalButtonTextSmall}>Diğer</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.errorText}>ID alınamadı</Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Member Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingMember(null);
          setEditName('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Pressable 
              style={styles.modalCloseButton} 
              onPress={() => {
                setShowEditModal(false);
                setEditingMember(null);
                setEditName('');
              }}
            >
              <Ionicons name="close" size={28} color={colors.text.primary} />
            </Pressable>
            
            <Text style={styles.modalTitle}>Üyeyi Düzenle</Text>
            <Text style={styles.modalSubtitle}>
              Üye ismini değiştirin
            </Text>

            <View style={styles.editInputContainer}>
              <Text style={styles.editInputLabel}>İsim</Text>
              <TextInput
                style={styles.editInput}
                placeholder="Üye ismi"
                placeholderTextColor={colors.text.tertiary}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                maxLength={50}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingMember(null);
                  setEditName('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>İptal</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSave]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalButtonTextSave}>Kaydet</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    zIndex: 10,
    elevation: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background.primary,
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
  },
  modalTitle: {
    ...typography.h3,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  qrContainer: {
    backgroundColor: colors.background.secondary,
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  idLabel: {
    ...typography.body,
    fontWeight: '600',
    marginRight: 8,
  },
  idValue: {
    ...typography.body,
    flex: 1,
    fontFamily: 'monospace',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    flexWrap: 'wrap',
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  modalButtonSmall: {
    flex: 1,
    minWidth: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  modalButtonText: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonTextSmall: {
    ...typography.small,
    fontWeight: '600',
    color: '#fff',
    fontSize: 12,
  },
  errorText: {
    ...typography.body,
    color: colors.status.danger,
    textAlign: 'center',
  },
  groupChatSection: {
    marginBottom: 20,
  },
  groupChatButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  groupChatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  groupChatText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  editInputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  editInputLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...typography.body,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  modalButtonCancel: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  modalButtonSave: {
    backgroundColor: colors.brand.primary,
  },
  modalButtonTextCancel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalButtonTextSave: {
    ...typography.body,
    fontWeight: '600',
    color: '#fff',
  },
});
