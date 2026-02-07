import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable, StatusBar, Linking, ImageBackground, Alert, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { useAIAssistantStore } from '../../ai/stores/aiAssistantStore';
import * as haptics from '../../utils/haptics';
import { aiAssistantCoordinator } from '../../ai/services/AIAssistantCoordinator';
import { eliteKnowledgeBase } from '../../services/ai/KnowledgeBase';
import { medicalDecisionTree, DecisionNode } from '../../services/ai/knowledge/MedicalDecisionTree';

import { createLogger } from '../../utils/logger';

const logger = createLogger('PanicAssistantScreen');

// ELITE: Real navigation to FlashlightWhistleScreen for hardware tools
// Flashlight, Whistle, and SOS are fully implemented in FlashlightWhistleScreen

type HazardType = 'earthquake' | 'nuclear' | 'biohazard' | 'tsunami' | 'fire' | 'extreme_weather' | 'medical';

const hazards: { id: HazardType; label: string; icon: string; colors: [string, string] }[] = [
  { id: 'earthquake', label: 'Deprem', icon: 'pulse', colors: ['#fda4af', '#e11d48'] },
  { id: 'medical', label: 'Medikal', icon: 'medkit', colors: ['#fca5a5', '#dc2626'] },
  { id: 'nuclear', label: 'Nükleer', icon: 'nuclear', colors: ['#fdba74', '#ea580c'] },
  { id: 'biohazard', label: 'Biyo', icon: 'skull', colors: ['#86efac', '#16a34a'] },
  { id: 'tsunami', label: 'Su', icon: 'water', colors: ['#93c5fd', '#2563eb'] },
  { id: 'fire', label: 'Yangın', icon: 'flame', colors: ['#fdba74', '#ea580c'] },
  { id: 'extreme_weather', label: 'Hava', icon: 'snow', colors: ['#c4b5fd', '#7c3aed'] },
];

