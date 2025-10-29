# SON ADIMLAR - Xcode'da Yapılacaklar

## ✅ Proje Dosyası HAZIR

- ✅ **SystemCapabilities** doğru yere eklendi (PBXProject section)
- ✅ **DerivedData** temizlendi
- ✅ Tüm ayarlar doğru

## 🎯 Xcode'da ŞİMDİ YAPILACAKLAR (Sırayla!)

### ADIM 1: Xcode'u Kapat
- Xcode'u tamamen kapatın (⌘Q)

### ADIM 2: Xcode'u Aç ve Projeyi Aç
- Xcode'u açın
- `ios/AfetNet.xcworkspace` dosyasını açın (NOT: .xcodeproj değil!)

### ADIM 3: Capability'leri Kaldır
**Signing & Capabilities** sekmesinde:

1. **Background Modes** → Sağdaki **"-"** butonuna tıklayın → **KALDIRIN**
2. Eğer varsa **Push Notifications** → "-" ile kaldırın
3. Eğer varsa **Bluetooth LE** → "-" ile kaldırın

### ADIM 4: Capability'leri Tekrar Ekle
1. **"+ Capability"** butonuna tıklayın
2. **Background Modes** → Ekle
3. İçinde **TÜMÜNÜ** işaretleyin:
   - ✅ Remote notifications
   - ✅ Background fetch
   - ✅ Background processing
   - ✅ Location updates
   - ✅ Acts as a Bluetooth LE accessory
   - ✅ Uses Bluetooth LE accessories

4. **"+ Capability"** → **Push Notifications** → Ekle

### ADIM 5: Preferences → Accounts
1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID seçin
4. Team **3H4SWQ8VJL** seçin
5. **"Download Manual Profiles"** → Tıklayın
6. Bekleyin (birkaç saniye)

### ADIM 6: Try Again
1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın
3. Xcode şimdi:
   - SystemCapabilities'ı okuyacak (doğru yerde artık)
   - Developer Portal'da capability'leri **OTOMATIK AÇACAK**
   - Yeni provisioning profile oluşturacak

---

## ✅ Beklenen Sonuç

Bu adımları tamamladıktan sonra:
- ✅ "Automatic signing succeeded" mesajı
- ✅ Provisioning Profile capability'leri içeriyor
- ✅ Archive alabilirsiniz!

---

## ⚠️ ÖNEMLİ NOTLAR

1. **Xcode'u kapatıp açmak zorunlu** - proje dosyası değişti
2. **Capability'leri kaldırıp tekrar eklemek zorunlu** - SystemCapabilities bunları Portal'da aktif eder
3. **.xcworkspace açın** - .xcodeproj değil!

---

## 🔍 Hala Çalışmazsa

Eğer hala hata varsa:
1. **Report Navigator** açın (⌘9)
2. **Update Signing** raporuna bakın
3. Hata mesajını paylaşın

---

**SystemCapabilities artık DOĞRU YERDE!** Xcode bunu okuyup Developer Portal'da otomatik aktif edecek.

