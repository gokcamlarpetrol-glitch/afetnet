# AfetNet - Emergency Communication App

Expo/React Native mobil uygulama. React Navigation (stack). Firebase backend. Zustand state management.

## Build & Run
- `npm start` -- dev server
- `npm run start:dev` -- dev mode
- `npm run ios` -- iOS simulator
- `npm run android` -- Android emulator
- `npx tsc --noEmit` -- TypeScript type check (MUST run after every change)
- `npx expo install <package>` -- install packages

## Architecture
- React Navigation (stack-based, NOT file-based routing)
- Zustand for global state management
- Firebase: Auth, Firestore, Storage, Cloud Functions
- Skia for custom graphics (@shopify/react-native-skia)

## Code Style
- TypeScript strict mode -- no `any`
- Functional components only
- Zustand stores for shared state, useState for local UI state
- Firebase operations in dedicated service files

## DEBUGGING (MANDATORY)
1. Read the COMPLETE error + stack trace before proposing anything
2. State root cause FIRST: "The error occurs because..."
3. After ANY fix: run `npx tsc --noEmit` -- zero errors allowed
4. Firebase errors: check security rules FIRST, then client code
5. If fix fails twice: STOP, reassess from scratch

## Don't
- Don't mix Zustand and raw Context for the same state
- Don't use `any` type
- Don't hardcode Firebase config -- use environment config
- Don't skip error handling for Firebase operations
