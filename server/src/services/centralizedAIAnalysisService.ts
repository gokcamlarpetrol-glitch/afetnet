/**
 * CENTRALIZED AI ANALYSIS SERVICE
 * 
 * ELITE COST OPTIMIZATION: Single AI analysis for all users
 * Instead of each user making separate AI calls, backend analyzes once
 * and broadcasts the result to all users via push notifications
 * 
 * COST SAVINGS: 1 AI call vs 1000+ AI calls = 99.9% cost reduction
 */

import { EarthquakeEvent } from '../earthquake-detection';
import { pool } from '../database';

export interface CentralizedAnalysis {
  earthquakeId: string; // Unique signature: timestamp-lat-lon-magnitude
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  userMessage: string;
  recommendations: string[];
  verified: boolean;
  sources: string[];
  confidence: number; // 0-100
  analyzedAt: number;
  aiTokensUsed: number; // Track token usage
}

interface AnalysisCache {
  [key: string]: {
    analysis: CentralizedAnalysis;
    expiresAt: number;
  };
}

class CentralizedAIAnalysisService {
  private analysisCache: AnalysisCache = {};
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
  private readonly MIN_MAGNITUDE_FOR_AI = 4.0; // Only analyze 4.0+ earthquakes
  
  /**
   * Analyze earthquake using AI (single call for all users)
   * Returns cached result if available, otherwise performs new analysis
   */
  async analyzeEarthquake(event: EarthquakeEvent): Promise<CentralizedAnalysis | null> {
    // Skip small earthquakes (not worth AI analysis)
    if (event.magnitude < this.MIN_MAGNITUDE_FOR_AI) {
      return null;
    }
    
    // Create unique earthquake signature
    const earthquakeId = this.createEarthquakeSignature(event);
    
    // Check cache first
    const cached = this.analysisCache[earthquakeId];
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`✅ Using cached AI analysis for earthquake ${earthquakeId}`);
      return cached.analysis;
    }
    
    // Perform AI analysis (single call)
    console.log(`🤖 Performing centralized AI analysis for earthquake ${earthquakeId}...`);
    const analysis = await this.performAIAnalysis(event);
    
    if (!analysis) {
      return null;
    }
    
    // Cache the result
    this.analysisCache[earthquakeId] = {
      analysis,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    };
    
    // Cleanup old cache entries
    this.cleanupCache();
    
    // Save to database for persistence
    await this.saveAnalysisToDatabase(analysis);
    
    console.log(`✅ Centralized AI analysis completed: ${analysis.riskLevel} risk, ${analysis.confidence}% confidence`);
    return analysis;
  }
  
  /**
   * Perform actual AI analysis using OpenAI or fallback
   */
  private async performAIAnalysis(event: EarthquakeEvent): Promise<CentralizedAnalysis | null> {
    try {
      // Check if OpenAI is configured
      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        // Fallback: Rule-based analysis (no AI cost)
        return this.performFallbackAnalysis(event);
      }
      
      // ELITE: Single AI call for all users
      const prompt = this.buildAnalysisPrompt(event);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Cost-effective model
          messages: [
            {
              role: 'system',
              content: 'Sen bir deprem analiz uzmanısın. Deprem verilerini analiz edip risk seviyesi, kullanıcı mesajı ve öneriler sun.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 500, // Limit tokens for cost control
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        console.error(`❌ OpenAI API error: ${response.statusText}`);
        return this.performFallbackAnalysis(event);
      }
      
      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content || '';
      const tokensUsed = data.usage?.total_tokens || 0;
      
      // Parse AI response
      const analysis = this.parseAIResponse(event, aiResponse, tokensUsed);
      
      return analysis;
    } catch (error) {
      console.error('❌ AI analysis error:', error);
      return this.performFallbackAnalysis(event);
    }
  }
  
  /**
   * Build analysis prompt for AI
   */
  private buildAnalysisPrompt(event: EarthquakeEvent): string {
    return `Deprem Bilgileri:
- Büyüklük: ${event.magnitude.toFixed(1)}
- Konum: ${event.region}
- Derinlik: ${event.depth} km
- Kaynak: ${event.source}
- Zaman: ${new Date(event.timestamp).toLocaleString('tr-TR')}

Bu deprem için:
1. Risk seviyesi belirle (low/medium/high/critical)
2. Kullanıcı dostu bir mesaj oluştur (Türkçe, kısa ve net)
3. 3-5 öneri sun (güvenlik, hazırlık, sonrası)

JSON formatında döndür:
{
  "riskLevel": "high",
  "userMessage": "...",
  "recommendations": ["...", "...", "..."]
}`;
  }
  
  /**
   * Parse AI response into structured analysis
   */
  private parseAIResponse(
    event: EarthquakeEvent,
    aiResponse: string,
    tokensUsed: number
  ): CentralizedAnalysis {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          earthquakeId: this.createEarthquakeSignature(event),
          riskLevel: parsed.riskLevel || this.determineRiskLevel(event.magnitude),
          userMessage: parsed.userMessage || this.generateFallbackMessage(event),
          recommendations: Array.isArray(parsed.recommendations) 
            ? parsed.recommendations 
            : this.generateFallbackRecommendations(event),
          verified: event.verified,
          sources: [event.source],
          confidence: this.calculateConfidence(event),
          analyzedAt: Date.now(),
          aiTokensUsed: tokensUsed,
        };
      }
    } catch (error) {
      console.error('❌ Failed to parse AI response:', error);
    }
    
    // Fallback if parsing fails
    return {
      earthquakeId: this.createEarthquakeSignature(event),
      riskLevel: this.determineRiskLevel(event.magnitude),
      userMessage: this.generateFallbackMessage(event),
      recommendations: this.generateFallbackRecommendations(event),
      verified: event.verified,
      sources: [event.source],
      confidence: this.calculateConfidence(event),
      analyzedAt: Date.now(),
      aiTokensUsed: tokensUsed,
    };
  }
  
  /**
   * Fallback analysis (no AI cost)
   */
  private performFallbackAnalysis(event: EarthquakeEvent): CentralizedAnalysis {
    return {
      earthquakeId: this.createEarthquakeSignature(event),
      riskLevel: this.determineRiskLevel(event.magnitude),
      userMessage: this.generateFallbackMessage(event),
      recommendations: this.generateFallbackRecommendations(event),
      verified: event.verified,
      sources: [event.source],
      confidence: this.calculateConfidence(event),
      analyzedAt: Date.now(),
      aiTokensUsed: 0, // No AI tokens used
    };
  }
  
  /**
   * Determine risk level based on magnitude
   */
  private determineRiskLevel(magnitude: number): 'low' | 'medium' | 'high' | 'critical' {
    if (magnitude >= 7.0) return 'critical';
    if (magnitude >= 6.0) return 'high';
    if (magnitude >= 5.0) return 'medium';
    return 'low';
  }
  
  /**
   * Generate fallback user message
   */
  private generateFallbackMessage(event: EarthquakeEvent): string {
    const magnitude = event.magnitude.toFixed(1);
    if (event.magnitude >= 7.0) {
      return `🚨 KRİTİK: ${magnitude} büyüklüğünde deprem tespit edildi! Hemen güvenli bir yere geçin!`;
    } else if (event.magnitude >= 6.0) {
      return `⚠️ YÜKSEK RİSK: ${magnitude} büyüklüğünde deprem tespit edildi. Güvenliğinizi sağlayın.`;
    } else if (event.magnitude >= 5.0) {
      return `📢 ORTA RİSK: ${magnitude} büyüklüğünde deprem tespit edildi. Dikkatli olun.`;
    }
    return `ℹ️ ${magnitude} büyüklüğünde deprem tespit edildi.`;
  }
  
  /**
   * Generate fallback recommendations
   */
  private generateFallbackRecommendations(event: EarthquakeEvent): string[] {
    const recommendations: string[] = [];
    
    if (event.magnitude >= 6.0) {
      recommendations.push('Hemen güvenli bir yere geçin (masa altı, kapı kasası)');
      recommendations.push('Pencere ve camlardan uzak durun');
      recommendations.push('Asansör kullanmayın');
    } else {
      recommendations.push('Sakin kalın ve güvenli bir yere geçin');
      recommendations.push('Çevrenizdeki durumu kontrol edin');
    }
    
    recommendations.push('Acil durum çantanızı hazır tutun');
    recommendations.push('Aile üyelerinizle iletişimde kalın');
    
    return recommendations;
  }
  
  /**
   * Calculate confidence based on event data
   */
  private calculateConfidence(event: EarthquakeEvent): number {
    let confidence = 70; // Base confidence
    
    if (event.verified) confidence += 20;
    if (event.magnitude >= 5.0) confidence += 10;
    
    return Math.min(100, confidence);
  }
  
  /**
   * Create unique earthquake signature
   */
  private createEarthquakeSignature(event: EarthquakeEvent): string {
    // Round coordinates to 0.1 degree precision (same earthquake within ~11km)
    const lat = Math.round(event.latitude * 10) / 10;
    const lon = Math.round(event.longitude * 10) / 10;
    const mag = Math.round(event.magnitude * 10) / 10;
    const time = Math.floor(event.timestamp / 60000); // Round to nearest minute
    
    return `${time}-${lat}-${lon}-${mag}`;
  }
  
  /**
   * Save analysis to database for persistence
   */
  private async saveAnalysisToDatabase(analysis: CentralizedAnalysis): Promise<void> {
    try {
      const { queryWithRetry } = await import('../database');
      await queryWithRetry(`
        INSERT INTO earthquake_analyses (
          earthquake_id,
          risk_level,
          user_message,
          recommendations,
          verified,
          sources,
          confidence,
          analyzed_at,
          ai_tokens_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (earthquake_id) 
        DO UPDATE SET
          risk_level = EXCLUDED.risk_level,
          user_message = EXCLUDED.user_message,
          recommendations = EXCLUDED.recommendations,
          verified = EXCLUDED.verified,
          sources = EXCLUDED.sources,
          confidence = EXCLUDED.confidence,
          analyzed_at = EXCLUDED.analyzed_at,
          ai_tokens_used = EXCLUDED.ai_tokens_used
      `, [
        analysis.earthquakeId,
        analysis.riskLevel,
        analysis.userMessage,
        JSON.stringify(analysis.recommendations),
        analysis.verified,
        JSON.stringify(analysis.sources),
        analysis.confidence,
        new Date(analysis.analyzedAt),
        analysis.aiTokensUsed,
      ], 2, 15000); // 2 retries, 15 second timeout
    } catch (error) {
      console.error('❌ Failed to save analysis to database:', error);
      // Don't throw - analysis is still valid
    }
  }
  
  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const key in this.analysisCache) {
      if (this.analysisCache[key].expiresAt <= now) {
        delete this.analysisCache[key];
      }
    }
  }
  
  /**
   * Get cached analysis if available
   */
  getCachedAnalysis(earthquakeId: string): CentralizedAnalysis | null {
    const cached = this.analysisCache[earthquakeId];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.analysis;
    }
    return null;
  }
}

// Singleton instance
export const centralizedAIAnalysisService = new CentralizedAIAnalysisService();

