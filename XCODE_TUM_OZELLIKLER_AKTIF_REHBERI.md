# ✅ XCODE TÜM ÖZELLİKLER AKTİF REHBERİ

## 📋 YAPILAN DEĞİŞİKLİKLER (Kod Tarafında)

### ✅ 1. Info.plist Güncellemeleri

**UIBackgroundModes:** Tam listesi eklendi
```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>    ✅ Push notifications
    <string>fetch</string>                  ✅ Background fetch
    <string>processing</string>              ✅ Background processing
    <string>location</string>                ✅ Location updates
    <string>bluetooth-central</string>       ✅ BLE Central role
    <string>bluetooth-peripheral</string>   ✅ BLE Peripheral role
</array>
```

**NSLocationAlwaysAndWhenInUseUsageDescription:** Eklendi (iOS 11+ için gerekli)

### ✅ 2. Entitlements Dosyaları

**AfetNetDebug.entitlements:**
- ✅ `aps-environment: development` (Debug için)
- ✅ `background-fetch`
- ✅ `bluetooth-central`
- ✅ `bluetooth-peripheral`
- ✅ `associated-domains`
- ✅ `in-app-payments`

**AfetNetRelease.entitlements:**
- ✅ `aps-environment: production` (Release için)
- ✅ `background-fetch`
- ✅ `bluetooth-central`
- ✅ `bluetooth-peripheral`
- ✅ `associated-domains`
- ✅ `in-app-payments`

### ✅ 3. project.pbxproj (SystemCapabilities)

```pbxproj
SystemCapabilities = {
    com.apple.BackgroundModes = { enabled = 1; };
    com.apple.BluetoothLE = { enabled = 1; };
    com.apple.InAppPurchase = { enabled = 1; };
    com.apple.LocationServices = { enabled = 1; };
    com.apple.Push = { enabled = 1; };
};
```

---

## 🎯 XCODE'DA YAPMANIZ GEREKENLER

### Adım 1: Xcode'u Açın
1. **Xcode** → **ios/AfetNet.xcworkspace** açın
2. Sol tarafta **"AfetNet" target** seçili olsun

### Adım 2: Signing & Capabilities Sekmesi

#### 2.1. Background Modes
- **"+ Capability"** butonuna tıklayın
- **"Background Modes"** → ekleyin
- ✅ **Şunları işaretleyin:**
  - ✅ **Background fetch**
  - ✅ **Remote notifications**
  - ✅ **Background processing**
  - ✅ **Location updates**

#### 2.2. Bluetooth LE
- **"+ Capability"** butonuna tıklayın
- **"Acts as a Bluetooth LE accessory"** → ekleyin
- ✅ **Şunları işaretleyin:**
  - ✅ **Acts as a Bluetooth LE accessory (Central Role)**
  - ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)**

#### 2.3. Push Notifications
- **"+ Capability"** butonuna tıklayın
- **"Push Notifications"** → ekleyin
- ✅ **Aktif olmalı**

#### 2.4. Location Services
- Zaten açık olabilir, kontrol edin
- Eğer yoksa: **"+ Capability"** → **"Location Services"** → ekleyin
- ✅ **"Always" ve "When In Use"** seçenekleri görünmeli

#### 2.5. Associated Domains
- Zaten açık olmalı
- ✅ **applinks:afetnet.app** listede olmalı

#### 2.6. Apple Pay / In-App Purchase
- Zaten açık olmalı
- ✅ **merchant.com.gokhancamci.afetnetapp** seçili olmalı

### Adım 3: Signing Ayarları

**Her iki configuration için (Debug ve Release):**

1. ✅ **"Automatically manage signing"** → **İŞARETLİ OLMALI**
2. **Team:** Gökhan ÇAMCI seçili
3. **Bundle Identifier:** `com.gokhancamci.afetnetapp`
4. **Provisioning Profile:** "Xcode Managed Profile" (otomatik)
5. **Signing Certificate:** "Apple Development" (Debug) / "Apple Distribution" (Release)

### Adım 4: Profilleri Yenileyin

1. **Xcode → Preferences** (⌘,)
2. **Accounts** sekmesi → **"Gökhan ÇAMCI"** seçili
3. **"Download Manual Profiles"** → tıklayın
4. ✅ "Profiles downloaded successfully" mesajını bekleyin

### Adım 5: Signing & Capabilities'e Geri Dönün

1. **Signing & Capabilities** sekmesine geri dönün
2. **Debug** sekmesi → **"Try Again"** → tıklayın
3. **Release** sekmesi → **"Try Again"** → tıklayın

---

