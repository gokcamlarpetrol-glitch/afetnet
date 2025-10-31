# 🔴 KESİN ÇÖZÜM - Web Araştırmasına Göre

## ⚠️ SORUN TESPİTİ

Kullanıcı bildirisi: **"Sabah build alabiliyordu, her şey ekliydi, sonra hata başladı"**

Bu demek ki:
1. ✅ Kodlar doğru (Info.plist, entitlements hepsi tamam)
2. ❌ Xcode'un Developer Portal ile senkronizasyonu bozuldu
3. ❌ Provisioning profile capability'leri içermiyor

## 🎯 WEB ARAŞTIRMASINA GÖRE KESİN ÇÖZÜM

### YÖNTEM 1: Capability'leri Kaldırıp Tekrar Ekle (EN ETKİLİ)

**Web araştırmasına göre en çok önerilen yöntem:**

1. **Xcode → Signing & Capabilities**

2. **Her capability'yi SIRASIYLA kaldırın:**
   - Background Modes → **"-"** butonu ile KALDIRIN
   - Bluetooth (varsa) → **"-"** butonu ile KALDIRIN
   - Push Notifications (varsa) → **"-"** butonu ile KALDIRIN

3. **Xcode'u Kapatın** (⌘Q)

4. **DerivedData ve Provisioning Profile Cache'i Temizleyin:**
   ```bash
   rm -rf ~/Library/Developer/Xcode/DerivedData/AfetNet-*
   rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/*
   ```

5. **Xcode'u Açın**

6. **Capability'leri TEKRAR EKLEYİN:**
   - **"+ Capability"** → **"Background Modes"** → Add
     - ✅ Background fetch
     - ✅ Remote notifications
     - ✅ Background processing
     - ✅ Location updates
     - ✅ **Acts as a Bluetooth LE accessory** → İŞARETLEYİN (KRİTİK!)
   
   - **"+ Capability"** → **"Push Notifications"** → Add
   
   - **"+ Capability"** → **"Acts as a Bluetooth LE accessory"** (ayrı) → Add
     - ✅ Central Role
     - ✅ Peripheral Role

7. **Preferences → Accounts** → **"Download Manual Profiles"**

8. **Clean Build Folder** (⌘⇧K)

9. **Try Again**

---

### YÖNTEM 2: Developer Portal'dan Profili Zorla Yenile

**Eğer Yöntem 1 çalışmazsa:**

1. **https://developer.apple.com/account** → **Certificates, Identifiers & Profiles**

2. **Identifiers** → **com.gokhancamci.afetnetapp** → **Edit**

3. **ŞUNLARI KONTROL EDİN (HEPSİ AÇIK OLMALI):**
   - ✅ Push Notifications
   - ✅ Background Modes (Remote notifications, Background fetch, Background processing, Location updates)
   - ✅ **Bluetooth LE** → **Central Role** + **Peripheral Role** (HER İKİSİ DE!)

4. **Save** → **Confirm**

5. **Profiles** → **"iOS Team Provisioning Profile: com.gokhancamci.afetnetapp"** bulun

6. **Edit** → **"Regenerate"** veya **"Delete"** sonra **"+"** ile YENİ OLUŞTURUN

7. **Xcode → Preferences → Accounts → Download Manual Profiles**

8. **Xcode'da Signing & Capabilities → Try Again**

---

### YÖNTEM 3: Automatic Signing'i Kapatıp Aç

**Web araştırmasına göre bazen bu da çalışır:**

1. **Signing & Capabilities** → **"Automatically manage signing"** → **KAPATIN**
2. **5 saniye bekleyin**
3. **"Automatically manage signing"** → **TEKRAR AÇIN**
4. Xcode otomatik olarak yeni profil oluşturacak
5. **Try Again**

---

### YÖNTEM 4: Xcode Keychain ve Cache Temizleme

**Eğer hiçbiri çalışmazsa (nükleer opsiyon):**

```bash
# 1. Xcode'u kapat
killall Xcode

# 2. DerivedData temizle
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# 3. Provisioning Profile cache temizle
rm -rf ~/Library/MobileDevice/Provisioning\ Profiles/*

# 4. Xcode Keychain item'ları temizle (dikkatli olun!)
# Keychain Access → "Xcode" → sil (sadece Xcode signing ile ilgili olanlar)

# 5. Xcode'u aç
open /Applications/Xcode.app

# 6. Preferences → Accounts → Hesap silip tekrar ekle (gerekirse)

# 7. Capability'leri tekrar ekle
```

---

## 🔴 EN KRİTİK NOKTA

**Web araştırmasına göre en çok karşılaşılan sorun:**

> "Xcode'un `bluetooth-central` ve `bluetooth-peripheral` entitlement'larını profil'e eklemesi için, Xcode UI'da **'Acts as a Bluetooth LE accessory'** seçeneğinin **KESİNLİKLE İŞARETLİ** olması gerekiyor. Sadece Info.plist'de olması yeterli değil!"

**Çözüm:**
- Background Modes altında **"Acts as a Bluetooth LE accessory"** → ✅ İŞARETLEYİN
- VEYA ayrı bir **"Bluetooth"** capability'si ekleyip **Central + Peripheral** işaretleyin

---

## 📋 KONTROL LİSTESİ (Sırayla Deneyin)

- [ ] **Yöntem 1:** Capability'leri kaldır → Xcode kapat → Cache temizle → Tekrar ekle → Download Profiles → Try Again
- [ ] **Yöntem 2:** Developer Portal'dan App ID'de Bluetooth LE Central + Peripheral açık mı kontrol et → Profil yenile → Download → Try Again
- [ ] **Yöntem 3:** Automatic signing kapat → aç → Try Again
- [ ] **Yöntem 4:** Tüm cache'leri temizle → Xcode'u yeniden başlat → Tekrar dene

---

## 💡 WEB'DEN ÖĞRENİLEN ÖNEMLİ BİLGİLER

1. **Info.plist'deki UIBackgroundModes yeterli değil** - Xcode UI'da capability'lerin aktif olması şart
2. **"Acts as a Bluetooth LE accessory" işaretli değilse** → `bluetooth-central` ve `bluetooth-peripheral` profil'e eklenmez
3. **DerivedData ve Provisioning Profile cache** bazen Xcode'un eski profili kullanmasına neden olur
4. **Developer Portal'da App ID'de capability açık değilse** → Xcode otomatik açamaz, manuel açmanız gerekir
5. **Provisioning Profile eski capability'leri içeriyorsa** → Yeni profil oluşturmanız veya regenerate etmeniz gerekir

---

**🎯 İLK DENENMESİ GEREKEN: Yöntem 1 (En etkili)**




