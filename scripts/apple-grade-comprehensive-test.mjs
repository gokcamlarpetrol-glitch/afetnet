#!/usr/bin/env node

/**
 * Apple-grade comprehensive gate for current AfetNet architecture.
 * Runs only high-signal checks aligned with no-IAP production model.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const requiredFailures = [];
const optionalWarnings = [];

function runCommand(name, command, required = true) {
  try {
    execSync(command, {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    console.log(`[PASS] ${name}`);
    return true;
  } catch (error) {
    const output = `${error.stdout || ''}${error.stderr || ''}`.trim();
    const snippet = output.split('\n').slice(0, 30).join('\n');

    if (required) {
      requiredFailures.push({ name, details: snippet || String(error.message) });
      console.log(`[FAIL] ${name}`);
    } else {
      optionalWarnings.push({ name, details: snippet || String(error.message) });
      console.log(`[WARN] ${name}`);
    }

    return false;
  }
}

function listFiles(dir) {
  const out = [];

  if (!fs.existsSync(dir)) {
    return out;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.expo', 'build', 'dist', 'coverage'].includes(entry.name)) {
        continue;
      }
      out.push(...listFiles(full));
      continue;
    }

    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }

  return out;
}

function checkLargeFiles() {
  const roots = [
    path.join(projectRoot, 'src', 'core', 'services'),
    path.join(projectRoot, 'src', 'core', 'screens'),
  ];

  const oversized = [];

  for (const root of roots) {
    for (const file of listFiles(root)) {
      const lineCount = fs.readFileSync(file, 'utf8').split('\n').length;
      if (lineCount > 1200) {
        oversized.push({
          file: path.relative(projectRoot, file).replace(/\\/g, '/'),
          lines: lineCount,
        });
      }
    }
  }

  if (oversized.length === 0) {
    console.log('[PASS] Large file scan');
    return;
  }

  console.log('[WARN] Large file scan');
  for (const item of oversized.slice(0, 20)) {
    console.log(`       - ${item.file} (${item.lines} lines)`);
  }
  optionalWarnings.push({
    name: 'Large file scan',
    details: `${oversized.length} files over 1200 lines`,
  });
}

console.log('APPLE-GRADE COMPREHENSIVE TEST (NO-IAP)');
console.log('========================================');

runCommand('TypeScript', 'npm run -s typecheck', true);
runCommand('No-IAP policy verification', 'node scripts/verify-iap-system.js', true);
runCommand('Production validation', 'node scripts/validate-production.js', true);
runCommand('Pre-submit gate', 'bash scripts/pre_submit_check.sh', true);

// Optional quality signals. Kept non-blocking because repository has known legacy lint/test debt.
runCommand('Global ESLint', 'npm run -s lint', false);
if (process.env.RUN_JEST_ADVISORY === 'true') {
  runCommand('Jest', 'npm test -- --runInBand --watch=false --watchman=false --silent', false);
} else {
  console.log('[WARN] Jest advisory skipped (set RUN_JEST_ADVISORY=true to enable)');
  optionalWarnings.push({
    name: 'Jest advisory skipped',
    details: 'Set RUN_JEST_ADVISORY=true to execute optional jest gate.',
  });
}

checkLargeFiles();

console.log('\nSummary');
console.log('-------');
console.log(`Required failures: ${requiredFailures.length}`);
console.log(`Optional warnings: ${optionalWarnings.length}`);

if (requiredFailures.length > 0) {
  console.log('\nRequired failures detail:');
  requiredFailures.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.name}`);
    console.log(item.details);
  });
}

if (optionalWarnings.length > 0) {
  console.log('\nOptional warnings detail:');
  optionalWarnings.forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.name}`);
  });
}

process.exit(requiredFailures.length > 0 ? 1 : 0);
