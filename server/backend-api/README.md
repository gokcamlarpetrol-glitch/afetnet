# 🚀 AfetNet Backend API

Cloudflare Workers üzerinde çalışan **ücretsiz**, **hızlı** ve **global** backend API.

---

## 📦 KURULUM (5 dakika)

### 1. Wrangler CLI Kur
```bash
npm install -g wrangler
```

### 2. Cloudflare'e Login
```bash
wrangler login
```

Tarayıcı açılacak → Cloudflare hesabınla giriş yap (ücretsiz)

### 3. Deploy!
```bash
cd /Users/gokhancamci/AfetNet1/server/backend-api
wrangler publish
```

**Çıktı**:
```
✨ Success! Uploaded to Cloudflare
   https://afetnet-api.YOUR_USERNAME.workers.dev
```

---

## 🧪 TEST

### Health Check
```bash
curl https://afetnet-api.YOUR_USERNAME.workers.dev/health
```

**Beklenen**:
```json
{
  "status": "ok",
  "service": "AfetNet API",
  "version": "1.0.0",
  "timestamp": 1704574800000
}
```

### Queue Ingest Test
```bash
curl -X POST https://afetnet-api.YOUR_USERNAME.workers.dev/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-123",
    "timestamp": 1704574800000,
    "data": {
      "type": "sos",
      "message": "Test SOS",
      "location": { "lat": 41.0, "lon": 29.0 }
    }
  }'
```

**Beklenen**:
```json
{
  "ok": true,
  "id": "test-123",
  "stored": false
}
```

---

## 🔐 GÜVEN (Opsiyonel)

HMAC imzalama eklemek için:

```bash
# Secret oluştur
wrangler secret put API_SECRET

# Gir: "rastgele-guvenli-anahtar-12345"
```

Sonra uygulamada `src/lib/secure.ts`:
```typescript
export const API_SECRET = "rastgele-guvenli-anahtar-12345";
```

---

## 💾 STORAGE (Opsiyonel - KV)

Verileri saklamak için KV namespace oluştur:

### 1. Cloudflare Dashboard
```
1. dashboard.cloudflare.com → Workers & Pages → KV
2. "Create namespace" → "afetnet-queue"
3. ID'yi kopyala (örn: abc123...)
```

### 2. wrangler.toml Güncelle
```toml
[[kv_namespaces]]
binding = "QUEUE_KV"
id = "abc123..."
```

### 3. Tekrar Deploy
```bash
wrangler publish
```

Artık veriler 30 gün saklanacak!

---

## 📊 LOGLAR

Canlı logları görmek için:
```bash
wrangler tail
```

---

## 🌐 CUSTOM DOMAIN (Opsiyonel)

Kendi domain'ini kullanmak için:

### 1. Cloudflare'e Domain Ekle
```
dashboard.cloudflare.com → Add site → afetnet.org
```

### 2. wrangler.toml'a Route Ekle
```toml
routes = [
  { pattern = "api.afetnet.org/*", zone_name = "afetnet.org" }
]
```

### 3. Deploy
```bash
wrangler publish
```

Artık API: `https://api.afetnet.org/ingest`

---

## 📋 ENDPOINTS

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/health` | Sağlık kontrolü |
| POST | `/ingest` | Queue data kaydet |
| POST | `/fcm/register` | FCM token kaydet |

---

## 💰 MALIYET

**Cloudflare Workers Free Plan:**
- ✅ 100,000 istek/gün ÜCRETSIZ
- ✅ Global CDN (hızlı)
- ✅ KV: 100,000 okuma/gün
- ✅ Sınırsız bandwidth

AfetNet için **yeterli!**

Daha fazla → Workers Paid: $5/ay (10M istek)

---

## 🔗 Linkler

- Cloudflare Workers: https://workers.cloudflare.com
- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler
- Dashboard: https://dash.cloudflare.com

---

**Hazırlayan**: AI Assistant  
**Güncelleme**: 7 Ekim 2025




