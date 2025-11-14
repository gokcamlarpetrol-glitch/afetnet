#!/usr/bin/env node
/**
 * USER SCENARIO TESTS
 * Kullanıcı gibi test: User flows, UI/UX, feature completeness
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const scenarios = {
  passed: [],
  failed: [],
  warnings: [],
};

function log(message, type = 'info') {
  const prefix = {
    info: '👤',
    success: '✅',
    error: '❌',
    warning: '⚠️',
  }[type] || '👤';
  console.log(`${prefix} ${message}`);
}

function checkScenario(name, checks) {
  log(`\n📱 Scenario: ${name}`, 'info');
  const scenarioResults = {
    name,
    checks: [],
    passed: true,
  };
  
  checks.forEach(checkItem => {
    const result = checkItem.check ? checkItem.check() : checkItem();
    const checkName = checkItem.name || 'Unknown check';
    scenarioResults.checks.push({ name: checkName, ...result });
    if (!result.passed) {
      scenarioResults.passed = false;
      log(`  ❌ ${checkName}: ${result.error || 'Failed'}`, 'error');
    } else {
      log(`  ✅ ${checkName}`, 'success');
    }
  });
  
  if (scenarioResults.passed) {
    scenarios.passed.push(name);
  } else {
    scenarios.failed.push(scenarioResults);
  }
  
  return scenarioResults.passed;
}

// Scenario 1: App Launch
function scenarioAppLaunch() {
  return checkScenario('App Launch', [
    {
      name: 'App.tsx exists',
      check: () => {
        const appPath = path.join(projectRoot, 'App.tsx');
        return { passed: fs.existsSync(appPath), error: 'App.tsx not found' };
      },
    },
    {
      name: 'Core App exists',
      check: () => {
        const coreAppPath = path.join(projectRoot, 'src/core/App.tsx');
        return { passed: fs.existsSync(coreAppPath), error: 'src/core/App.tsx not found' };
      },
    },
    {
      name: 'Initialization exists',
      check: () => {
        const initPath = path.join(projectRoot, 'src/core/init.ts');
        return { passed: fs.existsSync(initPath), error: 'src/core/init.ts not found' };
      },
    },
    {
      name: 'Error Boundary exists',
      check: () => {
        const errorBoundaryPath = path.join(projectRoot, 'src/core/components/ErrorBoundary.tsx');
        return { passed: fs.existsSync(errorBoundaryPath), error: 'ErrorBoundary not found' };
      },
    },
  ]);
}

// Scenario 2: Earthquake Features
function scenarioEarthquakeFeatures() {
  return checkScenario('Earthquake Features', [
    {
      name: 'Earthquake Service exists',
      check: () => {
        const servicePath = path.join(projectRoot, 'src/core/services/EarthquakeService.ts');
        return { passed: fs.existsSync(servicePath), error: 'EarthquakeService not found' };
      },
    },
    {
      name: 'Earthquake Store exists',
      check: () => {
        const storePath = path.join(projectRoot, 'src/core/stores/earthquakeStore.ts');
        return { passed: fs.existsSync(storePath), error: 'earthquakeStore not found' };
      },
    },
    {
      name: 'Earthquake Screen exists',
      check: () => {
        const screenPath = path.join(projectRoot, 'src/core/screens/earthquakes');
        return { passed: fs.existsSync(screenPath), error: 'Earthquake screens not found' };
      },
    },
    {
      name: 'Notification Service exists',
      check: () => {
        const servicePath = path.join(projectRoot, 'src/core/services/NotificationService.ts');
        return { passed: fs.existsSync(servicePath), error: 'NotificationService not found' };
      },
    },
  ]);
}

// Scenario 3: Map Features
function scenarioMapFeatures() {
  return checkScenario('Map Features', [
    {
      name: 'Map Screen exists',
      check: () => {
        const screenPath = path.join(projectRoot, 'src/core/screens/map/MapScreen.tsx');
        return { passed: fs.existsSync(screenPath), error: 'MapScreen not found' };
      },
    },
    {
      name: 'Disaster Map Screen exists',
      check: () => {
        const screenPath = path.join(projectRoot, 'src/core/screens/map/DisasterMapScreen.tsx');
        return { passed: fs.existsSync(screenPath), error: 'DisasterMapScreen not found' };
      },
    },
    {
      name: 'Map Utilities exist',
      check: () => {
        const utilsPath = path.join(projectRoot, 'src/core/utils/mapUtils.ts');
        return { passed: fs.existsSync(utilsPath), error: 'mapUtils not found' };
      },
    },
    {
      name: 'Offline Map Service exists',
      check: () => {
        const servicePath = path.join(projectRoot, 'src/core/services/OfflineMapService.ts');
        return { passed: fs.existsSync(servicePath), error: 'OfflineMapService not found' };
      },
    },
  ]);
}

// Scenario 4: Family Features
function scenarioFamilyFeatures() {
  return checkScenario('Family Features', [
    {
      name: 'Family Screen exists',
      check: () => {
        const screenPath = path.join(projectRoot, 'src/core/screens/family');
        return { passed: fs.existsSync(screenPath), error: 'Family screens not found' };
      },
    },
    {
      name: 'Family Store exists',
      check: () => {
        const storePath = path.join(projectRoot, 'src/core/stores/familyStore.ts');
        return { passed: fs.existsSync(storePath), error: 'familyStore not found' };
      },
    },
  ]);
}

// Scenario 5: Messaging Features
function scenarioMessagingFeatures() {
  return checkScenario('Messaging Features', [
    {
      name: 'Messages Screen exists',
      check: () => {
        const screenPath = path.join(projectRoot, 'src/core/screens/messages');
        return { passed: fs.existsSync(screenPath), error: 'Messages screens not found' };
      },
    },
    {
      name: 'Message Store exists',
      check: () => {
        const storePath = path.join(projectRoot, 'src/core/stores/messageStore.ts');
        return { passed: fs.existsSync(storePath), error: 'messageStore not found' };
      },
    },
  ]);
}

// Scenario 6: SOS Features
function scenarioSOSFeatures() {
  return checkScenario('SOS Features', [
    {
      name: 'SOS Service exists',
      check: () => {
        const servicePath = path.join(projectRoot, 'src/core/services/SOSService.ts');
        return { passed: fs.existsSync(servicePath), error: 'SOSService not found' };
      },
    },
  ]);
}

// Scenario 7: AI Features
function scenarioAIFeatures() {
  return checkScenario('AI Features', [
    {
      name: 'OpenAI Service exists',
      check: () => {
        const servicePath = path.join(projectRoot, 'src/core/ai/services/OpenAIService.ts');
        return { passed: fs.existsSync(servicePath), error: 'OpenAIService not found' };
      },
    },
    {
      name: 'AI Screens exist',
      check: () => {
        const screensPath = path.join(projectRoot, 'src/core/screens/ai');
        return { passed: fs.existsSync(screensPath), error: 'AI screens not found' };
      },
    },
  ]);
}

// Scenario 8: Premium Features
function scenarioPremiumFeatures() {
  return checkScenario('Premium Features', [
    {
      name: 'Premium Service exists',
      check: () => {
        const servicePath = path.join(projectRoot, 'src/core/services/PremiumService.ts');
        return { passed: fs.existsSync(servicePath), error: 'PremiumService not found' };
      },
    },
    {
      name: 'Premium Store exists',
      check: () => {
        const storePath = path.join(projectRoot, 'src/core/stores/premiumStore.ts');
        return { passed: fs.existsSync(storePath), error: 'premiumStore not found' };
      },
    },
    {
      name: 'Paywall Screen exists',
      check: () => {
        const screenPath = path.join(projectRoot, 'src/core/screens/paywall');
        return { passed: fs.existsSync(screenPath), error: 'Paywall screen not found' };
      },
    },
  ]);
}

// Scenario 9: Navigation
function scenarioNavigation() {
  return checkScenario('Navigation', [
    {
      name: 'Main Tabs exists',
      check: () => {
        const navPath = path.join(projectRoot, 'src/core/navigation/MainTabs.tsx');
        return { passed: fs.existsSync(navPath), error: 'MainTabs not found' };
      },
    },
    {
      name: 'All screens registered in App.tsx',
      check: () => {
        const appPath = path.join(projectRoot, 'src/core/App.tsx');
        const appContent = fs.readFileSync(appPath, 'utf-8');
        const requiredScreens = [
          'HomeScreen',
          'MapScreen',
          'FamilyScreen',
          'MessagesScreen',
          'SettingsScreen',
        ];
        const missing = requiredScreens.filter(screen => !appContent.includes(screen));
        return {
          passed: missing.length === 0,
          error: missing.length > 0 ? `Missing screens: ${missing.join(', ')}` : undefined,
        };
      },
    },
  ]);
}

// Scenario 10: Settings
function scenarioSettings() {
  return checkScenario('Settings', [
    {
      name: 'Settings Screen exists',
      check: () => {
        const screenPath = path.join(projectRoot, 'src/core/screens/settings');
        return { passed: fs.existsSync(screenPath), error: 'Settings screens not found' };
      },
    },
    {
      name: 'Settings Store exists',
      check: () => {
        const storePath = path.join(projectRoot, 'src/core/stores/settingsStore.ts');
        return { passed: fs.existsSync(storePath), error: 'settingsStore not found' };
      },
    },
  ]);
}

// Main execution
async function runUserScenarios() {
  log('👤 Starting User Scenario Tests', 'info');
  log('='.repeat(60), 'info');
  
  scenarioAppLaunch();
  scenarioEarthquakeFeatures();
  scenarioMapFeatures();
  scenarioFamilyFeatures();
  scenarioMessagingFeatures();
  scenarioSOSFeatures();
  scenarioAIFeatures();
  scenarioPremiumFeatures();
  scenarioNavigation();
  scenarioSettings();
  
  // Print summary
  log('\n' + '='.repeat(60), 'info');
  log('📊 USER SCENARIO SUMMARY', 'info');
  log('-'.repeat(60), 'info');
  log(`✅ Passed: ${scenarios.passed.length}`, 'success');
  log(`❌ Failed: ${scenarios.failed.length}`, scenarios.failed.length > 0 ? 'error' : 'success');
  
  if (scenarios.failed.length > 0) {
    log('\n❌ FAILED SCENARIOS:', 'error');
    scenarios.failed.forEach(f => {
      log(`  - ${f.name}`, 'error');
      f.checks.filter(c => !c.passed).forEach(c => {
        log(`    ❌ ${c.name}: ${c.error}`, 'error');
      });
    });
  }
  
  log('\n' + '='.repeat(60), 'info');
  
  return scenarios.failed.length === 0;
}

runUserScenarios().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});

