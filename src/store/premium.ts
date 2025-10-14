// PREMIUM STORE - ACTIVE IAP IMPLEMENTATION
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { iapService } from '../services/iapService';
import { logger } from '../utils/productionLogger';

export interface PremiumPlan {
  id: string;
  title: string;
  price: number;
  currency: string;
  description: string;
}

export interface PremiumState {
  isPremium: boolean;
  currentPlan: PremiumPlan | null;
  subscriptionEndDate: Date | null;
  isLoading: boolean;
  error: string | null;
}

export interface PremiumActions {
  // Premium status
  setPremium: (isPremium: boolean, plan?: PremiumPlan, endDate?: Date) => void;
  checkPremiumStatus: () => Promise<void>;
  
  // Purchase actions
  purchasePlan: (planId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  
  // Utility
  clearError: () => void;
  reset: () => void;
}

const PREMIUM_STORAGE_KEY = 'afetnet_premium_status';

export const usePremium = create<PremiumState & PremiumActions>((set, get) => ({
  // Initial state
  isPremium: false,
  currentPlan: null,
  subscriptionEndDate: null,
  isLoading: false,
  error: null,

  // Set premium status
  setPremium: async (isPremium: boolean, plan?: PremiumPlan, endDate?: Date) => {
    try {
      set({ isPremium, currentPlan: plan || null, subscriptionEndDate: endDate || null });
      
      // Save to storage
      await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify({
        isPremium,
        plan,
        endDate: endDate?.toISOString(),
        timestamp: Date.now()
      }));
      
      logger.info('Premium status updated:', { isPremium, plan: plan?.id });
    } catch (error) {
      logger.error('Failed to save premium status:', error);
    }
  },

  // Check premium status
  checkPremiumStatus: async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Check IAP service status
      const iapStatus = await iapService.checkPremiumStatus();
      
      // Check local storage
      const stored = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
      let localStatus = false;
      let localPlan: PremiumPlan | null = null;
      let localEndDate: Date | null = null;
      
      if (stored) {
        const data = JSON.parse(stored);
        localStatus = data.isPremium;
        localPlan = data.plan;
        localEndDate = data.endDate ? new Date(data.endDate) : null;
        
        // Check if subscription is still valid
        if (localEndDate && localEndDate < new Date()) {
          localStatus = false;
          localPlan = null;
          localEndDate = null;
        }
      }
      
      // Use the most recent status
      const finalStatus = iapStatus || localStatus;
      
      set({
        isPremium: finalStatus,
        currentPlan: localPlan,
        subscriptionEndDate: localEndDate,
        isLoading: false
      });
      
      logger.info('Premium status checked:', { 
        isPremium: finalStatus, 
        iapStatus, 
        localStatus 
      });
      
    } catch (error) {
      logger.error('Failed to check premium status:', error);
      set({ 
        isLoading: false, 
        error: 'Premium durumu kontrol edilemedi' 
      });
    }
  },

  // Purchase plan
  purchasePlan: async (planId: string) => {
    try {
      set({ isLoading: true, error: null });
      
      logger.info('Starting purchase for plan:', planId);
      
      // Start purchase through IAP service
      const success = await iapService.purchasePlan(planId as any);
      
      if (success) {
        logger.info('Purchase initiated successfully for plan:', planId);
        // The actual status update will happen through purchase listeners
        // in the IAP service
      }
      
      set({ isLoading: false });
      return success;
      
    } catch (error) {
      logger.error('Purchase failed:', error);
      set({ 
        isLoading: false, 
        error: 'Satın alma işlemi başarısız oldu' 
      });
      return false;
    }
  },

  // Restore purchases
  restorePurchases: async () => {
    try {
      set({ isLoading: true, error: null });
      
      logger.info('Restoring purchases...');
      
      const success = await iapService.restorePurchases();
      
      if (success) {
        // Re-check premium status after restore
        await get().checkPremiumStatus();
      }
      
      set({ isLoading: false });
      return success;
      
    } catch (error) {
      logger.error('Restore failed:', error);
      set({ 
        isLoading: false, 
        error: 'Satın alımlar geri yüklenemedi' 
      });
      return false;
    }
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Reset
  reset: async () => {
    try {
      await AsyncStorage.removeItem(PREMIUM_STORAGE_KEY);
      set({
        isPremium: false,
        currentPlan: null,
        subscriptionEndDate: null,
        isLoading: false,
        error: null
      });
      logger.info('Premium store reset');
    } catch (error) {
      logger.error('Failed to reset premium store:', error);
    }
  }
}));

// Premium feature access helpers
export const usePremiumFeatures = () => {
  const { isPremium, currentPlan } = usePremium();
  
  const canUseFeature = (feature: string): boolean => {
    if (!isPremium) return false;
    
    // Add feature-specific logic here
    switch (feature) {
      case 'unlimited_family':
        return isPremium;
      case 'advanced_maps':
        return isPremium;
      case 'priority_notifications':
        return isPremium;
      case 'enhanced_security':
        return isPremium;
      default:
        return isPremium;
    }
  };
  
  const getRemainingUsage = (feature: string): { used: number; limit: number; remaining: number } => {
    if (isPremium) {
      return { used: 0, limit: -1, remaining: -1 }; // Unlimited
    }
    
    // Free tier limits
    switch (feature) {
      case 'family_members':
        return { used: 3, limit: 5, remaining: 2 };
      case 'offline_maps':
        return { used: 1, limit: 2, remaining: 1 };
      default:
        return { used: 0, limit: 3, remaining: 3 };
    }
  };
  
  return {
    isPremium,
    currentPlan,
    canUseFeature,
    getRemainingUsage
  };
};

export default usePremium;