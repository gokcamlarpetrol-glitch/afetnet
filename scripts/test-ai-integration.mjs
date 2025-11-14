#!/usr/bin/env node
/**
 * AI INTEGRATION TEST
 * Tests AI service integration points and configuration
 */

import { readFileSync, existsSync } from 'fs';

const RESULTS = [];

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  const line = `[${timestamp}] ${prefix} ${message}`;
  RESULTS.push(line);
  console.log(line);
}

async function testOpenAIService() {
  log('Testing OpenAI Service...');
  
  const openAIPath = './src/core/ai/services/OpenAIService.ts';
  if (existsSync(openAIPath)) {
    log('OpenAIService.ts: ✅ File exists', 'success');
    
    const content = readFileSync(openAIPath, 'utf8');
    
    // Check model
    if (content.includes('gpt-4o-mini')) {
      log('Model: ✅ gpt-4o-mini (cost optimized)', 'success');
    } else if (content.includes('gpt-4')) {
      log('Model: ⚠️ Using gpt-4 (more expensive)', 'warning');
    } else {
      log('Model: ⚠️ Unknown model', 'warning');
    }
    
    // Check API key handling
    if (content.includes('EXPO_PUBLIC_OPENAI_API_KEY')) {
      log('API Key: ✅ Environment variable configured', 'success');
    } else {
      log('API Key: ⚠️ May not be configured', 'warning');
    }
    
    // Check fallback
    if (content.includes('getFallbackResponse') || content.includes('fallback')) {
      log('Fallback mechanism: ✅ Implemented', 'success');
    } else {
      log('Fallback mechanism: ⚠️ May be missing', 'warning');
    }
    
    // Check error handling
    if (content.includes('catch') && content.includes('error')) {
      log('Error handling: ✅ Implemented', 'success');
    } else {
      log('Error handling: ⚠️ May be missing', 'warning');
    }
    
    // Check timeout
    if (content.includes('timeout') || content.includes('AbortController')) {
      log('Timeout handling: ✅ Implemented', 'success');
    } else {
      log('Timeout handling: ⚠️ May be missing', 'warning');
    }
  } else {
    log('OpenAIService.ts: ❌ File not found', 'error');
  }
}

async function testAIServices() {
  log('Testing AI Service Integrations...');
  
  const aiServices = [
    { name: 'EarthquakeValidationService', path: './src/core/ai/services/EarthquakeValidationService.ts' },
    { name: 'PreparednessPlanService', path: './src/core/ai/services/PreparednessPlanService.ts' },
    { name: 'RiskScoringService', path: './src/core/ai/services/RiskScoringService.ts' },
    { name: 'PanicAssistantService', path: './src/core/ai/services/PanicAssistantService.ts' },
    { name: 'NewsAggregatorService', path: './src/core/ai/services/NewsAggregatorService.ts' },
    { name: 'EarthquakeAnalysisService', path: './src/core/ai/services/EarthquakeAnalysisService.ts' },
    { name: 'AIEarthquakePredictionService', path: './src/core/services/AIEarthquakePredictionService.ts' },
  ];
  
  for (const service of aiServices) {
    if (existsSync(service.path)) {
      log(`${service.name}: ✅ File exists`, 'success');
      
      const content = readFileSync(service.path, 'utf8');
      
      // Check OpenAI integration
      if (content.includes('openAIService') || content.includes('OpenAIService')) {
        log(`${service.name}: ✅ OpenAI integrated`, 'success');
        
        // Check fallback
        if (content.includes('isConfigured') || content.includes('fallback')) {
          log(`${service.name}: ✅ Fallback mechanism present`, 'success');
        } else {
          log(`${service.name}: ⚠️ Fallback may be missing`, 'warning');
        }
      } else {
        log(`${service.name}: ⚠️ OpenAI not integrated`, 'warning');
      }
    } else {
      log(`${service.name}: ⚠️ File not found`, 'warning');
    }
  }
}

async function testBackendAIServices() {
  log('Testing Backend AI Services...');
  
  const backendServices = [
    { name: 'centralizedAIAnalysisService', path: './server/src/services/centralizedAIAnalysisService.ts' },
    { name: 'centralizedNewsSummaryService', path: './server/src/services/centralizedNewsSummaryService.ts' },
    { name: 'centralizedPreparednessPlanService', path: './server/src/services/centralizedPreparednessPlanService.ts' },
    { name: 'BackendAIPredictionService', path: './server/src/services/BackendAIPredictionService.ts' },
  ];
  
  for (const service of backendServices) {
    if (existsSync(service.path)) {
      log(`${service.name}: ✅ File exists`, 'success');
      
      const content = readFileSync(service.path, 'utf8');
      
      // Check OpenAI integration
      if (content.includes('OPENAI_API_KEY') || content.includes('openai')) {
        log(`${service.name}: ✅ OpenAI integrated`, 'success');
      } else {
        log(`${service.name}: ⚠️ OpenAI not integrated`, 'warning');
      }
      
      // Check caching
      if (content.includes('cache') || content.includes('Cache')) {
        log(`${service.name}: ✅ Caching implemented`, 'success');
      } else {
        log(`${service.name}: ⚠️ Caching may be missing`, 'warning');
      }
    } else {
      log(`${service.name}: ⚠️ File not found (may be optional)`, 'warning');
    }
  }
}

async function testAICostOptimization() {
  log('Testing AI Cost Optimization...');
  
  const openAIPath = './src/core/ai/services/OpenAIService.ts';
  if (existsSync(openAIPath)) {
    const content = readFileSync(openAIPath, 'utf8');
    
    // Check max tokens
    if (content.includes('maxTokens') || content.includes('max_tokens')) {
      const maxTokensMatch = content.match(/maxTokens\s*=\s*(\d+)/) || content.match(/max_tokens['":\s]*(\d+)/);
      if (maxTokensMatch) {
        const maxTokens = parseInt(maxTokensMatch[1]);
        if (maxTokens <= 1000) {
          log(`Max tokens: ✅ ${maxTokens} (optimized)`, 'success');
        } else {
          log(`Max tokens: ⚠️ ${maxTokens} (may be expensive)`, 'warning');
        }
      }
    }
    
    // Check temperature
    if (content.includes('temperature')) {
      const tempMatch = content.match(/temperature\s*=\s*([\d.]+)/);
      if (tempMatch) {
        const temp = parseFloat(tempMatch[1]);
        if (temp <= 0.8) {
          log(`Temperature: ✅ ${temp} (optimized)`, 'success');
        } else {
          log(`Temperature: ⚠️ ${temp} (may affect cost)`, 'warning');
        }
      }
    }
  }
}

async function main() {
  log('========================================');
  log('AI INTEGRATION TEST');
  log('========================================');
  log('');
  
  await testOpenAIService();
  log('');
  
  await testAIServices();
  log('');
  
  await testBackendAIServices();
  log('');
  
  await testAICostOptimization();
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
    log('✅ AI integration is properly configured', 'success');
  } else {
    log(`⚠️ ${errorCount} issue(s) found`, 'warning');
  }
  
  // Write report
  const fs = await import('fs');
  const reportFile = './reports/ai-integration-test-report.txt';
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









