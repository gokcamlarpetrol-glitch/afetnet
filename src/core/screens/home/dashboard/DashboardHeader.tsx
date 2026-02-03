import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from '../../../components/SafeBlurView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../theme';

interface DashboardHeaderProps {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    isMeshActive: boolean;
    peerCount: number;
    onProfilePress: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  riskLevel,
  isMeshActive,
  peerCount,
  onProfilePress,
}) => {
  const insets = useSafeAreaInsets();

  const getRiskColor = () => {
    switch (riskLevel) {
    case 'HIGH': return '#EF4444';
    case 'MEDIUM': return '#F59E0B';
    case 'LOW': return '#10B981';
    default: return '#10B981';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerContent}>
        <View>
          <Text style={styles.greeting}>AFETNET COMMAND</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: isMeshActive ? '#059669' : '#64748B' }]} />
            <Text style={styles.statusText}>
              {isMeshActive ? `MESH: ${peerCount} CİHAZ` : 'AĞ DURUMU: ONLINE'}
            </Text>
          </View>
        </View>

        <View style={styles.rightContainer}>
          <View style={[styles.riskBadge, { borderColor: getRiskColor() }]}>
            <Text style={[styles.riskText, { color: getRiskColor() }]}>
                            DEFCON {riskLevel === 'HIGH' ? '1' : riskLevel === 'MEDIUM' ? '3' : '5'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  greeting: {
    color: '#0F172A', // Deep Navy
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.9,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: '#475569', // Slate 600
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.5)', // Light glass
  },
  riskText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.05)',
  },
});
