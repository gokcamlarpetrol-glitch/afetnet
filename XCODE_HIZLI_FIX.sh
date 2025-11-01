#!/bin/bash
# Xcode Signing Fix Script
# Kullanım: ./XCODE_HIZLI_FIX.sh

echo "🧹 Xcode Cache Temizleme"
echo "========================"
echo ""

# Xcode'u kapat
echo "1️⃣  Xcode kapatılıyor..."
killall Xcode 2>/dev/null || true
sleep 2
echo "   ✅ Xcode kapatıldı"
echo ""

# DerivedData temizle
echo "2️⃣  DerivedData temizleniyor..."
rm -rf ~/Library/Developer/Xcode/DerivedData/AfetNet-* 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ DerivedData temizlendi"
else
    echo "   ⚠️  DerivedData bulunamadı (normal olabilir)"
fi
echo ""

# Provisioning Profile cache temizle
echo "3️⃣  Provisioning Profile cache temizleniyor..."
rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/* 2>/dev/null
echo "   ✅ Provisioning Profile cache temizlendi"
echo ""

echo "✅ Temizleme tamamlandı!"
echo ""
echo "📋 ŞİMDİ YAPMANIZ GEREKENLER:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Xcode'u açın:"
echo "   open ios/AfetNet.xcworkspace"
echo ""
echo "2. Preferences → Accounts → 'Download Manual Profiles'"
echo ""
echo "3. Signing & Capabilities:"
echo "   - Background Modes'i kaldırın (-)"
echo "   - Bluetooth'u kaldırın (-)"
echo "   - Push Notifications'ı kaldırın (-)"
echo ""
echo "4. Tekrar ekleyin (+ Capability):"
echo "   - Background Modes → Tüm seçenekleri işaretleyin"
echo "   - ÖNEMLİ: 'Acts as a Bluetooth LE accessory' İŞARETLEYİN"
echo "   - Push Notifications ekleyin"
echo "   - Bluetooth LE (ayrı) → Central + Peripheral işaretleyin"
echo ""
echo "5. Clean Build Folder (⌘⇧K)"
echo ""
echo "6. Try Again"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📖 Detaylı rehber: KESIN_COZUM_ADIM_ADIM.md"
echo ""








