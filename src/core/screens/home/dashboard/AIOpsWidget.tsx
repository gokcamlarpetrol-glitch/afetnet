import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from '../../../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import { ShinyButton } from '../../../components/21st/ShinyButton';

interface Props {
    onPress: () => void;
}

export const AIOpsWidget: React.FC<Props> = ({ onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.container}>
      <LinearGradient
        colors={['#FFFFFF', '#F0FDF4']} // White to Soft Green
        style={styles.gradient}
      >
        <View style={styles.leftContent}>
          <View style={styles.iconBox}>
            <Ionicons name="hardware-chip-outline" size={20} color="#059669" />
          </View>
          <View>
            <Text style={styles.title}>AI GUARDIAN</Text>
            <Text style={styles.status}>SİSTEM AKTİF • HAZIR</Text>
          </View>
        </View>

        <ShinyButton
          onPress={onPress}
          buttonStyle={{
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 8,
            gap: 4,
          }}
          color="rgba(16, 185, 129, 0.1)"
          textStyle={{ fontSize: 10, color: '#059669' }}
          icon={<Ionicons name="arrow-forward" size={14} color="#059669" />}
        >
                    ASİSTAN
        </ShinyButton>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.15)', // Green border
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(5, 150, 105, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.2)',
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669', // Emerald
    letterSpacing: 0.5,
  },
  status: {
    fontSize: 10,
    color: '#64748B', // Slate
    fontWeight: '600',
    marginTop: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
});
