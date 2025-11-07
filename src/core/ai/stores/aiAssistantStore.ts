/**
 * AI ASSISTANT STORE
 * State management for AI features
 * Risk score, preparedness plan, panic assistant
 */

import { create } from 'zustand';
import { RiskScore, PreparednessPlan, PanicAssistantState } from '../types/ai.types';

interface AIAssistantState {
  // Risk Skoru
  riskScore: RiskScore | null;
  riskScoreLoading: boolean;
  riskScoreError: string | null;
  riskScoreFetchedAt: number | null;

  // Hazirlik Plani
  preparednessPlan: PreparednessPlan | null;
  preparednessPlanLoading: boolean;
  preparednessPlanError: string | null;
  preparednessPlanFetchedAt: number | null;

  // Afet Ani Asistan
  panicAssistant: PanicAssistantState | null;
  panicAssistantLoading: boolean;
  panicAssistantError: string | null;
  panicAssistantFetchedAt: number | null;
}

interface AIAssistantActions {
  // Risk Skoru
  setRiskScore: (score: RiskScore) => void;
  setRiskScoreLoading: (loading: boolean) => void;
  setRiskScoreError: (error: string | null) => void;

  // Hazirlik Plani
  setPreparednessPlan: (plan: PreparednessPlan) => void;
  setPreparednessPlanLoading: (loading: boolean) => void;
  setPreparednessPlanError: (error: string | null) => void;

  // Afet Ani Asistan
  setPanicAssistant: (state: PanicAssistantState) => void;
  setPanicAssistantLoading: (loading: boolean) => void;
  setPanicAssistantError: (error: string | null) => void;

  // Clear
  clear: () => void;
}

const initialState: AIAssistantState = {
  riskScore: null,
  riskScoreLoading: false,
  riskScoreError: null,
  riskScoreFetchedAt: null,

  preparednessPlan: null,
  preparednessPlanLoading: false,
  preparednessPlanError: null,
  preparednessPlanFetchedAt: null,

  panicAssistant: null,
  panicAssistantLoading: false,
  panicAssistantError: null,
  panicAssistantFetchedAt: null,
};

export const useAIAssistantStore = create<AIAssistantState & AIAssistantActions>((set) => ({
  ...initialState,

  setRiskScore: (score) => set({ riskScore: score, riskScoreError: null, riskScoreFetchedAt: Date.now() }),
  setRiskScoreLoading: (loading) => set({ riskScoreLoading: loading }),
  setRiskScoreError: (error) => set({ riskScoreError: error, riskScoreLoading: false }),

  setPreparednessPlan: (plan) => set({
    preparednessPlan: plan,
    preparednessPlanError: null,
    preparednessPlanFetchedAt: Date.now(),
  }),
  setPreparednessPlanLoading: (loading) => set({ preparednessPlanLoading: loading }),
  setPreparednessPlanError: (error) => set({ preparednessPlanError: error, preparednessPlanLoading: false }),

  setPanicAssistant: (state) => set({
    panicAssistant: state,
    panicAssistantError: null,
    panicAssistantFetchedAt: Date.now(),
  }),
  setPanicAssistantLoading: (loading) => set({ panicAssistantLoading: loading }),
  setPanicAssistantError: (error) => set({ panicAssistantError: error, panicAssistantLoading: false }),

  clear: () => set(initialState),
}));

