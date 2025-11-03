# 🔐 XCODE DEVELOPER PORTAL YETKİSİ REHBERİ

## 🎯 XCODE'UN YETKİSİ NEDİR?

Xcode'un Developer Portal'a capability ekleyebilmesi için:
1. ✅ Apple Developer Program üyeliği (aktif)
2. ✅ Team hesabında Admin veya App Manager yetkisi
3. ✅ Xcode'da doğru Apple ID ile giriş yapılmış

---

## ✅ ADIM 1: Apple Developer Program Üyeliğini Kontrol Et

### Kontrol:
1. **https://developer.apple.com/account** → açın
2. Giriş yapın (Gökhan ÇAMCI hesabı)
3. Sol üstte **Membership** sekmesini kontrol edin
4. ✅ **"Active"** veya **"Paid"** yazmalı

**Eğer üyelik yoksa veya expired ise:**
- Apple Developer Program'a kayıt olun ($99/yıl)
- Veya mevcut üyeliği yenileyin

---

## ✅ ADIM 2: Team Yetkisini Kontrol Et

### Developer Portal'da Kontrol:

1. **https://developer.apple.com/account** → açın
2. Sol üstte **Membership** → **"Your Teams"** → tıklayın
3. **"Gökhan ÇAMCI"** veya team adınızı bulun
4. **Yetki durumunu kontrol edin:**
   - ✅ **Account Holder** → Tüm yetkiler var (OK)
   - ✅ **Admin** → Tüm yetkiler var (OK)
   - ✅ **App Manager** → Capability değiştirme yetkisi var (OK)
   - ❌ **Member** → Sadece okuma yetkisi (YETERLİ DEĞİL!)

### Eğer Member iseniz:

**Seçenek 1: Team Owner'dan yetki alın**
- Team sahibine (Account Holder/Admin) yazın
- "App Manager" veya "Admin" yetkisi isteyin
- O kişi Developer Portal'dan yetki verebilir

**Seçenek 2: Tek başına hesapsa:**
- Kendi hesabınız = Account Holder (tüm yetkiler var)

---

## ✅ ADIM 3: Xcode'da Apple ID Girişi Kontrolü

### Xcode'da Kontrol:

1. **Xcode → Preferences** (⌘, virgül)
2. **Accounts** sekmesine gidin
3. **"Gökhan ÇAMCI"** hesabınızı bulun
4. **Team** kısmında **"Personal Team"** veya **"Gökhan ÇAMCI"** görünmeli
5. ✅ Yanında **"Free"** veya **"(Paid)"** yazmalı

### Eğer Hesap Yoksa veya Yanlışsa:

1. **"+"** butonuna tıklayın
2. Apple ID'nizi girin (Gökhan ÇAMCI hesabı)
3. Şifrenizi girin
4. 2FA varsa kodu girin
5. ✅ Hesap eklenmeli

---

## ✅ ADIM 4: Xcode'a Developer Portal Erişim İzni Ver

### Dialog Açıldığında:

Xcode'da capability eklediğinizde bir dialog açılacak:

**"Would you like to enable these capabilities in your Apple Developer account?"**

**YAPILACAK:**
1. ✅ **"Enable All"** veya **"Enable"** → tıklayın
2. ✅ Şifre istenirse → Apple ID şifrenizi girin
3. ✅ 2FA varsa → Kodu girin

**Bu dialog, Xcode'a Developer Portal'a yazma izni verir.**

---

## 🔄 ADIM 5: Eğer Dialog Açılmıyorsa - Manuel İzin

### Xcode Keychain Erişimi:

1. **macOS → System Preferences** → **Security & Privacy** → **Privacy**
2. **Full Disk Access** → **Xcode** → İŞARETLİ olmalı
3. İşaretli değilse → Kilit açın → İŞARETLEYİN

### Xcode'a Keychain Erişimi:

1. Xcode'u kapatın
2. Terminal'de:
   ```bash
   security unlock-keychain ~/Library/Keychains/login.keychain-db
   ```
3. Xcode'u tekrar açın
4. Capability ekleyin → Dialog açılmalı

---

## 📋 YETKİ KONTROL CHECKLIST

### Apple Developer Program:
- [ ] Üyelik aktif mi? (developer.apple.com → Membership → Active)
- [ ] Ödeme yapılmış mı? ($99/yıl)

### Team Yetkisi:
- [ ] Account Holder mi? ✅
- [ ] Admin mi? ✅
- [ ] App Manager mi? ✅
- [ ] Member mi? ❌ (yetersiz, yetki isteyin)

### Xcode Bağlantısı:
- [ ] Xcode → Preferences → Accounts → Hesap var mı?
- [ ] Team doğru mu? (Gökhan ÇAMCI)
- [ ] "(Paid)" yazıyor mu? (ücretsiz hesap capability ekleyemez)

### Dialog İzni:
- [ ] Capability eklerken dialog açıldı mı?
- [ ] "Enable All" tıkladınız mı?
- [ ] Şifre girdiniz mi?

---

## ⚠️ ÖNEMLİ NOTLAR

### Ücretsiz (Free) Apple ID:
- ❌ Capability ekleme yetkisi YOK
- ❌ Developer Portal'a yazma izni YOK
- ✅ Sadece Xcode'da test edebilir
- ✅ App Store'a yükleyemez

**Çözüm:** Apple Developer Program'a kayıt olun ($99/yıl)

### Team Member Yetkisi:
- ❌ Capability değiştiremez
- ❌ Profil oluşturamaz
- ✅ Sadece download edebilir

**Çözüm:** Account Holder/Admin'den "App Manager" veya "Admin" yetkisi isteyin

---

## 🔄 YETKİ VERİLMESİ (TEAM OWNER İÇİN)

Eğer siz team owner iseniz ve başka birine yetki vermek istiyorsanız:

1. **https://developer.apple.com/account** → **People** → **Invite People**
2. Kişinin email'ini girin
3. **Role:** **App Manager** veya **Admin** seçin
4. **Send Invitation**
5. Kişi email'den daveti kabul etsin

---

## 📞 YETKİ SORUNU DEVAM EDİYORSA

### Kontrol Edilecekler:

1. **Apple ID ile Developer Portal'a giriş yapabiliyor musunuz?**
   - https://developer.apple.com/account → Login → Başarılı mı?

2. **Developer Portal'da capability'leri manuel değiştirebiliyor musunuz?**
   - Identifiers → App ID → Edit → Capability'leri açıp kapatabiliyor musunuz?
   - Eğer edemiyorsanız → Yetki yok, team owner'dan isteyin

3. **Xcode'da hesap görünüyor mu?**
   - Preferences → Accounts → Hesap var mı?
   - Team "(Paid)" mı yoksa "(Free)" mi?

---

**🎯 ŞU AN KONTROL EDİN:**

1. **https://developer.apple.com/account** → Membership → Üyelik aktif mi?
2. **Team yetkisi:** Account Holder/Admin/App Manager mi? (Member ise yetki isteyin)
3. **Xcode:** Preferences → Accounts → Hesap var mı? Team "(Paid)" mı?

**Eğer hepsi ✅ ise → Xcode capability eklediğinizde dialog açılacak → "Enable All" tıklayın**












