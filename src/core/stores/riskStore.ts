import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import NetInfo from '@react-native-community/netinfo';
import * as Location from 'expo-location';

interface RiskFactor {
    name: string;
    description: string;
    impact: number;
    status: 'positive' | 'negative' | 'neutral';
}

interface LocationRiskData {
    latitude?: number;
    longitude?: number;
    city?: string;
    district?: string;
    riskLevel?: 'High' | 'Medium' | 'Low';
}

interface RiskAssessment {
    overallScore: number;
    factors: RiskFactor[];
    lastUpdated: number;
    locations?: LocationRiskData;
}

interface RiskState {
    riskAssessment: RiskAssessment | null;
    loading: boolean;
    error: string | null;
    refreshRiskAssessment: () => Promise<void>;
}

// Simple Static Risk Database for Major Cities (Demo purposes, "Real" logic would query an API)
const HIGH_RISK_ZONES = ['Istanbul', 'Izmir', 'Tokyo', 'San Francisco', 'Los Angeles', 'Mexico City', 'Jakarta', 'Manila'];
const MEDIUM_RISK_ZONES = ['Ankara', 'New York', 'London', 'Paris', 'Berlin'];

export const useRiskStore = create<RiskState>()(
  persist(
    (set) => ({
      riskAssessment: null,
      loading: false,
      error: null,
      refreshRiskAssessment: async () => {
        set({ loading: true, error: null });
        try {
          // 1. Battery Check
          let batteryScore = 0;
          let batteryStatus: RiskFactor['status'] = 'neutral';
          let batteryDesc = '';

          try {
            const level = await Battery.getBatteryLevelAsync();
            const batteryLevel = level * 100;
            if (batteryLevel > 80) {
              batteryScore = 15;
              batteryStatus = 'positive';
              batteryDesc = `Batarya seviyesi yüksek (%${batteryLevel.toFixed(0)}). İletişim için yeterli.`;
            } else if (batteryLevel > 30) {
              batteryScore = 5;
              batteryStatus = 'positive';
              batteryDesc = `Batarya seviyesi makul (%${batteryLevel.toFixed(0)}). Tasarruf modu önerilir.`;
            } else {
              batteryScore = -20;
              batteryStatus = 'negative';
              batteryDesc = `KRİTİK: Batarya çok düşük (%${batteryLevel.toFixed(0)}). Acil durum iletişimi riskli.`;
            }
          } catch (e) {
            batteryDesc = 'Batarya bilgisi alınamadı.';
          }

          // 2. Network Check
          let netScore = 0;
          let netStatus: RiskFactor['status'] = 'neutral';
          let netDesc = '';

          try {
            const netState = await NetInfo.fetch();
            if (netState.isConnected && netState.isInternetReachable) {
              netScore = 20;
              netStatus = 'positive';
              netDesc = 'İnternet bağlantısı mevcut. Veri akışı sağlanabilir.';
            } else {
              netScore = -10;
              netStatus = 'negative';
              netDesc = 'Çevrimdışı moddasınız. Sadece yerel veriler kullanılabilir.';
            }
          } catch (e) {
            netDesc = 'Ağ durumu bilinmiyor.';
          }

          // 3. COMPLETE REAL LOCATION Logic
          let locScore = 0;
          let locStatus: RiskFactor['status'] = 'neutral';
          let locDesc = '';
          const locationData: LocationRiskData = {};

          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
              locScore = -15;
              locStatus = 'negative';
              locDesc = 'Konum izni verilmedi. Risk analizi eksik.';
            } else {
              const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              locationData.latitude = location.coords.latitude;
              locationData.longitude = location.coords.longitude;

              // Reverse Geocode
              const addresses = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              });

              if (addresses && addresses.length > 0) {
                const addr = addresses[0];
                const city = addr.city || addr.region || 'Bilinmiyor';
                const district = addr.district || addr.subregion || '';
                locationData.city = city;
                locationData.district = district;

                // Risk Logic
                const isHighRisk = HIGH_RISK_ZONES.some(z => city.includes(z) || district.includes(z));
                const isMediumRisk = MEDIUM_RISK_ZONES.some(z => city.includes(z));

                if (isHighRisk) {
                  locScore = -25;
                  locStatus = 'negative';
                  locDesc = `YÜKSEK RİSK BÖLGESİ: ${city}/${district}. Aktif fay hattı yakınında.`;
                  locationData.riskLevel = 'High';
                } else if (isMediumRisk) {
                  locScore = -5;
                  locStatus = 'neutral';
                  locDesc = `Orta Risk Bölgesi: ${city}. Standart önlemler yeterli.`;
                  locationData.riskLevel = 'Medium';
                } else {
                  locScore = +10;
                  locStatus = 'positive';
                  locDesc = `Düşük Risk Bölgesi: ${city}. Sismik aktivite az.`;
                  locationData.riskLevel = 'Low';
                }
              }
            }
          } catch (e) {
            locScore = -5;
            locStatus = 'neutral';
            locDesc = 'Konum alınamadı. GPS kapalı olabilir.';
          }

          // 4. Static Factors (Building Age - User Inputs in real app, mock for now)
          // In a REAL "Perfect" app, this would come from a user onboarding form.
          // For now, let's assume a default safe building unless modified by settings.
          const buildingFactor: RiskFactor = {
            name: 'Bina Durumu',
            description: 'Bina yaşı ve yapı denetim bilgisi girilmedi.',
            impact: 0,
            status: 'neutral',
          };

          const factors = [
            { name: 'Batarya Durumu', description: batteryDesc, impact: batteryScore, status: batteryStatus },
            { name: 'Ağ Bağlantısı', description: netDesc, impact: netScore, status: netStatus },
            { name: 'Konum Riski', description: locDesc, impact: locScore, status: locStatus },
            buildingFactor,
          ];

          const totalImpact = factors.reduce((acc, f) => acc + f.impact, 0);

          // Base 60 (Optimistic start) + impact
          let overallScore = 60 + totalImpact;
          overallScore = Math.max(0, Math.min(100, overallScore));

          const assessment: RiskAssessment = {
            overallScore,
            factors,
            lastUpdated: Date.now(),
            locations: locationData,
          };

          set({ riskAssessment: assessment, loading: false });
        } catch (err) {
          set({ error: 'Risk analizi yapılamadı.', loading: false });
        }
      },
    }),
    {
      name: 'risk-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
