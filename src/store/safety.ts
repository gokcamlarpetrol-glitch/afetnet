import { create } from 'zustand';
import { logger } from '../utils/productionLogger';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scrypt } from 'scrypt-js';

export type SafetyState = {
  pinEnabled: boolean;
  pinHash?: string; // store scrypt hash, not raw
  requireFor: {
    sos: boolean;
    showGroupKey: boolean;
    exportBlackBox: boolean;
  };
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  toggleRequire: (k: keyof SafetyState['requireFor'], v: boolean) => void;
  disablePin: () => void;
};

export const useSafety = create<SafetyState>()(
  persist(
    (set, get) => ({
      pinEnabled: false,
      pinHash: undefined,
      requireFor: {
        sos: false,
        showGroupKey: true,
        exportBlackBox: true,
      },

      setPin: async (pin: string) => {
        try {
          // Use scrypt with small parameters for mobile
          const salt = new Uint8Array(16);
          crypto.getRandomValues(salt);
          
          const hash = await scrypt(
            new TextEncoder().encode(pin),
            salt,
            16384, // N - CPU/memory cost parameter (reduced for mobile)
            8,     // r - block size
            1,     // p - parallelization parameter
            32     // dkLen - derived key length
          );
          
          // Combine salt and hash for storage
          const combined = new Uint8Array(salt.length + hash.length);
          combined.set(salt, 0);
          combined.set(hash, salt.length);
          
          const pinHash = Array.from(combined)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          
          set({
            pinEnabled: true,
            pinHash,
            requireFor: {
              sos: true,
              showGroupKey: true,
              exportBlackBox: true,
            },
          });
        } catch (error) {
          logger.error('Failed to set PIN:', error);
          throw new Error('PIN ayarlanamadı');
        }
      },

      verifyPin: async (pin: string): Promise<boolean> => {
        const { pinHash } = get();
        if (!pinHash) return false;

        try {
          // Extract salt and stored hash
          const combined = new Uint8Array(
            pinHash.match(/.{2}/g)!.map(hex => parseInt(hex, 16))
          );
          
          const salt = combined.subarray(0, 16);
          const storedHash = combined.subarray(16);
          
          // Compute hash with provided PIN
          const hash = await scrypt(
            new TextEncoder().encode(pin),
            salt,
            16384, // Same parameters as setPin
            8,
            1,
            32
          );
          
          // Compare hashes
          return hash.every((byte, index) => byte === storedHash[index]);
        } catch (error) {
          logger.error('Failed to verify PIN:', error);
          return false;
        }
      },

      toggleRequire: (key: keyof SafetyState['requireFor'], value: boolean) => {
        set((state) => ({
          requireFor: {
            ...state.requireFor,
            [key]: value,
          },
        }));
      },

      disablePin: () => {
        set({
          pinEnabled: false,
          pinHash: undefined,
          requireFor: {
            sos: false,
            showGroupKey: false,
            exportBlackBox: false,
          },
        });
      },
    }),
    {
      name: 'afn/safety/v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Helper function for UI components
export async function requestPinIfNeeded(action: keyof SafetyState['requireFor']): Promise<boolean> {
  const { pinEnabled, requireFor, verifyPin } = useSafety.getState();
  
  if (!pinEnabled || !requireFor[action]) {
    return true; // PIN not required
  }

  // This would typically show a PIN input modal
  // For now, we'll simulate the PIN verification
  // In a real implementation, this would be handled by a modal component
  logger.debug(`PIN required for action: ${action}`);
  
  // Return true for now - in real implementation, this would wait for user input
  return true;
}
