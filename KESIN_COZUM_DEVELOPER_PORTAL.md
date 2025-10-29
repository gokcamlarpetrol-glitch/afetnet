# 🔴 KESİN ÇÖZÜM: Developer Portal'dan Manuel Ekleme

## Sorun Neden Devam Ediyor?

Xcode "Automatically manage signing" açıkken bile, bazı capability'leri Developer Portal'a **otomatik ekleyemez**. Bu bir Xcode hatası veya API limitasyonu olabilir.

**Çözüm:** Developer Portal'a **manuel** gidip capability'leri açmanız gerekiyor.

---

## ⚡ ADIM ADIM ÇÖZÜM

### 1️⃣ Developer Portal'a Giriş

1. Tarayıcınızda açın: **https://developer.apple.com/account**
2. Apple ID'niz ile giriş yapın (Gökhan ÇAMCI hesabı)

### 2️⃣ App ID'yi Bulun

1. Sol menüden: **"Certificates, Identifiers & Profiles"** → tıklayın
2. Sol menüden: **"Identifiers"** → tıklayın
3. Arama kutusuna yazın: `com.gokhancamci.afetnetapp`
4. **"AfetNet"** veya **"com.gokhancamci.afetnetapp"** → tıklayın

### 3️⃣ Capability'leri Açın

Şu capability'lerin **HEPSİNİN** ✅ işaretli olduğundan emin olun:

#### ✅ Mutlaka Açık Olmalı:
- [ ] **Push Notifications** → ✅ işaretleyin
- [ ] **Background Modes** → ✅ işaretleyin
  - Alt seçenekler:
    - [ ] Remote notifications
    - [ ] Background fetch
    - [ ] Background processing
- [ ] **Bluetooth LE** → ✅ işaretleyin
  - Alt seçenekler:
    - [ ] Acts as a Bluetooth LE accessory (Central Role)
    - [ ] Acts as a Bluetooth LE accessory (Peripheral Role)
- [ ] **Location Services** → ✅ işaretleyin
- [ ] **In-App Purchase** → ✅ işaretleyin (zaten açık olabilir)
- [ ] **Associated Domains** → ✅ işaretleyin (zaten açık olabilir)

#### 📋 Diğerleri (varsa):
- [ ] Sign in with Apple
- [ ] Apple Pay (zaten açık)
- [ ] HealthKit (eğer kullanıyorsanız)

### 4️⃣ Save (Kaydet)

1. Sayfanın en altına inin
2. **"Save"** butonuna tıklayın
3. **"Confirm"** → tıklayın
4. ✅ "Your App ID has been registered" mesajını bekleyin

### 5️⃣ Provisioning Profile'ı Yenileyin

1. Sol menüden: **"Profiles"** → tıklayın
2. `com.gokhancamci.afetnetapp` ile başlayan profil(ler)i bulun:
   - **Development** profilleri (örn: "iOS Team Provisioning Profile")
   - **Distribution** profilleri (Archive için)

3. Her profil için:
   - Profil'e tıklayın
   - **"Edit"** butonuna tıklayın
   - **"Generate"** (veya "Download") → tıklayın
   - Yeni profili indirin

### 6️⃣ Xcode'a Geri Dönün

1. **Xcode'u açın** (`ios/AfetNet.xcworkspace`)

2. **Preferences → Accounts:**
   - ⌘, (virgül tuşu)
   - "Gökhan ÇAMCI" hesabını seçin
   - **"Download Manual Profiles"** → tıklayın
   - ✅ "Profiles downloaded successfully" mesajını bekleyin

3. **Signing & Capabilities:**
   - Debug sekmesi → **"Try Again"** → tıklayın
   - Release sekmesi → **"Try Again"** → tıklayın

4. **Başarılı olursa:** ✅ "Your code signing certificate is managed by Xcode" mesajını göreceksiniz

5. **Hala hata varsa:**
   - Build → Clean Build Folder (⌘⇧K)
   - Tekrar "Try Again"

---

## 🔍 KONTROL LİSTESİ

Developer Portal'da şunların **HEPSİ** açık olmalı:

```
✅ Push Notifications
✅ Background Modes
   ✅ Remote notifications
   ✅ Background fetch
   ✅ Background processing
✅ Bluetooth LE
   ✅ Acts as a Bluetooth LE accessory (Central)
   ✅ Acts as a Bluetooth LE accessory (Peripheral)
✅ Location Services
✅ In-App Purchase
✅ Associated Domains
```

---

## ⚠️ SIK SORULAN SORULAR

### Soru: "Edit" butonu görünmüyor
**Cevap:** Profil "Active" durumda olmalı. Eğer "Invalid" ise, önce App ID'deki capability'leri açın, sonra profili yeniden oluşturun.

### Soru: "Generate" butonu disabled
**Cevap:** Önce App ID'yi düzenleyip Save yapın, sonra profili düzenleyin.

### Soru: Xcode hala hata veriyor
**Cevap:**
1. Xcode'u tamamen kapatın (⌘Q)
2. `~/Library/Developer/Xcode/DerivedData/AfetNet-*` → silin (zaten silindi)
3. Xcode'u açın → Preferences → Accounts → Download Manual Profiles
4. Clean Build Folder (⌘⇧K)
5. Try Again

### Soru: Team hesabında yeterli yetki yok
**Cevap:** Apple Developer Program üyeliğinizin "Admin" veya "App Manager" yetkisi olmalı. "Member" ise capability'leri açamazsınız.

---

## 🎯 BEKLENEN SONUÇ

Developer Portal'da capability'leri açıp, profilleri yeniledikten sonra:

✅ Xcode'da "Automatic signing failed" hatası **KAYBOLMALI**
✅ "Your code signing certificate is managed by Xcode" mesajı görünmeli
✅ Archive yapabiliyor olmalısınız

---

## 📞 Hala Çalışmıyorsa

1. Xcode versiyonunuzu kontrol edin (güncel olmalı)
2. Apple Developer Program üyeliğinizin aktif olduğundan emin olun
3. Terminal'de şu komutu çalıştırın:
   ```bash
   xcodebuild -showBuildSettings -project ios/AfetNet.xcodeproj -target AfetNet | grep CODE_SIGN
   ```

---

**NOT:** Bu işlem her capability değişikliğinde tekrarlanmalı. Developer Portal'da açmadığınız capability'ler Xcode'da görünmez ve profil oluşturulamaz.

