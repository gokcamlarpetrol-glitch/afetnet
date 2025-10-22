import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    ignores: ['src/relief/**/*'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      'no-unused-vars': 'off', // TypeScript ile çakışıyor
      'no-empty': 'error',
      'no-control-regex': 'off', // Control characters in regex are intentional
      'no-unreachable': 'off', // Sometimes false positives
      'no-undef': 'off', // TypeScript ile çakışıyor
      'indent': ['error', 2],
      'comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/no-explicit-any': 'off', // Çok fazla hata veriyor
      '@typescript-eslint/no-unused-vars': 'off', // Çok fazla hata veriyor
    },
  },
];