import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, ImageBackground, TouchableOpacity, StatusBar, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { usePreparednessStore } from '../../ai/stores/preparednessStore';
import { firebaseAnalyticsService } from '../../services/FirebaseAnalyticsService';
import * as haptics from '../../utils/haptics';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PreparednessPlanScreen');

// ELITE: Storage key for persistence
const CHECKLIST_STORAGE_KEY = '@afetnet_preparedness_checklist';

// ELITE: Comprehensive checklist items
const CHECKLIST_SECTIONS = [
  {
    id: 'essentials',
    title: 'Temel İhtiyaçlar',
    icon: 'cube',
    color: '#0ea5e9',
    items: [
      { id: 'water', text: 'Su (Kişi başı 3 litre/gün, 3 günlük)' },
      { id: 'food', text: 'Bozulmayan yiyecek (Konserve, bisküvi)' },
      { id: 'firstaid', text: 'İlk yardım çantası' },
      { id: 'flashlight', text: 'Fener ve yedek pil' },
      { id: 'radio', text: 'Pilli/el radyo' },
      { id: 'whistle', text: 'Düdük (sinyal için)' },
    ]
  },
  {
    id: 'documents',
    title: 'Önemli Evraklar',
    icon: 'document-text',
    color: '#8b5cf6',
    items: [
      { id: 'id', text: 'Kimlik fotokopisi' },
      { id: 'passport', text: 'Pasaport fotokopisi' },
      { id: 'insurance', text: 'Sigorta belgeleri' },
      { id: 'medical', text: 'Sağlık raporları' },
      { id: 'contacts', text: 'Acil durum telefonları listesi' },
    ]
  },
  {
    id: 'clothing',
    title: 'Giyim & Koruma',
    icon: 'shirt',
    color: '#f59e0b',
    items: [
      { id: 'clothes', text: 'Yedek kıyafet' },
      { id: 'blanket', text: 'Battaniye / Uyku tulumu' },
      { id: 'shoes', text: 'Sağlam ayakkabı' },
      { id: 'mask', text: 'Toz maskesi' },
      { id: 'gloves', text: 'Eldiven' },
    ]
  },
  {
    id: 'tools',
    title: 'Araç & Gereç',
    icon: 'build',
    color: '#ef4444',
    items: [
      { id: 'knife', text: 'Çakı / Maket bıçağı' },
      { id: 'rope', text: 'İp (10m)' },
      { id: 'tape', text: 'Koli bandı' },
      { id: 'matches', text: 'Kibrit / Çakmak' },
      { id: 'bag', text: 'Plastik poşet (çeşitli boylar)' },
    ]
  },
  {
    id: 'family',
    title: 'Aile Planı',
    icon: 'people',
    color: '#10b981',
    items: [
      { id: 'meeting', text: 'Buluşma noktası belirlendi' },
      { id: 'contact', text: 'Dış il irtibat kişisi' },
      { id: 'practice', text: 'Tatbikat yapıldı' },
      { id: 'kids', text: 'Çocuklar eğitildi' },
    ]
  },
];

// Mock Elite Data for Kids
const KIDS_ITEMS = [
  { id: 'k1', text: 'Süper Kahraman Çantası', desc: 'En sevdiğin oyuncağını çantana koydun mu?', icon: 'rocket' },
  { id: 'k2', text: 'Gece Feneri', desc: 'Karanlıkta yolunu bulmak için ışın kılıcın (fenerin) hazır mı?', icon: 'flashlight' },
  { id: 'k3', text: 'Gizli Şifre', desc: 'Anne ve babanla buluşma yerini ezberledin mi?', icon: 'key' },
  { id: 'k4', text: 'Su Matarası', desc: 'Güç iksirini (suyunu) yanına al!', icon: 'water' },
];

interface CheckedState {
  [key: string]: boolean;
}

