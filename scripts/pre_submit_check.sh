#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Running pre-submit checks (No-IAP model)..."

# 1) Forbidden placeholder strings in UI text
SEARCH_DIRS=("src/core/screens" "src/core/components")
FORBIDDEN=$(grep -REn --exclude-dir=node_modules --exclude-dir=ios --exclude-dir=android --exclude-dir=.venv \
  --include='*.tsx' --include='*.ts' -i -E "['\"][^'\"]*(coming soon|\\bbeta\\b|\\bdemo\\b|yak[ıi]nda[[:space:]]+(aktif|eklenecek|gelecek))['\"]" "${SEARCH_DIRS[@]}" 2>/dev/null || true)
if [ -n "$FORBIDDEN" ]; then
  echo "❌ Forbidden placeholder strings found (UI literals):"
  echo "$FORBIDDEN"
  exit 1
fi

# 2) Critical navigation routes must exist
if ! grep -q "name=\"Auth\"" src/core/App.tsx; then
  echo "❌ Auth route missing in src/core/App.tsx"
  exit 1
fi
if ! grep -q "name=\"Main\"" src/core/App.tsx; then
  echo "❌ Main route missing in src/core/App.tsx"
  exit 1
fi

# 3) Auth providers must stay wired (email/google/apple)
if ! grep -q "handleGoogleLogin" src/core/screens/auth/LoginScreen.tsx; then
  echo "❌ Google login handler missing in LoginScreen"
  exit 1
fi
if ! grep -q "handleAppleLogin" src/core/screens/auth/LoginScreen.tsx; then
  echo "❌ Apple login handler missing in LoginScreen"
  exit 1
fi
if ! grep -q "EmailAuthService.login" src/core/screens/auth/LoginScreen.tsx; then
  echo "❌ Email login wiring missing in LoginScreen"
  exit 1
fi
if ! grep -q "EmailAuthService.register" src/core/screens/auth/EmailRegisterScreen.tsx; then
  echo "❌ Email register wiring missing in EmailRegisterScreen"
  exit 1
fi
if ! grep -q "onAuthStateChanged" src/core/stores/authStore.ts; then
  echo "❌ Auth state listener missing in authStore"
  exit 1
fi

# 4) No-IAP policy: block known purchase SDK imports
IAP_IMPORTS=$(grep -Rni --exclude-dir=node_modules --include='*.ts' --include='*.tsx' --include='*.js' \
  -E "react-native-iap|react-native-purchases|expo-in-app-purchases" src app.config.ts 2>/dev/null || true)
if [ -n "$IAP_IMPORTS" ]; then
  echo "❌ IAP SDK import/reference found, but app is configured as no-IAP:"
  echo "$IAP_IMPORTS"
  exit 1
fi

# 5) TypeScript gate
npm run -s typecheck

echo "✅ Pre-submit checks passed"
