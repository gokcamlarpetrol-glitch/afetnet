/**
 * DRILL MODE SCREEN
 * Offline drill mode with alarm simulation, assembly scenarios, report output
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { multiChannelAlertService } from '../../services/MultiChannelAlertService';
import { createLogger } from '../../utils/logger';

const logger = createLogger('DrillModeScreen');

interface DrillScenario {
  id: string;
  title: string;
  description: string;
  duration: number; // minutes
  steps: string[];
  magnitude: number;
}

const DRILL_SCENARIOS: DrillScenario[] = [
  {
    id: 'mild',
    title: 'Hafif Deprem (4.5 ML)',
    description: 'Hafif bir deprem senaryosu - hazırlık kontrolü',
    duration: 5,
    magnitude: 4.5,
    steps: [
      'Uyarı alın',
      'Güvenli yere geçin',
      'Aile durumunu kontrol edin',
      'Çıkış planını gözden geçirin',
      'Rapor gönderin',
    ],
  },
  {
    id: 'moderate',
    title: 'Orta Şiddetli Deprem (5.5 ML)',
    description: 'Orta şiddetli deprem senaryosu - tahliye pratiği',
    duration: 15,
    magnitude: 5.5,
    steps: [
      'Uyarı alın',
      'Güvenli yere geçin',
      'Sarsıntı bitene kadar bekleyin',
      'Bina kontrolü yapın',
      'Aile ile iletişim kurun',
      'Toplanma noktasına gidin',
      'SOS gönderin',
      'Durum raporu oluşturun',
    ],
  },
  {
    id: 'severe',
    title: 'Şiddetli Deprem (7.0 ML)',
    description: 'Şiddetli deprem senaryosu - tam afet simülasyonu',
    duration: 30,
    magnitude: 7.0,
    steps: [
      'Kritik uyarı alın',
      'Hemen güvenli yere geçin',
      'Sarsıntı bitene kadar bekleyin',
      'Ağır hasar kontrolü',
      'Aile güvenlik zincirini aktifleştirin',
      'Acil durum çantasını alın',
      'Tahliye edin',
      'Toplanma noktasına gidin',
      'Yardım ekiplerine bildirin',
      'Durum raporu gönderin',
    ],
  },
];


export default function DrillModeScreen({ navigation }: any) {
  const [activeDrill, setActiveDrill] = useState<DrillScenario | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isDrillActive, setIsDrillActive] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isDrillActive && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            handleDrillComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isDrillActive, timeRemaining]);

  const handleStartDrill = async (scenario: DrillScenario) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        'Tatbikat Başlat',
        `"${scenario.title}" senaryosunu başlatmak istediğinizden emin misiniz?`,
        [
          { text: 'İptal', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Başlat', onPress: () => resolve(true) },
        ]
      );
    });

    if (!confirmed) return;

    setActiveDrill(scenario);
    setCurrentStep(0);
    setTimeRemaining(scenario.duration * 60);
    setCompletedSteps([]);
    setIsDrillActive(true);

    // Trigger alert
    await multiChannelAlertService.sendAlert({
      title: '🧪 TATBİKAT MODU',
      body: `${scenario.title} - Bu bir simülasyondur!`,
      priority: 'normal',
      channels: {
        pushNotification: true,
        fullScreenAlert: false,
        alarmSound: false,
        vibration: true,
        tts: true,
      },
      data: {
        type: 'drill',
        scenarioId: scenario.id,
        magnitude: scenario.magnitude,
      },
    });
  };

  const handleCompleteStep = (stepIndex: number) => {
    if (!completedSteps.includes(stepIndex)) {
      setCompletedSteps([...completedSteps, stepIndex]);
    }
    
    if (stepIndex < (activeDrill?.steps.length || 0) - 1) {
      setCurrentStep(stepIndex + 1);
    }
  };

  const handleDrillComplete = () => {
    setIsDrillActive(false);
    Alert.alert(
      'Tatbikat Tamamlandı',
      `Tebrikler! ${activeDrill?.title} senaryosunu tamamladınız.\n\nTamamlanan adımlar: ${completedSteps.length}/${activeDrill?.steps.length}`,
      [
        {
          text: 'Raporu Gör',
          onPress: () => {
            // Show report
          },
        },
        {
          text: 'Kapat',
          onPress: () => {
            setActiveDrill(null);
            setCurrentStep(0);
            setCompletedSteps([]);
          },
        },
      ]
    );
  };

  const handleStopDrill = () => {
    Alert.alert(
      'Tatbikatı Durdur',
      'Tatbikatı durdurmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Durdur',
          style: 'destructive',
          onPress: () => {
            setIsDrillActive(false);
            setActiveDrill(null);
            setCurrentStep(0);
            setCompletedSteps([]);
            setTimeRemaining(0);
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (activeDrill && isDrillActive) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={handleStopDrill}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </Pressable>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.drillContent}>
          {/* Timer */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.timerCard}>
            <LinearGradient
              colors={[colors.brand.primary, colors.brand.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.timerGradient}
            >
              <Ionicons name="timer" size={48} color="#fff" />
              <Text style={styles.timerText}>{formatTime(timeRemaining)}</Text>
              <Text style={styles.timerLabel}>Kalan Süre</Text>
            </LinearGradient>
          </Animated.View>

          {/* Current Step */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.currentStepCard}>
            <Text style={styles.currentStepLabel}>Mevcut Adım</Text>
            <Text style={styles.currentStepText}>
              {activeDrill.steps[currentStep]}
            </Text>
            <Pressable
              style={styles.completeStepButton}
              onPress={() => handleCompleteStep(currentStep)}
            >
              <Text style={styles.completeStepText}>✓ Tamamlandı</Text>
            </Pressable>
          </Animated.View>

          {/* Steps List */}
          <Animated.View entering={FadeInDown.delay(300)} style={styles.stepsCard}>
            <Text style={styles.stepsTitle}>Tatbikat Adımları</Text>
            {activeDrill.steps.map((step, index) => (
              <View
                key={index}
                style={[
                  styles.stepItem,
                  index === currentStep && styles.stepItemActive,
                  completedSteps.includes(index) && styles.stepItemCompleted,
                ]}
              >
                <View style={[
                  styles.stepNumber,
                  completedSteps.includes(index) && styles.stepNumberCompleted,
                  index === currentStep && styles.stepNumberActive,
                ]}>
                  {completedSteps.includes(index) ? (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  ) : (
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepText,
                  completedSteps.includes(index) && styles.stepTextCompleted,
                ]}>
                  {step}
                </Text>
              </View>
            ))}
          </Animated.View>

          {/* Progress */}
          <Animated.View entering={FadeInDown.delay(400)} style={styles.progressCard}>
            <Text style={styles.progressLabel}>
              İlerleme: {completedSteps.length} / {activeDrill.steps.length}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(completedSteps.length / activeDrill.steps.length) * 100}%` },
                ]}
              />
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(100)} style={styles.infoBanner}>
          <Ionicons name="information-circle" size={24} color={colors.brand.primary} />
          <Text style={styles.infoText}>
            Tatbikat modu afet durumlarına hazırlık için simülasyon yapmanızı sağlar.
            Bu bir simülasyondur ve gerçek uyarı değildir.
          </Text>
        </Animated.View>

        {DRILL_SCENARIOS.map((scenario, index) => (
          <Animated.View
            key={scenario.id}
            entering={FadeInDown.delay(index * 100 + 200)}
            style={styles.scenarioCard}
          >
            <Pressable
              style={styles.scenarioPressable}
              onPress={() => handleStartDrill(scenario)}
            >
              <LinearGradient
                colors={[
                  scenario.magnitude >= 7.0 ? '#ef4444' :
                  scenario.magnitude >= 5.5 ? '#f59e0b' : '#10b981',
                  scenario.magnitude >= 7.0 ? '#dc2626' :
                  scenario.magnitude >= 5.5 ? '#d97706' : '#059669',
                ] as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scenarioGradient}
              >
                <View style={styles.scenarioHeader}>
                  <View>
                    <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                    <Text style={styles.scenarioDescription}>{scenario.description}</Text>
                  </View>
                  <Ionicons name="play-circle" size={32} color="#fff" />
                </View>
                
                <View style={styles.scenarioFooter}>
                  <View style={styles.scenarioInfo}>
                    <Ionicons name="time-outline" size={16} color="#fff" />
                    <Text style={styles.scenarioInfoText}>{scenario.duration} dakika</Text>
                  </View>
                  <View style={styles.scenarioInfo}>
                    <Ionicons name="list-outline" size={16} color="#fff" />
                    <Text style={styles.scenarioInfoText}>{scenario.steps.length} adım</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ))}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: colors.brand.primary + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand.primary + '40',
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 22,
  },
  scenarioCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  scenarioPressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  scenarioGradient: {
    padding: 16,
  },
  scenarioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  scenarioTitle: {
    ...typography.h4,
    color: '#fff',
    fontWeight: '700',
    marginBottom: 4,
  },
  scenarioDescription: {
    ...typography.caption,
    color: '#fff',
    opacity: 0.9,
  },
  scenarioFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  scenarioInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scenarioInfoText: {
    ...typography.caption,
    color: '#fff',
    opacity: 0.9,
  },
  drillContent: {
    padding: 16,
    gap: 16,
  },
  timerCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  timerGradient: {
    padding: 20,
    alignItems: 'center',
  },
  timerText: {
    ...typography.h1,
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    marginTop: 12,
  },
  timerLabel: {
    ...typography.body,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  currentStepCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  currentStepLabel: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  currentStepText: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  completeStepButton: {
    backgroundColor: colors.status.success,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeStepText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  stepsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  stepsTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  stepItemActive: {
    backgroundColor: colors.brand.primary + '20',
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  stepItemCompleted: {
    backgroundColor: colors.status.success + '20',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberActive: {
    backgroundColor: colors.brand.primary,
  },
  stepNumberCompleted: {
    backgroundColor: colors.status.success,
  },
  stepNumberText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '700',
  },
  stepText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  stepTextCompleted: {
    textDecorationLine: 'line-through',
    color: colors.text.tertiary,
  },
  progressCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  progressLabel: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.status.success,
    borderRadius: 9999,
  },
});


