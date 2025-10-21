# 🎯 NEW BUNDLE ID RELEASE - COMPLETE GUIDE

**Bundle ID:** `org.afetnet1.app` (NEW - Fresh App Store Submission)  
**Version:** 1.0.2  
**Build:** 14  
**Date:** October 21, 2025

---

## ✅ COMPLETED XCODE CHANGES

### 1. Bundle Identifier Updated
```
OLD: org.afetnet.app
NEW: org.afetnet1.app ✅

Updated in:
- Xcode project.pbxproj (Debug configuration) ✅
- Xcode project.pbxproj (Release configuration) ✅
- Info.plist CFBundleURLSchemes ✅
- app.config.ts ✅
```

### 2. Version Numbers Updated
```
Marketing Version: 1.0.1 → 1.0.2 ✅
Build Number: 13 → 14 ✅

Updated in:
- Xcode project.pbxproj (Debug) ✅
- Xcode project.pbxproj (Release) ✅
- Info.plist (CFBundleShortVersionString) ✅
- Info.plist (CFBundleVersion) ✅
- app.config.ts ✅
```

### 3. Signing Configuration
```
✅ CODE_SIGN_STYLE = Automatic (both Debug & Release)
✅ DEVELOPMENT_TEAM = 3H4SWQ8VJL (already set)
✅ PROVISIONING_PROFILE_SPECIFIER = "" (automatic profiles)
```

### 4. Capabilities & Entitlements
```
✅ Background Modes (Already in Info.plist):
   - bluetooth-central ✅
   - bluetooth-peripheral ✅
   - location ✅
   - fetch ✅
   - remote-notification ✅

✅ Push Notifications:
   - aps-environment in entitlements ✅

✅ In-App Purchases:
   - com.apple.developer.in-app-payments added to entitlements ✅
```

### 5. Info.plist Keys Added
```
✅ NSBluetoothAlwaysUsageDescription - NEW
   "AfetNet, afet durumlarında Bluetooth Mesh ile internet olmadan 
    iletişim için Bluetooth'a ihtiyaç duyar."

✅ NSBluetoothPeripheralUsageDescription - NEW
   "AfetNet, yakın cihazlarla bağlanmak için Bluetooth'u kullanır."

Already Present:
✅ NSLocationWhenInUseUsageDescription
✅ NSLocationAlwaysAndWhenInUseUsageDescription  
✅ NSCameraUsageDescription
✅ NSMicrophoneUsageDescription
✅ NSMotionUsageDescription
```

---

## ⚠️ FIREBASE CONFIGURATION WARNING

**File Found:** `GoogleService-Info.plist` (root directory)

**⚠️ CRITICAL:** This Firebase configuration is tied to the OLD bundle ID `org.afetnet.app`

### Required Actions:
1. Go to Firebase Console: https://console.firebase.google.com
2. Create NEW iOS app or update existing one
3. Use bundle ID: `org.afetnet1.app`
4. Download NEW `GoogleService-Info.plist`
5. Replace the current file BEFORE building for production
6. Update any Firebase project settings (FCM, Analytics, etc.)

**Do NOT delete the current file until you have the new one!**

---

## 📱 NEW IAP PRODUCT IDS (RECOMMENDED)

Since this is a **NEW App Store submission**, you should use NEW product IDs:

### Recommended Product IDs:
```
org.afetnet1.premium.monthly   (Auto-Renewable Subscription - 1 month)
org.afetnet1.premium.yearly    (Auto-Renewable Subscription - 1 year)
org.afetnet1.premium.lifetime  (Non-Consumable Purchase)
```

### File Created:
`shared/iap/products-new.ts` - Contains new product IDs

### Action Required:
1. **App Store Connect**: Create NEW app with bundle `org.afetnet1.app`
2. **Create NEW IAP products** with the IDs above
3. **Update code**: Replace `shared/iap/products.ts` with `products-new.ts`
4. **Test**: Sandbox testing with new product IDs

---

## 📋 VERIFICATION CHECKLIST

### Xcode Project Settings:

**Target: AfetNet**
```
✅ Product Bundle Identifier:
   - Debug: org.afetnet1.app
   - Release: org.afetnet1.app

✅ Version Numbers:
   - Marketing Version: 1.0.2
   - Current Project Version: 14

✅ Signing:
   - Automatically manage signing: ON
   - Team: 3H4SWQ8VJL (Gökhan ÇAMCI)
   - Provisioning Profile: Automatic

✅ Deployment Target: 15.1

✅ Entitlements File: AfetNet/AfetNet.entitlements
   - Push Notifications (aps-environment) ✅
   - In-App Purchases (com.apple.developer.in-app-payments) ✅

✅ Background Modes (Info.plist):
   - bluetooth-central ✅
   - bluetooth-peripheral ✅
   - location ✅
   - fetch ✅
   - remote-notification ✅
```

