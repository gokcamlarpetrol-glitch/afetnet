/**
 * PREMIUM STORE - IAP State
 * Simple premium status management
 */

import { create } from 'zustand';

interface PremiumState {
  isPremium: boolean;
  subscriptionType: 'monthly' | 'yearly' | null;
  expiresAt: number | null;
  isLoading: boolean;
}

interface PremiumActions {
  setPremium: (isPremium: boolean, subscriptionType?: 'monthly' | 'yearly', expiresAt?: number) => void;
  setLoading: (isLoading: boolean) => void;
  checkExpiration: () => boolean;
  clear: () => void;
}

const initialState: PremiumState = {
  isPremium: false,
  subscriptionType: null,
  expiresAt: null,
  isLoading: false,
};

export const usePremiumStore = create<PremiumState & PremiumActions>((set, get) => ({
  ...initialState,
  
  setPremium: (isPremium, subscriptionType, expiresAt) => {
    set({ 
      isPremium, 
      subscriptionType: subscriptionType || null,
      expiresAt: expiresAt || null,
      isLoading: false,
    });
  },
  
  setLoading: (isLoading) => set({ isLoading }),
  
  checkExpiration: () => {
    const { isPremium, expiresAt } = get();
    if (isPremium && expiresAt && Date.now() > expiresAt) {
      set({ isPremium: false, subscriptionType: null, expiresAt: null });
      return false;
    }
    return isPremium;
  },
  
  clear: () => set(initialState),
}));

