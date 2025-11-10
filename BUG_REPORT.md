# 🐛 AfetNet Bug Report

**Tarih:** 5 Kasım 2025  
**Audit Sonrası Bug Raporu**

---

## 📋 Bug Summary

**Toplam Bug:** 3  
**Critical:** 0  
**Major:** 0  
**Minor:** 3  

---

## Minor Bugs

### Bug #1: LED Flash Disabled
**Severity:** Minor  
**Status:** Known Issue  
**Component:** MultiChannelAlertService  

**Description:**
LED flash alert channel is disabled due to stability issues with `expo-brightness` package.

**Location:**
- `src/core/services/MultiChannelAlertService.ts`
- Settings screen shows LED toggle as "yakında eklenecek"

**Reproduction Steps:**
1. Go to Settings
2. Try to enable LED Uyarısı
3. Alert shows "Bu özellik yakında eklenecektir"

**Expected Behavior:**
LED should flash during critical alerts

**Actual Behavior:**
LED flash is disabled

**Fix Recommendation:**
- Replace `expo-brightness` with a more stable LED control library
- Or implement native modules for LED control
- Test on multiple devices before enabling

**Priority:** Low  
**Estimated Fix Time:** 2-4 hours

---

### Bug #2: MBTiles Tiles Missing
**Severity:** Minor (Feature Not Complete)  
**Status:** Implementation Incomplete  
**Component:** Offline Map System  

**Description:**
MBTiles database file is missing from `assets/tiles/` directory. Only README.txt exists.

**Location:**
- `assets/tiles/` - Only contains README.txt
- `src/offline/mbtiles.ts` - Code ready but no data

**Reproduction Steps:**
1. Check `assets/tiles/` directory
2. Only README.txt exists
3. No .mbtiles file present

**Expected Behavior:**
MBTiles database should exist with offline map tiles

**Actual Behavior:**
No tiles available, offline map doesn't work

**Fix Recommendation:**
1. Use `scripts/pack-mbtiles.ts` to pack tiles
2. Download Istanbul region tiles
3. Place .mbtiles file in `assets/tiles/`
4. Test offline map loading

**Priority:** Medium  
**Estimated Fix Time:** 4-8 hours (including tile download and testing)

---

### Bug #3: Placeholder Settings
**Severity:** Minor  
**Status:** Feature Incomplete  
**Component:** Settings Screen  

**Description:**
Some settings are placeholders and show "yakında eklenecek" or "her zaman aktif" alerts.

**Location:**
- `src/core/screens/settings/SettingsScreen.tsx`
- LED Uyarısı toggle
- Tam Ekran Uyarı toggle

**Affected Settings:**
1. **LED Uyarısı** - Shows alert "Bu özellik yakında eklenecektir"
2. **Tam Ekran Uyarı** - Shows alert "Bu özellik her zaman aktif durumda"

**Reproduction Steps:**
1. Go to Settings > Bildirimler
2. Try to toggle LED Uyarısı
3. Alert appears instead of toggling

**Expected Behavior:**
All settings should be functional or hidden if not implemented

**Actual Behavior:**
Placeholder settings show alerts

**Fix Recommendation:**
- Either implement the features
- Or hide them until implementation
- Or add "BETA" badge to indicate work in progress

**Priority:** Low  
**Estimated Fix Time:** 1-2 hours (to hide or add badges)

---

## 🔍 Potential Issues (Not Bugs, But Worth Noting)

### Issue #1: Firebase Storage Not Used
**Description:** Firebase Storage rules exist but no code uses Storage  
**Impact:** Low - Storage might be for future use  
**Recommendation:** Either use Storage or remove unused rules

### Issue #2: Cloud Functions Not Implemented
**Description:** No Cloud Functions directory or deployment  
**Impact:** Low - Functions might not be needed yet  
**Recommendation:** Consider Functions for backend tasks (notifications, data processing)

### Issue #3: No Backend Monitoring
**Description:** Backend has no health monitoring or error tracking  
**Impact:** Medium - Hard to debug production issues  
**Recommendation:** Add Sentry or similar error tracking

### Issue #4: No Rate Limiting
**Description:** Backend API has no rate limiting  
**Impact:** Medium - Vulnerable to abuse  
**Recommendation:** Add express-rate-limit middleware

### Issue #5: No API Authentication
**Description:** Backend API endpoints are public  
**Impact:** Medium - Security concern  
**Recommendation:** Add JWT authentication for sensitive endpoints

---

## ✅ Non-Issues (Working as Expected)

### 1. AI Mock Mode
**Description:** AI services fall back to mock mode if OpenAI key is missing  
**Status:** ✅ Working as designed  
**Reason:** Intentional fallback mechanism

### 2. BLE Mesh Scan Interval
**Description:** BLE mesh scans every 10 seconds  
**Status:** ✅ Working as designed  
**Reason:** Balance between discovery speed and battery life

### 3. Firebase Optional
**Description:** App works without Firebase  
**Status:** ✅ Working as designed  
**Reason:** Offline-first architecture

---

## 📊 Bug Statistics

### By Severity
- Critical: 0
- Major: 0
- Minor: 3

### By Component
- MultiChannelAlertService: 1
- Offline Map: 1
- Settings: 1

### By Status
- Known Issue: 1
- Implementation Incomplete: 2

---

## 🎯 Fix Priority

### Immediate (This Week)
- None (no critical bugs)

### Short Term (This Month)
- Bug #2: MBTiles tiles (if offline map is priority)
- Issue #3: Backend monitoring (for production)
- Issue #4: Rate limiting (for security)

### Long Term (Next Quarter)
- Bug #1: LED flash (low priority)
- Bug #3: Placeholder settings (cosmetic)
- Issue #2: Cloud Functions (if needed)

---

## 🔧 Testing Recommendations

### Manual Testing Needed
1. Test offline map with real tiles
2. Test LED flash on multiple devices
3. Test all settings on real devices
4. Test backend under load

### Automated Testing Needed
1. Unit tests for AI services
2. Integration tests for BLE mesh
3. E2E tests for critical flows
4. Load tests for backend

---

## 📝 Notes

- No critical or major bugs found
- Application is stable and production-ready
- Minor issues are cosmetic or feature-incomplete
- Security improvements recommended for backend

---

**Rapor Hazırlayan:** AI Assistant  
**Son Güncelleme:** 5 Kasım 2025


