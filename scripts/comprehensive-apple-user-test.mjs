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
const resolveFirstExistingPath = (candidates, fallback) => {
  for (const relPath of candidates) {
    if (fs.existsSync(path.join(projectRoot, relPath))) {
      return relPath;
    }
  }
  return fallback;
};
const IOS_APP_DIR = resolveFirstExistingPath(
  ['ios/AfetNetAcilletiim', 'ios/AfetNetebekesizAcilletiim'],
  'ios/AfetNetAcilletiim',
);
const IOS_INFO_PLIST_PATH = `${IOS_APP_DIR}/Info.plist`;
const IOS_PRIVACY_MANIFEST_PATH = `${IOS_APP_DIR}/PrivacyInfo.xcprivacy`;

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

function checkRegex(relPath, pattern, name) {
  if (!exists(relPath)) {
    fail(name, `Missing file: ${relPath}`);
    return;
  }

  const content = read(relPath);
  if (pattern.test(content)) {
    pass(name);
  } else {
    fail(name, `Expected pattern not found: ${pattern} in ${relPath}`);
  }
}

function checkNotRegex(relPath, pattern, name) {
  if (!exists(relPath)) {
    fail(name, `Missing file: ${relPath}`);
    return;
  }

  const content = read(relPath);
  if (pattern.test(content)) {
    fail(name, `Unexpected pattern found: ${pattern} in ${relPath}`);
  } else {
    pass(name);
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
checkContains('src/core/services/HybridMessageService.ts', 'private getSelfIdentityIds()', 'Hybrid service self identity resolver exists');
checkRegex('src/core/services/HybridMessageService.ts', /ids\.add\(identity\.id\)/, 'Hybrid service tracks identity.id alias');
checkRegex('src/core/services/HybridMessageService.ts', /ids\.add\(identity\.deviceId\)/, 'Hybrid service tracks identity.deviceId alias');
checkContains('src/core/services/HybridMessageService.ts', 'toDeviceId: message.recipientId || \'broadcast\'', 'Cloud message write keeps toDeviceId');
checkContains('src/core/services/HybridMessageService.ts', 'let resolvedToDeviceId = toDeviceId && toDeviceId !== \'broadcast\' ? toDeviceId : undefined;', 'Cloud message mapping seeds recipientId from toDeviceId');
checkContains('src/core/services/HybridMessageService.ts', 'recipientId: resolvedToDeviceId', 'Cloud message mapping restores recipientId');
checkContains('src/core/screens/messages/ConversationScreen.tsx', 'selfIds.has(msg.to)', 'Conversation recipient isolation in place');
checkContains('src/core/screens/messages/SOSConversationScreen.tsx', 'selfIds.has(msg.to)', 'SOS recipient isolation in place');

console.log('\nFamily + Map Flow');
checkFile('src/core/screens/family/FamilyScreen.tsx', 'Family screen exists');
checkFile('src/core/screens/family/AddFamilyMemberScreen.tsx', 'Add family member screen exists');
checkFile('src/core/screens/family/FamilyGroupChatScreen.tsx', 'Family group chat screen exists');
checkFile('src/core/screens/map/MapScreen.tsx', 'Map screen exists');
checkFile('src/core/services/FamilyTrackingService.ts', 'Family tracking service exists');
checkFile('src/core/services/BackgroundLocationGuard.ts', 'Background location guard exists');
checkContains('src/core/services/FamilyTrackingService.ts', 'const candidateAliases = [', 'Family tracking alias candidates exist');
checkRegex('src/core/services/FamilyTrackingService.ts', /\btargetCloudUid\s*=/, 'Family tracking resolves cloud UID target');
checkContains('src/core/services/FamilyTrackingService.ts', 'const targetMeshId', 'Family tracking resolves mesh target');
checkRegex('src/core/screens/map/MapScreen.tsx', /familyTrackingService\.stopTracking\([^)]*\)/, 'Map tracking cleanup present');
checkContains('src/core/init.ts', "stopLegacyBackgroundLocationTasks('initializeApp')", 'Init clears stale background location tasks');
checkContains('src/core/init.ts', "stopLegacyBackgroundLocationTasks('shutdownApp')", 'Shutdown clears stale background location tasks');

console.log('\nBackend + Privacy');
checkFile('firestore.rules', 'Firestore rules file exists');
checkContains('firestore.rules', 'function isDeviceReadable(deviceId)', 'Firestore device access helper exists');
checkContains('firestore.rules', 'function isSenderOwned(senderDeviceId)', 'Firestore sender ownership helper exists');
checkRegex('firestore.rules', /isSenderOwned\((request\.resource|resource)\.data\.fromDeviceId\)/, 'Firestore sender ownership enforced');
checkFile(IOS_INFO_PLIST_PATH, 'iOS Info.plist exists');
checkFile(IOS_PRIVACY_MANIFEST_PATH, 'iOS privacy manifest exists');
checkContains(IOS_INFO_PLIST_PATH, 'NSLocationWhenInUseUsageDescription', 'Foreground location usage description exists');
checkContains(IOS_INFO_PLIST_PATH, 'NSLocationAlwaysAndWhenInUseUsageDescription', 'Background location usage description exists');
checkContains(IOS_INFO_PLIST_PATH, 'NSBluetoothAlwaysUsageDescription', 'Bluetooth usage description exists');
checkContains('src/core/screens/onboarding/OnboardingScreen.tsx', 'scrollEnabled={false}', 'Onboarding swipe bypass disabled');
checkContains('src/core/screens/onboarding/OnboardingScreen.tsx', 'Location.requestForegroundPermissionsAsync', 'Onboarding location permission prompt wired');
checkNotRegex('src/core/screens/onboarding/OnboardingScreen.tsx', />\s*Atla\s*</, 'Onboarding has no custom "Atla" bypass control');
checkContains('src/core/screens/settings/TermsOfServiceScreen.tsx', "DERHAL 112'yi arayın", 'Terms include 112 emergency disclaimer');
checkContains('src/core/components/compliance/EULAModal.tsx', 'dogrudan entegre degildir', 'EULA clarifies no direct official emergency integration');
checkContains('src/core/services/notifications/NotificationCenter.ts', 'getPermissionStatus', 'NotificationCenter startup checks notification status only');
checkNotRegex('src/core/services/notifications/NotificationCenter.ts', /async initialize\(\): Promise<void> \{[\s\S]*requestPermissions\(/, 'NotificationCenter startup does not prompt for notifications');
checkContains('src/core/services/FCMTokenService.ts', 'allowPermissionPrompt', 'FCM token init requires explicit prompt opt-in');
checkContains('src/core/stores/authStore.ts', "allowPermissionPrompt: false", 'Auth restore defers notification permission prompt');

console.log('\nCommand Gates');
runCommand('No-IAP verification command', 'node scripts/verify-iap-system.js', true);
runCommand('Production validation command', 'node scripts/validate-production.js', true);
runCommand('TypeScript command', 'npm run -s typecheck', true);
runCommand('Critical tests command', 'npm run -s test:critical', true);
runCommand(
  'Session persistence + SOS routing tests command',
  'npm test -- --watchman=false --runInBand src/core/stores/__tests__/onboardingAuthPersistence.test.ts src/core/services/__tests__/HybridMessageDeliveryMatrix.test.ts src/core/services/__tests__/SOSChannelRouter.test.ts',
  true,
);
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
