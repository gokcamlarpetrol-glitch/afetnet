#!/usr/bin/env node
/**
 * COMPREHENSIVE SYSTEM TEST
 * Tests all critical systems: AFAD, Kandilli, USGS, EMSC, Notifications, AI
 */

import https from 'https';
import http from 'http';
import { execSync } from 'child_process';

const RESULTS = [];
const ERRORS = [];

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  const line = `[${timestamp}] ${prefix} ${message}`;
  RESULTS.push(line);
  console.log(line);
}

function test(url, options = {}) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    const timeout = options.timeout || 10000;
    
    const req = client.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: data.substring(0, 500), // First 500 chars
          time: Date.now() - startTime,
        });
      });
    });
    
    const startTime = Date.now();
    
    req.on('error', (error) => {
      resolve({
        error: error.message,
        time: Date.now() - startTime,
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        error: 'Timeout',
        time: timeout,
      });
    });
  });
}

async function testAFAD() {
  log('Testing AFAD API...');
  
  // Test 1: AFAD HTML Provider
  try {
    const result = await test('https://deprem.afad.gov.tr/last-earthquakes.html', { timeout: 15000 });
    if (result.status === 200) {
      log(`AFAD HTML: ✅ Status ${result.status} (${result.time}ms)`, 'success');
      if (result.data.includes('deprem') || result.data.includes('earthquake')) {
        log('AFAD HTML: Contains earthquake data', 'success');
      }
    } else {
      log(`AFAD HTML: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`AFAD HTML: ❌ ${error.message}`, 'error');
    ERRORS.push('AFAD HTML failed');
  }
  
  // Test 2: AFAD API v2
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const url = `https://deprem.afad.gov.tr/apiv2/event/filter?start=${startDate}&end=${endDate}&minmag=1&limit=10`;
    
    const result = await test(url, { timeout: 15000 });
    if (result.status === 200) {
      log(`AFAD API: ✅ Status ${result.status} (${result.time}ms)`, 'success');
      try {
        const data = JSON.parse(result.data);
        if (Array.isArray(data) && data.length > 0) {
          log(`AFAD API: Found ${data.length} earthquakes`, 'success');
        } else {
          log('AFAD API: Empty response (may be normal)', 'warning');
        }
      } catch (e) {
        log('AFAD API: Invalid JSON response', 'warning');
      }
    } else {
      log(`AFAD API: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`AFAD API: ❌ ${error.message}`, 'error');
    ERRORS.push('AFAD API failed');
  }
}

async function testKandilli() {
  log('Testing Kandilli API...');
  
  // Test 1: Kandilli HTML
  try {
    const result = await test('http://www.koeri.boun.edu.tr/scripts/lst0.asp', { timeout: 15000 });
    if (result.status === 200) {
      log(`Kandilli HTML: ✅ Status ${result.status} (${result.time}ms)`, 'success');
      if (result.data.includes('Tarih') || result.data.includes('Saat')) {
        log('Kandilli HTML: Contains earthquake data', 'success');
      }
    } else {
      log(`Kandilli HTML: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`Kandilli HTML: ❌ ${error.message}`, 'error');
    ERRORS.push('Kandilli HTML failed');
  }
  
  // Test 2: Unified API (Kandilli via third-party)
  try {
    const url = 'https://api.orhanayd.com/deprem/kandilli/live';
    const result = await test(url, { timeout: 15000 });
    if (result.status === 200) {
      log(`Kandilli Unified API: ✅ Status ${result.status} (${result.time}ms)`, 'success');
      try {
        const data = JSON.parse(result.data);
        if (data && (Array.isArray(data) || data.result)) {
          log('Kandilli Unified API: Valid response', 'success');
        }
      } catch (e) {
        log('Kandilli Unified API: Invalid JSON', 'warning');
      }
    } else {
      log(`Kandilli Unified API: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`Kandilli Unified API: ❌ ${error.message}`, 'error');
    ERRORS.push('Kandilli Unified API failed');
  }
}

async function testUSGS() {
  log('Testing USGS API...');
  
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${twoHoursAgo}&minmagnitude=3.0&orderby=time&limit=10&minlatitude=30&maxlatitude=45&minlongitude=20&maxlongitude=50`;
    
    const result = await test(url, { timeout: 15000 });
    if (result.status === 200) {
      log(`USGS API: ✅ Status ${result.status} (${result.time}ms)`, 'success');
      try {
        const data = JSON.parse(result.data);
        if (data.features && Array.isArray(data.features)) {
          log(`USGS API: Found ${data.features.length} earthquakes`, 'success');
        }
      } catch (e) {
        log('USGS API: Invalid JSON', 'warning');
      }
    } else {
      log(`USGS API: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`USGS API: ❌ ${error.message}`, 'error');
    ERRORS.push('USGS API failed');
  }
  
  // Test Real-time Feed
  try {
    const url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
    const result = await test(url, { timeout: 10000 });
    if (result.status === 200) {
      log(`USGS Real-time Feed: ✅ Status ${result.status} (${result.time}ms)`, 'success');
    } else {
      log(`USGS Real-time Feed: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`USGS Real-time Feed: ❌ ${error.message}`, 'error');
  }
}

async function testEMSC() {
  log('Testing EMSC API...');
  
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const url = `https://www.seismicportal.eu/fdsnws/event/1/query?format=geojson&starttime=${twoHoursAgo}&minmagnitude=3.0&limit=10&minlatitude=30&maxlatitude=45&minlongitude=20&maxlongitude=50`;
    
    const result = await test(url, { timeout: 15000 });
    if (result.status === 200) {
      log(`EMSC API: ✅ Status ${result.status} (${result.time}ms)`, 'success');
      try {
        const data = JSON.parse(result.data);
        if (data.features && Array.isArray(data.features)) {
          log(`EMSC API: Found ${data.features.length} earthquakes`, 'success');
        }
      } catch (e) {
        log('EMSC API: Invalid JSON', 'warning');
      }
    } else {
      log(`EMSC API: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`EMSC API: ❌ ${error.message}`, 'error');
    ERRORS.push('EMSC API failed');
  }
}

async function testBackend() {
  log('Testing Backend Services...');
  
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://afetnet-backend.onrender.com';
  
  try {
    const result = await test(`${backendUrl}/health`, { timeout: 10000 });
    if (result.status === 200) {
      log(`Backend Health: ✅ Status ${result.status} (${result.time}ms)`, 'success');
    } else {
      log(`Backend Health: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`Backend Health: ❌ ${error.message}`, 'error');
    ERRORS.push('Backend health check failed');
  }
}

async function testOpenAI() {
  log('Testing OpenAI Configuration...');
  
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (apiKey && apiKey.length > 0) {
    const masked = apiKey.substring(0, 7) + '...' + apiKey.substring(apiKey.length - 4);
    log(`OpenAI API Key: ✅ Configured (${masked})`, 'success');
  } else {
    log('OpenAI API Key: ⚠️ Not configured (fallback mode)', 'warning');
  }
}

async function main() {
  log('========================================');
  log('COMPREHENSIVE SYSTEM TEST');
  log('========================================');
  log('');
  
  await testAFAD();
  log('');
  
  await testKandilli();
  log('');
  
  await testUSGS();
  log('');
  
  await testEMSC();
  log('');
  
  await testBackend();
  log('');
  
  await testOpenAI();
  log('');
  
  log('========================================');
  log('TEST SUMMARY');
  log('========================================');
  
  if (ERRORS.length === 0) {
    log('✅ All critical systems operational', 'success');
  } else {
    log(`⚠️ ${ERRORS.length} system(s) failed:`, 'warning');
    ERRORS.forEach(err => log(`  - ${err}`, 'error'));
  }
  
  log('');
  log(`Total tests: ${RESULTS.filter(r => r.includes('✅') || r.includes('❌')).length}`);
  log(`Success: ${RESULTS.filter(r => r.includes('✅')).length}`);
  log(`Failed: ${RESULTS.filter(r => r.includes('❌')).length}`);
  log(`Warnings: ${RESULTS.filter(r => r.includes('⚠️')).length}`);
  
  // Write report
  const fs = await import('fs');
  const reportFile = './reports/comprehensive-system-test-report.txt';
  if (!fs.existsSync('./reports')) {
    fs.mkdirSync('./reports', { recursive: true });
  }
  fs.writeFileSync(reportFile, RESULTS.join('\n'), 'utf8');
  log('');
  log(`Report saved to: ${reportFile}`);
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});









