# 🚀 EAS PROJECT ID KURULUM KILAVUZU

## ADIM 1: Expo Hesabına Giriş Yap

Terminal'de şu komutu çalıştır:
```bash
cd /Users/gokhancamci/AfetNet1
npx expo login
```

**Bilgilerini gir:**
- Email veya username
- Password

---

## ADIM 2: EAS Projesi Oluştur

```bash
npx eas init
```

Bu komut:
1. Expo hesabına bağlanacak
2. Yeni bir EAS projesi oluşturacak
3. Sana bir **Project ID** verecek (UUID formatında)

**Örnek çıktı:**
```
✔ Project ID: 12345678-1234-1234-1234-123456789012
```

---

## ADIM 3: Project ID'yi Kaydet

Project ID'yi kopyala ve şu dosyalara ekle:

### 1. app.config.ts
```typescript
// Satır 98 civarı
extra: {
  eas: { 
    projectId: process.env.EAS_PROJECT_ID || "BURAYA-PROJECT-ID-YAPISTIR" 
  }
}
```

### 2. src/lib/notifications.ts
```typescript
// Satır 20 civarı
const token = await Notifications.getExpoPushTokenAsync({
  projectId: process.env.EXPO_PUBLIC_PROJECT_ID || 'BURAYA-PROJECT-ID-YAPISTIR'
});
```

### 3. .env (yeni dosya oluştur)
```bash
EAS_PROJECT_ID=BURAYA-PROJECT-ID-YAPISTIR
EXPO_PUBLIC_PROJECT_ID=BURAYA-PROJECT-ID-YAPISTIR
```

---

## ADIM 4: Doğrula

```bash
# Build komutunu test et (henüz build yapmayacak, sadece config kontrol)
npx eas build --platform android --profile preview --non-interactive
```

---

## ALTERNATIF: Web Üzerinden

Eğer terminal'de sorun yaşıyorsan:

1. https://expo.dev adresine git
2. Giriş yap (Sign In)
3. "Create a new project" tıkla
4. Project name: **AfetNet**
5. Project ID'yi kopyala
6. Yukarıdaki ADIM 3'teki dosyalara yapıştır

---

## ✅ TAMAMLANDIĞINDA

Project ID'yi aldıktan sonra bana söyle, ben dosyalara otomatik ekleyeyim! 🚀

---

## 📝 NOTLAR

- Project ID bir UUID'dir (örn: 12345678-1234-1234-1234-123456789012)
- Bu ID, push notification ve build işlemleri için gerekli
- Güvenli bir yerde sakla (ama secret değil, public olabilir)
- Her Expo projesi için benzersizdir

---

## 🆘 SORUN YAŞARSAN

**"Not logged in" hatası:**
```bash
npx expo whoami  # Giriş kontrolü
npx expo logout  # Çıkış yap
npx expo login   # Tekrar giriş yap
```

**"Project already exists" hatası:**
```bash
# Mevcut projeyi kullan
npx eas project:info
# Project ID'yi göreceksin
```

**Expo hesabın yoksa:**
```bash
# Yeni hesap oluştur
npx expo register
```

---

# 🎯 ŞİMDİ NE YAPACAKSIN?

1. Terminal'i aç
2. `cd /Users/gokhancamci/AfetNet1` komutu ile proje klasörüne git
3. `npx expo login` ile giriş yap
4. `npx eas init` ile proje oluştur
5. Project ID'yi bana söyle, ben dosyalara ekleyeyim! ✅
