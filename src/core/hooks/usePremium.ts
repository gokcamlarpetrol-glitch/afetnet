/**
 * PREMIUM HOOK
 * Access premium status and offerings
 */

import { usePremiumStore } from '../stores/premiumStore';
import { premiumService } from '../services/PremiumService';

export function usePremium() {
  const isPremium = usePremiumStore(state => state.isPremium);
  const isLoading = usePremiumStore(state => state.isLoading);

  const purchasePackage = async (packageId: string) => {
    return premiumService.purchasePackage(packageId);
  };

  const restorePurchases = async () => {
    return premiumService.restorePurchases();
  };

  return {
    isPremium,
    isLoading,
    purchasePackage,
    restorePurchases,
  };
}

