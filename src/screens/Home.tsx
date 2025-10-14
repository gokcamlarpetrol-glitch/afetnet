import { Ionicons } from '@expo/vector-icons';
import { logger } from '../utils/productionLogger';
import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { earlyWarningSystem } from '../services/alerts/EarlyWarningSystem';
import { victimDetectionSystem } from '../services/detection/VictimDetectionSystem';
import { emergencyMeshManager } from '../services/emergency/EmergencyMeshManager';
import { panicModeManager } from '../services/emergency/PanicModeManager';
import { rescueCoordinator } from '../services/emergency/RescueCoordinator';
import { offlineMapManager } from '../services/mapping/OfflineMapManager';
import { emergencyMedicalSystem } from '../services/medical/EmergencyMedicalSystem';
import { offlineMessageManager } from '../services/messaging/OfflineMessageManager';
import { emergencyPowerManager } from '../services/power/EmergencyPowerManager';
import { rescueGuidanceSystem } from '../services/rescue/RescueGuidanceSystem';
import { emergencySensorManager } from '../services/sensors/EmergencySensorManager';
import { voiceCommandManager } from '../services/voice/VoiceCommandManager';
import { useFamily } from '../store/family';
import { useQueue } from '../store/queue';
import { useSettings } from '../store/settings';
import SOSModal from '../ui/SOSModal';

const { width } = Dimensions.get('window');

