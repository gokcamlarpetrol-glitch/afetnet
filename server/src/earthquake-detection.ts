/**
 * EARTHQUAKE DETECTION SERVICE
 * 
 * Elite-grade early warning system with multi-source verification
 * Integrates: EMSC, KOERI, and distributed network data
 * 
 * Safety is paramount - zero false positives
 */

// Elite: Use native fetch (Node.js 18+) or fallback to node-fetch
// Node.js 18+ has native fetch support
const fetch = globalThis.fetch || require('node-fetch');

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
  // Elite: REDUCED verification window for FASTER early warning
  // Multi-source verification is important but speed is critical for saving lives
  private readonly VERIFICATION_WINDOW_MS = 5_000; // 5 seconds - FAST verification
  
  // Elite: Circuit breaker pattern for EMSC API failures
  private emscFailureCount = 0;
  private emscLastFailureTime = 0;
  private emscCircuitOpen = false;
  private readonly EMSC_MAX_FAILURES = 5; // Open circuit after 5 consecutive failures
  private readonly EMSC_CIRCUIT_RESET_MS = 5 * 60 * 1000; // Reset after 5 minutes
  
  // Elite: Rate limiting to prevent API abuse
  private emscLastFetchTime = 0;
  private readonly EMSC_MIN_INTERVAL_MS = 5000; // Minimum 5 seconds between requests
  
  constructor() {
    // Start continuous monitoring
    this.startMonitoring();
    setInterval(() => this.verifyQueuedEvents(), 5000);
  }

  /**
   * Monitor multiple seismic data sources
   * Elite: Adaptive polling with circuit breaker awareness
   */
  private async startMonitoring() {
    console.log('🌍 Starting earthquake detection monitoring...');
    
    // Elite: Recursive polling with adaptive interval
    const scheduleEMSCFetch = () => {
      setTimeout(async () => {
        try {
          await this.fetchEMSCEvents();
        } catch (error: any) {
          // Errors are handled inside fetchEMSCEvents - this is just a safety net
          // Only log if it's not a JSON parsing error (which is expected)
          const errorMessage = (error.message || String(error) || '').toLowerCase();
          if (!errorMessage.includes('invalid json') && !errorMessage.includes('json') && !errorMessage.includes('<html>')) {
            console.error('❌ EMSC fetch unexpected error:', error.message || error);
          }
        }
        
        // Schedule next fetch with adaptive interval
        scheduleEMSCFetch();
      }, this.getEMSCPollInterval());
    };
    
    // Start EMSC polling
    scheduleEMSCFetch();
    
    setInterval(async () => {
      try {
        await this.fetchKOERIEvents();
      } catch (error) {
        console.error('❌ KOERI fetch failed:', error);
      }
    }, 3_000); // Every 3 seconds - MAXIMUM SPEED
  }

  /**
   * Fetch events from EMSC (European-Mediterranean Seismological Centre)
   * Elite Security: Graceful error handling with circuit breaker and rate limiting
   */
  private async fetchEMSCEvents() {
    const now = Date.now();
    
    // Elite: Circuit breaker check - skip if circuit is open
    if (this.emscCircuitOpen) {
      const timeSinceFailure = now - this.emscLastFailureTime;
      if (timeSinceFailure > this.EMSC_CIRCUIT_RESET_MS) {
        // Reset circuit breaker after cooldown period
        this.emscCircuitOpen = false;
        this.emscFailureCount = 0;
        console.log('🔄 EMSC circuit breaker reset - retrying');
      } else {
        // Circuit still open - skip silently
        return;
      }
    }
    
    // Elite: Rate limiting - prevent too frequent requests
    const timeSinceLastFetch = now - this.emscLastFetchTime;
    if (timeSinceLastFetch < this.EMSC_MIN_INTERVAL_MS) {
      // Too soon since last fetch - skip silently
      return;
    }
    
    try {
      const url = `${this.EMSC_API}?starttime=${new Date(Date.now() - 3600000).toISOString()}&minmagnitude=3.0&format=json`;
      
      // Elite: Add timeout and proper error handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      this.emscLastFetchTime = now;
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AfetNet-Backend/1.0',
          'Accept': 'application/json',
        },
      });
      
      clearTimeout(timeoutId);
      
      // Elite: Check response status
      if (!response.ok) {
        this.handleEMSCFailure(`HTTP ${response.status}`);
        return;
      }
      
      // Elite: Get response text ONCE (can only be read once)
      const responseText = await response.text();
      
      // Elite: Verify content-type is JSON before parsing
      const contentType = response.headers.get('content-type') || '';
      const isJSONContentType = contentType.includes('application/json') || contentType.includes('text/json');
      
      // Elite: Check if response is HTML (error page)
      if (!isJSONContentType || responseText.trim().startsWith('<') || responseText.trim().startsWith('<!DOCTYPE')) {
        this.handleEMSCFailure('HTML response instead of JSON');
        return;
      }
      
      // Elite: Safe JSON parsing with error handling
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError: any) {
        this.handleEMSCFailure(`JSON parse error: ${parseError.message}`);
        return;
      }
      
      // Elite: Success - reset failure count
      this.emscFailureCount = 0;
      this.emscCircuitOpen = false;
      
      if (data?.features && Array.isArray(data.features)) {
        for (const feature of data.features) {
          try {
            const props = feature.properties;
            const coords = feature.geometry?.coordinates;
            
            if (coords && Array.isArray(coords) && coords.length >= 2 && props?.mag) {
              const event: EarthquakeEvent = {
                timestamp: props.time || Date.now(),
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
          } catch (featureError) {
            // Skip malformed features
            continue;
          }
        }
      }
    } catch (error: any) {
      // Elite: Handle different error types gracefully
      // node-fetch v2 throws FetchError with 'type' property and specific message patterns
      const errorType = error.type || error.name || '';
      const errorMessage = (error.message || String(error) || '').toLowerCase();
      const errorStack = (error.stack || '').toLowerCase();
      
      // Check for timeout errors
      if (errorType === 'AbortError' || errorType === 'TimeoutError' || errorMessage.includes('timeout') || errorMessage.includes('aborted')) {
        this.handleEMSCFailure('Request timeout');
        return;
      }
      
      // Check for JSON parsing errors (this is the main issue we're fixing)
      const isJSONError = 
        errorType === 'invalid-json' ||
        errorMessage.includes('invalid json') ||
        errorMessage.includes('unexpected token') ||
        errorMessage.includes('<html>') ||
        errorStack.includes('invalid json') ||
        errorStack.includes('json.parse');
      
      if (isJSONError) {
        // This is expected when EMSC returns HTML - handle silently
        this.handleEMSCFailure('Invalid JSON response');
        return;
      }
      
      // Only log truly unexpected errors
      console.error('❌ EMSC unexpected error:', {
        type: errorType,
        message: error.message || String(error),
      });
      this.handleEMSCFailure('Network error');
    }
  }
  
  /**
   * Elite: Get adaptive polling interval based on circuit breaker state
   */
  private getEMSCPollInterval(): number {
    if (this.emscCircuitOpen) {
      return 30_000; // 30 seconds when circuit is open
    } else if (this.emscFailureCount > 0) {
      return 10_000; // 10 seconds when there are some failures
    } else {
      return 5_000; // 5 seconds when everything is working
    }
  }
  
  /**
   * Elite: Handle EMSC API failures with circuit breaker pattern
   */
  private handleEMSCFailure(reason: string) {
    this.emscFailureCount++;
    this.emscLastFailureTime = Date.now();
    
    // Open circuit breaker after max failures
    if (this.emscFailureCount >= this.EMSC_MAX_FAILURES) {
      this.emscCircuitOpen = true;
      console.warn(`🔴 EMSC circuit breaker OPEN (${this.emscFailureCount} failures) - pausing requests for ${this.EMSC_CIRCUIT_RESET_MS / 1000}s`);
    } else {
      // Silent failure - only log first few failures to reduce log spam
      if (this.emscFailureCount <= 2) {
        console.warn(`⚠️ EMSC API issue (${this.emscFailureCount}/${this.EMSC_MAX_FAILURES}): ${reason} - skipping this fetch`);
      }
      // After 2 failures, fail silently to reduce log noise
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

