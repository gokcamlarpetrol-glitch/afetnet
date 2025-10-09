import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface AccessibilityState {
  highContrast: boolean;
  bigText: boolean;
  hapticsStrong: boolean;
}

interface AccessibilityActions {
  setHighContrast: (enabled: boolean) => void;
  setBigText: (enabled: boolean) => void;
  setHapticsStrong: (enabled: boolean) => void;
  applyAccessibilityProfile: (profile: Partial<AccessibilityState>) => void;
  reset: () => void;
}

const defaultState: AccessibilityState = {
  highContrast: false,
  bigText: false,
  hapticsStrong: false
};

export const useAccessibility = create<AccessibilityState & AccessibilityActions>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setHighContrast: (enabled: boolean) => {
        set({ highContrast: enabled });
      },

      setBigText: (enabled: boolean) => {
        set({ bigText: enabled });
      },

      setHapticsStrong: (enabled: boolean) => {
        set({ hapticsStrong: enabled });
      },

      applyAccessibilityProfile: (profile: Partial<AccessibilityState>) => {
        set((state) => ({ ...state, ...profile }));
      },

      reset: () => {
        set(defaultState);
      }
    }),
    {
      name: 'afn/accessibility/v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persistedState: any, version: number) => {
        return { ...defaultState, ...persistedState };
      }
    }
  )
);

// Global theme helper
export function getAccessibilityTheme() {
  const { highContrast, bigText } = useAccessibility.getState();
  
  return {
    colors: highContrast ? {
      background: '#000000',
      surface: '#1a1a1a',
      text: '#ffffff',
      textSecondary: '#cccccc',
      accent: '#ffff00',
      error: '#ff0000',
      success: '#00ff00',
      warning: '#ffff00',
      border: '#ffffff'
    } : {
      background: '#0f172a',
      surface: '#111827',
      text: '#ffffff',
      textSecondary: '#94a3b8',
      accent: '#3b82f6',
      error: '#ef4444',
      success: '#10b981',
      warning: '#f59e0b',
      border: '#374151'
    },
    typography: {
      fontSize: bigText ? {
        small: 14,
        medium: 18,
        large: 22,
        xlarge: 26,
        xxlarge: 30
      } : {
        small: 12,
        medium: 14,
        large: 16,
        xlarge: 18,
        xxlarge: 20
      },
      fontWeight: bigText ? {
        normal: '600' as const,
        bold: '800' as const
      } : {
        normal: '400' as const,
        bold: '700' as const
      }
    }
  };
}
