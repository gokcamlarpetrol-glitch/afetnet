/**
 * REMOVE CONSOLE LOGS FROM PRODUCTION
 * Production build'de console.log'ları temizler
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const SRC_DIR = path.join(__dirname, '..', 'src');
const EXCLUDE_PATTERNS = [
  '**/__tests__/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/node_modules/**',
];

function shouldProcessFile(filePath) {
  return EXCLUDE_PATTERNS.every(pattern => {
    const regex = new RegExp(pattern.replace(/\*\*/g, '.*'));
    return !regex.test(filePath);
  });
}

function removeConsoleLogs(content) {
  // Remove standalone console.log statements
  content = content.replace(/^\s*console\.(log|error|warn|info|debug)\([^)]*\);?\s*$/gm, '');
  
  // Remove console.log in if statements (but keep __DEV__ checks)
  content = content.replace(/if\s*\([^)]*\)\s*{\s*console\.(log|error|warn|info|debug)\([^)]*\);?\s*}/g, '');
  
  return content;
}

function processFile(filePath) {
  if (!shouldProcessFile(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already has __DEV__ checks
  if (content.includes('__DEV__')) {
    return;
  }

  const hasConsoleLog = /console\.(log|error|warn|info|debug)/.test(content);
  if (!hasConsoleLog) {
    return;
  }

  const newContent = removeConsoleLogs(content);
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`✅ Processed: ${path.relative(process.cwd(), filePath)}`);
  }
}

function main() {
  const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
  
  if (!isProduction) {
    console.log('⚠️  Not in production mode. Use --production flag or NODE_ENV=production');
    console.log('💡 This script only removes console.logs in production builds');
    return;
  }

  console.log('🧹 Removing console.logs from production build...');

  const files = glob.sync('**/*.{ts,tsx,js,jsx}', {
    cwd: SRC_DIR,
    absolute: true,
  });

  let processed = 0;
  files.forEach(file => {
    try {
      processFile(file);
      processed++;
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });

  console.log(`\n✅ Processed ${processed} files`);
  console.log('💡 Recommendation: Use logger service instead of console.log');
}

if (require.main === module) {
  main();
}

module.exports = { removeConsoleLogs, processFile };


