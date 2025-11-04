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

  // Hazirlik Plani
  preparednessPlan: PreparednessPlan | null;
  preparednessPlanLoading: boolean;
  preparednessPlanError: string | null;

  // Afet Ani Asistan
  panicAssistant: PanicAssistantState | null;
  panicAssistantLoading: boolean;
  panicAssistantError: string | null;
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

  preparednessPlan: null,
  preparednessPlanLoading: false,
  preparednessPlanError: null,

  panicAssistant: null,
  panicAssistantLoading: false,
  panicAssistantError: null,
};

export const useAIAssistantStore = create<AIAssistantState & AIAssistantActions>((set) => ({
  ...initialState,

  setRiskScore: (score) => set({ riskScore: score, riskScoreError: null }),
  setRiskScoreLoading: (loading) => set({ riskScoreLoading: loading }),
  setRiskScoreError: (error) => set({ riskScoreError: error, riskScoreLoading: false }),

  setPreparednessPlan: (plan) => set({ preparednessPlan: plan, preparednessPlanError: null }),
  setPreparednessPlanLoading: (loading) => set({ preparednessPlanLoading: loading }),
  setPreparednessPlanError: (error) => set({ preparednessPlanError: error, preparednessPlanLoading: false }),

  setPanicAssistant: (state) => set({ panicAssistant: state, panicAssistantError: null }),
  setPanicAssistantLoading: (loading) => set({ panicAssistantLoading: loading }),
  setPanicAssistantError: (error) => set({ panicAssistantError: error, panicAssistantLoading: false }),

  clear: () => set(initialState),
}));

