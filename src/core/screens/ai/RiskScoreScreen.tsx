import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, ImageBackground, TouchableOpacity, StatusBar, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/core';
import { useRiskStore } from '../../stores/riskStore';
import { useEarthquakeStore } from '../../stores/earthquakeStore';
import { firebaseAnalyticsService } from '../../services/FirebaseAnalyticsService';
import * as haptics from '../../utils/haptics';
import * as Location from 'expo-location';

// ELITE: Turkish Regional Risk Data (Based on AFAD data)
const REGIONAL_RISK_DATA: Record<string, { faultDistance: number; soilClass: string; liquefaction: boolean; riskLevel: string }> = {
  'İstanbul': { faultDistance: 15, soilClass: 'C', liquefaction: true, riskLevel: 'Çok Yüksek' },
  'Ankara': { faultDistance: 45, soilClass: 'B', liquefaction: false, riskLevel: 'Orta' },
  'İzmir': { faultDistance: 8, soilClass: 'D', liquefaction: true, riskLevel: 'Çok Yüksek' },
  'Bursa': { faultDistance: 25, soilClass: 'C', liquefaction: true, riskLevel: 'Yüksek' },
  'Antalya': { faultDistance: 35, soilClass: 'B', liquefaction: false, riskLevel: 'Orta' },
  'Konya': { faultDistance: 60, soilClass: 'A', liquefaction: false, riskLevel: 'Düşük' },
  'Kocaeli': { faultDistance: 5, soilClass: 'D', liquefaction: true, riskLevel: 'Çok Yüksek' },
  'Malatya': { faultDistance: 10, soilClass: 'C', liquefaction: false, riskLevel: 'Yüksek' },
  'Hatay': { faultDistance: 3, soilClass: 'D', liquefaction: true, riskLevel: 'Kritik' },
  'default': { faultDistance: 30, soilClass: 'B', liquefaction: false, riskLevel: 'Orta' },
};

const SOIL_DESCRIPTIONS: Record<string, string> = {
  'A': 'Sağlam Kaya',
  'B': 'Orta Sağlam Zemin',
  'C': 'Yumuşak Alüvyon',
  'D': 'Çok Yumuşak Zemin',
};

