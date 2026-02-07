#!/usr/bin/env node

/**
 * Production validator for AfetNet (No-IAP model).
 * Focuses on safety-critical app integrity and App Store readiness basics.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();

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
  'ios/AfetNetebekesizAcilletiim/Info.plist',
  'ios/AfetNetebekesizAcilletiim/PrivacyInfo.xcprivacy',
  'ios/AfetNetebekesizAcilletiim/Images.xcassets/AppIcon.appiconset/Contents.json',
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
checkContains('src/core/services/HybridMessageService.ts', 'targets.add(identity.id)', 'HybridMessageService subscribes by identity.id');
checkContains('src/core/services/HybridMessageService.ts', 'targets.add(identity.deviceId)', 'HybridMessageService subscribes by identity.deviceId');
checkContains('src/core/services/HybridMessageService.ts', 'getDeviceIdFromLib', 'HybridMessageService includes physical device id');
checkContains('src/core/services/HybridMessageService.ts', 'recipientId: msg.toDeviceId', 'HybridMessageService maps cloud recipientId');
checkContains('src/core/screens/messages/ConversationScreen.tsx', 'const selfIds = useMemo', 'ConversationScreen maintains selfIds set');
checkContains('src/core/screens/messages/ConversationScreen.tsx', 'selfIds.has(msg.to)', 'ConversationScreen filters inbound by recipient');
checkContains('src/core/screens/messages/SOSConversationScreen.tsx', 'selfIds.has(msg.to)', 'SOSConversationScreen filters inbound by recipient');
checkContains('src/core/services/FamilyTrackingService.ts', 'cloudTargetIds.add(identity.id)', 'FamilyTrackingService publishes for identity.id');
checkContains('src/core/services/FamilyTrackingService.ts', 'cloudTargetIds.add(identity.deviceId)', 'FamilyTrackingService publishes for identity.deviceId');
checkContains('src/core/services/FamilyTrackingService.ts', 'getDeviceIdFromLib', 'FamilyTrackingService publishes for physical device id');
checkRegex('src/core/screens/map/MapScreen.tsx', /familyTrackingService\.stopTracking\([^)]*\)/, 'MapScreen stops tracking on cleanup');

console.log('\n[4] Firestore security rules');
checkContains('firestore.rules', 'function isDeviceReadable(deviceId)', 'Rules define device readability helper');
checkContains('firestore.rules', 'function isSenderOwned(senderDeviceId)', 'Rules define sender ownership helper');
checkContains('firestore.rules', 'allow read: if isDeviceReadable(deviceId);', 'Rules restrict device reads to owner/family');
checkContains('firestore.rules', '&& isSenderOwned(request.resource.data.fromDeviceId)', 'Rules enforce message sender ownership');

console.log('\n[5] Platform compliance basics');
checkContains('ios/AfetNetebekesizAcilletiim/Info.plist', 'NSLocationWhenInUseUsageDescription', 'Info.plist has foreground location usage description');
checkContains('ios/AfetNetebekesizAcilletiim/Info.plist', 'NSLocationAlwaysAndWhenInUseUsageDescription', 'Info.plist has background location usage description');
checkContains('ios/AfetNetebekesizAcilletiim/Info.plist', 'NSBluetoothAlwaysUsageDescription', 'Info.plist has Bluetooth usage description');
checkContains('ios/AfetNetebekesizAcilletiim/Info.plist', 'NSCameraUsageDescription', 'Info.plist has camera usage description');
checkContains('ios/AfetNetebekesizAcilletiim/Info.plist', 'UIBackgroundModes', 'Info.plist defines background modes');
checkContains('ios/AfetNetebekesizAcilletiim/PrivacyInfo.xcprivacy', 'NSPrivacyAccessedAPITypes', 'Privacy manifest defines accessed API categories');
checkContains('android/app/src/main/AndroidManifest.xml', 'ACCESS_FINE_LOCATION', 'Android manifest has fine location permission');
checkContains('android/app/src/main/AndroidManifest.xml', 'ACCESS_BACKGROUND_LOCATION', 'Android manifest has background location permission');
checkContains('android/app/src/main/AndroidManifest.xml', 'BLUETOOTH_SCAN', 'Android manifest has BLE scan permission');

if (fileExists('ios/AfetNetebekesizAcilletiim/Images.xcassets/AppIcon.appiconset/Contents.json')) {
  try {
    const iconJson = JSON.parse(readFile('ios/AfetNetebekesizAcilletiim/Images.xcassets/AppIcon.appiconset/Contents.json'));
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

console.log('\n[8] TypeScript gate');
runCommand('npm run -s typecheck', 'TypeScript typecheck passes', true);

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
