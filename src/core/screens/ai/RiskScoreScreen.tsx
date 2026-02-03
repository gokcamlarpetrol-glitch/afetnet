import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, ImageBackground, TouchableOpacity, Dimensions, StatusBar, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { useRiskStore } from '../../stores/riskStore';
import * as haptics from '../../utils/haptics';
import { BlurView } from 'expo-blur';

// Mock Elite Data (Simulating a real advanced backend)
const ELITE_DATA = {
  soilType: { grade: 'C', description: 'Yumuşak Alüvyon', risk: 'Orta-Yüksek' },
  liquefaction: { status: 'Riski Var', color: '#f59e0b' },
  buildingAge: { year: 2005, code: 'Eski Yönetmelik', penalty: -15 },
  faultDistance: { km: 12.4, status: 'Kritik Yakınlık', color: '#ef4444' },
};

export default function RiskScoreScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { riskAssessment, loading, error, refreshRiskAssessment } = useRiskStore();
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => { refreshRiskAssessment(); }, []);

  const handleDeepAnalysis = () => {
    haptics.impactHeavy();
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      haptics.notificationSuccess();
    }, 2000);
  };

  const renderContent = () => {
    if (loading) return <ActivityIndicator size="large" color="#7dd3fc" style={{ marginTop: 50 }} />;
    if (error) return <Text style={styles.errorText}>Hata: {error}</Text>;
    if (!riskAssessment) return <Text style={styles.errorText}>Veri yok</Text>;

    return (
      <View style={styles.contentContainer}>
        {/* Elite Score Gauge */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeOuter}>
            <LinearGradient colors={['#fff', '#f0f9ff']} style={styles.gaugeInner}>
              <Text style={styles.gaugeValue}>{riskAssessment.overallScore || 0}</Text>
              <Text style={styles.gaugeLabel}>GÜVENLİK SKORU</Text>
            </LinearGradient>
          </View>
          <View style={styles.statusChip}>
            <View style={[styles.statusDot, { backgroundColor: riskAssessment.overallScore > 70 ? '#10b981' : '#f59e0b' }]} />
            <Text style={styles.statusText}>{riskAssessment.locations?.riskLevel === 'Low' ? 'GÜVENLİ SEVİYE' : 'RİSK MEVCUT'}</Text>
          </View>
        </View>

        {/* Micro-Zonation Cards (The "Elite" Upgrade) */}
        <View style={styles.eliteSection}>
          <Text style={styles.sectionHeader}>MİKRO BÖLGE ANALİZİ</Text>

          <View style={styles.gridRow}>
            {/* Soil Analysis */}
            <View style={styles.eliteCard}>
              <Ionicons name="layers" size={20} color="#64748b" />
              <Text style={styles.cardLabel}>Zemin Sınıfı</Text>
              <Text style={styles.cardValue}>{ELITE_DATA.soilType.grade}</Text>
              <Text style={styles.cardSub}>{ELITE_DATA.soilType.description}</Text>
            </View>

            {/* Fault Distance */}
            <View style={styles.eliteCard}>
              <Ionicons name="navigate-circle" size={20} color="#ef4444" />
              <Text style={styles.cardLabel}>Fay Hattı</Text>
              <Text style={[styles.cardValue, { color: '#ef4444' }]}>{ELITE_DATA.faultDistance.km}km</Text>
              <Text style={styles.cardSub}>{ELITE_DATA.faultDistance.status}</Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            {/* Liquefaction */}
            <View style={styles.eliteCard}>
              <Ionicons name="water" size={20} color="#f59e0b" />
              <Text style={styles.cardLabel}>Sıvılaşma</Text>
              <Text style={[styles.cardValue, { fontSize: 16, marginTop: 4, color: '#f59e0b' }]}>{ELITE_DATA.liquefaction.status}</Text>
            </View>

            {/* Building Age */}
            <View style={styles.eliteCard}>
              <Ionicons name="business" size={20} color="#3b82f6" />
              <Text style={styles.cardLabel}>Bina Yaşı</Text>
              <Text style={[styles.cardValue, { fontSize: 18, marginTop: 4 }]}>{ELITE_DATA.buildingAge.year}</Text>
              <Text style={styles.cardSub}>{ELITE_DATA.buildingAge.code}</Text>
            </View>
          </View>
        </View>

        {/* Dynamic Risk Factors */}
        <View style={styles.factorsList}>
          <Text style={styles.sectionHeader}>ETKİLEYEN FAKTÖRLER</Text>
          {riskAssessment.factors.map((factor, index) => (
            <View key={index} style={styles.factorCard}>
              <View style={[styles.iconBox, { backgroundColor: factor.status === 'positive' ? '#f0f9ff' : '#fff1f2' }]}>
                <Ionicons
                  name={factor.status === 'positive' ? 'shield-checkmark-outline' : 'alert-circle-outline'}
                  size={22}
                  color={factor.status === 'positive' ? '#0ea5e9' : '#f43f5e'}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.factorTitle}>{factor.name}</Text>
                <Text style={styles.factorDescription}>{factor.description}</Text>
              </View>
              <Text style={[styles.factorScore, { color: factor.status === 'positive' ? '#0ea5e9' : '#f43f5e' }]}>
                {factor.impact > 0 ? `+${factor.impact}` : factor.impact}
              </Text>
            </View>
          ))}
        </View>

        {/* Deep Analysis Action */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleDeepAnalysis}
          disabled={analyzing}
        >
          {analyzing ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="scan" size={18} color="#fff" />
              <Text style={styles.refreshText}>DETAYLI ANALİZİ YENİLE</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ImageBackground
      source={require('../../../assets/images/premium/blue_risk_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LinearGradient colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']} style={StyleSheet.absoluteFill} />
      <StatusBar barStyle="dark-content" />

      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#334155" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 60, paddingTop: 10 }}>
        <View style={{ paddingHorizontal: 24, marginBottom: 20 }}>
          <Text style={{ fontSize: 13, color: '#0ea5e9', fontWeight: '700', letterSpacing: 2, marginBottom: 4 }}>SİSMİK OTORİTE</Text>
          <Text style={{ fontSize: 32, fontWeight: '300', color: '#0f172a', letterSpacing: -1 }}>Risk & Zemin</Text>
        </View>
        {renderContent()}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f9ff' },
  headerContainer: { paddingHorizontal: 24, marginBottom: 10, alignItems: 'flex-start' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
  contentContainer: { paddingHorizontal: 24, gap: 28 },
  gaugeContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gaugeOuter: { width: 160, height: 160, borderRadius: 80, borderWidth: 1, borderColor: '#fff', padding: 8, backgroundColor: 'rgba(255,255,255,0.5)', shadowColor: '#bae6fd', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  gaugeInner: { flex: 1, borderRadius: 80, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#e0f2fe' },
  gaugeValue: { fontSize: 48, fontWeight: '300', color: '#0284c7', letterSpacing: -2 },
  gaugeLabel: { fontSize: 9, fontWeight: '700', color: '#7dd3fc', letterSpacing: 1, marginTop: 4 },
  statusChip: { marginTop: -20, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  eliteSection: { gap: 12 },
  sectionHeader: { fontSize: 12, fontWeight: '700', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 4 },
  gridRow: { flexDirection: 'row', gap: 12 },
  eliteCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 4, shadowColor: "#e2e8f0", shadowOpacity: 0.5, shadowRadius: 10, minHeight: 110 },
  cardLabel: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  cardSub: { fontSize: 11, color: '#94a3b8' },
  errorText: { textAlign: 'center', color: '#f43f5e', marginTop: 20 },
  factorsList: { gap: 12 },
  factorCard: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderRadius: 16, gap: 16, borderLeftWidth: 3, borderLeftColor: '#e0f2fe' },
  iconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  factorTitle: { fontSize: 15, fontWeight: '600', color: '#334155' },
  factorDescription: { fontSize: 12, color: '#94a3b8' },
  factorScore: { fontSize: 16, fontWeight: '700' },
  refreshButton: { marginTop: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 30, backgroundColor: '#0ea5e9', shadowColor: "#0ea5e9", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  refreshText: { color: '#fff', fontSize: 13, fontWeight: '700', letterSpacing: 1 },
});
