import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useI18n } from '../../hooks/useI18n';
import { useBattery } from '../../hooks/useBattery';
import { HelpModal } from '../components/HelpModal';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { BLEMeshManager } from '../../core/p2p/ble';
import { MessageQueue } from '../../core/p2p/queue';
import { MessageEncoder } from '../../core/p2p/message';
import { HelpRequestRepository } from '../../core/data/repositories';

export const HomeScreen: React.FC = () => {
  const { t } = useI18n();
  const { batteryLevel, isCharging } = useBattery();
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [queueLength, setQueueLength] = useState(0);

  const bleManager = BLEMeshManager.getInstance();
  const messageQueue = MessageQueue.getInstance();

  useEffect(() => {
    // Initialize BLE and message queue
    const initializeP2P = async () => {
      try {
        if (bleManager.isBLEAvailable()) {
          await bleManager.startScanning();
          setBleConnected(true);
        }

        // Set up event listeners
        const unsubscribePeerFound = bleManager.onPeerFound(() => {
          setPeerCount(bleManager.getPeerCount());
        });

        const unsubscribePeerConnected = bleManager.onPeerConnected(() => {
          setPeerCount(bleManager.getPeerCount());
        });

        // Start queue processor
        await messageQueue.startQueueProcessor(5000);

        return () => {
          unsubscribePeerFound();
          unsubscribePeerConnected();
        };
      } catch (error) {
        console.error('Failed to initialize P2P:', error);
        Alert.alert(
          t('error.title'),
          t('error.bluetooth')
        );
      }
    };

    const cleanup = initializeP2P();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, [t]);

  const handleHelpRequest = () => {
    setShowHelpModal(true);
  };

  const handleStatusPing = async () => {
    try {
      // Create a status ping message
      const statusMessage = MessageEncoder.createStatusPing({
        id: `status_${Date.now()}`,
        lat: 41.0082, // Istanbul coordinates
        lon: 28.9784,
        accuracy: 10,
        battery: batteryLevel,
        note: 'Güvendeyim',
      });

      // Add to queue for broadcasting
      await messageQueue.enqueue(statusMessage, 0);
      
      Alert.alert(
        t('success.title'),
        t('status.sent')
      );
    } catch (error) {
      console.error('Failed to send status ping:', error);
      Alert.alert(
        t('error.title'),
        t('error.network')
      );
    }
  };

  const handleMapView = () => {
    // Navigate to map screen
    // This would be handled by navigation in a real app
    console.log('Navigate to map');
  };

  const getBatteryColor = () => {
    if (batteryLevel < 20) return '#FF3B30';
    if (batteryLevel < 50) return '#FF9500';
    return '#34C759';
  };

  const getBatteryIcon = () => {
    if (batteryLevel < 20) return '🔴';
    if (batteryLevel < 50) return '🟡';
    return '🟢';
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('home.title')}</Text>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      </View>

      {/* Status Cards */}
      <View style={styles.statusGrid}>
        <Card style={styles.statusCard}>
          <Text style={styles.statusLabel}>{t('status.battery')}</Text>
          <Text style={[styles.statusValue, { color: getBatteryColor() }]}>
            {getBatteryIcon()} {Math.round(batteryLevel)}%
          </Text>
          {isCharging && <Text style={styles.charging}>🔌 {t('status.charging')}</Text>}
        </Card>

        <Card style={styles.statusCard}>
          <Text style={styles.statusLabel}>{t('status.network')}</Text>
          <Text style={[styles.statusValue, { color: bleConnected ? '#34C759' : '#FF3B30' }]}>
            {bleConnected ? '🟢' : '🔴'} {peerCount} {t('status.peers')}
          </Text>
        </Card>

        <Card style={styles.statusCard}>
          <Text style={styles.statusLabel}>{t('status.queue')}</Text>
          <Text style={[styles.statusValue, { color: queueLength > 0 ? '#FF9500' : '#34C759' }]}>
            {queueLength} {t('status.messages')}
          </Text>
        </Card>
      </View>

      {/* Main Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.helpButton]}
          onPress={handleHelpRequest}
          accessibilityLabel={t('home.helpRequest')}
          accessibilityHint={t('home.helpRequestHint')}
        >
          <Text style={styles.actionButtonIcon}>🆘</Text>
          <Text style={styles.actionButtonText}>{t('home.helpRequest')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.statusButton]}
          onPress={handleStatusPing}
          accessibilityLabel={t('home.statusSafe')}
          accessibilityHint={t('home.statusSafeHint')}
        >
          <Text style={styles.actionButtonIcon}>✅</Text>
          <Text style={styles.actionButtonText}>{t('home.statusSafe')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.mapButton]}
          onPress={handleMapView}
          accessibilityLabel={t('home.viewMap')}
          accessibilityHint={t('home.viewMapHint')}
        >
          <Text style={styles.actionButtonIcon}>🗺️</Text>
          <Text style={styles.actionButtonText}>{t('home.viewMap')}</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.quickActionsTitle}>{t('home.quickActions')}</Text>
        
        <View style={styles.quickActionsGrid}>
          <Button
            title={t('home.family')}
            onPress={() => {}}
            style={styles.quickActionButton}
            accessibilityLabel={t('home.family')}
          />
          <Button
            title={t('home.community')}
            onPress={() => {}}
            style={styles.quickActionButton}
            accessibilityLabel={t('home.community')}
          />
          <Button
            title={t('home.guide')}
            onPress={() => {}}
            style={styles.quickActionButton}
            accessibilityLabel={t('home.guide')}
          />
          <Button
            title={t('home.settings')}
            onPress={() => {}}
            style={styles.quickActionButton}
            accessibilityLabel={t('home.settings')}
          />
        </View>
      </View>

      {/* Help Modal */}
      <HelpModal
        visible={showHelpModal}
        onClose={() => setShowHelpModal(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  statusCard: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    padding: 16,
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  charging: {
    fontSize: 10,
    color: '#34C759',
    marginTop: 2,
  },
  actions: {
    marginBottom: 30,
  },
  actionButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  helpButton: {
    borderColor: '#FF3B30',
    backgroundColor: '#2a1a1a',
  },
  statusButton: {
    borderColor: '#34C759',
    backgroundColor: '#1a2a1a',
  },
  mapButton: {
    borderColor: '#007AFF',
    backgroundColor: '#1a1a2a',
  },
  actionButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  quickActions: {
    marginBottom: 20,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    marginBottom: 12,
  },
});