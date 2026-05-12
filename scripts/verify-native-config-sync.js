#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REQUIRED_STORAGE_BUCKET = 'afetnet-4a6b6.firebasestorage.app';
const REQUIRED_ANDROID_TARGET_SDK = 35;
const REQUIRED_NEW_ARCH_ENABLED = 'false';

let failed = false;

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  failed = true;
  console.log(`FAIL ${message}`);
}

function requireRegex(relPath, pattern, description) {
  const content = read(relPath);
  const match = content.match(pattern);
  if (!match) {
    fail(`${description} (${relPath})`);
    return null;
  }
  pass(description);
  return match[1] ?? match[0];
}

function parseProperties(relPath) {
  const out = {};
  for (const line of read(relPath).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

console.log('NATIVE CONFIG SYNC CHECK');
console.log('========================');

const appTarget = Number(requireRegex('app.config.ts', /"targetSdkVersion":\s*(\d+)/, 'app.config.ts declares Android target SDK'));
const appCompile = Number(requireRegex('app.config.ts', /"compileSdkVersion":\s*(\d+)/, 'app.config.ts declares Android compile SDK'));
const appBuildTools = requireRegex('app.config.ts', /"buildToolsVersion":\s*"([^"]+)"/, 'app.config.ts declares Android build tools');
const appIosTarget = requireRegex('app.config.ts', /"deploymentTarget":\s*"([^"]+)"/, 'app.config.ts declares iOS deployment target');

const gradle = parseProperties('android/gradle.properties');
const gradleTarget = Number(gradle['android.targetSdkVersion']);
const gradleCompile = Number(gradle['android.compileSdkVersion']);
const gradleBuildTools = gradle['android.buildToolsVersion'];
const gradleNewArch = gradle.newArchEnabled;

if (appTarget >= REQUIRED_ANDROID_TARGET_SDK && gradleTarget >= REQUIRED_ANDROID_TARGET_SDK) {
  pass(`Android target SDK is ${REQUIRED_ANDROID_TARGET_SDK}+`);
} else {
  fail(`Android target SDK must be ${REQUIRED_ANDROID_TARGET_SDK}+ (app=${appTarget}, gradle=${gradleTarget})`);
}

if (appTarget === gradleTarget) pass('Android target SDK matches app.config.ts and gradle.properties');
else fail(`Android target SDK drift (app=${appTarget}, gradle=${gradleTarget})`);

if (appCompile === gradleCompile) pass('Android compile SDK matches app.config.ts and gradle.properties');
else fail(`Android compile SDK drift (app=${appCompile}, gradle=${gradleCompile})`);

if (appBuildTools === gradleBuildTools) pass('Android build tools version matches app.config.ts and gradle.properties');
else fail(`Android build tools drift (app=${appBuildTools}, gradle=${gradleBuildTools})`);

const podfileProps = JSON.parse(read('ios/Podfile.properties.json'));
if (podfileProps['ios.deploymentTarget'] === appIosTarget) {
  pass('iOS deployment target matches app.config.ts and Podfile.properties.json');
} else {
  fail(`iOS deployment target drift (app=${appIosTarget}, podfile=${podfileProps['ios.deploymentTarget']})`);
}

const appNewArch = requireRegex('app.config.ts', /newArchEnabled:\s*(true|false)/, 'app.config.ts declares New Architecture setting');
if (appNewArch === REQUIRED_NEW_ARCH_ENABLED && gradleNewArch === REQUIRED_NEW_ARCH_ENABLED && podfileProps.newArchEnabled === REQUIRED_NEW_ARCH_ENABLED) {
  pass('New Architecture is consistently disabled for release until native module certification is complete');
} else {
  fail(`New Architecture setting drift (app=${appNewArch}, gradle=${gradleNewArch}, podfile=${podfileProps.newArchEnabled})`);
}

const firebaseConfig = JSON.parse(read('firebase.json'));
const storageBuckets = (firebaseConfig.storage || []).map(entry => entry.bucket);
if (storageBuckets.includes(REQUIRED_STORAGE_BUCKET)) {
  pass('Firebase Storage rules target the configured app bucket');
} else {
  fail(`Firebase Storage bucket mismatch (${storageBuckets.join(', ') || 'none'})`);
}

const functionsIgnore = firebaseConfig.functions?.[0]?.ignore || [];
for (const ignoredPath of ['android', 'ios', '.expo']) {
  if (functionsIgnore.includes(ignoredPath)) pass(`Functions deploy ignores ${ignoredPath}`);
  else fail(`Functions deploy should ignore ${ignoredPath}`);
}

const backendWorkflow = read('.github/workflows/deploy-backend.yml');
if (backendWorkflow.includes("'functions/**'") && !backendWorkflow.includes("'server/**'")) {
  pass('Backend deploy workflow targets Firebase Functions paths');
} else {
  fail('Backend deploy workflow must target functions/** and not server/**');
}

process.exit(failed ? 1 : 0);
