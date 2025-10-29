// PREMIUM HOOK WITH REVENUECAT INTEGRATION
// Custom hook for managing premium status
import { useState, useEffect, useCallback } from 'react';
import {
  hasPremiumEntitlement,
  getCurrentCustomerInfo,
  fetchCustomerInfo,
  Purchases,
  CustomerInfo,
} from '../../lib/revenuecat';
import { logger } from '../../utils/productionLogger';

interface PremiumStatus {
  isPremium: boolean;
  isLoading: boolean;
  error: string | null;
  productId: string | null;
  expiresAt: Date | null;
}

/**
 * Custom hook to manage premium status
 * Automatically updates when subscription status changes
 */
export function usePremium(): PremiumStatus & {
  refresh: () => Promise<void>;
} {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  const updatePremiumStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const customerInfo = await fetchCustomerInfo();
      
      if (!customerInfo) {
        logger.warn('⚠️ Could not fetch customer info');
        setIsPremium(false);
        setIsLoading(false);
        return;
      }

      const hasPremium = hasPremiumEntitlement(customerInfo);
      setIsPremium(hasPremium);

      if (hasPremium) {
        const premium = customerInfo.entitlements.active['Premium'];
        setProductId(premium?.productIdentifier || null);
        setExpiresAt(premium?.expirationDate ? new Date(premium.expirationDate) : null);
        
        logger.info('✅ Premium status updated:', {
          isActive: hasPremium,
          productId,
          expiresAt: premium?.expirationDate,
        });
      } else {
        setProductId(null);
        setExpiresAt(null);
        logger.info('ℹ️ User does not have premium');
      }
    } catch (err: any) {
      logger.error('❌ Failed to update premium status:', err);
      setError(err.message || 'Failed to check premium status');
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  // Initial load
  useEffect(() => {
    updatePremiumStatus();

    // Set up listener for real-time updates
    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      logger.info('📊 Customer info update received');
      updatePremiumStatus();
    });

    return () => {
      // Listener cleanup is handled automatically by react-native-purchases
      if (typeof listener === 'object' && listener && 'remove' in listener) {
        (listener as any).remove();
      }
    };
  }, [updatePremiumStatus]);

  return {
    isPremium,
    isLoading,
    error,
    productId,
    expiresAt,
    refresh: updatePremiumStatus,
  };
}

/**
 * Check if a specific feature requires premium
 * Returns true if feature gate should pass, false if blocked
 */
export function usePremiumGate(featureName: string): {
  hasAccess: boolean;
  isPremium: boolean;
  isLoading: boolean;
} {
  const { isPremium, isLoading } = usePremium();

  // In a real app, you might have feature-specific gating logic here
  // For now, we simply check if user has premium
  const hasAccess = isPremium;

  return {
    hasAccess,
    isPremium,
    isLoading,
  };
}

