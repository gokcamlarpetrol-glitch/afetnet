# 🔧 Ngrok Tunnel Hatası - Çözüm

## ❌ Sorun

```
CommandError: ngrok tunnel took too long to connect.
```

Tunnel bağlantısı başarısız oluyor. Bu durumda alternatif yöntemler kullanmalıyız.

## ✅ Çözümler

### Çözüm 1: LAN Modunu Kullan (Önerilen)

Mac ve iPhone **aynı WiFi ağında** iseniz:

```bash
npm run start:lan
```

Bu komut:
- `--host lan` ile local network üzerinden bağlanır
- Tunnel gerektirmez
- Daha hızlı ve güvenilirdir

### Çözüm 2: Localhost + Port Forwarding

Manuel olarak bağlanmak için:

1. **Dev server'ı başlatın (tunnel olmadan):**
   ```bash
   npx expo start --dev-client --clear
   ```

2. **Terminal'de gösterilen IP adresini kullanın:**
   - Örnek: `exp://192.168.1.100:8081`

3. **Telefonda:**
   - "Enter URL manually" butonuna tıklayın
   - Terminal'deki URL'yi girin

### Çözüm 3: Tunnel'ı Tekrar Deneyin

Bazen ngrok geçici olarak başarısız olabilir:

```bash
# Önce temizleyin
killall node
killall ngrok

# Sonra tekrar deneyin
npm run start:dev
```

### Çözüm 4: Ngrok'u Manuel Kurun

Eğer ngrok kurulu değilse:

```bash
# Homebrew ile kurun
brew install ngrok

# Veya Expo CLI otomatik kurar, ama manuel kurmak daha güvenilir
```

## 🎯 En Hızlı Çözüm

**Mac ve iPhone aynı WiFi'de ise:**

```bash
npm run start:lan
```

Bu en güvenilir ve hızlı yöntemdir.

## 📝 Komut Karşılaştırması

| Komut | Açıklama | Gereksinimler |
|-------|----------|---------------|
| `npm run start:dev` | Tunnel ile (internet üzerinden) | ngrok çalışmalı |
| `npm run start:lan` | LAN ile (aynı WiFi) | Mac ve iPhone aynı ağda |
| `npx expo start --dev-client --clear` | Manuel bağlantı | IP adresi gerekiyor |

## ✅ Önerilen: LAN Kullanın

Aynı WiFi'deyseniz **mutlaka** `npm run start:lan` kullanın:
- ✅ Daha hızlı
- ✅ Daha güvenilir
- ✅ Tunnel gerektirmez
- ✅ Internet bağlantısı gerektirmez


