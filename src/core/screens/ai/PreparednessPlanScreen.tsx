import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, ImageBackground, TouchableOpacity, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { usePreparednessStore } from '../../ai/stores/preparednessStore';
import { aiAssistantCoordinator } from '../../ai/services/AIAssistantCoordinator';
import { firebaseAnalyticsService } from '../../services/FirebaseAnalyticsService';
import * as haptics from '../../utils/haptics';
import Animated, { FadeInDown, FadeIn, useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import { DirectStorage } from '../../utils/storage';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PreparednessPlanScreen');

// ELITE: User-scoped storage key for persistence (prevents cross-account data leak)
const CHECKLIST_STORAGE_BASE = '@afetnet_preparedness_checklist';
function getChecklistKey(): string {
  try {
    const { getFirebaseAuth } = require('../../../lib/firebase');
    const uid = getFirebaseAuth()?.currentUser?.uid;
    return uid ? `${CHECKLIST_STORAGE_BASE}_${uid}` : CHECKLIST_STORAGE_BASE;
  } catch {
    return CHECKLIST_STORAGE_BASE;
  }
}

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
  const { plan, loading, error, refreshPlan, toggleItem } = usePreparednessStore();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<'adult' | 'kid'>('adult');
  const [checkedItems, setCheckedItems] = useState<CheckedState>({});
  const [isLoading, setIsLoading] = useState(true);

  // ELITE: Animation for celebration
  const celebrationScale = useSharedValue(1);

  // Mount: hydrate checklist from storage, then build plan only when missing.
  // collectUserProfileParams triggers location permission + reverse geocode +
  // family store query — skip if a usable plan already exists to save battery
  // and avoid unnecessary permission prompts on every navigation.
  useEffect(() => {
    loadProgress();
    const { plan: existingPlan, loading: storeLoading } = usePreparednessStore.getState();
    const hasUsablePlan = !!(existingPlan && existingPlan.sections && existingPlan.sections.length > 0);
    // Skip when a usable plan exists OR when a generation is already in flight
    // (preparednessStore has no loading-guard, so revisiting the screen mid-fetch
    // would otherwise spawn a duplicate generatePlan request).
    if (!hasUsablePlan && !storeLoading) {
      aiAssistantCoordinator.collectUserProfileParams()
        .then((params) => refreshPlan(params))
        .catch(() => refreshPlan());
    }
    // Mount-only effect — refreshPlan + coordinator are stable singletons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist checklist on every toggle. isLoading intentionally excluded:
  // we only want to react to user-driven changes after initial hydration.
  useEffect(() => {
    if (!isLoading) {
      saveProgress();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedItems]);

  const loadProgress = () => {
    try {
      const saved = DirectStorage.getString(getChecklistKey());
      if (saved) {
        setCheckedItems(JSON.parse(saved));
      }
    } catch (e) {
      logger.warn('Failed to load progress:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProgress = () => {
    try {
      DirectStorage.setString(getChecklistKey(), JSON.stringify(checkedItems));
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

  const handleTogglePlanItem = async (sectionId: string, itemId: string) => {
    haptics.impactLight();
    await toggleItem(sectionId, itemId);
    firebaseAnalyticsService.logEvent('preparedness_plan_item_toggle', {
      section_id: sectionId,
      item_id: itemId,
    });
    celebrationScale.value = withSequence(
      withTiming(1.1, { duration: 100 }),
      withSpring(1, { damping: 10 })
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

    const total = plan?.totalItems || plan?.sections?.reduce((sum, section) => sum + section.items.length, 0) || 0;
    const completed = plan?.completedItems || plan?.sections?.reduce(
      (sum, section) => sum + section.items.filter(item => item.completed).length,
      0,
    ) || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { overallProgress: progress, totalItems: total, completedItems: completed };
  }, [checkedItems, mode, plan]);

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
      {loading && !plan && (
        <View style={styles.tipBox}>
          <ActivityIndicator size="small" color="#059669" />
          <Text style={styles.tipText}>Plan hazırlanıyor...</Text>
        </View>
      )}

      {error && !loading && !plan && (
        <View style={styles.tipBox}>
          <Ionicons name="warning" size={24} color="#ef4444" />
          <Text style={styles.tipText}>{error}</Text>
        </View>
      )}

      {plan?.sections.map((section) => {
        const sectionColor = section.color || '#10b981';
        const sectionCompleted = section.items.filter(item => item.completed).length;
        const sectionTotal = section.items.length;
        const sectionProgress = sectionTotal > 0 ? Math.round((sectionCompleted / sectionTotal) * 100) : 0;
        const isComplete = sectionProgress === 100;

        return (
          <Animated.View key={section.id} style={styles.sectionWrapper} entering={FadeInDown.delay(100)}>
            <TouchableOpacity onPress={() => toggleCategory(section.id)} style={styles.sectionHeaderWrapper} activeOpacity={0.9}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBox, { backgroundColor: sectionColor + '20' }]}>
                  <Ionicons name={(section.icon || 'list') as any} size={18} color={sectionColor} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.rightContainer}>
                  {isComplete ? (
                    <View style={styles.completeBadge}>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                    </View>
                  ) : (
                    <View style={styles.progressBadge}>
                      <Text style={[styles.progressText, { color: sectionColor }]}>{sectionCompleted}/{sectionTotal}</Text>
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
                  const isChecked = item.completed;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.itemTouchable}
                      onPress={() => handleTogglePlanItem(section.id, item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.checkbox, isChecked && { backgroundColor: sectionColor, borderColor: sectionColor }]}>
                        {isChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemText, isChecked && styles.itemTextChecked]}>{item.text}</Text>
                        {item.instructions ? <Text style={styles.itemInstructions}>{item.instructions}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Animated.View>
            )}
          </Animated.View>
        );
      })}

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
      source={require('../../../../assets/images/premium/green_nature_bg.jpg')}
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

        {/* P0-7: AI medical/safety disclaimer — required on every screen that
            renders AI-generated emergency advice. Non-dismissable. */}
        <View style={styles.aiDisclaimerBanner} accessibilityRole="alert" accessibilityLabel="AI tıbbi sorumluluk reddi">
          <Ionicons name="information-circle" size={18} color="#92400e" />
          <Text style={styles.aiDisclaimerText}>
            Bu öneriler yapay zekâ tarafından üretildi. Acil tıbbi durumda 112&apos;yi arayın. AfetNet, profesyonel tıbbi veya kurtarma hizmetinin yerine geçmez.
          </Text>
        </View>

      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // P0-7
  aiDisclaimerBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    borderRadius: 12,
  },
  aiDisclaimerText: {
    flex: 1,
    color: '#78350f',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
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
  itemInstructions: { fontSize: 12, color: '#64748b', lineHeight: 17, marginTop: 4 },
  itemTextChecked: { textDecorationLine: 'line-through', color: '#94a3b8' },

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
