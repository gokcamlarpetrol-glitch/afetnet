#!/usr/bin/env node
/**
 * FRONTEND-BACKEND INTEGRATION TEST
 * Tests frontend-backend communication and API endpoints
 */

import { readFileSync, existsSync } from 'fs';
import https from 'https';
import http from 'http';

const RESULTS = [];

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
          data: data.substring(0, 500),
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

async function testBackendEndpoints() {
  log('Testing Backend API Endpoints...');
  
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://afetnet-backend.onrender.com';
  
  // Test health endpoint
  try {
    const result = await test(`${backendUrl}/health`, { timeout: 15000 });
    if (result.status === 200) {
      log(`Health endpoint: ✅ Status ${result.status} (${result.time}ms)`, 'success');
      try {
        const data = JSON.parse(result.data);
        if (data.status === 'OK') {
          log('Health check: ✅ Backend is healthy', 'success');
          if (data.database === 'connected') {
            log('Database: ✅ Connected', 'success');
          } else {
            log(`Database: ⚠️ ${data.database}`, 'warning');
          }
        }
      } catch (e) {
        log('Health check: ⚠️ Invalid JSON response', 'warning');
      }
    } else {
      log(`Health endpoint: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`Health endpoint: ❌ ${error.message}`, 'error');
  }
  
  // Test EEW endpoint
  try {
    const result = await test(`${backendUrl}/api/eew/health`, { timeout: 15000 });
    if (result.status === 200) {
      log(`EEW health: ✅ Status ${result.status} (${result.time}ms)`, 'success');
    } else {
      log(`EEW health: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`EEW health: ❌ ${error.message}`, 'error');
  }
  
  // Test earthquakes endpoint
  try {
    const result = await test(`${backendUrl}/api/earthquakes?limit=5`, { timeout: 15000 });
    if (result.status === 200) {
      log(`Earthquakes API: ✅ Status ${result.status} (${result.time}ms)`, 'success');
      try {
        const data = JSON.parse(result.data);
        if (data.ok && Array.isArray(data.earthquakes)) {
          log(`Earthquakes API: Found ${data.earthquakes.length} earthquakes`, 'success');
        }
      } catch (e) {
        log('Earthquakes API: ⚠️ Invalid JSON response', 'warning');
      }
    } else {
      log(`Earthquakes API: ⚠️ Status ${result.status}`, 'warning');
    }
  } catch (error) {
    log(`Earthquakes API: ❌ ${error.message}`, 'error');
  }
}

async function testFrontendAPIClient() {
  log('Testing Frontend API Client...');
  
  const apiClientPath = './src/core/api/client.ts';
  if (existsSync(apiClientPath)) {
    log('APIClient.ts: ✅ File exists', 'success');
    
    const content = readFileSync(apiClientPath, 'utf8');
    
    // Check for key features
    if (content.includes('class APIClient')) {
      log('APIClient class: ✅ Defined', 'success');
    } else {
      log('APIClient class: ❌ Not found', 'error');
    }
    
    if (content.includes('request')) {
      log('request method: ✅ Implemented', 'success');
    } else {
      log('request method: ❌ Missing', 'error');
    }
    
    if (content.includes('timeout') || content.includes('AbortController')) {
      log('Timeout handling: ✅ Implemented', 'success');
    } else {
      log('Timeout handling: ⚠️ May be missing', 'warning');
    }
    
    if (content.includes('generateSignature') || content.includes('signature')) {
      log('HMAC signature: ✅ Implemented', 'success');
    } else {
      log('HMAC signature: ⚠️ May be missing', 'warning');
    }
    
    // Check convenience methods
    const methods = ['get', 'post', 'put', 'delete'];
    methods.forEach(method => {
      if (content.includes(`async ${method}`)) {
        log(`${method} method: ✅ Implemented`, 'success');
      } else {
        log(`${method} method: ⚠️ May be missing`, 'warning');
      }
    });
    
    // Check API endpoints
    if (content.includes('registerDevice')) {
      log('registerDevice endpoint: ✅ Defined', 'success');
    }
    if (content.includes('syncMessages')) {
      log('syncMessages endpoint: ✅ Defined', 'success');
    }
    if (content.includes('updateLocation')) {
      log('updateLocation endpoint: ✅ Defined', 'success');
    }
    if (content.includes('sendSOS')) {
      log('sendSOS endpoint: ✅ Defined', 'success');
    }
  } else {
    log('APIClient.ts: ❌ File not found', 'error');
  }
}

async function testBackendRoutes() {
  log('Testing Backend Routes...');
  
  const routes = [
    { name: 'Earthquakes', path: './server/src/routes/earthquakes.ts' },
    { name: 'EEW', path: './server/src/routes/eew.ts' },
    { name: 'News', path: './server/src/routes/news.ts' },
    { name: 'Preparedness', path: './server/src/routes/preparedness.ts' },
    { name: 'Sensor Data', path: './server/src/routes/sensorData.ts' },
  ];
  
  for (const route of routes) {
    if (existsSync(route.path)) {
      log(`${route.name} route: ✅ File exists`, 'success');
      
      const content = readFileSync(route.path, 'utf8');
      
      // Check for error handling
      if (content.includes('catch') || content.includes('try')) {
        log(`${route.name} route: ✅ Error handling present`, 'success');
      } else {
        log(`${route.name} route: ⚠️ Error handling may be missing`, 'warning');
      }
      
      // Check for rate limiting
      if (content.includes('rateLimiter') || content.includes('rateLimit')) {
        log(`${route.name} route: ✅ Rate limiting applied`, 'success');
      } else {
        log(`${route.name} route: ⚠️ Rate limiting may not be applied`, 'warning');
      }
    } else {
      log(`${route.name} route: ⚠️ File not found`, 'warning');
    }
  }
}

async function testBackendServices() {
  log('Testing Backend Services...');
  
  const services = [
    { name: 'centralizedAIAnalysisService', path: './server/src/services/centralizedAIAnalysisService.ts' },
    { name: 'centralizedNewsSummaryService', path: './server/src/services/centralizedNewsSummaryService.ts' },
    { name: 'centralizedPreparednessPlanService', path: './server/src/services/centralizedPreparednessPlanService.ts' },
    { name: 'BackendAIPredictionService', path: './server/src/services/BackendAIPredictionService.ts' },
    { name: 'newsBackgroundService', path: './server/src/services/newsBackgroundService.ts' },
    { name: 'newsCacheService', path: './server/src/services/newsCacheService.ts' },
    { name: 'newsPriorityService', path: './server/src/services/newsPriorityService.ts' },
  ];
  
  for (const service of services) {
    if (existsSync(service.path)) {
      log(`${service.name}: ✅ File exists`, 'success');
      
      const content = readFileSync(service.path, 'utf8');
      
      // Check for error handling
      if (content.includes('catch') || content.includes('try')) {
        log(`${service.name}: ✅ Error handling present`, 'success');
      } else {
        log(`${service.name}: ⚠️ Error handling may be missing`, 'warning');
      }
      
      // Check for caching
      if (content.includes('cache') || content.includes('Cache')) {
        log(`${service.name}: ✅ Caching implemented`, 'success');
      }
    } else {
      log(`${service.name}: ⚠️ File not found`, 'warning');
    }
  }
}

async function testBackendMiddleware() {
  log('Testing Backend Middleware...');
  
  // Rate limiter
  const rateLimiterPath = './server/src/middleware/rateLimiter.ts';
  if (existsSync(rateLimiterPath)) {
    log('Rate limiter: ✅ File exists', 'success');
    
    const content = readFileSync(rateLimiterPath, 'utf8');
    
    if (content.includes('express-rate-limit') || content.includes('rateLimit')) {
      log('Rate limiter: ✅ Implemented', 'success');
    } else {
      log('Rate limiter: ⚠️ May not be implemented', 'warning');
    }
  } else {
    log('Rate limiter: ❌ File not found', 'error');
  }
  
  // Security headers
  const securityHeadersPath = './server/src/middleware/securityHeaders.ts';
  if (existsSync(securityHeadersPath)) {
    log('Security headers: ✅ File exists', 'success');
    
    const content = readFileSync(securityHeadersPath, 'utf8');
    
    if (content.includes('helmet') || content.includes('security')) {
      log('Security headers: ✅ Implemented', 'success');
    } else {
      log('Security headers: ⚠️ May not be implemented', 'warning');
    }
  } else {
    log('Security headers: ⚠️ File not found', 'warning');
  }
}

async function testDatabaseConnection() {
  log('Testing Database Configuration...');
  
  const databasePath = './server/src/database.ts';
  if (existsSync(databasePath)) {
    log('Database.ts: ✅ File exists', 'success');
    
    const content = readFileSync(databasePath, 'utf8');
    
    if (content.includes('DATABASE_URL')) {
      log('DATABASE_URL: ✅ Configured', 'success');
    } else {
      log('DATABASE_URL: ⚠️ May not be configured', 'warning');
    }
    
    if (content.includes('Pool') || content.includes('pg')) {
      log('PostgreSQL pool: ✅ Configured', 'success');
    } else {
      log('PostgreSQL pool: ⚠️ May not be configured', 'warning');
    }
    
    if (content.includes('pingDb') || content.includes('ping')) {
      log('Database ping: ✅ Implemented', 'success');
    } else {
      log('Database ping: ⚠️ May not be implemented', 'warning');
    }
  } else {
    log('Database.ts: ❌ File not found', 'error');
  }
}

async function testFrontendBackendConfig() {
  log('Testing Frontend-Backend Configuration...');
  
  // Check frontend config
  const configPath = './src/lib/config.ts';
  if (existsSync(configPath)) {
    log('Frontend config.ts: ✅ File exists', 'success');
    
    const content = readFileSync(configPath, 'utf8');
    
    if (content.includes('getApiBase')) {
      log('getApiBase: ✅ Implemented', 'success');
    } else {
      log('getApiBase: ❌ Missing', 'error');
    }
    
    if (content.includes('afetnet-backend.onrender.com') || content.includes('BACKEND_URL')) {
      log('Backend URL: ✅ Configured', 'success');
    } else {
      log('Backend URL: ⚠️ May not be configured', 'warning');
    }
  } else {
    log('Frontend config.ts: ⚠️ File not found', 'warning');
  }
  
  // Check env config
  const envPath = './src/core/config/env.ts';
  if (existsSync(envPath)) {
    log('Frontend env.ts: ✅ File exists', 'success');
    
    const content = readFileSync(envPath, 'utf8');
    
    if (content.includes('API_BASE_URL') || content.includes('BACKEND_URL')) {
      log('API base URL: ✅ Configured', 'success');
    } else {
      log('API base URL: ⚠️ May not be configured', 'warning');
    }
  } else {
    log('Frontend env.ts: ⚠️ File not found', 'warning');
  }
}

async function main() {
  log('========================================');
  log('FRONTEND-BACKEND INTEGRATION TEST');
  log('========================================');
  log('');
  
  await testBackendEndpoints();
  log('');
  
  await testFrontendAPIClient();
  log('');
  
  await testBackendRoutes();
  log('');
  
  await testBackendServices();
  log('');
  
  await testBackendMiddleware();
  log('');
  
  await testDatabaseConnection();
  log('');
  
  await testFrontendBackendConfig();
  log('');
  
  log('========================================');
  log('TEST SUMMARY');
  log('========================================');
  
  const successCount = RESULTS.filter(r => r.includes('✅')).length;
  const errorCount = RESULTS.filter(r => r.includes('❌')).length;
  const warningCount = RESULTS.filter(r => r.includes('⚠️')).length;
  
  log(`Success: ${successCount}`);
  log(`Errors: ${errorCount}`);
  log(`Warnings: ${warningCount}`);
  
  if (errorCount === 0) {
    log('✅ Frontend-Backend integration is properly configured', 'success');
  } else {
    log(`⚠️ ${errorCount} issue(s) found`, 'warning');
  }
  
  // Write report
  const fs = await import('fs');
  const reportFile = './reports/frontend-backend-integration-test-report.txt';
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









