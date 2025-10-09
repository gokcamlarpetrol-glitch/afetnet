/* @ts-check */
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
// import rn from "eslint-plugin-react-native";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  // Ignore heavy dirs
  { ignores: ["**/node_modules/**", ".expo/**", "android/**", "ios/**", "dist/**", "build/**", "**/*.min.js"] },

  // ---------- FAST LINT (no type-aware) ----------
  // Use: npm run lint
  js.configs.recommended,
  ...tseslint.configs.recommended, // NOT type-checked (fast)
  {
    files: ["src/**/*.{ts,tsx}", "App.tsx"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: "module",
        ecmaFeatures: { jsx: true }
      },
      globals: { ...globals.browser, ...globals.node, __DEV__: true }
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      // React / RN
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // "react-native/no-inline-styles": "warn",
      // "react-native/no-raw-text": "off",

      // Style / hygiene
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      "curly": ["error", "all"],
      "eqeqeq": ["error", "smart"],

      // TS (no type info here)
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "warn"
    }
  },

  // ---------- TYPE-AWARE LINT (scoped) ----------
  // Use: npm run lint:typeaware
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.{ts,tsx}", "App.tsx"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname
      },
      globals: { ...globals.browser, ...globals.node, __DEV__: true }
    },
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      // Make super-noisy type-aware rules warnings for now
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "warn",

      // Keep safety basics
      "react-hooks/rules-of-hooks": "error",
      "no-empty": ["warn", { "allowEmptyCatch": true }]
    }
  }
];
