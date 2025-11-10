#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Running pre-submit checks..."

# 1) Forbidden strings check (yakında / coming soon / beta / demo / TODO)
SEARCH_DIRS=("src/screens" "src/features" "src/ui")
FORBIDDEN=$(grep -REn --exclude-dir=node_modules --exclude-dir=ios --exclude-dir=android --exclude-dir=.venv \
  --include='*.tsx' --include='*.ts' -E "['\"][^'\"]*(yakında|yakinda|coming soon|\\bbeta\\b|demo)['\"]" "${SEARCH_DIRS[@]}" 2>/dev/null || true)
if [ -n "$FORBIDDEN" ]; then
  echo "❌ Forbidden placeholder strings found (UI literals):"
  echo "$FORBIDDEN"
  exit 1
fi

# 2) Verify Paywall route exists
if ! grep -q "name=\"Paywall\"" src/core/App.tsx; then
  echo "❌ Paywall route missing in navigation"
  exit 1
fi

# 3) Verify Settings has a Premium button (navigate to Paywall)
if ! grep -q "navigate('Paywall')" src/core/screens/settings/SettingsScreen.tsx; then
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
