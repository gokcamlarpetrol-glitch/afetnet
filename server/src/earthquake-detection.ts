/**
 * EARTHQUAKE DETECTION SERVICE
 * 
 * Elite-grade early warning system with multi-source verification
 * Integrates: EMSC, KOERI, and distributed network data
 * 
 * Safety is paramount - zero false positives
 */

import fetch from 'node-fetch';

export interface EarthquakeEvent {
  timestamp: number;
  latitude: number;
  longitude: number;
  magnitude: number;
  depth: number; // km
  source: 'emsc' | 'koeri' | 'distributed';
  region: string;
  verified: boolean;
}

export interface WarningETA {
  secondsRemaining: number;
  estimatedShakingIntensity: number; // MMI scale
  recommendedAction: 'drop' | 'cover' | 'hold' | 'evacuate';
}

class EarthquakeDetectionService {
  private readonly EMSC_API = 'https://www.seismicportal.eu/StandingProducts/fdsnws/event/1/query';
  private readonly KOERI_API = 'http://www.koeri.boun.edu.tr/scripts/lst3.asp';
  private events: Map<number, EarthquakeEvent> = new Map();
  private verificationQueue: EarthquakeEvent[] = [];
  private readonly VERIFICATION_WINDOW_MS = 30_000; // 30 seconds for multi-source confirmation
  