## ✅ BEKLENEN SONUÇ

### Başarılı Olursa:
- ✅ **"Automatic signing failed"** hatası KAYBOLMALI
- ✅ **"Your code signing certificate is managed by Xcode"** görünmeli
- ✅ Hata veya uyarı mesajı OLMAMALI

### Capability'ler Şu Şekilde Görünmeli:

```
✅ Background Modes
   ✅ Background fetch
   ✅ Remote notifications
   ✅ Background processing
   ✅ Location updates

✅ Acts as a Bluetooth LE accessory
   ✅ Acts as a Bluetooth LE accessory (Central Role)
   ✅ Acts as a Bluetooth LE accessory (Peripheral Role)

✅ Push Notifications (aktif)

✅ Location Services (aktif)

✅ Associated Domains
   ✅ applinks:afetnet.app

✅ Apple Pay
   ✅ merchant.com.gokhancamci.afetnetapp
```

---

## ⚠️ EĞER HALA HATA VARSA

### Hata: "Provisioning profile doesn't include entitlements"

**Çözüm: Developer Portal Kontrolü**

1. **https://developer.apple.com/account** → açın
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. **com.gokhancamci.afetnetapp** → tıklayın
4. **Edit** → tıklayın
5. **Şunların HEPSİNİN işaretli olduğundan emin olun:**
   - ✅ **Push Notifications**
   - ✅ **Background Modes** (Remote notifications, Background fetch, Background processing, Location updates)
   - ✅ **Bluetooth LE** (Central + Peripheral)
   - ✅ **Location Services**
   - ✅ **In-App Purchase**
   - ✅ **Associated Domains**
6. **Save** → **Confirm**
7. **Profiles** → İlgili profilleri **Edit → Generate**
8. **Xcode → Preferences → Accounts → Download Manual Profiles**
9. **Try Again**

---

## 📝 KONTROL LİSTESİ

### Kod Tarafı (✅ Tamamlandı)
- [x] Info.plist → UIBackgroundModes (6 mode eklendi)
- [x] Info.plist → NSLocationAlwaysAndWhenInUseUsageDescription
- [x] AfetNetDebug.entitlements → aps-environment: development
- [x] AfetNetDebug.entitlements → Tüm entitlement'lar
- [x] AfetNetRelease.entitlements → aps-environment: production
- [x] AfetNetRelease.entitlements → Tüm entitlement'lar
- [x] project.pbxproj → SystemCapabilities (tamamlandı)

### Xcode UI Tarafı (Yapılacak)
- [ ] Background Modes capability ekli
- [ ] Background Modes alt seçenekleri işaretli
- [ ] Bluetooth LE capability ekli
- [ ] Bluetooth LE Central + Peripheral işaretli
- [ ] Push Notifications capability ekli
- [ ] Location Services capability ekli
- [ ] Associated Domains ekli
- [ ] Apple Pay ekli
- [ ] Profiller indirildi
- [ ] "Try Again" tıklandı
- [ ] Hata mesajı yok

### Developer Portal Tarafı (Gerekiyorsa)
- [ ] App ID'de tüm capability'ler açık
- [ ] Profiller yenilendi

---

## 🚀 SON ADIM: Build ve Archive

1. **Product → Clean Build Folder** (⌘⇧K)
2. **Product → Archive** (⌘B sonra Archive)
3. ✅ Archive başarılı olmalı
4. ✅ App Store Connect'e upload yapabilmelisiniz

---

## 💡 NOTLAR

- **Debug:** `aps-environment: development` kullanır
- **Release:** `aps-environment: production` kullanır
- **Automatic Signing:** Açık kalmalı (Xcode yönetir)
- **Team:** Gökhan ÇAMCI (3H4SWQ8VJL) seçili olmalı
- **Bundle ID:** `com.gokhancamci.afetnetapp` sabit kalmalı

---

## 📞 SORUN GİDERME

### "Acts as a Bluetooth LE accessory" seçeneği görünmüyor
- **"+ Capability"** → **"Bluetooth"** yazın → ekleyin

### Capability ekleyemiyorum
- **Team** hesabının **Admin** veya **App Manager** yetkisi olmalı
- Developer Portal'da capability önce açılmalı

### Profil indirmeme rağmen hata devam ediyor
- Xcode'u kapatıp açın
- `~/Library/Developer/Xcode/DerivedData/AfetNet-*` → silin
- Preferences → Accounts → Download Manual Profiles
- Clean Build Folder → Try Again

---

**✅ Kod tarafında her şey hazır. Şimdi Xcode UI'da capability'leri ekleyip işaretlemeniz gerekiyor!**

