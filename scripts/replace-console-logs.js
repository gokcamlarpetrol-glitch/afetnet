#!/usr/bin/env node

/**
 * Script to replace console.log with production-safe logger
 * Elite Software Engineering Standards
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const replacements = [
  {
    // console.log(...) -> logger.debug(...)
    pattern: /console\.log\(/g,
    replacement: 'logger.debug('
  },
  {
    // console.warn(...) -> logger.warn(...)
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn('
  },
  {
    // console.error(...) -> logger.error(...)
    pattern: /console\.error\(/g,
    replacement: 'logger.error('
  },
  {
    // console.info(...) -> logger.info(...)
    pattern: /console\.info\(/g,
    replacement: 'logger.info('
  }
];

function shouldSkipFile(filePath) {
  const skipPatterns = [
    'node_modules',
    'dist',
    'build',
    '.expo',
    'productionLogger.ts', // Don't modify the logger itself
    'replace-console-logs.js'
  ];
  
  return skipPatterns.some(pattern => filePath.includes(pattern));
}

function addLoggerImport(content, filePath) {
  // Check if logger is already imported
  if (content.includes("from '@/utils/productionLogger'") || 
      content.includes('from "../utils/productionLogger"') ||
      content.includes('from "../../utils/productionLogger"') ||
      content.includes('from "../../../utils/productionLogger"')) {
    return content;
  }
  
  // Check if file uses logger
  if (!content.includes('logger.')) {
    return content;
  }
  
  // Calculate relative path to productionLogger
  const srcDir = path.join(__dirname, '..', 'src');
  const fileDir = path.dirname(filePath);
  const relativePath = path.relative(fileDir, path.join(srcDir, 'utils', 'productionLogger'));
  const importPath = relativePath.startsWith('.') ? relativePath : './' + relativePath;
  
  // Add import at the top, after other imports
  const lines = content.split('\n');
  let lastImportIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ') || lines[i].startsWith('import{')) {
      lastImportIndex = i;
    }
  }
  
  const loggerImport = `import { logger } from '${importPath.replace(/\\/g, '/')}';`;
  
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, loggerImport);
  } else {
    // No imports found, add at the beginning
    lines.unshift(loggerImport, '');
  }
  
  return lines.join('\n');
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    return { modified: false, reason: 'skipped' };
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Apply replacements
  replacements.forEach(({ pattern, replacement }) => {
    content = content.replace(pattern, replacement);
  });
  
  // Add logger import if needed
  if (content !== original) {
    content = addLoggerImport(content, filePath);
    fs.writeFileSync(filePath, content, 'utf8');
    return { modified: true, reason: 'replaced' };
  }
  
  return { modified: false, reason: 'no changes' };
}

// Main execution
function main() {
  console.log('🔍 Scanning for console.log statements...\n');
  
  const srcFiles = glob.sync('src/**/*.{ts,tsx}', {
    cwd: path.join(__dirname, '..'),
    absolute: true
  });
  
  let modifiedCount = 0;
  let skippedCount = 0;
  let noChangeCount = 0;
  
  srcFiles.forEach(file => {
    const result = processFile(file);
    
    if (result.modified) {
      modifiedCount++;
      console.log(`✅ Modified: ${path.relative(process.cwd(), file)}`);
    } else if (result.reason === 'skipped') {
      skippedCount++;
    } else {
      noChangeCount++;
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`   Modified: ${modifiedCount}`);
  console.log(`   No changes: ${noChangeCount}`);
  console.log(`   Skipped: ${skippedCount}`);
  console.log(`   Total: ${srcFiles.length}`);
  
  if (modifiedCount > 0) {
    console.log(`\n✅ Successfully replaced console.log with production-safe logger!`);
  } else {
    console.log(`\n⚠️  No files were modified.`);
  }
}

main();