export default function PreparednessPlanScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { plan, loading, refreshPlan, toggleItem } = usePreparednessStore();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<'adult' | 'kid'>('adult');
  const [checkedItems, setCheckedItems] = useState<CheckedState>({});
  const [isLoading, setIsLoading] = useState(true);

  // ELITE: Animation for celebration
  const celebrationScale = useSharedValue(1);

  // Load saved progress on mount
  useEffect(() => {
    loadProgress();
    refreshPlan();
  }, []);

  // Save progress whenever it changes
  useEffect(() => {
    if (!isLoading) {
      saveProgress();
    }
  }, [checkedItems]);

  const loadProgress = async () => {
    try {
      const saved = await AsyncStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (saved) {
        setCheckedItems(JSON.parse(saved));
      }
    } catch (e) {
      logger.warn('Failed to load progress:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgress = async () => {
    try {
      await AsyncStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checkedItems));
    } catch (e) {
      logger.warn('Failed to save progress:', e);
    }
  };

  const handleToggleItem = (itemId: string) => {
    haptics.impactLight();
    const newChecked = !checkedItems[itemId];
    setCheckedItems(prev => ({ ...prev, [itemId]: newChecked }));

    // ELITE: Track checklist progress
    firebaseAnalyticsService.logEvent('checklist_item_toggle', {
      item_id: itemId,
      is_checked: newChecked,
      total_checked: Object.values({ ...checkedItems, [itemId]: newChecked }).filter(Boolean).length,
    });

    // Celebration animation when completing an item
    if (newChecked) {
      celebrationScale.value = withSequence(
        withTiming(1.1, { duration: 100 }),
        withSpring(1, { damping: 10 })
      );
    }
  };

  const handleResetProgress = () => {
    Alert.alert(
      'İlerlemeyi Sıfırla',
      'Tüm hazırlık ilerlemeniz silinecek. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            haptics.notificationWarning();
            setCheckedItems({});
            await AsyncStorage.removeItem(CHECKLIST_STORAGE_KEY);
          }
        },
      ]
    );
  };

  const toggleCategory = (category: string) => {
    haptics.selectionChanged();
    setExpandedCategory(curr => curr === category ? null : category);
  };

  // Calculate overall progress
  const { overallProgress, totalItems, completedItems } = useMemo(() => {
    if (mode === 'kid') {
      const total = KIDS_ITEMS.length;
      const completed = KIDS_ITEMS.filter(item => checkedItems[item.id]).length;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { overallProgress: progress, totalItems: total, completedItems: completed };
    }

    let total = 0;
    let completed = 0;
    CHECKLIST_SECTIONS.forEach(section => {
      section.items.forEach(item => {
        total++;
        if (checkedItems[item.id]) completed++;
      });
    });

    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { overallProgress: progress, totalItems: total, completedItems: completed };
  }, [checkedItems, mode]);

  const celebrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebrationScale.value }],
  }));

  const renderKidMode = () => (
    <View style={{ padding: 20, gap: 16 }}>
      <View style={styles.kidHeroCard}>
        <View style={styles.kidBadge}><Ionicons name="star" size={24} color="#fbbf24" /></View>
        <Text style={styles.kidTitle}>KAHRAMAN GÖREVİ! 🦸‍♂️</Text>
        <Text style={styles.kidSubtitle}>Afetlere karşı süper güçlerini hazırla.</Text>
      </View>

      {KIDS_ITEMS.map((item, idx) => {
        const isChecked = checkedItems[item.id];
        return (
          <TouchableOpacity key={item.id} style={styles.kidItem} onPress={() => handleToggleItem(item.id)}>
            <View style={[styles.kidIconBox, { backgroundColor: idx % 2 === 0 ? '#dcfce7' : '#e0f2fe' }]}>
              <Ionicons name={item.icon as any} size={28} color={idx % 2 === 0 ? '#16a34a' : '#0284c7'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kidItemTitle, isChecked && { textDecorationLine: 'line-through', color: '#94a3b8' }]}>{item.text}</Text>
              <Text style={styles.kidItemDesc}>{item.desc}</Text>
            </View>
            <View style={styles.kidCheck}>
              <Ionicons
                name={isChecked ? 'checkmark-circle' : 'checkmark-circle-outline'}
                size={28}
                color={isChecked ? '#10b981' : '#cbd5e1'}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderAdultMode = () => (
    <View style={styles.listContainer}>
      {CHECKLIST_SECTIONS.map((section) => {
        const sectionCompleted = section.items.filter(item => checkedItems[item.id]).length;
        const sectionTotal = section.items.length;
        const sectionProgress = Math.round((sectionCompleted / sectionTotal) * 100);
        const isComplete = sectionProgress === 100;

        return (
          <Animated.View key={section.id} style={styles.sectionWrapper} entering={FadeInDown.delay(100)}>
            <TouchableOpacity onPress={() => toggleCategory(section.id)} style={styles.sectionHeaderWrapper} activeOpacity={0.9}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: section.color + '20' }]}>
                  <Ionicons name={section.icon as any} size={18} color={section.color} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.rightContainer}>
                  {isComplete ? (
                    <View style={styles.completeBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.progressBadge}>
                      <Text style={[styles.progressText, { color: section.color }]}>{sectionCompleted}/{sectionTotal}</Text>
                    </View>
                  )}
                  <Ionicons
                    name={expandedCategory === section.id ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#94a3b8"
                  />
                </View>
              </View>
            </TouchableOpacity>

            {expandedCategory === section.id && (
              <Animated.View style={styles.itemsWrapper} entering={FadeIn.duration(200)}>
                {section.items.map((item) => {
                  const isChecked = checkedItems[item.id];
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.itemTouchable}
                      onPress={() => handleToggleItem(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, isChecked && { backgroundColor: section.color, borderColor: section.color }]}>
                        {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.itemText, isChecked && styles.itemTextChecked]}>{item.text}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}
          </Animated.View>
        );
      })}

      {/* Reset button */}
      <TouchableOpacity style={styles.resetButton} onPress={handleResetProgress}>
        <Ionicons name="refresh" size={16} color="#ef4444" />
        <Text style={styles.resetText}>İlerlemeyi Sıfırla</Text>
      </TouchableOpacity>

      {/* Elite Upgrade: Tip */}
      <View style={styles.tipBox}>
        <Ionicons name="bulb" size={24} color="#059669" />
        <Text style={styles.tipText}>Deprem çantanızı her 6 ayda bir kontrol edin. Son kullanma tarihlerini güncelleyin.</Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

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
            <Text style={[styles.heroLabel, { color: mode === 'kid' ? '#f59e0b' : '#34d399' }]}>
              {mode === 'kid' ? 'SÜPER GÜÇ' : 'HAZIRLIK SEVİYESİ'}
            </Text>
            <Text style={styles.heroTitle}>{mode === 'kid' ? 'Kahraman Modu' : 'Deprem Çantası'}</Text>
            {mode === 'adult' && (
              <Text style={styles.heroSubtitle}>{completedItems} / {totalItems} tamamlandı</Text>
            )}
          </View>
          <Animated.View style={[styles.progressRing, celebrationStyle, overallProgress === 100 && styles.progressRingComplete]}>
            <Text style={[styles.progressPercent, overallProgress === 100 && { color: '#10b981' }]}>%{overallProgress}</Text>
            {overallProgress === 100 && <Ionicons name="checkmark-circle" size={16} color="#10b981" style={{ marginTop: 2 }} />}
          </Animated.View>
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
  heroLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle: { fontSize: 26, fontWeight: '300', color: '#064e3b', letterSpacing: -0.5 },
  heroSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  progressRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#86efac', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  progressRingComplete: { borderColor: '#10b981', backgroundColor: '#f0fdf4' },
  progressPercent: { fontSize: 20, fontWeight: '700', color: '#059669' },

  listContainer: { gap: 12 },
  sectionWrapper: { marginBottom: 0 },
  sectionHeaderWrapper: { borderRadius: 16, overflow: 'hidden', marginBottom: 0, backgroundColor: '#fff', shadowColor: '#064e3b', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  sectionIconBox: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#334155', flex: 1 },
  rightContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBadge: { backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  progressText: { fontSize: 12, fontWeight: '700' },
  completeBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  itemsWrapper: { backgroundColor: '#fafafa', padding: 16, gap: 14, marginTop: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  itemTouchable: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  itemText: { fontSize: 14, fontWeight: '500', color: '#334155', flex: 1 },
  itemTextChecked: { textDecorationLine: 'line-through', color: '#94a3b8' },

  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 8 },
  resetText: { fontSize: 13, color: '#ef4444', fontWeight: '600' },

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

