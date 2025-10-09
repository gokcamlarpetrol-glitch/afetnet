# 📤 GIT PUSH KILAVUZU

## ✅ COMMIT BAŞARILI!

Dosyalar başarıyla commit edildi:
- ✅ docs/privacy-policy.html
- ✅ docs/terms-of-service.html
- ✅ backend/render.yaml
- ✅ backend/Dockerfile
- ✅ backend/DEPLOYMENT.md
- ✅ store-listings/
- ✅ app.config.ts

**Commit ID:** a262fe9

---

## 🔗 GITHUB REPOSITORY EKLE

### Seçenek 1: Mevcut GitHub Repository Varsa

```bash
# GitHub repository URL'ini ekle
git remote add origin https://github.com/gokhancamci/AfetNet1.git

# Push et
git push -u origin main
```

### Seçenek 2: Yeni GitHub Repository Oluştur

1. **GitHub.com'a git**
   - https://github.com/new

2. **Repository oluştur:**
   - Repository name: `AfetNet1`
   - Description: `AfetNet - Emergency & Earthquake Alert System`
   - Public veya Private seç
   - **Initialize this repository with:** HİÇBİRİNİ SEÇ
   - Create repository

3. **Terminal'de:**
```bash
# GitHub repository URL'ini ekle
git remote add origin https://github.com/gokhancamci/AfetNet1.git

# Push et
git push -u origin main
```

---

## 🌐 GITHUB PAGES AKTİFLEŞTİR

Push'tan sonra:

1. **GitHub.com → AfetNet1 repository**
2. **Settings → Pages**
3. **Source:** Deploy from a branch
4. **Branch:** main
5. **Folder:** / (root)
6. **Save**

**Sonuç (5 dakika sonra):**
- https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html ✅
- https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html ✅

---

## 🔐 GİTHUB TOKEN (Eğer şifre isterse)

GitHub artık şifre yerine Personal Access Token istiyor:

1. **GitHub.com → Settings → Developer settings**
2. **Personal access tokens → Tokens (classic)**
3. **Generate new token (classic)**
4. **Note:** "AfetNet Push"
5. **Expiration:** 90 days
6. **Scopes:** `repo` (tüm repo yetkisi)
7. **Generate token**
8. **Token'ı kopyala** (bir daha gösterilmez!)

**Push yaparken:**
- Username: `gokhancamci`
- Password: `[token'ı yapıştır]`

---

## 📋 ÖZET

### Şu An Durum:
✅ Dosyalar commit edildi
❌ GitHub'a push edilmedi (remote yok)

### Yapman Gerekenler:
1. GitHub'da repository var mı kontrol et
2. Varsa: `git remote add origin [URL]`
3. Yoksa: GitHub'da yeni repository oluştur
4. `git push -u origin main`
5. GitHub Pages aktifleştir

---

## 🎯 HIZLI BAŞLANGIÇ

```bash
# 1. Remote ekle (URL'i kendi repository'ne göre değiştir)
git remote add origin https://github.com/gokhancamci/AfetNet1.git

# 2. Push et
git push -u origin main

# 3. GitHub.com → Settings → Pages → Enable
```

**5 dakika sonra Privacy Policy ve Terms URL'leri aktif olacak!** 🚀