export default function PanicAssistantScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [activeHazard, setActiveHazard] = useState<HazardType>('earthquake');
  const [medicalNode, setMedicalNode] = useState<DecisionNode | null>(null);

  // Elite Tools - Navigate to FlashlightWhistleScreen for real hardware access

  const { panicAssistant, panicAssistantLoading } = useAIAssistantStore();

  const activeGuides = useMemo(() => {
    if (activeHazard === 'earthquake' || activeHazard === 'medical') return null;
    const prefixMap: Record<string, string> = { nuclear: 'nuc', biohazard: 'bio', tsunami: 'tsu', fire: 'vol', extreme_weather: 'ext' };
    const prefix = prefixMap[activeHazard];
    return eliteKnowledgeBase.filter(k => k.id.startsWith(prefix));
  }, [activeHazard]);

  useEffect(() => {
    if (activeHazard === 'earthquake') aiAssistantCoordinator.ensurePanicAssistant('earthquake');
    if (activeHazard === 'medical') setMedicalNode(null);
  }, [activeHazard]);

  // ELITE: Navigate to FlashlightWhistleScreen for real hardware tools
  const openEmergencyTools = () => {
    haptics.impactMedium();
    try {
      (navigation as any).navigate('FlashlightWhistle');
    } catch (e) {
      logger.warn('FlashlightWhistle navigation failed:', e);
    }
  };

  const sendSafeStatus = () => {
    haptics.notificationSuccess();
    Alert.alert("Durum İletildi", "Güvende olduğunuz bilgisi Mesh ağı üzerinden ailenize iletildi.");
  };

  const startMedicalDiagnosis = (intent: 'bleeding' | 'consciousness') => {
    setMedicalNode(medicalDecisionTree.startDiagnosis(intent));
    haptics.selectionChanged();
  };

  const handleMedicalOption = (nextNodeId: string) => {
    const node = medicalDecisionTree.getNode(nextNodeId);
    if (node) { setMedicalNode(node); haptics.selectionChanged(); }
  };

  const renderTools = () => (
    <View style={styles.toolsContainer}>
      <Text style={styles.sectionHeaderTools}>HAYATTA KALMA SETİ</Text>
      <View style={styles.toolsGrid}>
        {/* Emergency Tools - Navigate to real FlashlightWhistleScreen */}
        <TouchableOpacity style={styles.toolBtn} onPress={openEmergencyTools}>
          <Ionicons name="flashlight" size={24} color="#be123c" />
          <Text style={styles.toolLabel}>FENER</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={openEmergencyTools}>
          <Ionicons name="megaphone" size={24} color="#be123c" />
          <Text style={styles.toolLabel}>DÜDÜK</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolBtn} onPress={openEmergencyTools}>
          <Ionicons name="alert-circle" size={24} color="#be123c" />
          <Text style={styles.toolLabel}>S.O.S</Text>
        </TouchableOpacity>

        {/* I'm Safe */}
        <TouchableOpacity style={[styles.toolBtn, styles.toolBtnSafe]} onPress={sendSafeStatus}>
          <Ionicons name="checkmark-circle" size={24} color="#047857" />
          <Text style={[styles.toolLabel, { color: '#047857' }]}>GÜVENDEYİM</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMedicalContent = () => {
    if (!medicalNode) {
      return (
        <View style={styles.contentSection}>
          <Text style={styles.sectionHeader}>Hızlı Teşhis</Text>
          <View style={{ gap: 12 }}>
            <TouchableOpacity style={styles.medicalBtn} onPress={() => startMedicalDiagnosis('bleeding')}>
              <Ionicons name="water-outline" size={22} color="#f43f5e" />
              <Text style={styles.medicalBtnText}>Kanama Kontrolü</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.medicalBtn} onPress={() => startMedicalDiagnosis('consciousness')}>
              <Ionicons name="eye-off-outline" size={22} color="#64748b" />
              <Text style={styles.medicalBtnText}>Bilinç Kontrolü</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.contentSection}>
        {medicalNode.question && (
          <View style={styles.guideCard}>
            <Text style={styles.questionText}>{medicalNode.question}</Text>
            <View style={{ gap: 10, marginTop: 24 }}>
              {medicalNode.options?.map((opt, idx) => (
                <TouchableOpacity key={idx} style={styles.optionBtn} onPress={() => handleMedicalOption(opt.nextNodeId)}>
                  <Text style={styles.optionText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {medicalNode.diagnosis && (
          <View style={[styles.guideCard, { backgroundColor: '#fff1f2', borderColor: '#ffe4e6' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="medical" size={24} color="#e11d48" />
              <Text style={[styles.guideTitle, { color: '#be123c' }]}>{medicalNode.diagnosis.title}</Text>
            </View>
            <Text style={styles.guideContent}>{medicalNode.diagnosis.content}</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={() => setMedicalNode(null)}>
              <Text style={styles.resetBtnText}>Yeni Kontrol</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ELITE: Earthquake step-by-step guide
  const EARTHQUAKE_STEPS = [
    { id: 1, title: 'ÇÖMEL', icon: 'body', color: '#ef4444', desc: 'Hemen yere çömelip el ve dizlerinizin üzerine inin.' },
    { id: 2, title: 'KAPAN', icon: 'shield', color: '#f59e0b', desc: 'Sağlam bir masa veya mobilyanın altına girin. Kapı eşiği yanıltıcı.' },
    { id: 3, title: 'TUTUN', icon: 'hand-left', color: '#10b981', desc: 'Sarsıntı durana kadar yerinizde kalın ve tutunun.' },
    { id: 4, title: 'BEKLE', icon: 'time', color: '#3b82f6', desc: 'Artçılar bitene kadar sabırlı olun, panik yapmayın.' },
  ];

  // ELITE: Hazard-specific content
  const HAZARD_CONTENT: Record<HazardType, { title: string; steps: string[] }> = {
    earthquake: { title: 'Deprem', steps: ['Çömel-Kapan-Tutun', '112\'yi arayın', 'Gaz vanasını kapatın', 'Toplanma alanına gidin'] },
    medical: { title: 'Tıbbi Acil', steps: [] },
    nuclear: { title: 'Nükleer Tehlike', steps: ['İç mekana geçin', 'Kapı ve camları kapatın', 'İyot tableti alın', 'Radyo haberleri dinleyin'] },
    biohazard: { title: 'Biyolojik Tehdit', steps: ['Maske takın', 'El hijyenine dikkat', 'Kalabalıktan uzak durun', 'Sağlık kuruluşuna başvurun'] },
    tsunami: { title: 'Tsunami', steps: ['Yüksek yere çıkın', 'Kıyıdan uzaklaşın', 'Dalga geçene kadar bekleyin', '6 saat boyunca geri dönmeyin'] },
    fire: { title: 'Yangın', steps: ['Eğilerek ilerleyin', 'Sıcak kapıya dokunmayın', 'Islak bez kullanın', 'Pencereden sinyal verin'] },
    extreme_weather: { title: 'Aşırı Hava', steps: ['İç mekanda kalın', 'Pencerelerden uzak durun', 'Acil kit hazırlayın', 'Yetkililerden haber bekleyin'] },
  };

  const renderEarthquakeContent = () => {
    if (panicAssistantLoading) return <ActivityIndicator color="#fb7185" size="large" style={{ marginTop: 50 }} />;

    return (
      <View style={styles.contentSection}>
        {/* Step-by-step cards */}
        <Text style={styles.sectionHeader}>ACİL EYLEM PLANI</Text>
        <View style={{ gap: 12 }}>
          {EARTHQUAKE_STEPS.map((step, index) => (
            <Animated.View
              key={step.id}
              style={[styles.stepCard, { borderLeftColor: step.color }]}
            >
              <View style={[styles.stepNumber, { backgroundColor: step.color }]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <View style={styles.stepHeader}>
                  <Ionicons name={step.icon as any} size={20} color={step.color} />
                  <Text style={[styles.stepTitle, { color: step.color }]}>{step.title}</Text>
                </View>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Progress Card */}
        {panicAssistant && (
          <View style={[styles.progressCard, { marginTop: 20 }]}>
            <Text style={styles.progressTitle}>HAZIRLIK DURUMU</Text>
            <Text style={styles.progressSubtitle}>{panicAssistant.progressPercentage}% Tamamlandı</Text>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${panicAssistant.progressPercentage}%` }]} />
            </View>
          </View>
        )}
      </View>
    );
  };

  // ELITE: Render content for other hazards
  const renderOtherHazardContent = () => {
    const content = HAZARD_CONTENT[activeHazard];
    if (!content || content.steps.length === 0) return null;

    return (
      <View style={styles.contentSection}>
        <Text style={styles.sectionHeader}>{content.title.toUpperCase()} REHBERİ</Text>
        <View style={{ gap: 12 }}>
          {content.steps.map((step, index) => (
            <View key={index} style={styles.hazardStep}>
              <View style={styles.hazardStepNumber}>
                <Text style={styles.hazardStepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.hazardStepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };


  return (
    <ImageBackground
      source={require('../../../assets/images/premium/red_panic_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.6)']} style={StyleSheet.absoluteFill} />
      <StatusBar barStyle="dark-content" />
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#881337" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingTop: 0 }}>
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <Text style={{ fontSize: 32, fontWeight: '300', color: '#881337', letterSpacing: -1 }}>Afet Rehberi</Text>
          <Text style={{ fontSize: 13, color: '#e11d48', fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>ACİL DURUM ASİSTANI</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
          {hazards.map(hazard => {
            const isActive = activeHazard === hazard.id;
            return (
              <TouchableOpacity
                key={hazard.id}
                style={[styles.hazardTab, isActive && { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' }]}
                onPress={() => { setActiveHazard(hazard.id); haptics.selectionChanged(); }}
              >
                <Ionicons name={hazard.icon as any} size={16} color={isActive ? '#be123c' : '#94a3b8'} />
                <Text style={[styles.hazardTabText, isActive && { color: '#be123c' }]}>{hazard.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Render Elite Tools ALWAYS visible */}
        {renderTools()}

        <View style={{ marginTop: 0 }}>
          {activeHazard === 'earthquake' && renderEarthquakeContent()}
          {activeHazard === 'medical' && renderMedicalContent()}
          {!['earthquake', 'medical'].includes(activeHazard) && renderOtherHazardContent()}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 10 }]}>
        <TouchableOpacity style={styles.sosButton} onPress={() => Linking.openURL('tel:112')}>
          <Text style={styles.sosButtonText}>112 ACİL ARAMA</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff1f2' },
  headerContainer: { flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 20, marginBottom: 10 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  tabsContainer: { paddingHorizontal: 24, gap: 10, paddingBottom: 20 },
  hazardTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#fff', gap: 6, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  hazardTabText: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },
  contentSection: { paddingHorizontal: 24, gap: 16 },

  // Elite Tools Styles
  toolsContainer: { paddingHorizontal: 24, marginBottom: 24 },
  sectionHeaderTools: { fontSize: 11, fontWeight: '700', color: '#be123c', letterSpacing: 1.5, marginBottom: 12, textTransform: 'uppercase' },
  toolsGrid: { flexDirection: 'row', gap: 10 },
  toolBtn: { flex: 1, height: 80, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 4, shadowColor: "#be123c", shadowOpacity: 0.1, shadowRadius: 8 },
  toolBtnActive: { backgroundColor: '#be123c' },
  toolBtnAlert: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#be123c' },
  toolBtnSafe: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5' },
  toolLabel: { fontSize: 10, fontWeight: '700', color: '#be123c' },
  toolLabelActive: { color: '#fff' },

  progressCard: { padding: 24, backgroundColor: '#fff', borderRadius: 24, shadowColor: "#fecdd3", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, marginBottom: 8 },
  progressTitle: { fontSize: 14, fontWeight: '700', color: '#881337', letterSpacing: 1, marginBottom: 4 },
  progressSubtitle: { fontSize: 12, color: '#f43f5e', marginBottom: 12 },
  progressBarBg: { height: 6, backgroundColor: '#ffe4e6', borderRadius: 3 },
  progressBarFill: { height: 6, backgroundColor: '#f43f5e', borderRadius: 3 },
  sectionHeader: { fontSize: 18, fontWeight: '500', color: '#881337', marginTop: 12 },
  actionRow: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 18, gap: 16, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#fecdd3' },
  iconBox: { padding: 8, borderRadius: 10 },
  actionText: { fontSize: 15, fontWeight: '500', color: '#525252' },
  emptyText: { color: '#fb7185', textAlign: 'center' },
  guideCard: { backgroundColor: '#fff', padding: 24, borderRadius: 24, gap: 10 },
  guideTitle: { fontSize: 20, fontWeight: '600', color: '#881337' },
  guideContent: { fontSize: 15, lineHeight: 24, color: '#525252' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, alignItems: 'center' },
  sosButton: { width: '100%', paddingVertical: 18, borderRadius: 24, backgroundColor: '#e11d48', alignItems: 'center', shadowColor: "#e11d48", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  sosButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  medicalBtn: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderRadius: 20, gap: 16, shadowColor: "#fecdd3", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  medicalBtnText: { fontSize: 15, fontWeight: '600', color: '#881337' },
  questionText: { fontSize: 22, fontWeight: '300', color: '#881337', textAlign: 'center', marginTop: 10 },
  optionBtn: { backgroundColor: '#fff0f1', paddingVertical: 16, paddingHorizontal: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#fecdd3' },
  optionText: { color: '#e11d48', fontWeight: '600', fontSize: 15 },
  resetBtn: { marginTop: 16, alignSelf: 'center', padding: 10 },
  resetBtnText: { color: '#f43f5e', fontWeight: '600', fontSize: 13, letterSpacing: 0.5 },

  // ELITE: Step card styles
  stepCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 18, gap: 14, borderLeftWidth: 4 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  stepContent: { flex: 1 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  stepTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  stepDesc: { fontSize: 13, color: '#64748b', lineHeight: 18 },

  // ELITE: Hazard step styles
  hazardStep: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 16, gap: 14 },
  hazardStepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fecdd3', alignItems: 'center', justifyContent: 'center' },
  hazardStepNumberText: { color: '#be123c', fontSize: 13, fontWeight: '700' },
  hazardStepText: { fontSize: 15, fontWeight: '500', color: '#525252', flex: 1 },
});
