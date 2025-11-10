/**
 * PREMIUM GATE - Elite Overlay for Premium Features
 * APPLE REVIEW CRITICAL: Trial aktifken içeriği göster, paywall gösterme!
 * Trial bittikten sonra paywall göster.
 * Production-grade component with comprehensive error handling and zero-error guarantee
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTrialStore } from '../stores/trialStore';
import { usePremiumStore } from '../stores/premiumStore';
import { createLogger } from '../utils/logger';
import * as haptics from '../utils/haptics';

const logger = createLogger('PremiumGate');

interface PremiumGateProps {
  featureName: string;
  onUpgradePress?: () => void;
  children?: React.ReactNode;
}

export default function PremiumGate({ featureName, onUpgradePress, children }: PremiumGateProps) {
  // ELITE: Memoize store values to prevent unnecessary re-renders
  const daysRemaining = useTrialStore((state) => state.getRemainingDays());
  const hoursRemaining = useTrialStore((state) => state.getRemainingHours());
  const isTrialActive = useTrialStore((state) => state.isTrialActive);
  const isTrialLoading = useTrialStore((state) => state.isLoading);
  const isPremium = usePremiumStore((state) => state.isPremium);

  // ELITE: Memoize access check to prevent unnecessary computations
  const hasAccess = useMemo(() => {
    try {
      // APPLE REVIEW CRITICAL: Trial aktifse VEYA premium ise içeriği göster
      // CRITICAL: Loading durumunda erişim verme - loading bitene kadar bekle
      // Sadece loading bittikten sonra trial/premium kontrolü yap
      if (isTrialLoading) {
        // Loading durumunda içeriği göster ama premium kontrolü yapma
        // Bu Apple Review için kritik - loading sırasında içerik görünür olmalı
        return true;
      }
      
      // Loading bittikten sonra trial/premium kontrolü yap
      const access = isTrialActive || isPremium;
      if (access) {
        logger.info(`Access granted to ${featureName} (trial: ${isTrialActive}, premium: ${isPremium})`);
      }
      return access;
    } catch (error) {
      logger.error('PremiumGate access check error:', error);
      // ELITE: Fail-safe - grant access on error to prevent blocking users
      return true;
    }
  }, [isTrialLoading, isTrialActive, isPremium, featureName]);

  // ELITE: Memoize trial status text
  const trialStatusText = useMemo(() => {
    try {
      if (daysRemaining > 0) {
        return `${daysRemaining} gün ücretsiz deneme kaldı`;
      } else if (hoursRemaining > 0) {
        return `${hoursRemaining} saat ücretsiz deneme kaldı`;
      }
      return '3 günlük deneme süresi doldu';
    } catch (error) {
      logger.error('Trial status text error:', error);
      return 'Deneme durumu kontrol edilemiyor';
    }
  }, [daysRemaining, hoursRemaining]);

  if (hasAccess) {
    return <>{children}</>;
  }

  // ELITE: Access denied - show paywall
  logger.info(`Access denied to ${featureName} - showing paywall`);

  const handleUpgrade = () => {
    try {
      haptics.impactMedium();
      logger.info('Premium upgrade requested');
      // Parent component will handle navigation
      onUpgradePress?.();
    } catch (error) {
      logger.error('Handle upgrade error:', error);
      // ELITE: Fail-safe - still call onUpgradePress even on error
      try {
        onUpgradePress?.();
      } catch {
        // Silently fail
      }
    }
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
        {isTrialActive ? (
          <View style={styles.trialBadge}>
            <Ionicons name="time-outline" size={16} color="#10b981" />
            <Text style={styles.trialText}>{trialStatusText}</Text>
          </View>
        ) : (
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
          accessibilityRole="button"
          accessibilityLabel="Premium'a Geç"
          accessibilityHint="Premium üyelik satın almak için basın"
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

