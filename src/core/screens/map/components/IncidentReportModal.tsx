import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Vibration } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../../theme';
import * as haptics from '../../../utils/haptics';

interface Props {
  bottomSheetRef: React.RefObject<BottomSheet | null>; // ELITE: Accept nullable ref from useRef
  onReportSubmit: (type: string) => void;
}

const IncidentTypes = [
  { id: 'debris', label: 'Enkaz', icon: 'business', color: '#7f1d1d' },
  { id: 'fire', label: 'Yangın', icon: 'flame', color: '#ef4444' },
  { id: 'medical', label: 'Yaralı', icon: 'medkit', color: '#ef4444' },
  { id: 'flood', label: 'Sel/Su', icon: 'water', color: '#3b82f6' },
  { id: 'road_block', label: 'Yol Kapalı', icon: 'alert-circle', color: '#f59e0b' },
  { id: 'safe_zone', label: 'Güvenli Alan', icon: 'shield-checkmark', color: '#10b981' },
];

export const IncidentReportModal = ({ bottomSheetRef, onReportSubmit }: Props) => {
  const handlePress = (typeId: string) => {
    haptics.notificationSuccess();
    onReportSubmit(typeId);
    bottomSheetRef.current?.close();
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.5}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    [],
  );

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={['50%']}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.indicator}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Olay Bildir</Text>
        <Text style={styles.subtitle}>
          Bulunduğunuz konuma işaret bırakın. Bu bilgi çevrenizdeki diğer kullanıcılarla paylaşılacaktır (Mesh Ağı).
        </Text>

        <View style={styles.grid}>
          {IncidentTypes.map((item) => (
            <Pressable
              key={item.id}
              style={styles.gridItem}
              onPress={() => handlePress(item.id)}
              onPressIn={() => haptics.impactLight()}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon as any} size={28} color={item.color} />
              </View>
              <Text style={styles.itemLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#fff',
    borderRadius: 24,
  },
  indicator: {
    backgroundColor: '#e2e8f0',
    width: 40,
  },
  container: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  gridItem: {
    width: '30%',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
  },
});
