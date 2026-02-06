#!/usr/bin/env node

/**
 * NO-IAP POLICY VERIFICATION
 * Confirms the app does not ship an in-app purchase SDK or billing flow.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_ROOT = path.join(ROOT, 'src');

const bannedPackages = [
  'react-native-iap',
  'react-native-purchases',
  'expo-in-app-purchases',
  'revenuecat',
];

const bannedPatterns = [
  /from\s+['"]react-native-iap['"]/,
  /from\s+['"]react-native-purchases['"]/,
  /from\s+['"]expo-in-app-purchases['"]/,
  /RevenueCat/i,
  /purchasePackage\s*\(/,
  /restorePurchases\s*\(/,
];

let hasError = false;
const warnings = [];

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  hasError = true;
  console.log(`FAIL ${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`WARN ${message}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listSourceFiles(dir) {
  const out = [];

  if (!fs.existsSync(dir)) {
    return out;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'ios', 'android', 'build', 'dist', '.expo'].includes(entry.name)) {
        continue;
      }
      out.push(...listSourceFiles(full));
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }

  return out;
}

function toRelative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

console.log('NO-IAP POLICY VERIFICATION');
console.log('==========================');

const pkg = readJson(path.join(ROOT, 'package.json'));
const dependencySets = [pkg.dependencies || {}, pkg.devDependencies || {}];

for (const banned of bannedPackages) {
  const found = dependencySets.some(depSet => Object.prototype.hasOwnProperty.call(depSet, banned));
  if (found) {
    fail(`Banned billing dependency found in package.json: ${banned}`);
  } else {
    pass(`No banned billing dependency: ${banned}`);
  }
}

const preSubmit = pkg.scripts?.['pre-submit'] || '';
if (/iap:check|verify-revenuecat|test:iap|verify:iap/i.test(preSubmit)) {
  fail('pre-submit script still references IAP checks');
} else {
  pass('pre-submit script does not enforce IAP checks');
}

const files = listSourceFiles(SRC_ROOT);
const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const pattern of bannedPatterns) {
    if (pattern.test(content)) {
      findings.push(`${toRelative(file)} :: ${String(pattern)}`);
      break;
    }
  }
}

if (findings.length > 0) {
  fail('IAP/billing code references found in source files');
  findings.slice(0, 20).forEach(item => console.log(`  - ${item}`));
  if (findings.length > 20) {
    warn(`... ${findings.length - 20} additional matches omitted`);
  }
} else {
  pass('No IAP/billing code references found in source files');
}

const appConfigPath = path.join(ROOT, 'app.config.ts');
if (fs.existsSync(appConfigPath)) {
  const appConfig = fs.readFileSync(appConfigPath, 'utf8');
  if (/RC_IOS_KEY|RC_ANDROID_KEY/.test(appConfig)) {
    fail('app.config.ts still exposes RevenueCat keys');
  } else {
    pass('app.config.ts does not expose RevenueCat keys');
  }
}

console.log('\nSummary');
console.log('-------');
console.log(`Warnings: ${warnings.length}`);
console.log(`Result: ${hasError ? 'FAILED' : 'PASSED'}`);

process.exit(hasError ? 1 : 0);
