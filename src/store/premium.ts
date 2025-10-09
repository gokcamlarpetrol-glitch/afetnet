import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PremiumPlan {
  id: 'monthly' | 'yearly' | 'lifetime';
  name: string;
  price: number;
  priceFormatted: string;
  originalPrice?: number;
  discount?: number;
  features: string[];
  popular?: boolean;
  period: string;
  description: string;
}

export interface PremiumState {
  // Subscription status
  isPremium: boolean;
  currentPlan: PremiumPlan['id'] | null;
  subscriptionEndDate: number | null; // timestamp
  purchaseDate: number | null; // timestamp
  
  // Feature access
  unlimitedSOS: boolean;
  unlimitedMessages: boolean;
  unlimitedFamilyMembers: boolean;
  unlimitedOfflineMaps: boolean;
  advancedSurvivorDetection: boolean;
  prioritySupport: boolean;
  customThemes: boolean;
  dataExport: boolean;
  
  // Free tier limits
  freeSOSLimit: number;
  freeMessagesLimit: number;
  freeFamilyLimit: number;
  freeMapCacheLimit: number; // MB
  
  // Usage tracking
  usedSOS: number;
  usedMessages: number;
  usedFamilyMembers: number;
  usedMapCache: number; // MB
  
  // Actions
  setPremium: (isPremium: boolean, plan: PremiumPlan['id']) => void;
  checkSubscription: () => void;
  updateUsage: (feature: 'sos' | 'messages' | 'family' | 'mapcache', amount: number) => void;
  canUseFeature: (feature: 'sos' | 'messages' | 'family' | 'mapcache') => boolean;
  getRemainingUsage: (feature: 'sos' | 'messages' | 'family' | 'mapcache') => number;
  resetUsage: () => void;
}

// Premium plans configuration
export const PREMIUM_PLANS: PremiumPlan[] = [
  {
    id: 'monthly',
    name: 'Aylık Premium',
    price: 49.99,
    priceFormatted: '49,99 ₺',
    period: 'ay',
    description: 'Tüm premium özellikler aylık erişim',
    popular: true, // Aylık planı önerilen yap
    features: [
      'Sınırsız SOS gönderimi',
      'Sınırsız BLE mesajlaşma',
      'Sınırsız aile üyesi',
      'Sınırsız offline harita',
      'Gelişmiş enkaz algılama',
      'Öncelikli destek',
      'Özel temalar',
      'Veri dışa aktarma'
    ]
  },
  {
    id: 'yearly',
    name: 'Yıllık Premium',
    price: 349.99,
    priceFormatted: '349,99 ₺',
    originalPrice: 599.88, // 49.99 * 12
    discount: 42,
    period: 'yıl',
    description: 'En tasarruflu seçenek - yıllık ödeme avantajı!',
    popular: false,
    features: [
      'Sınırsız SOS gönderimi',
      'Sınırsız BLE mesajlaşma', 
      'Sınırsız aile üyesi',
      'Sınırsız offline harita',
      'Gelişmiş enkaz algılama',
      'Öncelikli destek',
      'Özel temalar',
      'Veri dışa aktarma',
      'Yıllık ödeme avantajı',
      'Erken erişim yeni özellikler'
    ]
  },
  {
    id: 'lifetime',
    name: 'Lifetime Premium',
    price: 599.99,
    priceFormatted: '599,99 ₺',
    period: 'yaşam boyu',
    description: 'Bir kez öde, yaşam boyu kullan',
    features: [
      'Sınırsız SOS gönderimi',
      'Sınırsız BLE mesajlaşma',
      'Sınırsız aile üyesi', 
      'Sınırsız offline harita',
      'Gelişmiş enkaz algılama',
      'Öncelikli destek',
      'Özel temalar',
      'Veri dışa aktarma',
      'Yaşam boyu güncelleme',
      'Özel lifetime kullanıcı rozeti',
      'Beta özellikler erken erişim'
    ]
  }
];

