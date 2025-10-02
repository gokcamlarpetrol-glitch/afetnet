export class PseudoLocalizationGenerator {
  private static instance: PseudoLocalizationGenerator;
  private readonly pseudoMap: Map<string, string> = new Map();
  private readonly accentChars = 'àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ';
  private readonly bracketChars = ['[', ']', '{', '}', '(', ')', '<', '>'];

  private constructor() {
    this.initializePseudoMap();
  }

  static getInstance(): PseudoLocalizationGenerator {
    if (!PseudoLocalizationGenerator.instance) {
      PseudoLocalizationGenerator.instance = new PseudoLocalizationGenerator();
    }
    return PseudoLocalizationGenerator.instance;
  }

  private initializePseudoMap(): void {
    // Common character mappings for pseudo-localization
    this.pseudoMap.set('a', 'à');
    this.pseudoMap.set('e', 'é');
    this.pseudoMap.set('i', 'í');
    this.pseudoMap.set('o', 'ó');
    this.pseudoMap.set('u', 'ù');
    this.pseudoMap.set('A', 'À');
    this.pseudoMap.set('E', 'É');
    this.pseudoMap.set('I', 'Í');
    this.pseudoMap.set('O', 'Ó');
    this.pseudoMap.set('U', 'Ù');
  }

  generatePseudoLocale(text: string, locale: string = 'zz'): string {
    if (locale !== 'zz') {
      return text; // Return original text for non-pseudo locales
    }

    return this.pseudoLocalizeText(text);
  }

  private pseudoLocalizeText(text: string): string {
    let pseudoText = text;

    // Add brackets to indicate pseudo-localization
    pseudoText = `[${pseudoText}]`;

    // Replace characters with accented versions
    pseudoText = this.addAccents(pseudoText);

    // Add extra characters to simulate longer text
    pseudoText = this.addExtraCharacters(pseudoText);

    // Add brackets around important UI elements
    pseudoText = this.addBrackets(pseudoText);

    return pseudoText;
  }

  private addAccents(text: string): string {
    let accentedText = text;
    
    for (const [original, pseudo] of this.pseudoMap) {
      accentedText = accentedText.replace(new RegExp(original, 'g'), pseudo);
    }

    return accentedText;
  }

  private addExtraCharacters(text: string): string {
    // Add extra characters to simulate longer text (common in other languages)
    const extraChars = ['ñ', 'ç', 'ü', 'ß'];
    let result = text;

    // Add random extra characters at the end of words
    result = result.replace(/\b\w+\b/g, (word) => {
      if (Math.random() < 0.3) { // 30% chance to add extra character
        const extraChar = extraChars[Math.floor(Math.random() * extraChars.length)];
        return word + extraChar;
      }
      return word;
    });

    return result;
  }

  private addBrackets(text: string): string {
    // Add brackets around important UI elements
    let bracketedText = text;

    // Add brackets around button text
    bracketedText = bracketedText.replace(/\b(OK|Cancel|Save|Delete|Edit|Close|Back|Next|Skip|Get Started)\b/gi, '[$1]');

    // Add brackets around error messages
    bracketedText = bracketedText.replace(/\b(Error|Warning|Success|Info)\b/gi, '[$1]');

    // Add brackets around form labels
    bracketedText = bracketedText.replace(/\b(Name|Phone|Email|Address|Location|Description)\b/gi, '[$1]');

    return bracketedText;
  }

  generatePseudoTranslations(translations: Record<string, any>): Record<string, any> {
    const pseudoTranslations: Record<string, any> = {};

    for (const [key, value] of Object.entries(translations)) {
      if (typeof value === 'string') {
        pseudoTranslations[key] = this.generatePseudoLocale(value, 'zz');
      } else if (typeof value === 'object' && value !== null) {
        pseudoTranslations[key] = this.generatePseudoTranslations(value);
      } else {
        pseudoTranslations[key] = value;
      }
    }

    return pseudoTranslations;
  }

  // Utility methods for testing
  isPseudoLocale(locale: string): boolean {
    return locale === 'zz';
  }

  getPseudoLocaleName(): string {
    return 'Pseudo-Localization (Test)';
  }

  getPseudoLocaleDescription(): string {
    return 'This is a pseudo-localization for testing UI layout with accented characters and longer text.';
  }

  // Methods for accessibility testing
  generateAccessibilityTestText(): string {
    const testTexts = [
      'Button with long text for accessibility testing',
      'Error message with special characters: àáâãäåæçèéêë',
      'Form label with numbers and symbols: 123!@#$%',
      'Navigation item with brackets: [Home] [Settings] [Profile]',
      'Alert dialog with multiple lines\nSecond line\nThird line',
    ];

    return testTexts.map(text => this.generatePseudoLocale(text, 'zz')).join('\n');
  }

  validatePseudoLocale(text: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for proper bracketing
    if (!text.startsWith('[') || !text.endsWith(']')) {
      issues.push('Text should be wrapped in brackets');
    }

    // Check for accented characters
    const hasAccents = /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞß]/.test(text);
    if (!hasAccents) {
      issues.push('Text should contain accented characters');
    }

    // Check for extra characters
    const hasExtraChars = /[ñçüß]/.test(text);
    if (!hasExtraChars) {
      issues.push('Text should contain extra characters for length testing');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }

  // Method to generate pseudo-locale for specific UI components
  generateComponentPseudoLocale(componentType: string, text: string): string {
    let pseudoText = this.generatePseudoLocale(text, 'zz');

    switch (componentType) {
      case 'button':
        pseudoText = `[${pseudoText}]`; // Extra brackets for buttons
        break;
      case 'error':
        pseudoText = `⚠️ ${pseudoText}`; // Add warning emoji
        break;
      case 'success':
        pseudoText = `✅ ${pseudoText}`; // Add checkmark emoji
        break;
      case 'navigation':
        pseudoText = `→ ${pseudoText}`; // Add arrow
        break;
      case 'form_label':
        pseudoText = `${pseudoText}:`; // Add colon
        break;
    }

    return pseudoText;
  }
}
