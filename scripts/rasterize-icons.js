#!/usr/bin/env node

/**
 * Icon Rasterization Script for AfetNet
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
  { size: 50, scale: 1, name: 'AppIcon-50' },
  { size: 50, scale: 2, name: 'AppIcon-50@2x' },
  { size: 57, scale: 1, name: 'AppIcon-57' },
  { size: 57, scale: 2, name: 'AppIcon-57@2x' },
  { size: 60, scale: 2, name: 'AppIcon-60@2x' },
  { size: 60, scale: 3, name: 'AppIcon-60@3x' },
  { size: 72, scale: 1, name: 'AppIcon-72' },
  { size: 72, scale: 2, name: 'AppIcon-72@2x' },
  { size: 76, scale: 1, name: 'AppIcon-76' },
  { size: 76, scale: 2, name: 'AppIcon-76@2x' },
  { size: 83.5, scale: 2, name: 'AppIcon-83.5@2x' },
  { size: 1024, scale: 1, name: 'AppIcon-1024' },
];

// Android adaptive icon sizes
const ANDROID_SIZES = [
  { size: 48, name: 'ic_launcher-48' },
  { size: 72, name: 'ic_launcher-72' },
  { size: 96, name: 'ic_launcher-96' },
  { size: 144, name: 'ic_launcher-144' },
  { size: 192, name: 'ic_launcher-192' },
  { size: 512, name: 'ic_launcher-512' },
];

async function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function generateIcons() {
  try {
    console.log('🎨 Generating app icons...');

    // Ensure output directories exist
    await ensureDirectoryExists(OUTPUT_DIR);
    await ensureDirectoryExists(path.join(OUTPUT_DIR, 'ios'));
    await ensureDirectoryExists(path.join(OUTPUT_DIR, 'android'));

    const sourceIcon = path.join(ASSETS_DIR, 'appicon.svg');
    
    if (!fs.existsSync(sourceIcon)) {
      console.error('❌ Source icon not found:', sourceIcon);
      console.log('Please create an appicon.svg file in assets/icons/');
      return;
    }

    // Generate iOS icons
    console.log('📱 Generating iOS icons...');
    for (const icon of IOS_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, 'ios', `${icon.name}.png`);
      const size = Math.round(icon.size * icon.scale);
      
      try {
        const command = `rsvg-convert -w ${size} -h ${size} "${sourceIcon}" -o "${outputPath}"`;
        execSync(command, { stdio: 'pipe' });
        console.log(`  ✅ Generated ${icon.name}.png (${size}x${size})`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to generate ${icon.name}: ${error.message}`);
      }
    }

    // Generate Android icons
    console.log('🤖 Generating Android icons...');
    for (const icon of ANDROID_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, 'android', `${icon.name}.png`);
      
      try {
        const command = `rsvg-convert -w ${icon.size} -h ${icon.size} "${sourceIcon}" -o "${outputPath}"`;
        execSync(command, { stdio: 'pipe' });
        console.log(`  ✅ Generated ${icon.name}.png (${icon.size}x${icon.size})`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to generate ${icon.name}: ${error.message}`);
      }
    }

    console.log('🎉 Icon generation completed!');
    console.log(`📁 Icons saved to: ${OUTPUT_DIR}`);

  } catch (error) {
    console.error('❌ Icon generation failed:', error.message);
    console.log('\n💡 Make sure you have rsvg-convert installed:');
    console.log('   macOS: brew install librsvg');
    console.log('   Ubuntu: sudo apt-get install librsvg2-bin');
    console.log('   Windows: Download from https://github.com/miyako/console-rsvg-convert');
  }
}

// Run the script
generateIcons();
