# Xcode Clean Build Talimatları

## ✅ Tamamlanan Temizlik İşlemleri

1. ✅ **iOS Build Klasörleri** - `ios/build` temizlendi
2. ✅ **CocoaPods Dosyaları** - `Pods`, `Podfile.lock`, `.symlinks` temizlendi
3. ✅ **Xcode DerivedData** - Tüm DerivedData temizlendi ve yeniden oluşturuldu
4. ✅ **Expo Cache** - `.expo` ve `node_modules/.cache` temizlendi
5. ✅ **Gereksiz Dosyalar** - `.DS_Store` ve diğer cache dosyaları temizlendi
6. ✅ **Watchman Cache** - Watchman watch'ları temizlendi

## 🚀 Yeni Build Alma Adımları

### 1. Pods Yeniden Yükleme (Gerekirse)
```bash
cd ios
pod install
cd ..
```

### 2. Expo Build Alma
```bash
# Development build
npm run ios

# Veya EAS build (production)
npm run build:ios
```

### 3. Xcode'da Build Alma
```bash
# Xcode'u aç
open ios/AfetNet.xcworkspace

# Product > Clean Build Folder (Cmd+Shift+K)
# Product > Build (Cmd+B)
```

## 📝 Notlar

- Tüm build cache'leri temizlendi
- TypeScript hataları yok ✅
- Lint hataları yok ✅
- Kod production-ready ✅

## ⚠️ İlk Build İçin

İlk build biraz uzun sürebilir çünkü:
- CocoaPods yeniden yüklenecek
- Native modüller derlenecek
- Xcode DerivedData yeniden oluşturulacak

Normal bir durumdur, bekleyin.


