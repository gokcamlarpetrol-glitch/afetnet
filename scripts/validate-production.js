#!/usr/bin/env node

/**
 * Production validator for AfetNet (No-IAP model).
 * Focuses on safety-critical app integrity and App Store readiness basics.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const resolveFirstExistingPath = (candidates, fallback) => {
  for (const relPath of candidates) {
    if (fs.existsSync(path.join(ROOT, relPath))) {
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
const IOS_APP_ICON_CONTENTS_PATH = `${IOS_APP_DIR}/Images.xcassets/AppIcon.appiconset/Contents.json`;
const CRITICAL_TEST_FILES = [
  'src/core/services/__tests__/MessagingReliability.test.ts',
  'src/core/services/__tests__/GroupChatService.test.ts',
  'src/core/services/__tests__/IdentityService.test.ts',
  'src/core/utils/__tests__/familyLocation.test.ts',
  'src/core/utils/__tests__/dateUtils.test.ts',
];
const CRITICAL_TEST_CMD = `npm run -s test -- --watchman=false --runInBand ${CRITICAL_TEST_FILES.join(' ')}`;

let hasErrors = false;
const errors = [];
const warnings = [];

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  hasErrors = true;
  errors.push(message);
  console.log(`FAIL ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`WARN ${message}`);
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function checkFileExists(relPath, required = true) {
  if (fileExists(relPath)) {
    pass(`File exists: ${relPath}`);
    return true;
  }

  if (required) {
    fail(`Missing required file: ${relPath}`);
  } else {
    warn(`Missing optional file: ${relPath}`);
  }
  return false;
}

function checkContains(relPath, needle, description, required = true) {
  if (!fileExists(relPath)) {
    if (required) {
      fail(`${description} (file missing: ${relPath})`);
    } else {
      warn(`${description} (file missing: ${relPath})`);
    }
    return;
  }

  const content = readFile(relPath);
  if (content.includes(needle)) {
    pass(description);
  } else if (required) {
    fail(`${description} (not found: ${needle})`);
  } else {
    warn(`${description} (not found: ${needle})`);
  }
}

function checkRegex(relPath, pattern, description, required = true) {
  if (!fileExists(relPath)) {
    if (required) {
      fail(`${description} (file missing: ${relPath})`);
    } else {
      warn(`${description} (file missing: ${relPath})`);
    }
    return;
  }

  const content = readFile(relPath);
  if (pattern.test(content)) {
    pass(description);
  } else if (required) {
    fail(`${description} (pattern not found: ${pattern})`);
  } else {
    warn(`${description} (pattern not found: ${pattern})`);
  }
}

function listSourceFiles(dirPath) {
  const abs = path.join(ROOT, dirPath);
  if (!fs.existsSync(abs)) {
    return [];
  }

  const out = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);

      if (entry.isDirectory()) {
        if (['node_modules', '.git', '.expo', 'ios', 'android', 'build', 'dist', 'coverage'].includes(entry.name)) {
          continue;
        }
        walk(full);
        continue;
      }

      if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
  }

  walk(abs);
  return out;
}

function rel(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function scanForPatterns(pathsToScan, patterns, limit = 30) {
  const files = [];
  for (const p of pathsToScan) {
    const abs = path.join(ROOT, p);
    if (!fs.existsSync(abs)) {
      continue;
    }

    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(p));
    } else if (stat.isFile()) {
      files.push(abs);
    }
  }

  const findings = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        findings.push(`${rel(file)} :: ${pattern}`);
        break;
      }
    }
    if (findings.length >= limit) {
      break;
    }
  }

  return findings;
}

function runCommand(command, description, required = true) {
  try {
    execSync(command, { stdio: 'pipe', encoding: 'utf8' });
    pass(description);
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
    const snippet = output.split('\n').slice(0, 20).join('\n');

    if (required) {
      fail(`${description}\n${snippet}`);
    } else {
      warn(`${description}\n${snippet}`);
    }
  }
}

console.log('PRODUCTION VALIDATION (NO-IAP)');
console.log('===============================');

console.log('\n[1] Project structure');
[
  'app.config.ts',
  'firestore.rules',
  'src/core/App.tsx',
  'src/core/screens/auth/LoginScreen.tsx',
  'src/core/screens/auth/EmailRegisterScreen.tsx',
  'src/core/screens/auth/ForgotPasswordScreen.tsx',
  'src/core/services/AuthService.ts',
  'src/core/stores/authStore.ts',
  'src/core/services/HybridMessageService.ts',
  'src/core/services/FamilyTrackingService.ts',
  'src/core/screens/messages/ConversationScreen.tsx',
  'src/core/screens/messages/SOSConversationScreen.tsx',
  'src/core/screens/family/FamilyScreen.tsx',
  'src/core/screens/family/FamilyGroupChatScreen.tsx',
  'src/core/screens/map/MapScreen.tsx',
  IOS_INFO_PLIST_PATH,
  IOS_PRIVACY_MANIFEST_PATH,
  IOS_APP_ICON_CONTENTS_PATH,
  'android/app/src/main/AndroidManifest.xml',
].forEach(file => checkFileExists(file, true));

console.log('\n[2] Authentication flow');
checkContains('src/core/services/AuthService.ts', 'signInWithGoogle', 'AuthService includes Google sign-in');
checkContains('src/core/services/AuthService.ts', 'signInWithApple', 'AuthService includes Apple sign-in');
checkContains('src/core/services/AuthService.ts', 'signInWithEmail', 'AuthService includes Email sign-in');
checkContains('src/core/services/AuthService.ts', 'signUpWithEmail', 'AuthService includes Email sign-up');
checkContains('src/core/services/AuthService.ts', 'syncUserProfile', 'AuthService includes profile sync');
checkContains('src/core/screens/auth/LoginScreen.tsx', 'handleGoogleLogin', 'LoginScreen has Google login handler');
checkContains('src/core/screens/auth/LoginScreen.tsx', 'handleAppleLogin', 'LoginScreen has Apple login handler');
checkContains('src/core/screens/auth/LoginScreen.tsx', 'EmailAuthService.login', 'LoginScreen uses EmailAuthService.login');
checkContains('src/core/screens/auth/EmailRegisterScreen.tsx', 'EmailAuthService.register', 'EmailRegisterScreen uses EmailAuthService.register');
checkContains('src/core/stores/authStore.ts', 'onAuthStateChanged', 'authStore subscribes Firebase auth state');

console.log('\n[3] Messaging, family, and map critical safeguards');
checkContains('src/core/services/HybridMessageService.ts', 'private getSelfIdentityIds()', 'HybridMessageService defines self identity alias resolver');
checkRegex('src/core/services/HybridMessageService.ts', /ids\.add\(identity\.id\)/, 'HybridMessageService tracks identity.id aliases');
checkRegex('src/core/services/HybridMessageService.ts', /ids\.add\(identity\.deviceId\)/, 'HybridMessageService tracks identity.deviceId aliases');
checkContains('src/core/services/HybridMessageService.ts', 'getDeviceIdFromLib', 'HybridMessageService includes physical device id fallback');
checkContains('src/core/services/HybridMessageService.ts', 'toDeviceId: message.recipientId || \'broadcast\'', 'HybridMessageService writes cloud toDeviceId for routing');
checkRegex('src/core/services/HybridMessageService.ts', /recipientId:\s*toDeviceId\s*&&\s*toDeviceId\s*!==\s*'broadcast'\s*\?\s*toDeviceId\s*:\s*undefined/, 'HybridMessageService restores recipientId from cloud payload');
checkContains('src/core/screens/messages/ConversationScreen.tsx', 'const selfIds = useMemo', 'ConversationScreen maintains selfIds set');
checkContains('src/core/screens/messages/ConversationScreen.tsx', 'selfIds.has(msg.to)', 'ConversationScreen filters inbound by recipient');
checkContains('src/core/screens/messages/SOSConversationScreen.tsx', 'selfIds.has(msg.to)', 'SOSConversationScreen filters inbound by recipient');
checkContains('src/core/services/FamilyTrackingService.ts', 'const candidateAliases = [', 'FamilyTrackingService builds multi-alias check-in target set');
checkRegex('src/core/services/FamilyTrackingService.ts', /\btargetCloudUid\s*=/, 'FamilyTrackingService resolves cloud UID for check-in routing');
checkContains('src/core/services/FamilyTrackingService.ts', 'const targetMeshId', 'FamilyTrackingService resolves mesh target for offline routing');
checkContains('src/core/services/FamilyTrackingService.ts', 'targetDeviceId: targetMeshId || targetCloudUid', 'FamilyTrackingService sends BLE check-in with resolved target id');
checkContains('src/core/services/FamilyTrackingService.ts', 'getDeviceIdFromLib', 'FamilyTrackingService includes physical device id fallback');
checkRegex('src/core/screens/map/MapScreen.tsx', /familyTrackingService\.stopTracking\([^)]*\)/, 'MapScreen stops tracking on cleanup');

console.log('\n[4] Firestore security rules');
checkContains('firestore.rules', 'function isDeviceReadable(deviceId)', 'Rules define device readability helper');
checkContains('firestore.rules', 'function isSenderOwned(senderDeviceId)', 'Rules define sender ownership helper');
checkContains('firestore.rules', 'allow read: if isDeviceReadable(deviceId);', 'Rules restrict device reads to owner/family');
checkRegex('firestore.rules', /isSenderOwned\((request\.resource|resource)\.data\.fromDeviceId\)/, 'Rules enforce message sender ownership');

console.log('\n[5] Platform compliance basics');
checkContains(IOS_INFO_PLIST_PATH, 'NSLocationWhenInUseUsageDescription', 'Info.plist has foreground location usage description');
checkContains(IOS_INFO_PLIST_PATH, 'NSLocationAlwaysAndWhenInUseUsageDescription', 'Info.plist has background location usage description');
checkContains(IOS_INFO_PLIST_PATH, 'NSBluetoothAlwaysUsageDescription', 'Info.plist has Bluetooth usage description');
checkContains(IOS_INFO_PLIST_PATH, 'NSCameraUsageDescription', 'Info.plist has camera usage description');
checkContains(IOS_INFO_PLIST_PATH, 'UIBackgroundModes', 'Info.plist defines background modes');
checkContains(IOS_PRIVACY_MANIFEST_PATH, 'NSPrivacyAccessedAPITypes', 'Privacy manifest defines accessed API categories');
checkContains('android/app/src/main/AndroidManifest.xml', 'ACCESS_FINE_LOCATION', 'Android manifest has fine location permission');
checkContains('android/app/src/main/AndroidManifest.xml', 'ACCESS_BACKGROUND_LOCATION', 'Android manifest has background location permission');
checkContains('android/app/src/main/AndroidManifest.xml', 'BLUETOOTH_SCAN', 'Android manifest has BLE scan permission');

if (fileExists(IOS_APP_ICON_CONTENTS_PATH)) {
  try {
    const iconJson = JSON.parse(readFile(IOS_APP_ICON_CONTENTS_PATH));
    const has1024 = Array.isArray(iconJson.images) && iconJson.images.some(img => img.size === '1024x1024');
    if (has1024) {
      pass('App icon set includes a 1024x1024 icon entry');
    } else {
      fail('App icon set missing 1024x1024 icon entry');
    }
  } catch (error) {
    fail(`Failed to parse AppIcon Contents.json: ${error.message}`);
  }
}

console.log('\n[6] No-IAP policy checks');
if (fileExists('package.json')) {
  const pkg = JSON.parse(readFile('package.json'));
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
  };

  ['react-native-iap', 'react-native-purchases', 'expo-in-app-purchases', 'revenuecat'].forEach(name => {
    if (Object.prototype.hasOwnProperty.call(deps, name)) {
      fail(`Banned billing dependency present: ${name}`);
    } else {
      pass(`Banned billing dependency absent: ${name}`);
    }
  });

  const preSubmit = pkg.scripts?.['pre-submit'] || '';
  if (/iap:check|verify-revenuecat/i.test(preSubmit)) {
    fail('pre-submit script still references legacy IAP checks');
  } else {
    pass('pre-submit script does not reference legacy IAP checks');
  }
}

const iapFindings = scanForPatterns(
  ['src', 'app.config.ts'],
  [
    /from\s+['"]react-native-iap['"]/,
    /from\s+['"]react-native-purchases['"]/,
    /from\s+['"]expo-in-app-purchases['"]/,
    /purchasePackage\s*\(/,
    /restorePurchases\s*\(/,
  ],
  20,
);

if (iapFindings.length > 0) {
  fail('Found IAP/billing references while app is configured as no-IAP:');
  iapFindings.forEach(item => console.log(`  - ${item}`));
} else {
  pass('No IAP/billing references found in src and app.config.ts');
}

console.log('\n[7] Placeholder and beta text scan');
const placeholderFindings = scanForPatterns(
  ['src/core/screens', 'src/core/components'],
  [/["'`]([^"'`]*(coming soon|yak[ıi]nda\s+(aktif|eklenecek|gelecek)|\bbeta\b|\bdemo\b)[^"'`]*)["'`]/i],
  20,
);

if (placeholderFindings.length > 0) {
  warn('Potential placeholder/beta strings found (manual review required):');
  placeholderFindings.forEach(item => console.log(`  - ${item}`));
} else {
  pass('No forbidden placeholder/beta strings found');
}

console.log('\n[8] Static and unit quality gates');
runCommand('npm run -s typecheck', 'TypeScript typecheck passes', true);
runCommand(CRITICAL_TEST_CMD, 'Critical messaging/family/date tests pass', true);
runCommand('npm run -s healthcheck', 'Healthcheck passes', true);

console.log('\nSummary');
console.log('-------');
console.log(`Errors: ${errors.length}`);
console.log(`Warnings: ${warnings.length}`);

if (errors.length > 0) {
  console.log('\nTop errors:');
  errors.slice(0, 15).forEach((item, idx) => console.log(`${idx + 1}. ${item}`));
}

if (warnings.length > 0) {
  console.log('\nTop warnings:');
  warnings.slice(0, 15).forEach((item, idx) => console.log(`${idx + 1}. ${item}`));
}

process.exit(hasErrors ? 1 : 0);
