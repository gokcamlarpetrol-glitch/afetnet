/**
 * AFETNET - App.tsx (Expo Fallback Entry Point)
 * 
 * This file exists as a fallback for Expo's default AppEntry.js.
 * The ACTUAL entry point is index.ts (set in package.json "main").
 * 
 * CRITICAL: Do NOT define TaskManager tasks or polyfills here.
 * They are already defined in index.ts. Defining them twice causes
 * a crash on iOS production builds (TaskManager.defineTask duplicate).
 */

import CoreApp from './src/core/App';

export default CoreApp;