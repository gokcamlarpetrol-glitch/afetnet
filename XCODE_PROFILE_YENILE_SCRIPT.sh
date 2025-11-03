#!/bin/bash
# Xcode Profile Yenileme ve Senkronizasyon Script'i
# Kullanım: ./XCODE_PROFILE_YENILE_SCRIPT.sh

set -e

echo "🔧 Xcode Profile Yenileme ve Senkronizasyon"
echo "=========================================="
echo ""

PROJECT_DIR="/Users/gokhancamci/AfetNet1"
XCODE_WORKSPACE="$PROJECT_DIR/ios/AfetNet.xcworkspace"

# 1. Xcode'u kapat
echo "1️⃣  Xcode kapatılıyor..."
killall Xcode 2>/dev/null || true
sleep 2
echo "   ✅ Xcode kapatıldı"
echo ""

# 2. Tüm cache'leri temizle
echo "2️⃣  Cache'ler temizleniyor..."
rm -rf ~/Library/Developer/Xcode/DerivedData/AfetNet-* 2>/dev/null
rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/* 2>/dev/null
rm -rf ~/Library/Caches/com.apple.dt.Xcode 2>/dev/null
echo "   ✅ DerivedData, Provisioning Profiles ve Xcode cache temizlendi"
echo ""

# 3. Xcode preference cache temizle
echo "3️⃣  Xcode preferences cache temizleniyor..."
rm -rf ~/Library/Preferences/com.apple.dt.Xcode.plist 2>/dev/null || true
echo "   ✅ Preferences cache temizlendi"
echo ""

echo "✅ Temizleme tamamlandı!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 ŞİMDİ YAPMANIZ GEREKENLER:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ADIM 1: Developer Portal'a Gidin"
echo "   https://developer.apple.com/account"
echo ""
echo "ADIM 2: App ID'yi Açın"
echo "   1. Certificates, Identifiers & Profiles → Identifiers"
echo "   2. com.gokhancamci.afetnetapp → tıklayın"
echo "   3. Edit → tıklayın"
echo ""
echo "ADIM 3: Capability'leri KESİNLİKLE İŞARETLEYİN"
echo "   ✅ Push Notifications"
echo "   ✅ Background Modes → Configure → tıklayın"
echo "      ✅ Remote notifications"
echo "      ✅ Background fetch"
echo "      ✅ Background processing"
echo "      ✅ Location updates"
echo "   ✅ Bluetooth LE → Configure → tıklayın"
echo "      ✅ Acts as a Bluetooth LE accessory (Central Role)"
echo "      ✅ Acts as a Bluetooth LE accessory (Peripheral Role)"
echo "   ✅ Location Services"
echo "   ✅ In-App Purchase"
echo "   ✅ Associated Domains"
echo ""
echo "ADIM 4: Save → Confirm"
echo ""
echo "ADIM 5: Profilleri Yenileyin"
echo "   1. Profiles → tıklayın"
echo "   2. 'iOS Team Provisioning Profile: com.gokhancamci.afetnetapp' bulun"
echo "   3. Profil'e tıklayın → Edit"
echo "   4. Generate (veya Regenerate) → tıklayın"
echo "   5. Profili indirin"
echo ""
echo "ADIM 6: Xcode'u Açın"
echo "   open $XCODE_WORKSPACE"
echo ""
echo "ADIM 7: Xcode'da"
echo "   1. Preferences → Accounts → 'Gökhan ÇAMCI' → Download Manual Profiles"
echo "   2. 20-30 saniye bekleyin"
echo "   3. Signing & Capabilities → Try Again"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""












