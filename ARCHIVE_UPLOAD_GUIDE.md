# 🚀 ARCHIVE & UPLOAD REHBERİ

## XCODE'DA YAPILACAKLAR

### 1. Swift Package Manager ile Firebase Ekle

```
File > Add Package Dependencies
URL: https://github.com/firebase/firebase-ios-sdk
Add Package > Select Packages:
├─ ✅ FirebaseCore
├─ ✅ FirebaseMessaging  
├─ ✅ FirebaseAnalyticsWithoutAdIdSupport
└─ ✅ FirebaseFirestore
Add Package
```

### 2. Build Settings Kontrol

```
✅ Bundle ID: org.afetnet1.app
✅ Version: 1.0.2
✅ Build: 14
✅ Team: 3H4SWQ8VJL
✅ Signing: Automatic
✅ Bitcode: NO
✅ iOS Target: 15.1
```

### 3. Clean & Archive

```
Product > Clean Build Folder (⇧⌘K)
Product > Archive
```

### 4. Upload to App Store Connect

```
Distribute App > App Store Connect > Upload
```

## 📋 FINAL CHECKLIST

### ✅ TAMAMLANAN ADIMLAR:

```
✅ 1. Xcode Project Configuration
   ├─ Bundle ID: org.afetnet1.app
   ├─ Version: 1.0.2 (Build 14)
   ├─ Signing: Automatic (Team: 3H4SWQ8VJL)
   └─ Capabilities: Push Notifications, Background Modes, IAP

✅ 2. Firebase Setup
   ├─ AppDelegate.swift: Firebase.configure() + Push Notifications
   ├─ AppDelegate.m: Objective-C eşdeğeri
   ├─ AppDelegate.h: Header file
   ├─ Info.plist: FirebaseAppDelegateProxyEnabled = false
   └─ GoogleService-Info.plist: org.afetnet1.app

✅ 3. IAP Product IDs
   ├─ Monthly: org.afetnet1.premium.monthly
   ├─ Yearly: org.afetnet1.premium.yearly
   ├─ Lifetime: org.afetnet1.premium.lifetime
   ├─ Scripts: Güncellendi
   └─ StoreKit: AfetNet.storekit

✅ 4. Entitlements & Info.plist
   ├─ aps-environment: development
   ├─ com.apple.developer.in-app-payments: merchant.org.afetnet1.app
   ├─ NSBluetoothAlwaysUsageDescription: Mevcut
   ├─ NSLocationWhenInUseUsageDescription: Mevcut
   └─ UIBackgroundModes: remote-notification, bluetooth-central, location

✅ 5. Clean Workspace
   ├─ Build klasörleri temizlendi
   ├─ DerivedData temizlendi
   └─ Cache temizlendi
```

## 🔑 APNs KEY SETUP (KRİTİK!)

**Push Notifications için mutlaka yapılmalı:**

1. **Apple Developer Portal:**
   ```
   Keys > Create Key > Apple Push Notifications service (APNs)
   Key ID ve .p8 dosyasını kaydet
   ```

2. **Firebase Console:**
   ```
   Project Settings > Cloud Messaging > iOS app
   APNs Authentication Key yükle:
   ├─ Key ID: [10 karakter]
   ├─ Team ID: 3H4SWQ8VJL
   └─ .p8 file: [Apple'dan indirilen]
   ```

## 🎯 SONRAKİ ADIMLAR

1. **Xcode'da Swift Package Manager ile Firebase ekle**
2. **APNs Key'i Firebase'e yükle**
3. **Archive et**
4. **App Store Connect'e upload et**

---

**TÜM KONFİGÜRASYONLAR TAMAMLANDI!** 🎉

Bundle ID: `org.afetnet1.app`  
Version: `1.0.2` (Build 14)  
Firebase: ✅ Hazır  
IAP: ✅ Yeni product ID'leri  
Push Notifications: ✅ APNs Key bekleniyor
