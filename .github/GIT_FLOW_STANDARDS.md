# Git Flow Standartları

Bu dokümantasyon, AfetNet projesi için Git workflow standartlarını tanımlar.

## 📋 Branch Stratejisi

### Ana Branch'ler

- **`main`** - Production branch (sadece release'ler için)
- **`develop`** - Development branch (opsiyonel, şu an kullanılmıyor)
- **`feat/*`** - Feature branch'leri
- **`fix/*`** - Bug fix branch'leri
- **`chore/*`** - Maintenance ve tooling değişiklikleri
- **`release/*`** - Release hazırlık branch'leri

### Branch Naming Convention

```
feat/feature-name          # Yeni özellik
fix/bug-description        # Bug düzeltmesi
chore/task-description     # Maintenance
release/version-number     # Release hazırlığı
```

**Örnekler:**
- ✅ `feat/ai-integration`
- ✅ `fix/flashlight-service`
- ✅ `chore/update-dependencies`
- ✅ `release/1.0.3`
- ❌ `2025-11-09-kuvz-iTCiL` (tarih bazlı isimlerden kaçının)
- ❌ `bugfix` (açıklayıcı değil)
- ❌ `test` (belirsiz)

## 📝 Commit Message Format

### Format

```
type(scope): subject

body (optional)

footer (optional)
```

### Commit Types

- **`feat`** - Yeni özellik
- **`fix`** - Bug düzeltmesi
- **`docs`** - Dokümantasyon değişiklikleri
- **`style`** - Kod formatlama (işlevsellik değişikliği yok)
- **`refactor`** - Kod refactoring
- **`perf`** - Performance iyileştirmeleri
- **`test`** - Test ekleme/değiştirme
- **`chore`** - Build process, tooling değişiklikleri
- **`ci`** - CI/CD değişiklikleri
- **`security`** - Güvenlik düzeltmeleri

### Scope (Opsiyonel)

- `backend` - Backend değişiklikleri
- `frontend` - Frontend değişiklikleri
- `ios` - iOS spesifik değişiklikler
- `android` - Android spesifik değişiklikler
- `firebase` - Firebase yapılandırması
- `eew` - Early Earthquake Warning
- `iap` - In-App Purchase

### Örnekler

```bash
# İyi commit mesajları
feat(eew): Add multi-source earthquake detection
fix(flashlight): Resolve camera permission issue
docs: Update API documentation
chore(deps): Update React Native to 0.81.5
security: Fix keychain storage vulnerability

# Kötü commit mesajları
fix bug                    # Çok kısa, scope yok
update                     # Belirsiz
WIP                        # Work in progress commit'leri production'a gitmemeli
```

## 🔀 Workflow

### Feature Development

1. **Branch oluştur:**
   ```bash
   git checkout -b feat/feature-name
   ```

2. **Değişiklikleri yap ve commit et:**
   ```bash
   git add .
   git commit -m "feat(scope): Description"
   ```

3. **Push et:**
   ```bash
   git push origin feat/feature-name
   ```

4. **Pull Request oluştur:**
   - GitHub'da PR oluştur
   - `main` veya `feat-ai-integration` branch'ine merge et
   - Code review bekle

5. **Merge sonrası temizlik:**
   ```bash
   git checkout main
   git pull
   git branch -d feat/feature-name  # Local branch'i sil
   ```

### Bug Fix Workflow

1. **Branch oluştur:**
   ```bash
   git checkout -b fix/bug-description
   ```

2. **Düzeltmeyi yap ve commit et:**
   ```bash
   git commit -m "fix(scope): Fix bug description"
   ```

3. **PR oluştur ve merge et**

### Release Workflow

1. **Release branch oluştur:**
   ```bash
   git checkout -b release/1.0.3
   ```

2. **Version bump:**
   ```bash
   npm run version-bump  # veya manuel
   git commit -m "chore: Bump version to 1.0.3"
   ```

3. **Test et ve merge et:**
   ```bash
   git checkout main
   git merge release/1.0.3
   git tag v1.0.3
   git push origin main --tags
   ```

## 🚫 Yapılmaması Gerekenler

1. **Direkt `main` branch'ine commit yapmayın**
2. **Force push yapmayın** (özellikle `main` branch'ine)
3. **Commit mesajlarında emoji kullanmayın** (GitHub UI'da görünse de)
4. **Çok büyük commit'ler yapmayın** (maksimum 20-30 dosya)
5. **WIP commit'leri production'a merge etmeyin**
6. **Secrets commit etmeyin** (`.env`, API keys, etc.)
7. **Binary dosyaları commit etmeyin** (build artifacts, etc.)

## 🧹 Branch Temizliği

### Düzenli Temizlik

Ayda bir kez kullanılmayan branch'leri temizleyin:

```bash
# Merge edilmiş local branch'leri listele
git branch --merged | grep -v "\*\|main\|feat-ai-integration"

# Merge edilmiş branch'leri sil
git branch -d branch-name

# Remote branch'leri kontrol et
git remote prune origin

# Kullanılmayan remote branch'leri sil (dikkatli!)
git push origin --delete branch-name
```

### Branch Protection Rules

`main` branch için GitHub'da protection rules ayarlayın:

1. **Settings > Branches > Add rule**
2. **Branch name pattern:** `main`
3. **Protect matching branches:**
   - ✅ Require a pull request before merging
   - ✅ Require approvals: 1
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings

## 📊 Best Practices

1. **Küçük, sık commit'ler yapın**
2. **Her commit tek bir değişiklik içermeli**
3. **Commit öncesi test edin**
4. **PR'ları küçük tutun** (maksimum 800 satır)
5. **Code review'da yapıcı olun**
6. **CI/CD geçmeden merge etmeyin**
7. **Dokümantasyonu güncel tutun**

## 🔍 Commit History Kontrolü

```bash
# Son 10 commit'i görüntüle
git log --oneline -10

# Belirli bir dosyanın geçmişi
git log --oneline -- path/to/file

# Branch karşılaştırma
git log --oneline main..feat/feature-name

# Commit istatistikleri
git log --stat
```

## 📚 Ek Kaynaklar

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)

---

**Son Güncelleme:** 2025-01-27  
**Bakım:** Development Team

