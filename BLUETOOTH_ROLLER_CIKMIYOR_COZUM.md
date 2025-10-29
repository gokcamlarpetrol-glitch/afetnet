# 🔴 CENTRAL/PERIPHERAL ROLLER ÇIKMIYOR - KESİN ÇÖZÜM

## ⚠️ SORUN

"Acts as a Bluetooth LE accessory" capability'sini eklediniz ama:
- ❌ Central Role seçeneği çıkmıyor
- ❌ Peripheral Role seçeneği çıkmıyor
- İşaretleyemiyorsunuz

**SEBEP:** Developer Portal'da Bluetooth LE capability açık ama **Central ve Peripheral rolleri seçilmemiş!**

---

## ✅ KESİN ÇÖZÜM

### ADIM 1: Developer Portal'da Bluetooth LE Rollerini Aç

1. **https://developer.apple.com/account** → açın
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. **com.gokhancamci.afetnetapp** → tıklayın
4. **Edit** → tıklayın
5. **Bluetooth LE** → bulun
6. **"Configure"** butonuna tıklayın (Bluetooth LE'nin yanında)
7. **Şunları İŞARETLEYİN:**
   - ✅ **Acts as a Bluetooth LE accessory (Central Role)** → İŞARETLE
   - ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)** → İŞARETLE
8. **Save** → **Confirm**
9. ✅ Bekleyin (10-15 saniye)

---

### ADIM 2: Provisioning Profile'ı Yeniden Oluştur

**Developer Portal'da:**

1. **Profiles** sekmesine gidin
2. **"iOS Team Provisioning Profile: com.gokhancamci.afetnetapp"** bulun
3. Profil'e tıklayın → **Edit**
4. **Hiçbir şeyi değiştirmeden** **"Generate"** (veya **"Regenerate"**) → tıklayın
5. Yeni profili **indirin**

---

### ADIM 3: Xcode Cache Temizle ve Profilleri İndir

**Terminal'de:**

```bash
cd /Users/gokhancamci/AfetNet1
./XCODE_HIZLI_FIX.sh
```

**VEYA manuel:**

```bash
# Xcode'u kapat
killall Xcode

# Cache'leri temizle
rm -rf ~/Library/Developer/Xcode/DerivedData/AfetNet-*
rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/*
```

---

### ADIM 4: Xcode'da Capability'yi Kaldırıp Tekrar Ekle

1. **Xcode'u açın:** `open ios/AfetNet.xcworkspace`
2. **Signing & Capabilities** sekmesine gidin
3. **"Acts as a Bluetooth LE accessory"** capability'sini bulun
4. **"-"** (eksi) butonuna tıklayın → **KALDIRIN**
5. **Preferences → Accounts** → **"Gökhan ÇAMCI"** → **"Download Manual Profiles"** → tıklayın
6. ✅ "Profiles downloaded successfully" mesajını bekleyin (15-20 saniye)
7. **"+ Capability"** butonuna tıklayın
8. Arama kutusuna **"Bluetooth"** yazın
9. **"Acts as a Bluetooth LE accessory"** → **Add**
10. **ŞİMDİ ŞUNLARI GÖRMELİSİNİZ:**
    - ✅ **Acts as a Bluetooth LE accessory (Central Role)** → İŞARETLEYİN
    - ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)** → İŞARETLEYİN
11. Her ikisini de **İŞARETLEYİN**
12. **"Try Again"** → tıklayın

---

### ADIM 5: Clean Build ve Try Again

1. **Product → Clean Build Folder** (⌘⇧K)
2. **Signing & Capabilities** → **"Try Again"**
3. ✅ Bekleyin (10-15 saniye)

---

## 🎯 ÖNCELİK SIRASI (ÖNEMLİ!)

**1. ÖNCE Developer Portal'da roller açılmalı** (Adım 1)
   - Bluetooth LE → Configure → Central + Peripheral → Save

**2. SONRA profili yenile** (Adım 2)
   - Profile → Generate → İndir

**3. EN SON Xcode'da yeniden ekle** (Adım 4)
   - Capability'yi kaldır → Download Profiles → Tekrar ekle → Roller görünecek

---

## ⚠️ ÖNEMLİ NOT

**Developer Portal'da Central/Peripheral rolleri açık olmadan, Xcode'da bu seçenekler görünmez!**

Bu yüzden **ÖNCE Developer Portal'da açmalısınız**, sonra Xcode'a geri dönmelisiniz.

---

## 📋 ADIM ADIM CHECKLIST

### Developer Portal (ÖNCE BU!)
- [ ] Identifiers → com.gokhancamci.afetnetapp → Edit
- [ ] Bluetooth LE → Configure → tıklayın
- [ ] Central Role → İŞARETLE
- [ ] Peripheral Role → İŞARETLE
- [ ] Save → Confirm
- [ ] Profiles → iOS Team Provisioning Profile → Edit → Generate → İndir

### Xcode (SONRA BU!)
- [ ] Cache temizle (XCODE_HIZLI_FIX.sh)
- [ ] Xcode'u aç
- [ ] Preferences → Accounts → Download Manual Profiles
- [ ] "Acts as a Bluetooth LE accessory" capability'sini KALDIR (-)
- [ ] "+ Capability" → "Acts as a Bluetooth LE accessory" → Add
- [ ] ŞİMDİ Central Role ve Peripheral Role GÖRÜNMELİ
- [ ] Her ikisini İŞARETLE
- [ ] Try Again

---

## 💡 NEDEN BÖYLE?

**Developer Portal ile Xcode senkronizasyonu:**
- Developer Portal'da seçenekler açılmazsa → Xcode'da görünmez
- Developer Portal'da açılsa bile → Profil yenilenmeli
- Profil yenilense bile → Xcode'da capability kaldırılıp tekrar eklenmeli

**Bu yüzden 3 adım gerekli:**
1. Developer Portal → Rolleri aç
2. Profile → Yenile
3. Xcode → Capability'yi yeniden ekle

---

**🎯 ŞU AN YAPIN:**
1. **Developer Portal'a gidin** (Adım 1)
2. **Bluetooth LE → Configure → Central + Peripheral → İŞARETLEYİN**
3. **Save → Profile yenile**
4. **Xcode'da capability'yi tekrar ekleyin** → Roller görünecek!

