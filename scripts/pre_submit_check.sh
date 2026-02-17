#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Running pre-submit checks (No-IAP model)..."

# 1) Forbidden placeholder strings in UI text
SEARCH_DIRS=("src/core/screens" "src/core/components")
if command -v rg >/dev/null 2>&1; then
  FORBIDDEN=$(rg -n --glob '*.ts' --glob '*.tsx' -i "['\"][^'\"]*(coming soon|\\bbeta\\b|\\bdemo\\b|yak[ıi]nda[[:space:]]+(aktif|eklenecek|gelecek))['\"]" "${SEARCH_DIRS[@]}" 2>/dev/null || true)
else
  FORBIDDEN=$(grep -REn --exclude-dir=node_modules --exclude-dir=ios --exclude-dir=android --exclude-dir=.venv \
    --include='*.tsx' --include='*.ts' -i -E "['\"][^'\"]*(coming soon|\\bbeta\\b|\\bdemo\\b|yak[ıi]nda[[:space:]]+(aktif|eklenecek|gelecek))['\"]" "${SEARCH_DIRS[@]}" 2>/dev/null || true)
fi
if [ -n "$FORBIDDEN" ]; then
  echo "❌ Forbidden placeholder strings found (UI literals):"
  echo "$FORBIDDEN"
  exit 1
fi

# 2) Critical navigation routes must exist
if ! rg -q "name=\"Auth\"" src/core/App.tsx; then
  echo "❌ Auth route missing in src/core/App.tsx"
  exit 1
fi
if ! rg -q "name=\"Main\"" src/core/App.tsx; then
  echo "❌ Main route missing in src/core/App.tsx"
  exit 1
fi

# 3) Auth providers must stay wired (email/google/apple)
if ! rg -q "handleGoogleLogin" src/core/screens/auth/LoginScreen.tsx; then
  echo "❌ Google login handler missing in LoginScreen"
  exit 1
fi
if ! rg -q "handleAppleLogin" src/core/screens/auth/LoginScreen.tsx; then
  echo "❌ Apple login handler missing in LoginScreen"
  exit 1
fi
if ! rg -q "EmailAuthService.login" src/core/screens/auth/LoginScreen.tsx; then
  echo "❌ Email login wiring missing in LoginScreen"
  exit 1
fi
if ! rg -q "EmailAuthService.register" src/core/screens/auth/EmailRegisterScreen.tsx; then
  echo "❌ Email register wiring missing in EmailRegisterScreen"
  exit 1
fi
if ! rg -q "onAuthStateChanged" src/core/stores/authStore.ts; then
  echo "❌ Auth state listener missing in authStore"
  exit 1
fi

# 4) No-IAP policy: block known purchase SDK imports
if command -v rg >/dev/null 2>&1; then
  IAP_IMPORTS=$(rg -n --glob '*.ts' --glob '*.tsx' --glob '*.js' -i "react-native-iap|react-native-purchases|expo-in-app-purchases" src app.config.ts 2>/dev/null || true)
else
  IAP_IMPORTS=$(grep -Rni --exclude-dir=node_modules --include='*.ts' --include='*.tsx' --include='*.js' \
    -E "react-native-iap|react-native-purchases|expo-in-app-purchases" src app.config.ts 2>/dev/null || true)
fi
if [ -n "$IAP_IMPORTS" ]; then
  echo "❌ IAP SDK import/reference found, but app is configured as no-IAP:"
  echo "$IAP_IMPORTS"
  exit 1
fi

# 5) Firestore message update rules must preserve sender retry path
if ! rg -q "isSenderOwned\\((request\\.resource|resource)\\.data\\.fromDeviceId\\)" firestore.rules; then
  echo "❌ Firestore rules missing sender ownership check for message updates"
  exit 1
fi

# 6) TypeScript gate
npm run -s typecheck

echo "✅ Pre-submit checks passed"
