import * as Application from 'expo-application';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { backgroundHardeningManager } from '../background/hardening';
import { remoteConfigManager } from '../config/remote';
import { useDevLog } from '../store/devlog';
import { useEmergency } from '../store/emergency';
import { useGroups } from '../store/groups';
import { usePeople } from '../store/people';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';
import { logger } from '../utils/productionLogger';

interface HealthData {
  appVersion: string;
  buildNumber: string;
  deviceInfo: {
    brand: string;
    model: string;
    osName: string;
    osVersion: string;
    platform: string;
  };
  uptime: number;
  configVersion: number;
  killSwitchActive: boolean;
  backgroundStatus: {
    enabled: boolean;
    lastRun: number;
    runCount: number;
    errorCount: number;
  };
  storage: {
    totalEvents: number;
    groupsCount: number;
    peopleCount: number;
    emergencyActive: boolean;
  };
}

export default function HealthScreen() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const { getEvents } = useDevLog();
  const { items: groups } = useGroups();
  const { items: people } = usePeople();
  const { enabled: emergencyEnabled } = useEmergency();

  useEffect(() => {
    loadHealthData();
  }, []);

  const loadHealthData = async () => {
    try {
      const appVersion = Application.nativeApplicationVersion || 'Unknown';
      const buildNumber = Application.nativeBuildVersion || 'Unknown';
      
      const deviceInfo = {
        brand: Device.brand || 'Unknown',
        model: Device.modelName || 'Unknown',
        osName: Device.osName || 'Unknown',
        osVersion: Device.osVersion || 'Unknown',
        platform: Platform.OS,
      };

      const uptime = Date.now() - ((globalThis as any).appStartTime || Date.now());
      
      const remoteConfig = remoteConfigManager.getConfig();
      const backgroundStatus = backgroundHardeningManager.getStatus();
      
      const events = getEvents();
      
      const data: HealthData = {
        appVersion,
        buildNumber,
        deviceInfo,
        uptime,
        configVersion: remoteConfig.version,
        killSwitchActive: remoteConfigManager.isKillSwitchActive(),
        backgroundStatus: { ...backgroundStatus, enabled: true },
        storage: {
          totalEvents: events.length,
          groupsCount: groups.length,
          peopleCount: people.length,
          emergencyActive: emergencyEnabled,
        },
      };

      setHealthData(data);
    } catch (error) {
      logger.error('Error loading health data:', error);
    }
  };

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}g ${hours % 24}s`;
    if (hours > 0) return `${hours}s ${minutes % 60}dk`;
    if (minutes > 0) return `${minutes}dk ${seconds % 60}sn`;
    return `${seconds}sn`;
  };

  const generateHealthReport = async (): Promise<string> => {
    if (!healthData) throw new Error('Health data not available');

    const events = getEvents();
    const remoteConfig = remoteConfigManager.getConfig();

    const report = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      health: healthData,
      events: events.slice(-100), // Last 100 events
      remoteConfig: {
        version: remoteConfig.version,
        killActive: remoteConfig.kill?.active || false,
        flags: remoteConfig.flags,
        features: remoteConfig.features,
      },
      groups: groups.map(g => ({
        id: g.id,
        name: g.name,
        gid: g.gid,
        memberCount: g.members.length,
        hasSharedKey: !!g.sharedKeyB64,
        isCreator: g.isCreator,
        createdAt: g.createdAt,
        lastActivity: g.lastActivity,
      })),
      people: people.map(p => ({
        id: p.id,
        displayName: p.displayName,
        afnId: p.afnId,
        paired: p.paired,
        lastSeen: p.lastSeen,
      })),
    };

    return JSON.stringify(report, null, 2);
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    
    try {
      const reportData = await generateHealthReport();
      
      // Create a temporary file
      const fileName = `afetnet-health-report-${Date.now()}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Write the report to file
      await FileSystem.writeAsStringAsync(fileUri, reportData, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      
      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'AfetNet Sağlık Raporu',
        });
      } else {
        // Fallback to text sharing
        await Share.share({
          message: reportData,
          title: 'AfetNet Sağlık Raporu',
        });
      }
      
      Alert.alert('Başarılı', 'Sağlık raporu oluşturuldu ve paylaşıldı');
    } catch (error) {
      logger.error('Error generating health report:', error);
      Alert.alert('Hata', 'Sağlık raporu oluşturulamadı');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleReportIssue = () => {
    const emailBody = `
AfetNet Sorun Bildirimi

Uygulama Bilgileri:
- Sürüm: ${healthData?.appVersion || 'Bilinmiyor'}
- Build: ${healthData?.buildNumber || 'Bilinmiyor'}
- Platform: ${healthData?.deviceInfo.platform || 'Bilinmiyor'}
- OS: ${healthData?.deviceInfo.osName || 'Bilinmiyor'} ${healthData?.deviceInfo.osVersion || 'Bilinmiyor'}
- Cihaz: ${healthData?.deviceInfo.brand || 'Bilinmiyor'} ${healthData?.deviceInfo.model || 'Bilinmiyor'}

Sorun Açıklaması:
[Lütfen yaşadığınız sorunu detaylı olarak açıklayın]

Adımlar:
1. Ne yapmaya çalışıyordunuz?
2. Ne olmasını bekliyordunuz?
3. Ne oldu?
4. Hata mesajı var mıydı?

Ek Bilgiler:
- Uptime: ${healthData ? formatUptime(healthData.uptime) : 'Bilinmiyor'}
- Grup Sayısı: ${healthData?.storage.groupsCount || 0}
- Kişi Sayısı: ${healthData?.storage.peopleCount || 0}
- Toplam Olay: ${healthData?.storage.totalEvents || 0}
- Acil Durum Aktif: ${healthData?.storage.emergencyActive ? 'Evet' : 'Hayır'}
- Kill Switch: ${healthData?.killSwitchActive ? 'Aktif' : 'Pasif'}
    `.trim();

    Share.share({
      message: emailBody,
      title: 'AfetNet Sorun Bildirimi',
    });
  };

  if (!healthData) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Sağlık verileri yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card title="Uygulama Bilgileri">
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sürüm:</Text>
            <Text style={styles.infoValue}>{healthData.appVersion}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Build:</Text>
            <Text style={styles.infoValue}>{healthData.buildNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform:</Text>
            <Text style={styles.infoValue}>{healthData.deviceInfo.platform}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>OS:</Text>
            <Text style={styles.infoValue}>
              {healthData.deviceInfo.osName} {healthData.deviceInfo.osVersion}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cihaz:</Text>
            <Text style={styles.infoValue}>
              {healthData.deviceInfo.brand} {healthData.deviceInfo.model}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Çalışma Süresi:</Text>
            <Text style={styles.infoValue}>{formatUptime(healthData.uptime)}</Text>
          </View>
        </Card>

        <Card title="Sistem Durumu">
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uzak Yapılandırma:</Text>
            <Text style={styles.infoValue}>v{healthData.configVersion}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kill Switch:</Text>
            <Text style={[
              styles.infoValue,
              healthData.killSwitchActive ? styles.errorText : styles.successText,
            ]}>
              {healthData.killSwitchActive ? 'Aktif' : 'Pasif'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Arka Plan Görevler:</Text>
            <Text style={[
              styles.infoValue,
              healthData.backgroundStatus.enabled ? styles.successText : styles.errorText,
            ]}>
              {healthData.backgroundStatus.enabled ? 'Aktif' : 'Pasif'}
            </Text>
          </View>
          {healthData.backgroundStatus.enabled && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Son Çalışma:</Text>
                <Text style={styles.infoValue}>
                  {healthData.backgroundStatus.lastRun > 0 
                    ? formatUptime(Date.now() - healthData.backgroundStatus.lastRun) + ' önce'
                    : 'Hiç çalışmadı'
                  }
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Çalışma Sayısı:</Text>
                <Text style={styles.infoValue}>{healthData.backgroundStatus.runCount}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Hata Sayısı:</Text>
                <Text style={[
                  styles.infoValue,
                  healthData.backgroundStatus.errorCount > 0 ? styles.errorText : styles.successText,
                ]}>
                  {healthData.backgroundStatus.errorCount}
                </Text>
              </View>
            </>
          )}
        </Card>

        <Card title="Veri Durumu">
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Toplam Olay:</Text>
            <Text style={styles.infoValue}>{healthData.storage.totalEvents}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Grup Sayısı:</Text>
            <Text style={styles.infoValue}>{healthData.storage.groupsCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Kişi Sayısı:</Text>
            <Text style={styles.infoValue}>{healthData.storage.peopleCount}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Acil Durum:</Text>
            <Text style={[
              styles.infoValue,
              healthData.storage.emergencyActive ? styles.errorText : styles.successText,
            ]}>
              {healthData.storage.emergencyActive ? 'Aktif' : 'Pasif'}
            </Text>
          </View>
        </Card>

        <View style={styles.actionsContainer}>
          <Button
            label="Tanı Raporu Oluştur"
            onPress={handleGenerateReport}
            variant="primary"
            style={styles.actionButton}
            disabled={isGeneratingReport}
          />
          <Button
            label="Sorun Bildir"
            onPress={handleReportIssue}
            variant="ghost"
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.background.primary,
  },
  loadingText: {
    fontSize: 16,
    color: palette.text.secondary,
  },
  content: {
    padding: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    color: palette.text.secondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: palette.text.primary,
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
  },
  successText: {
    color: palette.success.main,
  },
  errorText: {
    color: palette.error.main,
  },
  actionsContainer: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
});
