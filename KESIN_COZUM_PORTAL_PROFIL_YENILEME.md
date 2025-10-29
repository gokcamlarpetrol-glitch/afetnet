# 🔴 KESİN ÇÖZÜM - Developer Portal Profil Yenileme

## ⚠️ SORUN

Xcode'da "Acts as a Bluetooth LE accessory" işaretli ama hata devam ediyor:
- "Provisioning profile doesn't include the com.apple.developer.background-fetch, com.apple.developer.bluetooth-central, and com.apple.developer.bluetooth-peripheral entitlements"

**SEBEP:** Developer Portal'da App ID'de capability'ler açık değil VEYA profil eski/yetersiz.

---

## ✅ KESİN ÇÖZÜM (Developer Portal'dan Manuel)

### ADIM 1: Developer Portal'a Gidin

1. **https://developer.apple.com/account** → açın
2. Apple ID ile giriş yapın (Gökhan ÇAMCI)

---

### ADIM 2: App ID'yi Açın ve Capability'leri İŞARETLEYİN

1. **Certificates, Identifiers & Profiles** → **Identifiers**
2. Arama kutusuna: **`com.gokhancamci.afetnetapp`** yazın
3. **"AfetNet"** veya **"com.gokhancamci.afetnetapp"** → tıklayın
4. **Edit** butonuna tıklayın (sağ üstte)

---

### ADIM 3: TÜM CAPABILITY'LERİ KESİNLİKLE İŞARETLEYİN

**ÖNEMLİ:** Her birini kontrol edip işaretleyin:

#### A. Push Notifications
- ✅ **Push Notifications** → İŞARETLE

#### B. Background Modes
- ✅ **Background Modes** → İŞARETLE
- ✅ **"Configure"** butonuna tıklayın (yanındaki)
- İçinde şunlar İŞARETLİ olmalı:
  - ✅ **Remote notifications**
  - ✅ **Background fetch**
  - ✅ **Background processing**
  - ✅ **Location updates**
- ✅ **"Done"** veya **"Continue"** → tıklayın

#### C. Bluetooth LE (EN ÖNEMLİSİ!)
- ✅ **Bluetooth LE** → İŞARETLE
- ✅ **"Configure"** butonuna tıklayın (yanındaki)
- İçinde şunlar İŞARETLİ olmalı:
  - ✅ **Acts as a Bluetooth LE accessory (Central Role)** → İŞARETLE
  - ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)** → İŞARETLE
- ✅ **"Done"** veya **"Continue"** → tıklayın

#### D. Diğer Capability'ler
- ✅ **Location Services** → İŞARETLE
- ✅ **In-App Purchase** → İŞARETLE
- ✅ **Associated Domains** → İŞARETLE
- ✅ **Apple Pay** → İŞARETLE (zaten açık olabilir)

---

### ADIM 4: Save ve Confirm

1. Sayfanın en altına inin
2. **"Save"** butonuna tıklayın
3. Çıkan onay penceresinde **"Confirm"** → tıklayın
4. ✅ **"Your App ID has been registered"** mesajını bekleyin (10-15 saniye)

---

### ADIM 5: Profilleri YENİDEN OLUŞTUR (KRİTİK!)

**Developer Portal'da:**

1. Sol menüden **"Profiles"** sekmesine tıklayın
2. Arama kutusuna: **`com.gokhancamci.afetnetapp`** yazın
3. **"iOS Team Provisioning Profile: com.gokhancamci.afetnetapp"** bulun
4. Profil'e tıklayın
5. **"Edit"** butonuna tıklayın
6. **Hiçbir şeyi değiştirmeden** **"Generate"** (veya **"Regenerate"**) butonuna tıklayın
7. ✅ Yeni profil oluşturulacak → **"Download"** → tıklayın ve indirin

**NOT:** Eğer **Distribution** (App Store) profili de varsa, onu da aynı şekilde yenileyin.

---

### ADIM 6: Xcode Cache Temizle ve Profilleri İndir

**Terminal'de:**

```bash
cd /Users/gokhancamci/AfetNet1
./XCODE_PROFILE_YENILE_SCRIPT.sh
```

VEYA manuel:

```bash
# Xcode'u kapat
killall Xcode

# Cache temizle
rm -rf ~/Library/Developer/Xcode/DerivedData/AfetNet-*
rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/*
rm -rf ~/Library/Caches/com.apple.dt.Xcode
```

---

### ADIM 7: Xcode'u Açın ve Profilleri İndir

1. **Xcode'u açın:** `open ios/AfetNet.xcworkspace`

2. **Preferences → Accounts** (⌘, virgül)
   - **"Gökhan ÇAMCI"** seçili
   - **"Download Manual Profiles"** → tıklayın
   - ✅ **"Profiles downloaded successfully"** mesajını bekleyin (20-30 saniye)

---

### ADIM 8: Signing & Capabilities → Try Again

1. **Signing & Capabilities** sekmesine gidin
2. ✅ **"Automatically manage signing"** → İŞARETLİ olmalı
3. **"Try Again"** butonuna tıklayın
4. ✅ **10-15 saniye bekleyin**

---

## ✅ BEKLENEN SONUÇ

✅ **"Automatic signing failed"** hatası **KAYBOLMALI**
✅ **"Your code signing certificate is managed by Xcode"** görünmeli
✅ Hata mesajı **OLMAMALI**

---

## 🔄 EĞER HALA HATA VARSA

### Alternatif 1: Automatic Signing'i Kapatıp Aç

1. **"Automatically manage signing"** → **KAPATIN**
2. **5 saniye bekleyin**
3. **"Automatically manage signing"** → **TEKRAR AÇIN**
4. Xcode yeni profil oluşturacak
5. **Try Again**

### Alternatif 2: Developer Portal'da Profili Sil ve Yeni Oluştur

1. Developer Portal → **Profiles**
2. **"iOS Team Provisioning Profile: com.gokhancamci.afetnetapp"** → **Delete**
3. **"+"** butonuna tıklayın → **"iOS App Development"** → **Continue**
4. **App ID:** com.gokhancamci.afetnetapp → seçin
5. **Certificates:** Apple Development sertifikalarınızı seçin
6. **Devices:** Test cihazlarınızı seçin (gerekirse)
7. **"Generate"** → Profili indirin
8. Xcode → **Preferences → Accounts → Download Manual Profiles**
9. **Try Again**

---

## 📋 KONTROL LİSTESİ

### Developer Portal (YAPILACAK)
- [ ] Identifiers → com.gokhancamci.afetnetapp → Edit
- [ ] Push Notifications → İŞARETLE
- [ ] Background Modes → İŞARETLE → Configure → Alt seçenekleri işaretle
- [ ] Bluetooth LE → İŞARETLE → Configure → Central + Peripheral İŞARETLE
- [ ] Location Services → İŞARETLE
- [ ] In-App Purchase → İŞARETLE
- [ ] Associated Domains → İŞARETLE
- [ ] Save → Confirm
- [ ] Profiles → Profil bul → Edit → Generate → İndir

### Xcode (YAPILACAK)
- [ ] Cache temizle (script ile)
- [ ] Xcode'u aç
- [ ] Preferences → Accounts → Download Manual Profiles
- [ ] Signing & Capabilities → Try Again
- [ ] Hata yok mu kontrol et

---

**🎯 EN ÖNEMLİ NOKTA:**
Developer Portal'da **Bluetooth LE → Configure → Central + Peripheral** kesinlikle işaretli olmalı!

Bu olmadan profil entitlement'ları içermez → Hata devam eder.

