#!/usr/bin/env node

/**
 * LEGACY COMMAND COMPATIBILITY
 * `npm run test:iap` now validates that the app remains NO-IAP.
 */

const fs = require('fs');
const path = require('path');

const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const bannedPackages = [
  'react-native-iap',
  'react-native-purchases',
  'expo-in-app-purchases',
  'revenuecat',
];

const deps = {
  ...(pkg.dependencies || {}),
  ...(pkg.devDependencies || {}),
};

let failed = false;

console.log('NO-IAP CONSISTENCY TEST');
console.log('=======================');

for (const name of bannedPackages) {
  if (Object.prototype.hasOwnProperty.call(deps, name)) {
    failed = true;
    console.log(`FAIL banned dependency present: ${name}`);
  } else {
    console.log(`PASS banned dependency absent: ${name}`);
  }
}

const preSubmit = pkg.scripts?.['pre-submit'] || '';
if (/iap:check|verify-revenuecat/i.test(preSubmit)) {
  failed = true;
  console.log('FAIL pre-submit still contains legacy IAP checks');
} else {
  console.log('PASS pre-submit does not include legacy IAP checks');
}

console.log(`\nResult: ${failed ? 'FAILED' : 'PASSED'}`);
process.exit(failed ? 1 : 0);
