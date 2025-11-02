/**
 * VOLUNTEER MODULE SCREEN
 * Aid teams, donation redirection, task lists, coordination
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../../theme';

interface VolunteerTask {
  id: string;
  title: string;
  description: string;
  category: 'medical' | 'search' | 'logistics' | 'communication' | 'other';
  priority: 'high' | 'medium' | 'low';
  location?: string;
  needed: number; // people needed
  assigned: number;
}

interface AidOrganization {
  id: string;
  name: string;
  type: 'government' | 'ngo' | 'international';
  contact: string;
  website?: string;
  description: string;
}

const VOLUNTEER_TASKS: VolunteerTask[] = [
  {
    id: '1',
    title: 'Arama Kurtarma Desteği',
    description: 'Enkaz altındaki kişileri bulmak için gönüllü aranıyor',
    category: 'search',
    priority: 'high',
    location: 'Avcılar, İstanbul',
    needed: 20,
    assigned: 12,
  },
  {
    id: '2',
    title: 'Tıbbi Yardım',
    description: 'İlk yardım bilgisi olan gönüllüler aranıyor',
    category: 'medical',
    priority: 'high',
    location: 'Bakırköy, İstanbul',
    needed: 10,
    assigned: 5,
  },
  {
    id: '3',
    title: 'Yiyecek Dağıtımı',
    description: 'Toplanma noktalarına yiyecek dağıtımı',
    category: 'logistics',
    priority: 'medium',
    location: 'Küçükçekmece, İstanbul',
    needed: 15,
    assigned: 8,
  },
  {
    id: '4',
    title: 'İletişim Koordinasyonu',
    description: 'Sahadaki iletişimi koordine etmek',
    category: 'communication',
    priority: 'medium',
    needed: 5,
    assigned: 2,
  },
];

const AID_ORGANIZATIONS: AidOrganization[] = [
  {
    id: 'afad',
    name: 'AFAD',
    type: 'government',
    contact: '122',
    website: 'https://www.afad.gov.tr',
    description: 'Afet ve Acil Durum Yönetimi Başkanlığı',
  },
  {
    id: 'kizilay',
    name: 'Türk Kızılay',
    type: 'ngo',
    contact: '444 0 632',
    website: 'https://www.kizilay.org.tr',
    description: 'Türk Kızılay - Bağış ve gönüllülük',
  },
  {
    id: 'akut',
    name: 'AKUT',
    type: 'ngo',
    contact: '444 0 258',
    website: 'https://www.akut.org.tr',
    description: 'AKUT Arama Kurtarma Derneği',
  },
  {
    id: 'unicef',
    name: 'UNICEF',
    type: 'international',
    contact: 'https://www.unicef.org.tr',
    website: 'https://www.unicef.org.tr',
    description: 'Birleşmiş Milletler Çocuklara Yardım Fonu',
  },
];

export default function VolunteerModuleScreen({ navigation }: any) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'medical': return '#ef4444';
      case 'search': return '#f59e0b';
      case 'logistics': return '#3b82f6';
      case 'communication': return '#8b5cf6';
      default: return colors.text.secondary;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'medical': return 'medical';
      case 'search': return 'search';
      case 'logistics': return 'cube';
      case 'communication': return 'chatbubbles';
      default: return 'help-circle';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return colors.text.secondary;
    }
  };

  const filteredTasks = selectedCategory
    ? VOLUNTEER_TASKS.filter(t => t.category === selectedCategory)
    : VOLUNTEER_TASKS;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Gönüllü Modülü</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.infoBanner}>
          <Ionicons name="heart" size={24} color={colors.status.danger} />
          <Text style={styles.infoText}>
            Gönüllü olmak istiyorsanız veya yardım edebileceğiniz alanlar varsa, aşağıdaki görevlere katılabilirsiniz.
          </Text>
        </Animated.View>

        {/* Category Filter */}
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Görev Kategorileri</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            <Pressable
              style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                Tümü
              </Text>
            </Pressable>
            
            {['medical', 'search', 'logistics', 'communication'].map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat && styles.categoryChipActive,
                  { borderColor: getCategoryColor(cat) },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Ionicons name={getCategoryIcon(cat) as keyof typeof Ionicons.glyphMap} size={16} color={selectedCategory === cat ? getCategoryColor(cat) : colors.text.secondary} />
                <Text style={[
                  styles.categoryChipText,
                  selectedCategory === cat && [styles.categoryChipTextActive, { color: getCategoryColor(cat) }],
                ]}>
                  {cat === 'medical' ? 'Tıbbi' :
                   cat === 'search' ? 'Arama' :
                   cat === 'logistics' ? 'Lojistik' : 'İletişim'}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Tasks */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>Açık Görevler</Text>
          {filteredTasks.map((task, index) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={[styles.taskIcon, { backgroundColor: getCategoryColor(task.category) + '20' }]}>
                  <Ionicons name={getCategoryIcon(task.category) as keyof typeof Ionicons.glyphMap} size={24} color={getCategoryColor(task.category)} />
                </View>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDescription}>{task.description}</Text>
                  {task.location && (
                    <View style={styles.taskLocation}>
                      <Ionicons name="location" size={14} color={colors.text.tertiary} />
                      <Text style={styles.taskLocationText}>{task.location}</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
                  <Text style={styles.priorityText}>
                    {task.priority === 'high' ? 'YÜKSEK' :
                     task.priority === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                  </Text>
                </View>
              </View>

              <View style={styles.taskFooter}>
                <View style={styles.taskStats}>
                  <Ionicons name="people" size={16} color={colors.text.tertiary} />
                  <Text style={styles.taskStatsText}>
                    {task.assigned} / {task.needed} kişi
                  </Text>
                </View>
                <Pressable style={styles.joinButton}>
                  <Text style={styles.joinButtonText}>Katıl</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.brand.primary} />
                </Pressable>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(task.assigned / task.needed) * 100}%`,
                      backgroundColor: getCategoryColor(task.category),
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Aid Organizations */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Yardım Kuruluşları</Text>
          {AID_ORGANIZATIONS.map((org) => (
            <Pressable
              key={org.id}
              style={styles.orgCard}
              onPress={() => org.website && Linking.openURL(org.website)}
            >
              <View style={styles.orgHeader}>
                <View style={styles.orgIcon}>
                  <Ionicons
                    name={org.type === 'government' ? 'shield' :
                          org.type === 'ngo' ? 'heart' : 'globe'}
                    size={24}
                    color={colors.brand.primary}
                  />
                </View>
                <View style={styles.orgInfo}>
                  <Text style={styles.orgName}>{org.name}</Text>
                  <Text style={styles.orgDescription}>{org.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
              </View>
              {org.contact && (
                <Pressable
                  style={styles.orgContact}
                  onPress={() => org.contact.startsWith('http') ? Linking.openURL(org.contact) : Linking.openURL(`tel:${org.contact}`)}
                >
                  <Ionicons name="call" size={16} color={colors.brand.primary} />
                  <Text style={styles.orgContactText}>{org.contact}</Text>
                </Pressable>
              )}
            </Pressable>
          ))}
        </Animated.View>

        {/* Donation Info */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.donationCard}>
          <Ionicons name="cash" size={32} color={colors.status.success} />
          <Text style={styles.donationTitle}>Bağış Yapmak İster misiniz?</Text>
          <Text style={styles.donationText}>
            Afetzedelere yardım etmek için resmi kuruluşlara bağış yapabilirsiniz.
            Yukarıdaki yardım kuruluşlarına bağış yapabilirsiniz.
          </Text>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: colors.status.danger + '20',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.status.danger + '40',
  },
  infoText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 22,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  categoryScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: colors.brand.primary + '20',
    borderColor: colors.brand.primary,
  },
  categoryChipText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: colors.brand.primary,
    fontWeight: '700',
  },
  taskCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  taskIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  taskDescription: {
    ...typography.caption,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  taskLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskLocationText: {
    ...typography.small,
    color: colors.text.tertiary,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityText: {
    ...typography.small,
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskStatsText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brand.primary,
  },
  joinButtonText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.background.tertiary,
    borderRadius: 9999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 9999,
  },
  orgCard: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border.primary,
    marginBottom: 12,
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  orgIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brand.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  orgDescription: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  orgContact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  orgContactText: {
    ...typography.body,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  donationCard: {
    backgroundColor: colors.status.success + '20',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.status.success + '40',
    alignItems: 'center',
  },
  donationTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  donationText: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});