export const usePremium = create<PremiumState>()(
  persist(
    (set, get) => ({
      // Initial state
      isPremium: false,
      currentPlan: null,
      subscriptionEndDate: null,
      purchaseDate: null,
      
      // Feature access (all false initially)
      unlimitedSOS: false,
      unlimitedMessages: false,
      unlimitedFamilyMembers: false,
      unlimitedOfflineMaps: false,
      advancedSurvivorDetection: false,
      prioritySupport: false,
      customThemes: false,
      dataExport: false,
      
      // Free tier limits (very restrictive - only earthquake alerts)
      freeSOSLimit: 0, // No SOS for free users
      freeMessagesLimit: 0, // No messaging for free users
      freeFamilyLimit: 0, // No family features for free users
      freeMapCacheLimit: 0, // No offline maps for free users
      
      // Usage tracking
      usedSOS: 0,
      usedMessages: 0,
      usedFamilyMembers: 0,
      usedMapCache: 0,
      
      // Actions
      setPremium: (isPremium: boolean, plan: PremiumPlan['id']) => {
        const now = Date.now();
        let subscriptionEndDate = null;
        
        if (isPremium && plan) {
          switch (plan) {
            case 'monthly':
              subscriptionEndDate = now + (30 * 24 * 60 * 60 * 1000); // 30 days
              break;
            case 'yearly':
              subscriptionEndDate = now + (365 * 24 * 60 * 60 * 1000); // 365 days
              break;
            case 'lifetime':
              subscriptionEndDate = now + (50 * 365 * 24 * 60 * 60 * 1000); // 50 years
              break;
          }
        }
        
        set({
          isPremium,
          currentPlan: plan,
          subscriptionEndDate,
          purchaseDate: isPremium ? now : null,
          unlimitedSOS: isPremium,
          unlimitedMessages: isPremium,
          unlimitedFamilyMembers: isPremium,
          unlimitedOfflineMaps: isPremium,
          advancedSurvivorDetection: isPremium,
          prioritySupport: isPremium,
          customThemes: isPremium,
          dataExport: isPremium,
        });
      },
      
      checkSubscription: () => {
        const state = get();
        if (state.isPremium && state.subscriptionEndDate) {
          const now = Date.now();
          if (now > state.subscriptionEndDate) {
            // Subscription expired
            set({
              isPremium: false,
              currentPlan: null,
              subscriptionEndDate: null,
              unlimitedSOS: false,
              unlimitedMessages: false,
              unlimitedFamilyMembers: false,
              unlimitedOfflineMaps: false,
              advancedSurvivorDetection: false,
              prioritySupport: false,
              customThemes: false,
              dataExport: false,
            });
          }
        }
      },
      
      updateUsage: (feature: 'sos' | 'messages' | 'family' | 'mapcache', amount: number) => {
        const state = get();
        if (state.isPremium) return; // Premium users have unlimited usage
        
        set((prevState) => ({
          ...prevState,
          [`used${feature.charAt(0).toUpperCase() + feature.slice(1)}`]: 
            prevState[`used${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof PremiumState] as number + amount
        }));
      },
      
      canUseFeature: (feature: 'sos' | 'messages' | 'family' | 'mapcache') => {
        const state = get();
        if (state.isPremium) return true;
        
        const used = state[`used${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof PremiumState] as number;
        const limit = state[`free${feature.charAt(0).toUpperCase() + feature.slice(1)}Limit` as keyof PremiumState] as number;
        
        return used < limit;
      },
      
      getRemainingUsage: (feature: 'sos' | 'messages' | 'family' | 'mapcache') => {
        const state = get();
        if (state.isPremium) return Infinity;
        
        const used = state[`used${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof PremiumState] as number;
        const limit = state[`free${feature.charAt(0).toUpperCase() + feature.slice(1)}Limit` as keyof PremiumState] as number;
        
        return Math.max(0, limit - used);
      },
      
      resetUsage: () => {
        set({
          usedSOS: 0,
          usedMessages: 0,
          usedFamilyMembers: 0,
          usedMapCache: 0,
        });
      }
    }),
    {
      name: 'premium-store',
      partialize: (state) => ({
        isPremium: state.isPremium,
        currentPlan: state.currentPlan,
        subscriptionEndDate: state.subscriptionEndDate,
        purchaseDate: state.purchaseDate,
        usedSOS: state.usedSOS,
        usedMessages: state.usedMessages,
        usedFamilyMembers: state.usedFamilyMembers,
        usedMapCache: state.usedMapCache,
      }),
    }
  )
);
