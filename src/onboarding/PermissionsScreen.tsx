import { Ionicons } from '@expo/vector-icons';
import { logger } from '../utils/productionLogger';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { palette, spacing } from '../ui/theme';
import { permissionsManager, PermissionStatus } from './PermissionsFlow';

export default function PermissionsScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>({
    notifications: 'undetermined',
    location: 'undetermined',
    bluetooth: 'undetermined',
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigation = useNavigation();

  const steps = permissionsManager.getPermissionSteps();
  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  useEffect(() => {
    loadPermissionStatus();
  }, []);

  const loadPermissionStatus = async () => {
    const status = await permissionsManager.getCurrentStatus();
    setPermissionStatus(status);
  };

  const handleGrantPermission = async () => {
    setIsLoading(true);
    
    try {
      let result: 'granted' | 'denied' | 'undetermined' = 'denied';
      
      switch (currentStepData.key) {
        case 'notifications':
          result = await permissionsManager.requestNotificationPermission();
          break;
        case 'location':
          result = await permissionsManager.requestLocationPermission();
          break;
        case 'bluetooth':
          result = await permissionsManager.requestBluetoothPermission();
          break;
        case 'backgroundLocation':
          result = await permissionsManager.requestBackgroundLocationPermission();
          break;
      }

      // Update status
      const newStatus = { ...permissionStatus, [currentStepData.key]: result };
      setPermissionStatus(newStatus);

      if (result === 'denied' && currentStepData.required) {
        Alert.alert(
          'İzin Gerekli',
          `${currentStepData.title} olmadan AfetNet tam işlevsel değildir. Ayarlardan daha sonra izin verebilirsiniz.`,
          [
            { text: 'Tekrar Dene', onPress: () => {} },
            { text: 'Geç', onPress: handleNext },
          ]
        );
      } else {
        handleNext();
      }
    } catch (error) {
      logger.error('Permission request error:', error);
      Alert.alert('Hata', 'İzin isteği başarısız oldu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    if (currentStepData.required) {
      Alert.alert(
        'İzin Gerekli',
        `${currentStepData.title} gerekli bir izindir. Ayarlardan daha sonra izin verebilirsiniz.`,
        [
          { text: 'Tamam', onPress: handleNext },
        ]
      );
    } else {
      handleNext();
    }
  };

  const handleComplete = async () => {
    try {
      await permissionsManager.markOnboardingComplete();
      navigation.navigate('Home' as never);
    } catch (error) {
      logger.error('Error completing onboarding:', error);
      Alert.alert('Hata', 'Onboarding tamamlanamadı');
    }
  };

  const getStatusIcon = (status: 'granted' | 'denied' | 'undetermined') => {
    switch (status) {
      case 'granted':
        return <Ionicons name="checkmark-circle" size={24} color={palette.success.main} />;
      case 'denied':
        return <Ionicons name="close-circle" size={24} color={palette.error.main} />;
      default:
        return <Ionicons name="help-circle" size={24} color={palette.text.secondary} />;
    }
  };

  const getStatusText = (status: 'granted' | 'denied' | 'undetermined') => {
    switch (status) {
      case 'granted':
        return 'Verildi';
      case 'denied':
        return 'Reddedildi';
      default:
        return 'Bekleniyor';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>İzinleri Ayarla</Text>
          <Text style={styles.subtitle}>
            AfetNet'in tam işlevselliği için gerekli izinler
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {currentStep + 1} / {steps.length}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((currentStep + 1) / steps.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        <Card style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            {getStatusIcon(permissionStatus[currentStepData.key])}
            <Text style={styles.permissionTitle}>{currentStepData.title}</Text>
          </View>
          
          <Text style={styles.permissionDescription}>
            {currentStepData.description}
          </Text>

          <View style={styles.statusContainer}>
            <Text style={styles.statusLabel}>Durum:</Text>
            <Text style={[
              styles.statusText,
              permissionStatus[currentStepData.key] === 'granted' && styles.statusGranted,
              permissionStatus[currentStepData.key] === 'denied' && styles.statusDenied,
            ]}>
              {getStatusText(permissionStatus[currentStepData.key])}
            </Text>
          </View>

          {currentStepData.required && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredText}>Gerekli</Text>
            </View>
          )}
        </Card>

        <View style={styles.permissionsOverview}>
          <Text style={styles.overviewTitle}>İzin Durumu</Text>
          {steps.map((step, index) => (
            <View key={step.key} style={styles.overviewItem}>
              {getStatusIcon(permissionStatus[step.key])}
              <Text style={styles.overviewText}>{step.title}</Text>
              {step.required && (
                <Text style={styles.requiredDot}>•</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.buttonContainer}>
          {!isLastStep && (
            <Button
              label="Geç"
              onPress={handleSkip}
              variant="ghost"
              style={styles.skipButton}
            />
          )}
          <Button
            label={
              permissionStatus[currentStepData.key] === 'granted'
                ? 'İleri'
                : 'İzin Ver'
            }
            onPress={
              permissionStatus[currentStepData.key] === 'granted'
                ? handleNext
                : handleGrantPermission
            }
            variant="primary"
            style={styles.grantButton}
            disabled={isLoading}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background.primary,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: palette.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: palette.text.secondary,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: spacing.xl,
  },
  progressText: {
    fontSize: 14,
    color: palette.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  progressBar: {
    height: 4,
    backgroundColor: (palette.border as any).primary || '#E0E0E0',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 2,
  },
  permissionCard: {
    marginBottom: spacing.xl,
  },
  permissionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: palette.text.primary,
    flex: 1,
  },
  permissionDescription: {
    fontSize: 16,
    color: palette.text.primary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusLabel: {
    fontSize: 14,
    color: palette.text.secondary,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusGranted: {
    color: palette.success.main,
  },
  statusDenied: {
    color: palette.error.main,
  },
  requiredBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.warning.main,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    marginTop: spacing.sm,
  },
  requiredText: {
    fontSize: 12,
    color: (palette.text as any).onWarning || '#212121',
    fontWeight: '600',
  },
  permissionsOverview: {
    marginBottom: spacing.xl,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.text.primary,
    marginBottom: spacing.md,
  },
  overviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  overviewText: {
    fontSize: 14,
    color: palette.text.primary,
    flex: 1,
  },
  requiredDot: {
    fontSize: 16,
    color: palette.warning.main,
    fontWeight: 'bold',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: palette.border.primary,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skipButton: {
    flex: 1,
  },
  grantButton: {
    flex: 2,
  },
});