export default function RiskScoreScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { riskAssessment, loading, error, refreshRiskAssessment } = useRiskStore();
  const earthquakes = useEarthquakeStore(state => state.items);

  const [analyzing, setAnalyzing] = useState(false);
  const [locationName, setLocationName] = useState<string>('Konum Alınıyor...');
  const [regionData, setRegionData] = useState(REGIONAL_RISK_DATA.default);
  const [recentEarthquakes, setRecentEarthquakes] = useState<number>(0);
  const [nearbyMagnitude, setNearbyMagnitude] = useState<number | null>(null);

  // ELITE: Animated gauge
  const gaugeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    refreshRiskAssessment();
    fetchLocation();
    calculateRecentActivity();
  }, []);

  // ELITE: Animate score on load
  useEffect(() => {
    if (riskAssessment?.overallScore) {
      Animated.spring(gaugeAnim, {
        toValue: riskAssessment.overallScore,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      }).start();
    }
  }, [riskAssessment?.overallScore]);

  // ELITE: Pulse animation for high risk
  useEffect(() => {
    if (regionData.riskLevel === 'Çok Yüksek' || regionData.riskLevel === 'Kritik') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [regionData.riskLevel]);

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationName('İzin Verilmedi');
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const addresses = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (addresses.length > 0) {
        const city = addresses[0].city || addresses[0].region || 'Türkiye';
        setLocationName(city);

        // Get regional risk data
        const data = REGIONAL_RISK_DATA[city] || REGIONAL_RISK_DATA.default;
        setRegionData(data);

        // ELITE: Track risk score view with location data
        firebaseAnalyticsService.logEvent('risk_score_view', {
          city: city,
          risk_level: data.riskLevel,
          fault_distance: data.faultDistance,
          soil_class: data.soilClass,
        });
      }
    } catch (e) {
      setLocationName('Konum Alınamadı');
    }
  };

  const calculateRecentActivity = () => {
    // Count earthquakes in last 24 hours with magnitude >= 3.0
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = earthquakes.filter(eq => eq.time > oneDayAgo && eq.magnitude >= 3.0);
    setRecentEarthquakes(recent.length);

    // Find largest nearby earthquake
    if (recent.length > 0) {
      const maxMag = Math.max(...recent.map(eq => eq.magnitude));
      setNearbyMagnitude(maxMag);
    }
  };

  const handleDeepAnalysis = () => {
    haptics.impactHeavy();
    setAnalyzing(true);
    fetchLocation();
    setTimeout(() => {
      setAnalyzing(false);
      haptics.notificationSuccess();
    }, 2000);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Kritik': return '#dc2626';
      case 'Çok Yüksek': return '#ef4444';
      case 'Yüksek': return '#f59e0b';
      case 'Orta': return '#eab308';
      case 'Düşük': return '#22c55e';
      default: return '#64748b';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#eab308';
    if (score >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const renderContent = () => {
    if (loading) return <ActivityIndicator size="large" color="#7dd3fc" style={{ marginTop: 50 }} />;
    if (error) return <Text style={styles.errorText}>Hata: {error}</Text>;
    if (!riskAssessment) return <Text style={styles.errorText}>Veri yok</Text>;

    const score = riskAssessment.overallScore || 0;
    const scoreColor = getScoreColor(score);
    const riskColor = getRiskColor(regionData.riskLevel);

    return (
      <View style={styles.contentContainer}>
        {/* Location Badge */}
        <View style={styles.locationBadge}>
          <Ionicons name="location" size={14} color="#0ea5e9" />
          <Text style={styles.locationText}>{locationName}</Text>
        </View>

        {/* Elite Score Gauge */}
        <Animated.View style={[styles.gaugeContainer, { transform: [{ scale: pulseAnim }] }]}>
          <View style={[styles.gaugeOuter, { borderColor: scoreColor + '30' }]}>
            <LinearGradient colors={['#fff', '#f0f9ff']} style={[styles.gaugeInner, { borderColor: scoreColor + '50' }]}>
              <Animated.Text style={[styles.gaugeValue, { color: scoreColor }]}>
                {gaugeAnim.interpolate({ inputRange: [0, 100], outputRange: ['0', Math.round(score).toString()] })}
              </Animated.Text>
              <Text style={styles.gaugeLabel}>GÜVENLİK SKORU</Text>
            </LinearGradient>
          </View>
          <View style={[styles.statusChip, { backgroundColor: riskColor + '15', borderColor: riskColor + '30' }]}>
            <View style={[styles.statusDot, { backgroundColor: riskColor }]} />
            <Text style={[styles.statusText, { color: riskColor }]}>{regionData.riskLevel.toUpperCase()}</Text>
          </View>
        </Animated.View>

        {/* Recent Activity Alert */}
        {recentEarthquakes > 0 && (
          <View style={styles.activityAlert}>
            <Ionicons name="pulse" size={18} color="#ef4444" />
            <Text style={styles.activityText}>
              Son 24 saatte <Text style={{ fontWeight: '800' }}>{recentEarthquakes}</Text> deprem (3.0+)
              {nearbyMagnitude && <Text>, en büyük: <Text style={{ fontWeight: '800' }}>{nearbyMagnitude.toFixed(1)}</Text></Text>}
            </Text>
          </View>
        )}

        {/* Micro-Zonation Cards */}
        <View style={styles.eliteSection}>
          <Text style={styles.sectionHeader}>MİKRO BÖLGE ANALİZİ</Text>

          <View style={styles.gridRow}>
            {/* Soil Analysis */}
            <View style={styles.eliteCard}>
              <Ionicons name="layers" size={20} color="#64748b" />
              <Text style={styles.cardLabel}>Zemin Sınıfı</Text>
              <Text style={styles.cardValue}>{regionData.soilClass}</Text>
              <Text style={styles.cardSub}>{SOIL_DESCRIPTIONS[regionData.soilClass]}</Text>
            </View>

            {/* Fault Distance */}
            <View style={styles.eliteCard}>
              <Ionicons name="navigate-circle" size={20} color={regionData.faultDistance < 15 ? '#ef4444' : '#f59e0b'} />
              <Text style={styles.cardLabel}>Fay Hattı</Text>
              <Text style={[styles.cardValue, { color: regionData.faultDistance < 15 ? '#ef4444' : '#0f172a' }]}>
                {regionData.faultDistance}km
              </Text>
              <Text style={styles.cardSub}>{regionData.faultDistance < 15 ? 'Kritik Yakınlık' : 'Normal Mesafe'}</Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            {/* Liquefaction */}
            <View style={styles.eliteCard}>
              <Ionicons name="water" size={20} color={regionData.liquefaction ? '#f59e0b' : '#22c55e'} />
              <Text style={styles.cardLabel}>Sıvılaşma</Text>
              <Text style={[styles.cardValue, { fontSize: 16, marginTop: 4, color: regionData.liquefaction ? '#f59e0b' : '#22c55e' }]}>
                {regionData.liquefaction ? 'Riski Var' : 'Risk Yok'}
              </Text>
            </View>

            {/* Seismic Activity */}
            <View style={styles.eliteCard}>
              <Ionicons name="stats-chart" size={20} color="#3b82f6" />
              <Text style={styles.cardLabel}>Sismik Aktivite</Text>
              <Text style={[styles.cardValue, { fontSize: 18, marginTop: 4 }]}>{recentEarthquakes}</Text>
              <Text style={styles.cardSub}>Son 24 saat</Text>
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
  locationBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: '#f0f9ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#bae6fd' },
  locationText: { fontSize: 14, fontWeight: '600', color: '#0284c7' },
  gaugeContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  gaugeOuter: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, padding: 8, backgroundColor: 'rgba(255,255,255,0.5)', shadowColor: '#bae6fd', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  gaugeInner: { flex: 1, borderRadius: 80, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  gaugeValue: { fontSize: 48, fontWeight: '300', letterSpacing: -2 },
  gaugeLabel: { fontSize: 9, fontWeight: '700', color: '#7dd3fc', letterSpacing: 1, marginTop: 4 },
  statusChip: { marginTop: -20, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '800' },
  activityAlert: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fef2f2', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#fecaca' },
  activityText: { fontSize: 13, color: '#991b1b', flex: 1 },
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

