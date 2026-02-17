#!/usr/bin/env node
/**
 * USER SCENARIO TESTS (ARCHITECTURE-ALIGNED)
 * Fast static/user-flow checks for current AfetNet app structure.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const scenarios = {
  passed: [],
  failed: [],
  warnings: [],
};

function abs(relPath) {
  return path.join(projectRoot, relPath);
}

function exists(relPath) {
  return fs.existsSync(abs(relPath));
}

function read(relPath) {
  return fs.readFileSync(abs(relPath), 'utf8');
}

function log(message, type = 'info') {
  const prefix = {
    info: '[INFO]',
    success: '[PASS]',
    error: '[FAIL]',
    warning: '[WARN]',
  }[type] || '[INFO]';
  console.log(`${prefix} ${message}`);
}

function checkFile(relPath, name) {
  if (exists(relPath)) {
    return { passed: true };
  }
  return { passed: false, error: `${name} missing (${relPath})` };
}

function checkContains(relPath, marker, name) {
  if (!exists(relPath)) {
    return { passed: false, error: `${name} file missing (${relPath})` };
  }
  return read(relPath).includes(marker)
    ? { passed: true }
    : { passed: false, error: `${name} marker missing: ${marker}` };
}

function checkRegex(relPath, pattern, name) {
  if (!exists(relPath)) {
    return { passed: false, error: `${name} file missing (${relPath})` };
  }
  return pattern.test(read(relPath))
    ? { passed: true }
    : { passed: false, error: `${name} pattern missing: ${pattern}` };
}

function runCommand(command, name, required = true) {
  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return { passed: true };
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
    const snippet = output.split('\n').slice(0, 20).join('\n');
    if (!required) {
      scenarios.warnings.push({ name, detail: snippet || String(error.message) });
      return { passed: true };
    }
    return { passed: false, error: `${name} failed\n${snippet}` };
  }
}

function checkScenario(name, checks) {
  log(`Scenario: ${name}`);
  const failedChecks = [];

  for (const item of checks) {
    const result = item.check();
    if (result.passed) {
      log(`  ${item.name}`, 'success');
    } else {
      log(`  ${item.name} -> ${result.error}`, 'error');
      failedChecks.push({ name: item.name, error: result.error });
    }
  }

  if (failedChecks.length === 0) {
    scenarios.passed.push(name);
    return true;
  }

  scenarios.failed.push({ name, failedChecks });
  return false;
}

function scenarioAppBootstrap() {
  return checkScenario('App Bootstrap & Navigation', [
    { name: 'Root App entry exists', check: () => checkFile('App.tsx', 'App.tsx') },
    { name: 'Core app entry exists', check: () => checkFile('src/core/App.tsx', 'CoreApp') },
    { name: 'App initialization exists', check: () => checkFile('src/core/init.ts', 'init.ts') },
    { name: 'Error boundary exists', check: () => checkFile('src/core/components/ErrorBoundary.tsx', 'ErrorBoundary') },
    { name: 'Main navigator exists', check: () => checkFile('src/core/navigation/MainNavigator.tsx', 'MainNavigator') },
    { name: 'Main tabs exists', check: () => checkFile('src/core/navigation/MainTabs.tsx', 'MainTabs') },
    { name: 'Auth route declared', check: () => checkContains('src/core/App.tsx', 'name="Auth"', 'Auth route') },
    { name: 'Main route declared', check: () => checkContains('src/core/App.tsx', 'name="Main"', 'Main route') },
    { name: 'Main tab includes Home', check: () => checkContains('src/core/navigation/MainTabs.tsx', 'name="Home"', 'Home tab') },
    { name: 'Main tab includes Map', check: () => checkContains('src/core/navigation/MainTabs.tsx', 'name="Map"', 'Map tab') },
    { name: 'Main tab includes Family', check: () => checkContains('src/core/navigation/MainTabs.tsx', 'name="Family"', 'Family tab') },
    { name: 'Main tab includes Messages', check: () => checkContains('src/core/navigation/MainTabs.tsx', 'name="Messages"', 'Messages tab') },
    { name: 'Main tab includes Settings', check: () => checkContains('src/core/navigation/MainTabs.tsx', 'name="Settings"', 'Settings tab') },
  ]);
}

function scenarioAuthFlow() {
  return checkScenario('Authentication Flow', [
    { name: 'Login screen exists', check: () => checkFile('src/core/screens/auth/LoginScreen.tsx', 'LoginScreen') },
    { name: 'Register screen exists', check: () => checkFile('src/core/screens/auth/EmailRegisterScreen.tsx', 'EmailRegisterScreen') },
    { name: 'Forgot-password screen exists', check: () => checkFile('src/core/screens/auth/ForgotPasswordScreen.tsx', 'ForgotPasswordScreen') },
    { name: 'Auth service exists', check: () => checkFile('src/core/services/AuthService.ts', 'AuthService') },
    { name: 'Auth store exists', check: () => checkFile('src/core/stores/authStore.ts', 'authStore') },
    { name: 'Google login handler wired', check: () => checkContains('src/core/screens/auth/LoginScreen.tsx', 'handleGoogleLogin', 'Google handler') },
    { name: 'Apple login handler wired', check: () => checkContains('src/core/screens/auth/LoginScreen.tsx', 'handleAppleLogin', 'Apple handler') },
    { name: 'Email login wired', check: () => checkContains('src/core/screens/auth/LoginScreen.tsx', 'EmailAuthService.login', 'Email login') },
    { name: 'Email register wired', check: () => checkContains('src/core/screens/auth/EmailRegisterScreen.tsx', 'EmailAuthService.register', 'Email register') },
    { name: 'Auth listener wired', check: () => checkContains('src/core/stores/authStore.ts', 'onAuthStateChanged', 'Auth listener') },
  ]);
}

function scenarioFamilyFlow() {
  return checkScenario('Family Flow (Add / Track / Group)', [
    { name: 'Family screen exists', check: () => checkFile('src/core/screens/family/FamilyScreen.tsx', 'FamilyScreen') },
    { name: 'Add family member screen exists', check: () => checkFile('src/core/screens/family/AddFamilyMemberScreen.tsx', 'AddFamilyMemberScreen') },
    { name: 'Family group chat screen exists', check: () => checkFile('src/core/screens/family/FamilyGroupChatScreen.tsx', 'FamilyGroupChatScreen') },
    { name: 'Family store exists', check: () => checkFile('src/core/stores/familyStore.ts', 'familyStore') },
    { name: 'Family tracking service exists', check: () => checkFile('src/core/services/FamilyTrackingService.ts', 'FamilyTrackingService') },
    { name: 'QR parse call exists', check: () => checkContains('src/core/screens/family/AddFamilyMemberScreen.tsx', 'parseQRPayload', 'QR parse') },
    { name: 'Self-add guard exists', check: () => checkContains('src/core/screens/family/AddFamilyMemberScreen.tsx', 'Kendi kimliğinizi aile üyesi olarak ekleyemezsiniz.', 'Self-add guard') },
    { name: 'Check-in cloud UID resolution exists', check: () => checkRegex('src/core/services/FamilyTrackingService.ts', /\btargetCloudUid\s*=/, 'targetCloudUid') },
    { name: 'Check-in mesh target resolution exists', check: () => checkContains('src/core/services/FamilyTrackingService.ts', 'const targetMeshId', 'targetMeshId') },
    { name: 'Unified family location resolver exists', check: () => checkFile('src/core/utils/familyLocation.ts', 'familyLocation resolver') },
    { name: 'Family screen uses location resolver', check: () => checkContains('src/core/screens/family/FamilyScreen.tsx', 'resolveFamilyMemberLocation', 'FamilyScreen location resolver usage') },
  ]);
}

function scenarioMessagingFlow() {
  return checkScenario('Messaging Flow (DM / Group / SOS)', [
    { name: 'Messages screen exists', check: () => checkFile('src/core/screens/messages/MessagesScreen.tsx', 'MessagesScreen') },
    { name: 'New message screen exists', check: () => checkFile('src/core/screens/messages/NewMessageScreen.tsx', 'NewMessageScreen') },
    { name: 'Conversation screen exists', check: () => checkFile('src/core/screens/messages/ConversationScreen.tsx', 'ConversationScreen') },
    { name: 'SOS conversation screen exists', check: () => checkFile('src/core/screens/messages/SOSConversationScreen.tsx', 'SOSConversationScreen') },
    { name: 'Hybrid message service exists', check: () => checkFile('src/core/services/HybridMessageService.ts', 'HybridMessageService') },
    { name: 'Group chat service exists', check: () => checkFile('src/core/services/GroupChatService.ts', 'GroupChatService') },
    { name: 'Self identity alias resolver exists', check: () => checkContains('src/core/services/HybridMessageService.ts', 'private getSelfIdentityIds()', 'self identity aliases') },
    { name: 'Cloud writes include toDeviceId', check: () => checkContains('src/core/services/HybridMessageService.ts', 'toDeviceId: message.recipientId || \'broadcast\'', 'toDeviceId mapping') },
    { name: 'Cloud read restores recipientId', check: () => checkRegex('src/core/services/HybridMessageService.ts', /recipientId:\s*toDeviceId/, 'recipientId restore') },
    { name: 'Conversation recipient isolation exists', check: () => checkContains('src/core/screens/messages/ConversationScreen.tsx', 'selfIds.has(msg.to)', 'Conversation selfIds filter') },
    { name: 'SOS conversation isolation exists', check: () => checkContains('src/core/screens/messages/SOSConversationScreen.tsx', 'selfIds.has(msg.to)', 'SOS selfIds filter') },
  ]);
}

function scenarioSOSFlow() {
  return checkScenario('SOS Critical Flow', [
    { name: 'Unified SOS controller exists', check: () => checkFile('src/core/services/sos/UnifiedSOSController.ts', 'UnifiedSOSController') },
    { name: 'SOS channel router exists', check: () => checkFile('src/core/services/sos/SOSChannelRouter.ts', 'SOSChannelRouter') },
    { name: 'SOS alert listener exists', check: () => checkFile('src/core/services/sos/SOSAlertListener.ts', 'SOSAlertListener') },
    { name: 'SOS ACK listener exists', check: () => checkFile('src/core/services/sos/SOSAckListener.ts', 'SOSAckListener') },
    { name: 'Nearby SOS listener exists', check: () => checkFile('src/core/services/sos/NearbySOSListener.ts', 'NearbySOSListener') },
    { name: 'SOS history screen exists', check: () => checkFile('src/core/screens/sos/SOSHistoryScreen.tsx', 'SOSHistoryScreen') },
    { name: 'ACK send method exists', check: () => checkContains('src/core/services/sos/SOSChannelRouter.ts', 'sendRescueACK', 'sendRescueACK') },
  ]);
}

function scenarioMapLocationFlow() {
  return checkScenario('Map & Location Flow', [
    { name: 'Map screen exists', check: () => checkFile('src/core/screens/map/MapScreen.tsx', 'MapScreen') },
    { name: 'Disaster map screen exists', check: () => checkFile('src/core/screens/map/DisasterMapScreen.tsx', 'DisasterMapScreen') },
    { name: 'Location service exists', check: () => checkFile('src/core/services/LocationService.ts', 'LocationService') },
    { name: 'Map tracking cleanup exists', check: () => checkRegex('src/core/screens/map/MapScreen.tsx', /familyTrackingService\.stopTracking\([^)]*\)/, 'stopTracking cleanup') },
  ]);
}

function scenarioReleaseGate() {
  return checkScenario('Release Gate', [
    { name: 'pre-submit passes', check: () => runCommand('npm run -s pre-submit', 'pre-submit') },
    { name: 'critical test pack passes', check: () => runCommand('npm run -s test:critical', 'test:critical') },
  ]);
}

async function main() {
  log('Starting user-scenario checks');
  log('------------------------------------------------------------');

  scenarioAppBootstrap();
  scenarioAuthFlow();
  scenarioFamilyFlow();
  scenarioMessagingFlow();
  scenarioSOSFlow();
  scenarioMapLocationFlow();
  scenarioReleaseGate();

  log('------------------------------------------------------------');
  log(`Passed scenarios: ${scenarios.passed.length}`, 'success');
  log(`Failed scenarios: ${scenarios.failed.length}`, scenarios.failed.length > 0 ? 'error' : 'success');
  log(`Warnings: ${scenarios.warnings.length}`, scenarios.warnings.length > 0 ? 'warning' : 'success');

  if (scenarios.failed.length > 0) {
    log('Failed scenario details:', 'error');
    scenarios.failed.forEach((scenario) => {
      log(`  - ${scenario.name}`, 'error');
      scenario.failedChecks.forEach((failed) => {
        log(`    * ${failed.name}: ${failed.error}`, 'error');
      });
    });
  }

  if (scenarios.warnings.length > 0) {
    log('Warning details:', 'warning');
    scenarios.warnings.forEach((warning) => {
      log(`  - ${warning.name}`, 'warning');
      if (warning.detail) {
        log(`    ${warning.detail}`, 'warning');
      }
    });
  }

  process.exit(scenarios.failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
