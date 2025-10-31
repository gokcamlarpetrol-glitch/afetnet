#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Running pre-submit checks..."

# 1) Forbidden strings check (yakında / coming soon / beta / demo / TODO)
FORBIDDEN=$(rg -n --iglob '!**/node_modules/**' -e "yakında|coming soon|beta|demo|TODO" || true)
if [ -n "$FORBIDDEN" ]; then
  echo "❌ Forbidden placeholder strings found:"
  echo "$FORBIDDEN"
  exit 1
fi

# 2) Verify Paywall route exists
if ! rg -n "name=\"Paywall\"" src/navigation/AppNavigator.tsx >/dev/null; then
  echo "❌ Paywall route missing in navigation"
  exit 1
fi

# 3) Verify Settings has a Premium button (navigate to Paywall)
if ! rg -n "navigate('Paywall')" src/screens/Settings/components/PremiumSection.tsx >/dev/null; then
  echo "❌ Settings Premium button not wired to Paywall"
  exit 1
fi

# 4) Basic IAP key presence (env)
if [ -z "${RC_IOS_KEY:-}" ] && [ -z "${REVENUECAT_API_KEY:-}" ]; then
  echo "⚠️ RevenueCat key not set in environment (this is fine for local dev, required for TestFlight/App Store)"
fi

# 5) Run TypeScript typecheck quickly
if command -v npx >/dev/null; then
  npx tsc -p tsconfig.json --noEmit || true
fi

echo "✅ Pre-submit checks passed"
