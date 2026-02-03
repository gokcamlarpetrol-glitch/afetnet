/**
 * PREMIUM HOOK - ELITE VERSION
 * All features unlocked - Paid App Model
 */

import { usePremiumStore } from '../stores/premiumStore';

export function usePremium() {
  const isPremium = usePremiumStore(state => state.isPremium);
  const isLoading = usePremiumStore(state => state.isLoading);

  // ELITE: All features unlocked - no actual purchases needed
  const purchasePackage = async (_packageId: string) => {
    // No-op - app is paid, all features are unlocked
    return true;
  };

  const restorePurchases = async () => {
    // No-op - app is paid, all features are unlocked
    return true;
  };

  return {
    isPremium: true, // Always premium in paid app model
    isLoading: false,
    purchasePackage,
    restorePurchases,
  };
}
