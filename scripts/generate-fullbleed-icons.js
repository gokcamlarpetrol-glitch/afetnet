#!/usr/bin/env node

/**
 * App Icon Full-Bleed Generator
 * Ensures the source icon has full-bleed red background without white borders
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SOURCE_ICON = 'assets/icons/source/afetneticon.png';
const OUTPUT_DIR = 'ios/AfetNet/Assets.xcassets/AppIcon.appiconset';

// Icon sizes configuration
const ICON_SIZES = [
  // iPhone
  { size: '20x20', idiom: 'iphone', scale: '2x', filename: 'iphone-notification-20@2x.png', pixels: 40 },
  { size: '20x20', idiom: 'iphone', scale: '3x', filename: 'iphone-notification-20@3x.png', pixels: 60 },
  { size: '29x29', idiom: 'iphone', scale: '2x', filename: 'iphone-settings-29@2x.png', pixels: 58 },
  { size: '29x29', idiom: 'iphone', scale: '3x', filename: 'iphone-settings-29@3x.png', pixels: 87 },
  { size: '40x40', idiom: 'iphone', scale: '2x', filename: 'iphone-spotlight-40@2x.png', pixels: 80 },
  { size: '40x40', idiom: 'iphone', scale: '3x', filename: 'iphone-spotlight-40@3x.png', pixels: 120 },
  { size: '60x60', idiom: 'iphone', scale: '2x', filename: 'iphone-app-60@2x.png', pixels: 120 },
  { size: '60x60', idiom: 'iphone', scale: '3x', filename: 'iphone-app-60@3x.png', pixels: 180 },
  
  // iPad
  { size: '20x20', idiom: 'ipad', scale: '1x', filename: 'ipad-notification-20@1x.png', pixels: 20 },
  { size: '20x20', idiom: 'ipad', scale: '2x', filename: 'ipad-notification-20@2x.png', pixels: 40 },
  { size: '29x29', idiom: 'ipad', scale: '1x', filename: 'ipad-settings-29@1x.png', pixels: 29 },
  { size: '29x29', idiom: 'ipad', scale: '2x', filename: 'ipad-settings-29@2x.png', pixels: 58 },
  { size: '40x40', idiom: 'ipad', scale: '1x', filename: 'ipad-spotlight-40@1x.png', pixels: 40 },
  { size: '40x40', idiom: 'ipad', scale: '2x', filename: 'ipad-spotlight-40@2x.png', pixels: 80 },
  { size: '76x76', idiom: 'ipad', scale: '1x', filename: 'ipad-app-76@1x.png', pixels: 76 },
  { size: '76x76', idiom: 'ipad', scale: '2x', filename: 'ipad-app-76@2x.png', pixels: 152 },
  { size: '83.5x83.5', idiom: 'ipad', scale: '2x', filename: 'ipad-pro-app-83.5@2x.png', pixels: 167 },
  
  // App Store Marketing
  { size: '1024x1024', idiom: 'ios-marketing', scale: '1x', filename: 'app-store-1024.png', pixels: 1024 },
];

async function ensureFullBleedSource() {
  console.log('🎨 Ensuring source icon has full-bleed red background...');
  
  try {
    // Read the source image
    const sourceBuffer = await sharp(SOURCE_ICON).raw().toBuffer({ resolveWithObject: true });
    const { info } = sourceBuffer;
    
    console.log(`📸 Source image: ${info.width}x${info.height}, ${info.channels} channels`);
    
    // Create a new image with full-bleed red background
    const redBackground = Buffer.alloc(info.width * info.height * 3);
    
    // Fill with red background (#C62828 - AfetNet red)
    for (let i = 0; i < redBackground.length; i += 3) {
      redBackground[i] = 198;     // R
      redBackground[i + 1] = 40;  // G  
      redBackground[i + 2] = 40; // B
    }
    
    // Composite the original image over the red background
    const fullBleedIcon = await sharp(redBackground, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 3,
      },
    })
      .composite([{
        input: await sharp(SOURCE_ICON).png().toBuffer(),
        blend: 'over',
      }])
      .png()
      .toBuffer();
    
    // Save the full-bleed source
    await sharp(fullBleedIcon).png().toFile(SOURCE_ICON);
    console.log('✅ Source icon updated with full-bleed red background');
    
  } catch (error) {
    console.error('❌ Error updating source icon:', error);
    throw error;
  }
}

async function generateIcons() {
  console.log('🚀 Starting iOS app icon generation with full-bleed...');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Generate all icon sizes
  for (const icon of ICON_SIZES) {
    try {
      await sharp(SOURCE_ICON)
        .resize(icon.pixels, icon.pixels, {
          fit: 'cover',
          position: 'center',
        })
        .png({ 
          compressionLevel: 9,
          adaptiveFiltering: false,
          force: true,
        })
        .removeAlpha()
        .toFile(path.join(OUTPUT_DIR, icon.filename));
      
      console.log(`✅ Generated: ${icon.filename} (${icon.pixels}x${icon.pixels})`);
    } catch (error) {
      console.error(`❌ Failed to generate ${icon.filename}:`, error);
      throw error;
    }
  }
}

async function generateContentsJson() {
  console.log('📝 Generating Contents.json...');
  
  const contents = {
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
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'Contents.json'),
    JSON.stringify(contents, null, 2),
  );
  
  console.log('✅ Generated Contents.json with 18 icon definitions');
}

async function validateIcons() {
  console.log('🔍 Validating generated icons...');
  
  for (const icon of ICON_SIZES) {
    const filePath = path.join(OUTPUT_DIR, icon.filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing icon file: ${icon.filename}`);
    }
    
    // Check if file is valid PNG
    const metadata = await sharp(filePath).metadata();
    if (metadata.width !== icon.pixels || metadata.height !== icon.pixels) {
      throw new Error(`Invalid dimensions for ${icon.filename}: ${metadata.width}x${metadata.height}`);
    }
    
    // Check if it's opaque (no transparency)
    if (metadata.hasAlpha) {
      console.warn(`⚠️ Warning: ${icon.filename} has transparency`);
    }
  }
  
  console.log('✅ All icons validated successfully');
}

async function main() {
  try {
    console.log('🎯 AfetNet App Icon Generator - Full-Bleed Red Background');
    console.log('================================================');
    
    // Step 1: Ensure source has full-bleed red background
    await ensureFullBleedSource();
    
    // Step 2: Generate all icon sizes
    await generateIcons();
    
    // Step 3: Generate Contents.json
    await generateContentsJson();
    
    // Step 4: Validate all icons
    await validateIcons();
    
    console.log('');
    console.log('🎉 iOS App Icon Generation Complete!');
    console.log('📊 Generated 18 icon files');
    console.log('📁 Output directory:', OUTPUT_DIR);
    console.log('');
    console.log('📱 Device Coverage:');
    console.log('   • iPhone: Notification, Settings, Spotlight, App icons');
    console.log('   • iPad: Notification, Settings, Spotlight, App icons');
    console.log('   • iPad Pro: App icon (83.5pt)');
    console.log('   • App Store: Marketing icon (1024x1024)');
    console.log('');
    console.log('🎨 Full-Bleed Features:');
    console.log('   • Red background extends to all edges');
    console.log('   • No white borders or margins');
    console.log('   • All icons are opaque PNGs');
    console.log('   • Apple will handle corner rounding');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('   1. Clean build in Xcode');
    console.log('   2. Increment build number');
    console.log('   3. Archive and upload to App Store Connect');
    console.log('   4. Verify no 90022/90023 errors');
    
  } catch (error) {
    console.error('❌ Icon generation failed:', error);
    process.exit(1);
  }
}

main();
