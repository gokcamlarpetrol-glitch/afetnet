import { getErrorMessage } from '../../utils/errorUtils';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PreparednessPlanService } from '../services/PreparednessPlanService';
import { PreparednessPlan, PlanItem, PlanSection } from '../types/ai.types'; // Use centralized types
import { createLogger } from '../../utils/logger';

const logger = createLogger('PreparednessStore');
const planService = new PreparednessPlanService();

interface PreparednessState {
  plan: PreparednessPlan | null;
  loading: boolean;
  error: string | null;

  // Actions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refreshPlan: (params?: any) => Promise<void>;
  toggleItem: (sectionId: string, itemId: string) => Promise<void>;
  resetPlan: () => void;

  // Helpers
  getSectionProgress: (sectionId: string) => number;
  getTotalProgress: () => number;

  // ELITE: Store Plan ID for recovery
  currentPlanId: string | null;
}

export const usePreparednessStore = create<PreparednessState>()(
  persist(
    (set, get) => ({
      plan: null,
      loading: false,
      error: null,
      currentPlanId: null,

      refreshPlan: async (params = {}) => {
        const { plan, currentPlanId } = get();

        // If we have a plan and it's fresh, don't reload unless forced
        // But if we have a currentPlanId and no plan (e.g. after restart), try to load by ID first
        if (!plan && currentPlanId) {
          set({ loading: true, error: null });
          try {
            logger.info('Attempting to reload existing plan by ID:', currentPlanId);
            const existingPlan = await planService.loadPlanById(currentPlanId);
            if (existingPlan) {
              set({ plan: existingPlan, loading: false });
              return;
            }
          } catch (err) {
            logger.warn('Failed to reload plan by ID, will regenerate', err);
          }
        }

        if (plan && plan.sections && plan.sections.length > 0) return;

        set({ loading: true, error: null });

        try {
          // Initialize service if crucial setup needed (usually lightweight)
          await planService.initialize();

          // Generate new plan (Service handles AI vs Rule fallback & Caching)
          const newPlan = await planService.generatePlan({
            familySize: params.familySize || 4,
            locationName: params.locationName || 'İstanbul',
            // ... pass other params from user profile store if available
            ...params,
          });

          set({
            plan: newPlan,
            currentPlanId: newPlan.id,
            loading: false,
          });

          logger.info('✅ Plan refreshed and stored in state');
        } catch (error: unknown) {
          logger.error('❌ Failed to refresh plan:', error);
          set({
            loading: false,
            error: getErrorMessage(error),
          });
        }
      },

      toggleItem: async (sectionId: string, itemId: string) => {
        const { plan } = get();
        if (!plan) return;

        // Create deep copy to update state immutably
        const updatedSections = plan.sections.map(section => {
          if (section.id !== sectionId) return section;

          // Update items in the target section
          const updatedItems = section.items.map(item => {
            if (item.id !== itemId) return item;
            return { ...item, completed: !item.completed };
          });

          // Recalculate section completion
          const completedCount = updatedItems.filter(i => i.completed).length;
          const completionRate = Math.round((completedCount / updatedItems.length) * 100);

          return { ...section, items: updatedItems, completionRate };
        });

        // Recalculate global stats
        const allItems = updatedSections.flatMap(s => s.items);
        const completedItems = allItems.filter(i => i.completed).length;
        const totalItems = allItems.length;
        const globalCompletionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

        const updatedPlan: PreparednessPlan = {
          ...plan,
          sections: updatedSections,
          completedItems,
          completionRate: globalCompletionRate,
          updatedAt: Date.now(),
        };

        set({ plan: updatedPlan });

        // Sync to backend asynchronously (Optimistic Update)
        try {
          await planService.savePlan(updatedPlan, {});
        } catch (err) {
          logger.warn('Failed to sync item toggle to backend', err);
        }
      },

      resetPlan: () => {
        set({ plan: null, currentPlanId: null, error: null });
      },

      getSectionProgress: (sectionId: string) => {
        const { plan } = get();
        if (!plan) return 0;
        const section = plan.sections.find(s => s.id === sectionId);
        return section ? section.completionRate : 0;
      },

      getTotalProgress: () => {
        const { plan } = get();
        return plan ? plan.completionRate : 0;
      },
    }),
    {
      name: 'preparedness-storage-elite', // Changed name to reset old incompatible storage
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Persist plan and ID, but not loading/error states
        plan: state.plan,
        currentPlanId: state.currentPlanId,
      }),
    },
  ),
);
