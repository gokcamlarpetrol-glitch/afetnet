/**
 * PSYCHOLOGICAL SUPPORT SCREEN
 * Post-disaster stress management, support lines, coping strategies
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PsychologicalSupportScreen');

interface SupportResource {
  id: string;
  title: string;
  phone: string;
  available: string;
  description: string;
}

const SUPPORT_LINES: SupportResource[] = [
  {
    id: '112',
    title: 'Acil Durum',
    phone: '112',
    available: '7/24',
    description: 'Acil sağlık, itfaiye, polis',
  },
  {
    id: 'psychology',
    title: 'Kriz Danışma Hattı',
    phone: '444 0 632',
    available: '7/24',
    description: 'Psikolojik destek ve kriz danışmanlığı',
  },
  {
    id: 'afad',
    title: 'AFAD',
    phone: '122',
    available: '7/24',
    description: 'Afet ve Acil Durum Yönetimi',
  },
  {
    id: 'child',
    title: 'Çocuk Destek Hattı',
    phone: '444 0 183',
    available: '7/24',
    description: 'Çocuklar için psikolojik destek',
  },
];

interface CopingStrategy {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string[];
  steps: string[];
}

const COPING_STRATEGIES: CopingStrategy[] = [
  {
    id: 'breathing',
    title: 'Nefes Egzersizleri',
    icon: 'leaf',
    color: ['#10b981', '#059669'],
    steps: [
      'Rahat bir pozisyona geçin',
      'Gözlerinizi kapatın',
      '4 saniye nefes alın',
      '4 saniye nefesinizi tutun',
      '4 saniye nefes verin',
      '4 saniye bekleyin',
      '5-10 kez tekrarlayın',
    ],
  },
  {
    id: 'grounding',
    title: 'Topraklama Tekniği',
    icon: 'radio-button-on',
    color: ['#8b5cf6', '#7c3aed'],
    steps: [
      '5 şey görün (gözlerinizle)',
      '4 şey dokunun (cildinizle)',
      '3 şey duyun (kulaklarınızla)',
      '2 şey koklayın (burnunuzla)',
      '1 şey tadın (dilinizle)',
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
      'Ayaklar → Bacaklar → Karın → Kollar → Yüz',
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
      'Şu ana odaklanın, geçmiş/geleceğe değil',
      '10-15 dakika devam edin',
    ],
  },
];

export default function PsychologicalSupportScreen({ navigation }: any) {
  const [selectedStrategy, setSelectedStrategy] = useState<CopingStrategy | null>(null);

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`).catch((error) => {
      logger.error('Failed to open phone dialer:', error);
    });
  };

  if (selectedStrategy) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setSelectedStrategy(null)}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>{selectedStrategy.title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.detailContent}>
          <Animated.View entering={FadeInDown.delay(100)} style={styles.strategyCard}>
            <LinearGradient
              colors={selectedStrategy.color as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.strategyGradient}
            >
              <Ionicons name={selectedStrategy.icon} size={64} color="#fff" />
              <Text style={styles.strategyTitle}>{selectedStrategy.title}</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.stepsCard}>
            <Text style={styles.cardTitle}>Adım Adım</Text>
            {selectedStrategy.steps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300)} style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={colors.brand.primary} />
            <Text style={styles.infoText}>
              Bu teknikler stres ve kaygıyı azaltmaya yardımcı olur.
              Düzenli uygulama daha etkili sonuçlar verir.
            </Text>
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
        <Text style={styles.headerTitle}>Psikolojik Destek</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Support Lines */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Destek Hatları</Text>
          <Text style={styles.sectionSubtitle}>
            Ücretsiz ve gizli psikolojik destek hatları
          </Text>

          {SUPPORT_LINES.map((line, index) => (
            <Pressable
              key={line.id}
              style={styles.supportCard}
              onPress={() => handleCall(line.phone)}
            >
              <View style={styles.supportHeader}>
                <View style={styles.supportIcon}>
                  <Ionicons name="call" size={24} color={colors.brand.primary} />
                </View>
                <View style={styles.supportInfo}>
                  <Text style={styles.supportTitle}>{line.title}</Text>
                  <Text style={styles.supportDescription}>{line.description}</Text>
                </View>
                <View style={styles.supportPhone}>
                  <Text style={styles.phoneText}>{line.phone}</Text>
                  <Text style={styles.phoneAvailable}>{line.available}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </Animated.View>

        {/* Coping Strategies */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Stres Yönetimi Teknikleri</Text>
          <Text style={styles.sectionSubtitle}>
            Afet sonrası stres ve kaygıyı yönetmek için teknikler
          </Text>

          {COPING_STRATEGIES.map((strategy, index) => (
            <Pressable
              key={strategy.id}
              style={styles.strategyCardSmall}
              onPress={() => setSelectedStrategy(strategy)}
            >
              <LinearGradient
                colors={strategy.color as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.strategyGradientSmall}
              >
                <Ionicons name={strategy.icon} size={32} color="#fff" />
                <Text style={styles.strategyTitleSmall}>{strategy.title}</Text>
                <Text style={styles.strategySteps}>{strategy.steps.length} adım</Text>
              </LinearGradient>
            </Pressable>
          ))}
        </Animated.View>

        {/* Common Reactions */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>Normal Tepkiler</Text>
          <View style={styles.reactionsCard}>
            <Text style={styles.reactionsText}>
              Afet sonrası yaşadığınız şu duygular normaldir:{'\n\n'}
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
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Ne Zaman Yardım Almalı?</Text>
          <View style={styles.warningCard}>
            <Ionicons name="warning" size={24} color={colors.status.warning} />
            <View style={styles.warningContent}>
              <Text style={styles.warningText}>
                Şu durumlarda mutlaka profesyonel yardım alın:{'\n\n'}
                • Belirtiler 2 haftadan uzun sürüyorsa{'\n'}
                • Günlük yaşamı etkiliyorsa{'\n'}
                • İntihar düşünceleri varsa{'\n'}
                • İlaç/alkol kullanımı artıyorsa{'\n'}
                • İlişkiler bozuluyorsa
              </Text>
            </View>
          </View>
        </Animated.View>
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
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  supportCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginBottom: 8,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  supportDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  supportPhone: {
    alignItems: 'flex-end',
  },
  phoneText: {
    ...typography.h4,
    color: colors.brand.primary,
    fontWeight: '700',
  },
  phoneAvailable: {
    ...typography.small,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  strategyCardSmall: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  strategyGradientSmall: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  strategyTitleSmall: {
    ...typography.h4,
    color: '#fff',
    fontWeight: '700',
    flex: 1,
  },
  strategySteps: {
    ...typography.caption,
    color: '#fff',
    opacity: 0.9,
  },
  detailContent: {
    padding: 16,
    gap: 16,
  },
  strategyCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  strategyGradient: {
    padding: 20,
    alignItems: 'center',
  },
  strategyTitle: {
    ...typography.h3,
    color: '#fff',
    fontWeight: '700',
    marginTop: 12,
  },
  stepsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepNumberText: {
    ...typography.body,
    color: '#fff',
    fontWeight: '700',
  },
  stepText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 24,
  },
  infoCard: {
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
  reactionsCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  reactionsText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: colors.status.warning + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.status.warning + '40',
  },
  warningContent: {
    flex: 1,
  },
  warningText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 24,
  },
});


