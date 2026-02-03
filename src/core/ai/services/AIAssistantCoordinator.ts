/**
 * AI ASSISTANT COORDINATOR
 * Shared orchestration layer for fetching AI assistant data
 * Ensures home card + detail ekranları tutarlı veri ve loading yönetimi kullanır
 */

import { createLogger } from '../../utils/logger';
import { getErrorMessage } from '../../utils/errorUtils';
import { safeLowerCase, safeIncludes } from '../../utils/safeString';
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
      // ELITE: Validate cached plan is not empty
      if (store.preparednessPlan.sections && store.preparednessPlan.sections.length > 0) {
        return store.preparednessPlan;
      } else {
        logger.warn('Cached plan is empty, regenerating...');
      }
    }

    if (store.preparednessPlanLoading) {
      return store.preparednessPlan;
    }

    try {
      store.setPreparednessPlanLoading(true);

      // ELITE: Collect user profile information for personalized plan
      const planParams = await this.collectUserProfileParams();

      if (__DEV__) {
        logger.info('Generating preparedness plan with params:', planParams);
      }

      const plan = await preparednessPlanService.generatePlan(planParams);

      // Validate plan has sections and items
      if (!plan.sections || plan.sections.length === 0) {
        logger.error('Generated plan has no sections!', {
          planId: plan.id,
          planTitle: plan.title,
          planKeys: Object.keys(plan),
        });
        throw new Error('Plan has no sections');
      }

      const totalItems = plan.sections.reduce((sum, s) => sum + (s.items?.length || 0), 0);
      if (totalItems === 0) {
        logger.error('Generated plan has no items!', {
          sections: plan.sections.length,
          sectionItems: plan.sections.map(s => ({ id: s.id, title: s.title, itemCount: s.items?.length || 0 })),
        });
        throw new Error('Plan has no items');
      }

      if (__DEV__) {
        logger.info('✅ Preparedness plan loaded:', {
          sections: plan.sections.length,
          totalItems: plan.totalItems || totalItems,
          completedItems: plan.completedItems || 0,
          planTitle: plan.title,
        });
      }

      store.setPreparednessPlan(plan);
      logger.info('Hazırlık planı güncellendi');
      return plan;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      const errorInfo = error instanceof Error ? {
        error: errorMessage,
        errorType: error.name,
        stack: error.stack,
      } : { error: String(error) };
      logger.error('Hazırlık planı alınamadı:', errorInfo);
      store.setPreparednessPlanError('Hazırlık planı alınamadı');
      throw error;
    } finally {
      store.setPreparednessPlanLoading(false);
    }
  },

  /**
   * ELITE: Collect user profile parameters for personalized preparedness plan
   */
  async collectUserProfileParams(): Promise<{
    familySize?: number;
    hasPets?: boolean;
    hasChildren?: boolean;
    hasElderly?: boolean;
    hasDisabilities?: boolean;
    locationName?: string;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    residenceType?: string;
  }> {
    const params: {
      familySize?: number;
      hasPets?: boolean;
      hasChildren?: boolean;
      hasElderly?: boolean;
      hasDisabilities?: boolean;
      locationName?: string;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
      residenceType?: string;
    } = {};

    try {
      // ELITE: Get family members from FamilyStore
      try {
        // CRITICAL: Wrap in try-catch to handle LoadBundleFromServerRequestError
        const { useFamilyStore } = await import('../../stores/familyStore');
        const familyState = useFamilyStore.getState();
        const members = familyState.members || [];

        // Calculate family size (including user = 1 + members)
        params.familySize = Math.max(1, 1 + members.length);

        // Check for children (from relationship or notes)
        params.hasChildren = members.some(m => {
          const rel = safeLowerCase(m.relationship);
          const notes = safeLowerCase(m.notes);
          return safeIncludes(rel, 'çocuk') || safeIncludes(rel, 'child') ||
            safeIncludes(rel, 'kız') || safeIncludes(rel, 'oğul') ||
            safeIncludes(notes, 'çocuk') || safeIncludes(notes, 'child');
        });

        // Check for elderly (from relationship or notes)
        params.hasElderly = members.some(m => {
          const rel = safeLowerCase(m.relationship);
          const notes = safeLowerCase(m.notes);
          return safeIncludes(rel, 'yaşlı') || safeIncludes(rel, 'elderly') ||
            safeIncludes(rel, 'dede') || safeIncludes(rel, 'nine') ||
            safeIncludes(rel, 'büyük') || safeIncludes(notes, 'yaşlı') || safeIncludes(notes, 'elderly');
        });

        // Check for pets (from relationship or notes)
        params.hasPets = members.some(m => {
          const rel = safeLowerCase(m.relationship);
          const notes = safeLowerCase(m.notes);
          return safeIncludes(rel, 'pet') || safeIncludes(rel, 'hayvan') ||
            safeIncludes(rel, 'köpek') || safeIncludes(rel, 'kedi') ||
            safeIncludes(notes, 'pet') || safeIncludes(notes, 'hayvan');
        });

        // Check for disabilities (from notes)
        params.hasDisabilities = members.some(m => {
          const notes = safeLowerCase(m.notes);
          return safeIncludes(notes, 'engel') || safeIncludes(notes, 'disability') ||
            safeIncludes(notes, 'özürlü') || safeIncludes(notes, 'handicap');
        });

        if (__DEV__) {
          logger.debug('Family profile collected:', {
            familySize: params.familySize,
            hasChildren: params.hasChildren,
            hasElderly: params.hasElderly,
            hasPets: params.hasPets,
            hasDisabilities: params.hasDisabilities,
          });
        }
      } catch (familyError: unknown) {
        // CRITICAL: Handle LoadBundleFromServerRequestError gracefully
        const errorMsg = getErrorMessage(familyError);
        const isBundleError = errorMsg.includes('LoadBundleFromServerRequestError') ||
          errorMsg.includes('Could not load bundle');

        if (isBundleError) {
          // ELITE: Bundle errors are expected in some environments - use defaults silently
          if (__DEV__) {
            logger.debug('Family profile collection skipped (bundle error - expected):', errorMsg);
          }
        } else {
          logger.warn('Failed to collect family profile, using defaults:', familyError);
        }
        params.familySize = 4; // Default family size
      }

      // ELITE: Get location information
      try {
        const LocationModule = await import('expo-location');
        const Location = LocationModule.default || LocationModule;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          // Reverse geocode to get location name
          try {
            const addresses = await Location.reverseGeocodeAsync({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            });

            if (addresses && addresses.length > 0) {
              const address = addresses[0];
              // Build location name: City, District
              const locationParts = [
                address.city || (address as any).subAdministrativeArea,
                address.district || (address as any).subLocality,
              ].filter(Boolean);

              params.locationName = locationParts.join(', ') || 'Türkiye';

              if (__DEV__) {
                logger.debug('Location collected:', params.locationName);
              }
            }
          } catch (geocodeError) {
            logger.debug('Geocoding failed, using default location:', geocodeError);
            params.locationName = 'Türkiye';
          }
        }
      } catch (locationError) {
        logger.debug('Location collection failed, using default:', locationError);
        params.locationName = 'Türkiye';
      }

      // ELITE: Get risk level from risk score
      try {
        const aiStore = useAIAssistantStore.getState();
        const riskScore = aiStore.riskScore;
        if (riskScore && riskScore.score !== undefined) {
          const score = riskScore.score;
          if (score >= 80) {
            params.riskLevel = 'critical';
          } else if (score >= 60) {
            params.riskLevel = 'high';
          } else if (score >= 40) {
            params.riskLevel = 'medium';
          } else {
            params.riskLevel = 'low';
          }

          if (__DEV__) {
            logger.debug('Risk level from score:', {
              score,
              riskLevel: params.riskLevel,
            });
          }
        } else {
          // Try to fetch risk score if not available
          try {
            const score = await this.ensureRiskScore(false);
            if (score && score.overallScore !== undefined) {
              const overallScore = score.overallScore;
              if (overallScore >= 80) {
                params.riskLevel = 'critical';
              } else if (overallScore >= 60) {
                params.riskLevel = 'high';
              } else if (overallScore >= 40) {
                params.riskLevel = 'medium';
              } else {
                params.riskLevel = 'low';
              }
            }
          } catch (riskError) {
            logger.debug('Risk score fetch failed, using default:', riskError);
            params.riskLevel = 'medium'; // Default risk level
          }
        }
      } catch (riskError) {
        logger.debug('Risk level collection failed, using default:', riskError);
        params.riskLevel = 'medium';
      }

      // ELITE: Get residence type (could be enhanced with user settings)
      // For now, default to apartment (most common in Turkey)
      params.residenceType = 'apartment'; // Could be: apartment, house, villa, etc.

      if (__DEV__) {
        logger.info('✅ User profile params collected:', params);
      }

      return params;
    } catch (error) {
      logger.warn('Error collecting user profile params, using defaults:', error);
      // Return default params if collection fails
      return {
        familySize: 4,
        hasChildren: false,
        hasElderly: false,
        hasPets: false,
        hasDisabilities: false,
        locationName: 'Türkiye',
        riskLevel: 'medium',
        residenceType: 'apartment',
      };
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
      const completedCount = actions.filter(a => a.completed).length;
      const totalCount = actions.length;
      const criticalRemaining = actions.filter(a => !a.completed && (a.warningLevel === 'critical' || a.warningLevel === 'emergency')).length;

      const payload = {
        isActive: true,
        currentScenario: scenario,
        actions,
        lastUpdate: Date.now(),
        completedActionsCount: completedCount,
        totalActionsCount: totalCount,
        progressPercentage: Math.round((completedCount / totalCount) * 100),
        criticalActionsRemaining: criticalRemaining,
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