### Info.plist Keys:
```
✅ CFBundleShortVersionString: 1.0.2
✅ CFBundleVersion: 14
✅ CFBundleURLSchemes: org.afetnet1.app
✅ NSBluetoothAlwaysUsageDescription: Added
✅ NSBluetoothPeripheralUsageDescription: Added
✅ NSLocationWhenInUseUsageDescription: Present
✅ NSLocationAlwaysAndWhenInUseUsageDescription: Present
✅ UIBackgroundModes: All 5 modes enabled
```

### Build Configurations:
```
✅ Debug Configuration:
   - Bundle ID: org.afetnet1.app
   - Version: 1.0.2
   - Build: 14
   - Team: 3H4SWQ8VJL
   - Signing: Automatic

✅ Release Configuration:
   - Bundle ID: org.afetnet1.app
   - Version: 1.0.2
   - Build: 14
   - Team: 3H4SWQ8VJL
   - Signing: Automatic
```

---

## 🚀 NEXT STEPS - APP STORE SUBMISSION

### Phase 1: Xcode Build (30 minutes)

1. **Open Xcode Project:**
   ```bash
   cd /Users/gokhancamci/AfetNet1/ios
   open AfetNet.xcworkspace
   ```

2. **Select Scheme:**
   - Top bar: AfetNet scheme
   - Device: Any iOS Device (Generic)

3. **Clean Build Folder:**
   - Product > Clean Build Folder (⇧⌘K)

4. **Archive:**
   - Product > Archive (⌘B then wait)
   - Wait for archive to complete (~5-10 minutes)

5. **Distribute:**
   - Organizer opens automatically
   - Select archive → Distribute App
   - App Store Connect → Upload
   - Select team: 3H4SWQ8VJL
   - Upload (~5-10 minutes)

---

### Phase 2: App Store Connect Setup (2 hours)

#### A) Create NEW App (15 minutes):
```
1. Go to: https://appstoreconnect.apple.com
2. Apps > [+] > New App
3. Platforms: iOS
4. Name: AfetNet1 (or "AfetNet" if available)
5. Primary Language: Turkish
6. Bundle ID: org.afetnet1.app
7. SKU: AFETNET1-2025
8. User Access: Full Access
9. Create
```

#### B) Create NEW IAP Products (30 minutes):

**Subscriptions:**
```
1. Monetization > Subscriptions > [+]
2. Subscription Group: "AfetNet Premium Membership"
3. Create 2 subscriptions:

Monthly Subscription:
- Reference Name: Aylık Premium
- Product ID: org.afetnet1.premium.monthly
- Duration: 1 month
- Price: ₺49.99 (Turkey)
- Display Name (TR): Aylık Premium
- Description (TR): Tüm premium özellikler 1 ay
- Screenshot: Premium screen

Yearly Subscription:
- Reference Name: Yıllık Premium  
- Product ID: org.afetnet1.premium.yearly
- Duration: 1 year
- Price: ₺499.99 (Turkey)
- Display Name (TR): Yıllık Premium
- Description (TR): Tüm premium özellikler 1 yıl (%17 indirim)
- Screenshot: Premium screen
```

**Non-Consumable:**
```
Monetization > In-App Purchases > [+]
- Reference Name: Yaşam Boyu Premium
- Product ID: org.afetnet1.premium.lifetime
- Type: Non-Consumable
- Price: ₺999.99 (Turkey)
- Display Name (TR): Yaşam Boyu Premium
- Description (TR): Tüm premium özellikler kalıcı
- Screenshot: Premium screen
```

#### C) App Metadata (1 hour):

1. **Version 1.0.2 Information:**
   - Build: Select Build 14 (after upload completes)
   - Screenshots: 7+ screenshots (multiple sizes)
   - Description: Turkish description
   - Keywords: afet,deprem,premium,acil durum
   - Support URL: mailto:support@afetnet.app
   - Privacy Policy: https://gokhancamci.github.io/AfetNet1/docs/privacy-policy.html
   - Terms: https://gokhancamci.github.io/AfetNet1/docs/terms-of-service.html

2. **Add IAP to Version:**
   - Scroll to "In-App Purchases and Subscriptions"
   - [+] Add
   - Select all 3 IAP products
   - Save

3. **App Privacy:**
   - Location: Yes (Analytics, App Functionality)
   - Bluetooth: Yes (App Functionality)
   - User Content: Yes (Messaging)

4. **App Review Information:**
   - Test Account: Create sandbox tester
   - Notes: How to test premium features
   - Contact: Your email/phone

5. **Submit for Review**

---

### Phase 3: Code Updates (15 minutes)

**Update product IDs in code:**

1. Replace `shared/iap/products.ts` content with `products-new.ts`
2. Build and test locally
3. Rebuild for App Store

---

## 🔍 VERIFICATION COMMANDS

### Check Bundle ID:
```bash
cd /Users/gokhancamci/AfetNet1/ios
grep -r "org.afetnet.app" .
# Should return minimal results (only in old configs)

grep -r "org.afetnet1.app" .
# Should show new bundle ID in project files
```

