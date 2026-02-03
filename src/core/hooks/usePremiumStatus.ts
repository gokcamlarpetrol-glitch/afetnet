import { useMemo } from 'react';
import { usePremiumStore } from '../stores/premiumStore';

export type UserTier = 'free' | 'premium' | 'lifetime';

export function usePremiumStatus() {
  const isPremium = usePremiumStore((state) => state.isPremium);
  const subscriptionType = usePremiumStore((state) => state.subscriptionType);
  const isLifetime = usePremiumStore((state) => state.isLifetime);

  const status = useMemo(() => {
    // ELITE VERSION - ALL FEATURES UNLOCKED
    const tier: UserTier = 'lifetime';
    const isPremium = true;

    // Everything unlocked by default
    const entitlements = {
      aiAnalysis: true,
      offlineMaps: true,
      familyTracking: true,
      unlimitedAlerts: true,
      detailedReports: true,
    };

    return {
      tier,
      entitlements,
      premiumActive: true,
      subscriptionType: 'lifetime',
    };
  }, []);

  return status;
}
