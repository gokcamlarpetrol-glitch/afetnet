/**
 * OpenAI Cost Report Generator
 * ELITE: Generate cost reports and statistics
 */

import { costTracker, formatCost, getOptimizationSuggestions } from './costCalculator';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CostReport');

export interface CostReport {
  totalCost: number;
  dailyCost: number;
  totalCalls: number;
  totalTokens: number;
  averageCostPerCall: number;
  averageTokensPerCall: number;
  serviceBreakdown: Array<{
    service: string;
    calls: number;
    cost: number;
    tokens: number;
    percentage: number;
  }>;
  optimizationSuggestions: string[];
  lastResetDate: string;
}

/**
 * Generate comprehensive cost report
 */
export async function generateCostReport(): Promise<CostReport | null> {
  try {
    const stats = await costTracker.getStats();
    if (!stats) {
      return null;
    }

    const serviceBreakdown = Object.entries(stats.serviceBreakdown)
      .map(([service, data]) => ({
        service,
        calls: data.calls,
        cost: data.cost,
        tokens: data.tokens,
        percentage: stats.totalCost > 0 ? (data.cost / stats.totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost); // Sort by cost descending

    const averageCostPerCall = stats.totalCalls > 0 ? stats.totalCost / stats.totalCalls : 0;
    const averageTokensPerCall = stats.totalCalls > 0 ? stats.totalTokens / stats.totalCalls : 0;

    const optimizationSuggestions = getOptimizationSuggestions(stats);

    return {
      totalCost: stats.totalCost,
      dailyCost: stats.dailyCost,
      totalCalls: stats.totalCalls,
      totalTokens: stats.totalTokens,
      averageCostPerCall,
      averageTokensPerCall,
      serviceBreakdown,
      optimizationSuggestions,
      lastResetDate: stats.lastResetDate,
    };
  } catch (error) {
    logger.error('Failed to generate cost report:', error);
    return null;
  }
}

/**
 * Format cost report for display
 */
export function formatCostReport(report: CostReport): string {
  let output = '📊 OpenAI Maliyet Raporu\n';
  output += '═══════════════════════════\n\n';
  
  output += `💰 Toplam Maliyet: ${formatCost(report.totalCost)}\n`;
  output += `📅 Günlük Maliyet: ${formatCost(report.dailyCost)}\n`;
  output += `📞 Toplam Çağrı: ${report.totalCalls}\n`;
  output += `🔢 Toplam Token: ${report.totalTokens.toLocaleString()}\n`;
  output += `📊 Ortalama Maliyet/Çağrı: ${formatCost(report.averageCostPerCall)}\n`;
  output += `📊 Ortalama Token/Çağrı: ${Math.round(report.averageTokensPerCall)}\n\n`;

  if (report.serviceBreakdown.length > 0) {
    output += '📋 Servis Bazında Dağılım:\n';
    output += '─────────────────────────────\n';
    report.serviceBreakdown.forEach((service, index) => {
      output += `${index + 1}. ${service.service}\n`;
      output += `   Çağrı: ${service.calls} | Maliyet: ${formatCost(service.cost)} | Token: ${service.tokens.toLocaleString()} | %${service.percentage.toFixed(1)}\n`;
    });
    output += '\n';
  }

  if (report.optimizationSuggestions.length > 0) {
    output += '💡 Optimizasyon Önerileri:\n';
    output += '─────────────────────────────\n';
    report.optimizationSuggestions.forEach((suggestion, index) => {
      output += `${index + 1}. ${suggestion}\n`;
    });
    output += '\n';
  }

  output += `📅 Son Sıfırlama: ${report.lastResetDate}\n`;

  return output;
}

/**
 * Get cost summary for quick display
 */
export async function getCostSummary(): Promise<{
  dailyCost: string;
  totalCost: string;
  totalCalls: number;
  topService: string | null;
} | null> {
  try {
    const stats = await costTracker.getStats();
    if (!stats) {
      return null;
    }

    const topService = Object.entries(stats.serviceBreakdown)
      .sort((a, b) => b[1].cost - a[1].cost)[0]?.[0] || null;

    return {
      dailyCost: formatCost(stats.dailyCost),
      totalCost: formatCost(stats.totalCost),
      totalCalls: stats.totalCalls,
      topService,
    };
  } catch (error) {
    logger.debug('Failed to get cost summary:', error);
    return null;
  }
}









