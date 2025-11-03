# 🔴 HATA AÇIKLAMASI VE ÇÖZÜMÜ

## 📋 HATA MESAJI

```
Provisioning profile "iOS Team Provisioning Profile: com.gokhancamci.afetnetapp" 
doesn't include the:
- com.apple.developer.background-fetch
- com.apple.developer.bluetooth-central
- com.apple.developer.bluetooth-peripheral
entitlements.
```

---

## 🔍 HATA NE DEMEK?

**Profil, bu 3 yetkiyi (entitlement) içermiyor.**

**Neden:**
1. ✅ Entitlements dosyalarında var (kod tarafı doğru)
2. ✅ Info.plist'de var (UIBackgroundModes doğru)
3. ❌ **Xcode UI'da "Acts as a Bluetooth LE accessory" İŞARETLİ DEĞİL**
4. ❌ Developer Portal'da App ID'de bu capability'ler açık olmayabilir
5. ❌ Xcode otomatik profil oluştururken bu entitlement'ları eklememiş

---

## 🎯 EKRANDA GÖRDÜĞÜM SORUN

**Background Modes Options:**
- ✅ Background fetch → İŞARETLİ (ama profil'e eklenmemiş)
- ✅ Remote notifications → İŞARETLİ
- ✅ Background processing → İŞARETLİ
- ✅ Location updates → İŞARETLİ
- ✅ **Uses Bluetooth LE accessories** → İŞARETLİ (AMA BU YETERLİ DEĞİL!)
- ❌ **"Acts as a Bluetooth LE accessory"** → **İŞARETLİ DEĞİL!** (KRİTİK!)

**FARK:**
- **"Uses Bluetooth LE accessories"** → Uygulama Bluetooth LE aksesuarları KULLANIR
- **"Acts as a Bluetooth LE accessory"** → Uygulama Bluetooth LE aksesuarı GİBİ DAVRANIR (mesh networking için gerekli)

**Sorun:** "Acts as a Bluetooth LE accessory" işaretli değil → `bluetooth-central` ve `bluetooth-peripheral` entitlement'ları profil'e eklenmiyor!

---

## ✅ KESİN ÇÖZÜM

### ADIM 1: "Acts as a Bluetooth LE accessory" İŞARETLEYİN

**Xcode'da:**

1. **Signing & Capabilities** → **Background Modes** bölümünü bulun
2. **"Acts as a Bluetooth LE accessory"** seçeneğini bulun
3. ✅ **İŞARETLEYİN** (checkbox'ı tıklayın)
4. Dialog açılırsa: **"Enable"** → tıklayın

**VEYA ayrı capability olarak:**

1. **"+ Capability"** → **"Acts as a Bluetooth LE accessory"** → Add
2. ✅ **Central Role** → İŞARETLEYİN
3. ✅ **Peripheral Role** → İŞARETLEYİN

---

### ADIM 2: Developer Portal'da Kontrol Et

**Bu capability'lerin Developer Portal'da açık olması ŞART:**

1. **https://developer.apple.com/account** → açın
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. **com.gokhancamci.afetnetapp** → **Edit**
4. **ŞUNLARI KONTROL EDİN:**

   ✅ **Background Modes** → İŞARETLİ → **Configure** → tıklayın
      - ✅ Background fetch → İŞARETLİ OLMALI
      - ✅ Remote notifications → İŞARETLİ OLMALI
      - ✅ Background processing → İŞARETLİ OLMALI
      - ✅ Location updates → İŞARETLİ OLMALI
   
   ✅ **Bluetooth LE** → İŞARETLİ → **Configure** → tıklayın
      - ✅ **Acts as a Bluetooth LE accessory (Central Role)** → İŞARETLİ OLMALI
      - ✅ **Acts as a Bluetooth LE accessory (Peripheral Role)** → İŞARETLİ OLMALI

5. Eksik olanları işaretleyin → **Save** → **Confirm**

---

### ADIM 3: Profili Yenile

**Developer Portal'da:**

1. **Profiles** → **"iOS Team Provisioning Profile: com.gokhancamci.afetnetapp"** bulun
2. Profil'e tıklayın → **Edit**
3. **"Generate"** (veya **"Regenerate"**) → tıklayın
4. Profili indirin

**Xcode'da:**

1. **Preferences → Accounts** → **"Download Manual Profiles"**
2. **Signing & Capabilities** → **"Try Again"**

---

### ADIM 4: Clean Build ve Tekrar Dene

1. **Product → Clean Build Folder** (⌘⇧K)
2. **Signing & Capabilities** → **"Try Again"**
3. ✅ Bekleyin (10-15 saniye)

---

## 🎯 ÖNCELİK SIRASI

1. **EN ÖNEMLİSİ:** Xcode'da **"Acts as a Bluetooth LE accessory"** → İŞARETLEYİN
2. Developer Portal'da **Bluetooth LE Central + Peripheral** açık mı kontrol edin
3. Profili yenileyin (Developer Portal → Generate)
4. Xcode → Download Profiles → Try Again

---

## ⚠️ ÖNEMLİ NOT

**"Uses Bluetooth LE accessories" ≠ "Acts as a Bluetooth LE accessory"**

- **"Uses Bluetooth LE accessories"** → Sadece Bluetooth LE cihazları kullanmak için (entitlement eklemez)
- **"Acts as a Bluetooth LE accessory"** → Mesh networking, P2P iletişim için (bluetooth-central + bluetooth-peripheral entitlement'ları ekler)

**AfetNet mesh networking yapıyor → "Acts as a Bluetooth LE accessory" GEREKLİ!**

---

## 📋 KONTROL LİSTESİ

### Xcode UI (ŞU AN YAPILACAK)
- [ ] Background Modes → "Acts as a Bluetooth LE accessory" → ✅ İŞARETLE
- [ ] VEYA "+ Capability" → "Acts as a Bluetooth LE accessory" → Add → Central + Peripheral işaretle
- [ ] Try Again → tıklayın

### Developer Portal (Gerekirse)
- [ ] App ID → Bluetooth LE → Central + Peripheral → Açık
- [ ] Profile → Generate → Yeni profil oluştur
- [ ] Xcode → Download Profiles → Try Again

---

**🎯 ŞU AN YAPIN:**
**Background Modes altındaki "Acts as a Bluetooth LE accessory" seçeneğini İŞARETLEYİN!**

Bu tek adım bile hatayı çözebilir.












