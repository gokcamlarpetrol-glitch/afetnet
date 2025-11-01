# ✅ XCODE OTOMATİK EŞLEŞME REHBERİ

## 🎯 YAPILAN DEĞİŞİKLİKLER

### 1. Info.plist ✅
- ✅ `bluetooth-peripheral` → UIBackgroundModes'e **EKLENDİ**
- ✅ `NSBluetoothPeripheralUsageDescription` → **EKLENDİ** (TR açıklama)
- ✅ `NSBluetoothAlwaysUsageDescription` → **GÜNCELLENDİ** (mesh ağ vurgusu)

### 2. Entitlements Dosyaları ✅
- ✅ `com.apple.developer.bluetooth-peripheral` → Debug entitlements'a **EKLENDİ**
- ✅ `com.apple.developer.bluetooth-peripheral` → Release entitlements'a **EKLENDİ**
- ✅ `com.apple.developer.bluetooth-central` → Her ikisinde de mevcut

### 3. project.pbxproj ✅
- ✅ `CODE_SIGN_STYLE = Automatic` (zaten ayarlandı)
- ✅ `DEVELOPMENT_TEAM = 3H4SWQ8VJL` (zaten ayarlandı)
- ✅ `PROVISIONING_PROFILE_SPECIFIER` kaldırıldı (zaten yapıldı)
- ✅ `SystemCapabilities` → `com.apple.BluetoothLE = enabled = 1` (zaten var)

---

## 🚀 XCODE'DA YAPILACAKLAR (OTOMATİK EŞLEŞME İÇİN)

### ADIM 1: Xcode'u Açın

```bash
open ios/AfetNet.xcworkspace
```

### ADIM 2: Clean Build Folder

1. **Product → Clean Build Folder** (⌘⇧K)
2. ✅ Temizleme tamamlanana kadar bekleyin

### ADIM 3: Signing & Capabilities Kontrolü

**Xcode'da:**

1. **Signing & Capabilities** sekmesine gidin
2. ✅ **"Automatically manage signing"** → **İŞARETLİ OLMALI**
3. **Team:** Gökhan ÇAMCI → seçili
4. **Bundle Identifier:** com.gokhancamci.afetnetapp

### ADIM 4: Capability'leri Ekle (Xcode Otomatik Eşleştirecek)

#### A. Background Modes
1. **"+ Capability"** → **"Background Modes"** → Add
2. ✅ **Şunları İŞARETLEYİN:**
   - ✅ Background fetch
   - ✅ Remote notifications
   - ✅ Background processing
   - ✅ Location updates
   - ✅ **Acts as a Bluetooth LE accessory** (ÖNEMLİ!)

#### B. Bluetooth LE (Ayrı Capability)
1. **"+ Capability"** → **"Acts as a Bluetooth LE accessory"** → Add
2. Dialog açılırsa: **"Enable Bluetooth LE capability?"** → **"Enable All"** → tıklayın
3. ✅ **Şunları İŞARETLEYİN:**
   - ✅ **Acts as a Bluetooth LE accessory (Central Role)**
   - ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)**

**NOT:** Eğer Central/Peripheral rolleri görünmüyorsa → Adım 5'e geçin

### ADIM 5: Otomatik Eşleştirme İçin Xcode'un Developer Portal'a Bağlanması

**Xcode otomatik olarak Developer Portal'a capability'leri eklemeye çalışır. Bunu zorlamak için:**

1. **"Automatically manage signing"** checkbox'ını **KAPATIN**
2. **5 saniye bekleyin**
3. **"Automatically manage signing"** checkbox'ını **TEKRAR AÇIN**
4. Xcode bir dialog gösterecek: **"Enable capabilities?"** → **"Enable All"** → tıklayın
5. Xcode otomatik olarak Developer Portal'a bağlanıp capability'leri ekleyecek

---

### ADIM 6: Preferences → Accounts → Download Profiles

1. **Xcode → Preferences** (⌘, virgül)
2. **Accounts** → **"Gökhan ÇAMCI"** seçili
3. **"Download Manual Profiles"** → tıklayın
4. ✅ **"Profiles downloaded successfully"** mesajını bekleyin (20-30 saniye)

---

### ADIM 7: Try Again ve Kontrol

1. **Signing & Capabilities** → **"Try Again"** → tıklayın
2. ✅ **10-15 saniye bekleyin**
3. ✅ Hata mesajı **OLMAMALI**

---

## ✅ BEKLENEN SONUÇ

### Xcode'da Görülmesi Gerekenler:

```
✅ Background Modes
   ✅ Background fetch
   ✅ Remote notifications
   ✅ Background processing
   ✅ Location updates
   ✅ Acts as a Bluetooth LE accessory

✅ Acts as a Bluetooth LE accessory (ayrı capability)
   ✅ Acts as a Bluetooth LE accessory (Central Role)
   ✅ Acts as a Bluetooth LE accessory (Peripheral Role)

✅ Push Notifications
✅ In-App Purchase
✅ Associated Domains
```

### Hata Mesajı:
- ❌ "Automatic signing failed" → **OLMAMALI**
- ✅ "Your code signing certificate is managed by Xcode" → **GÖRÜNMELİ**

---

## 🔄 EĞER HALA ROLLER GÖRÜNMÜYORSA

### Alternatif: Developer Portal Manuel Ekleme

1. **https://developer.apple.com/account** → açın
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. **com.gokhancamci.afetnetapp** → **Edit**
4. **Bluetooth LE** → **"Configure"** butonuna tıklayın
5. ✅ **"Acts as a Bluetooth LE accessory (Central Role)"** → İŞARETLE
6. ✅ **"Acts as a Bluetooth LE accessory (Peripheral Role)"** → İŞARETLE
7. **Save** → **Confirm**
8. **Profiles** → Profilleri yenile → **Generate**
9. Xcode → **Preferences → Accounts → Download Manual Profiles**
10. Xcode → **Signing & Capabilities → Try Again**

---

## 📋 DOĞRULAMA

### Komut Satırı Kontrolü:

```bash
# Info.plist kontrolü
plutil -p ios/AfetNet/Info.plist | grep -E "UIBackgroundModes|NSBluetooth" -A 5

# Entitlements kontrolü
plutil -p ios/AfetNet/AfetNetDebug.entitlements | grep bluetooth
plutil -p ios/AfetNet/AfetNetRelease.entitlements | grep bluetooth

# Build settings kontrolü
cd ios && xcodebuild -showBuildSettings -project AfetNet.xcodeproj -scheme AfetNet | grep "CODE_SIGN_STYLE\|DEVELOPMENT_TEAM"
```

---

**🎯 ÖNEMLİ:**
Kod tarafı hazır. Şimdi Xcode'da capability'leri ekleyip "Automatically manage signing" ile Xcode'un Developer Portal'a otomatik eşleşmesini sağlayın.

Xcode capability'leri ekleyince otomatik olarak Developer Portal'a da eklenecek (yetki varsa).








