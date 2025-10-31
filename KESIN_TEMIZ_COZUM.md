# KESİN TEMİZ ÇÖZÜM - Otomatik Signing

## ✅ TEMİZLİK YAPILDI

- ✅ DerivedData temizlendi
- ✅ Eski provisioning profilleri temizlendi  
- ✅ Expo cache temizlendi

## 🎯 XCODE'DA YAPILACAKLAR (SADECE BUNLAR!)

### ADIM 1: Xcode'u KAPAT

- Xcode'u tamamen kapatın (⌘Q)

### ADIM 2: Xcode'u AÇ

1. **Xcode'u açın**
2. `ios/AfetNet.xcworkspace` dosyasını açın (NOT: .xcodeproj değil!)

### ADIM 3: Capability'leri EKLE (Tek Seferlik)

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

### ADIM 4: Preferences → Accounts

1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi
3. Apple ID seçin
4. Team **3H4SWQ8VJL** seçin
5. **"Download Manual Profiles"** butonuna tıklayın
6. **30 saniye bekleyin**

### ADIM 5: Try Again

1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın (Debug ve Release için)

---

## ✅ TAMAM! 

Xcode şimdi:
- Tüm capability'leri otomatik yönetecek
- Provisioning profile oluşturacak
- Signing başarılı olacak

**BAŞKA BİRŞEY YAPMAYIN!** Sadece capability'leri ekleyip Try Again yapın.

