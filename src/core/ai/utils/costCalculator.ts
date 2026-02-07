/**
 * OpenAI Cost Calculator
 * ELITE: Tracks and optimizes OpenAI API costs
 * Model: gpt-4o-mini
 * Pricing (as of 2024): $0.15 per 1M input tokens, $0.60 per 1M output tokens
 */

import { createLogger } from '../../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const logger = createLogger('CostCalculator');

// gpt-4o-mini pricing (per 1M tokens)
const INPUT_COST_PER_MILLION = 0.15; // $0.15 per 1M input tokens
const OUTPUT_COST_PER_MILLION = 0.60; // $0.60 per 1M output tokens

// Storage keys
const STORAGE_KEY_COST_TRACKER = '@afetnet_openai_cost_tracker';
const STORAGE_KEY_COST_STATS = '@afetnet_openai_cost_stats';

interface CostRecord {
  timestamp: number;
  service: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
}

interface CostStats {
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  dailyCost: number;
  lastResetDate: string;
  serviceBreakdown: Record<string, {
    calls: number;
    cost: number;
    tokens: number;
  }>;
}

/**
 * Estimate token count from text (rough approximation: 1 token ≈ 4 characters)
 * More accurate: Turkish text ~1.2 tokens per word, English ~1.3 tokens per word
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  
  // Rough estimation: average of 1 token per 4 characters
  // For Turkish: slightly more tokens per character
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  
  // Use word-based estimation for better accuracy (Turkish ~1.2 tokens/word)
  const estimatedTokens = Math.ceil(wordCount * 1.2 + charCount * 0.15);
  
  return estimatedTokens;
}

/**
 * Calculate cost from token usage
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * INPUT_COST_PER_MILLION;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION;
  return inputCost + outputCost;
}

/**
 * Format cost for display
 */
export function formatCost(cost: number): string {
  if (cost < 0.001) {
    return `$${(cost * 1000).toFixed(3)}¢`; // Show in cents for very small amounts
  }
  return `$${cost.toFixed(4)}`;
}

/**
 * Cost Tracker - tracks individual API calls
 */
class CostTracker {
  private records: CostRecord[] = [];
  private maxRecords = 1000; // Keep last 1000 records

  async recordCall(
    service: string,
    inputTokens: number,
    outputTokens: number,
    model: string = 'gpt-4o-mini',
  ): Promise<number> {
    const totalTokens = inputTokens + outputTokens;
    const cost = calculateCost(inputTokens, outputTokens);

    const record: CostRecord = {
      timestamp: Date.now(),
      service,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
      model,
    };

    this.records.push(record);
    
    // Keep only last maxRecords
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }

    // Save to AsyncStorage (async, don't wait)
    this.saveRecords().catch(err => {
      logger.debug('Failed to save cost records:', err);
    });

    // Update stats
    await this.updateStats(service, inputTokens, outputTokens, cost);

    if (__DEV__) {
      logger.info(`💰 OpenAI cost: ${formatCost(cost)} (${inputTokens} input + ${outputTokens} output tokens) - ${service}`);
    }

    return cost;
  }

  private async saveRecords(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_COST_TRACKER, JSON.stringify(this.records));
    } catch (error) {
      logger.debug('Failed to save cost records:', error);
    }
  }

  private async updateStats(
    service: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
  ): Promise<void> {
    try {
      const statsJson = await AsyncStorage.getItem(STORAGE_KEY_COST_STATS);
      let stats: CostStats = statsJson
        ? JSON.parse(statsJson)
        : {
          totalCost: 0,
          totalCalls: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalTokens: 0,
          dailyCost: 0,
          lastResetDate: new Date().toISOString().split('T')[0],
          serviceBreakdown: {},
        };

      const today = new Date().toISOString().split('T')[0];
      
      // Reset daily cost if new day
      if (stats.lastResetDate !== today) {
        stats.dailyCost = 0;
        stats.lastResetDate = today;
      }

      // Update totals
      stats.totalCost += cost;
      stats.totalCalls += 1;
      stats.totalInputTokens += inputTokens;
      stats.totalOutputTokens += outputTokens;
      stats.totalTokens += inputTokens + outputTokens;
      stats.dailyCost += cost;

      // Update service breakdown
      if (!stats.serviceBreakdown[service]) {
        stats.serviceBreakdown[service] = {
          calls: 0,
          cost: 0,
          tokens: 0,
        };
      }
      stats.serviceBreakdown[service].calls += 1;
      stats.serviceBreakdown[service].cost += cost;
      stats.serviceBreakdown[service].tokens += inputTokens + outputTokens;

      await AsyncStorage.setItem(STORAGE_KEY_COST_STATS, JSON.stringify(stats));
    } catch (error) {
      logger.debug('Failed to update cost stats:', error);
    }
  }

  async getStats(): Promise<CostStats | null> {
    try {
      const statsJson = await AsyncStorage.getItem(STORAGE_KEY_COST_STATS);
      return statsJson ? JSON.parse(statsJson) : null;
    } catch (error) {
      logger.debug('Failed to get cost stats:', error);
      return null;
    }
  }

  async getRecentRecords(limit: number = 50): Promise<CostRecord[]> {
    try {
      const recordsJson = await AsyncStorage.getItem(STORAGE_KEY_COST_TRACKER);
      if (!recordsJson) return [];
      
      const records: CostRecord[] = JSON.parse(recordsJson);
      return records.slice(-limit);
    } catch (error) {
      logger.debug('Failed to get recent records:', error);
      return [];
    }
  }

  async resetStats(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_COST_STATS);
      await AsyncStorage.removeItem(STORAGE_KEY_COST_TRACKER);
      this.records = [];
      logger.info('💰 Cost stats reset');
    } catch (error) {
      logger.error('Failed to reset cost stats:', error);
    }
  }
}

export const costTracker = new CostTracker();

/**
 * Estimate cost before making API call (for optimization)
 */
export function estimateCost(
  prompt: string,
  systemPrompt?: string,
  maxOutputTokens: number = 500,
): number {
  const inputTokens = estimateTokens(prompt) + (systemPrompt ? estimateTokens(systemPrompt) : 0);
  const outputTokens = maxOutputTokens; // Estimate max output
  
  return calculateCost(inputTokens, outputTokens);
}

/**
 * Get cost optimization suggestions
 */
export function getOptimizationSuggestions(stats: CostStats | null): string[] {
  const suggestions: string[] = [];
  
  if (!stats) return suggestions;

  // Check daily cost
  if (stats.dailyCost > 1.00) { // $1.00 per day threshold
    suggestions.push(`Günlük maliyet yüksek (${formatCost(stats.dailyCost)}). Cache kullanımını artırın.`);
  }

  // Check service breakdown
  const expensiveServices = Object.entries(stats.serviceBreakdown)
    .filter(([_, data]) => data.cost > 0.05) // Services costing more than $0.05
    .sort((a, b) => b[1].cost - a[1].cost);

  if (expensiveServices.length > 0) {
    const topService = expensiveServices[0];
    suggestions.push(`En pahalı servis: ${topService[0]} (${formatCost(topService[1].cost)}). Optimize edilebilir.`);
  }

  // Check average tokens per call
  const avgTokens = stats.totalCalls > 0 ? stats.totalTokens / stats.totalCalls : 0;
  if (avgTokens > 2000) {
    suggestions.push(`Ortalama token sayısı yüksek (${Math.round(avgTokens)}). Prompt'ları kısaltın.`);
  }

  return suggestions;
}








