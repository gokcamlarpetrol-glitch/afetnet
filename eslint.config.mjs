import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'src/relief/**/*',
      'server/dist/**',
      'server/**/dist/**',
      'android/**',
      'ios/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'shared/**/*.js',
      'functions/lib/**',
    ],
  },
  js.configs.recommended,
  {
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
      'no-unused-vars': 'off',
      'no-empty': 'error',
      'no-control-regex': 'off',
      'no-unreachable': 'off',
      'no-undef': 'off',
      'indent': ['error', 2],
      'comma-dangle': ['error', 'always-multiline'],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
