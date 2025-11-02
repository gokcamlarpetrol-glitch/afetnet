#!/bin/bash

# AfetNet - Pre-Deployment Final Check
# Bu script tüm kritik kontrolleri yapar

echo "🔍 AFETNET PRE-DEPLOYMENT CHECK"
echo "================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check counter
PASSED=0
FAILED=0

# Function to check and report
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((PASSED++))
    else
        echo -e "${RED}❌ $1${NC}"
        ((FAILED++))
    fi
}

echo ""
echo "1️⃣  TypeScript Check..."
npm run typecheck
check "TypeScript compilation"

echo ""
echo "2️⃣  ESLint Check..."
npm run lint
check "ESLint validation"

echo ""
echo "3️⃣  Dependencies Check..."
npm list --depth=0 > /dev/null 2>&1
check "Dependencies installed"

echo ""
echo "4️⃣  iOS Config Check..."
if [ -f "ios/AfetNet/Info.plist" ]; then
    echo -e "${GREEN}✅ iOS Info.plist exists${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ iOS Info.plist missing${NC}"
    ((FAILED++))
fi

echo ""
echo "5️⃣  Android Config Check..."
if [ -f "android/app/build.gradle" ]; then
    echo -e "${GREEN}✅ Android build.gradle exists${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ Android build.gradle missing${NC}"
    ((FAILED++))
fi

echo ""
echo "6️⃣  Assets Check..."
if [ -f "assets/icon.png" ] && [ -f "assets/splash.png" ]; then
    echo -e "${GREEN}✅ App icons exist${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ App icons missing${NC}"
    ((FAILED++))
fi

echo ""
echo "7️⃣  EAS Configuration Check..."
if [ -f "eas.json" ]; then
    echo -e "${GREEN}✅ eas.json exists${NC}"
    ((PASSED++))
else
    echo -e "${RED}❌ eas.json missing${NC}"
    ((FAILED++))
fi

echo ""
echo "8️⃣  Backend Server Check..."
if [ -d "server" ] && [ -f "server/package.json" ]; then
    echo -e "${GREEN}✅ Backend server configured${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠️  Backend server optional${NC}"
    ((PASSED++))
fi

echo ""
echo "================================"
echo "📊 RESULTS:"
echo "   Passed: $PASSED"
echo "   Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🚀 ALL CHECKS PASSED!${NC}"
    echo -e "${GREEN}✅ Ready for deployment!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. eas build --platform ios --profile production"
    echo "  2. eas build --platform android --profile production"
    echo "  3. eas submit --platform all"
    exit 0
else
    echo -e "${RED}⚠️  $FAILED checks failed${NC}"
    echo -e "${YELLOW}Please fix the issues above before deploying${NC}"
    exit 1
fi

