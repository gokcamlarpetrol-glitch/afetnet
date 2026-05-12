#!/usr/bin/env node

/**
 * Release-time Firebase config hard gate.
 *
 * Goal:
 * - Fail EAS/TestFlight builds early if Firebase config is missing/misaligned.
 * - Prevent silent runtime failures on real devices (messaging/location/auth).
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PROJECT_ID = 'afetnet-4a6b6';
const EXPECTED_GCM_SENDER_ID = '702394557087';

const IOS_CANDIDATES = [
  'ios/AfetNetAcilletiim/GoogleService-Info.plist',
  'ios/AfetNetebekesizAcilletiim/GoogleService-Info.plist',
];
const IOS_ROOT_COPY = 'GoogleService-Info.plist';

const ANDROID_CANDIDATES = [
  'android/app/google-services.json',
  'google-services.json',
];

function abs(relPath) {
  return path.join(ROOT, relPath);
}

function exists(relPath) {
  return fs.existsSync(abs(relPath));
}

function read(relPath) {
  return fs.readFileSync(abs(relPath), 'utf8');
}

function write(relPath, content) {
  const target = abs(relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function fail(message) {
  console.error(`\n[firebase-release-check] FAIL: ${message}`);
  process.exit(1);
}

function info(message) {
  console.log(`[firebase-release-check] ${message}`);
}

function envValue(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function resolveFilePath(filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : abs(filePath);
}

function resolveSecretContent(prefix) {
  const base64 = envValue(`${prefix}_BASE64`);
  if (base64) {
    try {
      return Buffer.from(base64, 'base64').toString('utf8');
    } catch {
      fail(`${prefix}_BASE64 is not valid base64`);
    }
  }

  const pathVar = envValue(`${prefix}_PATH`);
  if (pathVar) {
    const resolvedPath = resolveFilePath(pathVar);
    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath, 'utf8');
    }
  }

  const raw = envValue(prefix);
  if (raw) {
    const resolvedPath = resolveFilePath(raw);
    if (fs.existsSync(resolvedPath)) {
      return fs.readFileSync(resolvedPath, 'utf8');
    }
    // Allow direct raw content as fallback
    if (raw.startsWith('{') || raw.startsWith('<')) {
      return raw;
    }
  }

  return '';
}

function pickExisting(candidates) {
  return candidates.find((candidate) => exists(candidate)) || '';
}

function extractPlistValue(plistText, key) {
  const pattern = new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]+)<\\/string>`, 'm');
  const match = plistText.match(pattern);
  return match ? match[1].trim() : '';
}

function extractAndroidApiKey(parsedJson) {
  const clients = Array.isArray(parsedJson?.client) ? parsedJson.client : [];
  for (const client of clients) {
    const apiKeys = Array.isArray(client?.api_key) ? client.api_key : [];
    for (const apiKeyEntry of apiKeys) {
      const key = typeof apiKeyEntry?.current_key === 'string' ? apiKeyEntry.current_key.trim() : '';
      if (key) return key;
    }
  }
  return '';
}

function ensureIosPlist() {
  let iosPath = pickExisting(IOS_CANDIDATES);
  let iosContent = iosPath ? read(iosPath) : '';

  if (!iosContent) {
    const fromEnv = resolveSecretContent('GOOGLE_SERVICE_INFO_PLIST');
    if (!fromEnv) {
      fail(
        'Missing iOS GoogleService-Info.plist. Set one of: GOOGLE_SERVICE_INFO_PLIST_BASE64, GOOGLE_SERVICE_INFO_PLIST_PATH, GOOGLE_SERVICE_INFO_PLIST',
      );
    }
    iosPath = IOS_CANDIDATES[0];
    iosContent = fromEnv;
    write(iosPath, iosContent);
    info(`Wrote iOS plist from secret to ${iosPath}`);
  }

  const plistProjectId = extractPlistValue(iosContent, 'PROJECT_ID');
  const plistGcm = extractPlistValue(iosContent, 'GCM_SENDER_ID');
  const plistGoogleAppId = extractPlistValue(iosContent, 'GOOGLE_APP_ID');
  const plistApiKey = extractPlistValue(iosContent, 'API_KEY');

  if (!plistGoogleAppId || !plistApiKey) {
    fail(`Invalid ${iosPath}: GOOGLE_APP_ID/API_KEY missing`);
  }
  if (plistProjectId !== PROJECT_ID) {
    fail(`Invalid ${iosPath}: PROJECT_ID=${plistProjectId} (expected ${PROJECT_ID})`);
  }
  if (plistGcm !== EXPECTED_GCM_SENDER_ID) {
    fail(`Invalid ${iosPath}: GCM_SENDER_ID=${plistGcm} (expected ${EXPECTED_GCM_SENDER_ID})`);
  }

  // Keep root copy in sync for tooling that still references ./GoogleService-Info.plist.
  if (!exists(IOS_ROOT_COPY) || read(IOS_ROOT_COPY) !== iosContent) {
    write(IOS_ROOT_COPY, iosContent);
    info(`Synced root plist copy: ${IOS_ROOT_COPY}`);
  }

  return { iosPath, iosContent };
}

function ensureAndroidJson() {
  let androidPath = pickExisting(ANDROID_CANDIDATES);
  let androidContent = androidPath ? read(androidPath) : '';

  if (!androidContent) {
    const fromEnv = resolveSecretContent('GOOGLE_SERVICES_JSON');
    if (!fromEnv) {
      fail(
        'Missing Android google-services.json. Set one of: GOOGLE_SERVICES_JSON_BASE64, GOOGLE_SERVICES_JSON_PATH, GOOGLE_SERVICES_JSON',
      );
    }
    androidPath = ANDROID_CANDIDATES[0];
    androidContent = fromEnv;
    write(androidPath, androidContent);
    info(`Wrote Android JSON from secret to ${androidPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(androidContent);
  } catch {
    fail(`Invalid JSON in ${androidPath}`);
  }

  const projectId = parsed?.project_info?.project_id || '';
  const senderId = parsed?.project_info?.project_number || '';
  if (projectId !== PROJECT_ID) {
    fail(`Invalid ${androidPath}: project_id=${projectId} (expected ${PROJECT_ID})`);
  }
  if (senderId !== EXPECTED_GCM_SENDER_ID) {
    fail(`Invalid ${androidPath}: project_number=${senderId} (expected ${EXPECTED_GCM_SENDER_ID})`);
  }

  return { androidPath, parsed, androidContent };
}

function ensureFirebaseApiKey(iosContent, androidParsed) {
  const envApiKey = envValue('EXPO_PUBLIC_FIREBASE_API_KEY') || envValue('FIREBASE_API_KEY');
  const iosApiKey = extractPlistValue(iosContent, 'API_KEY');
  const androidApiKey = extractAndroidApiKey(androidParsed);
  const effectiveApiKey = envApiKey || iosApiKey || androidApiKey;

  if (!effectiveApiKey) {
    fail('Firebase API key missing. Provide EXPO_PUBLIC_FIREBASE_API_KEY/FIREBASE_API_KEY or valid Google service files');
  }

  if (!envApiKey) {
    info('Firebase API key resolved from Google service files (env key not provided)');
  }

  if (envApiKey && iosApiKey && envApiKey !== iosApiKey) {
    fail('EXPO_PUBLIC_FIREBASE_API_KEY does not match iOS GoogleService-Info.plist API_KEY');
  }

  if (envApiKey && androidApiKey && envApiKey !== androidApiKey) {
    fail('EXPO_PUBLIC_FIREBASE_API_KEY does not match Android google-services.json current_key');
  }
}

function main() {
  info(`Running in ${process.env.EAS_BUILD === 'true' ? 'EAS_BUILD' : 'local'} mode`);
  const ios = ensureIosPlist();
  const android = ensureAndroidJson();
  ensureFirebaseApiKey(ios.iosContent, android.parsed);
  info(`OK iOS config: ${ios.iosPath}`);
  info(`OK Android config: ${android.androidPath}`);
  info('Firebase release config gate passed');
}

main();