const Card = ({ children, style, onPress }: { 
  children: React.ReactNode; 
  style?: any; 
  onPress?: () => void;
}) => {
  const Component = onPress ? TouchableOpacity : View;
  return (
    <Component
      style={[
        {
          backgroundColor: '#121a34',
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: '#1b2746',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
        style
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.8 : 1}
    >
      {children}
    </Component>
  );
};

const SectionTitle = ({ title }: { title: string }) => (
  <Text style={{ 
    color: '#cdd7ff', 
    fontSize: 16, 
    fontWeight: '600',
    marginBottom: 12, 
    marginTop: 24,
    letterSpacing: 0.5
  }}>
    {title}
  </Text>
);

export default function Home() {
  const [sosModalVisible, setSosModalVisible] = useState(false);
  const [meshActive, setMeshActive] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<any>(null);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [rescueOperations, setRescueOperations] = useState<any[]>([]);
  const [connectedNodes, setConnectedNodes] = useState<any[]>([]);
  const [sensorMonitoring, setSensorMonitoring] = useState(false);
  const [earthquakeDetections, setEarthquakeDetections] = useState<any[]>([]);
  const [debrisLocations, setDebrisLocations] = useState<any[]>([]);
  const [rescueMissions, setRescueMissions] = useState<any[]>([]);
  const [voiceCommandsActive, setVoiceCommandsActive] = useState(false);
  const [powerMode, setPowerMode] = useState<any>(null);
  const [panicModeActive, setPanicModeActive] = useState(false);
  const [victimDetections, setVictimDetections] = useState<any[]>([]);
  const [earthquakeWarnings, setEarthquakeWarnings] = useState<any[]>([]);
  const [medicalEmergencies, setMedicalEmergencies] = useState<any[]>([]);
  
  const { list: familyList } = useFamily();
  const { items: queueItems, flush } = useQueue();
  const { } = useSettings();

  useEffect(() => {
    initializeEmergencySystems();
    setupEventListeners();
    updateStatus();
    
    const interval = setInterval(updateStatus, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const initializeEmergencySystems = async () => {
    try {
      // Start emergency mesh network
      const meshStarted = await emergencyMeshManager.startEmergencyMesh();
      setMeshActive(meshStarted);
      
      // Start sensor monitoring
      const sensorStarted = await emergencySensorManager.startEmergencyMonitoring();
      setSensorMonitoring(sensorStarted);
      
      // Start voice commands
      const voiceStarted = await voiceCommandManager.startVoiceRecognition();
      setVoiceCommandsActive(voiceStarted);
      
      // Start power management
      await emergencyPowerManager.startBatteryMonitoring();
      
      // Start victim detection
      await victimDetectionSystem.startVictimDetection();
      
      // Start early warning system
      await earlyWarningSystem.startEarlyWarningMonitoring();
      
      // Start medical monitoring
      await emergencyMedicalSystem.startMedicalMonitoring();
      
      // Initialize map manager
      offlineMapManager.setOfflineMode(!networkStatus?.isConnected);
      
      // Get initial status
      updateStatus();
      
      logger.debug('🚨 Emergency systems initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize emergency systems:', error);
    }
  };

  const setupEventListeners = () => {
    // Mesh network events
    emergencyMeshManager.on('meshStarted', () => {
      setMeshActive(true);
      logger.debug('✅ Mesh network started');
    });

    emergencyMeshManager.on('meshStopped', () => {
      setMeshActive(false);
      logger.debug('🛑 Mesh network stopped');
    });

    emergencyMeshManager.on('nodeConnected', (node: any) => {
      logger.debug('🔗 Node connected:', node.name);
      updateStatus();
    });

    emergencyMeshManager.on('nodeDisconnected', (nodeId: string) => {
      logger.debug('🔌 Node disconnected:', nodeId);
      updateStatus();
    });

    // Rescue coordination events
    rescueCoordinator.on('rescueOperationCreated', (operation: any) => {
      logger.debug('🚁 New rescue operation:', operation.id);
      updateStatus();
    });

    rescueCoordinator.on('victimRegistered', (victim: any) => {
      logger.debug('👥 New victim registered:', victim.name);
      updateStatus();
    });

    // Message queue events
    offlineMessageManager.on('messageQueued', (message: any) => {
      logger.debug('📨 Message queued:', message.id);
      updateStatus();
    });

    offlineMessageManager.on('sosMessageQueued', (message: any) => {
      logger.debug('🚨 SOS message queued:', message.id);
      Alert.alert(
        'SOS Gönderildi', 
        'Yardım talebiniz mesh ağına gönderildi. En yakın kurtarma ekibi bilgilendirildi.',
        [{ text: 'Tamam', style: 'default' }]
      );
    });

    // Sensor events
    emergencySensorManager.on('earthquakeDetected', (detection: any) => {
      logger.debug('🌍 Earthquake detected:', detection.intensity);
      setEarthquakeDetections(prev => [detection, ...prev.slice(0, 9)]); // Keep last 10
      Alert.alert(
        'DEPREM ALGILANDI',
        `${detection.intensity.toUpperCase()} şiddetinde deprem tespit edildi!\nBüyüklük: ${detection.magnitude.toFixed(1)}\nOtomatik yardım talebi gönderildi.`,
        [{ text: 'Tamam', style: 'default' }]
      );
    });

    emergencySensorManager.on('emergencyEventDetected', (event: any) => {
      logger.debug('🚨 Emergency event:', event.type, event.severity);
      if (event.severity === 'critical') {
        Alert.alert(
          'ACİL DURUM ALGILANDI',
          `${event.type.toUpperCase()} olayı tespit edildi!\nŞiddet: ${event.severity.toUpperCase()}\nOtomatik yardım talebi gönderildi.`,
          [{ text: 'Tamam', style: 'default' }]
        );
      }
    });

    // Map manager events
    offlineMapManager.on('debrisLocationAdded', (location: any) => {
      logger.debug('🏢 Debris location added:', location.id);
      setDebrisLocations(prev => [location, ...prev]);
    });

    // Rescue guidance events
    rescueGuidanceSystem.on('rescueMissionCreated', (mission: any) => {
      logger.debug('🚁 Rescue mission created:', mission.id);
      setRescueMissions(prev => [mission, ...prev.slice(0, 9)]); // Keep last 10
    });

    // Victim detection events
    victimDetectionSystem.on('victimDetected', (detection: any) => {
      logger.debug('👤 Victim detected:', detection.id);
      setVictimDetections(prev => [detection, ...prev.slice(0, 9)]); // Keep last 10
      Alert.alert(
        'KURBAN TESPİT EDİLDİ',
        `Enkaz altında kurban tespit edildi!\nKonum: ${detection.location.lat}, ${detection.location.lon}\nÖncelik: ${detection.priority.toUpperCase()}`,
        [{ text: 'Tamam', style: 'default' }]
      );
    });

    victimDetectionSystem.on('victimConfirmed', (detection: any) => {
      logger.debug('✅ Victim confirmed:', detection.id);
      setVictimDetections(prev => prev.map(d => d.id === detection.id ? detection : d));
    });

    // Early warning events
    earlyWarningSystem.on('earthquakeWarningReceived', (warning: any) => {
      logger.debug('🌍 Earthquake warning received:', warning.severity);
      setEarthquakeWarnings(prev => [warning, ...prev.slice(0, 9)]); // Keep last 10
    });

    earlyWarningSystem.on('emergencyAlertCreated', (alert: any) => {
      logger.debug('🚨 Emergency alert created:', alert.title);
      Alert.alert(
        alert.title,
        alert.message,
        [
          { text: 'Tamam', style: 'default' },
          { text: 'Talimatları Gör', style: 'default', onPress: () => {
            Alert.alert(
              'Acil Durum Talimatları',
              alert.instructions.join('\n'),
              [{ text: 'Tamam', style: 'default' }]
            );
          }}
        ]
      );
    });

    // Medical emergency events
    emergencyMedicalSystem.on('medicalEmergencyCreated', (emergency: any) => {
      logger.debug('💊 Medical emergency created:', emergency.type);
      setMedicalEmergencies(prev => [emergency, ...prev.slice(0, 9)]); // Keep last 10
      Alert.alert(
        'TIBBİ ACİL DURUM',
        `${emergency.type.toUpperCase()} tıbbi acil durum tespit edildi!\nŞiddet: ${emergency.severity.toUpperCase()}\nÖncelik: ${emergency.priority.toUpperCase()}`,
        [{ text: 'Tamam', style: 'default' }]
      );
    });
  };

  const updateStatus = async () => {
    try {
      // Get network status
      const networkState = await NetInfo.fetch();
      setNetworkStatus({
        isConnected: networkState.isConnected,
        isInternetReachable: networkState.isInternetReachable,
        connectionType: networkState.type,
      });

      // Get mesh network stats
      const meshStats = emergencyMeshManager.getNetworkStats();
      setConnectedNodes(emergencyMeshManager.getConnectedNodes());

      // Get message queue status
      const queueStatusData = offlineMessageManager.getQueueStatus();
      setQueueStatus(queueStatusData);

      // Get active rescue operations
      const operations = rescueCoordinator.getActiveOperations();
      setRescueOperations(operations);

      // Get sensor data
      const latestSensorData = emergencySensorManager.getLatestSensorData();
      setSensorMonitoring(emergencySensorManager.isCurrentlyMonitoring());

      // Get earthquake detections
      const earthquakeDetections = emergencySensorManager.getEarthquakeDetections();
      setEarthquakeDetections(earthquakeDetections.slice(0, 5)); // Show last 5

      // Get debris locations
      const debris = offlineMapManager.getAllDebrisLocations();
      setDebrisLocations(debris.slice(0, 5)); // Show last 5

      // Get rescue missions
      const missions = rescueGuidanceSystem.getActiveMissions();
      setRescueMissions(missions.slice(0, 5)); // Show last 5

      // Get voice command status
      setVoiceCommandsActive(false); // Temporarily disabled

      // Get power mode status
      const powerOptimization = emergencyPowerManager.getPowerOptimization();
      setPowerMode(powerOptimization.currentMode);

      // Get panic mode status
      const panicStatus = panicModeManager.getPanicModeStatus();
      setPanicModeActive(panicStatus.isActive);

      // Get victim detections
      const victimDetections = victimDetectionSystem.getActiveDetections();
      setVictimDetections(victimDetections.slice(0, 5)); // Show last 5

      // Get earthquake warnings
      const warnings = earlyWarningSystem.getActiveWarnings();
      setEarthquakeWarnings(warnings.slice(0, 5)); // Show last 5

      // Get medical emergencies
      const emergencies = emergencyMedicalSystem.getActiveMedicalEmergencies();
      setMedicalEmergencies(emergencies.slice(0, 5)); // Show last 5

    } catch (error) {
      logger.error('❌ Error updating status:', error);
    }
  };

  const handleSOSSubmit = async (data: unknown) => {
    try {
      // Get current location (simplified)
      const location = {
        lat: 41.0082 + (Math.random() - 0.5) * 0.01, // Istanbul area with some randomness
        lon: 28.9784 + (Math.random() - 0.5) * 0.01,
        accuracy: 10,
      };

      // Send SOS via offline message manager
      const sosMessage = {
        type: 'sos' as const,
        location,
        note: (data as any).note || 'Yardım istiyorum',
        people: (data as any).people,
        timestamp: Date.now()
      };
      
      const messageId = await offlineMessageManager.sendMessage(
        JSON.stringify(sosMessage)
      );

      logger.debug('🚨 SOS message sent:', messageId);
      
      // Close modal
      setSosModalVisible(false);
      
    } catch (error) {
      logger.error('❌ Failed to send SOS:', error);
      Alert.alert('Hata', 'SOS mesajı gönderilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleSendQueue = async () => {
    try {
      if (queueItems.length === 0) {
        Alert.alert('Bilgi', 'Gönderilecek mesaj bulunmuyor.');
        return;
      }

              // Process all queued items
              for (const item of queueItems) {
                await offlineMessageManager.sendMessage(
                  (item as any).text || 'Mesaj' // Simplified message
                );
              }

      flush();
      
      Alert.alert(
        'Başarılı', 
        `${queueItems.length} mesaj mesh ağına gönderildi.`,
        [{ text: 'Tamam', style: 'default' }]
      );
      
    } catch (error) {
      logger.error('❌ Failed to send queue:', error);
      Alert.alert('Hata', 'Mesajlar gönderilemedi. Lütfen tekrar deneyin.');
    }
  };

  const handleRetryFailedMessages = async () => {
    try {
      await offlineMessageManager.retryFailedMessages();
      Alert.alert('Başarılı', 'Başarısız mesajlar yeniden gönderildi.');
      updateStatus();
    } catch (error) {
      logger.error('❌ Failed to retry messages:', error);
      Alert.alert('Hata', 'Mesajlar yeniden gönderilemedi.');
    }
  };

  const handleClearFailedMessages = async () => {
    Alert.alert(
      'Mesajları Temizle',
      'Başarısız mesajları silmek istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            await offlineMessageManager.clearFailedMessages();
            updateStatus();
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B1220' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0B1220" />
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Header */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ 
                color: '#ffffff', 
                fontSize: 32, 
                fontWeight: '800',
                letterSpacing: -0.5
              }}>
                AfetNet
              </Text>
              <Text style={{ 
                color: '#8da0cc', 
                fontSize: 14,
                marginTop: 2,
                fontWeight: '500'
              }}>
                Acil Durum İletişim Ağı
              </Text>
            </View>
            
            {/* Status Indicators */}
            <View style={{ alignItems: 'flex-end' }}>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: '#1b2746',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                marginBottom: 8
              }}>
                <View style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: 4, 
                  backgroundColor: '#38d39f', 
                  marginRight: 8 
                }} />
                <Text style={{ color: '#e9f0ff', fontSize: 12, fontWeight: '600' }}>
                  Durum OK
                </Text>
              </View>
              <View style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                backgroundColor: '#1b2746',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20
              }}>
                <Ionicons name="list" size={12} color="#8da0cc" style={{ marginRight: 6 }} />
                <Text style={{ color: '#8da0cc', fontSize: 12, fontWeight: '500' }}>
                  Kuyruk {queueItems.length}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced System Status Card */}
        <Card style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ 
                width: 12, 
                height: 12, 
                borderRadius: 6, 
                backgroundColor: meshActive ? '#38d39f' : '#ef476f', 
                marginRight: 12 
              }} />
              <View>
                <Text style={{ color: '#e9f0ff', fontSize: 16, fontWeight: '600' }}>
                  {meshActive ? 'Mesh Ağı Aktif' : 'Mesh Ağı Kapalı'}
                </Text>
                <Text style={{ color: '#8da0cc', fontSize: 13, marginTop: 2 }}>
                  {connectedNodes.length} cihaz bağlı
                </Text>
              </View>
            </View>
            <View style={{ 
              backgroundColor: meshActive ? '#0e3d28' : '#7d1a1a', 
              paddingHorizontal: 10, 
              paddingVertical: 4, 
              borderRadius: 12 
            }}>
              <Text style={{ color: meshActive ? '#7df5b7' : '#ff7f7f', fontSize: 11, fontWeight: '600' }}>
                {meshActive ? 'ONLINE' : 'OFFLINE'}
              </Text>
            </View>
          </View>

          {/* Enhanced Network Status Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={networkStatus?.isConnected ? 'wifi' : 'wifi-outline'} 
                size={16} 
                color={networkStatus?.isConnected ? '#38d39f' : '#ef476f'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                İnternet: {networkStatus?.isConnected ? 'Bağlı' : 'Kesik'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={sensorMonitoring ? 'pulse' : 'pulse-outline'} 
                size={16} 
                color={sensorMonitoring ? '#38d39f' : '#ef476f'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Sensör: {sensorMonitoring ? 'Aktif' : 'Kapalı'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={queueStatus?.pendingMessages > 0 ? 'time' : 'checkmark-circle'} 
                size={16} 
                color={queueStatus?.pendingMessages > 0 ? '#f59e0b' : '#38d39f'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Kuyruk: {queueStatus?.pendingMessages || 0}
              </Text>
            </View>
          </View>

          {/* Emergency Alerts Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={earthquakeDetections.length > 0 ? 'warning' : 'warning-outline'} 
                size={16} 
                color={earthquakeDetections.length > 0 ? '#f59e0b' : '#8da0cc'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Deprem: {earthquakeDetections.length}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={debrisLocations.length > 0 ? 'business' : 'business-outline'} 
                size={16} 
                color={debrisLocations.length > 0 ? '#ef476f' : '#8da0cc'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Enkaz: {debrisLocations.length}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={rescueMissions.length > 0 ? 'airplane' : 'airplane-outline'} 
                size={16} 
                color={rescueMissions.length > 0 ? '#3b82f6' : '#8da0cc'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Kurtarma: {rescueMissions.length}
              </Text>
            </View>
          </View>

          {/* Power and Voice Status Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={powerMode?.id === 'emergency' || powerMode?.id === 'critical' ? 'battery-dead' : 'battery-half'} 
                size={16} 
                color={powerMode?.id === 'emergency' || powerMode?.id === 'critical' ? '#ef476f' : '#38d39f'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Güç: {powerMode?.name || 'Normal'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={voiceCommandsActive ? 'mic' : 'mic-off'} 
                size={16} 
                color={voiceCommandsActive ? '#38d39f' : '#ef476f'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Ses: {voiceCommandsActive ? 'Aktif' : 'Kapalı'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={panicModeActive ? 'radio-button-on' : 'radio-button-off'} 
                size={16} 
                color={panicModeActive ? '#ef476f' : '#8da0cc'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Panik: {panicModeActive ? 'Aktif' : 'Kapalı'}
              </Text>
            </View>
          </View>

          {/* Advanced Detection Status Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={victimDetections.length > 0 ? 'person' : 'person-outline'} 
                size={16} 
                color={victimDetections.length > 0 ? '#ef476f' : '#8da0cc'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Mağdur: {victimDetections.length}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={earthquakeWarnings.length > 0 ? 'warning' : 'warning-outline'} 
                size={16} 
                color={earthquakeWarnings.length > 0 ? '#f59e0b' : '#8da0cc'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Uyarı: {earthquakeWarnings.length}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons 
                name={medicalEmergencies.length > 0 ? 'medical' : 'medical-outline'} 
                size={16} 
                color={medicalEmergencies.length > 0 ? '#ef476f' : '#8da0cc'} 
                style={{ marginRight: 6 }}
              />
              <Text style={{ color: '#8da0cc', fontSize: 12 }}>
                Tıbbi: {medicalEmergencies.length}
              </Text>
            </View>
          </View>

          {/* Rescue Operations Status */}
          {rescueOperations.length > 0 && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: '#1a233b',
              padding: 8,
              borderRadius: 8,
              marginTop: 8
            }}>
              <Ionicons name="warning" size={16} color="#f59e0b" style={{ marginRight: 8 }} />
              <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '600', flex: 1 }}>
                {rescueOperations.length} aktif kurtarma operasyonu
              </Text>
              <TouchableOpacity onPress={() => {
                Alert.alert(
                  'Aktif Operasyonlar',
                  rescueOperations.map(op => `Operasyon ${op.id}: ${op.priority} öncelik`).join('\n'),
                  [{ text: 'Tamam' }]
                );
              }}>
                <Text style={{ color: '#8da0cc', fontSize: 11 }}>Detay</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Failed Messages Actions */}
          {queueStatus?.failedMessages > 0 && (
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: '#7d1a1a',
              padding: 8,
              borderRadius: 8,
              marginTop: 8,
              justifyContent: 'space-between'
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="alert-circle" size={16} color="#ff7f7f" style={{ marginRight: 8 }} />
                <Text style={{ color: '#ff7f7f', fontSize: 12, fontWeight: '600' }}>
                  {queueStatus.failedMessages} başarısız mesaj
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={handleRetryFailedMessages}>
                  <Text style={{ color: '#8bd0ff', fontSize: 11, fontWeight: '600' }}>Yeniden Dene</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleClearFailedMessages}>
                  <Text style={{ color: '#ff7f7f', fontSize: 11, fontWeight: '600' }}>Temizle</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        {/* Earthquake Alert */}
        <Card style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#e9f0ff', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
                Deprem Uyarısı
              </Text>
              <Text style={{ color: '#8da0cc', fontSize: 13 }}>
                Şu an deprem bildirimi yok.
              </Text>
            </View>
            <Ionicons name="warning-outline" size={24} color="#f59e0b" />
          </View>
        </Card>

        {/* Emergency Actions */}
        <SectionTitle title="Acil İşlemler" />
        
        {/* SOS Button */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => setSosModalVisible(true)}
          style={{
            backgroundColor: '#e3575d',
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#ff7f86',
            marginBottom: 12,
            shadowColor: '#e3575d',
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: '#1c0f10', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                SOS / YARDIM TALEBİ
              </Text>
              <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '800', marginTop: 6, letterSpacing: 0.3 }}>
                YARDIM İSTE
              </Text>
            </View>
            <Ionicons name="warning" size={28} color="#ffffff" />
          </View>
        </TouchableOpacity>

        {/* Panic Mode Button */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={async () => {
            const success = await panicModeManager.activatePanicMode('emergency_sos', 'manual');
            if (success) {
              setPanicModeActive(true);
              Alert.alert(
                'PANİK MODU AKTİF',
                'Panik modu aktifleştirildi! Tüm acil durum sistemleri devreye girdi.',
                [{ text: 'Tamam', style: 'default' }]
              );
            }
          }}
          style={{
            backgroundColor: panicModeActive ? '#8B0000' : '#FF4444',
            borderRadius: 16,
            padding: 20,
            borderWidth: 2,
            borderColor: panicModeActive ? '#FF0000' : '#FF6666',
            marginBottom: 12,
            shadowColor: '#FF4444',
            shadowOpacity: 0.4,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                {panicModeActive ? 'PANİK MODU AKTİF' : 'PANİK MODU'}
              </Text>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 6, letterSpacing: 0.3 }}>
                {panicModeActive ? 'AKTİF' : 'AKTİFLEŞTİR'}
              </Text>
            </View>
            <Ionicons 
              name={panicModeActive ? "radio-button-on" : "radio-button-off"} 
              size={28} 
              color="#FFFFFF" 
            />
          </View>
        </TouchableOpacity>

        {/* Send Queue Button */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={handleSendQueue}
          style={{
            backgroundColor: '#2fb970',
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#44d487',
            shadowColor: '#2fb970',
            shadowOpacity: 0.3,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: '#072015', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 }}>
                KUYRUĞU GÖNDER
              </Text>
              <Text style={{ color: '#eafff3', fontSize: 18, fontWeight: '800', marginTop: 6 }}>
                GÖNDER ({queueItems.length})
              </Text>
            </View>
            <View style={{ 
              backgroundColor: queueItems.length > 0 ? '#0e3d28' : '#1a233b',
              paddingHorizontal: 12, 
              paddingVertical: 6, 
              borderRadius: 16 
            }}>
              <Text style={{ 
                color: queueItems.length > 0 ? '#7df5b7' : '#8da0cc', 
                fontSize: 11, 
                fontWeight: '700' 
              }}>
                {queueItems.length > 0 ? 'Bekleyen' : 'Boş'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Family Section */}
        <SectionTitle title="Aile" />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {/* Family avatars */}
              {familyList.slice(0, 3).map((member, idx) => (
                <View key={idx} style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#1b2746',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: member.status === 'ok' ? '#38d39f' : member.status === 'need' ? '#f59e0b' : '#ef476f'
                }}>
                  <Text style={{ color: '#cdd7ff', fontSize: 16, fontWeight: '700' }}>
                    {member.name?.charAt(0) || '?'}
                  </Text>
                </View>
              ))}
              {familyList.length === 0 && (
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: '#1b2746',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#26345b',
                  borderStyle: 'dashed'
                }}>
                  <Ionicons name="person-add" size={20} color="#8da0cc" />
                </View>
              )}
              
              {/* Status indicators */}
              <View style={{ flexDirection: 'row', gap: 8, marginLeft: 8 }}>
                {['#38d39f', '#f59e0b', '#ef476f'].map((color, i) => (
                  <View key={i} style={{ 
                    width: 10, 
                    height: 10, 
                    borderRadius: 5, 
                    backgroundColor: color 
                  }} />
                ))}
              </View>
            </View>
            <Text style={{ color: '#8da0cc', fontSize: 12, fontWeight: '500' }}>
              Tümü
            </Text>
          </View>
          <Text style={{ color: '#8da0cc', fontSize: 13, lineHeight: 18 }}>
            {familyList.length === 0 
              ? 'Ailenizi ekleyin ve durumlarını görün.' 
              : `${familyList.length} aile üyesi takip ediliyor.`
            }
          </Text>
        </Card>

        {/* Quick Actions */}
        <SectionTitle title="Hızlı Erişim" />
        <Card style={{ padding: 0 }}>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              {[
                { label: 'Harita', icon: 'map-outline' },
                { label: 'Yakındakiler', icon: 'people-outline' },
                { label: 'QR Senk', icon: 'qr-code-outline' }
              ].map((item, k) => (
                <TouchableOpacity key={k} style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: '#0F1730',
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#1b2746',
                  }}>
                    <Ionicons name={item.icon as any} size={24} color="#8da0cc" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#cdd7ff', fontSize: 12, fontWeight: '500' }}>
                      {item.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {[
                { label: 'BLE Yayın', icon: 'radio-outline' },
                { label: 'Mesajlar', icon: 'chatbubble-outline' },
                { label: 'Güvenlik', icon: 'shield-outline' }
              ].map((item, k) => (
                <TouchableOpacity key={k} style={{ flex: 1 }}>
                  <View style={{
                    backgroundColor: '#0F1730',
                    paddingVertical: 16,
                    borderRadius: 12,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: '#1b2746',
                  }}>
                    <Ionicons name={item.icon as any} size={24} color="#8da0cc" style={{ marginBottom: 8 }} />
                    <Text style={{ color: '#cdd7ff', fontSize: 12, fontWeight: '500' }}>
                      {item.label}
                    </Text>
            </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* Info Card */}
        <SectionTitle title="Acil Durum Bilgisi" />
        <Card style={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Ionicons name="information-circle" size={20} color="#3b82f6" style={{ marginTop: 2 }} />
            <Text style={{ color: '#cdd7ff', fontSize: 13, lineHeight: 20, flex: 1 }}>
              Deprem ve acil durumlarda yakınınızdaki diğer AfetNet kullanıcılarıyla şebeke olmadan iletişim kurabilirsiniz.
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* SOS Modal */}
      <SOSModal
        visible={sosModalVisible}
        onClose={() => setSosModalVisible(false)}
        onSubmit={handleSOSSubmit}
      />
    </SafeAreaView>
  );
}