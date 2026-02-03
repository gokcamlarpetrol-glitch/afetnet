/**
 * RESCUE STORE
 * State management for rescue team mode and trapped user beacon
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TrappedUser {
  id: string;
  name: string;
  status: 'trapped' | 'injured' | 'safe';
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  rssi?: number; // Signal strength
  distance?: number; // Estimated distance in meters
  lastSeen: number; // Timestamp
  battery?: number; // Battery percentage
  message?: string; // Optional SOS message
}

export interface RescueState {
  // Rescue team mode
  isRescueTeamMode: boolean;
  trappedUsers: TrappedUser[];

  // Beacon state
  isBeaconActive: boolean;
  beaconStartTime: number | null;
  beaconInterval: number; // seconds

  // Actions
  enableRescueTeamMode: () => void;
  disableRescueTeamMode: () => void;
  toggleRescueTeamMode: () => void;

  addTrappedUser: (user: TrappedUser) => void;
  updateTrappedUser: (id: string, updates: Partial<TrappedUser>) => void;
  removeTrappedUser: (id: string) => void;
  clearTrappedUsers: () => void;

  startBeacon: () => void;
  stopBeacon: () => void;
  setBeaconInterval: (seconds: number) => void;
}

export const useRescueStore = create<RescueState>()(
  persist(
    (set, get) => {
      // Elite: Clean expired trapped users on load
      const cleanupExpiredUsers = (users: TrappedUser[]): TrappedUser[] => {
        const now = Date.now();
        const expiryTime = 30 * 60 * 1000; // 30 minutes
        return users.filter((user) => now - user.lastSeen < expiryTime);
      };

      return {
        // Initial state
        isRescueTeamMode: false,
        trappedUsers: [],
        isBeaconActive: false,
        beaconStartTime: null,
        beaconInterval: 10, // Default: 10 seconds

        // Rescue team mode actions
        enableRescueTeamMode: () => {
          set({ isRescueTeamMode: true });
        },

        disableRescueTeamMode: () => {
          set({ isRescueTeamMode: false, trappedUsers: [] });
        },

        toggleRescueTeamMode: () => {
          const current = get().isRescueTeamMode;
          set({ isRescueTeamMode: !current });
          if (current) {
            set({ trappedUsers: [] });
          }
        },

        // Trapped users management
        addTrappedUser: (user: TrappedUser) => {
          set((state) => {
          // Check if user already exists
            const exists = state.trappedUsers.find((u) => u.id === user.id);
            let updatedUsers: TrappedUser[];
          
            if (exists) {
            // Update existing user
              updatedUsers = state.trappedUsers.map((u) =>
                u.id === user.id ? { ...u, ...user, lastSeen: Date.now() } : u,
              );
            } else {
            // Add new user
              updatedUsers = [...state.trappedUsers, { ...user, lastSeen: Date.now() }];
            }
          
            // Elite: Clean expired users periodically
            const cleanedUsers = cleanupExpiredUsers(updatedUsers);
          
            return {
              trappedUsers: cleanedUsers,
            };
          });
        },

        updateTrappedUser: (id: string, updates: Partial<TrappedUser>) => {
          set((state) => ({
            trappedUsers: state.trappedUsers.map((user) =>
              user.id === id ? { ...user, ...updates, lastSeen: Date.now() } : user,
            ),
          }));
        },

        removeTrappedUser: (id: string) => {
          set((state) => ({
            trappedUsers: state.trappedUsers.filter((user) => user.id !== id),
          }));
        },

        clearTrappedUsers: () => {
          set({ trappedUsers: [] });
        },

        // Beacon actions
        startBeacon: () => {
          set({ isBeaconActive: true, beaconStartTime: Date.now() });
        },

        stopBeacon: () => {
          set({ isBeaconActive: false, beaconStartTime: null });
        },

        setBeaconInterval: (seconds: number) => {
          set({ beaconInterval: seconds });
        },
      };
    },
    {
      name: '@afetnet:rescue',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isRescueTeamMode: state.isRescueTeamMode,
        beaconInterval: state.beaconInterval,
        // Elite: Persist trapped users for offline access (filter expired on load)
        trappedUsers: state.trappedUsers.filter((user) => {
          const now = Date.now();
          const expiryTime = 30 * 60 * 1000; // 30 minutes (longer for offline)
          return now - user.lastSeen < expiryTime;
        }),
      }),
    },
  ),
);


