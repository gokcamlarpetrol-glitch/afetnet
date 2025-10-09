import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FamilyMember = { id:string; name:string; state?:string; lat?:number; lon?:number };

interface FamilyState {
  members: FamilyMember[];
  addMember: (member: Omit<FamilyMember, 'id'>) => void;
  updateMember: (id: string, updates: Partial<FamilyMember>) => void;
  removeMember: (id: string) => void;
}

export const useFamily = create<FamilyState>()(
  persist(
    (set, get) => ({
      members: [],
      addMember: (member) => {
        const newMember: FamilyMember = {
          ...member,
          id: `member-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
        set((state) => ({
          members: [...state.members, newMember],
        }));
      },
      updateMember: (id, updates) => {
        set((state) => ({
          members: state.members.map((member) =>
            member.id === id ? { ...member, ...updates } : member
          ),
        }));
      },
      removeMember: (id) => {
        set((state) => ({
          members: state.members.filter((member) => member.id !== id),
        }));
      },
    }),
    {
      name: 'family-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
