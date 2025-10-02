#!/usr/bin/env ts-node

/**
 * Icon Rasterization Script for AfetNet
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const ASSETS_DIR = path.join(__dirname, '..', 'assets', 'icons');
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'generated');

// iOS AppIcon sizes
const IOS_SIZES = [
  { size: 20, scale: 1, name: 'AppIcon-20' },
  { size: 20, scale: 2, name: 'AppIcon-20@2x' },
  { size: 20, scale: 3, name: 'AppIcon-20@3x' },
  { size: 29, scale: 1, name: 'AppIcon-29' },
  { size: 29, scale: 2, name: 'AppIcon-29@2x' },
  { size: 29, scale: 3, name: 'AppIcon-29@3x' },
  { size: 40, scale: 1, name: 'AppIcon-40' },
  { size: 40, scale: 2, name: 'AppIcon-40@2x' },
  { size: 40, scale: 3, name: 'AppIcon-40@3x' },
  { size: 60, scale: 2, name: 'AppIcon-60@2x' },
  { size: 60, scale: 3, name: 'AppIcon-60@3x' },
  { size: 76, scale: 1, name: 'AppIcon-76' },
  { size: 76, scale: 2, name: 'AppIcon-76@2x' },
  { size: 83.5, scale: 2, name: 'AppIcon-83.5@2x' },
  { size: 1024, scale: 1, name: 'AppIcon-1024' },
];

function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function checkDependencies(): void {
  try {
    execSync('which rsvg-convert', { stdio: 'ignore' });
    console.log('✓ rsvg-convert found');
  } catch (error) {
    console.error('❌ rsvg-convert not found. Please install librsvg2-bin');
    process.exit(1);
  }
}

function generateIOSIcons(): void {
  console.log('📱 Generating iOS AppIcon...');
  
  const iosOutputDir = path.join(OUTPUT_DIR, 'ios');
  ensureDirectoryExists(iosOutputDir);
  
  const sourceSvg = path.join(ASSETS_DIR, 'appicon.svg');
  
  if (!fs.existsSync(sourceSvg)) {
    console.error(`❌ Source SVG not found: ${sourceSvg}`);
    return;
  }
  
  for (const { size, scale, name } of IOS_SIZES) {
    const outputSize = size * scale;
    const outputFile = path.join(iosOutputDir, `${name}.png`);
    
    try {
      execSync(`rsvg-convert -w ${outputSize} -h ${outputSize} -o "${outputFile}" "${sourceSvg}"`, {
        stdio: 'inherit'
      });
      console.log(`  ✓ Generated ${name}.png (${outputSize}x${outputSize})`);
    } catch (error) {
      console.error(`  ❌ Failed to generate ${name}.png:`, error);
    }
  }
}

function main(): void {
  console.log('🎨 AfetNet Icon Rasterization Script');
  console.log('=====================================\n');
  
  checkDependencies();
  ensureDirectoryExists(OUTPUT_DIR);
  generateIOSIcons();
  
  console.log('\n✅ Icon generation completed!');
}

if (require.main === module) {
  main();
}