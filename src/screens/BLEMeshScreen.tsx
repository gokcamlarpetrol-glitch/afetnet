import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Alert, Pressable, ScrollView } from 'react-native';
import { bleRelay, RelayMessage } from '../services/ble/bleRelay';
import { logger } from '../utils/productionLogger';

export default function BLEMeshScreen() {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState<RelayMessage[]>([]);
  const [rssiSamples, setRssiSamples] = useState<any[]>([]);
  const [seenCount, setSeenCount] = useState(0);

  useEffect(() => {
    // Set up message listener
    const unsubscribe = bleRelay.onMessage((message: RelayMessage) => {
      setMessages(prev => [message, ...prev.slice(0, 49)]); // Keep last 50 messages
      logger.info('BLE Mesh message received', { type: message.type, id: message.id });
    });

    // Update RSSI samples periodically
    const rssiInterval = setInterval(() => {
      setRssiSamples(bleRelay.getRSSISamples());
    }, 5000);

    // Update seen count periodically
    const seenInterval = setInterval(() => {
      setSeenCount(bleRelay.getSeenCount());
    }, 2000);

    return () => {
      unsubscribe();
      clearInterval(rssiInterval);
      clearInterval(seenInterval);
    };
  }, []);

  const startBLEMesh = async () => {
    try {
      await bleRelay.startRelay('demo_identity_pub_key', true); // Enable adaptive mode
      setIsActive(true);
      Alert.alert('Başarılı', 'BLE Mesh Networking başlatıldı');
      logger.info('BLE Mesh networking started');
    } catch (error) {
      logger.error('Failed to start BLE Mesh:', error);
      Alert.alert('Hata', 'BLE Mesh başlatılamadı');
    }
  };

  const stopBLEMesh = async () => {
    try {
      await bleRelay.stopRelay();
      setIsActive(false);
      Alert.alert('Başarılı', 'BLE Mesh Networking durduruldu');
      logger.info('BLE Mesh networking stopped');
    } catch (error) {
      logger.error('Failed to stop BLE Mesh:', error);
      Alert.alert('Hata', 'BLE Mesh durdurulamadı');
    }
  };

  const sendTestMessage = async () => {
    try {
      const testMessage: RelayMessage = {
        id: `test_${Date.now()}`,
        from: 'demo_identity_pub_key',
        ts: Date.now(),
        type: 'PING',
        ttl: 3,
        payload: 'Test mesajı'
      };

      await bleRelay.sendDirect(testMessage);
      Alert.alert('Başarılı', 'Test mesajı gönderildi');
      logger.info('Test message sent', { id: testMessage.id });
    } catch (error) {
      logger.error('Failed to send test message:', error);
      Alert.alert('Hata', 'Test mesajı gönderilemedi');
    }
  };

  const sendSOSMessage = async () => {
    try {
      const sosMessage: RelayMessage = {
        id: `sos_${Date.now()}`,
        from: 'demo_identity_pub_key',
        ts: Date.now(),
        type: 'SOS',
        lat: 41.0082, // Istanbul coordinates
        lon: 28.9784,
        ttl: 5,
        payload: 'Acil durum - yardım istiyorum!'
      };

      await bleRelay.sendDirect(sosMessage);
      Alert.alert('SOS Gönderildi', 'Acil durum mesajı BLE mesh ağına gönderildi');
      logger.info('SOS message sent', { id: sosMessage.id });
    } catch (error) {
      logger.error('Failed to send SOS message:', error);
      Alert.alert('Hata', 'SOS mesajı gönderilemedi');
    }
  };

  const clearMessages = () => {
    bleRelay.clearCache();
    setMessages([]);
    setRssiSamples([]);
    setSeenCount(0);
    Alert.alert('Temizlendi', 'Tüm mesajlar ve cache temizlendi');
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('tr-TR');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📡 BLE Mesh Networking</Text>
        <Text style={styles.subtitle}>
          {isActive ? 'Ağ aktif - mesajlar alınıyor' : 'Ağ durduruldu'}
        </Text>
      </View>

      {/* Status Info */}
      <View style={styles.statusContainer}>
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Durum:</Text>
          <Text style={[styles.statusValue, { color: isActive ? '#4CAF50' : '#F44336' }]}>
            {isActive ? '🟢 Aktif' : '🔴 Durduruldu'}
          </Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Görülen Mesaj:</Text>
          <Text style={styles.statusValue}>{seenCount}</Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>RSSI Örnek:</Text>
          <Text style={styles.statusValue}>{rssiSamples.length}</Text>
        </View>
        
        <View style={styles.statusItem}>
          <Text style={styles.statusLabel}>Mesaj Sayısı:</Text>
          <Text style={styles.statusValue}>{messages.length}</Text>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        {!isActive ? (
          <Pressable style={styles.startButton} onPress={startBLEMesh}>
            <Text style={styles.buttonText}>▶️ Ağı Başlat</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.stopButton} onPress={stopBLEMesh}>
            <Text style={styles.buttonText}>⏹️ Ağı Durdur</Text>
          </Pressable>
        )}
        
        {isActive && (
          <>
            <Pressable style={styles.testButton} onPress={sendTestMessage}>
              <Text style={styles.buttonText}>📤 Test Mesajı</Text>
            </Pressable>
            
            <Pressable style={styles.sosButton} onPress={sendSOSMessage}>
              <Text style={styles.buttonText}>🚨 SOS Gönder</Text>
            </Pressable>
          </>
        )}
        
        <Pressable style={styles.clearButton} onPress={clearMessages}>
          <Text style={styles.buttonText}>🗑️ Temizle</Text>
        </Pressable>
      </View>

      {/* Messages List */}
      <ScrollView style={styles.messagesContainer}>
        <Text style={styles.sectionTitle}>📨 Son Mesajlar</Text>
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>Henüz mesaj yok</Text>
        ) : (
          messages.map((message, index) => (
            <View key={message.id} style={styles.messageItem}>
              <View style={styles.messageHeader}>
                <Text style={styles.messageType}>
                  {message.type === 'SOS' ? '🚨' : message.type === 'PING' ? '📡' : '📨'}
                  {message.type}
                </Text>
                <Text style={styles.messageTime}>
                  {formatTimestamp(message.ts)}
                </Text>
              </View>
              
              <Text style={styles.messageId}>ID: {message.id.substring(0, 12)}...</Text>
              
              {message.lat && message.lon && (
                <Text style={styles.messageLocation}>
                  📍 {message.lat.toFixed(4)}, {message.lon.toFixed(4)}
                </Text>
              )}
              
              {message.payload && (
                <Text style={styles.messagePayload}>{message.payload}</Text>
              )}
              
              <Text style={styles.messageTTL}>TTL: {message.ttl}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Features Info */}
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>✅ BLE Mesh Özellikleri</Text>
        <Text style={styles.featureItem}>• Offline mesh networking</Text>
        <Text style={styles.featureItem}>• SOS mesaj yayını</Text>
        <Text style={styles.featureItem}>• Konum paylaşımı</Text>
        <Text style={styles.featureItem}>• Adaptive scanning</Text>
        <Text style={styles.featureItem}>• RSSI tabanlı yakınlık</Text>
        <Text style={styles.featureItem}>• Message deduplication</Text>
        <Text style={styles.featureItem}>• TTL tabanlı routing</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#2c2c2c',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginTop: 8,
  },
  statusContainer: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 12,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
  },
  stopButton: {
    backgroundColor: '#F44336',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
  },
  testButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
  },
  sosButton: {
    backgroundColor: '#FF5722',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
  },
  clearButton: {
    backgroundColor: '#757575',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginTop: 20,
  },
  messageItem: {
    backgroundColor: '#f8f8f8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  messageType: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
  },
  messageTime: {
    fontSize: 12,
    color: '#666666',
  },
  messageId: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  messageLocation: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 4,
  },
  messagePayload: {
    fontSize: 14,
    color: '#333333',
    marginBottom: 4,
  },
  messageTTL: {
    fontSize: 12,
    color: '#FF9800',
    fontWeight: 'bold',
  },
  featuresContainer: {
    backgroundColor: '#ffffff',
    padding: 16,
    margin: 20,
    marginTop: 0,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
});
