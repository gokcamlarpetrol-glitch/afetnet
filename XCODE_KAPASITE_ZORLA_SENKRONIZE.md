# ✅ XCODE ÜZERİNDEN CAPABILITY'LERİ AKTİF ETME

## 🎯 YÖNTEM: Xcode Capability'lerini Zorla Senkronize Et

Developer Portal'da görünmüyorsa → Xcode'da capability'leri **KALDIRIP TEKRAR EKLEYİN**. Bu, Xcode'u Developer Portal'a bağlanıp otomatik eklemeye zorlar.

---

## ✅ ADIM ADIM (XCODE'DA)

### ADIM 1: Xcode'u Açın ve Clean Build

1. **Xcode'u açın:** `open ios/AfetNet.xcworkspace`
2. **Product → Clean Build Folder** (⌘⇧K)
3. ✅ Temizleme tamamlanana kadar bekleyin

---

### ADIM 2: Mevcut Capability'leri KALDIRIN (Senkronize Etmek İçin)

**Signing & Capabilities** sekmesinde:

1. **Background Modes** capability'sini bulun
2. **"-"** (eksi) butonuna tıklayın → **"Remove"** → Kaldırın
3. **Bluetooth** capability'si varsa (ayrı) → **"-"** butonuna tıklayın → Kaldırın
4. **Push Notifications** capability'si varsa (ayrı) → **"-"** butonuna tıklayın → Kaldırın

**Kalmalı:**
- Apple Pay
- Associated Domains
- In-App Purchase (varsa)

---

### ADIM 3: Capability'leri TEKRAR EKLEYİN (Xcode Otomatik Eşleştirecek)

#### A. Background Modes Ekle

1. **"+ Capability"** butonuna tıklayın
2. Arama kutusuna **"Background"** yazın
3. **"Background Modes"** → **Add** → tıklayın
4. ✅ **Şunları İŞARETLEYİN:**
   - ✅ **Background fetch**
   - ✅ **Remote notifications**
   - ✅ **Background processing**
   - ✅ **Location updates**
   - ✅ **Acts as a Bluetooth LE accessory** (EN ÖNEMLİSİ!)

**NOT:** İşaretledikten sonra Xcode bir dialog gösterebilir:
- **"Enable Background Modes capability?"** → **"Enable All"** → tıklayın
- Bu, Developer Portal'a otomatik ekler

---

#### B. Bluetooth LE Ekle (AYRI Capability)

1. **"+ Capability"** butonuna tıklayın
2. Arama kutusuna **"Bluetooth"** yazın
3. **"Acts as a Bluetooth LE accessory"** → **Add** → tıklayın

**Dialog açılırsa:**
- **"Enable Bluetooth LE capability?"** → **"Enable All"** → tıklayın
- Bu, Developer Portal'a otomatik ekler

**Şimdi şunları GÖRMELİSİNİZ:**
- ✅ **Acts as a Bluetooth LE accessory (Central Role)** → İŞARETLEYİN
- ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)** → İŞARETLEYİN

**Eğer rolleri görünmüyorsa:**
- **5-10 saniye bekleyin** (Xcode Developer Portal'a bağlanıyor)
- Sayfayı yenileyin (başka bir sekmeye tıklayıp geri dönün)
- Hala görünmüyorsa → Adım 4'e geçin

---

#### C. Push Notifications Ekle

1. **"+ Capability"** → **"Push Notifications"** → **Add**
2. ✅ Aktif olmalı

---

### ADIM 4: Automatic Signing'i Kapatıp Aç (Zorla Senkronize)

1. **"Automatically manage signing"** checkbox'ını **KAPATIN** (işareti kaldırın)
2. **10 saniye bekleyin**
3. **"Automatically manage signing"** checkbox'ını **TEKRAR AÇIN** (işaretleyin)
4. Xcode bir dialog gösterecek:
   - **"Enable capabilities?"** veya **"Would you like to enable these capabilities in your Apple Developer account?"**
   - **"Enable All"** → tıklayın
5. ✅ Xcode otomatik olarak Developer Portal'a bağlanıp capability'leri ekleyecek

---

### ADIM 5: Preferences → Accounts → Download Profiles

1. **Xcode → Preferences** (⌘, virgül)
2. **Accounts** → **"Gökhan ÇAMCI"** seçili
3. **"Download Manual Profiles"** → tıklayın
4. ✅ **"Profiles downloaded successfully"** mesajını bekleyin (30-40 saniye sürebilir)

---

### ADIM 6: Try Again

1. **Signing & Capabilities** sekmesine dönün
2. **"Try Again"** butonuna tıklayın
3. ✅ **15-20 saniye bekleyin** (Xcode profil oluşturuyor)

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

---

## 🔄 EĞER ROLLER HALA GÖRÜNMÜYORSA

### Alternatif Yöntem 1: Xcode'u Yeniden Başlat

1. **Xcode'u tamamen kapatın** (⌘Q)
2. **10 saniye bekleyin**
3. **Xcode'u tekrar açın**
4. **Signing & Capabilities** → Capability'leri kontrol edin
5. **"+ Capability"** → Bluetooth LE → Add → Roller görünebilir

---

### Alternatif Yöntem 2: Developer Portal Kontrolü

Xcode eşleştirdikten sonra Developer Portal'da kontrol edin:

1. **https://developer.apple.com/account** → **Identifiers** → com.gokhancamci.afetnetapp → **Edit**
2. **Bluetooth LE** → **Configure** → tıklayın
3. **Artık Central + Peripheral rolleri görünmeli** (Xcode ekledi)
4. **Her ikisini İŞARETLEYİN** (eğer hala işaretli değilse)
5. **Save** → **Confirm**
6. **Profiles** → Profil yenile → **Generate**
7. Xcode → **Preferences → Accounts → Download Manual Profiles**
8. **Try Again**

---

## 📋 ÖNEMLİ NOTLAR

### Xcode'un Developer Portal'a Eşleşmesi:

- ✅ **"Automatically manage signing"** → **AÇIK OLMALI**
- ✅ **Team hesabı** → **Admin veya App Manager yetkisi olmalı** (Member yetkisi yeterli değil)
- ✅ **Xcode capability'leri ekledikten sonra** → Developer Portal'a otomatik eşleşir (genellikle 10-30 saniye)
- ✅ **Dialog açılırsa** → **"Enable All"** → tıklayın (Xcode'a Developer Portal'a yazma izni verir)

### Timing:

- Capability ekledikten sonra **10-30 saniye bekleyin** (Xcode Developer Portal API'sine bağlanıyor)
- **"Download Manual Profiles"** sonrası **30-40 saniye bekleyin** (profiller indiriliyor)
- **"Try Again"** sonrası **15-20 saniye bekleyin** (yeni profil oluşturuluyor)

---

**🎯 ŞU AN YAPIN:**

1. **Xcode'da Background Modes'i KALDIR** (-)
2. **"+ Capability" → Background Modes → Add**
3. **"Acts as a Bluetooth LE accessory" İŞARETLE**
4. **Dialog açılırsa: "Enable All" → tıklayın**
5. **"+ Capability" → "Acts as a Bluetooth LE accessory" (ayrı) → Add**
6. **Central + Peripheral rolleri görünmeli**
7. **"Automatically manage signing" → KAPAT → 10 sn bekle → AÇ → "Enable All"**
8. **Preferences → Accounts → Download Manual Profiles**
9. **Try Again**

Xcode otomatik olarak Developer Portal'a eşleştirecek!












