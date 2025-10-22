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
        timestamp: Date.now(),
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
        isLoading: false,
      });
      
      logger.info('Premium status checked:', { 
        isPremium: finalStatus, 
        iapStatus, 
        localStatus, 
      });
      
    } catch (error) {
      logger.error('Failed to check premium status:', error);
      set({ 
        isLoading: false, 
        error: 'Premium durumu kontrol edilemedi', 
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
        error: 'Satın alma işlemi başarısız oldu', 
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
        error: 'Satın alımlar geri yüklenemedi', 
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
        error: null,
      });
      logger.info('Premium store reset');
    } catch (error) {
      logger.error('Failed to reset premium store:', error);
    }
  },
}));

// Premium feature access helpers - STRICT PREMIUM GATING
export const usePremiumFeatures = () => {
  const { isPremium, currentPlan } = usePremium();
  
  const canUseFeature = (feature: string): boolean => {
    // FREE FEATURES - Only earthquake notifications are free
    const freeFeatures = [
      'earthquake_notifications',  // Only earthquake notifications are free
      'basic_deprem_takip',        // Basic earthquake tracking
      'deprem_verisi',             // Earthquake data viewing
    ];
    
    // If it's a free feature, allow access
    if (freeFeatures.includes(feature)) {
      return true;
    }
    
    // ALL OTHER FEATURES REQUIRE PREMIUM
    if (!isPremium) {
      return false;
    }
    
    // Premium features
    switch (feature) {
    case 'family_tracking':
    case 'family_messaging':
    case 'family_map':
    case 'mesh_network':
    case 'offline_maps':
    case 'advanced_maps':
    case 'route_planning':
    case 'p2p_messaging':
    case 'rescue_tools':
    case 'sar_mode':
    case 'triage_system':
    case 'health_monitoring':
    case 'self_check':
    case 'ice_data':
    case 'security_features':
    case 'encryption':
    case 'biometric_auth':
    case 'backup_restore':
    case 'data_export':
    case 'voice_commands':
    case 'audio_beacon':
    case 'sonar_system':
    case 'pdr_tracking':
    case 'sensor_fusion':
    case 'ai_features':
    case 'smart_analytics':
    case 'drone_control':
    case 'logistics_management':
    case 'training_simulations':
    case 'advanced_reporting':
    case 'accessibility_features':
    case 'haptic_navigation':
    case 'comprehensive_features':
    case 'premium_settings':
    case 'unlimited_storage':
    case 'priority_support':
      return isPremium;
    default:
      // All unknown features require premium
      return isPremium;
    }
  };
  
  const getRemainingUsage = (feature: string): { used: number; limit: number; remaining: number } => {
    if (isPremium) {
      return { used: 0, limit: -1, remaining: -1 }; // Unlimited for premium
    }
    
    // FREE TIER - Only earthquake notifications are unlimited
    if (feature === 'earthquake_notifications') {
      return { used: 0, limit: -1, remaining: -1 }; // Unlimited earthquake notifications
    }
    
    // All other features are blocked for free users
    return { used: 0, limit: 0, remaining: 0 };
  };
  
  const getFeatureDescription = (feature: string): string => {
    if (isPremium) {
      return 'Premium özellik aktif';
    }
    
    if (feature === 'earthquake_notifications') {
      return 'Ücretsiz - Deprem bildirimleri';
    }
    
    return 'Premium gerekli - Satın alın';
  };
  
  return {
    isPremium,
    currentPlan,
    canUseFeature,
    getRemainingUsage,
    getFeatureDescription,
  };
};

export default usePremium;