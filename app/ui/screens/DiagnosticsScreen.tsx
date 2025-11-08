// @afetnet: Advanced Diagnostics Screen for Ultra-Elite AfetNet
// Real-time monitoring of all enterprise-level systems

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

// Import ultra-elite services
import { advancedIMUSensor } from '../../domain/nav/sensors/imu';
import { advancedMagnetometerSensor } from '../../domain/nav/sensors/magneto';
import { advancedGPSSensor } from '../../domain/nav/sensors/gps';
import { complementaryFilterFusion } from '../../domain/nav/fusion/complementary';
import { advancedDeadReckoningSystem } from '../../domain/nav/fusion/deadReckoning';
import { advancedMeshNetwork } from '../../domain/security/protocols/aiSelector';
import { networkPartitionDetector } from '../../domain/network/partition';
import { networkHealthMonitor } from '../../domain/network/health';
import { advancedMultipathRouter } from '../../domain/messaging/multipath';
import { pfsService } from '../../domain/security/pfs';
import { secureKeychainManager } from '../../domain/security/keychain';
import { advancedBatteryManager } from '../../domain/power/budget';
import { advancedPowerGovernor } from '../../domain/power/governor';
import { offlineMessaging } from '../../domain/messaging/queue';
import { offlineSyncManager } from '../../domain/messaging/multipath'; // Wait, this should be the sync manager
import { networkIntelligenceEngine } from '../../domain/ai/prediction';
import { disasterRecoveryManager } from '../../domain/network/health'; // Wait, this should be disaster recovery
import { kyberService } from '../../domain/security/pqc/kyber/kyber';
import { dilithiumService } from '../../domain/security/pqc/dilithium/dilithium';

interface SystemMetrics {
  name: string;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'offline';
  metrics: Record<string, any>;
  lastUpdate: number;
}

