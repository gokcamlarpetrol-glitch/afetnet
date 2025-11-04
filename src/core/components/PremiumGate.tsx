/**
 * PREMIUM GATE - Overlay for Premium Features
 * Shows screen but prevents interaction + Trial info
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrialStore } from '../stores/trialStore';
import { createLogger } from '../utils/logger';
import * as haptics from '../utils/haptics';

const logger = createLogger('PremiumGate');

interface PremiumGateProps {
  featureName: string;
  onUpgradePress?: () => void;
}

export default function PremiumGate({ featureName, onUpgradePress }: PremiumGateProps) {
  const daysRemaining = useTrialStore((state) => state.getRemainingDays());
  const hoursRemaining = useTrialStore((state) => state.getRemainingHours());
  const isTrialActive = useTrialStore((state) => state.isTrialActive);

  const handleUpgrade = () => {
    haptics.impactMedium();
    logger.info('Premium upgrade requested');
    // Parent component will handle navigation
    onUpgradePress?.();
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed" size={48} color="#3b82f6" />
        </View>
        
        <Text style={styles.title}>Premium Özellik</Text>
        
        <Text style={styles.description}>
          {featureName} özelliğini kullanmak için Premium üyelik gereklidir.
        </Text>

        {/* Trial Status */}
        {isTrialActive && (
          <View style={styles.trialBadge}>
            <Ionicons name="time-outline" size={16} color="#10b981" />
            <Text style={styles.trialText}>
              {daysRemaining > 0 
                ? `${daysRemaining} gün ücretsiz deneme kaldı` 
                : `${hoursRemaining} saat ücretsiz deneme kaldı`}
            </Text>
          </View>
        )}

        {!isTrialActive && (
          <View style={styles.expiredBadge}>
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text style={styles.expiredText}>
              3 günlük deneme süresi doldu
            </Text>
          </View>
        )}

        <Pressable
          style={styles.upgradeButton}
          onPress={handleUpgrade}
        >
          <Ionicons name="star" size={20} color="#fff" />
          <Text style={styles.upgradeButtonText}>Premium'a Geç</Text>
        </Pressable>

        <Text style={styles.note}>
          Ekranı görüntüleyebilirsiniz ancak kullanmak için Premium gereklidir.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#1e293b',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#1e3a8a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  trialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  trialText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  expiredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  expiredText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  note: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});

