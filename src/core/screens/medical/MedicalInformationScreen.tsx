/**
 * MEDICAL INFORMATION SCREEN
 * First aid guide, triage, emergency medications, medical procedures
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface MedicalTopic {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string[];
  content: {
    overview: string;
    steps: string[];
    warnings: string[];
  };
}

const MEDICAL_TOPICS: MedicalTopic[] = [
  {
    id: 'cpr',
    title: 'CPR (Kalp Masajı)',
    icon: 'heart',
    color: ['#ef4444', '#dc2626'],
    content: {
      overview: 'Solunumu ve kalp atışı durmuş kişilere uygulanan hayat kurtarıcı müdahale.',
      steps: [
        'Güvenliği kontrol edin - Kişiyi güvenli bir yere taşıyın',
        'Bilinç kontrolü yapın - Omuzlarından sallayarak "İyi misiniz?" diye sorun',
        '112\'yi arayın veya birine aramasını söyleyin',
        'Kişiyi sırtüstü yatırın, sert bir yüzeye',
        'Göğüs kemiğinin ortasına, ellerinizi üst üste koyun',
        'Dik pozisyonda, dirsekler kilitli, dakikada 100-120 kez basın',
        'Her basışta göğüs 5-6 cm içe girmeli',
        'Yardım gelene kadar devam edin',
      ],
      warnings: [
        'Kırık kaburga riski vardır ama bu normaldir',
        'Sadece yetişkinlere uygulanmalıdır',
        'Çocuklarda farklı teknik kullanılır',
      ],
    },
  },
  {
    id: 'bleeding',
    title: 'Kanama Kontrolü',
    icon: 'water',
    color: ['#dc2626', '#991b1b'],
    content: {
      overview: 'Ağır kanamaları durdurma ve kontrol altına alma teknikleri.',
      steps: [
        'Kanayan bölgeyi bulun',
        'Temiz bir bez veya giysi ile doğrudan basınç uygulayın',
        'Yaranın üzerine güçlü ve sürekli basınç yapın',
        'Yaralı kısmı kalp seviyesinden yukarı kaldırın',
        'Kanama durmazsa turnike uygulayın (son çare)',
        '112\'yi arayın',
        'Kişiyi sıcak tutun, şok riskine karşı',
      ],
      warnings: [
        'Turnike sadece hayati tehlike durumunda kullanılır',
        'Turnike uygulandıktan sonra çözülmemeli',
        'Saati ve turnike uygulama zamanını not edin',
      ],
    },
  },
  {
    id: 'choking',
    title: 'Boğulma',
    icon: 'warning',
    color: ['#f59e0b', '#d97706'],
    content: {
      overview: 'Soluk borusuna bir şey kaçmış kişilere Heimlich Manevrası.',
      steps: [
        'Kişinin öksürüp öksüremediğini kontrol edin',
        'Öksüremiyorsa, sırtına 5 kez vurun',
        'Hala çıkmadıysa Heimlich Manevrası uygulayın',
        'Kişinin arkasına geçin, kollarınızı beline dolayın',
        'Bir elinizi yumruk yapın, diğer elinizle sarın',
        'Göbek deliğinin üstüne, içe ve yukarı doğru basın',
        '5 kez tekrarlayın, gerekirse sırt vuruşları ile değiştirin',
        '112\'yi arayın',
      ],
      warnings: [
        'Hamile kadınlarda göğüs kemiğine basınç uygulanır',
        'Bebeklerde farklı teknik kullanılır',
        'Bilinç kaybı varsa CPR\'a geçin',
      ],
    },
  },
  {
    id: 'shock',
    title: 'Şok',
    icon: 'medical',
    color: ['#8b5cf6', '#7c3aed'],
    content: {
      overview: 'Kan dolaşımı bozulması durumu - acil müdahale gerekir.',
      steps: [
        'Şok belirtilerini tanıyın: Soluk cilt, hızlı nabız, zayıf nabız',
        'Kişiyi sırtüstü yatırın',
        'Ayakları 30 cm yukarı kaldırın (kalp seviyesinden yukarı)',
        'Sıcak tutun - battaniye, giysi ile örtün',
        'Dar giysileri gevşetin',
        'Yiyecek/içecek vermeyin',
        '112\'yi arayın',
        'Nabız ve solunumu kontrol edin',
      ],
      warnings: [
        'Kafa veya boyun yaralanması varsa ayakları kaldırmayın',
        'Solunum güçlüğü varsa yarı oturur pozisyon',
        'Kanama varsa önce kanamayı durdurun',
      ],
    },
  },
  {
    id: 'fracture',
    title: 'Kırık',
    icon: 'medical-outline',
    color: ['#06b6d4', '#0891b2'],
    content: {
      overview: 'Kemik kırıklarında ilk yardım ve immobilizasyon.',
      steps: [
        'Kırık bölgesini hareket ettirmeyin',
        'Açık kırık varsa yarayı temiz bezle kapatın',
        'Kırık bölgeyi sabitleyin - atel veya bandaj ile',
        'Buz uygulayın (doğrudan değil, bez arası)',
        'Yüksek tutun (şişmeyi azaltır)',
        'Ağrı kesici vermeyin (ameliyat öncesi)',
        '112\'yi arayın veya hastaneye götürün',
        'Kişiyi sıcak tutun',
      ],
      warnings: [
        'Açık kırıkta kemik görünüyorsa dokunmayın',
        'Kırık bölgeyi düzeltmeye çalışmayın',
        'Bilinç kaybı varsa önce CPR kontrolü',
      ],
    },
  },
  {
    id: 'burn',
    title: 'Yanık',
    icon: 'flame',
    color: ['#f97316', '#ea580c'],
    content: {
      overview: 'Yanık yaralanmalarında ilk müdahale.',
      steps: [
        'Yanığı soğuk su altında 10-15 dakika tutun',
        'Yanık bölgesini temiz bir bezle kapatın',
        'Yanık merhemi veya yağ sürmeyin',
        'Küçük kabarcıkları patlatmayın',
        'Dar giysileri yanık bölgesinden uzaklaştırın',
        'Ağrı kesici verebilirsiniz',
        'Geniş yanıklarda 112\'yi arayın',
        'Şok belirtilerini izleyin',
      ],
      warnings: [
        '3. derece yanıklarda su kullanmayın',
        'Yanık bölgesine buz koymayın',
        'Yanık bölgesine nefes vermeyin',
      ],
    },
  },
];

export default function MedicalInformationScreen({ navigation }: any) {
  const [selectedTopic, setSelectedTopic] = useState<MedicalTopic | null>(null);

  if (selectedTopic) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => setSelectedTopic(null)}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>{selectedTopic.title}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.detailContent}>
          <Animated.View entering={FadeInDown.delay(100)} style={styles.overviewCard}>
            <LinearGradient
              colors={selectedTopic.color as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.overviewGradient}
            >
              <Ionicons name={selectedTopic.icon} size={48} color="#fff" />
              <Text style={styles.overviewText}>{selectedTopic.content.overview}</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.stepsCard}>
            <Text style={styles.cardTitle}>Adım Adım</Text>
            {selectedTopic.content.steps.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </Animated.View>

          {selectedTopic.content.warnings.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300)} style={styles.warningsCard}>
              <View style={styles.warningsHeader}>
                <Ionicons name="warning" size={20} color={colors.status.warning} />
                <Text style={styles.warningsTitle}>Önemli Uyarılar</Text>
              </View>
              {selectedTopic.content.warnings.map((warning, index) => (
                <View key={index} style={styles.warningItem}>
                  <Text style={styles.warningText}>• {warning}</Text>
                </View>
              ))}
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(400)} style={styles.emergencyCard}>
            <Ionicons name="call" size={24} color={colors.status.danger} />
            <Text style={styles.emergencyText}>
              Acil durumlarda derhal 112\'yi arayın veya en yakın sağlık kuruluşuna başvurun.
              Bu bilgiler ilk yardım rehberidir, profesyonel tıbbi yardımın yerini tutmaz.
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
        <Text style={styles.headerTitle}>Tıbbi Bilgiler</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {MEDICAL_TOPICS.map((topic, index) => (
          <Animated.View
            key={topic.id}
            entering={FadeInDown.delay(index * 100)}
            style={styles.topicCard}
          >
            <Pressable
              style={styles.topicPressable}
              onPress={() => setSelectedTopic(topic)}
            >
              <LinearGradient
                colors={topic.color as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.topicGradient}
              >
                <Ionicons name={topic.icon} size={32} color="#fff" />
                <Text style={styles.topicTitle}>{topic.title}</Text>
                <Text style={styles.topicSubtitle}>
                  {topic.content.steps.length} adım
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
  content: {
    padding: 16,
    gap: 12,
  },
  topicCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  topicPressable: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  topicGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topicTitle: {
    ...typography.h4,
    color: '#fff',
    fontWeight: '700',
    flex: 1,
  },
  topicSubtitle: {
    ...typography.caption,
    color: '#fff',
    opacity: 0.9,
  },
  detailContent: {
    padding: 16,
    gap: 16,
  },
  overviewCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  overviewGradient: {
    padding: 20,
    alignItems: 'center',
  },
  overviewText: {
    ...typography.body,
    color: '#fff',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 24,
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
  warningsCard: {
    backgroundColor: colors.status.warning + '20',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.status.warning + '40',
  },
  warningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  warningsTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  warningItem: {
    marginBottom: 4,
  },
  warningText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    backgroundColor: colors.status.danger + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.status.danger + '40',
  },
  emergencyText: {
    ...typography.small,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 18,
  },
});


