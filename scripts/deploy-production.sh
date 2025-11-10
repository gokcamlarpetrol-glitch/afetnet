#!/bin/bash

# AfetNet - Production Deployment Script
# Bu script production build başlatır

echo "🚀 AFETNET PRODUCTION DEPLOYMENT"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}⚠️  Production build başlatılıyor...${NC}"
echo ""

# Confirmation
echo "Bu işlem:"
echo "  - iOS production build oluşturacak"
echo "  - Android production build oluşturacak"
echo "  - EAS cloud üzerinde çalışacak"
echo "  - ~20-30 dakika sürecek"
echo ""
read -p "Devam etmek istiyor musunuz? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "İşlem iptal edildi."
    exit 1
fi

echo ""
echo -e "${BLUE}📱 iOS Production Build başlatılıyor...${NC}"
eas build --platform ios --profile production --non-interactive

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ iOS build başarıyla başlatıldı${NC}"
else
    echo -e "${RED}❌ iOS build başlatılamadı${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🤖 Android Production Build başlatılıyor...${NC}"
eas build --platform android --profile production --non-interactive

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Android build başarıyla başlatıldı${NC}"
else
    echo -e "${RED}❌ Android build başlatılamadı${NC}"
    exit 1
fi

echo ""
echo "=================================="
echo -e "${GREEN}🎉 Tüm build'ler başarıyla başlatıldı!${NC}"
echo ""
echo "Build durumunu kontrol etmek için:"
echo "  https://expo.dev/accounts/gokhancamci1/projects/afetnet/builds"
echo ""
echo "Build tamamlandığında bildirim alacaksınız."
echo ""