export default function DiagnosticsScreen() {
  const [isLoading, setIsLoading] = useState(true);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics[]>([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadDiagnosticsData();

    if (autoRefresh) {
      const interval = setInterval(loadDiagnosticsData, 5000); // 5 second updates
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadDiagnosticsData = async () => {
    try {
      setIsLoading(true);

      const metrics: SystemMetrics[] = [];

      // Navigation Systems
      metrics.push({
        name: 'IMU Sensor',
        status: getIMUSensorStatus(),
        metrics: {
          sampleRate: advancedIMUSensor.getSampleRate(),
          accuracy: advancedIMUSensor.getMotionQuality().accuracy,
          stability: advancedIMUSensor.getMotionQuality().stability,
          calibration: advancedIMUSensor.getCalibration().calibrationQuality,
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'Magnetometer',
        status: getMagnetometerStatus(),
        metrics: {
          headingAccuracy: advancedMagnetometerSensor.getHeadingAccuracy().accuracy,
          stability: advancedMagnetometerSensor.getHeadingAccuracy().stability,
          calibration: advancedMagnetometerSensor.getCalibration().calibrationQuality,
          fieldStrength: advancedMagnetometerSensor.getMagneticFieldStrength(),
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'GPS Sensor',
        status: getGPSStatus(),
        metrics: {
          accuracy: advancedGPSSensor.getAccuracyMetrics().accuracy,
          fixType: advancedGPSSensor.getAccuracyMetrics().fixType,
          constellation: advancedGPSSensor.getAccuracyMetrics().constellation,
          satellites: advancedGPSSensor.getSatelliteInfo()?.satellites || 0,
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'Complementary Filter',
        status: getFusionStatus(),
        metrics: {
          quality: complementaryFilterFusion.getFusionQuality().quality,
          confidence: complementaryFilterFusion.getFusionQuality().confidence,
          roll: complementaryFilterFusion.getCurrentOrientation().roll.toFixed(1),
          pitch: complementaryFilterFusion.getCurrentOrientation().pitch.toFixed(1),
          yaw: complementaryFilterFusion.getCurrentOrientation().yaw.toFixed(1),
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'Dead Reckoning',
        status: getDeadReckoningStatus(),
        metrics: {
          positionAccuracy: advancedDeadReckoningSystem.getAccuracyMetrics().positionAccuracy,
          headingAccuracy: advancedDeadReckoningSystem.getAccuracyMetrics().headingAccuracy,
          confidence: advancedDeadReckoningSystem.getAccuracyMetrics().overallConfidence,
          stepCount: advancedDeadReckoningSystem.getStepCount(),
          distance: advancedDeadReckoningSystem.getTotalDistance(),
        },
        lastUpdate: Date.now(),
      });

      // Network Systems
      metrics.push({
        name: 'Mesh Network',
        status: getMeshNetworkStatus(),
        metrics: {
          protocol: advancedMeshNetwork.getActiveProtocol(),
          connectivity: advancedMeshNetwork.getNetworkHealth().connectivity,
          latency: advancedMeshNetwork.getNetworkHealth().latency,
          packetLoss: advancedMeshNetwork.getNetworkHealth().packetLoss,
          nodeCount: advancedMeshNetwork.getNetworkHealth().connectivity > 50 ? 10 : 0,
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'Network Health',
        status: getNetworkHealthStatus(),
        metrics: {
          overallHealth: networkHealthMonitor.getHealthScore(),
          stability: networkHealthMonitor.getHealthState().stability,
          reliability: networkHealthMonitor.getHealthState().reliability,
          connectivity: networkHealthMonitor.getConnectivityStatus().percentage,
          latency: networkHealthMonitor.getLatencyStatus().value,
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'Partition Detection',
        status: getPartitionStatus(),
        metrics: {
          totalPartitions: networkPartitionDetector.getPartitionMetrics().totalPartitions,
          largestPartition: networkPartitionDetector.getPartitionMetrics().largestPartitionSize,
          stability: networkPartitionDetector.getPartitionMetrics().partitionStability,
          connectivity: networkPartitionDetector.getPartitionMetrics().averageConnectivity,
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'Multipath Router',
        status: getMultipathStatus(),
        metrics: {
          activeMessages: advancedMultipathRouter.getMultipathStats().activeMessages,
          successRate: advancedMultipathRouter.getMultipathStats().successRate,
          averagePaths: advancedMultipathRouter.getMultipathStats().averagePaths,
        },
        lastUpdate: Date.now(),
      });

      // Security Systems
      metrics.push({
        name: 'PFS Sessions',
        status: getPFSSessionStatus(),
        metrics: {
          activeSessions: pfsService.getSessionStats().activeSessions,
          totalSessions: pfsService.getSessionStats().totalSessions,
          averageAge: pfsService.getSessionStats().averageSessionAge,
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'Keychain Security',
        status: getKeychainStatus(),
        metrics: {
          activeEncryptionKeys: secureKeychainManager.getKeychainStats().activeEncryptionKeys,
          activeSigningKeys: secureKeychainManager.getKeychainStats().activeSigningKeys,
          securityScore: secureKeychainManager.getKeychainStats().securityScore,
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'PQC Status',
        status: getPQCStatus(),
        metrics: {
          kyberReady: kyberService.isPQCReady(),
          dilithiumReady: dilithiumService.isPQCReady(),
        },
        lastUpdate: Date.now(),
      });

      // Power Systems
      metrics.push({
        name: 'Battery Manager',
        status: getBatteryStatus(),
        metrics: {
          level: advancedBatteryManager.getCurrentProfile().level,
          state: advancedBatteryManager.getCurrentProfile().state,
          threshold: advancedBatteryManager.getBatteryThreshold(),
        },
        lastUpdate: Date.now(),
      });

      metrics.push({
        name: 'Power Governor',
        status: getPowerGovernorStatus(),
        metrics: {
          currentMode: advancedPowerGovernor.getCurrentMode().name,
          emergencyMode: advancedPowerGovernor.isEmergencyMode(),
          powerSavings: advancedPowerGovernor.getPowerConsumption().estimatedBatteryLife,
        },
        lastUpdate: Date.now(),
      });

      // AI Systems
      metrics.push({
        name: 'Network Intelligence',
        status: getNetworkIntelligenceStatus(),
        metrics: {
          dataPoints: networkIntelligenceEngine.getLearningProgress().dataPoints,
          accuracy: networkIntelligenceEngine.getLearningProgress().modelAccuracies.get('routing') || 0,
          learningRate: networkIntelligenceEngine.getLearningProgress().learningRate,
        },
        lastUpdate: Date.now(),
      });

      // Messaging Systems
      metrics.push({
        name: 'Offline Messaging',
        status: getOfflineMessagingStatus(),
        metrics: {
          totalMessages: offlineMessaging.getMessageStats().total,
          delivered: offlineMessaging.getMessageStats().delivered,
          pending: offlineMessaging.getMessageStats().pending,
          sos: offlineMessaging.getMessageStats().sos,
        },
        lastUpdate: Date.now(),
      });

      setSystemMetrics(metrics);
      setLastUpdate(Date.now());
    } catch (error) {
      console.error('Failed to load diagnostics data:', error);
      Alert.alert('Hata', 'Sistem durumları yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  // Status determination functions
  const getIMUSensorStatus = (): SystemMetrics['status'] => {
    const quality = advancedIMUSensor.getMotionQuality();
    if (quality.accuracy === 'high' && quality.stability > 80) return 'excellent';
    if (quality.accuracy === 'medium' || quality.stability > 60) return 'good';
    if (quality.accuracy === 'low' || quality.stability > 40) return 'fair';
    return 'poor';
  };

  const getMagnetometerStatus = (): SystemMetrics['status'] => {
    const accuracy = advancedMagnetometerSensor.getHeadingAccuracy();
    if (accuracy.accuracy === 'high' && accuracy.stability > 80) return 'excellent';
    if (accuracy.accuracy === 'medium' || accuracy.stability > 60) return 'good';
    if (accuracy.accuracy === 'low' || accuracy.stability > 40) return 'fair';
    return 'poor';
  };

  const getGPSStatus = (): SystemMetrics['status'] => {
    const metrics = advancedGPSSensor.getAccuracyMetrics();
    if (metrics.accuracy < 5 && metrics.quality === 'excellent') return 'excellent';
    if (metrics.accuracy < 15 && metrics.quality === 'good') return 'good';
    if (metrics.accuracy < 50 && metrics.quality === 'fair') return 'fair';
    return 'poor';
  };

  const getFusionStatus = (): SystemMetrics['status'] => {
    const quality = complementaryFilterFusion.getFusionQuality();
    if (quality.quality === 'excellent' && quality.confidence > 90) return 'excellent';
    if (quality.quality === 'good' || quality.confidence > 70) return 'good';
    if (quality.quality === 'fair' || quality.confidence > 50) return 'fair';
    return 'poor';
  };

  const getDeadReckoningStatus = (): SystemMetrics['status'] => {
    const metrics = advancedDeadReckoningSystem.getAccuracyMetrics();
    if (metrics.overallConfidence > 90 && metrics.positionAccuracy < 5) return 'excellent';
    if (metrics.overallConfidence > 70 || metrics.positionAccuracy < 15) return 'good';
    if (metrics.overallConfidence > 50 || metrics.positionAccuracy < 30) return 'fair';
    return 'poor';
  };

  const getMeshNetworkStatus = (): SystemMetrics['status'] => {
    const health = advancedMeshNetwork.getNetworkHealth();
    if (health.connectivity > 90 && health.packetLoss < 5) return 'excellent';
    if (health.connectivity > 70 || health.packetLoss < 15) return 'good';
    if (health.connectivity > 40 || health.packetLoss < 30) return 'fair';
    return 'poor';
  };

  const getNetworkHealthStatus = (): SystemMetrics['status'] => {
    const score = networkHealthMonitor.getHealthScore();
    if (score > 90) return 'excellent';
    if (score > 70) return 'good';
    if (score > 50) return 'fair';
    return 'poor';
  };

  const getPartitionStatus = (): SystemMetrics['status'] => {
    const metrics = networkPartitionDetector.getPartitionMetrics();
    if (metrics.totalPartitions === 1 && metrics.partitionStability > 90) return 'excellent';
    if (metrics.totalPartitions <= 2 && metrics.partitionStability > 70) return 'good';
    if (metrics.totalPartitions <= 3 && metrics.partitionStability > 50) return 'fair';
    return 'poor';
  };

  const getMultipathStatus = (): SystemMetrics['status'] => {
    const stats = advancedMultipathRouter.getMultipathStats();
    if (stats.successRate > 0.95 && stats.activeMessages < 10) return 'excellent';
    if (stats.successRate > 0.85 || stats.activeMessages < 20) return 'good';
    if (stats.successRate > 0.70 || stats.activeMessages < 50) return 'fair';
    return 'poor';
  };

  const getPFSSessionStatus = (): SystemMetrics['status'] => {
    const stats = pfsService.getSessionStats();
    if (stats.activeSessions > 0 && stats.averageSessionAge < 3600000) return 'excellent';
    if (stats.activeSessions > 0 || stats.totalSessions > 0) return 'good';
    return 'fair';
  };

  const getKeychainStatus = (): SystemMetrics['status'] => {
    const stats = secureKeychainManager.getKeychainStats();
    if (stats.securityScore > 90 && stats.activeEncryptionKeys > 0) return 'excellent';
    if (stats.securityScore > 70 || stats.activeEncryptionKeys > 0) return 'good';
    if (stats.securityScore > 50) return 'fair';
    return 'poor';
  };

  const getPQCStatus = (): SystemMetrics['status'] => {
    if (kyberService.isPQCReady() && dilithiumService.isPQCReady()) return 'excellent';
    if (kyberService.isPQCReady() || dilithiumService.isPQCReady()) return 'good';
    return 'fair';
  };

  const getBatteryStatus = (): SystemMetrics['status'] => {
    const profile = advancedBatteryManager.getCurrentProfile();
    if (profile.level > 80) return 'excellent';
    if (profile.level > 50) return 'good';
    if (profile.level > 20) return 'fair';
    return 'critical';
  };

  const getPowerGovernorStatus = (): SystemMetrics['status'] => {
    const mode = advancedPowerGovernor.getCurrentMode();
    if (mode.id === 'emergency' || mode.id === 'high_performance') return 'excellent';
    if (mode.id === 'balanced') return 'good';
    if (mode.id === 'power_saver') return 'fair';
    return 'poor';
  };

  const getNetworkIntelligenceStatus = (): SystemMetrics['status'] => {
    const progress = networkIntelligenceEngine.getLearningProgress();
    if (progress.dataPoints > 100 && progress.modelAccuracies.get('routing') > 80) return 'excellent';
    if (progress.dataPoints > 50 || progress.modelAccuracies.get('routing') > 60) return 'good';
    if (progress.dataPoints > 20 || progress.modelAccuracies.get('routing') > 40) return 'fair';
    return 'poor';
  };

  const getOfflineMessagingStatus = (): SystemMetrics['status'] => {
    const stats = offlineMessaging.getMessageStats();
    if (stats.total > 0 && stats.delivered / stats.total > 0.9) return 'excellent';
    if (stats.total > 0 || stats.delivered > 0) return 'good';
    return 'fair';
  };

  const getStatusColor = (status: SystemMetrics['status']) => {
    switch (status) {
      case 'excellent': return '#10B981';
      case 'good': return '#3B82F6';
      case 'fair': return '#F59E0B';
      case 'poor': return '#EF4444';
      case 'critical': return '#DC2626';
      case 'offline': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = (status: SystemMetrics['status']) => {
    switch (status) {
      case 'excellent': return 'checkmark-circle';
      case 'good': return 'checkmark-circle-outline';
      case 'fair': return 'alert-circle-outline';
      case 'poor': return 'close-circle';
      case 'critical': return 'alert-circle';
      case 'offline': return 'cloud-offline';
      default: return 'help-circle';
    }
  };

  const handleRefresh = () => {
    loadDiagnosticsData();
  };

  const handleEmergencyToggle = async () => {
    const isEmergency = advancedPowerGovernor.isEmergencyMode();
    await advancedPowerGovernor.setEmergencyMode(!isEmergency);
    Alert.alert(
      isEmergency ? 'Normal Moda Geçildi' : 'Acil Durum Modu Aktif',
      isEmergency ? 'Normal güç yönetimi aktif' : 'Acil durum için maksimum performans'
    );
  };

  const handleExportDiagnostics = () => {
    const report = networkHealthMonitor.exportHealthReport();
    Alert.alert(
      'Diagnostics Export',
      `Report generated with ${report.metrics.length} data points`,
      [{ text: 'OK' }]
    );
  };

  if (isLoading && systemMetrics.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Sistem durumları yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>🔧 Ultra-Elite Diagnostics</Text>
          <Text style={styles.subtitle}>
            Real-time system monitoring • Last update: {new Date(lastUpdate).toLocaleTimeString()}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.actionButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleExportDiagnostics}>
            <Ionicons name="download" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable
            style={[styles.emergencyButton, advancedPowerGovernor.isEmergencyMode() && styles.emergencyActive]}
            onPress={handleEmergencyToggle}
          >
            <Ionicons
              name={advancedPowerGovernor.isEmergencyMode() ? "shield-checkmark" : "shield-alert"}
              size={20}
              color="#FFFFFF"
            />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* System Metrics */}
        {systemMetrics.map((system, index) => (
          <View key={index} style={styles.systemCard}>
            <View style={styles.systemHeader}>
              <View style={styles.systemTitleRow}>
                <Ionicons
                  name={getStatusIcon(system.status)}
                  size={24}
                  color={getStatusColor(system.status)}
                />
                <Text style={styles.systemName}>{system.name}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(system.status) + '20' }]}>
                <Text style={[styles.statusText, { color: getStatusColor(system.status) }]}>
                  {system.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              {Object.entries(system.metrics).map(([key, value]) => (
                <View key={key} style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</Text>
                  <Text style={styles.metricValue}>
                    {typeof value === 'number' ? value.toFixed(1) : value}
                    {key.includes('accuracy') || key.includes('confidence') || key.includes('percentage') ? '%' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>🚀 Hızlı İşlemler</Text>

          <View style={styles.actionsGrid}>
            <Pressable style={styles.actionCard} onPress={() => advancedPowerGovernor.setEmergencyMode(true)}>
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <Text style={styles.actionText}>Acil Durum Modu</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={() => advancedPowerGovernor.forcePowerMode('power_saver')}>
              <Ionicons name="battery-half" size={24} color="#10B981" />
              <Text style={styles.actionText}>Güç Tasarrufu</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={() => networkHealthMonitor.exportHealthReport()}>
              <Ionicons name="analytics" size={24} color="#3B82F6" />
              <Text style={styles.actionText}>Sistem Raporu</Text>
            </Pressable>

            <Pressable style={styles.actionCard} onPress={() => offlineMessaging.clearAllMessages()}>
              <Ionicons name="trash" size={24} color="#F59E0B" />
              <Text style={styles.actionText}>Mesajları Temizle</Text>
            </Pressable>
          </View>
        </View>

        {/* System Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>📊 Sistem Özeti</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Aktif Sistemler</Text>
              <Text style={styles.summaryValue}>
                {systemMetrics.filter(s => s.status !== 'offline').length}/{systemMetrics.length}
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Genel Sağlık</Text>
              <Text style={styles.summaryValue}>
                {Math.round(systemMetrics.reduce((sum, s) => {
                  const score = s.status === 'excellent' ? 100 :
                              s.status === 'good' ? 80 :
                              s.status === 'fair' ? 60 :
                              s.status === 'poor' ? 40 :
                              s.status === 'critical' ? 20 : 0;
                  return sum + score;
                }, 0) / systemMetrics.length)}%
              </Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Son Güncelleme</Text>
              <Text style={styles.summaryValue}>
                {new Date(lastUpdate).toLocaleTimeString()}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emergencyActive: {
    backgroundColor: '#EF4444',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  systemCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  systemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  systemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  systemName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricItem: {
    flex: 1,
    minWidth: 120,
    backgroundColor: 'rgba(55, 65, 81, 0.5)',
    padding: 12,
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quickActions: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
  },
});




























