#!/usr/bin/env ts-node

/**
 * Screenshot Generation Script for AfetNet
 * 
 * This script generates store screenshots for iOS and Android in both Turkish and English.
 * It uses Detox to automate the app and capture screenshots.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'store', 'screenshots');

// Device configurations for screenshots
const DEVICES = {
  ios: [
    { name: 'iPhone 6.7"', width: 1290, height: 2796, scale: 3 },
    { name: 'iPhone 6.1"', width: 1170, height: 2532, scale: 3 },
  ],
  android: [
    { name: 'Pixel 6.7"', width: 1290, height: 2796, scale: 2.75 },
    { name: 'Pixel 6.1"', width: 1170, height: 2532, scale: 2.75 },
  ],
};

// Screenshots to capture
const SCREENSHOTS = [
  { name: 'home', description: 'Home Screen' },
  { name: 'map-heatmap', description: 'Map with Heatmap' },
  { name: 'help-modal', description: 'Help Request Modal' },
  { name: 'settings-eew', description: 'Settings EEW Configuration' },
];

// Languages
const LANGUAGES = ['tr', 'en'];

function ensureDirectoryExists(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function checkDependencies(): void {
  try {
    execSync('which detox', { stdio: 'ignore' });
    console.log('✓ Detox found');
  } catch (error) {
    console.error('❌ Detox not found. Please install: npm install -g detox-cli');
    process.exit(1);
  }
}

function generateMockScreenshots(): void {
  console.log('📸 Generating mock screenshots...');
  
  for (const platform of ['ios', 'android'] as const) {
    for (const device of DEVICES[platform]) {
      for (const lang of LANGUAGES) {
        const outputDir = path.join(SCREENSHOTS_DIR, platform, lang);
        ensureDirectoryExists(outputDir);
        
        for (const screenshot of SCREENSHOTS) {
          const filename = `${screenshot.name}-${device.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`;
          const outputPath = path.join(outputDir, filename);
          
          // Create a mock screenshot (placeholder)
          createMockScreenshot(outputPath, device.width, device.height, screenshot.description, lang);
          console.log(`  ✓ Generated ${filename}`);
        }
      }
    }
  }
}

function createMockScreenshot(
  outputPath: string,
  width: number,
  height: number,
  description: string,
  lang: string
): void {
  // Create a simple HTML file for the mock screenshot
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>AfetNet Mock Screenshot</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      text-align: center;
    }
    .mock-content {
      background: rgba(255, 255, 255, 0.1);
      padding: 40px;
      border-radius: 20px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    h1 {
      font-size: 2.5em;
      margin-bottom: 20px;
      font-weight: 700;
    }
    p {
      font-size: 1.2em;
      margin-bottom: 10px;
      opacity: 0.9;
    }
    .device-info {
      position: absolute;
      top: 20px;
      left: 20px;
      font-size: 0.9em;
      opacity: 0.7;
    }
    .lang-info {
      position: absolute;
      top: 20px;
      right: 20px;
      font-size: 0.9em;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <div class="device-info">${width}x${height}</div>
  <div class="lang-info">${lang.toUpperCase()}</div>
  
  <div class="mock-content">
    <h1>AfetNet</h1>
    <p>${description}</p>
    <p>${lang === 'tr' ? 'Acil Durum Ağı' : 'Emergency Network'}</p>
    <p>${lang === 'tr' ? 'Offline-First P2P Mesh' : 'Offline-First P2P Mesh'}</p>
  </div>
</body>
</html>
  `;
  
  // Write HTML file
  const htmlPath = outputPath.replace('.png', '.html');
  fs.writeFileSync(htmlPath, html);
  
  // For now, just create a placeholder text file
  // In a real implementation, you would use a headless browser to capture the screenshot
  const placeholderPath = outputPath.replace('.png', '.txt');
  fs.writeFileSync(placeholderPath, `Mock screenshot placeholder for ${description} (${width}x${height}) in ${lang}`);
}

function generateDetoxConfig(): void {
  console.log('⚙️ Generating Detox configuration...');
  
  const detoxConfig = {
    testRunner: 'jest',
    runnerConfig: 'e2e/config.json',
    configurations: {
      'ios.sim.debug': {
        binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/AfetNet.app',
        build: 'xcodebuild -workspace ios/AfetNet.xcworkspace -scheme AfetNet -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
        type: 'ios.simulator',
        device: {
          type: 'iPhone 14 Pro Max'
        }
      },
      'android.emu.debug': {
        binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
        build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..',
        type: 'android.emulator',
        device: {
          avdName: 'Pixel_6_API_33'
        }
      }
    }
  };
  
  const configPath = path.join(__dirname, '..', '.detoxrc.json');
  fs.writeFileSync(configPath, JSON.stringify(detoxConfig, null, 2));
  console.log('  ✓ Generated .detoxrc.json');
}

function generateScreenshotTests(): void {
  console.log('🧪 Generating screenshot tests...');
  
  const testDir = path.join(__dirname, '..', 'e2e', 'screenshots');
  ensureDirectoryExists(testDir);
  
  const testContent = `
const { device, expect, element, by } = require('detox');

describe('Screenshot Generation', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should capture home screen', async () => {
    await expect(element(by.id('home-screen'))).toBeVisible();
    await device.takeScreenshot('home-screen');
  });

  it('should capture map screen', async () => {
    await element(by.id('tab-map')).tap();
    await expect(element(by.id('map-screen'))).toBeVisible();
    await device.takeScreenshot('map-heatmap');
  });

  it('should capture help modal', async () => {
    await element(by.id('help-button')).tap();
    await expect(element(by.id('help-modal'))).toBeVisible();
    await device.takeScreenshot('help-modal');
  });

  it('should capture settings EEW', async () => {
    await element(by.id('tab-settings')).tap();
    await element(by.id('eew-settings')).tap();
    await expect(element(by.id('eew-settings-screen'))).toBeVisible();
    await device.takeScreenshot('settings-eew');
  });
});
  `;
  
  const testPath = path.join(testDir, 'screenshots.e2e.js');
  fs.writeFileSync(testPath, testContent);
  console.log('  ✓ Generated screenshot tests');
}

function main(): void {
  console.log('📸 AfetNet Screenshot Generation Script');
  console.log('=======================================\n');
  
  checkDependencies();
  ensureDirectoryExists(SCREENSHOTS_DIR);
  
  generateMockScreenshots();
  generateDetoxConfig();
  generateScreenshotTests();
  
  console.log('\n✅ Screenshot generation setup completed!');
  console.log(`📁 Screenshots directory: ${SCREENSHOTS_DIR}`);
  console.log('\n📋 Next steps:');
  console.log('1. Run: detox build --configuration ios.sim.debug');
  console.log('2. Run: detox test --configuration ios.sim.debug e2e/screenshots/');
  console.log('3. Screenshots will be saved to store/screenshots/');
}

if (require.main === module) {
  main();
}