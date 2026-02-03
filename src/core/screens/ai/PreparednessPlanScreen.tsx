import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, ImageBackground, TouchableOpacity, StatusBar, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { usePreparednessStore } from '../../ai/stores/preparednessStore';
import { PlanItem } from '../../ai/types/ai.types';
import * as haptics from '../../utils/haptics';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';

// Mock Elite Data for Kids/Elderly
const KIDS_ITEMS = [
  { id: 'k1', text: 'Süper Kahraman Çantası', desc: 'En sevdiğin oyuncağını çantana koydun mu?', icon: 'rocket' },
  { id: 'k2', text: 'Gece Feneri', desc: 'Karanlıkta yolunu bulmak için ışın kılıcın (fenerin) hazır mı?', icon: 'flashlight' },
  { id: 'k3', text: 'Gizli Şifre', desc: 'Anne ve babanla buluşma yerini ezberledin mi?', icon: 'key' },
  { id: 'k4', text: 'Su Matarası', desc: 'Güç iksirini (suyunu) yanına al!', icon: 'water' },
];

const ELDERLY_ADDS = [
  { id: 'e1', text: 'İlaç Yedekleri (30 Gün)', category: 'Sağlık', desc: 'Raporlu ilaçlarınızın yedeği' },
  { id: 'e2', text: 'Yedek Gözlük / İşitme Cihazı Pili', category: 'Sağlık', desc: 'Yedek piller çantada mı?' },
  { id: 'e3', text: 'Doktor İletişim Kartı', category: 'Evraklar', desc: 'Doktorunuzun numarası yazılı olmalı' },
];

