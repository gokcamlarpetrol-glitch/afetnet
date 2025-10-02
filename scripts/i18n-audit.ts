#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface TranslationFile {
  path: string;
  content: Record<string, any>;
  locale: string;
}

interface AuditResult {
  missingKeys: string[];
  extraKeys: string[];
  unusedKeys: string[];
  inconsistentKeys: string[];
  totalKeys: number;
  coverage: number;
}

export class I18nAuditor {
  private translationFiles: TranslationFile[] = [];
  private sourceFiles: string[] = [];
  private baseLocale: string = 'tr';
  private targetLocales: string[] = ['en', 'zz'];

  constructor(
    private translationDir: string = './src/app/i18n',
    private sourceDir: string = './src'
  ) {}

  async audit(): Promise<AuditResult> {
    console.log('🔍 Starting i18n audit...');

    // Load translation files
    await this.loadTranslationFiles();

    // Find source files
    await this.findSourceFiles();

    // Find all translation keys used in source files
    const usedKeys = await this.extractUsedKeys();

    // Find all keys in translation files
    const allKeys = this.extractAllKeys();

    // Perform audit
    const result = this.performAudit(usedKeys, allKeys);

    // Generate report
    this.generateReport(result);

    return result;
  }

  private async loadTranslationFiles(): Promise<void> {
    const files = await glob('*.json', { cwd: this.translationDir });
    
    for (const file of files) {
      const filePath = path.join(this.translationDir, file);
      const locale = path.basename(file, '.json');
      
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.translationFiles.push({
          path: filePath,
          content,
          locale,
        });
        
        console.log(`📄 Loaded ${locale} translation file`);
      } catch (error) {
        console.error(`❌ Failed to load ${filePath}:`, error);
      }
    }
  }

  private async findSourceFiles(): Promise<void> {
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, { 
        cwd: this.sourceDir,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
      });
      this.sourceFiles.push(...files);
    }

    console.log(`📁 Found ${this.sourceFiles.length} source files`);
  }

  private async extractUsedKeys(): Promise<Set<string>> {
    const usedKeys = new Set<string>();
    const keyPattern = /t\(['"`]([^'"`]+)['"`]\)/g;
    const keyPattern2 = /useTranslation\(\)[^}]*t\(['"`]([^'"`]+)['"`]\)/g;

    for (const file of this.sourceFiles) {
      const filePath = path.join(this.sourceDir, file);
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find t('key') patterns
        let match;
        while ((match = keyPattern.exec(content)) !== null) {
          usedKeys.add(match[1]);
        }

        // Reset regex
        keyPattern.lastIndex = 0;

        // Find useTranslation().t('key') patterns
        while ((match = keyPattern2.exec(content)) !== null) {
          usedKeys.add(match[1]);
        }

        keyPattern2.lastIndex = 0;
      } catch (error) {
        console.error(`❌ Failed to read ${filePath}:`, error);
      }
    }

    console.log(`🔑 Found ${usedKeys.size} used translation keys`);
    return usedKeys;
  }

  private extractAllKeys(): Record<string, Set<string>> {
    const allKeys: Record<string, Set<string>> = {};

    for (const file of this.translationFiles) {
      allKeys[file.locale] = this.extractKeysFromObject(file.content);
    }

    return allKeys;
  }

  private extractKeysFromObject(obj: any, prefix: string = ''): Set<string> {
    const keys = new Set<string>();

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        const nestedKeys = this.extractKeysFromObject(value, fullKey);
        nestedKeys.forEach(k => keys.add(k));
      } else {
        keys.add(fullKey);
      }
    }

    return keys;
  }

  private performAudit(usedKeys: Set<string>, allKeys: Record<string, Set<string>>): AuditResult {
    const baseKeys = allKeys[this.baseLocale] || new Set();
    const missingKeys: string[] = [];
    const extraKeys: string[] = [];
    const unusedKeys: string[] = [];
    const inconsistentKeys: string[] = [];

    // Find missing keys in target locales
    for (const locale of this.targetLocales) {
      const localeKeys = allKeys[locale] || new Set();
      
      for (const key of baseKeys) {
        if (!localeKeys.has(key)) {
          missingKeys.push(`${locale}:${key}`);
        }
      }
    }

    // Find extra keys in target locales
    for (const locale of this.targetLocales) {
      const localeKeys = allKeys[locale] || new Set();
      
      for (const key of localeKeys) {
        if (!baseKeys.has(key)) {
          extraKeys.push(`${locale}:${key}`);
        }
      }
    }

    // Find unused keys
    for (const key of baseKeys) {
      if (!usedKeys.has(key)) {
        unusedKeys.push(key);
      }
    }

    // Find inconsistent keys (different structure across locales)
    for (const key of baseKeys) {
      const baseValue = this.getNestedValue(allKeys[this.baseLocale], key);
      
      for (const locale of this.targetLocales) {
        const localeValue = this.getNestedValue(allKeys[locale], key);
        
        if (typeof baseValue !== typeof localeValue) {
          inconsistentKeys.push(`${locale}:${key}`);
        }
      }
    }

    const totalKeys = baseKeys.size;
    const coverage = totalKeys > 0 ? ((totalKeys - missingKeys.length) / totalKeys) * 100 : 100;

    return {
      missingKeys,
      extraKeys,
      unusedKeys,
      inconsistentKeys,
      totalKeys,
      coverage,
    };
  }

  private getNestedValue(keys: Set<string>, key: string): any {
    // This is a simplified implementation
    // In a real implementation, you'd need to reconstruct the nested object structure
    return keys.has(key) ? 'exists' : 'missing';
  }

  private generateReport(result: AuditResult): void {
    console.log('\n📊 i18n Audit Report');
    console.log('==================');
    console.log(`Total keys: ${result.totalKeys}`);
    console.log(`Coverage: ${result.coverage.toFixed(1)}%`);
    console.log(`Missing keys: ${result.missingKeys.length}`);
    console.log(`Extra keys: ${result.extraKeys.length}`);
    console.log(`Unused keys: ${result.unusedKeys.length}`);
    console.log(`Inconsistent keys: ${result.inconsistentKeys.length}`);

    if (result.missingKeys.length > 0) {
      console.log('\n❌ Missing Keys:');
      result.missingKeys.slice(0, 10).forEach(key => console.log(`  - ${key}`));
      if (result.missingKeys.length > 10) {
        console.log(`  ... and ${result.missingKeys.length - 10} more`);
      }
    }

    if (result.extraKeys.length > 0) {
      console.log('\n⚠️ Extra Keys:');
      result.extraKeys.slice(0, 10).forEach(key => console.log(`  - ${key}`));
      if (result.extraKeys.length > 10) {
        console.log(`  ... and ${result.extraKeys.length - 10} more`);
      }
    }

    if (result.unusedKeys.length > 0) {
      console.log('\n🗑️ Unused Keys:');
      result.unusedKeys.slice(0, 10).forEach(key => console.log(`  - ${key}`));
      if (result.unusedKeys.length > 10) {
        console.log(`  ... and ${result.unusedKeys.length - 10} more`);
      }
    }

    if (result.inconsistentKeys.length > 0) {
      console.log('\n🔄 Inconsistent Keys:');
      result.inconsistentKeys.slice(0, 10).forEach(key => console.log(`  - ${key}`));
      if (result.inconsistentKeys.length > 10) {
        console.log(`  ... and ${result.inconsistentKeys.length - 10} more`);
      }
    }

    // Generate JSON report
    const reportPath = path.join(process.cwd(), 'i18n-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
    console.log(`\n📄 Full report saved to: ${reportPath}`);
  }

  async generateMissingTranslations(): Promise<void> {
    console.log('🔧 Generating missing translations...');

    const baseFile = this.translationFiles.find(f => f.locale === this.baseLocale);
    if (!baseFile) {
      console.error('❌ Base translation file not found');
      return;
    }

    for (const targetLocale of this.targetLocales) {
      const targetFile = this.translationFiles.find(f => f.locale === targetLocale);
      if (!targetFile) {
        console.log(`📝 Creating new translation file for ${targetLocale}`);
        await this.createTranslationFile(targetLocale, baseFile.content);
      } else {
        console.log(`📝 Updating translation file for ${targetLocale}`);
        await this.updateTranslationFile(targetLocale, baseFile.content, targetFile.content);
      }
    }
  }

  private async createTranslationFile(locale: string, baseContent: any): Promise<void> {
    const filePath = path.join(this.translationDir, `${locale}.json`);
    
    // Generate pseudo-localization for test locale
    if (locale === 'zz') {
      const pseudoGenerator = (await import('../src/core/i18n/pseudo')).PseudoLocalizationGenerator.getInstance();
      const pseudoContent = pseudoGenerator.generatePseudoTranslations(baseContent);
      fs.writeFileSync(filePath, JSON.stringify(pseudoContent, null, 2));
    } else {
      // Copy base content for other locales
      fs.writeFileSync(filePath, JSON.stringify(baseContent, null, 2));
    }
  }

  private async updateTranslationFile(locale: string, baseContent: any, targetContent: any): Promise<void> {
    const filePath = path.join(this.translationDir, `${locale}.json`);
    const updatedContent = this.mergeTranslations(baseContent, targetContent);
    
    fs.writeFileSync(filePath, JSON.stringify(updatedContent, null, 2));
  }

  private mergeTranslations(base: any, target: any): any {
    const result = { ...target };

    for (const [key, value] of Object.entries(base)) {
      if (typeof value === 'object' && value !== null) {
        result[key] = this.mergeTranslations(value, target[key] || {});
      } else if (!(key in result)) {
        result[key] = value;
      }
    }

    return result;
  }
}

// CLI interface
async function main() {
  const auditor = new I18nAuditor();
  
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'audit':
      await auditor.audit();
      break;
    case 'generate':
      await auditor.generateMissingTranslations();
      break;
    case 'full':
      await auditor.audit();
      await auditor.generateMissingTranslations();
      break;
    default:
      console.log('Usage: ts-node i18n-audit.ts [audit|generate|full]');
      console.log('  audit    - Run i18n audit');
      console.log('  generate - Generate missing translations');
      console.log('  full     - Run audit and generate missing translations');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
