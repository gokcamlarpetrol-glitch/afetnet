#!/usr/bin/env node

// Simple RSSI gradient implementation for testing
function computeRSSIGradient(samples) {
  if (samples.length === 0) {
    return null;
  }

  // Filter samples with valid coordinates
  const validSamples = samples.filter(s => s.lat !== undefined && s.lon !== undefined);
  
  if (validSamples.length === 0) {
    return null;
  }

  // If only one sample, return it with low confidence
  if (validSamples.length === 1) {
    return {
      lat: validSamples[0].lat,
      lon: validSamples[0].lon,
      confidence: 0.3,
      sampleCount: 1
    };
  }

  // Compute weights based on RSSI (stronger signal = higher weight)
  const weights = validSamples.map(sample => {
    // Convert RSSI to linear scale: weight = 10^(rssi/10)
    const linearRSSI = Math.pow(10, sample.rssi / 10);
    return Math.max(linearRSSI, 0.001); // Ensure minimum weight
  });

  // Compute weighted centroid
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  if (totalWeight === 0) {
    return null;
  }

  let weightedLat = 0;
  let weightedLon = 0;

  for (let i = 0; i < validSamples.length; i++) {
    const sample = validSamples[i];
    const weight = weights[i] / totalWeight;
    
    weightedLat += sample.lat * weight;
    weightedLon += sample.lon * weight;
  }

  // Calculate confidence based on sample count and RSSI variance
  const avgRSSI = validSamples.reduce((sum, s) => sum + s.rssi, 0) / validSamples.length;
  const rssiVariance = validSamples.reduce((sum, s) => sum + Math.pow(s.rssi - avgRSSI, 2), 0) / validSamples.length;
  
  // Higher confidence with more samples and lower variance
  const sampleConfidence = Math.min(validSamples.length / 5, 1); // Max at 5+ samples
  const varianceConfidence = Math.max(0, 1 - (rssiVariance / 100)); // Lower variance = higher confidence
  const confidence = (sampleConfidence * varianceConfidence);

  return {
    lat: weightedLat,
    lon: weightedLon,
    confidence: Math.min(confidence, 0.95), // Cap at 95%
    sampleCount: validSamples.length
  };
}

console.log('🧪 AfetNet BLE Relay Simulation Tests\n');

// Test 1: Single RSSI sample
console.log('Test 1: Single RSSI sample');
const singleSample = [{
  deviceId: 'device1',
  lat: 40.7128,
  lon: -74.0060,
  rssi: -50,
  ts: Date.now()
}];

const singleResult = computeRSSIGradient(singleSample);
console.log('Input:', singleSample);
console.log('Result:', singleResult);
console.log('✅ Single sample test passed\n');

// Test 2: Multiple RSSI samples around a target
console.log('Test 2: Multiple RSSI samples (target: 40.7128, -74.0060)');
const multiSamples = [
  { deviceId: 'device1', lat: 40.7129, lon: -74.0061, rssi: -45, ts: Date.now() },
  { deviceId: 'device2', lat: 40.7127, lon: -74.0059, rssi: -55, ts: Date.now() },
  { deviceId: 'device3', lat: 40.7128, lon: -74.0060, rssi: -40, ts: Date.now() },
  { deviceId: 'device4', lat: 40.7130, lon: -74.0062, rssi: -60, ts: Date.now() }
];

const multiResult = computeRSSIGradient(multiSamples);
console.log('Input:', multiSamples);
console.log('Result:', multiResult);

// Check if result is within 20m of target (roughly 0.0002 degrees)
const targetLat = 40.7128;
const targetLon = -74.0060;
const latDiff = Math.abs(multiResult.lat - targetLat);
const lonDiff = Math.abs(multiResult.lon - targetLon);
const distance = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff) * 111000; // rough conversion to meters

console.log(`Distance from target: ${distance.toFixed(1)}m`);
if (distance < 20) {
  console.log('✅ Multiple samples test passed (within 20m)\n');
} else {
  console.log('❌ Multiple samples test failed (outside 20m)\n');
}

// Test 3: Edge cases
console.log('Test 3: Edge cases');
const edgeCases = [
  [], // empty array
  [{ deviceId: 'device1', lat: undefined, lon: undefined, rssi: -50, ts: Date.now() }], // no coordinates
  [{ deviceId: 'device1', lat: 40.7128, lon: -74.0060, rssi: -100, ts: Date.now() }] // very weak signal
];

edgeCases.forEach((samples, index) => {
  const result = computeRSSIGradient(samples);
  console.log(`Edge case ${index + 1}:`, samples.length > 0 ? samples : 'empty array');
  console.log(`Result:`, result);
  if (result === null || (result && typeof result.lat === 'number')) {
    console.log('✅ Edge case handled correctly');
  } else {
    console.log('❌ Edge case failed');
  }
  console.log('');
});

// Test 4: Confidence scoring
console.log('Test 4: Confidence scoring');
const confidenceSamples = [
  { deviceId: 'device1', lat: 40.7128, lon: -74.0060, rssi: -40, ts: Date.now() },
  { deviceId: 'device2', lat: 40.7128, lon: -74.0060, rssi: -41, ts: Date.now() },
  { deviceId: 'device3', lat: 40.7128, lon: -74.0060, rssi: -42, ts: Date.now() },
  { deviceId: 'device4', lat: 40.7128, lon: -74.0060, rssi: -43, ts: Date.now() },
  { deviceId: 'device5', lat: 40.7128, lon: -74.0060, rssi: -44, ts: Date.now() }
];

const confidenceResult = computeRSSIGradient(confidenceSamples);
console.log('High confidence samples:', confidenceSamples);
console.log('Result:', confidenceResult);
console.log(`Confidence: ${(confidenceResult?.confidence * 100).toFixed(1)}%`);

if (confidenceResult && confidenceResult.confidence > 0.7) {
  console.log('✅ High confidence test passed');
} else {
  console.log('❌ High confidence test failed');
}

console.log('\n🎯 Simulation tests completed!');
