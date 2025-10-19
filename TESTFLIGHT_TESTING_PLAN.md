# TestFlight & Sandbox Testing Plan
# Comprehensive IAP testing for AfetNet Premium features

## 🎯 Testing Objectives
- Verify only 3 valid product IDs are active
- Test all purchase flows (Monthly, Yearly, Lifetime)
- Validate restore functionality
- Confirm premium gating works correctly
- Test webhook integration
- Ensure no duplicate product IDs

## 📱 Test Environment Setup

### Prerequisites
1. **TestFlight Internal Testing** enabled
2. **Sandbox Apple ID** configured on test device
3. **Database server** running and accessible
4. **Apple App Store Connect** webhook configured

### Test Device Requirements
- iOS 14.0+ device
- TestFlight app installed
- Sandbox Apple ID signed in
- Network connectivity for server verification

## 🧪 Test Cases

### 1. Product Listing Validation
**Objective**: Verify only 3 valid products are shown

**Steps**:
1. Open AfetNet app
2. Navigate to Premium/Settings screen
3. Tap "Premium Features" or "Upgrade"

**Expected Results**:
```
✅ Only these 3 products visible:
   • afetnet_premium_monthly1 (Aylık Premium)
   • afetnet_premium_yearly1 (Yıllık Premium) 
   • afetnet_premium_lifetime (Yaşam Boyu Premium)

❌ NO old products visible:
   • afetnet_premium_monthly
   • afetnet_premium_yearly
```

**Logs to Check**:
```
📦 GET /api/iap/products - Returning valid products
✅ Premium product detected: afetnet_premium_monthly1
✅ Premium product detected: afetnet_premium_yearly1
✅ Premium product detected: afetnet_premium_lifetime
```

### 2. Monthly Subscription Purchase
**Objective**: Test monthly subscription purchase and premium activation

**Steps**:
1. Select "Aylık Premium" (Monthly)
2. Complete purchase with sandbox Apple ID
3. Verify premium features unlock
4. Check server logs

**Expected Results**:
```
✅ Purchase successful
✅ Premium status: ACTIVE (Product: afetnet_premium_monthly1)
✅ Premium features accessible
✅ Server receipt validation passed
✅ Database purchase record created
```

**Logs to Check**:
```
🔐 POST /api/iap/verify - Verifying receipt for user: {userId}
✅ Receipt verification passed
💳 Created purchase: {purchaseId}
📊 Premium Status: ACTIVE (Product: afetnet_premium_monthly1)
```

### 3. Restore Purchases
**Objective**: Test restore functionality after app reinstall

**Steps**:
1. Delete and reinstall app
2. Sign in with same Apple ID
3. Tap "Restore Purchases"
4. Verify premium status restored

**Expected Results**:
```
✅ Restore successful
✅ Premium status: ACTIVE (Product: afetnet_premium_monthly1)
✅ Premium features accessible
✅ Server verification passed
```

**Logs to Check**:
```
🔄 Restoring purchases...
🔐 POST /api/iap/verify - Verifying receipt for user: {userId}
✅ Purchase already exists and is active: {transactionId}
📊 Premium Status: ACTIVE (Product: afetnet_premium_monthly1)
```

### 4. Lifetime Purchase
**Objective**: Test lifetime purchase and permanent premium

**Steps**:
1. Select "Yaşam Boyu Premium" (Lifetime)
2. Complete purchase
3. Verify premium active
4. Logout and login again
5. Verify premium still active

**Expected Results**:
```
✅ Lifetime purchase successful
✅ Premium status: ACTIVE (Product: afetnet_premium_lifetime)
✅ Premium remains active after logout/login
✅ No expiry date set
```

**Logs to Check**:
```
💳 Created purchase: {purchaseId}
✅ Purchase created and entitlements updated: {
  userId: {userId},
  productId: afetnet_premium_lifetime,
  isLifetime: true,
  expiresAt: undefined
}
📊 Premium Status: ACTIVE (Product: afetnet_premium_lifetime)
```

### 5. Yearly Subscription Purchase
**Objective**: Test yearly subscription and webhook integration

**Steps**:
1. Select "Yıllık Premium" (Yearly)
2. Complete purchase
3. Verify premium active
4. Check webhook endpoint accessible

**Expected Results**:
```
✅ Yearly purchase successful
✅ Premium status: ACTIVE (Product: afetnet_premium_yearly1)
✅ Expiry date set to 1 year from now
✅ Webhook endpoint ready for Apple notifications
```

**Logs to Check**:
```
💳 Created purchase: {purchaseId}
✅ Purchase created and entitlements updated: {
  userId: {userId},
  productId: afetnet_premium_yearly1,
  isLifetime: false,
  expiresAt: {futureDate}
}
```