### Check Version:
```bash
grep "MARKETING_VERSION" AfetNet.xcodeproj/project.pbxproj
# Should show: 1.0.2

grep "CURRENT_PROJECT_VERSION" AfetNet.xcodeproj/project.pbxproj
# Should show: 14
```

### Check Signing:
```bash
grep "CODE_SIGN_STYLE" AfetNet.xcodeproj/project.pbxproj
# Should show: Automatic

grep "DEVELOPMENT_TEAM" AfetNet.xcodeproj/project.pbxproj
# Should show: 3H4SWQ8VJL
```

---

## 📊 SUMMARY OF CHANGES

### Files Modified:
```
✅ ios/AfetNet.xcodeproj/project.pbxproj
   - PRODUCT_BUNDLE_IDENTIFIER: org.afetnet.app → org.afetnet1.app (both configs)
   - MARKETING_VERSION: 1.0.1 → 1.0.2 (both configs)
   - CURRENT_PROJECT_VERSION: 13 → 14 (both configs)

✅ ios/AfetNet/Info.plist
   - CFBundleShortVersionString: 1.0.1 → 1.0.2
   - CFBundleVersion: 4 → 14
   - CFBundleURLSchemes: org.afetnet.app → org.afetnet1.app
   - NSBluetoothAlwaysUsageDescription: ADDED
   - NSBluetoothPeripheralUsageDescription: ADDED

✅ ios/AfetNet/AfetNet.entitlements
   - com.apple.developer.in-app-payments: ADDED

✅ app.config.ts
   - version: 1.0.1 → 1.0.2
   - buildNumber: 4 → 14
   - bundleIdentifier: org.afetnet.app → org.afetnet1.app

✅ shared/iap/products-new.ts
   - NEW file with new product IDs for new bundle
```

### Files to Update Manually:
```
⚠️ GoogleService-Info.plist
   - Download NEW file from Firebase Console
   - Bundle ID must be: org.afetnet1.app

⚠️ shared/iap/products.ts (Optional)
   - Replace with products-new.ts if using new IAP product IDs
   - OR keep old IDs if reusing from old app (not recommended)
```

---

## 🎯 BUILD & ARCHIVE INSTRUCTIONS

### Terminal Commands:
```bash
# Navigate to iOS directory
cd /Users/gokhancamci/AfetNet1/ios

# Clean build
rm -rf build
rm -rf ~/Library/Developer/Xcode/DerivedData/AfetNet-*

# Install pods (if needed)
pod install

# Open workspace
open AfetNet.xcworkspace
```

### In Xcode:
```
1. Select "AfetNet" scheme (top bar)
2. Select "Any iOS Device" (top bar)
3. Product > Clean Build Folder (⇧⌘K)
4. Product > Archive
5. Wait for "AfetNet.xcarchive" to complete
6. Organizer opens → Distribute App
7. App Store Connect → Upload
8. Wait for upload (~10 minutes)
```

---

## 📱 APP STORE CONNECT CHECKLIST

### Step 1: Create New App
- [ ] Name: AfetNet1
- [ ] Bundle ID: org.afetnet1.app (will appear in dropdown after first upload)
- [ ] Primary Language: Turkish
- [ ] SKU: AFETNET1

### Step 2: Create IAP Products
- [ ] Monthly: org.afetnet1.premium.monthly (₺49.99)
- [ ] Yearly: org.afetnet1.premium.yearly (₺499.99)
- [ ] Lifetime: org.afetnet1.premium.lifetime (₺999.99)

### Step 3: Version 1.0.2 Setup
- [ ] Build 14 selected
- [ ] Screenshots uploaded (7+)
- [ ] Description (Turkish)
- [ ] Keywords optimized
- [ ] Privacy Policy URL
- [ ] Terms URL
- [ ] IAPs added to version

### Step 4: Submit
- [ ] App Privacy completed
- [ ] Review Information filled
- [ ] Test account created
- [ ] Submit for Review

---

## 🚨 IMPORTANT NOTES

### Why New Bundle ID?
- Fresh start with App Store
- Clean IAP setup
- No history from rejected version
- New app listing

### Old vs New:
```
OLD APP (org.afetnet.app):
- Status: Version 1.0 rejected
- IAP products: afetnet_premium_*
- Can continue OR abandon

NEW APP (org.afetnet1.app):
- Status: Fresh submission
- IAP products: org.afetnet1.premium.*
- Clean slate, higher approval chance
```

### Migration:
Users from old app **CANNOT** restore purchases in new app (different bundle ID).
This is a completely separate app in App Store.

---

## ✅ READY TO BUILD

**Xcode project is now configured for:**
- Bundle ID: org.afetnet1.app ✅
- Version: 1.0.2 ✅
- Build: 14 ✅
- Automatic signing ✅
- All capabilities enabled ✅
- All permissions defined ✅

**Next:** Archive and upload to App Store Connect!

---

**Prepared by:** iOS Release Engineer  
**Date:** October 21, 2025  
**Status:** ✅ READY FOR ARCHIVE & UPLOAD

