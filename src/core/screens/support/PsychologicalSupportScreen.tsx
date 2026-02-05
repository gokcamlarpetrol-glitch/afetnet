/**
 * PSYCHOLOGICAL SUPPORT SCREEN - ELITE EDITION
 * Post-disaster stress management, support lines, coping strategies
 * 
 * Elite Features:
 * - 8+ Support Lines (7/24 hizmet)
 * - Interactive Breathing Timer
 * - Haptic Feedback
 * - Premium Animations
 * - Emergency SOS Button
 * 
 * @author AfetNet Elite Wellness System
 * @version 2.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Animated as RNAnimated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PsychologicalSupportScreen');
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ELITE: Typed navigation
type PsychologicalSupportNavigationProp = StackNavigationProp<Record<string, object>>;

interface SupportResource {
  id: string;
  title: string;
  phone: string;
  available: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

// ELITE: Extended Support Lines
const SUPPORT_LINES: SupportResource[] = [
  {
    id: '112',
    title: 'Acil Durum',
    phone: '112',
    available: '7/24',
    description: 'Acil sağlık, itfaiye, polis',
    icon: 'warning',
    color: '#ef4444',
  },
  {
    id: 'psychology',
    title: 'Kriz Danışma Hattı',
    phone: '444 0 632',
    available: '7/24',
    description: 'Psikolojik destek ve kriz danışmanlığı',
    icon: 'heart',
    color: '#ec4899',
  },
  {
    id: 'afad',
    title: 'AFAD',
    phone: '122',
    available: '7/24',
    description: 'Afet ve Acil Durum Yönetimi',
    icon: 'shield-checkmark',
    color: '#f97316',
  },
  {
    id: 'child',
    title: 'Çocuk Destek Hattı',
    phone: '444 0 183',
    available: '7/24',
    description: 'Çocuklar için psikolojik destek',
    icon: 'happy',
    color: '#22c55e',
  },
  {
    id: 'saglik',
    title: 'Sağlık Bakanlığı ALO 182',
    phone: '182',
    available: '7/24',
    description: 'Sağlık danışmanlığı ve yönlendirme',
    icon: 'medkit',
    color: '#3b82f6',
  },
  {
    id: 'violence',
    title: 'Şiddet Hattı',
    phone: '183',
    available: '7/24',
    description: 'Aile içi şiddet ve istismar',
    icon: 'hand-left',
    color: '#8b5cf6',
  },
  {
    id: 'woman',
    title: 'Kadın Destek Hattı',
    phone: '444 0 632',
    available: '7/24',
    description: 'Kadınlar için özel destek',
    icon: 'female',
    color: '#d946ef',
  },
  {
    id: 'elderly',
    title: 'Yaşlı Destek Hattı',
    phone: '444 0 182',
    available: '7/24',
    description: 'Yaşlılar için sosyal destek',
    icon: 'people',
    color: '#14b8a6',
  },
];

interface CopingStrategy {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string[];
  steps: string[];
  duration?: number; // in seconds for breathing exercises
}

const COPING_STRATEGIES: CopingStrategy[] = [
  {
    id: 'breathing',
    title: 'Nefes Egzersizleri',
    icon: 'leaf',
    color: ['#10b981', '#059669'],
    duration: 16, // 4-4-4-4 cycle
    steps: [
      '4 saniye nefes alın',
      '4 saniye nefesinizi tutun',
      '4 saniye nefes verin',
      '4 saniye bekleyin',
      '5-10 kez tekrarlayın',
    ],
  },
  {
    id: 'grounding',
    title: 'Topraklama Tekniği (5-4-3-2-1)',
    icon: 'radio-button-on',
    color: ['#8b5cf6', '#7c3aed'],
    steps: [
      '5 şey GÖRÜN (gözlerinizle)',
      '4 şey DOKUNUN (cildinizle)',
      '3 şey DUYUN (kulaklarınızla)',
      '2 şey KOKLAYIN (burnunuzla)',
      '1 şey TADIN (dilinizle)',
      'Bu egzersiz endişeyi azaltır',
    ],
  },
  {
    id: 'progressive',
    title: 'Progresif Kas Gevşetme',
    icon: 'fitness',
    color: ['#06b6d4', '#0891b2'],
    steps: [
      'Ayaklarınızdan başlayın',
      'Her kas grubunu 5 saniye sıkın',
      'Sonra 10 saniye gevşetin',
      'Ayaklar → Bacaklar → Karın',
      'Kollar → Omuzlar → Yüz',
      'Tüm vücudu gevşetince 5 dakika dinlenin',
    ],
  },
  {
    id: 'mindfulness',
    title: 'Farkındalık (Mindfulness)',
    icon: 'flower',
    color: ['#f59e0b', '#d97706'],
    steps: [
      'Şu anki duygularınızı kabul edin',
      'Yargılamadan gözlemleyin',
      'Nefesinize odaklanın',
      'Zihninizdeki düşünceleri izleyin',
      'Şu ana odaklanın',
      '10-15 dakika devam edin',
    ],
  },
  {
    id: 'positive',
    title: 'Pozitif Afirmasyonlar',
    icon: 'sparkles',
    color: ['#ec4899', '#db2777'],
    steps: [
      '"Ben güvendeyim"',
      '"Bu an geçici"',
      '"Güçlüyüm ve başarabilirim"',
      '"Yardım almak güçlülük işaretidir"',
      '"Her gün biraz daha iyiye gidiyorum"',
      '"Kendime nazik davranıyorum"',
    ],
  },
];

export default function PsychologicalSupportScreen({ navigation }: { navigation: PsychologicalSupportNavigationProp }) {
  const insets = useSafeAreaInsets();
  const [selectedStrategy, setSelectedStrategy] = useState<CopingStrategy | null>(null);
  const [breathPhase, setBreathPhase] = useState<'inhale' | 'hold' | 'exhale' | 'wait' | null>(null);
  const [breathTimer, setBreathTimer] = useState(0);
  const [isBreathing, setIsBreathing] = useState(false);

  // Breathing animation
  const breathScale = useRef(new RNAnimated.Value(1)).current;
  const breathOpacity = useRef(new RNAnimated.Value(0.5)).current;

  // Breathing Timer Effect
  useEffect(() => {
    if (!isBreathing) return;

    const phases: Array<'inhale' | 'hold' | 'exhale' | 'wait'> = ['inhale', 'hold', 'exhale', 'wait'];
    let currentPhaseIndex = 0;
    let counter = 4;

    const interval = setInterval(() => {
      counter--;
      setBreathTimer(counter);

      if (counter <= 0) {
        currentPhaseIndex = (currentPhaseIndex + 1) % phases.length;
        setBreathPhase(phases[currentPhaseIndex]);
        counter = 4;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Animate breath circle
        if (phases[currentPhaseIndex] === 'inhale') {
          RNAnimated.timing(breathScale, {
            toValue: 1.3,
            duration: 4000,
            useNativeDriver: true,
          }).start();
          RNAnimated.timing(breathOpacity, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }).start();
        } else if (phases[currentPhaseIndex] === 'exhale') {
          RNAnimated.timing(breathScale, {
            toValue: 1,
            duration: 4000,
            useNativeDriver: true,
          }).start();
          RNAnimated.timing(breathOpacity, {
            toValue: 0.5,
            duration: 4000,
            useNativeDriver: true,
          }).start();
        }
      }
    }, 1000);

    setBreathPhase('inhale');
    setBreathTimer(4);

    return () => clearInterval(interval);
  }, [isBreathing, breathScale, breathOpacity]);

  const handleCall = useCallback((phone: string, title: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      title,
      `${phone} numarasını aramak istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Ara',
          onPress: () => {
            Linking.openURL(`tel:${phone}`).catch((error) => {
              logger.error('Failed to open phone dialer:', error);
            });
          },
        },
      ]
    );
  }, []);

  const handleStartBreathing = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsBreathing(true);
  }, []);

  const handleStopBreathing = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsBreathing(false);
    setBreathPhase(null);
  }, []);

  const getPhaseText = (phase: string | null) => {
    switch (phase) {
      case 'inhale': return 'NEFES AL';
      case 'hold': return 'TUT';
      case 'exhale': return 'NEFES VER';
      case 'wait': return 'BEKLE';
      default: return 'BAŞLA';
    }
  };

  // Strategy Detail View
  if (selectedStrategy) {
    const isBreathingStrategy = selectedStrategy.id === 'breathing';

    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={selectedStrategy.color as [string, string]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />

        {/* Header */}
        <View style={styles.detailHeader}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setIsBreathing(false);
              setSelectedStrategy(null);
            }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.detailTitle}>{selectedStrategy.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.detailContent}>
          {/* Breathing Circle (for breathing strategy) */}
          {isBreathingStrategy && (
            <Animated.View entering={FadeInUp.delay(100)} style={styles.breathingContainer}>
              <RNAnimated.View
                style={[
                  styles.breathCircle,
                  {
                    transform: [{ scale: breathScale }],
                    opacity: breathOpacity,
                  },
                ]}
              >
                <Text style={styles.breathPhaseText}>{getPhaseText(breathPhase)}</Text>
                {isBreathing && (
                  <Text style={styles.breathTimerText}>{breathTimer}</Text>
                )}
              </RNAnimated.View>

              <Pressable
                style={[styles.breathButton, isBreathing && styles.breathButtonStop]}
                onPress={isBreathing ? handleStopBreathing : handleStartBreathing}
              >
                <Ionicons
                  name={isBreathing ? 'stop' : 'play'}
                  size={24}
                  color="#fff"
                />
                <Text style={styles.breathButtonText}>
                  {isBreathing ? 'Durdur' : 'Başlat'}
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Strategy Icon */}
          {!isBreathingStrategy && (
            <Animated.View entering={FadeInUp.delay(100)} style={styles.strategyIconContainer}>
              <View style={styles.strategyIconCircle}>
                <Ionicons name={selectedStrategy.icon} size={64} color="#fff" />
              </View>
            </Animated.View>
          )}

          {/* Steps */}
          <Animated.View entering={FadeInUp.delay(200)} style={styles.stepsCard}>
            <BlurView intensity={30} tint="light" style={styles.stepsBlur}>
              <Text style={styles.cardTitle}>Adım Adım</Text>
              {selectedStrategy.steps.map((step, index) => (
                <Animated.View
                  key={index}
                  entering={SlideInRight.delay(300 + index * 100)}
                  style={styles.stepItem}
                >
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </Animated.View>
              ))}
            </BlurView>
          </Animated.View>

          {/* Info */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color="#fff" />
            <Text style={styles.infoText}>
              Bu teknikler stres ve kaygıyı azaltmaya yardımcı olur.
              Düzenli uygulama daha etkili sonuçlar verir.
            </Text>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // Main Screen
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Hero Header */}
      <LinearGradient
        colors={['#0f172a', '#1e293b']}
        style={styles.heroHeader}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(100)} style={styles.heroContent}>
          <View style={styles.heroIcon}>
            <Ionicons name="heart" size={32} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Psikolojik Destek</Text>
          <Text style={styles.heroSubtitle}>
            Afet sonrası stres yönetimi ve destek hatları
          </Text>
        </Animated.View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Support Lines */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📞 Destek Hatları</Text>
            <Text style={styles.sectionBadge}>7/24 Ücretsiz</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Tüm hatlar gizli ve ücretsizdir
          </Text>

          {SUPPORT_LINES.map((line, index) => (
            <Animated.View key={line.id} entering={SlideInRight.delay(300 + index * 50)}>
              <Pressable
                style={({ pressed }) => [
                  styles.supportCard,
                  pressed && styles.supportCardPressed,
                ]}
                onPress={() => handleCall(line.phone, line.title)}
              >
                <View style={[styles.supportIcon, { backgroundColor: line.color + '20' }]}>
                  <Ionicons name={line.icon} size={24} color={line.color} />
                </View>
                <View style={styles.supportInfo}>
                  <Text style={styles.supportTitle}>{line.title}</Text>
                  <Text style={styles.supportDescription}>{line.description}</Text>
                </View>
                <View style={styles.supportPhone}>
                  <Text style={[styles.phoneText, { color: line.color }]}>{line.phone}</Text>
                  <View style={styles.availableBadge}>
                    <Ionicons name="time" size={10} color="#22c55e" />
                    <Text style={styles.phoneAvailable}>{line.available}</Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          ))}
        </Animated.View>

        {/* Coping Strategies */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🧘 Stres Yönetimi</Text>
            <Text style={styles.sectionBadge}>{COPING_STRATEGIES.length} Teknik</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Afet sonrası stres ve kaygıyı yönetmek için teknikler
          </Text>

          <View style={styles.strategiesGrid}>
            {COPING_STRATEGIES.map((strategy, index) => (
              <Animated.View
                key={strategy.id}
                entering={FadeInUp.delay(500 + index * 100)}
                style={styles.strategyCardWrapper}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.strategyCardSmall,
                    pressed && styles.strategyCardPressed,
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedStrategy(strategy);
                  }}
                >
                  <LinearGradient
                    colors={strategy.color as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.strategyGradientSmall}
                  >
                    <Ionicons name={strategy.icon} size={28} color="#fff" />
                    <Text style={styles.strategyTitleSmall}>{strategy.title}</Text>
                    <Text style={styles.strategySteps}>{strategy.steps.length} adım</Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Common Reactions */}
        <Animated.View entering={FadeInDown.delay(600)} style={styles.section}>
          <Text style={styles.sectionTitle}>💭 Normal Tepkiler</Text>
          <View style={styles.reactionsCard}>
            <Text style={styles.reactionsText}>
              Afet sonrası yaşadığınız şu duygular <Text style={styles.boldText}>normaldir</Text>:{'\n\n'}
              • Şok ve inkar{'\n'}
              • Korku ve endişe{'\n'}
              • Üzüntü ve yas{'\n'}
              • Öfke ve suçluluk{'\n'}
              • Uyku sorunları{'\n'}
              • Konsantrasyon güçlüğü{'\n\n'}
              Bu tepkiler zamanla azalır. Destek almak önemlidir.
            </Text>
          </View>
        </Animated.View>

        {/* When to Seek Help */}
        <Animated.View entering={FadeInDown.delay(700)} style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Ne Zaman Yardım Almalı?</Text>
          <View style={styles.warningCard}>
            <LinearGradient
              colors={['rgba(239,68,68,0.15)', 'rgba(239,68,68,0.05)']}
              style={styles.warningGradient}
            >
              <Ionicons name="warning" size={28} color="#ef4444" />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Profesyonel yardım alın:</Text>
                <Text style={styles.warningText}>
                  • Belirtiler 2 haftadan uzun sürüyorsa{'\n'}
                  • Günlük yaşamı etkiliyorsa{'\n'}
                  • İntihar düşünceleri varsa{'\n'}
                  • İlaç/alkol kullanımı artıyorsa{'\n'}
                  • İlişkiler bozuluyorsa
                </Text>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Floating SOS Button */}
      <Animated.View entering={FadeInUp.delay(800)} style={[styles.sosButton, { bottom: insets.bottom + 20 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.sosButtonInner,
            pressed && styles.sosButtonPressed,
          ]}
          onPress={() => handleCall('112', 'Acil Durum')}
        >
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={styles.sosGradient}
          >
            <Ionicons name="call" size={24} color="#fff" />
            <Text style={styles.sosText}>112</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  // Hero Header
  heroHeader: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  // Content
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  // Support Cards
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginBottom: 10,
    gap: 12,
  },
  supportCardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  supportDescription: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  supportPhone: {
    alignItems: 'flex-end',
  },
  phoneText: {
    fontSize: 16,
    fontWeight: '700',
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  phoneAvailable: {
    fontSize: 10,
    color: '#22c55e',
    fontWeight: '500',
  },
  // Strategy Cards
  strategiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  strategyCardWrapper: {
    width: (SCREEN_WIDTH - 42) / 2,
  },
  strategyCardSmall: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  strategyCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  strategyGradientSmall: {
    padding: 16,
    alignItems: 'center',
    gap: 8,
    minHeight: 120,
    justifyContent: 'center',
  },
  strategyTitleSmall: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  strategySteps: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  // Detail View
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  detailContent: {
    padding: 16,
    gap: 20,
  },
  // Breathing
  breathingContainer: {
    alignItems: 'center',
    gap: 24,
    paddingVertical: 20,
  },
  breathCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  breathPhaseText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 2,
  },
  breathTimerText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  breathButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
  },
  breathButtonStop: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  breathButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Strategy Icon
  strategyIconContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  strategyIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Steps Card
  stepsCard: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  stepsBlur: {
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    fontSize: 15,
    color: '#fff',
    flex: 1,
    lineHeight: 22,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
    lineHeight: 20,
  },
  // Reactions Card
  reactionsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  reactionsText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: '700',
    color: colors.text.primary,
  },
  // Warning Card
  warningCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  warningGradient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  // SOS Button
  sosButton: {
    position: 'absolute',
    right: 20,
  },
  sosButtonInner: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sosButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.95 }],
  },
  sosGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sosText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
