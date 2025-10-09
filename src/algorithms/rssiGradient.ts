export interface RSSISample {
  rssi: number;
  lat: number;
  lon: number;
  timestamp: number;
  deviceId: string;
}

export interface LocationEstimate {
  lat: number;
  lon: number;
  confidence: number;
  samplesUsed: number;
  bboxApprox?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export function computeWeightedCentroid(samples: RSSISample[]): LocationEstimate {
  if (samples.length === 0) {
    return { lat: 0, lon: 0, confidence: 0, samplesUsed: 0 };
  }

  if (samples.length === 1) {
    return {
      lat: samples[0].lat,
      lon: samples[0].lon,
      confidence: 0.1,
      samplesUsed: 1
    };
  }

  // Exponential weight model: weight = exp(rssi/10) for better sensitivity
  const weights = samples.map(sample => Math.exp(sample.rssi / 10));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  if (totalWeight === 0) {
    // Fallback to simple average
    const avgLat = samples.reduce((sum, s) => sum + s.lat, 0) / samples.length;
    const avgLon = samples.reduce((sum, s) => sum + s.lon, 0) / samples.length;
    return {
      lat: avgLat,
      lon: avgLon,
      confidence: 0.3,
      samplesUsed: samples.length
    };
  }

  // Weighted centroid
  let weightedLat = 0;
  let weightedLon = 0;

  for (let i = 0; i < samples.length; i++) {
    const weight = weights[i] / totalWeight;
    weightedLat += samples[i].lat * weight;
    weightedLon += samples[i].lon * weight;
  }

  // Calculate bounding box for confidence estimation
  const lats = samples.map(s => s.lat);
  const lons = samples.map(s => s.lon);
  const bboxApprox = {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons)
  };

  // Confidence based on sample count, weight distribution, and spatial spread
  const spatialSpread = Math.max(
    bboxApprox.maxLat - bboxApprox.minLat,
    bboxApprox.maxLon - bboxApprox.minLon
  );
  
  const weightVariance = weights.reduce((sum, w) => {
    const normalized = w / totalWeight;
    return sum + Math.pow(normalized - (1 / samples.length), 2);
  }, 0) / samples.length;

  // Higher confidence for more samples, better weight distribution, and smaller spread
  const confidence = Math.min(0.9, Math.max(0.1,
    0.2 + // base confidence
    (samples.length / 10) * 0.3 + // more samples = higher confidence
    (1 - weightVariance) * 0.2 + // better weight distribution
    (1 - Math.min(spatialSpread * 1000, 1)) * 0.3 // smaller spread = higher confidence
  ));

  return {
    lat: weightedLat,
    lon: weightedLon,
    confidence,
    samplesUsed: samples.length,
    bboxApprox
  };
}

export function combineEstimates(estimates: LocationEstimate[], alpha: number = 0.7): LocationEstimate {
  if (estimates.length === 0) {
    return { lat: 0, lon: 0, confidence: 0, samplesUsed: 0 };
  }

  if (estimates.length === 1) {
    return estimates[0];
  }

  // EWMA (Exponentially Weighted Moving Average) combination
  let combinedLat = estimates[0].lat;
  let combinedLon = estimates[0].lon;
  let totalSamples = estimates[0].samplesUsed;
  let maxConfidence = estimates[0].confidence;

  for (let i = 1; i < estimates.length; i++) {
    const estimate = estimates[i];
    
    // Weight by confidence
    const weight = estimate.confidence;
    
    // EWMA update
    combinedLat = alpha * combinedLat + (1 - alpha) * estimate.lat;
    combinedLon = alpha * combinedLon + (1 - alpha) * estimate.lon;
    
    totalSamples += estimate.samplesUsed;
    maxConfidence = Math.max(maxConfidence, estimate.confidence);
  }

  // Combined confidence is the maximum of individual confidences
  // but reduced if estimates are very different
  const avgConfidence = estimates.reduce((sum, e) => sum + e.confidence, 0) / estimates.length;
  const combinedConfidence = Math.min(maxConfidence, avgConfidence * 1.1);

  return {
    lat: combinedLat,
    lon: combinedLon,
    confidence: combinedConfidence,
    samplesUsed: totalSamples
  };
}

export function filterRecentSamples(samples: RSSISample[], maxAgeMs: number = 30000): RSSISample[] {
  const now = Date.now();
  return samples.filter(sample => (now - sample.timestamp) <= maxAgeMs);
}

export function groupSamplesByDevice(samples: RSSISample[]): Map<string, RSSISample[]> {
  const grouped = new Map<string, RSSISample[]>();
  
  for (const sample of samples) {
    if (!grouped.has(sample.deviceId)) {
      grouped.set(sample.deviceId, []);
    }
    grouped.get(sample.deviceId)!.push(sample);
  }
  
  return grouped;
}

export function getStrongestSamples(samples: RSSISample[], count: number = 5): RSSISample[] {
  return samples
    .sort((a, b) => b.rssi - a.rssi)
    .slice(0, count);
}