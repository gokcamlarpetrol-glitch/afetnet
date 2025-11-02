# 🔴 KRİTİK: Bluetooth Capability İşaretlenmemiş!

## Sorun
Ekranda görüyorum: **"Acts as a Bluetooth LE accessory"** seçeneği **işaretli değil** ❌

Bu yüzden Xcode profil'e `bluetooth-central` ve `bluetooth-peripheral` entitlement'larını eklemiyor.

## ⚡ HEMEN YAPILACAKLAR

### Adım 1: Xcode'da Bluetooth'u İşaretleyin

1. **Xcode → Signing & Capabilities** sekmesinde

2. **Background Modes** bölümünü bulun (açık değilse genişletin)

3. **"Acts as a Bluetooth LE accessory"** seçeneğini bulun

4. ✅ **İŞARETLEYİN** (checkbox'ı tıklayın)

5. İşaretledikten sonra, muhtemelen bir dialog açılacak:
   - "Enable Bluetooth LE capability?" → **"Enable"** veya **"Enable All"** → tıklayın
   - Bu, Developer Portal'a otomatik ekler (eğer yetki varsa)

### Adım 2: Bluetooth Capability'yi Ayrı Olarak da Ekleyin (Garanti İçin)

Eğer "Acts as a Bluetooth LE accessory" seçeneği Background Modes altında görünmüyorsa:

1. **"+ Capability"** butonuna tıklayın

2. Arama kutusuna: **"Bluetooth"** yazın

3. **"Acts as a Bluetooth LE accessory"** veya **"Bluetooth"** capability'sini seçin

4. ✅ **Hem "Central" hem "Peripheral"** seçeneklerini işaretleyin

5. **Add** → tıklayın

### Adım 3: Profilleri Yenileyin

1. **Preferences → Accounts** (⌘,)
   - "Gökhan ÇAMCI" seçili
   - **"Download Manual Profiles"** → tıklayın

2. **Signing & Capabilities'e geri dönün**

3. **"Try Again"** → tıklayın

### Adım 4: Clean Build

1. **Product → Clean Build Folder** (⌘⇧K)
2. **Tekrar "Try Again"**

---

## ✅ ŞU AN EKRANDA GÖRMENİZ GEREKENLER

**Background Modes** altında:
- ✅ Background fetch (işaretli)
- ✅ Background processing (işaretli)
- ✅ **Acts as a Bluetooth LE accessory** (✅ İŞARETLİ OLMALI!)

VEYA ayrı bir **Bluetooth** capability'si:
- ✅ Central role (işaretli)
- ✅ Peripheral role (işaretli)

---

## 🚨 EĞER HALA ÇALIŞMAZSA: Developer Portal Kontrolü

Xcode işaretleme yaptıktan sonra da çalışmazsa:

1. **https://developer.apple.com/account** → açın
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. **com.gokhancamci.afetnetapp** → tıklayın
4. **Edit** → tıklayın
5. **Bluetooth LE** seçeneğini bulun:
   - ✅ **İşaretleyin**
   - ✅ **Central Role** → işaretleyin
   - ✅ **Peripheral Role** → işaretleyin
6. **Save** → **Confirm**
7. **Profiles** → İlgili profilleri **Edit → Generate**
8. Xcode → **Preferences → Accounts → Download Manual Profiles**
9. **Try Again**

---

## 💡 NEDEN BU ÖNEMLİ?

Entitlements dosyalarında `bluetooth-central` ve `bluetooth-peripheral` var, ama Xcode UI'da capability işaretli değilse, Xcode profil'e eklemez. Bu yüzden hata devam ediyor.

**ŞU AN EN ÖNEMLİ ADIM:** Background Modes altındaki "Acts as a Bluetooth LE accessory" seçeneğini **işaretleyin** ✅











