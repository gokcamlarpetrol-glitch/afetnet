/**
 * EARTHQUAKE WARNING SERVICE
 * 
 * Elite-grade microservice for sending life-saving warnings
 * Calculates ETA, geospatial targeting, multi-source verification
 * Integrated with APNs and FCM for instant delivery
 */

import { EarthquakeEvent, WarningETA, earthquakeDetectionService } from './earthquake-detection';
import { pool } from './database';
import { backendAIPredictionService } from './services/BackendAIPredictionService';
import { centralizedAIAnalysisService } from './services/centralizedAIAnalysisService';

export interface WarningTarget {
  userId: string;
  pushToken: string;
  latitude: number;
  longitude: number;
  deviceType: 'ios' | 'android';
}

export interface EarthquakeWarning {
  event: EarthquakeEvent;
  eta: WarningETA;
  target: WarningTarget;
  priority: 'critical' | 'high' | 'normal';
}

class EarthquakeWarningService {
  private readonly WARNING_RADIUS_KM = 500; // Send warnings within 500km radius
  private readonly MIN_MAGNITUDE = 4.0; // Only warn for significant earthquakes
  private lastProcessedEvent?: number;
  
  /**
   * Start continuous monitoring for earthquakes
   */
  startMonitoring() {
    console.log('🚨 Starting earthquake warning service monitoring...');
    
    setInterval(async () => {
      try {
        await this.processNewEarthquakes();
      } catch (error) {
        console.error('❌ Warning service error:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process new verified earthquakes and send warnings
   */
  private async processNewEarthquakes() {
    const verifiedEvents = earthquakeDetectionService.getVerifiedEvents(60);
    
    for (const event of verifiedEvents) {
      // Skip if already processed
      if (this.lastProcessedEvent === event.timestamp) {
        continue;
      }
      
      // Only process significant earthquakes
      if (event.magnitude < this.MIN_MAGNITUDE) {
        continue;
      }
      
      console.log(`🌍 Processing earthquake: M${event.magnitude.toFixed(1)} at ${event.region}`);
      
      // ELITE: Single AI prediction call for all users (cost optimization)
      const recentEvents = earthquakeDetectionService.getRecentEarthquakes(60);
      const aiPrediction = await backendAIPredictionService.predictEarthquake(event, recentEvents);
      
      // ELITE: Single AI analysis call for all users (cost optimization)
      const aiAnalysis = await centralizedAIAnalysisService.analyzeEarthquake(event);
      
      // Get all registered users
      const users = await this.getRegisteredUsers();
      
      // Filter users within warning radius
      const targetUsers = users.filter((user) =>
        this.isWithinWarningRadius(event, user.latitude, user.longitude)
      );
      
      console.log(`📢 Broadcasting to ${targetUsers.length} users (AI prediction: ${aiPrediction?.confidence || 'N/A'}% confidence)`);
      
      // ELITE: Send warnings to all target users with AI prediction data
      for (const user of targetUsers) {
        const eta = earthquakeDetectionService.calculateETA(
          event,
          user.latitude,
          user.longitude
        );
        
        // Use AI prediction time advance if available
        const timeAdvance = aiPrediction?.timeAdvance || eta.secondsRemaining;
        
        // Only send if significant time remaining
        if (timeAdvance > 0 && timeAdvance <= 120) {
          const warning: EarthquakeWarning = {
            event,
            eta: {
              ...eta,
              secondsRemaining: Math.floor(timeAdvance),
            },
            target: user,
            priority: timeAdvance < 10 ? 'critical' : 'high',
          };
          
          // Include AI prediction and analysis data in payload
          await this.sendWarning(warning, aiPrediction, aiAnalysis);
        }
      }
      
      this.lastProcessedEvent = event.timestamp;
    }
  }

  /**
   * Check if user is within warning radius
   */
  private isWithinWarningRadius(
    event: EarthquakeEvent,
    userLat: number,
    userLon: number
  ): boolean {
    const distance = this.calculateDistance(
      event.latitude,
      event.longitude,
      userLat,
      userLon
    );
    return distance <= this.WARNING_RADIUS_KM;
  }

  /**
   * Calculate distance in kilometers
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get all registered users with push tokens and locations
   */
  private async getRegisteredUsers(): Promise<WarningTarget[]> {
    try {
      const result = await pool.query(`
        SELECT 
          user_id,
          push_token,
          last_latitude,
          last_longitude,
          device_type
        FROM user_locations
        WHERE push_token IS NOT NULL
          AND last_latitude IS NOT NULL
          AND last_longitude IS NOT NULL
          AND updated_at > NOW() - INTERVAL '1 hour'
      `);
      
      return result.rows.map((row) => ({
        userId: row.user_id,
        pushToken: row.push_token,
        latitude: row.last_latitude,
        longitude: row.last_longitude,
        deviceType: row.device_type || 'ios',
      }));
    } catch (error) {
      console.error('❌ Failed to get registered users:', error);
      return [];
    }
  }

  /**
   * Send warning via APNs (iOS) or FCM (Android)
   * ELITE: Includes AI prediction and analysis data
   */
  private async sendWarning(
    warning: EarthquakeWarning,
    aiPrediction?: any,
    aiAnalysis?: any
  ) {
    console.log(
      `📢 Sending ${warning.priority} warning: ${warning.eta.secondsRemaining}s to ${warning.target.userId}`
    );
    
    const payload = {
      event: {
        magnitude: warning.event.magnitude,
        region: warning.event.region,
        timestamp: warning.event.timestamp,
        latitude: warning.event.latitude,
        longitude: warning.event.longitude,
        depth: warning.event.depth,
        source: warning.event.source,
        verified: warning.event.verified,
      },
      warning: {
        secondsRemaining: warning.eta.secondsRemaining,
        intensity: warning.eta.estimatedShakingIntensity,
        action: warning.eta.recommendedAction,
        priority: warning.priority,
      },
      // ELITE: Include AI prediction data (single call for all users)
      aiPrediction: aiPrediction ? {
        confidence: aiPrediction.confidence,
        estimatedMagnitude: aiPrediction.estimatedMagnitude,
        timeAdvance: aiPrediction.timeAdvance,
        probability: aiPrediction.probability,
        urgency: aiPrediction.urgency,
        recommendedAction: aiPrediction.recommendedAction,
      } : null,
      // ELITE: Include AI analysis data (single call for all users)
      aiAnalysis: aiAnalysis ? {
        riskLevel: aiAnalysis.riskLevel,
        userMessage: aiAnalysis.userMessage,
        recommendations: aiAnalysis.recommendations,
        confidence: aiAnalysis.confidence,
        sources: aiAnalysis.sources,
      } : null,
    };
    
    try {
      // Send to push service endpoint
      const response = await fetch('http://localhost:3001/push/send-warning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushToken: warning.target.pushToken,
          deviceType: warning.target.deviceType,
          payload,
        }),
      });
      
      if (!response.ok) {
        console.error(`❌ Failed to send warning: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Warning send error:', error);
    }
  }
}

// Singleton instance
export const earthquakeWarningService = new EarthquakeWarningService();

