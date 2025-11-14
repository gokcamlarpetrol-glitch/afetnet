/**
 * OpenAI Cost Optimizer
 * ELITE: Strategies to minimize OpenAI API costs
 */

import { createLogger } from '../../utils/logger';
import { costTracker, getOptimizationSuggestions, estimateCost } from './costCalculator';

const logger = createLogger('CostOptimizer');

/**
 * Check if API call should be skipped based on cost thresholds
 */
export async function shouldSkipAPICall(
  serviceName: string,
  estimatedCost: number,
  dailyCostThreshold: number = 0.10 // $0.10 per day default threshold
): Promise<boolean> {
  try {
    const stats = await costTracker.getStats();
    if (!stats) return false;

    const today = new Date().toISOString().split('T')[0];
    if (stats.lastResetDate !== today) {
      // New day, reset check
      return false;
    }

    // Skip if daily cost exceeds threshold
    if (stats.dailyCost + estimatedCost > dailyCostThreshold) {
      logger.warn(`💰 Skipping ${serviceName} API call: Daily cost threshold exceeded (${stats.dailyCost.toFixed(4)} + ${estimatedCost.toFixed(4)} > ${dailyCostThreshold})`);
      return true;
    }

    return false;
  } catch (error) {
    logger.debug('Failed to check cost threshold:', error);
    return false; // Don't skip on error
  }
}

/**
 * Get cost-optimized maxTokens based on service type
 */
export function getOptimizedMaxTokens(serviceName: string, defaultMaxTokens: number): number {
  // ELITE: Service-specific optimizations
  const optimizations: Record<string, number> = {
    'EarthquakeValidationService': 200, // Small JSON
    'AIEarthquakePredictionService': 150, // Small JSON
    'NewsAggregatorService': 300, // Summary doesn't need 500 tokens
    'EarthquakeAnalysisService': 300, // Analysis response
    'PanicAssistantService': 400, // Action list
    'RiskScoringService': 400, // Scoring response
    'PreparednessPlanService': 2000, // Large JSON (but reduced from 3000)
  };

  return optimizations[serviceName] || defaultMaxTokens;
}

/**
 * Optimize prompt to reduce token count
 */
export function optimizePrompt(prompt: string, maxLength: number = 1000): string {
  if (prompt.length <= maxLength) return prompt;

  // ELITE: Truncate intelligently (keep important parts)
  // Remove extra whitespace
  let optimized = prompt.replace(/\s+/g, ' ').trim();

  // If still too long, truncate from middle (keep start and end)
  if (optimized.length > maxLength) {
    const start = optimized.substring(0, maxLength * 0.4);
    const end = optimized.substring(optimized.length - maxLength * 0.4);
    optimized = `${start}... [truncated] ...${end}`;
  }

  return optimized;
}

/**
 * Batch multiple requests to reduce API calls
 */
export async function batchAPICalls<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>
): Promise<void> {
  // ELITE: Process in batches to reduce API call frequency
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}









