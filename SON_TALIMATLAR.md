# SON TALIMATLAR - Temiz Çözüm

## ✅ YAPILAN TEMİZLİK

- ✅ DerivedData temizlendi
- ✅ Eski provisioning profilleri temizlendi
- ✅ Expo cache temizlendi
- ✅ Info.plist'te UIBackgroundModes eklendi

## 🎯 XCODE'DA YAPILACAKLAR (ŞİMDİ!)

### ADIM 1: Xcode'u AÇ

1. **Xcode'u açın** (eğer kapalıysa)
2. `ios/AfetNet.xcworkspace` dosyasını açın

### ADIM 2: Capability'leri EKLE

**Signing & Capabilities** sekmesinde:

1. **"+ Capability"** butonuna tıklayın
2. **Background Modes** → Ekle
3. İçinde şunları işaretleyin:
   - ✅ Remote notifications
   - ✅ Background fetch
   - ✅ Background processing
   - ✅ Location updates
   - ✅ Acts as a Bluetooth LE accessory
   - ✅ Uses Bluetooth LE accessories

4. **"+ Capability"** butonuna tıklayın
5. **Push Notifications** → Ekle

### ADIM 3: Preferences → Accounts

1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID seçin
4. Team **3H4SWQ8VJL** seçin
5. **"Download Manual Profiles"** butonuna tıklayın
6. **30 saniye bekleyin**

### ADIM 4: Try Again

1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın (hem Debug hem Release için)

---

## ✅ BEKLENEN SONUÇ

Bu adımları takip ettikten sonra:
- ✅ "Automatic signing succeeded" mesajı
- ✅ Provisioning Profile capability'leri içeriyor
- ✅ Archive alabilirsiniz

**BAŞKA BİRŞEY YAPMAYIN!** Sadece capability'leri ekleyip Try Again yapın.









