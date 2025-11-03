/**
 * NEW MESSAGE SCREEN - Find and start conversation
 * QR scan, ID input, or BLE discovery
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMessageStore } from '../../stores/messageStore';
import { bleMeshService } from '../../services/BLEMeshService';
import { useMeshStore } from '../../stores/meshStore';
import { getDeviceId as getDeviceIdFromLib, isValidDeviceId } from '../../../lib/device';
import { colors, typography, spacing, borderRadius } from '../../theme';
import * as haptics from '../../utils/haptics';
import { createLogger } from '../../utils/logger';

const logger = createLogger('NewMessageScreen');

export default function NewMessageScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [activeTab, setActiveTab] = useState<'qr' | 'id' | 'scan'>('qr');
  const [deviceId, setDeviceId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<Array<{ deviceId: string; name?: string; rssi?: number }>>([]);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);

  useEffect(() => {
    const getMyId = async () => {
      try {
        const id = bleMeshService.getMyDeviceId() || await getDeviceIdFromLib();
        setMyDeviceId(id);
      } catch (error) {
        logger.error('Failed to get device ID:', error);
      }
    };
    getMyId();
  }, []);

  useEffect(() => {
    if (activeTab === 'scan') {
      startBLEScan();
    } else {
      stopBLEScan();
    }
    return () => {
      stopBLEScan();
    };
  }, [activeTab]);

  const startBLEScan = () => {
    setIsScanning(true);
    setScannedDevices([]);
    
    // Listen for discovered devices
    const unsubscribe = bleMeshService.onMessage((message) => {
      try {
        // Check content for discovery info (mesh message content is string)
        const content = message.content;
        if (typeof content === 'string') {
          try {
            const data = JSON.parse(content);
            if (data.type === 'discovery' || data.type === 'beacon' || data.type === 'discovery_request') {
              const deviceId = data.deviceId || data.senderId || message.from;
              if (deviceId && deviceId !== myDeviceId) {
                setScannedDevices(prev => {
                  const exists = prev.find(d => d.deviceId === deviceId);
                  if (!exists) {
                    return [...prev, { 
                      deviceId, 
                      name: data.name,
                      rssi: data.rssi 
                    }];
                  }
                  return prev;
                });
              }
            }
          } catch {
            // Not JSON, skip
          }
        }
      } catch (error) {
        logger.error('Error processing discovery message:', error);
      }
    });

    // Broadcast discovery request via mesh store
    if (myDeviceId) {
      useMeshStore.getState().broadcastMessage(JSON.stringify({
        type: 'discovery_request',
        deviceId: myDeviceId,
      }), 'text');
    }

    // Auto-stop after 10 seconds
    setTimeout(() => {
      stopBLEScan();
    }, 10000);
  };

  const stopBLEScan = () => {
    setIsScanning(false);
  };

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

  const startConversation = (targetDeviceId: string) => {
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
        
        useMessageStore.getState().addConversation(newConversation);
        navigation.navigate('Conversation', { userId: targetDeviceId });
      }
    } catch (error) {
      logger.error('Failed to start conversation:', error);
      Alert.alert('Hata', 'Konuşma başlatılamadı. Lütfen tekrar deneyin.');
    }
  };

  if (activeTab === 'qr' && !permission) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>QR kod okumak için kamera izni gereklidir.</Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>İzin Ver</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (activeTab === 'qr' && !permission?.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Kamera izni reddedildi.</Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <LinearGradient
        colors={['#1e293b', '#0f172a']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Pressable 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Yeni Mesaj</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'qr' && styles.tabActive]}
          onPress={() => setActiveTab('qr')}
        >
          <Ionicons 
            name="qr-code" 
            size={20} 
            color={activeTab === 'qr' ? colors.brand.primary : colors.text.secondary} 
          />
          <Text style={[styles.tabText, activeTab === 'qr' && styles.tabTextActive]}>
            QR Kod
          </Text>
        </Pressable>
        
        <Pressable
          style={[styles.tab, activeTab === 'id' && styles.tabActive]}
          onPress={() => setActiveTab('id')}
        >
          <Ionicons 
            name="key" 
            size={20} 
            color={activeTab === 'id' ? colors.brand.primary : colors.text.secondary} 
          />
          <Text style={[styles.tabText, activeTab === 'id' && styles.tabTextActive]}>
            ID ile Ekle
          </Text>
        </Pressable>
        
        <Pressable
          style={[styles.tab, activeTab === 'scan' && styles.tabActive]}
          onPress={() => setActiveTab('scan')}
        >
          <Ionicons 
            name="bluetooth" 
            size={20} 
            color={activeTab === 'scan' ? colors.brand.primary : colors.text.secondary} 
          />
          <Text style={[styles.tabText, activeTab === 'scan' && styles.tabTextActive]}>
            Tarama
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'qr' && (
          <View style={styles.qrContainer}>
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
                facing="back"
                onBarcodeScanned={handleQRScan}
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
              />
              <View style={styles.overlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>
                  QR kodu çerçeveye hizalayın
                </Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'id' && (
          <View style={styles.idContainer}>
            <Text style={styles.sectionTitle}>Cihaz ID Girin</Text>
            <Text style={styles.sectionSubtitle}>
              Kişinin cihaz ID'sini manuel olarak girin
            </Text>
            
            <TextInput
              style={styles.input}
              placeholder="Cihaz ID..."
              placeholderTextColor={colors.text.tertiary}
              value={deviceId}
              onChangeText={setDeviceId}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable style={styles.addButton} onPress={handleManualAdd}>
              <LinearGradient
                colors={[colors.brand.primary, colors.brand.secondary]}
                style={styles.addButtonGradient}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.addButtonText}>Ekle ve Mesaj Gönder</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        {activeTab === 'scan' && (
          <View style={styles.scanContainer}>
            <Text style={styles.sectionTitle}>Yakındaki Cihazlar</Text>
            <Text style={styles.sectionSubtitle}>
              {isScanning 
                ? 'Cihazlar taranıyor...' 
                : 'Tarama tamamlandı. Yeniden başlatmak için tekrar tıklayın.'}
            </Text>

            {scannedDevices.length === 0 && !isScanning && (
              <Pressable style={styles.scanButton} onPress={startBLEScan}>
                <Ionicons name="refresh" size={20} color={colors.brand.primary} />
                <Text style={styles.scanButtonText}>Yeniden Tara</Text>
              </Pressable>
            )}

            {scannedDevices.map((device) => (
              <Pressable
                key={device.deviceId}
                style={styles.deviceCard}
                onPress={() => handleDeviceSelect(device.deviceId)}
              >
                <View style={styles.deviceIcon}>
                  <Ionicons name="phone-portrait" size={24} color={colors.brand.primary} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>
                    {device.name || `Cihaz ${device.deviceId.slice(0, 8)}...`}
                  </Text>
                  <Text style={styles.deviceId}>{device.deviceId}</Text>
                  {device.rssi && (
                    <Text style={styles.deviceRssi}>
                      Sinyal: {device.rssi > -70 ? 'Güçlü' : device.rssi > -90 ? 'Orta' : 'Zayıf'}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={24} color={colors.text.tertiary} />
              </Pressable>
            ))}

            {scannedDevices.length === 0 && isScanning && (
              <View style={styles.scanningIndicator}>
                <Ionicons name="bluetooth" size={48} color={colors.brand.primary} />
                <Text style={styles.scanningText}>Cihazlar aranıyor...</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  tabActive: {
    backgroundColor: colors.brand.primary + '20',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.brand.primary,
  },
  content: {
    flex: 1,
  },
  qrContainer: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: colors.brand.primary,
    borderRadius: 20,
  },
  scanHint: {
    marginTop: 32,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  idContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  addButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  scanContainer: {
    padding: 20,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    marginTop: 12,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  deviceRssi: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  scanningIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  scanningText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.text.secondary,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionText: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

