/**
 * EARTHQUAKE WARNING SERVICE
 * 
 * Elite-grade microservice for sending life-saving warnings
 * Calculates ETA, geospatial targeting, multi-source verification
 * Integrated with APNs and FCM for instant delivery
 */

import { EarthquakeEvent, WarningETA, earthquakeDetectionService } from './earthquake-detection';
import { pool } from './database';
import { centralizedAIAnalysisService, CentralizedAnalysis } from './services/centralizedAIAnalysisService';

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
  aiAnalysis?: CentralizedAnalysis; // ELITE: Centralized AI analysis (single call for all users)
}

class EarthquakeWarningService {
  private readonly WARNING_RADIUS_KM = 500; // Send warnings within 500km radius
  // Elite: LOWER threshold for EARLIER warnings (save more lives)
  private readonly MIN_MAGNITUDE = 3.5; // Warn for smaller earthquakes too (earlier warning)
  private lastProcessedEvent?: number;
  
  /**
   * Start continuous monitoring for earthquakes
   */
  startMonitoring() {
    console.log('🚨 Starting earthquake warning service monitoring...');
    
    // Elite: ULTRA-FAST monitoring for REAL early warning (1 second)
    // Check every 1 second to send warnings IMMEDIATELY
    setInterval(async () => {
      try {
        await this.processNewEarthquakes();
      } catch (error) {
        console.error('❌ Warning service error:', error);
      }
    }, 1_000); // Check every 1 second - MAXIMUM SPEED
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
      
      // ELITE: Perform centralized AI analysis (single call for all users)
      let aiAnalysis: CentralizedAnalysis | null = null;
      try {
        aiAnalysis = await centralizedAIAnalysisService.analyzeEarthquake(event);
        if (aiAnalysis) {
          console.log(`✅ AI Analysis: ${aiAnalysis.riskLevel} risk, ${aiAnalysis.confidence}% confidence, ${aiAnalysis.aiTokensUsed} tokens used`);
        }
      } catch (error) {
        console.error('❌ AI analysis failed (continuing without AI):', error);
        // Continue without AI - fallback to basic warnings
      }
      
      // Get all registered users
      const users = await this.getRegisteredUsers();
      
      // Filter users within warning radius
      const targetUsers = users.filter((user) =>
        this.isWithinWarningRadius(event, user.latitude, user.longitude)
      );
      
      // Send warnings to all target users
      for (const user of targetUsers) {
        const eta = earthquakeDetectionService.calculateETA(
          event,
          user.latitude,
          user.longitude
        );
        
        // Elite: Send warning IMMEDIATELY if ANY time remaining (even 1 second can save lives)
        // Extended range to 300 seconds (5 minutes) for maximum early warning
        if (eta.secondsRemaining > 0 && eta.secondsRemaining <= 300) {
          const warning: EarthquakeWarning = {
            event,
            eta,
            target: user,
            priority: eta.secondsRemaining < 10 ? 'critical' : 'high',
            aiAnalysis: aiAnalysis || undefined, // ELITE: Include centralized AI analysis
          };
          
          await this.sendWarning(warning);
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
   */
  private async sendWarning(warning: EarthquakeWarning) {
    console.log(
      `📢 Sending ${warning.priority} warning: ${warning.eta.secondsRemaining}s to ${warning.target.userId}`
    );
    
    // ELITE: Include AI analysis in payload (if available)
    const payload: any = {
      event: {
        magnitude: warning.event.magnitude,
        region: warning.event.region,
        timestamp: warning.event.timestamp,
      },
      warning: {
        secondsRemaining: warning.eta.secondsRemaining,
        intensity: warning.eta.estimatedShakingIntensity,
        action: warning.eta.recommendedAction,
        priority: warning.priority,
      },
    };
    
    // ELITE: Include AI analysis in payload (from centralized service)
    if (warning.aiAnalysis) {
      payload.aiAnalysis = {
        riskLevel: warning.aiAnalysis.riskLevel,
        userMessage: warning.aiAnalysis.userMessage,
        recommendations: warning.aiAnalysis.recommendations,
        confidence: warning.aiAnalysis.confidence,
      };
    }
    
    try {
      // Elite: Use environment variable for base URL or default to localhost for development
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
      const pushServiceUrl = `${baseUrl}/push/send-warning`;
      
      // Send to push service endpoint
      const response = await fetch(pushServiceUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-org-secret': process.env.ORG_SECRET || '',
        },
        body: JSON.stringify({
          pushToken: warning.target.pushToken,
          deviceType: warning.target.deviceType,
          payload,
        }),
      });
      
      if (!response.ok) {
        console.error(`❌ Failed to send warning: ${response.statusText}`);
      } else {
        console.log(`✅ Warning sent successfully to ${warning.target.userId}`);
      }
    } catch (error) {
      console.error('❌ Warning send error:', error);
    }
  }
}

// Singleton instance
export const earthquakeWarningService = new EarthquakeWarningService();

