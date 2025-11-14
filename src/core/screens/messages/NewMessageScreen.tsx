/**
 * NEW MESSAGE SCREEN - Find and start conversation
 * QR scan, ID input, or BLE discovery
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMessageStore } from '../../stores/messageStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { useMeshStore } from '../../stores/meshStore';
import { getDeviceId as getDeviceIdFromLib, isValidDeviceId } from '../../../lib/device';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';

const logger = createLogger('NewMessageScreen');

// ELITE: Type-safe navigation props
interface NewMessageScreenProps {
  navigation: {
    navigate: (screen: string, params?: Record<string, unknown>) => void;
    goBack: () => void;
  };
}

export default function NewMessageScreen({ navigation }: NewMessageScreenProps) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<'qr' | 'id' | 'scan'>('qr');
  const [deviceId, setDeviceId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<Array<{ deviceId: string; name?: string; rssi?: number }>>([]);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const isScanningRef = useRef(isScanning);
  const scanCountdownStateRef = useRef(0);
  const discoveryUnsubscribeRef = useRef<(() => void) | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanCountdownRef = useRef<NodeJS.Timeout | null>(null);
  const scannedDevicesRef = useRef(0);
  const initRequestedRef = useRef(false);
  const [scanCountdown, setScanCountdown] = useState(0);

  const meshStoreDeviceId = useMeshStore((state) => state.myDeviceId);

  const tabOptions = useMemo<
    ReadonlyArray<{ key: 'qr' | 'id' | 'scan'; label: string; icon: keyof typeof Ionicons.glyphMap }>
  >(
    () => [
      { key: 'qr', label: 'QR Kod', icon: 'qr-code' },
      { key: 'id', label: 'ID ile Ekle', icon: 'key-outline' },
      { key: 'scan', label: 'Tarama', icon: 'bluetooth' },
    ],
    []
  );

  const displayDeviceId = myDeviceId ?? meshStoreDeviceId ?? 'Hazırlanıyor...';

  const handleHelp = useCallback(() => {
    Alert.alert(
      'Mesh Mesajlaşma',
      'AfetNet cihazları Bluetooth mesh ağı üzerinden haberleşir. Bluetooth ve konum izinleri kapalıysa mesajlar iletilmez. Erişim sorununda her iki izni de kontrol edin.'
    );
  }, []);

  const handleShowMyQrInfo = useCallback(() => {
    const id = myDeviceIdRef.current || useMeshStore.getState().myDeviceId;
    if (!id) {
      Alert.alert(
        'Cihaz ID hazır değil',
        'Önce Bluetooth ve konum izinlerini açarak mesh ağını başlatın.'
      );
      return;
    }
    setQrValue(id);
    setQrModalVisible(true);
  }, []);

  const handleCloseQrModal = () => {
    setQrModalVisible(false);
  };

  const getSignalLabel = (rssi?: number) => {
    if (typeof rssi !== 'number') return undefined;
    if (rssi > -70) return 'Sinyal: Güçlü';
    if (rssi > -90) return 'Sinyal: Orta';
    return 'Sinyal: Zayıf';
  };

  const isMeshConnected = useMeshStore((state) => state.isConnected);
  const myDeviceIdRef = useRef<string | null>(null);
  useEffect(() => {
    myDeviceIdRef.current = myDeviceId;
  }, [myDeviceId]);

  const ensureMeshReady = useCallback(async (): Promise<string | null> => {
    const meshStore = useMeshStore.getState();
    let id = bleMeshService.getMyDeviceId() || meshStore.myDeviceId || myDeviceIdRef.current;

    if (!id) {
      try {
        await bleMeshService.start();
      } catch (error) {
        logger.warn('Mesh start attempt failed:', error);
      }
      const refreshedStore = useMeshStore.getState();
      id = bleMeshService.getMyDeviceId() || refreshedStore.myDeviceId || myDeviceIdRef.current;
    }

    if (!id) {
      try {
        const fallback = await getDeviceIdFromLib();
        if (fallback) {
          id = fallback;
          useMeshStore.getState().setMyDeviceId(fallback);
          setMyDeviceId(fallback);
          myDeviceIdRef.current = fallback;
        }
      } catch (error) {
        logger.error('Device ID retrieval failed:', error);
      }
    }

    if (!id) {
      Alert.alert(
        'Mesh Ağı Aktif Değil',
        'Bluetooth açık değil veya gerekli izinler verilmedi. Lütfen Bluetoothu etkinleştirip tekrar deneyin.'
      );
      return null;
    }

    if (!myDeviceIdRef.current && id) {
      setMyDeviceId(id);
      myDeviceIdRef.current = id;
    }

    const latestStore = useMeshStore.getState();
    if (latestStore.myDeviceId !== id) {
      latestStore.setMyDeviceId(id);
    }
    if (!latestStore.isConnected) {
      latestStore.setConnected(true);
    }

    return id;
  }, []);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    scanCountdownStateRef.current = scanCountdown;
  }, [scanCountdown]);

  const stopBLEScan = useCallback(() => {
    if (
      !isScanningRef.current &&
      scanCountdownStateRef.current === 0 &&
      !scanTimeoutRef.current &&
      !scanCountdownRef.current
    ) {
      return;
    }

    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (scanCountdownRef.current) {
      clearInterval(scanCountdownRef.current);
      scanCountdownRef.current = null;
    }
    if (discoveryUnsubscribeRef.current) {
      discoveryUnsubscribeRef.current();
      discoveryUnsubscribeRef.current = null;
    }
    setIsScanning((prev) => (prev ? false : prev));
    setScanCountdown((prev) => (prev !== 0 ? 0 : prev));
    scannedDevicesRef.current = 0;
  }, []);

  const startBLEScan = useCallback(async () => {
    const id = await ensureMeshReady();
    if (!id) {
      return;
    }

    setScanError(null);
    setIsScanning(true);
    setScannedDevices([]);
    scannedDevicesRef.current = 0;
    setScanCountdown(10);

    if (discoveryUnsubscribeRef.current) {
      discoveryUnsubscribeRef.current();
      discoveryUnsubscribeRef.current = null;
    }

    discoveryUnsubscribeRef.current = bleMeshService.onMessage(async (message) => {
      try {
        // Check content for discovery info (mesh message content is string)
        const content = message.content;
        if (typeof content === 'string') {
          // ELITE: Validate content length (prevent DoS)
          if (content.length > 10000) {
            logger.warn('Discovery message content too large, skipping');
            return;
          }
          
          try {
            // ELITE: Use safe JSON parsing
            const { sanitizeJSON } = await import('../../utils/inputSanitizer');
            const { sanitizeDeviceId } = await import('../../utils/validation');
            const { sanitizeString } = await import('../../utils/validation');
            const data = sanitizeJSON(content);
            
            if (data && typeof data === 'object' && data !== null) {
              // ELITE: Validate data structure
              const messageType = typeof data.type === 'string' ? data.type : null;
              
              if (messageType === 'discovery' || messageType === 'beacon' || messageType === 'discovery_request') {
                // ELITE: Sanitize device ID
                const discoveredId = sanitizeDeviceId(
                  data.deviceId || data.senderId || message.from || ''
                );
                
                // ELITE: Validate device ID format
                if (discoveredId && discoveredId.length >= 4 && discoveredId !== id) {
                  // ELITE: Sanitize name
                  const deviceName = typeof data.name === 'string' 
                    ? sanitizeString(data.name, 50) 
                    : undefined;
                  
                  // ELITE: Validate RSSI (must be number)
                  const rssi = typeof data.rssi === 'number' && !isNaN(data.rssi)
                    ? Math.max(-200, Math.min(0, data.rssi))
                    : undefined;
                  
                  setScannedDevices(prev => {
                    const exists = prev.find(d => d.deviceId === discoveredId);
                    if (!exists) {
                      const updated = [
                        ...prev,
                        {
                          deviceId: discoveredId,
                          name: deviceName,
                          rssi: rssi,
                        },
                      ];
                      scannedDevicesRef.current = updated.length;
                      return updated;
                    }
                    scannedDevicesRef.current = prev.length;
                    return prev;
                  });
                }
              }
            }
          } catch (error) {
            // ELITE: Not JSON or parse failed - log and skip
            logger.debug('Discovery message is not valid JSON, skipping:', error);
          }
        }
      } catch (error) {
        logger.error('Error processing discovery message:', error);
      }
    });

    // CRITICAL: Broadcast discovery request via BLE Mesh Service (actual transmission)
    if (id) {
      const discoveryPayload = JSON.stringify({
        type: 'discovery_request',
        deviceId: id,
      });
      
      // CRITICAL: Send via BLE Mesh Service for actual broadcast
      bleMeshService.broadcastMessage({
        content: discoveryPayload,
        type: 'text',
        priority: 'normal',
        ackRequired: false,
        ttl: 3600,
        sequence: 0,
        attempts: 0,
      }).catch((error) => {
        logger.error('Failed to broadcast discovery request:', error);
      });
      
      // CRITICAL: Also add to mesh store for tracking
      useMeshStore.getState().broadcastMessage(discoveryPayload, 'text').catch((error) => {
        logger.error('Failed to add discovery request to store:', error);
      });
    }

    // Auto-stop after 10 seconds
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    scanTimeoutRef.current = setTimeout(() => {
      stopBLEScan();
      if (scannedDevicesRef.current === 0) {
        setScanError('Yakında cihaz bulunamadı. Bluetooth açık ve diğer cihazlar yakın olmalı.');
      }
    }, 12000);

    if (scanCountdownRef.current) {
      clearInterval(scanCountdownRef.current);
    }
    scanCountdownRef.current = setInterval(() => {
      setScanCountdown((prev) => {
        if (prev <= 1) {
          if (scanCountdownRef.current) {
            clearInterval(scanCountdownRef.current);
            scanCountdownRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [ensureMeshReady, stopBLEScan]);

  useEffect(() => {
    if (!initRequestedRef.current) {
      initRequestedRef.current = true;
      
      // ELITE: Initialize message store
      const initStore = async () => {
        try {
          await useMessageStore.getState().initialize();
        } catch (error) {
          logger.error('Failed to initialize message store:', error);
        }
      };
      initStore();
      
      void ensureMeshReady();
    }

    return () => {
      stopBLEScan();
    };
  }, [ensureMeshReady, stopBLEScan]);

  useEffect(() => {
    if (activeTab === 'scan') {
      startBLEScan();
    } else if (isScanningRef.current || scanCountdownStateRef.current > 0) {
      stopBLEScan();
    }

    return () => {
      stopBLEScan();
    };
  }, [activeTab, startBLEScan, stopBLEScan]);

  const handleQRScan = ({ data }: { data: string }) => {
    try {
      const parsed = JSON.parse(data);
      const scannedId = parsed.deviceId || parsed.id || data;
      
      if (isValidDeviceId(scannedId)) {
        haptics.notificationSuccess();
        startConversation(scannedId);
      } else {
        Alert.alert('Geçersiz QR Kod', 'Bu QR kod geçerli bir cihaz ID\'si içermiyor.');
      }
    } catch {
      // Try direct device ID
      if (isValidDeviceId(data)) {
        haptics.notificationSuccess();
        startConversation(data);
      } else {
        Alert.alert('Geçersiz QR Kod', 'QR kod okunamadı.');
      }
    }
  };

  const handleManualAdd = () => {
    if (!deviceId.trim()) {
      Alert.alert('Hata', 'Lütfen bir cihaz ID girin.');
      return;
    }

    if (!isValidDeviceId(deviceId.trim())) {
      Alert.alert('Geçersiz ID', 'Lütfen geçerli bir cihaz ID girin.');
      return;
    }

    if (deviceId.trim() === myDeviceId) {
      Alert.alert('Hata', 'Kendi ID\'nizi giremezsiniz.');
      return;
    }

    haptics.impactMedium();
    startConversation(deviceId.trim());
  };

  const handleDeviceSelect = (selectedDeviceId: string) => {
    if (selectedDeviceId === myDeviceId) {
      Alert.alert('Hata', 'Kendi cihazınızı seçemezsiniz.');
      return;
    }
    haptics.impactMedium();
    startConversation(selectedDeviceId);
  };

  const handleCopyId = useCallback(async (explicitId?: string) => {
    const idToCopy = explicitId || myDeviceIdRef.current || useMeshStore.getState().myDeviceId;
    if (!idToCopy) return;

    await Clipboard.setStringAsync(idToCopy);
    haptics.notificationSuccess();
    Alert.alert('Kopyalandı', 'Cihaz ID panoya kaydedildi.');
  }, []);

  const statusItems = useMemo(() => [
    {
      label: 'Cihaz ID',
      value: myDeviceId ?? meshStoreDeviceId ?? 'Hazırlanıyor...',
      icon: 'finger-print' as const,
      action: myDeviceId ? (() => handleCopyId()) : undefined,
    },
    {
      label: 'Mesh Durumu',
      value: isMeshConnected ? 'Aktif' : 'Pasif',
      icon: isMeshConnected ? ('radio' as const) : ('radio-outline' as const),
    },
    {
      label: 'Taranan Cihaz',
      value: `${scannedDevices.length}`,
      icon: 'people-outline' as const,
    },
  ], [handleCopyId, isMeshConnected, meshStoreDeviceId, myDeviceId, scannedDevices.length]);

  const startConversation = async (targetDeviceId: string) => {
    try {
      // Check if conversation already exists
      const existing = useMessageStore.getState().conversations.find(
        c => c.userId === targetDeviceId
      );

      if (existing) {
        // Navigate to existing conversation
        navigation.navigate('Conversation', { userId: targetDeviceId });
      } else {
        // Create new conversation
        const newConversation = {
          userId: targetDeviceId,
          userName: `Cihaz ${targetDeviceId.slice(0, 8)}...`,
          lastMessage: 'Yeni konuşma başlatıldı',
          lastMessageTime: Date.now(),
          unreadCount: 0,
        };
        
        // ELITE: Await async addConversation to ensure proper state update
        await useMessageStore.getState().addConversation(newConversation);
        navigation.navigate('Conversation', { userId: targetDeviceId });
      }
    } catch (error) {
      logger.error('Failed to start conversation:', error);
      Alert.alert('Hata', 'Konuşma başlatılamadı. Lütfen tekrar deneyin.');
    }
  };

  const renderQRCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>QR Kod ile eşleş</Text>
          <Text style={styles.cardSubtitle}>
            Karşı tarafın QR kodunu tarayarak saniyeler içinde güvenli sohbet başlatabilirsiniz.
          </Text>
        </View>
        <Pressable style={styles.cardHeaderIcon} onPress={handleShowMyQrInfo}>
          <Ionicons name="qr-code-outline" size={22} color={colors.brand.primary} />
        </Pressable>
      </View>
      <View style={styles.cameraWrapper}>
        <CameraView
          style={styles.cameraView}
          facing="back"
          onBarcodeScanned={handleQRScan}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraFrame} />
        </View>
      </View>
      <Text style={styles.cardHint}>İpucu: Profil › Paylaş menüsünden kendi QR kodunuzu gösterebilirsiniz.</Text>
    </View>
  );

  const renderIDCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>Cihaz ID ile ekle</Text>
          <Text style={styles.cardSubtitle}>Bilinen AfetNet ID&apos;lerini girerek kişileri manuel olarak ekleyin.</Text>
        </View>
        <View style={styles.cardHeaderIcon}>
          <Ionicons name="key-outline" size={22} color={colors.brand.primary} />
        </View>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Örn: afn-k1lou0h5"
        placeholderTextColor={colors.text.tertiary}
        value={deviceId}
        onChangeText={setDeviceId}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        style={[styles.primaryButton, !deviceId.trim() && styles.primaryButtonDisabled]}
        onPress={handleManualAdd}
        disabled={!deviceId.trim()}
      >
        <Ionicons name="send" size={16} color="#0f172a" />
        <Text style={styles.primaryButtonText}>Ekle ve Mesaj Gönder</Text>
      </Pressable>
      <Text style={styles.cardHint}>ID “afn-” ile başlar ve en az 8 karakter içerir.</Text>
    </View>
  );

  const renderScanCard = () => (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardHeaderCopy}>
          <Text style={styles.cardTitle}>Yakındaki cihazlar</Text>
          <Text style={styles.cardSubtitle}>
            Bluetooth açıkken çevrenizdeki AfetNet cihazlarını keşfederek mesh ağı oluşturun.
          </Text>
        </View>
        <View style={styles.cardHeaderIcon}>
          <Ionicons name="scan-outline" size={22} color={colors.brand.primary} />
        </View>
      </View>

      <View style={styles.scanStatusRow}>
        <View style={[styles.scanStatusBadge, isScanning ? styles.scanStatusBadgeActive : styles.scanStatusBadgeInactive]}>
          <Ionicons name={isScanning ? 'pulse' : 'bluetooth'} size={16} color={isScanning ? '#0f172a' : '#0ea5e9'} />
          <Text style={[styles.scanStatusText, isScanning && styles.scanStatusTextActive]}>
            {isScanning ? `Tarama sürüyor (${Math.max(scanCountdown, 0)}s)` : 'Tarama hazır'}
          </Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={startBLEScan}>
          <Ionicons name="refresh" size={16} color={colors.brand.primary} />
          <Text style={styles.secondaryButtonText}>Yeniden Tara</Text>
        </Pressable>
      </View>

      {isScanning && (
        <View style={styles.scanLoading}>
          <ActivityIndicator color={colors.brand.primary} />
          <Text style={styles.scanLoadingText}>Cihazlar aranıyor...</Text>
        </View>
      )}

      {scannedDevices.length > 0 ? (
        scannedDevices.map((device) => (
          <Pressable
            key={device.deviceId}
            style={styles.deviceRow}
            onPress={() => handleDeviceSelect(device.deviceId)}
          >
            <View style={styles.deviceAvatar}>
              <Ionicons name="phone-portrait" size={18} color={colors.brand.primary} />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName} numberOfLines={1}>
                {device.name || `Cihaz ${device.deviceId.slice(0, 8)}...`}
              </Text>
              <Text style={styles.deviceIdText} numberOfLines={1}>
                {device.deviceId}
              </Text>
              {getSignalLabel(device.rssi) && (
                <Text style={styles.deviceSignal}>{getSignalLabel(device.rssi)}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </Pressable>
        ))
      ) : (
        !isScanning && (
          <View style={styles.emptyState}>
            <Ionicons name="compass-outline" size={28} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Henüz cihaz bulunamadı</Text>
            <Text style={styles.emptySubtitle}>
              Bluetooth ve konum servislerinin açık olduğundan emin olun. Cihazları yakın konumda tutun.
            </Text>
            <Pressable style={styles.secondaryButtonGhost} onPress={startBLEScan}>
              <Text style={styles.secondaryButtonGhostText}>Tarama Başlat</Text>
            </Pressable>
          </View>
        )
      )}

      {scanError && (
        <View style={styles.warningBox}>
          <Ionicons name="alert" size={16} color="#f97316" />
          <Text style={styles.warningText}>{scanError}</Text>
        </View>
      )}
    </View>
  );

  const renderPermissionFallback = (message: string, actionLabel: string) => (
    <SafeAreaView style={styles.permissionScreen}>
      <StatusBar barStyle="light-content" backgroundColor="#060b1b" />
      <LinearGradient colors={['#060b1b', '#0b1228']} style={styles.gradientOverlay} />
      <View style={[styles.container, styles.permissionContainer, { paddingTop: insets.top + 24 }] }>
        <Text style={styles.permissionText}>{message}</Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );

  if (activeTab === 'qr' && !permission) {
    return renderPermissionFallback('QR kod okumak için kamera izni gereklidir.', 'İzin Ver');
  }

  if (activeTab === 'qr' && !permission?.granted) {
    return renderPermissionFallback('Kamera izni reddedildi.', 'Tekrar Dene');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor="#060b1b" />

      <LinearGradient colors={['#060b1b', '#0b1228']} style={styles.gradientOverlay} />

      <View
        style={[
          styles.container,
          {
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.navButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerSubtitle}>Çevrimdışı mesh ağında güvenli bağlantı kur</Text>
          </View>
          <Pressable style={styles.infoButton} onPress={handleHelp}>
            <Ionicons name="information-circle-outline" size={20} color="#cbd5f5" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
            <View style={styles.connectionCard}>
              <View style={styles.connectionHeader}>
                <View>
                  <Text style={styles.connectionTitle}>Bağlantı Özeti</Text>
                  <Text style={styles.connectionSubtitle}>
                    {isMeshConnected
                      ? 'Mesh ağı hazır. Bluetooth açık.'
                      : 'Mesh ağı kapalı. Bluetooth ve konumu etkinleştirin.'}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.connectionAction,
                    (!myDeviceId && !meshStoreDeviceId) && styles.connectionActionDisabled,
                    pressed && styles.connectionActionPressed,
                  ]}
                  onPress={() => handleCopyId()}
                  disabled={!myDeviceId && !meshStoreDeviceId}
                >
                  <Ionicons name="copy-outline" size={16} color="#0ea5e9" />
                  <Text style={styles.connectionActionText}>Kimliği Kopyala</Text>
                </Pressable>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(14,165,233,0.18)' }]}> 
                    <Ionicons name="finger-print" size={16} color="#38bdf8" />
                  </View>
                  <Text style={styles.statLabel}>Cihaz ID</Text>
                  <Text style={styles.statValue} numberOfLines={1}>{displayDeviceId}</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: isMeshConnected ? 'rgba(74,222,128,0.18)' : 'rgba(248,113,113,0.18)' }]}> 
                    <Ionicons name={isMeshConnected ? 'radio' : 'radio-outline'} size={16} color={isMeshConnected ? '#4ade80' : '#f87171'} />
                  </View>
                  <Text style={styles.statLabel}>Mesh Durumu</Text>
                  <Text style={styles.statValue}>{isMeshConnected ? 'Aktif' : 'Pasif'}</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={[styles.statIcon, { backgroundColor: 'rgba(139,92,246,0.18)' }]}> 
                    <Ionicons name="people-outline" size={16} color="#8b5cf6" />
                  </View>
                  <Text style={styles.statLabel}>Taranan Cihaz</Text>
                  <Text style={styles.statValue}>{scannedDevices.length}</Text>
                </View>
              </View>
            </View>

            <View style={styles.tipBanner}>
              <Ionicons name="shield-checkmark" size={20} color="#4ade80" />
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Çevrimdışı güvenli bağlantı</Text>
                <Text style={styles.tipSubtitle}>
                  Bluetooth ve konum açık olduğunda mesajlar ağdaki tüm cihazlara ulaştırılır.
                </Text>
              </View>
            </View>

            <View style={styles.segmentContainer}>
              {tabOptions.map((option) => (
                <Pressable
                  key={option.key}
                  style={[styles.segmentButton, activeTab === option.key && styles.segmentButtonActive]}
                  onPress={() => setActiveTab(option.key)}
                >
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={activeTab === option.key ? '#0ea5e9' : '#94a3b8'}
                  />
                  <Text
                    style={[styles.segmentLabel, activeTab === option.key && styles.segmentLabelActive]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {activeTab === 'qr' && renderQRCard()}
            {activeTab === 'id' && renderIDCard()}
            {activeTab === 'scan' && renderScanCard()}
        </ScrollView>

        <Modal
          visible={qrModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleCloseQrModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Benim AfetNet ID&apos;m</Text>
              {qrValue && (
                <View style={styles.qrWrapper}>
                  <QRCode value={qrValue} size={200} color="#0f172a" backgroundColor="#e2e8f0" />
                  <Text style={styles.modalIdText}>{qrValue}</Text>
                </View>
              )}
              <Text style={styles.modalHint}>
                Bu QR kodu yakınınızdakiler taradığında sizi doğrudan ekleyebilir. Kimliğinizi kopyalayarak da paylaşabilirsiniz.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalActionSecondary} onPress={handleCloseQrModal}>
                  <Text style={styles.modalActionSecondaryText}>Kapat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalActionPrimary}
                  onPress={async () => {
                    if (qrValue) {
                      await Clipboard.setStringAsync(qrValue);
                      haptics.notificationSuccess();
                    }
                    handleCloseQrModal();
                  }}
                >
                  <Ionicons name="copy-outline" size={16} color="#0f172a" />
                  <Text style={styles.modalActionPrimaryText}>Kimliği Kopyala</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060b1b',
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: '#060b1b',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing[5],
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionText: {
    fontSize: 15,
    color: '#cbd5f5',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(148,163,184,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    color: '#fff',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: 'rgba(226,232,240,0.65)',
  },
  infoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(148,163,184,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  connectionCard: {
    borderRadius: 22,
    padding: 20,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    marginBottom: 18,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  connectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  connectionSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 6,
  },
  connectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.45)',
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  connectionActionDisabled: {
    opacity: 0.35,
  },
  connectionActionPressed: {
    opacity: 0.8,
  },
  connectionActionText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  statItem: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 16,
    padding: 16,
    backgroundColor: 'rgba(30,41,59,0.72)',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(34,197,94,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.25)',
    marginBottom: 20,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#bef264',
    marginBottom: 2,
  },
  tipSubtitle: {
    fontSize: 12,
    color: '#a3e635',
    lineHeight: 18,
  },
  segmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    padding: 6,
    marginBottom: 22,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(14,165,233,0.18)',
  },
  segmentLabel: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  segmentLabelActive: {
    color: '#0ea5e9',
  },
  card: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    marginBottom: 26,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  cardHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  cardHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(14,165,233,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#9aa6c2',
    lineHeight: 20,
  },
  cardHint: {
    marginTop: 16,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  cameraWrapper: {
    height: 260,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
  },
  cameraView: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(8,15,35,0.35)',
  },
  cameraFrame: {
    width: 220,
    height: 220,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(59,130,246,0.8)',
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(10,17,33,0.9)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    marginTop: 6,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
  },
  primaryButtonText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  helperText: {
    marginTop: 12,
    fontSize: 12,
    color: '#94a3b8',
  },
  scanStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  scanStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  scanStatusBadgeActive: {
    backgroundColor: 'rgba(74,222,128,0.18)',
  },
  scanStatusBadgeInactive: {
    backgroundColor: 'rgba(148,163,184,0.12)',
  },
  scanStatusText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#38bdf8',
  },
  scanStatusTextActive: {
    color: '#0f172a',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.35)',
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  secondaryButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  secondaryButtonGhost: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(148,163,184,0.08)',
  },
  secondaryButtonGhostText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.12)',
  },
  deviceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  deviceIdText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  deviceSignal: {
    marginTop: 4,
    fontSize: 12,
    color: '#38bdf8',
  },
  scanLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  scanLoadingText: {
    marginLeft: 12,
    fontSize: 13,
    color: '#cbd5f5',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
  },
  warningText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#f97316',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  qrWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    marginBottom: 20,
  },
  modalIdText: {
    marginTop: 12,
    fontSize: 12,
    color: '#cbd5f5',
  },
  modalHint: {
    fontSize: 12,
    color: '#cbd5f5',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
  },
  modalActionSecondary: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.18)',
  },
  modalActionSecondaryText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  modalActionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#38bdf8',
  },
  modalActionPrimaryText: {
    fontWeight: '700',
    color: '#0f172a',
  },
});

