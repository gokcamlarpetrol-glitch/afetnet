#!/bin/bash
# Xcode Profil Temizleme ve Otomatik Ayarlama Script'i
# Tüm eski profilleri siler ve Xcode'u temiz bir şekilde başlatır

set -e

echo "🧹 Xcode Profil Temizleme ve Otomatik Ayarlama"
echo "=============================================="
echo ""

# 1. Xcode'u kapat
echo "1️⃣  Xcode kapatılıyor..."
killall Xcode 2>/dev/null || true
sleep 2
echo "   ✅ Xcode kapatıldı"
echo ""

# 2. Tüm provisioning profile'ları sil
echo "2️⃣  Provisioning Profile'lar temizleniyor..."
if [ -d ~/Library/MobileDevice/Provisioning\ Profiles ]; then
    rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/*
    echo "   ✅ Provisioning Profiles klasörü temizlendi"
else
    echo "   ⚠️  Provisioning Profiles klasörü bulunamadı (normal olabilir)"
fi
echo ""

# 3. DerivedData temizle
echo "3️⃣  DerivedData temizleniyor..."
rm -rf ~/Library/Developer/Xcode/DerivedData/AfetNet-* 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ DerivedData temizlendi"
else
    echo "   ⚠️  DerivedData bulunamadı (normal olabilir)"
fi
echo ""

# 4. Xcode cache temizle
echo "4️⃣  Xcode cache temizleniyor..."
rm -rf ~/Library/Caches/com.apple.dt.Xcode 2>/dev/null
echo "   ✅ Xcode cache temizlendi"
echo ""

# 5. Keychain cache temizle (opsiyonel)
echo "5️⃣  Xcode keychain cache temizleniyor..."
security delete-generic-password -a com.apple.dt.Xcode 2>/dev/null || true
echo "   ✅ Keychain cache temizlendi"
echo ""

echo "✅ Tüm temizleme işlemleri tamamlandı!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 ŞİMDİ XCODE'DA YAPMANIZ GEREKENLER:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Xcode'u açın:"
echo "   open ios/AfetNet.xcworkspace"
echo ""
echo "2. Signing & Capabilities:"
echo "   ✅ 'Automatically manage signing' → İŞARETLİ olmalı"
echo ""
echo "3. Capability'leri EKLEYİN (Xcode otomatik eşleştirecek):"
echo "   a) '+ Capability' → 'Background Modes' → Add"
echo "      ✅ Acts as a Bluetooth LE accessory → İŞARETLE"
echo "      ✅ Background fetch → İŞARETLE"
echo "      ✅ Remote notifications → İŞARETLE"
echo "      ✅ Background processing → İŞARETLE"
echo "      ✅ Location updates → İŞARETLE"
echo ""
echo "   b) '+ Capability' → 'Acts as a Bluetooth LE accessory' → Add"
echo "      ✅ Central Role → İŞARETLE"
echo "      ✅ Peripheral Role → İŞARETLE"
echo ""
echo "   DİALOG AÇILACAK: 'Enable capabilities?' → 'Enable All' → TIKLAYIN"
echo ""
echo "4. Preferences → Accounts:"
echo "   'Gökhan ÇAMCI' seçili → 'Download Manual Profiles'"
echo "   ✅ 'Profiles downloaded successfully' mesajını bekleyin (30-40 saniye)"
echo ""
echo "5. Signing & Capabilities → 'Try Again'"
echo "   ✅ 15-20 saniye bekleyin"
echo ""
echo "6. Eğer hala hata varsa:"
echo "   'Automatically manage signing' → KAPAT → 10 sn bekle → AÇ"
echo "   Dialog: 'Enable All' → TIKLAYIN"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Xcode otomatik olarak yeni profil oluşturacak ve Developer Portal'a eşleştirecek!"
echo ""




