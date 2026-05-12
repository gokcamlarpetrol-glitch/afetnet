# Firebase MCP — AfetNet Kurulum Notları

> **Tarih:** 2026-05-12
> **Status:** ✅ MCP server bagli (`.mcp.json` proje root'ta)
> **AMA:** Yanlis Google hesabi ile login — erisim PERMISSION DENIED

---

## 🟢 Yapilan

1. `.mcp.json` projeye eklendi:
```json
{
  "mcpServers": {
    "firebase": {
      "type": "stdio",
      "command": "firebase",
      "args": ["experimental:mcp", "--dir", "/Users/gokhancamci/AfetNet1"]
    }
  }
}
```

2. `claude mcp list` Firebase'i **Connected** olarak goruyor.

3. Firebase CLI v14.23.0 mevcut.

---

## 🔴 Senin Yapacaklarin

### 1. Dogru Google hesabi ile re-login

Su an `gokcamlar1@gmail.com` ile login, AfetNet projesi `gokcamlarpetrol@gmail.com` hesabinda. Hesap degistir:

```bash
firebase logout
firebase login
# Tarayicida gokcamlarpetrol@gmail.com ile gir
```

### 2. Proje sec

```bash
firebase use --add
# afetnet-4a6b6 sec
firebase use afetnet-4a6b6
```

### 3. Erisimi dogrula

```bash
firebase firestore:databases:list --project afetnet-4a6b6
# Hata almazsan dogru hesap
```

### 4. Claude Code'u yeniden baslat

MCP server'i `.mcp.json`'a ekledikten sonra Claude Code'un yeni MCP tool'larini tanimasi icin yeniden baslatilmasi gerekir:

```bash
# Mevcut Claude Code session'ini kapat
# Sonra projeye geri don
cd /Users/gokhancamci/AfetNet1
claude
```

Yeni session'da Firebase MCP tool'lari kullanilabilir.

---

## 🔧 Firebase MCP ile Yapilabilecekler (Restart sonrasi)

Firebase MCP server `firebase experimental:mcp` ile su araclari sunar:

### Firestore
- `firestore_query_collection` — collection sorgulama
- `firestore_get_document` — tek belge oku
- `firestore_get_documents` — coklu belge oku
- `firestore_list_collections` — collection listele

### Authentication
- `auth_get_user` — kullanici bilgisi
- `auth_disable_user` — hesap devre disi
- `auth_set_custom_claim` — custom claims

### Functions
- `functions_get_environment` — env vars listele
- `functions_set_environment` — env var set

### Hosting / Storage / RTDB
- Cesitli admin operasyonlari

### Rules
- `firestore_validate_security_rules` — rules test

---

## 🎯 Firebase MCP Kullanmadan da Yapabileceklerin

CLI yeterli oldugu icin MCP zorunlu degil. Manuel:

```bash
# Deploy
firebase deploy --only firestore,functions --project afetnet-4a6b6

# Logs
firebase functions:log --limit 50 --project afetnet-4a6b6

# Firestore export
gcloud firestore export gs://afetnet-backups/$(date +%Y%m%d) --project=afetnet-4a6b6
```

---

## ⚠️ Onemli Notlar

1. **Re-login zorunlu** — su an Firebase MCP `gokcamlar1@gmail.com` ile baglanacak, AfetNet'e erisemez
2. **Service account yerine** — kişisel Google hesabi yeterli, ama service account daha güvenli (CI/CD icin)
3. **Project ID kontrol** — `firebase use` her zaman `afetnet-4a6b6` dondurmeli
4. **MCP server connection** sadece tool listesinde gozukmesini saglar; ACTUAL CALLS authentication'a bagli

---

## Doğrulama Komutu

Hesap degistikten sonra:

```bash
firebase login:list
# Beklenen: gokcamlarpetrol@gmail.com

firebase projects:list
# Beklenen: afetnet-4a6b6 listelenmis

firebase firestore:databases:list --project afetnet-4a6b6
# Beklenen: (default) database basariyla listelenmis
```

3 komut OK donerse, Claude Code restart sonrasi MCP tam çalışır.
