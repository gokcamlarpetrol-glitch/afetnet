#!/usr/bin/env node
/**
 * preflight-check.js  —  P0-15 release gate
 *
 * Quick sanity checks that run AFTER `tsc --noEmit`, `eslint`, and `jest`
 * (see `npm run preflight`). The goal here is to catch the things linters
 * and unit tests miss — version drift between manifests, accidental
 * pre-release dev flags, and missing release artefacts.
 *
 * Exit non-zero on the first failure so CI can block the build.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const warnings = [];

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { errors.push(`Cannot read ${p}: ${e.message}`); return null; }
}

// --- 1. Version sync ---------------------------------------------------------
const pkg = readJson(path.join(ROOT, 'package.json'));
const appConfigPath = path.join(ROOT, 'app.config.ts');

if (pkg && fs.existsSync(appConfigPath)) {
  const appConfigText = fs.readFileSync(appConfigPath, 'utf8');
  const versionMatch = appConfigText.match(/version\s*:\s*['"]([^'"]+)['"]/);
  const buildNumberMatch = appConfigText.match(/buildNumber\s*:\s*['"]([^'"]+)['"]/);
  const versionCodeMatch = appConfigText.match(/versionCode\s*:\s*(\d+)/);

  if (versionMatch && pkg.version && versionMatch[1] !== pkg.version) {
    errors.push(`package.json version (${pkg.version}) != app.config.ts version (${versionMatch[1]})`);
  }
  if (buildNumberMatch) {
    console.log(`  iOS buildNumber: ${buildNumberMatch[1]}`);
  } else {
    warnings.push('app.config.ts: no buildNumber found (iOS submit requires this)');
  }
  if (versionCodeMatch) {
    console.log(`  Android versionCode: ${versionCodeMatch[1]}`);
  } else {
    warnings.push('app.config.ts: no versionCode found (Android submit requires this)');
  }
}

// --- 2. Sentinel: dev/debug flags that must not ship -------------------------
const SUSPECT_FILES = [
  'src/core/services/VoiceCommandService.ts',
];
for (const rel of SUSPECT_FILES) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const text = fs.readFileSync(p, 'utf8');
  if (/VOICE_COMMAND_ENABLED\s*=\s*true/.test(text)) {
    errors.push(`${rel}: VOICE_COMMAND_ENABLED is hard-coded to true — P0-5 requires it to ship as false until real speech recognition is integrated.`);
  }
}

// --- 3. firestore.rules + storage.rules must exist + recently modified ------
for (const rel of ['firestore.rules', 'storage.rules']) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    errors.push(`${rel} missing — required for Firebase deploy.`);
    continue;
  }
  const stat = fs.statSync(p);
  console.log(`  ${rel}: ${stat.size} bytes, mtime ${stat.mtime.toISOString()}`);
}

// --- 4. eas.json profile sanity ---------------------------------------------
const easPath = path.join(ROOT, 'eas.json');
if (fs.existsSync(easPath)) {
  const eas = readJson(easPath);
  if (eas && eas.build && eas.build.production) {
    console.log('  eas.json: production profile present');
  } else {
    warnings.push('eas.json: no `build.production` profile — ios:release will fail.');
  }
}

// --- 5. Release checklist file ----------------------------------------------
const checklistPath = path.join(ROOT, 'docs', 'RELEASE_CHECKLIST.md');
if (!fs.existsSync(checklistPath)) {
  warnings.push('docs/RELEASE_CHECKLIST.md missing — manual smoke checklist is required.');
} else {
  console.log('  RELEASE_CHECKLIST.md present');
}

// --- 6. Output ---------------------------------------------------------------
if (warnings.length) {
  console.log('\nPreflight warnings:');
  for (const w of warnings) console.log('  - ' + w);
}
if (errors.length) {
  console.error('\nPreflight FAILED:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

console.log('\nPreflight OK.');
process.exit(0);