### 6. Premium Gating Validation
**Objective**: Verify premium features are properly gated

**Steps**:
1. Test with free account (no purchases)
2. Verify premium features locked
3. Purchase premium
4. Verify features unlock
5. Test restore after logout

**Expected Results**:
```
❌ Free account: Premium features locked
✅ Premium account: All features accessible
✅ Premium gating works correctly
```

**Logs to Check**:
```
📊 Premium Status: INACTIVE
🔒 Premium feature locked: {featureName}
📊 Premium Status: ACTIVE (Product: {productId})
✅ Premium feature unlocked: {featureName}
```

### 7. Error Handling
**Objective**: Test error scenarios and edge cases

**Test Cases**:
1. **Invalid Receipt**: Send malformed receipt data
2. **Network Error**: Disable network during purchase
3. **Server Error**: Stop server during verification
4. **Duplicate Purchase**: Attempt to purchase same product twice

**Expected Results**:
```
❌ Invalid receipt: Proper error message shown
❌ Network error: Graceful fallback to local storage
❌ Server error: Retry mechanism works
✅ Duplicate purchase: Handled gracefully
```

**Logs to Check**:
```
❌ Receipt verification failed: {error}
❌ Doğrulama başarısız: {error}
⚠️ Server unavailable, using local storage
ℹ️ Purchase already exists and is active: {transactionId}
```

## 🔍 Validation Checklist

### Product ID Validation
- [ ] Only 3 products visible in UI
- [ ] No old product IDs in logs
- [ ] Server returns only valid products
- [ ] No duplicate product references

### Purchase Flow Validation
- [ ] Monthly purchase works
- [ ] Yearly purchase works  
- [ ] Lifetime purchase works
- [ ] All purchases create database records
- [ ] Premium status updates correctly

### Restore Flow Validation
- [ ] Restore button works
- [ ] Previous purchases restored
- [ ] Premium status reactivated
- [ ] No duplicate purchases created

### Premium Gating Validation
- [ ] Free users see locked features
- [ ] Premium users see unlocked features
- [ ] Gating works after restore
- [ ] Gating works after logout/login

### Server Integration Validation
- [ ] Receipt verification works
- [ ] Database updates correctly
- [ ] Webhook endpoint accessible
- [ ] Error handling works

### App Icon Validation
- [ ] All 18 icon sizes present
- [ ] No transparency in icons
- [ ] Full-bleed red background
- [ ] No white borders
- [ ] App Store Connect validation passes

## 📊 Test Results Template

```
TestFlight IAP Testing Results
==============================

Date: {date}
Tester: {name}
Device: {device}
iOS Version: {version}
App Version: {version}

Product Listing:
✅ Monthly: afetnet_premium_monthly1 - Visible
✅ Yearly: afetnet_premium_yearly1 - Visible  
✅ Lifetime: afetnet_premium_lifetime - Visible
❌ Old products: None visible

Purchase Tests:
✅ Monthly Purchase: PASS/FAIL
✅ Yearly Purchase: PASS/FAIL
✅ Lifetime Purchase: PASS/FAIL
✅ Restore Purchases: PASS/FAIL

Premium Gating:
✅ Free Account: Features locked
✅ Premium Account: Features unlocked
✅ After Restore: Features unlocked

Error Handling:
✅ Invalid Receipt: Proper error shown
✅ Network Error: Graceful fallback
✅ Server Error: Retry works

App Icon:
✅ All sizes present: 18/18
✅ No transparency: PASS/FAIL
✅ Full-bleed red: PASS/FAIL
✅ No white borders: PASS/FAIL

Overall Result: PASS/FAIL
Notes: {notes}
```

## 🚨 Critical Issues to Report

1. **Old Product IDs Visible**: Any reference to products without "1"
2. **Duplicate Products**: Same product appearing multiple times
3. **Purchase Failures**: Any purchase that doesn't complete
4. **Restore Failures**: Restore not working after reinstall
5. **Premium Gating Issues**: Features not unlocking after purchase
6. **Server Errors**: Any 500 errors or connection failures
7. **App Icon Issues**: Missing icons or transparency problems

## 📞 Support Information

**Server Endpoints**:
- Health Check: `GET /health`
- Products: `GET /api/iap/products`
- Verify: `POST /api/iap/verify`
- Entitlements: `GET /api/user/entitlements`
- Webhook: `POST /api/iap/apple-notifications`

**Log Locations**:
- Client: Console logs in Xcode/React Native debugger
- Server: Terminal output and database logs
- Apple: App Store Connect purchase logs

**Contact**: Report issues with device info, steps to reproduce, and relevant logs.
