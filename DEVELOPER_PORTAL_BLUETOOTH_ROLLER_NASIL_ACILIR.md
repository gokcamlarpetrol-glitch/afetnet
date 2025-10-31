# 🔴 DEVELOPER PORTAL'DA BLUETOOTH ROLLER NASIL AÇILIR?

## ⚠️ SORUN

Apple Developer Portal'da Bluetooth LE capability'sinde:
- ❌ "Acts as a Bluetooth LE accessory (Central Role)" görünmüyor
- ❌ "Acts as a Bluetooth LE accessory (Peripheral Role)" görünmüyor

**SEBEP:** Bu seçenekler farklı bir yerde veya farklı bir isimle olabilir.

---

## ✅ KESİN ÇÖZÜM - ADIM ADIM

### ADIM 1: Developer Portal'a Girin

1. **https://developer.apple.com/account** → açın
2. Apple ID ile giriş yapın (Gökhan ÇAMCI)
3. **"Certificates, Identifiers & Profiles"** → tıklayın

---

### ADIM 2: App ID'yi Bulun

1. Sol menüden **"Identifiers"** → tıklayın
2. Arama kutusuna: **`com.gokhancamci.afetnetapp`** yazın
3. **"AfetNet"** veya **"com.gokhancamci.afetnetapp"** → tıklayın
4. **"Edit"** butonuna tıklayın (sağ üstte)

---

### ADIM 3: Bluetooth LE Capability'sini Bulun

1. Aşağı kaydırın
2. **"Bluetooth LE"** capability'sini bulun
3. ✅ **Bluetooth LE checkbox'ının İŞARETLİ olduğundan emin olun**
4. Bluetooth LE'nin yanında **"Configure"** butonu var mı kontrol edin

---

### ADIM 4A: "Configure" Butonu VARSA

1. **"Configure"** butonuna tıklayın
2. Bir dialog/modal açılacak
3. Şu seçenekleri arayın:
   - ✅ **"Acts as a Bluetooth LE accessory"** (genel checkbox)
   - ✅ **"Central Role"** veya **"Acts as a Bluetooth LE accessory (Central Role)"**
   - ✅ **"Peripheral Role"** veya **"Acts as a Bluetooth LE accessory (Peripheral Role)"**
4. **HEPSİNİ İŞARETLEYİN**
5. **"Done"** veya **"Save"** → tıklayın

---

### ADIM 4B: "Configure" Butonu YOKSA veya Seçenekler Görünmüyorsa

**Bu durumda Bluetooth LE capability'sini KALDIRIP TEKRAR EKLEMELİSİNİZ:**

1. **Bluetooth LE** checkbox'ını **KAPATIN** (işareti kaldırın)
2. **"Save"** → **"Confirm"** → tıklayın
3. **5-10 saniye bekleyin**
4. **"Edit"** → tekrar tıklayın
5. **Bluetooth LE** checkbox'ını **TEKRAR AÇIN** (işaretleyin)
6. Artık **"Configure"** butonu görünebilir → tıklayın
7. Şimdi **Central Role** ve **Peripheral Role** seçenekleri görünmeli
8. **Her ikisini İŞARETLEYİN**
9. **"Save"** → **"Confirm"**

---

### ADIM 5: Alternatif Yol - Farklı İsimler

**Eğer "Central Role" ve "Peripheral Role" isimlerini göremiyorsanız:**

Bluetooth LE capability'sinde şu isimlerle görünebilir:
- ✅ **"Bluetooth LE Central"**
- ✅ **"Bluetooth LE Peripheral"**
- ✅ **"Central"** (tek başına)
- ✅ **"Peripheral"** (tek başına)
- ✅ **"Bluetooth LE Central Role"**
- ✅ **"Bluetooth LE Peripheral Role"**

**Hangisini görürseniz, HER İKİSİNİ de işaretleyin!**

---

### ADIM 6: Profili Yeniden Oluştur

**Developer Portal'da:**

1. Sol menüden **"Profiles"** → tıklayın
2. **`com.gokhancamci.afetnetapp`** ile başlayan profilleri bulun
3. Her bir profil için:
   - Profil'e tıklayın → **"Edit"**
   - **"Generate"** (veya **"Regenerate"**) → tıklayın
   - Yeni profili **indirin**