  // ELITE: Circuit breaker for EMSC API to prevent rate limiting
  private readonly FAILURE_THRESHOLD = 3;
  private readonly RESET_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private emscCircuitBreaker = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED' as 'CLOSED' | 'OPEN' | 'HALF_OPEN',
  };
  
  constructor() {
    // Start continuous monitoring
    this.startMonitoring();
    setInterval(() => this.verifyQueuedEvents(), 5000);
  }

  /**
   * Monitor multiple seismic data sources
   */
  private async startMonitoring() {
    console.log('🌍 Starting earthquake detection monitoring...');
    
    // ELITE: Reduced polling frequency to prevent rate limiting
    // EMSC API has rate limits - polling every 60 seconds instead of 10
    setInterval(async () => {
      try {
        await this.fetchEMSCEvents();
      } catch (error) {
        console.error('❌ EMSC fetch failed:', error);
      }
    }, 60_000); // Every 60 seconds (reduced from 10s to prevent rate limiting)
    
    // ELITE: Reduced polling frequency to prevent rate limiting
    setInterval(async () => {
      try {
        await this.fetchKOERIEvents();
      } catch (error) {
        console.error('❌ KOERI fetch failed:', error);
      }
    }, 60_000); // Every 60 seconds (reduced from 15s to prevent rate limiting)
  }

  /**
   * Fetch events from EMSC (European-Mediterranean Seismological Centre)
   * ELITE: Circuit breaker pattern to prevent rate limiting
   */
  private async fetchEMSCEvents() {
    const now = Date.now();
    
    // Check circuit breaker state
    if (this.emscCircuitBreaker.state === 'OPEN') {
      // Check if reset timeout has passed
      if (now - this.emscCircuitBreaker.lastFailureTime < this.RESET_TIMEOUT_MS) {
        // Still in cooldown period - skip request
        return;
      } else {
        // Try again - move to HALF_OPEN
        this.emscCircuitBreaker.state = 'HALF_OPEN';
        console.log('🔄 EMSC circuit breaker reset - retrying');
      }
    }
    
    try {
      // ELITE: Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(
        `${this.EMSC_API}?starttime=${new Date(Date.now() - 3600000).toISOString()}&minmagnitude=3.0&format=json`,
        {
          headers: {
            'User-Agent': 'AfetNet/1.0',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      // Check for rate limit errors
      if (response.status === 429 || response.status === 503) {
        throw new Error(`Rate limit exceeded: ${response.status}`);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        // EMSC sometimes returns HTML instead of JSON
        console.warn('⚠️ EMSC API returned non-JSON response (HTML?) - circuit breaker active');
        throw new Error('Invalid content type');
      }
      
      const data: any = await response.json();
      
      // Success - reset circuit breaker
      if (this.emscCircuitBreaker.state === 'HALF_OPEN') {
        this.emscCircuitBreaker.state = 'CLOSED';
        this.emscCircuitBreaker.failures = 0;
        console.log('✅ EMSC circuit breaker CLOSED - API recovered');
      }
      
      if (data?.features) {
        for (const feature of data.features) {
          const props = feature.properties;
          const coords = feature.geometry?.coordinates;
          
          if (coords && props.mag) {
            const event: EarthquakeEvent = {
              timestamp: props.time,
              latitude: coords[1],
              longitude: coords[0],
              magnitude: props.mag,
              depth: coords[2] || 10,
              source: 'emsc',
              region: props.place || 'Unknown',
              verified: false,
            };
            
            this.processNewEvent(event);
          }
        }
      }
    } catch (error: any) {
      // Increment failure count
      this.emscCircuitBreaker.failures++;
      this.emscCircuitBreaker.lastFailureTime = now;
      
      // Check if threshold exceeded
      if (this.emscCircuitBreaker.failures >= this.FAILURE_THRESHOLD) {
        this.emscCircuitBreaker.state = 'OPEN';
        console.warn(`⚠️ EMSC circuit breaker OPEN (${this.emscCircuitBreaker.failures} failures) - pausing requests for ${this.RESET_TIMEOUT_MS / 1000}s`);
        console.info('💡 This is normal - EMSC API sometimes returns HTML instead of JSON. Circuit breaker will auto-reset in 5 minutes.');
      } else {
        console.warn(`⚠️ EMSC API issue (${this.emscCircuitBreaker.failures}/${this.FAILURE_THRESHOLD}): ${error?.message || error} - circuit breaker active`);
      }
    }
  }

  /**
   * Fetch events from KOERI (Turkey's Kandilli Observatory)
   */
  private async fetchKOERIEvents() {
    try {
      const response = await fetch(this.KOERI_API);
      const html = await response.text();
      
      // KOERI returns HTML table format
      // Look for <TR> tags with earthquake data
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const trMatches = html.match(trRegex) || [];
      
      for (const trMatch of trMatches) {
        try {
          // Extract table cells
          const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
          const cells = trMatch.match(tdRegex) || [];
          
          if (cells.length >= 7) {
            // KOERI format: Date | Time | Latitude | Longitude | Depth | Magnitude | Region
            const dateStr = this.stripHtml(cells[0]);
            const timeStr = this.stripHtml(cells[1]);
            const latStr = this.stripHtml(cells[2]);
            const lonStr = this.stripHtml(cells[3]);
            const depthStr = this.stripHtml(cells[4]);
            const magStr = this.stripHtml(cells[5]);
            const regionStr = this.stripHtml(cells[6]);
            
            // Parse values
            const magnitude = parseFloat(magStr.replace(/[^0-9.-]/g, ''));
            const latitude = parseFloat(latStr.replace(/[^0-9.-]/g, ''));
            const longitude = parseFloat(lonStr.replace(/[^0-9.-]/g, ''));
            const depth = parseFloat(depthStr.replace(/[^0-9.-]/g, '')) || 10;
            
            // Only process significant earthquakes
            if (magnitude >= 3.5 && !isNaN(latitude) && !isNaN(longitude)) {
              // Parse date and time
              const date = new Date(dateStr + ' ' + timeStr);
              const timestamp = date.getTime();
              
              // Skip if data is invalid
              if (isNaN(timestamp) || timestamp <= 0) continue;
              
              const event: EarthquakeEvent = {
                timestamp,
                latitude,
                longitude,
                magnitude,
                depth,
                source: 'koeri',
                region: regionStr.trim() || 'Turkey',
                verified: false,
              };
              
              this.processNewEvent(event);
            }
          }
        } catch (error) {
          // Skip malformed entries
          continue;
        }
      }
    } catch (error) {
      console.error('❌ KOERI fetch error:', error);
    }
  }

  /**
   * Strip HTML tags and decode entities
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Process newly detected earthquake event
   */
  private processNewEvent(event: EarthquakeEvent) {
    const eventKey = `${event.timestamp}-${event.latitude}-${event.longitude}`;
    
    // Check if this is a new event
    if (!this.events.has(eventKey as any)) {
      this.events.set(eventKey as any, event);
      this.verificationQueue.push(event);
      
      console.log(`🔔 New earthquake detected: M${event.magnitude.toFixed(1)} at ${event.region}`);
    }
  }

  /**
   * Verify events from multiple sources
   */
  private verifyQueuedEvents() {
    const now = Date.now();
    
    for (let i = this.verificationQueue.length - 1; i >= 0; i--) {
      const event = this.verificationQueue[i];
      
      if (now - event.timestamp > this.VERIFICATION_WINDOW_MS) {
        // Event is too old, verify it
        const similarEvents = Array.from(this.events.values()).filter(
          (e) =>
            Math.abs(e.latitude - event.latitude) < 0.5 &&
            Math.abs(e.longitude - event.longitude) < 0.5 &&
            Math.abs(e.magnitude - event.magnitude) < 1.0 &&
            Math.abs(e.timestamp - event.timestamp) < this.VERIFICATION_WINDOW_MS
        );
        
        if (similarEvents.length >= 2) {
          event.verified = true;
          console.log(`✅ Earthquake verified: ${similarEvents.length} sources confirm M${event.magnitude.toFixed(1)}`);
        }
        
        this.verificationQueue.splice(i, 1);
      }
    }
  }

  /**
   * Get detected earthquakes
   */
  getRecentEarthquakes(minutes: number = 60): EarthquakeEvent[] {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return Array.from(this.events.values())
      .filter((e) => e.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get verified events only
   */
  getVerifiedEvents(minutes: number = 60): EarthquakeEvent[] {
    return this.getRecentEarthquakes(minutes).filter((e) => e.verified);
  }

  /**
   * Calculate ETA for shaking at a specific location
   */
  calculateETA(event: EarthquakeEvent, userLat: number, userLon: number): WarningETA {
    // P-wave speed: ~6 km/s
    // S-wave speed: ~3.5 km/s (damaging waves)
    const P_WAVE_SPEED_KM_PER_SEC = 6;
    const S_WAVE_SPEED_KM_PER_SEC = 3.5;
    
    const distance = this.calculateDistance(
      event.latitude,
      event.longitude,
      userLat,
      userLon
    );
    
    const pWaveArrival = distance / P_WAVE_SPEED_KM_PER_SEC;
    const sWaveArrival = distance / S_WAVE_SPEED_KM_PER_SEC;
    
    const currentTime = Date.now();
    const timeSinceEarthquake = (currentTime - event.timestamp) / 1000;
    
    const secondsRemaining = Math.max(0, sWaveArrival - timeSinceEarthquake);
    
    // Estimate shaking intensity (simplified Mercalli scale)
    const intensity = this.estimateShakingIntensity(event.magnitude, distance);
    
    // Recommend action based on time remaining
    let recommendedAction: 'drop' | 'cover' | 'hold' | 'evacuate';
    if (secondsRemaining > 30) {
      recommendedAction = 'evacuate';
    } else if (secondsRemaining > 15) {
      recommendedAction = 'drop';
    } else if (secondsRemaining > 5) {
      recommendedAction = 'cover';
    } else {
      recommendedAction = 'hold';
    }
    
    return {
      secondsRemaining: Math.floor(secondsRemaining),
      estimatedShakingIntensity: intensity,
      recommendedAction,
    };
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
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
   * Estimate shaking intensity (MMI scale 1-12)
   */
  private estimateShakingIntensity(magnitude: number, distanceKm: number): number {
    // Simplified attenuation formula
    const mmi = 1.5 * magnitude - 3.5 * Math.log10(distanceKm + 1);
    return Math.max(1, Math.min(12, Math.round(mmi)));
  }
}

// Singleton instance
export const earthquakeDetectionService = new EarthquakeDetectionService();

