/**
 * MAP SCREEN - Map with Earthquake Pins (PREMIUM)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useEarthquakeStore, Earthquake } from '../../stores/earthquakeStore';
import { useFamilyStore, FamilyMember } from '../../stores/familyStore';
import { usePremiumStore } from '../../stores/premiumStore';
import PremiumGate from '../../components/PremiumGate';

export default function MapScreen() {
  const [isPremium, setIsPremium] = useState(false);
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsPremium(usePremiumStore.getState().isPremium);
      setEarthquakes(useEarthquakeStore.getState().items);
      setFamilyMembers(useFamilyStore.getState().members);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Harita</Text>
        <Text style={styles.headerSubtitle}>
          {earthquakes.length} deprem • {familyMembers.length} aile üyesi
        </Text>
      </View>

      {/* Map Placeholder */}
      <View style={styles.mapContainer}>
        <Text style={styles.mapPlaceholder}>
          🗺️ Harita burada görünecek
        </Text>
        <Text style={styles.mapNote}>
          Deprem konumları ve aile üyelerinin konumları gösterilecek
        </Text>
      </View>

      {/* Premium Gate */}
      {!isPremium && <PremiumGate featureName="Harita" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  mapPlaceholder: {
    fontSize: 48,
    marginBottom: 16,
  },
  mapNote: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});

