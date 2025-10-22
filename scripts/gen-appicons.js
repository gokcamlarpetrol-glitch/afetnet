#!/usr/bin/env node

/**
 * iOS App Icon Generator
 * Generates all required iOS app icon sizes from a source 1024x1024 PNG
 * 
 * Usage: node scripts/gen-appicons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_ICON = 'assets/icons/source/afetneticon.png';
const OUTPUT_DIR = 'ios/AfetNet/Assets.xcassets/AppIcon.appiconset';

// Icon definitions - exactly as specified in the requirements
const ICON_SIZES = [
  // iPhone icons
  { size: '20x20', idiom: 'iphone', filename: 'iphone-notification-20@2x.png', scale: '2x', width: 40, height: 40 },
  { size: '20x20', idiom: 'iphone', filename: 'iphone-notification-20@3x.png', scale: '3x', width: 60, height: 60 },
  
  { size: '29x29', idiom: 'iphone', filename: 'iphone-settings-29@2x.png', scale: '2x', width: 58, height: 58 },
  { size: '29x29', idiom: 'iphone', filename: 'iphone-settings-29@3x.png', scale: '3x', width: 87, height: 87 },
  
  { size: '40x40', idiom: 'iphone', filename: 'iphone-spotlight-40@2x.png', scale: '2x', width: 80, height: 80 },
  { size: '40x40', idiom: 'iphone', filename: 'iphone-spotlight-40@3x.png', scale: '3x', width: 120, height: 120 },
  
  { size: '60x60', idiom: 'iphone', filename: 'iphone-app-60@2x.png', scale: '2x', width: 120, height: 120 },
  { size: '60x60', idiom: 'iphone', filename: 'iphone-app-60@3x.png', scale: '3x', width: 180, height: 180 },
  
  // iPad icons
  { size: '20x20', idiom: 'ipad', filename: 'ipad-notification-20@1x.png', scale: '1x', width: 20, height: 20 },
  { size: '20x20', idiom: 'ipad', filename: 'ipad-notification-20@2x.png', scale: '2x', width: 40, height: 40 },
  
  { size: '29x29', idiom: 'ipad', filename: 'ipad-settings-29@1x.png', scale: '1x', width: 29, height: 29 },
  { size: '29x29', idiom: 'ipad', filename: 'ipad-settings-29@2x.png', scale: '2x', width: 58, height: 58 },
  
  { size: '40x40', idiom: 'ipad', filename: 'ipad-spotlight-40@1x.png', scale: '1x', width: 40, height: 40 },
  { size: '40x40', idiom: 'ipad', filename: 'ipad-spotlight-40@2x.png', scale: '2x', width: 80, height: 80 },
  
  { size: '76x76', idiom: 'ipad', filename: 'ipad-app-76@1x.png', scale: '1x', width: 76, height: 76 },
  { size: '76x76', idiom: 'ipad', filename: 'ipad-app-76@2x.png', scale: '2x', width: 152, height: 152 },
  
  { size: '83.5x83.5', idiom: 'ipad', filename: 'ipad-pro-app-83.5@2x.png', scale: '2x', width: 167, height: 167 },
  
  // App Store marketing icon
  { size: '1024x1024', idiom: 'ios-marketing', filename: 'app-store-1024.png', scale: '1x', width: 1024, height: 1024 },
];

async function generateIcons() {
  try {
    console.log('🚀 Starting iOS app icon generation...');
    
    // Check if source icon exists
    if (!fs.existsSync(SOURCE_ICON)) {
      throw new Error(`Source icon not found: ${SOURCE_ICON}`);
    }
    
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`📁 Created output directory: ${OUTPUT_DIR}`);
    }
    
    // Load source image
    const sourceImage = sharp(SOURCE_ICON);
    const metadata = await sourceImage.metadata();
    
    console.log(`📸 Source image: ${metadata.width}x${metadata.height}, ${metadata.format}`);
    
    // Generate all icon sizes
    console.log('🎨 Generating icons...');
    
    for (const icon of ICON_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, icon.filename);
      
      await sourceImage
        .resize(icon.width, icon.height, {
          fit: 'cover',
          position: 'center',
        })
        .png({
          quality: 100,
          compressionLevel: 0,
          adaptiveFiltering: false,
        })
        .toFile(outputPath);
      
      console.log(`✅ Generated: ${icon.filename} (${icon.width}x${icon.height})`);
    }
    
    // Generate Contents.json
    console.log('📝 Generating Contents.json...');
    
    const contentsJson = {
      images: ICON_SIZES.map(icon => ({
        size: icon.size,
        idiom: icon.idiom,
        filename: icon.filename,
        scale: icon.scale,
      })),
      info: {
        version: 1,
        author: 'xcode',
      },
    };
    
    const contentsPath = path.join(OUTPUT_DIR, 'Contents.json');
    fs.writeFileSync(contentsPath, JSON.stringify(contentsJson, null, 2));
    
    console.log(`✅ Generated Contents.json with ${ICON_SIZES.length} icon definitions`);
    
    // Summary
    console.log('\n🎉 iOS App Icon Generation Complete!');
    console.log(`📊 Generated ${ICON_SIZES.length} icon files`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
    console.log('\n📱 Device Coverage:');
    console.log('   • iPhone: Notification, Settings, Spotlight, App icons');
    console.log('   • iPad: Notification, Settings, Spotlight, App icons');
    console.log('   • iPad Pro: App icon (83.5pt)');
    console.log('   • App Store: Marketing icon (1024x1024)');
    
    console.log('\n🚀 Next steps:');
    console.log('   1. Run: npm run gen:appicons');
    console.log('   2. Clean build in Xcode');
    console.log('   3. Increment build number');
    console.log('   4. Archive and upload to App Store Connect');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

// Run the generator
generateIcons();
