import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from 'expo-crypto';
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type FamilyMember = {
  id: string;
  name: string;
  emoji?: string;
  status: "ok" | "need" | "unknown";
  lastSeen?: number;
  // Yeni alanlar
  afnId?: string; // Benzersiz AFN-ID (örn: AFN-1A2B3C4D)
  phone?: string;
  email?: string;
  bloodType?: string; // Kan grubu
  allergies?: string; // Alerjiler
  medications?: string; // İlaçlar
  emergencyContact?: string; // Acil durum kişisi
  address?: string;
  notes?: string;
  location?: {
    lat: number;
    lon: number;
    timestamp: number;
    accuracy?: number;
  };
  isVerified: boolean; // QR veya ID ile doğrulandı mı
  addedAt: number; // Eklenme zamanı
  connectionMethod: 'qr' | 'id' | 'manual'; // Nasıl eklendi
  lastContact?: number; // Son iletişim zamanı
};

type State = {
  list: FamilyMember[];
  myAfnId: string; // Kullanıcının kendi AFN-ID'si
  
  // Basic actions
  add(m: Omit<FamilyMember, "id">): void;
  update(id: string, patch: Partial<FamilyMember>): void;
  remove(id: string): void;
  clear(): void;
  
  // Advanced actions
  addByAfnId(afnId: string, name: string): Promise<{ success: boolean; member?: FamilyMember; error?: string }>;
  addByQR(qrData: string): Promise<{ success: boolean; member?: FamilyMember; error?: string }>;
  verifyMember(id: string): void;
  updateLocation(id: string, lat: number, lon: number, accuracy?: number): void;
  getMemberByAfnId(afnId: string): FamilyMember | undefined;
  getOnlineMembers(): FamilyMember[];
  getNeedHelpMembers(): FamilyMember[];
  generateMyAfnId(): string;
  exportMemberQR(id: string): string;
  importMemberFromQR(qrData: string): { success: boolean; member?: FamilyMember; error?: string };
};

// AFN-ID generator (örn: AFN-1A2B3C4D)
function generateAfnId(): string {
  const randomHex = Crypto.randomUUID().split('-')[0].toUpperCase();
  return `AFN-${randomHex}`;
}

export const useFamily = create<State>()(
  persist(
    (set, get) => ({
      list: [],
      myAfnId: '',

      add: (m) =>
        set((s) => ({
          list: [
            {
              id: Crypto.randomUUID(),
              ...m,
              addedAt: Date.now(),
              isVerified: m.isVerified ?? false,
              connectionMethod: m.connectionMethod || 'manual',
            },
            ...s.list
          ],
        })),

      update: (id, patch) =>
        set((s) => ({
          list: s.list.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),

      remove: (id) =>
        set((s) => ({ list: s.list.filter((x) => x.id !== id) })),

      clear: () => set({ list: [] }),

      // AFN-ID ile ekleme
      addByAfnId: async (afnId: string, name: string) => {
        try {
          // AFN-ID formatını kontrol et
          if (!afnId.startsWith('AFN-') || afnId.length < 12) {
            return { success: false, error: 'Geçersiz AFN-ID formatı' };
          }

          // Zaten ekli mi kontrol et
          const existing = get().list.find(m => m.afnId === afnId);
          if (existing) {
            return { success: false, error: 'Bu kişi zaten ekli' };
          }

          const newMember: FamilyMember = {
            id: Crypto.randomUUID(),
            name,
            afnId,
            status: 'unknown',
            isVerified: true,
            addedAt: Date.now(),
            connectionMethod: 'id',
            lastSeen: Date.now(),
          };

          set((s) => ({ list: [newMember, ...s.list] }));
          return { success: true, member: newMember };
        } catch (error: Error | unknown) {
          return { success: false, error: (error as any)?.message || 'Unknown error' };
        }
      },

      // QR ile ekleme
      addByQR: async (qrData: string) => {
        try {
          const result = get().importMemberFromQR(qrData);
          if (result.success && result.member) {
            return { success: true, member: result.member };
          }
          return { success: false, error: result.error };
        } catch (error: Error | unknown) {
          return { success: false, error: (error as any)?.message || 'Unknown error' };
        }
      },

      verifyMember: (id) =>
        set((s) => ({
          list: s.list.map((x) =>
            x.id === id ? { ...x, isVerified: true } : x
          ),
        })),

      updateLocation: (id, lat, lon, accuracy) =>
        set((s) => ({
          list: s.list.map((x) =>
            x.id === id
              ? {
                  ...x,
                  location: { lat, lon, timestamp: Date.now(), accuracy },
                  lastSeen: Date.now(),
                }
              : x
          ),
        })),

      getMemberByAfnId: (afnId: string) => {
        return get().list.find((m) => m.afnId === afnId);
      },

      getOnlineMembers: () => {
        const now = Date.now();
        return get().list.filter(
          (m) => m.lastSeen && now - m.lastSeen < 300000 // 5 dakika içinde
        );
      },

      getNeedHelpMembers: () => {
        return get().list.filter((m) => m.status === 'need');
      },

      generateMyAfnId: () => {
        const existing = get().myAfnId;
        if (existing) return existing;
        
        const newId = generateAfnId();
        set({ myAfnId: newId });
        return newId;
      },

      exportMemberQR: (id: string) => {
        const member = get().list.find((m) => m.id === id);
        if (!member) return '';

        const qrData = {
          type: 'AFETNET_MEMBER',
          version: 1,
          afnId: member.afnId || generateAfnId(),
          name: member.name,
          emoji: member.emoji,
          phone: member.phone,
          email: member.email,
          bloodType: member.bloodType,
          allergies: member.allergies,
          medications: member.medications,
          emergencyContact: member.emergencyContact,
          timestamp: Date.now(),
        };

        return JSON.stringify(qrData);
      },

      importMemberFromQR: (qrData: string) => {
        try {
          const data = JSON.parse(qrData);
          
          if (data.type !== 'AFETNET_MEMBER') {
            return { success: false, error: 'Geçersiz QR kodu' };
          }

          // Zaten ekli mi kontrol et
          if (data.afnId) {
            const existing = get().list.find(m => m.afnId === data.afnId);
            if (existing) {
              return { success: false, error: 'Bu kişi zaten ekli' };
            }
          }

          const newMember: FamilyMember = {
            id: Crypto.randomUUID(),
            name: data.name,
            emoji: data.emoji,
            afnId: data.afnId,
            phone: data.phone,
            email: data.email,
            bloodType: data.bloodType,
            allergies: data.allergies,
            medications: data.medications,
            emergencyContact: data.emergencyContact,
            status: 'unknown',
            isVerified: true,
            addedAt: Date.now(),
            connectionMethod: 'qr',
            lastSeen: Date.now(),
          };

          set((s) => ({ list: [newMember, ...s.list] }));
          return { success: true, member: newMember };
        } catch (error: Error | unknown) {
          return { success: false, error: 'QR kodu okunamadı' };
        }
      },
    }),
    {
      name: "afn/family/v2",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
    }
  )
);
