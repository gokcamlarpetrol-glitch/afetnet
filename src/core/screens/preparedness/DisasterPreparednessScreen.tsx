/**
 * DISASTER PREPAREDNESS SCREEN
 * Disaster-type specific preparedness modules with guides, videos, and checklists
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';
import { createLogger } from '../../utils/logger';

const logger = createLogger('DisasterPreparednessScreen');

type DisasterType = 'earthquake' | 'flood' | 'fire' | 'tsunami' | 'landslide';

interface PreparednessModule {
  type: DisasterType;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string[];
  phases: {
    before: string[];
    during: string[];
    after: string[];
  };
  checklist: string[];
  videoId?: string; // For future video integration
}

const DISASTER_MODULES: PreparednessModule[] = [
  {
    type: 'earthquake',
    title: 'Deprem',
    icon: 'pulse',
    color: ['#DC143C', '#B71C1C'],
    phases: {
      before: [
        'Acil durum çantası hazırlayın',
        'Mobilyaları duvara sabitleyin',
        'Aile afet planı yapın',
        'Deprem sigortası yaptırın (DASK)',
        'Toplanma noktası belirleyin',
        'İlk yardım eğitimi alın',
        'Bina güçlendirme yapın (gerekirse)',
      ],
      during: [
        'Sakin olun, panik yapmayın',
        'Drop-Cover-Hold: Çök, kapan, tutun',
        'Sabit bir mobilyanın yanına geçin',
        'Pencere ve camlardan uzak durun',
        'Asansör kullanmayın',
        'Balkon ve merdivenlerden uzak durun',
        'Sarsıntı bitene kadar bekleyin',
      ],
      after: [
        'Sarsıntı bittikten sonra dikkatli hareket edin',
        'Bina kontrolü yapın (çatlak, hasar)',
        'Gaz kokusu varsa vanayı kapatın',
        'Elektrik sigortasını kapatın',
        'Acil durum çantanızı alın',
        'Toplanma noktasına gidin',
        '112\'yi arayın (sadece acil durumlarda)',
      ],
    },
    checklist: [
      'Su (kişi başı 4L/gün, 3 gün)',
      'Yiyecek (konserve, bisküvi)',
      'İlk yardım çantası',
      'Fener ve yedek pil',
      'Radyo (pil ile)',
      'Önemli dökümanlar (fotokopi)',
      'Nakit para',
      'Telefon şarj cihazı',
      'Battaniye',
      'El feneri',
    ],
  },
  {
    type: 'flood',
    title: 'Sel',
    icon: 'water',
    color: ['#2196F3', '#1565C0'],
    phases: {
      before: [
        'Sel riski bölgelerinden uzak durun',
        'Evinizin yüksekliğini kontrol edin',
        'Su geçirmez çanta hazırlayın',
        'Değerli eşyaları yüksek yerde saklayın',
        'Sel sigortası yaptırın',
        'Tahliye rotası belirleyin',
        'Meteoroloji uyarılarını takip edin',
      ],
      during: [
        'Yüksek yere çıkın',
        'Araçtan uzak durun',
        'Sel suyuna girmeyin',
        'Elektrikli cihazları kapatın',
        'Bodrum ve alt katlardan uzaklaşın',
        'Yüksek yapılara sığının',
        'Sel suyu akışına karşı durmayın',
      ],
      after: [
        'Güvenli olduğundan emin olun',
        'Elektrik kontrollerini yapın',
        'Temiz su kullanın',
        'Hasar tespiti yapın',
        'Fotoğraf çekin (sigorta için)',
        'Sel suyuna temas etmeyin (kirli)',
        'Yetkililere bildirin',
      ],
    },
    checklist: [
      'Su geçirmez çanta',
      'Yüksek yerde saklanan eşyalar',
      'Tahliye planı',
      'Sel sigortası',
      'Temiz su stoğu',
    ],
  },
  {
    type: 'fire',
    title: 'Yangın',
    icon: 'flame',
    color: ['#FF5722', '#D84315'],
    phases: {
      before: [
        'Yangın detektörü takın',
        'Yangın söndürücü bulundurun',
        'Çıkış rotaları belirleyin',
        'Yanıcı maddeleri güvenli saklayın',
        'Elektrik tesisatını kontrol edin',
        'Sigara içmeyin (kapalı alan)',
        'Yangın tatbikatı yapın',
      ],
      during: [
        'Çık-Çık-Çık: Çık, çık, çık',
        'Kapıları kapatın (yangını yavaşlatır)',
        'Asansör kullanmayın',
        'Duman varsa yere yakın hareket edin',
        'Kapıyı kontrol edin (sıcaklık)',
        '112\'yi arayın',
        'Kendinizi dışarı atmayın (yüksek kat)',
      ],
      after: [
        'Güvenli olduğundan emin olun',
        'Yangın söndürüldü mü kontrol edin',
        'Duman solumayın',
        'Yanık yoksa dikkatli içeri girin',
        'Elektrik ve gazı kontrol edin',
        'Hasarları fotoğraflayın',
        'Yetkililere bildirin',
      ],
    },
    checklist: [
      'Yangın detektörü',
      'Yangın söndürücü',
      'Çıkış rotası planı',
      'Acil durum numaraları',
      'Sigorta bilgileri',
    ],
  },
  {
    type: 'tsunami',
    title: 'Tsunami',
    icon: 'water',
    color: ['#0097A7', '#006064'],
    phases: {
      before: [
        'Sahil yakınında yaşıyorsanız bilinçli olun',
        'Yüksek yerde toplanma noktası belirleyin',
        'Tsunami uyarı sistemlerini takip edin',
        'Deprem sonrası otomatik hazır olun',
        'Yüksek bina rotası belirleyin',
        'Acil çıkış planı yapın',
        'Tahliye rotası çalışın',
      ],
      during: [
        'DEPREM SONRASI: Sahilden uzaklaşın',
        'Yüksekliğe çıkın (>30m veya >3km içeri)',
        'Yürüyerek çıkın (araç kullanmayın)',
        'Tsunami dalgası gelene kadar bekleyin',
        'Yüksek binalara sığının',
        'Suya yakın yerlerden uzaklaşın',
        'Asansör kullanmayın',
      ],
      after: [
        'Uyarı kalkana kadar bekleyin',
        'Sahile dönmeyin',
        'Suda yüzen enkazlara dikkat',
        'Yardım ekipleri talimatlarını dinleyin',
        'Su kalitesini kontrol edin',
        'Hasarları fotoğraflayın',
        'Yetkililere bildirin',
      ],
    },
    checklist: [
      'Tsunami uyarı sistemi bilgisi',
      'Yüksek toplanma noktası',
      'Tahliye rotası',
      'Yüksek bina listesi',
      'Acil durum çantası',
    ],
  },
  {
    type: 'landslide',
    title: 'Heyelan',
    icon: 'triangle',
    color: ['#795548', '#5D4037'],
    phases: {
      before: [
        'Eğimli bölgelerden uzak durun',
        'Bina temelini kontrol edin',
        'Drainaj sistemini kontrol edin',
        'Ağaçlandırma yapın',
        'Heyelan riski bölgelerini öğrenin',
        'Tahliye planı yapın',
        'Meteoroloji uyarılarını takip edin',
      ],
      during: [
        'Hızlıca tahliye edin',
        'Eğimli bölgelerden uzaklaşın',
        'Yüksek yere çıkın',
        'Araçtan uzak durun',
        'Kapalı alanlardan çıkın',
        'Güvenli yere sığının',
        '112\'yi arayın',
      ],
      after: [
        'Güvenli olduğundan emin olun',
        'Bina kontrolü yapın',
        'Çatlak ve kaymaları kontrol edin',
        'Hasarları fotoğraflayın',
        'Yetkililere bildirin',
        'Bina güvenli değilse girmeyin',
        'Uzman kontrolü isteyin',
      ],
    },
    checklist: [
      'Tahliye planı',
      'Güvenli toplanma noktası',
      'Bina kontrol listesi',
      'Yetkili kişi bilgileri',
    ],
  },
];

export default function DisasterPreparednessScreen({ navigation }: any) {
  const [selectedType, setSelectedType] = useState<DisasterType | null>(null);
  const [selectedPhase, setSelectedPhase] = useState<'before' | 'during' | 'after'>('before');

  const selectedModule = selectedType 
    ? DISASTER_MODULES.find(m => m.type === selectedType)
    : null;

  if (selectedModule) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => setSelectedType(null)}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>{selectedModule.title}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Phase Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, selectedPhase === 'before' && styles.tabActive]}
            onPress={() => setSelectedPhase('before')}
          >
            <Text style={[styles.tabText, selectedPhase === 'before' && styles.tabTextActive]}>
              Öncesi
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, selectedPhase === 'during' && styles.tabActive]}
            onPress={() => setSelectedPhase('during')}
          >
            <Text style={[styles.tabText, selectedPhase === 'during' && styles.tabTextActive]}>
              Sırasında
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, selectedPhase === 'after' && styles.tabActive]}
            onPress={() => setSelectedPhase('after')}
          >
            <Text style={[styles.tabText, selectedPhase === 'after' && styles.tabTextActive]}>
              Sonrası
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {/* Instructions */}
          <Animated.View entering={FadeInDown.delay(100)} style={styles.instructionsCard}>
            <LinearGradient
              colors={selectedModule.color as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.instructionsGradient}
            >
              <Ionicons name={selectedModule.icon} size={48} color="#fff" />
              <Text style={styles.instructionsTitle}>
                {selectedPhase === 'before' ? 'Öncesi Hazırlık' :
                 selectedPhase === 'during' ? 'Sırasında Ne Yapmalı' :
                 'Sonrası Adımlar'}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Steps List */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.stepsCard}>
            {selectedModule.phases[selectedPhase].map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </Animated.View>

          {/* Checklist */}
          {selectedPhase === 'before' && (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.checklistCard}>
              <Text style={styles.cardTitle}>Hazırlık Kontrol Listesi</Text>
              {selectedModule.checklist.map((item, index) => (
                <View key={index} style={styles.checklistItem}>
                  <Ionicons name="square-outline" size={20} color={colors.text.secondary} />
                  <Text style={styles.checklistText}>{item}</Text>
                </View>
              ))}
            </Animated.View>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Afet Hazırlık Rehberi</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.gridContainer}>
        {DISASTER_MODULES.map((module, index) => (
          <Animated.View
            key={module.type}
            entering={FadeInDown.delay(index * 100)}
            style={styles.moduleCard}
          >
            <Pressable
              style={styles.modulePressable}
              onPress={() => setSelectedType(module.type)}
            >
              <LinearGradient
                colors={module.color as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.moduleGradient}
              >
                <Ionicons name={module.icon} size={48} color="#fff" />
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleSubtitle}>
                  {module.phases.before.length + module.phases.during.length + module.phases.after.length} adım
                </Text>
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
  gridContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  moduleCard: {
    width: '47%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modulePressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  moduleGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 180,
    justifyContent: 'center',
  },
  moduleTitle: {
    ...typography.h3,
    color: '#fff',
    fontWeight: '700',
    marginTop: 12,
  },
  moduleSubtitle: {
    ...typography.caption,
    color: '#fff',
    opacity: 0.9,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.primary,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.brand.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  instructionsCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  instructionsGradient: {
    padding: 20,
    alignItems: 'center',
  },
  instructionsTitle: {
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
  checklistCard: {
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
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  checklistText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
});

