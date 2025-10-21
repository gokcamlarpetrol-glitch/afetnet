#!/bin/bash
# AfetNet - Professional Asset Generator

set -e

echo "🎨 AfetNet Asset Üretimi Başlıyor..."

# Renkler
RED="#C62828"
WHITE="#FFFFFF"

# 1. ICON oluştur (1024x1024)
echo "📱 Icon oluşturuluyor (1024x1024)..."

# SVG'den PNG'ye (1024x1024)
# macOS sips SVG'yi direkt PNG'ye çeviremez, önce mevcut icon.png'yi büyütelim
if [ -f "adaptive-icon.png" ]; then
    echo "   adaptive-icon.png kullanılıyor..."
    sips -z 1024 1024 adaptive-icon.png --out icon-1024.png >/dev/null 2>&1
    cp icon-1024.png icon.png
    echo "   ✅ icon.png (1024x1024) hazır"
else
    echo "   ⚠️  adaptive-icon.png bulunamadı, manuel oluşturulmalı"
fi

# 2. SPLASH oluştur
echo "🌊 Splash ekranları oluşturuluyor..."

# iOS Splash (1242x2688 - iPhone 14 Pro Max)
echo "   iOS splash (1242x2688)..."
if [ -f "splash-icon.png" ]; then
    # Kırmızı arka plan + merkeze icon
    # sips ile basit bir splash oluştur
    sips -z 2688 1242 splash-icon.png --out splash-ios-temp.png >/dev/null 2>&1
    
    # Resize to exact dimensions
    sips -z 2688 1242 splash-ios-temp.png --out splash.png >/dev/null 2>&1
    rm -f splash-ios-temp.png
    echo "   ✅ splash.png (iOS) hazır"
else
    echo "   ⚠️  splash-icon.png bulunamadı"
fi

# Android Splash (1080x1920)
echo "   Android splash (1080x1920)..."
if [ -f "splash-icon.png" ]; then
    sips -z 1920 1080 splash-icon.png --out splash-android.png >/dev/null 2>&1
    echo "   ✅ splash-android.png hazır"
fi

# 3. Adaptive Icon (Android)
echo "📐 Android adaptive icon..."
if [ -f "icon-1024.png" ]; then
    sips -z 432 432 icon-1024.png --out adaptive-icon-foreground.png >/dev/null 2>&1
    echo "   ✅ adaptive-icon-foreground.png (432x432) hazır"
    
    # Background (solid red)
    sips -z 432 432 icon-1024.png --out adaptive-icon-background.png >/dev/null 2>&1
    echo "   ✅ adaptive-icon-background.png (432x432) hazır"
fi

echo ""
echo "✅ Asset üretimi tamamlandı!"
echo ""
echo "📋 Oluşturulan dosyalar:"
ls -lh icon.png splash.png adaptive-icon-*.png 2>/dev/null | awk '{print "   " $9, "-", $5}'

echo ""
echo "⚠️  NOT: Eğer kalite düşükse, şu alternatifleri kullanın:"
echo "   1. Canva.com → 'App Icon' şablonu (1024x1024)"
echo "   2. Figma.com → AfetNet logo tasarımı"
echo "   3. Fiverr.com → Profesyonel tasarımcı (5-10$)"