---

### ADIM 7: Xcode'da Profilleri İndir

1. **Xcode** → **Preferences** (⌘, virgül)
2. **Accounts** → **"Gökhan ÇAMCI"** seçili
3. **"Download Manual Profiles"** → tıklayın
4. ✅ **"Profiles downloaded successfully"** mesajını bekleyin (20-30 saniye)

---

### ADIM 8: Xcode'da Capability'yi Yeniden Ekle

1. **Signing & Capabilities** sekmesine gidin
2. **"Acts as a Bluetooth LE accessory"** capability'sini **"-"** ile kaldırın
3. **5 saniye bekleyin**
4. **"+ Capability"** → **"Acts as a Bluetooth LE accessory"** → **Add**
5. **ŞİMDİ ŞUNLARI GÖRMELİSİNİZ:**
   - ✅ **Acts as a Bluetooth LE accessory (Central Role)**
   - ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)**
6. **Her ikisini İŞARETLEYİN**
7. **"Try Again"** → tıklayın

---

## 🎯 ÖNEMLİ NOTLAR

### Developer Portal'da Görünmüyorsa:

1. **Tarayıcı cache'ini temizleyin:**
   - Safari: ⌥⌘E (Clear History)
   - Chrome: ⌘⇧⌫ (Clear browsing data)
   - Sonra Developer Portal'ı yenileyin

2. **Farklı tarayıcı deneyin:**
   - Safari, Chrome, Firefox

3. **Developer Program üyeliğinizi kontrol edin:**
   - Account'uza girin → Membership → Aktif olmalı

4. **Team hesabının yetkisini kontrol edin:**
   - Account Owner veya App Manager yetkisi olmalı
   - Member yetkisi capability'leri değiştiremez

---

## 📋 ALTERNATİF YÖNTEM

### Eğer Developer Portal'da hiç görünmüyorsa:

**Xcode'un otomatik yönetmesine izin verebilirsiniz:**

1. **Xcode'da:**
   - **"Automatically manage signing"** → ✅ İŞARETLE
   - **"+ Capability"** → **"Acts as a Bluetooth LE accessory"** → Add
   - Xcode otomatik olarak Developer Portal'a ekleyebilir

**ANCAK:** Bu yöntem her zaman çalışmayabilir. Developer Portal'dan manuel yapmak daha garantili.

---

## 🔄 SON ÇARE: Apple Developer Support

Eğer hiçbir yöntem çalışmazsa:

1. **https://developer.apple.com/contact** → Developer Support
2. Problem: "Bluetooth LE Central/Peripheral roles not appearing in App ID configuration"
3. Account bilgilerinizi verin
4. Destek ekibi manuel olarak açabilir

---

## 📋 KONTROL LİSTESİ

### Developer Portal Kontrolü
- [ ] Identifiers → com.gokhancamci.afetnetapp → Edit
- [ ] Bluetooth LE → İŞARETLİ mi kontrol et
- [ ] Bluetooth LE → "Configure" butonu var mı kontrol et
- [ ] Configure → Central + Peripheral seçenekleri görünüyor mu?
- [ ] Eğer görünmüyorsa → Bluetooth LE'yi kapat → aç → tekrar dene
- [ ] Central + Peripheral → İŞARETLE → Save
- [ ] Profiles → Profilleri yenile → Generate

### Xcode Kontrolü
- [ ] Preferences → Accounts → Download Manual Profiles
- [ ] Capability'yi kaldır → tekrar ekle
- [ ] Şimdi Central + Peripheral görünüyor mu?
- [ ] Her ikisini İŞARETLE → Try Again

---

**🎯 ŞU AN YAPIN:**
1. **Developer Portal'a gidin**
2. **App ID → Edit → Bluetooth LE → Configure** butonunu arayın
3. **Eğer görünmüyorsa** → Bluetooth LE'yi kapat → aç → tekrar dene
4. **Central + Peripheral rolleri görününce → İŞARETLEYİN**
5. **Save → Profile yenile → Xcode'da tekrar ekle**




