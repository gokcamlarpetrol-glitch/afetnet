#!/usr/bin/env node

/**
 * User-flow focused Apple-style test for current AfetNet architecture.
 * Validates critical feature files and key code-path markers.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const failures = [];
const warnings = [];

function abs(relPath) {
  return path.join(projectRoot, relPath);
}

function exists(relPath) {
  return fs.existsSync(abs(relPath));
}

function read(relPath) {
  return fs.readFileSync(abs(relPath), 'utf8');
}

function pass(name) {
  console.log(`[PASS] ${name}`);
}

function fail(name, detail = '') {
  failures.push({ name, detail });
  console.log(`[FAIL] ${name}`);
}

function warn(name, detail = '') {
  warnings.push({ name, detail });
  console.log(`[WARN] ${name}`);
}

function checkFile(relPath, name) {
  if (exists(relPath)) {
    pass(name);
  } else {
    fail(name, `Missing file: ${relPath}`);
  }
}

function checkContains(relPath, needle, name) {
  if (!exists(relPath)) {
    fail(name, `Missing file: ${relPath}`);
    return;
  }

  const content = read(relPath);
  if (content.includes(needle)) {
    pass(name);
  } else {
    fail(name, `Expected marker not found: ${needle} in ${relPath}`);
  }
}

function runCommand(name, command, required = true) {
  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    pass(name);
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
    const snippet = output.split('\n').slice(0, 25).join('\n');

    if (required) {
      fail(name, snippet || String(error.message));
    } else {
      warn(name, snippet || String(error.message));
    }
  }
}

console.log('COMPREHENSIVE APPLE USER TEST (NO-IAP)');
console.log('=======================================');

console.log('\nAuth Flow');
checkFile('src/core/screens/auth/LoginScreen.tsx', 'Login screen exists');
checkFile('src/core/screens/auth/EmailRegisterScreen.tsx', 'Email register screen exists');
checkFile('src/core/screens/auth/ForgotPasswordScreen.tsx', 'Forgot password screen exists');
checkFile('src/core/services/AuthService.ts', 'Auth service exists');
checkFile('src/core/stores/authStore.ts', 'Auth store exists');
checkContains('src/core/services/AuthService.ts', 'signInWithGoogle', 'Google auth method wired');
checkContains('src/core/services/AuthService.ts', 'signInWithApple', 'Apple auth method wired');
checkContains('src/core/services/AuthService.ts', 'signInWithEmail', 'Email login method wired');
checkContains('src/core/services/AuthService.ts', 'signUpWithEmail', 'Email register method wired');
checkContains('src/core/services/AuthService.ts', 'syncUserProfile', 'Profile sync after auth wired');
checkContains('src/core/stores/authStore.ts', 'onAuthStateChanged', 'Firebase auth listener wired');

console.log('\nMessaging Flow');
checkFile('src/core/services/HybridMessageService.ts', 'Hybrid message service exists');
checkFile('src/core/screens/messages/ConversationScreen.tsx', 'Conversation screen exists');
checkFile('src/core/screens/messages/SOSConversationScreen.tsx', 'SOS conversation screen exists');
checkContains('src/core/services/HybridMessageService.ts', 'targets.add(identity.id)', 'Cloud message subscription includes identity.id');
checkContains('src/core/services/HybridMessageService.ts', 'targets.add(identity.deviceId)', 'Cloud message subscription includes identity.deviceId');
checkContains('src/core/services/HybridMessageService.ts', 'recipientId: msg.toDeviceId', 'Cloud message mapping keeps recipientId');
checkContains('src/core/screens/messages/ConversationScreen.tsx', 'selfIds.has(msg.to)', 'Conversation recipient isolation in place');
checkContains('src/core/screens/messages/SOSConversationScreen.tsx', 'selfIds.has(msg.to)', 'SOS recipient isolation in place');

console.log('\nFamily + Map Flow');
checkFile('src/core/screens/family/FamilyScreen.tsx', 'Family screen exists');
checkFile('src/core/screens/family/AddFamilyMemberScreen.tsx', 'Add family member screen exists');
checkFile('src/core/screens/family/FamilyGroupChatScreen.tsx', 'Family group chat screen exists');
checkFile('src/core/screens/map/MapScreen.tsx', 'Map screen exists');
checkFile('src/core/services/FamilyTrackingService.ts', 'Family tracking service exists');
checkContains('src/core/services/FamilyTrackingService.ts', 'cloudTargetIds.add(identity.id)', 'Family tracking publishes identity.id');
checkContains('src/core/services/FamilyTrackingService.ts', 'cloudTargetIds.add(identity.deviceId)', 'Family tracking publishes identity.deviceId');
checkContains('src/core/screens/map/MapScreen.tsx', 'familyTrackingService.stopTracking()', 'Map tracking cleanup present');

console.log('\nBackend + Privacy');
checkFile('firestore.rules', 'Firestore rules file exists');
checkContains('firestore.rules', 'function isDeviceReadable(deviceId)', 'Firestore device access helper exists');
checkContains('firestore.rules', 'function isSenderOwned(senderDeviceId)', 'Firestore sender ownership helper exists');
checkContains('firestore.rules', '&& isSenderOwned(request.resource.data.fromDeviceId)', 'Firestore sender ownership enforced');
checkFile('ios/AfetNetebekesizAcilletiim/Info.plist', 'iOS Info.plist exists');
checkFile('ios/AfetNetebekesizAcilletiim/PrivacyInfo.xcprivacy', 'iOS privacy manifest exists');
checkContains('ios/AfetNetebekesizAcilletiim/Info.plist', 'NSLocationWhenInUseUsageDescription', 'Foreground location usage description exists');
checkContains('ios/AfetNetebekesizAcilletiim/Info.plist', 'NSLocationAlwaysAndWhenInUseUsageDescription', 'Background location usage description exists');
checkContains('ios/AfetNetebekesizAcilletiim/Info.plist', 'NSBluetoothAlwaysUsageDescription', 'Bluetooth usage description exists');

console.log('\nCommand Gates');
runCommand('No-IAP verification command', 'node scripts/verify-iap-system.js', true);
runCommand('Production validation command', 'node scripts/validate-production.js', true);
runCommand('TypeScript command', 'npm run -s typecheck', true);
if (process.env.RUN_JEST_ADVISORY === 'true') {
  runCommand('Jest command (advisory)', 'npm test -- --runInBand --watch=false --watchman=false --silent', false);
} else {
  warn('Jest command (advisory) skipped', 'Set RUN_JEST_ADVISORY=true to execute optional jest gate.');
}

console.log('\nSummary');
console.log('-------');
console.log(`Failures: ${failures.length}`);
console.log(`Warnings: ${warnings.length}`);

if (failures.length > 0) {
  console.log('\nFailure detail:');
  failures.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.name}`);
    if (item.detail) console.log(item.detail);
  });
}

if (warnings.length > 0) {
  console.log('\nWarning detail:');
  warnings.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.name}`);
    if (item.detail) console.log(item.detail);
  });
}

process.exit(failures.length > 0 ? 1 : 0);
