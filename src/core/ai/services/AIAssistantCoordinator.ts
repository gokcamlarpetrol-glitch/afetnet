/**
 * AI ASSISTANT COORDINATOR
 * Shared orchestration layer for fetching AI assistant data
 * Ensures home card + detail ekranları tutarlı veri ve loading yönetimi kullanır
 */

import { createLogger } from '../../utils/logger';
import { useAIAssistantStore } from '../stores/aiAssistantStore';
import { riskScoringService } from './RiskScoringService';
import { preparednessPlanService } from './PreparednessPlanService';
import { panicAssistantService } from './PanicAssistantService';

const logger = createLogger('AIAssistantCoordinator');

const RISK_SCORE_TTL = 15 * 60 * 1000; // 15 dakika
const PREP_PLAN_TTL = 60 * 60 * 1000; // 1 saat
const PANIC_ASSISTANT_TTL = 5 * 60 * 1000; // 5 dakika

function isFresh(timestamp: number | null, ttl: number) {
  if (!timestamp) return false;
  return Date.now() - timestamp < ttl;
}

export const aiAssistantCoordinator = {
  async ensureRiskScore(force = false) {
    const store = useAIAssistantStore.getState();

    if (!force && store.riskScore && isFresh(store.riskScoreFetchedAt, RISK_SCORE_TTL)) {
      return store.riskScore;
    }

    if (store.riskScoreLoading) {
      return store.riskScore;
    }

    try {
      store.setRiskScoreLoading(true);
      const score = await riskScoringService.calculateRiskScore({});
      store.setRiskScore(score);
      logger.info('Risk skoru güncellendi');
      return score;
    } catch (error) {
      logger.error('Risk skoru alınamadı:', error);
      store.setRiskScoreError('Risk skoru alınamadı');
      throw error;
    } finally {
      store.setRiskScoreLoading(false);
    }
  },

  async ensurePreparednessPlan(force = false) {
    const store = useAIAssistantStore.getState();

    if (!force && store.preparednessPlan && isFresh(store.preparednessPlanFetchedAt, PREP_PLAN_TTL)) {
      return store.preparednessPlan;
    }

    if (store.preparednessPlanLoading) {
      return store.preparednessPlan;
    }

    try {
      store.setPreparednessPlanLoading(true);
      const plan = await preparednessPlanService.generatePlan({});
      store.setPreparednessPlan(plan);
      logger.info('Hazırlık planı güncellendi');
      return plan;
    } catch (error) {
      logger.error('Hazırlık planı alınamadı:', error);
      store.setPreparednessPlanError('Hazırlık planı alınamadı');
      throw error;
    } finally {
      store.setPreparednessPlanLoading(false);
    }
  },

  async ensurePanicAssistant(scenario: 'earthquake' | 'flood' | 'fire' = 'earthquake', force = false) {
    const store = useAIAssistantStore.getState();

    if (
      !force &&
      store.panicAssistant &&
      store.panicAssistant.currentScenario === scenario &&
      isFresh(store.panicAssistantFetchedAt, PANIC_ASSISTANT_TTL)
    ) {
      return store.panicAssistant;
    }

    if (store.panicAssistantLoading) {
      return store.panicAssistant;
    }

    try {
      store.setPanicAssistantLoading(true);
      const actions = await panicAssistantService.getEmergencyActions(scenario);
      const payload = {
        isActive: true,
        currentScenario: scenario,
        actions,
        lastUpdate: Date.now(),
      };
      store.setPanicAssistant(payload);
      logger.info('Panik asistan aksiyonları güncellendi');
      return payload;
    } catch (error) {
      logger.error('Panik asistan aksiyonları alınamadı:', error);
      store.setPanicAssistantError('Acil durum aksiyonları alınamadı');
      throw error;
    } finally {
      store.setPanicAssistantLoading(false);
    }
  },
};


