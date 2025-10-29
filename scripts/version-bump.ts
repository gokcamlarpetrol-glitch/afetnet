#!/usr/bin/env node

// @afetnet: Version Bump Script for Release Management
// Updates version numbers in package.json, iOS Info.plist, Android build.gradle

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../app/core/utils/logger';

interface VersionBump {
  type: 'patch' | 'minor' | 'major';
  newVersion: string;
  buildNumber: number;
  changelog: string;
}

class VersionBumper {
  private packageJsonPath = 'package.json';
  private iosInfoPath = 'ios/AfetNet/Info.plist';
  private androidBuildPath = 'android/app/build.gradle';

  async bumpVersion(type: 'patch' | 'minor' | 'major', changelog?: string): Promise<VersionBump> {
    logger.info(`🚀 Bumping version: ${type}`);

    try {
      // Read current version from package.json
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      const currentVersion = packageJson.version;
      const currentBuild = packageJson.buildNumber || 1;

      // Calculate new version
      const versionParts = currentVersion.split('.').map(Number);
      const [major, minor, patch] = versionParts;

      let newVersion: string;
      let newBuild: number;

      switch (type) {
        case 'major':
          newVersion = `${major + 1}.0.0`;
          newBuild = 1;
          break;
        case 'minor':
          newVersion = `${major}.${minor + 1}.0`;
          newBuild = 1;
          break;
        case 'patch':
          newVersion = `${major}.${minor}.${patch + 1}`;
          newBuild = currentBuild + 1;
          break;
      }

      const bump: VersionBump = {
        type,
        newVersion,
        buildNumber: newBuild,
        changelog: changelog || `Version ${newVersion} (${type} bump)`,
      };

      // Update package.json
      await this.updatePackageJson(newVersion, newBuild);

      // Update iOS Info.plist
      await this.updateIOSInfo(newVersion, newBuild);

      // Update Android build.gradle
      await this.updateAndroidBuild(newBuild);

      logger.info(`✅ Version bumped: ${currentVersion} → ${newVersion} (build: ${newBuild})`);
      return bump;

    } catch (error) {
      logger.error('Failed to bump version:', error);
      throw error;
    }
  }

  private async updatePackageJson(version: string, buildNumber: number): Promise<void> {
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));

    packageJson.version = version;
    packageJson.buildNumber = buildNumber;

    fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));
    logger.debug('✅ Updated package.json');
  }

  private async updateIOSInfo(version: string, buildNumber: number): Promise<void> {
    let infoContent = fs.readFileSync(this.iosInfoPath, 'utf8');

    // Update CFBundleShortVersionString
    infoContent = infoContent.replace(
      /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]*<\/string>/,
      `<key>CFBundleShortVersionString</key>\n\t<string>${version}</string>`
    );

    // Update CFBundleVersion
    infoContent = infoContent.replace(
      /<key>CFBundleVersion<\/key>\s*<string>[^<]*<\/string>/,
      `<key>CFBundleVersion</key>\n\t<string>${buildNumber}</string>`
    );

    fs.writeFileSync(this.iosInfoPath, infoContent);
    logger.debug('✅ Updated iOS Info.plist');
  }

  private async updateAndroidBuild(buildNumber: number): Promise<void> {
    let buildContent = fs.readFileSync(this.androidBuildPath, 'utf8');

    // Update versionCode
    buildContent = buildContent.replace(
      /versionCode\s+\d+/,
      `versionCode ${buildNumber}`
    );

    // Update versionName
    const versionMatch = buildContent.match(/versionName\s+"([^"]+)"/);
    if (versionMatch) {
      const currentVersion = versionMatch[1];
      const newVersion = currentVersion.replace(/\d+$/, buildNumber.toString());
      buildContent = buildContent.replace(
        /versionName\s+"[^"]*"/,
        `versionName "${newVersion}"`
      );
    }

    fs.writeFileSync(this.androidBuildPath, buildContent);
    logger.debug('✅ Updated Android build.gradle');
  }

  async getCurrentVersion(): Promise<{ version: string; build: number }> {
    try {
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      return {
        version: packageJson.version,
        build: packageJson.buildNumber || 1,
      };
    } catch (error) {
      logger.error('Failed to read current version:', error);
      return { version: '1.0.0', build: 1 };
    }
  }

  async validateVersionBump(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check package.json
      const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
      if (!packageJson.version || !packageJson.buildNumber) {
        issues.push('package.json missing version or buildNumber');
      }

      // Check iOS Info.plist
      const infoContent = fs.readFileSync(this.iosInfoPath, 'utf8');
      if (!infoContent.includes('CFBundleShortVersionString') || !infoContent.includes('CFBundleVersion')) {
        issues.push('iOS Info.plist missing version information');
      }

      // Check Android build.gradle
      const buildContent = fs.readFileSync(this.androidBuildPath, 'utf8');
      if (!buildContent.includes('versionCode') || !buildContent.includes('versionName')) {
        issues.push('Android build.gradle missing version information');
      }

      return { valid: issues.length === 0, issues };
    } catch (error) {
      return { valid: false, issues: ['Version validation failed'] };
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const type = args[1] as 'patch' | 'minor' | 'major';
  const changelog = args.slice(2).join(' ');

  const bumper = new VersionBumper();

  try {
    switch (command) {
      case 'bump':
        if (!type || !['patch', 'minor', 'major'].includes(type)) {
          console.error('Usage: node scripts/version-bump.ts bump <patch|minor|major> [changelog]');
          process.exit(1);
        }

        const bump = await bumper.bumpVersion(type, changelog);
        console.log(`✅ Version bumped: ${bump.newVersion} (build: ${bump.buildNumber})`);
        break;

      case 'current':
        const current = await bumper.getCurrentVersion();
        console.log(`Current version: ${current.version} (build: ${current.build})`);
        break;

      case 'validate':
        const validation = await bumper.validateVersionBump();
        console.log(`Version validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
        if (validation.issues.length > 0) {
          console.log('Issues:');
          validation.issues.forEach(issue => console.log(`  - ${issue}`));
        }
        break;

      default:
        console.log('Usage: node scripts/version-bump.ts <command>');
        console.log('Commands:');
        console.log('  bump <patch|minor|major> [changelog] - Bump version');
        console.log('  current - Show current version');
        console.log('  validate - Validate version configuration');
        process.exit(1);
    }
  } catch (error) {
    console.error('Version bump failed:', error);
    process.exit(1);
  }
}

// Export for use in other scripts
export { VersionBumper };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}






