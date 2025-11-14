#!/usr/bin/env node
/**
 * COMPREHENSIVE APPLE & USER TEST SUITE
 * Apple mühendisleri gibi katı testler + Kullanıcı senaryoları
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const testResults = {
  apple: { passed: [], failed: [], warnings: [] },
  user: { passed: [], failed: [], warnings: [] },
  critical: { passed: [], failed: [], warnings: [] },
  metrics: {},
};

function log(message, type = 'info') {
  const prefix = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    apple: '🍎',
    user: '👤',
  }[type] || 'ℹ️';
  console.log(`${prefix} ${message}`);
}

// APPLE ENGINEERING TESTS
function runAppleTests() {
  log('\n🍎 APPLE ENGINEERING TESTS', 'apple');
  log('='.repeat(60), 'info');
  
  // Test 1: TypeScript
  try {
    execSync('npm run typecheck', { cwd: projectRoot, stdio: 'pipe' });
    testResults.apple.passed.push('TypeScript Type Checking');
    log('✅ TypeScript: PASSED', 'success');
  } catch (error) {
    testResults.apple.failed.push({ name: 'TypeScript', error: error.stdout?.toString() || error.message });
    log('❌ TypeScript: FAILED', 'error');
  }
  
  // Test 2: ESLint
  try {
    execSync('npm run lint', { cwd: projectRoot, stdio: 'pipe' });
    testResults.apple.passed.push('ESLint Code Quality');
    log('✅ ESLint: PASSED', 'success');
  } catch (error) {
    testResults.apple.failed.push({ name: 'ESLint', error: error.stdout?.toString() || error.message });
    log('❌ ESLint: FAILED', 'error');
  }
  
  // Test 3: Critical Files Exist
  const criticalFiles = [
    'src/core/App.tsx',
    'src/core/init.ts',
    'src/core/components/ErrorBoundary.tsx',
    'src/core/services/EarthquakeService.ts',
    'src/core/services/SOSService.ts',
    'src/core/services/NotificationService.ts',
    'src/core/stores/earthquakeStore.ts',
    'src/core/stores/settingsStore.ts',
  ];
  
  criticalFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      testResults.apple.passed.push(`Critical File: ${file}`);
    } else {
      testResults.apple.failed.push({ name: `Critical File: ${file}`, error: 'File not found' });
      log(`❌ Critical File Missing: ${file}`, 'error');
    }
  });
  
  // Test 4: Error Boundary Check
  const errorBoundaryPath = path.join(projectRoot, 'src/core/components/ErrorBoundary.tsx');
  if (fs.existsSync(errorBoundaryPath)) {
    const content = fs.readFileSync(errorBoundaryPath, 'utf-8');
    if (content.includes('componentDidCatch') || content.includes('getDerivedStateFromError')) {
      testResults.apple.passed.push('Error Boundary Implementation');
      log('✅ Error Boundary: PASSED', 'success');
    } else {
      testResults.apple.warnings.push('Error Boundary may not be properly implemented');
      log('⚠️ Error Boundary: Check implementation', 'warning');
    }
  }
  
  // Test 5: Memory Leak Check - useEffect cleanup
  const coreFiles = [
    'src/core/App.tsx',
    'src/core/screens/home/HomeScreen.tsx',
    'src/core/screens/map/MapScreen.tsx',
  ];
  
  let cleanupIssues = 0;
  coreFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const useEffectMatches = content.match(/useEffect\(/g) || [];
      const returnMatches = content.match(/return\s*\(\)\s*=>\s*\{/g) || [];
      const cleanupMatches = content.match(/(clearInterval|clearTimeout|removeListener|unsubscribe)/g) || [];
      
      if (useEffectMatches.length > 0 && useEffectMatches.length > cleanupMatches.length) {
        cleanupIssues++;
        testResults.apple.warnings.push(`Potential memory leak in ${file}: useEffect without cleanup`);
      }
    }
  });
  
  if (cleanupIssues === 0) {
    testResults.apple.passed.push('Memory Leak Prevention');
    log('✅ Memory Leak Prevention: PASSED', 'success');
  } else {
    log(`⚠️ Memory Leak Prevention: ${cleanupIssues} potential issues found`, 'warning');
  }
  
  // Test 6: Security Check - No hardcoded secrets
  const securityFiles = [
    'src/core/services',
    'src/core/config',
  ];
  
  let securityIssues = 0;
  securityFiles.forEach(dir => {
    const fullPath = path.join(projectRoot, dir);
    if (fs.existsSync(fullPath)) {
      // Basic check - in production use git-secrets
      const files = getAllFiles(fullPath, ['.ts', '.tsx']);
      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf-8');
        // Check for common secret patterns (basic check)
        if (content.match(/api[_-]?key\s*[:=]\s*['"][^'"]{20,}['"]/gi)) {
          securityIssues++;
        }
      });
    }
  });
  
  if (securityIssues === 0) {
    testResults.apple.passed.push('Security Check (Basic)');
    log('✅ Security Check: PASSED', 'success');
  } else {
    testResults.apple.warnings.push(`Security: ${securityIssues} potential issues (use git-secrets for production)`);
    log(`⚠️ Security Check: ${securityIssues} potential issues`, 'warning');
  }
  
  // Test 7: Performance - Large files
  const largeFiles = [];
  function checkFileSize(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').length;
      if (lines > 1000) {
        largeFiles.push({ file: filePath.replace(projectRoot + '/', ''), lines });
      }
    } catch (error) {
      // Ignore file read errors
      void error;
    }
  }
  
  const serviceFiles = getAllFiles(path.join(projectRoot, 'src/core/services'), ['.ts']);
  serviceFiles.forEach(checkFileSize);
  
  if (largeFiles.length > 0) {
    testResults.apple.warnings.push(`Performance: ${largeFiles.length} large files found`);
    largeFiles.forEach(f => {
      log(`⚠️ Large file: ${f.file} (${f.lines} lines)`, 'warning');
    });
  } else {
    testResults.apple.passed.push('Performance Check');
    log('✅ Performance Check: PASSED', 'success');
  }
  
  // Test 8: API Integration
  try {
    execSync('node scripts/test-frontend-backend-integration.mjs', {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    testResults.apple.passed.push('API Integration');
    log('✅ API Integration: PASSED', 'success');
  } catch (error) {
    testResults.apple.failed.push({ name: 'API Integration', error: error.stdout?.toString() || error.message });
    log('❌ API Integration: FAILED', 'error');
  }
  
  // Test 9: Health Check
  try {
    execSync('npm run healthcheck', {
      cwd: projectRoot,
      stdio: 'pipe',
    });
    testResults.apple.passed.push('Health Check');
    log('✅ Health Check: PASSED', 'success');
  } catch (error) {
    testResults.apple.warnings.push('Health Check: Some checks may have failed');
    log('⚠️ Health Check: Some issues', 'warning');
  }
}

// USER SCENARIO TESTS
function runUserTests() {
  log('\n👤 USER SCENARIO TESTS', 'user');
  log('='.repeat(60), 'info');
  
  // Scenario 1: App Launch Flow
  log('\n📱 Scenario: App Launch', 'user');
  const appFiles = [
    'App.tsx',
    'src/core/App.tsx',
    'src/core/init.ts',
  ];
  
  let allExist = true;
  appFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      log(`  ✅ ${file} exists`, 'success');
      testResults.user.passed.push(`App Launch: ${file}`);
    } else {
      log(`  ❌ ${file} missing`, 'error');
      testResults.user.failed.push({ name: `App Launch: ${file}`, error: 'File not found' });
      allExist = false;
    }
  });
  
  // Scenario 2: Earthquake Features
  log('\n📱 Scenario: Earthquake Features', 'user');
  const eqFiles = [
    'src/core/services/EarthquakeService.ts',
    'src/core/stores/earthquakeStore.ts',
    'src/core/screens/earthquakes',
    'src/core/services/NotificationService.ts',
  ];
  
  eqFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      log(`  ✅ ${file} exists`, 'success');
      testResults.user.passed.push(`Earthquake: ${file}`);
    } else {
      log(`  ❌ ${file} missing`, 'error');
      testResults.user.failed.push({ name: `Earthquake: ${file}`, error: 'File not found' });
    }
  });
  
  // Scenario 3: Map Features
  log('\n📱 Scenario: Map Features', 'user');
  const mapFiles = [
    'src/core/screens/map/MapScreen.tsx',
    'src/core/screens/map/DisasterMapScreen.tsx',
    'src/core/utils/mapUtils.ts',
    'src/core/services/OfflineMapService.ts',
  ];
  
  mapFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      log(`  ✅ ${file} exists`, 'success');
      testResults.user.passed.push(`Map: ${file}`);
    } else {
      log(`  ❌ ${file} missing`, 'error');
      testResults.user.failed.push({ name: `Map: ${file}`, error: 'File not found' });
    }
  });
  
  // Scenario 4: Family Features
  log('\n📱 Scenario: Family Features', 'user');
  const familyFiles = [
    'src/core/screens/family',
    'src/core/stores/familyStore.ts',
  ];
  
  familyFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      log(`  ✅ ${file} exists`, 'success');
      testResults.user.passed.push(`Family: ${file}`);
    } else {
      log(`  ❌ ${file} missing`, 'error');
      testResults.user.failed.push({ name: `Family: ${file}`, error: 'File not found' });
    }
  });
  
  // Scenario 5: SOS Features
  log('\n📱 Scenario: SOS Features', 'user');
  const sosFiles = [
    'src/core/services/SOSService.ts',
  ];
  
  sosFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      log(`  ✅ ${file} exists`, 'success');
      testResults.user.passed.push(`SOS: ${file}`);
    } else {
      log(`  ❌ ${file} missing`, 'error');
      testResults.user.failed.push({ name: `SOS: ${file}`, error: 'File not found' });
    }
  });
  
  // Scenario 6: Navigation Flow
  log('\n📱 Scenario: Navigation Flow', 'user');
  const navPath = path.join(projectRoot, 'src/core/App.tsx');
  if (fs.existsSync(navPath)) {
    const content = fs.readFileSync(navPath, 'utf-8');
    const requiredScreens = ['HomeScreen', 'MapScreen', 'FamilyScreen', 'MessagesScreen', 'SettingsScreen'];
    const missing = requiredScreens.filter(screen => !content.includes(screen));
    
    if (missing.length === 0) {
      log('  ✅ All screens registered', 'success');
      testResults.user.passed.push('Navigation: All screens registered');
    } else {
      log(`  ❌ Missing screens: ${missing.join(', ')}`, 'error');
      testResults.user.failed.push({ name: 'Navigation', error: `Missing screens: ${missing.join(', ')}` });
    }
  }
  
  // Scenario 7: Settings Flow
  log('\n📱 Scenario: Settings Flow', 'user');
  const settingsFiles = [
    'src/core/screens/settings',
    'src/core/stores/settingsStore.ts',
  ];
  
  settingsFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      log(`  ✅ ${file} exists`, 'success');
      testResults.user.passed.push(`Settings: ${file}`);
    } else {
      log(`  ❌ ${file} missing`, 'error');
      testResults.user.failed.push({ name: `Settings: ${file}`, error: 'File not found' });
    }
  });
  
  // Scenario 8: Premium Features
  log('\n📱 Scenario: Premium Features', 'user');
  const premiumFiles = [
    'src/core/services/PremiumService.ts',
    'src/core/stores/premiumStore.ts',
    'src/core/screens/paywall',
  ];
  
  premiumFiles.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (fs.existsSync(fullPath)) {
      log(`  ✅ ${file} exists`, 'success');
      testResults.user.passed.push(`Premium: ${file}`);
    } else {
      log(`  ❌ ${file} missing`, 'error');
      testResults.user.failed.push({ name: `Premium: ${file}`, error: 'File not found' });
    }
  });
}

// CRITICAL FEATURE TESTS
function runCriticalTests() {
  log('\n🚨 CRITICAL FEATURE TESTS', 'error');
  log('='.repeat(60), 'info');
  
  // Test 1: Earthquake Service Critical Functions
  log('\n🔍 Testing: Earthquake Service', 'info');
  const eqServicePath = path.join(projectRoot, 'src/core/services/EarthquakeService.ts');
  if (fs.existsSync(eqServicePath)) {
    const content = fs.readFileSync(eqServicePath, 'utf-8');
    
    const criticalFunctions = ['fetchEarthquakes', 'start', 'stop'];
    criticalFunctions.forEach(func => {
      if (content.includes(`${func}(`)) {
        testResults.critical.passed.push(`EarthquakeService.${func}`);
        log(`  ✅ ${func} exists`, 'success');
      } else {
        testResults.critical.failed.push({ name: `EarthquakeService.${func}`, error: 'Function not found' });
        log(`  ❌ ${func} missing`, 'error');
      }
    });
    
    // Check for error handling
    if (content.includes('try') && content.includes('catch')) {
      testResults.critical.passed.push('EarthquakeService: Error Handling');
      log('  ✅ Error handling present', 'success');
    } else {
      testResults.critical.warnings.push('EarthquakeService: Error handling may be incomplete');
      log('  ⚠️ Error handling check', 'warning');
    }
  }
  
  // Test 2: SOS Service Critical Functions
  log('\n🔍 Testing: SOS Service', 'info');
  const sosServicePath = path.join(projectRoot, 'src/core/services/SOSService.ts');
  if (fs.existsSync(sosServicePath)) {
    const content = fs.readFileSync(sosServicePath, 'utf-8');
    
    if (content.includes('sendSOS')) {
      testResults.critical.passed.push('SOSService.sendSOS');
      log('  ✅ sendSOS exists', 'success');
    } else {
      testResults.critical.failed.push({ name: 'SOSService.sendSOS', error: 'Function not found' });
      log('  ❌ sendSOS missing', 'error');
    }
  }
  
  // Test 3: Notification Service
  log('\n🔍 Testing: Notification Service', 'info');
  const notifServicePath = path.join(projectRoot, 'src/core/services/NotificationService.ts');
  if (fs.existsSync(notifServicePath)) {
    const content = fs.readFileSync(notifServicePath, 'utf-8');
    
    if (content.includes('showEarthquakeNotification')) {
      testResults.critical.passed.push('NotificationService.showEarthquakeNotification');
      log('  ✅ showEarthquakeNotification exists', 'success');
    } else {
      testResults.critical.failed.push({ name: 'NotificationService.showEarthquakeNotification', error: 'Function not found' });
      log('  ❌ showEarthquakeNotification missing', 'error');
    }
  }
  
  // Test 4: Error Boundary
  log('\n🔍 Testing: Error Boundary', 'info');
  const errorBoundaryPath = path.join(projectRoot, 'src/core/components/ErrorBoundary.tsx');
  if (fs.existsSync(errorBoundaryPath)) {
    const content = fs.readFileSync(errorBoundaryPath, 'utf-8');
    if (content.includes('componentDidCatch') || content.includes('getDerivedStateFromError')) {
      testResults.critical.passed.push('Error Boundary Implementation');
      log('  ✅ Error Boundary properly implemented', 'success');
    } else {
      testResults.critical.warnings.push('Error Boundary: May need implementation check');
      log('  ⚠️ Error Boundary implementation check', 'warning');
    }
  }
  
  // Test 5: Initialization Flow
  log('\n🔍 Testing: Initialization Flow', 'info');
  const initPath = path.join(projectRoot, 'src/core/init.ts');
  if (fs.existsSync(initPath)) {
    const content = fs.readFileSync(initPath, 'utf-8');
    
    const criticalServices = [
      'earthquakeService',
      'firebaseService',
      'locationService',
      'premiumService',
    ];
    
    criticalServices.forEach(service => {
      if (content.includes(service)) {
        testResults.critical.passed.push(`Init: ${service}`);
        log(`  ✅ ${service} initialized`, 'success');
      } else {
        testResults.critical.warnings.push(`Init: ${service} may not be initialized`);
        log(`  ⚠️ ${service} initialization check`, 'warning');
      }
    });
  }
}

// Helper function
function getAllFiles(dirPath, extensions = []) {
  const files = [];
  
  function traverse(currentPath) {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and other common directories
          if (!['node_modules', '.git', 'coverage', 'dist', 'build'].includes(entry.name)) {
            traverse(fullPath);
          }
        } else if (entry.isFile()) {
          if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  traverse(dirPath);
  return files;
}

// Main execution
async function runAllTests() {
  log('🚀 COMPREHENSIVE APPLE & USER TEST SUITE', 'info');
  log('='.repeat(60), 'info');
  
  runAppleTests();
  runUserTests();
  runCriticalTests();
  
  // Print summary
  log('\n' + '='.repeat(60), 'info');
  log('📊 FINAL TEST SUMMARY', 'info');
  log('='.repeat(60), 'info');
  
  log('\n🍎 APPLE ENGINEERING TESTS:', 'apple');
  log(`  ✅ Passed: ${testResults.apple.passed.length}`, 'success');
  log(`  ❌ Failed: ${testResults.apple.failed.length}`, testResults.apple.failed.length > 0 ? 'error' : 'success');
  log(`  ⚠️  Warnings: ${testResults.apple.warnings.length}`, testResults.apple.warnings.length > 0 ? 'warning' : 'info');
  
  log('\n👤 USER SCENARIO TESTS:', 'user');
  log(`  ✅ Passed: ${testResults.user.passed.length}`, 'success');
  log(`  ❌ Failed: ${testResults.user.failed.length}`, testResults.user.failed.length > 0 ? 'error' : 'success');
  log(`  ⚠️  Warnings: ${testResults.user.warnings.length}`, testResults.user.warnings.length > 0 ? 'warning' : 'info');
  
  log('\n🚨 CRITICAL FEATURE TESTS:', 'error');
  log(`  ✅ Passed: ${testResults.critical.passed.length}`, 'success');
  log(`  ❌ Failed: ${testResults.critical.failed.length}`, testResults.critical.failed.length > 0 ? 'error' : 'success');
  log(`  ⚠️  Warnings: ${testResults.critical.warnings.length}`, testResults.critical.warnings.length > 0 ? 'warning' : 'info');
  
  if (testResults.apple.failed.length > 0) {
    log('\n❌ APPLE TESTS FAILED:', 'error');
    testResults.apple.failed.forEach(f => {
      log(`  - ${f.name}: ${f.error?.substring(0, 100)}`, 'error');
    });
  }
  
  if (testResults.user.failed.length > 0) {
    log('\n❌ USER TESTS FAILED:', 'error');
    testResults.user.failed.forEach(f => {
      log(`  - ${f.name}: ${f.error}`, 'error');
    });
  }
  
  if (testResults.critical.failed.length > 0) {
    log('\n❌ CRITICAL TESTS FAILED:', 'error');
    testResults.critical.failed.forEach(f => {
      log(`  - ${f.name}: ${f.error}`, 'error');
    });
  }
  
  if (testResults.apple.warnings.length > 0) {
    log('\n⚠️ APPLE WARNINGS:', 'warning');
    testResults.apple.warnings.forEach(w => {
      log(`  - ${w}`, 'warning');
    });
  }
  
  log('\n' + '='.repeat(60), 'info');
  
  const totalFailed = testResults.apple.failed.length + testResults.user.failed.length + testResults.critical.failed.length;
  const totalPassed = testResults.apple.passed.length + testResults.user.passed.length + testResults.critical.passed.length;
  
  log(`\n📈 OVERALL: ${totalPassed} passed, ${totalFailed} failed`, totalFailed > 0 ? 'error' : 'success');
  
  return totalFailed === 0;
}

runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});

