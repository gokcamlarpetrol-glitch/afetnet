import fs from 'node:fs';
import path from 'node:path';

function read(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const root = process.cwd();
const pkg = read(path.join(root, 'package.json'));

// Check if app.config.ts exists and has required content
let appConfigValid = false;
try {
  const appConfigPath = path.join(root, 'app.config.ts');
  if (fs.existsSync(appConfigPath)) {
    const appContent = fs.readFileSync(appConfigPath, 'utf8');
    if (appContent.includes('react-native-maps') && appContent.includes('NSLocationWhenInUseUsageDescription')) {
      appConfigValid = true;
    }
  }
} catch (e) {
  // Ignore errors reading config
}

const missing = [];

function hasDep(n) {
  return (pkg.dependencies && pkg.dependencies[n]) || (pkg.devDependencies && pkg.devDependencies[n]);
}

function assert(cond, msg) {
  if (!cond) {
    missing.push(msg);
  }
}

assert(hasDep('react-native-maps'), 'react-native-maps missing');
assert(hasDep('expo-location'), 'expo-location missing');
assert(hasDep('expo-sensors'), 'expo-sensors missing');
assert(hasDep('@react-native-async-storage/async-storage'), 'async-storage missing');
assert(hasDep('@react-native-community/netinfo'), 'netinfo missing');
assert(hasDep('zustand'), 'zustand missing');
assert(hasDep('tweetnacl'), 'tweetnacl missing');
assert(hasDep('tweetnacl-util'), 'tweetnacl-util missing');
assert(hasDep('react-native-ble-plx'), 'react-native-ble-plx missing');

// Check app config content
if (!appConfigValid) {
  missing.push('app.config.ts missing required content (react-native-maps plugin or iOS permissions)');
}

const files = [
  'src/screens/MapOffline.tsx',
  'src/store/offlineMap.ts',
  'src/store/pdr.ts',
  'src/offline/tiles.ts',
  'src/lib/crypto.ts',
  'src/hooks/useCompass.ts',
  'src/services/blePeer.ts',
  'src/screens/Diagnostics.tsx',
  'src/screens/PairingQR.tsx',
  'src/screens/CompassDirection.tsx',
  'src/ui/Card.tsx',
  'src/ui/Button.tsx',
  'src/ui/theme.ts'
];

files.forEach(f => {
  if (!fs.existsSync(path.join(root, f))) missing.push(`missing file: ${f}`);
});

if (missing.length) {
  console.log('HEALTH: ❌ issues found:');
  for (const m of missing) console.log(' -', m);
  process.exitCode = 1;
} else {
  console.log('HEALTH: ✅ all required deps/files present');
}
