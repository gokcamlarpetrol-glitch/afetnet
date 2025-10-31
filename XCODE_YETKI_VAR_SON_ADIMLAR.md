# ✅ YETKİ VAR - SON ADIMLAR (XCODE'DA)

## 🎯 ŞİMDİ YAPILACAKLAR (XCODE'DA)

Yetki varsa → Xcode capability eklerken dialog açılacak → "Enable All" tıklayın → Otomatik eşleşecek!

---

### ADIM 1: Xcode'u Açın ve Clean Build

1. **Xcode'u açın:** `open ios/AfetNet.xcworkspace`
2. **Product → Clean Build Folder** (⌘⇧K)
3. ✅ Temizleme tamamlanana kadar bekleyin (10-15 saniye)

---

### ADIM 2: Mevcut Capability'leri KALDIRIN (Senkronize Etmek İçin)

**Signing & Capabilities** sekmesinde:

1. **Background Modes** capability'sini bulun
2. **"-"** (eksi) butonuna tıklayın → **"Remove"** → **Kaldırın**
3. **Bluetooth** capability'si varsa (ayrı) → **"-"** → **Kaldırın**
4. **Push Notifications** capability'si varsa (ayrı) → **"-"** → **Kaldırın**

**NOT:** Apple Pay, Associated Domains, In-App Purchase → KALSIN (dokunmayın)

---

### ADIM 3: Background Modes'i TEKRAR EKLEYİN

1. **"+ Capability"** butonuna tıklayın
2. Arama kutusuna **"Background"** yazın
3. **"Background Modes"** → **Add** → tıklayın

**4. Şunları İŞARETLEYİN:**
   - ✅ **Background fetch**
   - ✅ **Remote notifications**
   - ✅ **Background processing**
   - ✅ **Location updates**
   - ✅ **Acts as a Bluetooth LE accessory** (EN ÖNEMLİSİ!)

**5. DİALOG AÇILACAK:**
   - **"Would you like to enable these capabilities in your Apple Developer account?"**
   - ✅ **"Enable All"** → **TIKLAYIN** (Bu, Developer Portal'a ekler!)
   - Şifre istenirse → Apple ID şifrenizi girin
   - 2FA varsa → Kodu girin

---

### ADIM 4: Bluetooth LE Capability'sini EKLEYİN

1. **"+ Capability"** butonuna tıklayın
2. Arama kutusuna **"Bluetooth"** yazın
3. **"Acts as a Bluetooth LE accessory"** → **Add** → tıklayın

**4. DİALOG AÇILACAK:**
   - **"Enable Bluetooth LE capability?"**
   - ✅ **"Enable All"** → **TIKLAYIN** (Bu, Developer Portal'a ekler!)

**5. Şunları GÖRMELİSİNİZ (10-30 saniye içinde):**
   - ✅ **Acts as a Bluetooth LE accessory (Central Role)** → İŞARETLEYİN
   - ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)** → İŞARETLEYİN

**Eğer rolleri görünmüyorsa:**
   - 15-20 saniye bekleyin (Xcode Developer Portal'a bağlanıyor)
   - Sayfayı yenileyin (başka bir sekmeye tıklayıp geri dönün)
   - Hala görünmüyorsa → Adım 5'e geçin

---

### ADIM 5: Push Notifications EKLEYİN

1. **"+ Capability"** → **"Push Notifications"** → **Add**
2. Dialog açılırsa → **"Enable All"** → tıklayın
3. ✅ Aktif olmalı

---

### ADIM 6: Automatic Signing'i Kapatıp Aç (Zorla Senkronize)

1. **"Automatically manage signing"** checkbox'ını **KAPATIN** (işareti kaldırın)
2. **10 saniye bekleyin**
3. **"Automatically manage signing"** checkbox'ını **TEKRAR AÇIN** (işaretleyin)
4. **DİALOG AÇILACAK:**
   - **"Would you like to enable these capabilities?"**
   - ✅ **"Enable All"** → **TIKLAYIN**
5. ✅ Xcode otomatik olarak Developer Portal'a bağlanıp capability'leri ekleyecek

---

### ADIM 7: Preferences → Accounts → Download Profiles

1. **Xcode → Preferences** (⌘, virgül)
2. **Accounts** → **"Gökhan ÇAMCI"** seçili
3. **"Download Manual Profiles"** → tıklayın
4. ✅ **"Profiles downloaded successfully"** mesajını bekleyin (**30-40 saniye sürebilir**)

---

### ADIM 8: Try Again

1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın
3. ✅ **15-20 saniye bekleyin** (Xcode yeni profil oluşturuyor)

---

## ✅ BEKLENEN SONUÇ

### Xcode'da Görülmesi Gerekenler:

```
✅ Background Modes
   ✅ Background fetch
   ✅ Remote notifications
   ✅ Background processing
   ✅ Location updates
   ✅ Acts as a Bluetooth LE accessory (İŞARETLİ)

✅ Acts as a Bluetooth LE accessory (ayrı capability)
   ✅ Acts as a Bluetooth LE accessory (Central Role) (İŞARETLİ)
   ✅ Acts as a Bluetooth LE accessory (Peripheral Role) (İŞARETLİ)

✅ Push Notifications
✅ In-App Purchase
✅ Associated Domains
```

### Hata Mesajı:
- ❌ "Automatic signing failed" → **OLMAMALI**
- ✅ "Your code signing certificate is managed by Xcode" → **GÖRÜNMELİ**
- ❌ "Provisioning profile doesn't include..." → **OLMAMALI**

---

## 📋 ÖNEMLİ NOTLAR

### Dialog'lar Açıldığında:
- ✅ **"Enable All"** veya **"Enable"** → Her zaman tıklayın
- ✅ Şifre istenirse → Apple ID şifrenizi girin
- ✅ 2FA varsa → Kodu girin

### Timing:
- Capability ekledikten sonra → **10-30 saniye bekleyin**
- Download Profiles → **30-40 saniye bekleyin**
- Try Again → **15-20 saniye bekleyin**

### Roller Görünmüyorsa:
1. **15-20 saniye bekleyin** (Xcode Developer Portal'a bağlanıyor)
2. **Sayfayı yenileyin** (başka sekmeye tıklayıp geri dönün)
3. **Hala görünmüyorsa** → Automatic signing kapat → 10 sn bekle → aç → "Enable All"

---

**🎯 ŞU AN YAPIN:**

1. ✅ **Background Modes'i KALDIR**
2. ✅ **"+ Capability" → Background Modes → Add**
3. ✅ **"Acts as a Bluetooth LE accessory" İŞARETLE**
4. ✅ **Dialog → "Enable All" TIKLAYIN**
5. ✅ **"+ Capability" → "Acts as a Bluetooth LE accessory" → Add**
6. ✅ **Dialog → "Enable All" TIKLAYIN**
7. ✅ **Central + Peripheral rolleri görününce İŞARETLE**
8. ✅ **"Automatically manage signing" → KAPAT → 10 sn → AÇ → "Enable All"**
9. ✅ **Preferences → Accounts → Download Manual Profiles**
10. ✅ **Try Again**

**Dialog'larda "Enable All" tıklamayı unutmayın! Bu, Xcode'a yetki verir.**








