#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

/**
 * Prepare script for AfetNet project setup
 * This script handles initial project setup tasks
 */

const projectRoot = path.join(__dirname, '..');

async function createDirectories() {
  console.log('Creating directory structure...');
  
  const directories = [
    'src/assets/mbtiles',
    'src/assets/icons',
    'src/assets/images',
    'ios/Pods',
    'android/app/src/main/assets',
  ];

  for (const dir of directories) {
    const fullPath = path.join(projectRoot, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  }
}

async function createPlaceholderFiles() {
  console.log('Creating placeholder files...');

  // Create placeholder MBTiles file
  const mbtilesPath = path.join(projectRoot, 'src/assets/mbtiles/istanbul.mbtiles');
  if (!fs.existsSync(mbtilesPath)) {
    const placeholderContent = `# Istanbul MBTiles Placeholder

This is a placeholder file for the Istanbul MBTiles data.

To add real map tiles:
1. Download or create MBTiles for Istanbul metropolitan area
2. Replace this file with the actual .mbtiles file
3. Ensure the file follows MapLibre GL specifications

Recommended tools for creating MBTiles:
- tippecanoe: https://github.com/felt/tippecanoe
- mbutil: https://github.com/mapbox/mbutil
- QGIS with MBTiles plugin

File should be named: istanbul.mbtiles
Location: src/assets/mbtiles/istanbul.mbtiles
`;
    fs.writeFileSync(mbtilesPath, placeholderContent);
    console.log('Created placeholder MBTiles file');
  }

  // Create placeholder icon files
  const iconFiles = [
    'src/assets/icons/icon.png',
    'src/assets/icons/splash.png',
    'src/assets/icons/adaptive-icon.png',
    'src/assets/icons/favicon.png',
  ];

  for (const iconFile of iconFiles) {
    const fullPath = path.join(projectRoot, iconFile);
    if (!fs.existsSync(fullPath)) {
      const placeholderContent = `# Placeholder for ${path.basename(iconFile)}

This is a placeholder for the app icon: ${iconFile}

To add real icons:
1. Create icons with the following specifications:
   - icon.png: 1024x1024 PNG
   - splash.png: 1242x2436 PNG (iPhone X size)
   - adaptive-icon.png: 1024x1024 PNG (Android adaptive icon)
   - favicon.png: 32x32 PNG

2. Replace this placeholder with the actual icon file
3. Ensure icons follow platform guidelines

Design guidelines:
- Use simple, recognizable symbols
- Ensure good contrast for accessibility
- Test on both light and dark backgrounds
- Follow platform-specific icon guidelines
`;
      fs.writeFileSync(fullPath, placeholderContent);
      console.log(`Created placeholder: ${iconFile}`);
    }
  }
}

async function createEnvironmentFile() {
  console.log('Creating environment file...');
  
  const envPath = path.join(projectRoot, '.env');
  const envExamplePath = path.join(projectRoot, 'env.example');
  
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('Created .env file from env.example');
  }
}

async function setupHusky() {
  console.log('Setting up Husky...');
  
  const huskyDir = path.join(projectRoot, '.husky');
  if (!fs.existsSync(huskyDir)) {
    fs.mkdirSync(huskyDir, { recursive: true });
  }

  const preCommitPath = path.join(huskyDir, 'pre-commit');
  const preCommitContent = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run linting and type checking before commit
echo "Running pre-commit checks..."

# Type check
yarn typecheck

# Lint check
yarn lint

echo "Pre-commit checks passed!"
`;

  if (!fs.existsSync(preCommitPath)) {
    fs.writeFileSync(preCommitPath, preCommitContent);
    fs.chmodSync(preCommitPath, '755');
    console.log('Created Husky pre-commit hook');
  }
}

async function createGitHooks() {
  console.log('Creating Git hooks...');
  
  const gitHooksDir = path.join(projectRoot, '.git/hooks');
  if (fs.existsSync(gitHooksDir)) {
    // Git hooks are already handled by Husky
    console.log('Git hooks directory found - Husky will manage hooks');
  }
}

async function validateProjectStructure() {
  console.log('Validating project structure...');
  
  const requiredFiles = [
    'package.json',
    'tsconfig.json',
    'app.config.js',
    'babel.config.js',
    'jest.config.js',
    '.eslintrc.js',
    '.prettierrc',
    'src/app/App.tsx',
    'src/core/data/schema.ts',
    'src/core/p2p/index.ts',
    'src/core/crypto/keys.ts',
  ];

  const missingFiles = requiredFiles.filter(file => {
    const fullPath = path.join(projectRoot, file);
    return !fs.existsSync(fullPath);
  });

  if (missingFiles.length > 0) {
    console.warn('Warning: Missing required files:');
    missingFiles.forEach(file => console.warn(`  - ${file}`));
  } else {
    console.log('All required files present');
  }
}

async function main() {
  try {
    console.log('🚀 Preparing AfetNet project...\n');
    
    await createDirectories();
    await createPlaceholderFiles();
    await createEnvironmentFile();
    await setupHusky();
    await createGitHooks();
    await validateProjectStructure();
    
    console.log('\n✅ Project preparation completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run "yarn install" to install dependencies');
    console.log('2. Run "yarn setup" to complete the setup');
    console.log('3. Add real MBTiles file to src/assets/mbtiles/istanbul.mbtiles');
    console.log('4. Add app icons to src/assets/icons/');
    console.log('5. Run "yarn dev" to start development');
    
  } catch (error) {
    console.error('❌ Error during project preparation:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