export default function PreparednessPlanScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { plan, loading, refreshPlan, toggleItem, resetPlan } = usePreparednessStore();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<'adult' | 'kid'>('adult'); // 'adult' | 'kid'

  useEffect(() => { refreshPlan(); }, []);

  const toggleMode = () => {
    haptics.selectionChanged();
    setMode(prev => prev === 'adult' ? 'kid' : 'adult');
  };

  const sections = useMemo(() => {
    if (mode === 'kid') return [];
    if (!plan || !plan.sections) return [];

    return plan.sections.map(section => ({
      id: section.id,
      title: section.title,
      data: section.items || [],
      completedCount: (section.items || []).filter(i => i.completed).length,
      totalCount: (section.items || []).length,
    }));
  }, [plan, mode]);

  const toggleCategory = (category: string) => {
    haptics.selectionChanged();
    setExpandedCategory(curr => curr === category ? null : category);
  };

  const overallProgress = mode === 'kid' ? 25 : (plan ? plan.completionRate || 0 : 0);

  const renderKidMode = () => (
    <View style={{ padding: 20, gap: 16 }}>
      <View style={styles.kidHeroCard}>
        <View style={styles.kidBadge}><Ionicons name="star" size={24} color="#fbbf24" /></View>
        <Text style={styles.kidTitle}>KAHRAMAN GÖREVİ! 🦸‍♂️</Text>
        <Text style={styles.kidSubtitle}>Afetlere karşı süper güçlerini hazırla.</Text>
      </View>

      {KIDS_ITEMS.map((item, idx) => (
        <TouchableOpacity key={item.id} style={styles.kidItem} onPress={() => haptics.impactMedium()}>
          <View style={[styles.kidIconBox, { backgroundColor: idx % 2 === 0 ? '#dcfce7' : '#e0f2fe' }]}>
            <Ionicons name={item.icon as any} size={28} color={idx % 2 === 0 ? '#16a34a' : '#0284c7'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.kidItemTitle}>{item.text}</Text>
            <Text style={styles.kidItemDesc}>{item.desc}</Text>
          </View>
          <View style={styles.kidCheck}><Ionicons name="checkmark-circle-outline" size={28} color="#cbd5e1" /></View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderAdultMode = () => (
    <View style={styles.listContainer}>
      {sections.map((section) => (
        <View key={section.title} style={styles.sectionWrapper}>
          <TouchableOpacity onPress={() => toggleCategory(section.title)} style={styles.sectionHeaderWrapper} activeOpacity={0.9}>
            <BlurView intensity={60} tint="light" style={styles.sectionHeader}>
              <View style={[styles.indicatorDot, (Math.round((section.completedCount / section.totalCount) * 100) === 100) && { backgroundColor: '#10b981' }]} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.rightContainer}>
                {Math.round((section.completedCount / section.totalCount) * 100) === 100 ?
                  <Ionicons name="checkmark-circle" size={20} color="#10b981" /> :
                  <Text style={styles.sectionPercent}>%{Math.round((section.completedCount / section.totalCount) * 100)}</Text>
                }
              </View>
            </BlurView>
          </TouchableOpacity>
          {expandedCategory === section.title && (
            <View style={styles.itemsWrapper}>
              {section.data.map((item) => (
                <TouchableOpacity key={item.id} style={styles.itemTouchable} onPress={() => { haptics.impactLight(); toggleItem(section.id, item.id); }}>
                  <View style={[styles.checkbox, item.completed && styles.checkboxChecked]}>
                    {item.completed && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.itemText, item.completed && { textDecorationLine: 'line-through', color: '#94a3b8' }]}>{item.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      ))}
      {/* Elite Upgrade: Elderly Suggestion */}
      <View style={styles.tipBox}>
        <Ionicons name="information-circle" size={24} color="#059669" />
        <Text style={styles.tipText}>65+ Yaş için ilaç yedeklerini ve işitme cihazı pillerini kontrol etmeyi unutmayın.</Text>
      </View>
    </View>
  );

  return (
    <ImageBackground
      source={mode === 'kid' ? require('../../../assets/images/premium/green_nature_bg.png') : require('../../../assets/images/premium/green_nature_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient
        colors={mode === 'kid' ? ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0.7)'] : ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.6)']}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar barStyle="dark-content" />

      <View style={[styles.headerRow, { marginTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#064e3b" />
        </TouchableOpacity>

        {/* Mode Switcher */}
        <View style={styles.modeSwitcher}>
          <TouchableOpacity onPress={() => setMode('adult')} style={[styles.modeBtn, mode === 'adult' && styles.modeBtnActive]}>
            <Text style={[styles.modeText, mode === 'adult' && styles.modeTextActive]}>Yetişkin</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('kid')} style={[styles.modeBtn, mode === 'kid' && styles.modeBtnActive]}>
            <Text style={[styles.modeText, mode === 'kid' && styles.modeTextActive]}>Çocuk 🦸‍♂️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 20 }}>
        {/* Progress Hero */}
        <View style={styles.heroSection}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroText, { fontSize: 14, color: mode === 'kid' ? '#f59e0b' : '#34d399', fontWeight: '700', letterSpacing: 1 }]}>
              {mode === 'kid' ? 'SÜPER GÜÇ' : 'HAZIRLIK SEVİYESİ'}
            </Text>
            <Text style={styles.heroTextMain}>{mode === 'kid' ? 'Kahraman Modu' : 'Kişisel Plan'}</Text>
          </View>
          <View style={[styles.knobRing, mode === 'kid' && { borderColor: '#fbbf24', backgroundColor: '#fffbeb' }]}>
            <Text style={[styles.knobText, mode === 'kid' && { color: '#d97706' }]}>%{overallProgress}</Text>
          </View>
        </View>

        {mode === 'kid' ? renderKidMode() : renderAdultMode()}

      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0fdf4' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 10 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  modeSwitcher: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 20, padding: 4, borderWidth: 1, borderColor: '#f0fdf4' },
  modeBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 16 },
  modeBtnActive: { backgroundColor: '#10b981' },
  modeText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  modeTextActive: { color: '#fff' },

  heroSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingHorizontal: 4 },
  heroText: { marginBottom: 4 },
  heroTextMain: { fontSize: 28, fontWeight: '300', color: '#064e3b', letterSpacing: -0.5 },
  knobRing: { width: 70, height: 70, borderRadius: 35, borderWidth: 3, borderColor: '#86efac', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  knobText: { fontSize: 20, fontWeight: '700', color: '#059669' },

  listContainer: { gap: 12 },
  sectionWrapper: { marginBottom: 0 },
  sectionHeaderWrapper: { borderRadius: 16, overflow: 'hidden', marginBottom: 0, backgroundColor: '#fff', shadowColor: '#064e3b', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  indicatorDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#e2e8f0' },
  sectionTitle: { fontSize: 16, fontWeight: '500', color: '#334155', flex: 1 },
  rightContainer: {},
  sectionPercent: { fontSize: 13, fontWeight: '700', color: '#10b981' },
  itemsWrapper: { marginTop: 1, backgroundColor: '#fafafa', padding: 16, gap: 12 },
  itemTouchable: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: '#10b981', borderColor: '#10b981' },
  itemText: { fontSize: 15, fontWeight: '400', color: '#334155', flex: 1 },

  tipBox: { marginTop: 12, padding: 16, backgroundColor: '#ecfdf5', borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  tipText: { flex: 1, fontSize: 13, color: '#065f46', lineHeight: 18 },

  // Kid Mode Styles
  kidHeroCard: { backgroundColor: '#fff7ed', padding: 24, borderRadius: 24, alignItems: 'center', borderWidth: 2, borderColor: '#fed7aa', marginBottom: 12 },
  kidBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: "#f59e0b", shadowOpacity: 0.2, shadowRadius: 4 },
  kidTitle: { fontSize: 20, fontWeight: '800', color: '#b45309', letterSpacing: 1 },
  kidSubtitle: { fontSize: 14, color: '#d97706', marginTop: 4 },
  kidItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 20, gap: 16, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  kidIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  kidItemTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  kidItemDesc: { fontSize: 12, color: '#64748b', marginTop: 2 },
  kidCheck: { opacity: 0.5 },
});
