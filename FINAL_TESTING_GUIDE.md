# Final Testing Guide - AfetNet Production Release

## 🎯 Test Scope

This guide covers comprehensive testing for all critical improvements implemented:
1. Storage Management Service
2. Backend Monitoring (Sentry)
3. Rate Limiting
4. Rescue Beacon Service
5. Rescue Team Mode UI
6. Marker Clustering
7. Performance Optimizations

---

## 📱 Device Requirements

### Minimum Test Devices
- **iOS:** iPhone 8 or later (iOS 14+)
- **Android:** Android 8.0+ (API 26+)
- **Both platforms required** for BLE Mesh testing

### Recommended Test Devices
- Low-end device (2GB RAM) - Performance testing
- Mid-range device (4GB RAM) - Standard testing
- High-end device (8GB+ RAM) - Feature testing

---

## 🧪 Test Categories

### 1. Storage Management Tests

#### Test 1.1: Low Storage Detection
**Steps:**
1. Fill device storage to 90%
2. Launch app
3. Observe storage warning banner

**Expected:**
- Warning banner appears at top
- Shows remaining storage (MB)
- "Temizle" button visible

#### Test 1.2: Automatic Cleanup
**Steps:**
1. Trigger low storage warning
2. Tap "Temizle" button
3. Wait for cleanup to complete

**Expected:**
- AI cache cleared
- News cache cleared
- Storage warning disappears
- No app crash

#### Test 1.3: Critical Storage Handling
**Steps:**
1. Fill device storage to 98%
2. Launch app
3. Observe critical storage alert

**Expected:**
- Critical alert (red banner)
- Automatic cleanup triggered
- Old earthquakes trimmed (keep last 100)
- Old messages trimmed (keep last 30 days)

#### Test 1.4: Storage Stats Display
**Steps:**
1. Navigate to Settings
2. Scroll to storage section
3. View storage stats

**Expected:**
- Total storage displayed
- Used storage displayed
- Free storage displayed
- Percentage bar visible
- Status indicator (OK/Warning/Critical)

---

### 2. Backend Monitoring Tests

#### Test 2.1: Sentry Error Tracking
**Steps:**
1. Configure SENTRY_DSN in Render.com
2. Deploy backend
3. Trigger an error (invalid IAP request)
4. Check Sentry dashboard

**Expected:**
- Error appears in Sentry
- Stack trace visible
- Request context included
- User context (if available)

#### Test 2.2: Performance Monitoring
**Steps:**
1. Make 10 API requests
2. Check Sentry performance dashboard
3. Verify transaction traces

**Expected:**
- Transactions recorded
- Response times logged
- Slow requests flagged (>1s)
- Database queries traced

#### Test 2.3: Rate Limit Logging
**Steps:**
1. Exceed rate limit (101 requests in 15 min)
2. Check Sentry logs

**Expected:**
- Rate limit events logged
- IP address recorded
- Endpoint identified

---

### 3. Rate Limiting Tests

#### Test 3.1: Global Rate Limit
**Steps:**
1. Send 100 requests to /health in 15 min
2. Send 101st request
3. Observe response

**Expected:**
- First 100 requests: 200 OK
- 101st request: 429 Too Many Requests
- Response includes retry-after header
- Error message: "Too many requests..."

#### Test 3.2: IAP Strict Rate Limit
**Steps:**
1. Send 10 IAP verification requests in 15 min
2. Send 11th request
3. Observe response

**Expected:**
- First 10 requests: OK
- 11th request: 429
- Stricter limit than global

#### Test 3.3: Push Registration Rate Limit
**Steps:**
1. Register push token 5 times in 1 hour
2. Attempt 6th registration
3. Observe response

**Expected:**
- First 5 registrations: OK
- 6th registration: 429
- Very strict limit (prevents abuse)

#### Test 3.4: EEW Lenient Rate Limit
**Steps:**
1. Send 30 EEW requests in 1 min
2. Send 31st request
3. Observe response

**Expected:**
- All 30 requests: OK
- 31st request: 429
- More lenient for critical service

---

### 4. Rescue Beacon Tests

#### Test 4.1: Beacon Auto-Start
**Steps:**
1. Open app on Device A
2. Set status to "Enkaz Altında"
3. Wait 10 seconds

**Expected:**
- Beacon starts automatically
- BLE broadcasting active
- Beacon payload includes:
  - User ID
  - User name
  - Status ("trapped")
  - Location (if available)
  - Battery level
  - Timestamp

#### Test 4.2: Beacon Detection
**Steps:**
1. Device A: Set status to "Enkaz Altında"
2. Device B: Enable Rescue Team Mode
3. Wait 30 seconds

**Expected:**
- Device B detects Device A
- User appears in trapped users list
- Distance calculated (if locations available)
- RSSI signal strength displayed
- Battery level shown

#### Test 4.3: RSSI Proximity
**Steps:**
1. Device A: Beacon active
2. Device B: Rescue mode active
3. Move devices closer/farther

**Expected:**
- RSSI updates in real-time
- Signal strength indicator changes
- Distance estimate updates
- Signal bars (1-4) display correctly

#### Test 4.4: Beacon Auto-Stop
**Steps:**
1. Device A: Beacon active
2. Change status to "Güvende"
3. Observe beacon

**Expected:**
- Beacon stops automatically
- BLE broadcasting stops
- Device A removed from rescue list (after 5 min)

#### Test 4.5: Battery Optimization
**Steps:**
1. Start beacon
2. Monitor battery usage for 1 hour

**Expected:**
- Battery drain <5% per hour
- Beacon interval: 10 seconds (configurable)
- No excessive CPU usage

---

### 5. Rescue Team Mode Tests

#### Test 5.1: Mode Activation
**Steps:**
1. Navigate to Rescue Team screen
2. Tap mode toggle button
3. Observe UI

**Expected:**
- Button turns red
- "Aktif - Tarama Yapılıyor" text
- Info card appears
- Stats cards appear
- BLE scanning starts

#### Test 5.2: Trapped User List
**Steps:**
1. Enable rescue mode
2. Detect 3 trapped users
3. Observe list

**Expected:**
- Users sorted by distance (closest first)
- Each user card shows:
  - Name
  - Status (color-coded)
  - Battery level
  - Distance
  - Signal strength (bars)
  - Last seen time
  - Message (if any)
- "Konuma Git" button visible

#### Test 5.3: Map Integration
**Steps:**
1. Enable rescue mode
2. Detect trapped user
3. Navigate to Map screen

**Expected:**
- Trapped user marker visible
- Custom marker with pulsing animation
- Tap marker to zoom
- Callout shows user details
- Header shows "X enkaz" count

#### Test 5.4: Navigation to User
**Steps:**
1. Rescue mode active
2. Tap "Konuma Git" on user card
3. Observe map

**Expected:**
- Map opens
- Zooms to user location
- User marker centered
- Smooth animation (1 second)

#### Test 5.5: Expired User Cleanup
**Steps:**
1. Detect trapped user
2. Turn off Device A (beacon stops)
3. Wait 6 minutes

**Expected:**
- User removed from list after 5 min
- "Tespit Edilen" count decreases
- No memory leak

---

### 6. Marker Clustering Tests

#### Test 6.1: Cluster Formation
**Steps:**
1. Add 50 earthquake markers in Istanbul
2. Zoom out to see all markers
3. Observe clustering

**Expected:**
- Markers cluster automatically
- Cluster shows count (e.g., "50")
- Cluster size based on count
- Color based on count:
  - Green: <10
  - Blue: 10-20
  - Orange: 20-50
  - Red: >50

#### Test 6.2: Cluster Zoom
**Steps:**
1. Tap on cluster
2. Observe map

**Expected:**
- Map zooms to cluster bounds
- Cluster breaks into smaller clusters
- Individual markers visible at high zoom

#### Test 6.3: Performance with 1000+ Markers
**Steps:**
1. Load 1000 earthquake markers
2. Pan and zoom map
3. Monitor FPS

**Expected:**
- Smooth scrolling (60 FPS)
- No lag or jank
- Clusters update instantly
- Memory usage <100MB

#### Test 6.4: Zoom-Based Clustering
**Steps:**
1. Zoom out (low zoom level)
2. Observe clustering
3. Zoom in (high zoom level)
4. Observe markers

**Expected:**
- Clustering active at zoom <12
- Clustering disabled at zoom >12
- Individual markers visible when zoomed in

---

### 7. Performance Tests

#### Test 7.1: App Startup Time
**Steps:**
1. Force quit app
2. Launch app
3. Measure time to home screen

**Expected:**
- Cold start: <3 seconds
- Warm start: <1 second
- No white screen flash
- Splash screen smooth

#### Test 7.2: Screen Transitions
**Steps:**
1. Navigate between all screens
2. Measure transition time

**Expected:**
- All transitions: <300ms
- Smooth animations
- No jank or lag
- No memory leaks

#### Test 7.3: Map Rendering
**Steps:**
1. Open map with 100+ markers
2. Pan and zoom
3. Monitor FPS

**Expected:**
- Consistent 60 FPS
- No dropped frames
- Smooth gestures
- Quick marker rendering

#### Test 7.4: AI Response Time
**Steps:**
1. Request AI risk score
2. Measure response time

**Expected:**
- Response: <5 seconds
- Loading indicator visible
- No UI freeze
- Cache hit: <100ms

---

### 8. Error Handling Tests

#### Test 8.1: Network Errors
**Steps:**
1. Turn off WiFi/cellular
2. Attempt earthquake fetch
3. Observe error handling

**Expected:**
- Graceful error message
- No app crash
- Offline mode activated
- Cached data displayed

#### Test 8.2: API Errors
**Steps:**
1. Invalid OpenAI API key
2. Request AI service
3. Observe fallback

**Expected:**
- Fallback to mock data
- Error logged to Sentry
- User-friendly message
- No app crash

#### Test 8.3: Permission Errors
**Steps:**
1. Deny location permission
2. Attempt to use map
3. Observe error handling

**Expected:**
- Permission prompt
- Graceful degradation
- Explanation message
- Settings link

---

### 9. Edge Cases Tests

#### Test 9.1: Low Battery
**Steps:**
1. Device battery <20%
2. Enable rescue beacon
3. Observe behavior

**Expected:**
- Beacon still works
- Battery warning shown
- Beacon interval increased (battery saving)
- No excessive drain

#### Test 9.2: No Internet
**Steps:**
1. Turn off internet
2. Use all app features
3. Observe offline mode

**Expected:**
- Offline map works
- BLE mesh works
- Cached earthquakes visible
- No crash

#### Test 9.3: No Permissions
**Steps:**
1. Deny all permissions
2. Launch app
3. Observe graceful degradation

**Expected:**
- App launches
- Permission prompts shown
- Features disabled gracefully
- No crash

---

## ✅ Test Completion Checklist

### Critical Features (P0)
- [ ] Storage management working
- [ ] Backend monitoring active
- [ ] Rate limiting functional
- [ ] Rescue beacon operational
- [ ] Rescue team mode working
- [ ] Marker clustering active
- [ ] Performance optimized

### Backend Tests
- [ ] Sentry error tracking verified
- [ ] Rate limiting tested
- [ ] Health check working
- [ ] Database connected
- [ ] All endpoints functional

### Frontend Tests
- [ ] All screens accessible
- [ ] All buttons clickable
- [ ] All features working
- [ ] No crashes
- [ ] No memory leaks

### Integration Tests
- [ ] BLE mesh communication
- [ ] Firebase sync
- [ ] AI services
- [ ] Earthquake alerts
- [ ] Push notifications

### Performance Tests
- [ ] Startup time <3s
- [ ] Transitions <300ms
- [ ] Map 60 FPS
- [ ] AI response <5s
- [ ] No ANR

### Edge Cases
- [ ] Low battery
- [ ] No internet
- [ ] No permissions
- [ ] Low storage
- [ ] Poor signal

---

## 🐛 Bug Reporting Template

```markdown
## Bug Report

**Title:** [Short description]

**Severity:** Critical / High / Medium / Low

**Environment:**
- Device: [iPhone 12 / Samsung S21]
- OS: [iOS 15.0 / Android 12]
- App Version: [1.0.2]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots:**
[Attach screenshots]

**Logs:**
[Attach relevant logs]

**Additional Context:**
[Any other information]
```

---

## 📊 Test Results Template

```markdown
## Test Results - [Date]

**Tester:** [Name]
**Device:** [Device info]
**Build:** [Version]

### Summary
- Total Tests: X
- Passed: X
- Failed: X
- Blocked: X

### Critical Issues
- [Issue 1]
- [Issue 2]

### Recommendations
- [Recommendation 1]
- [Recommendation 2]

### Sign-off
- [ ] Ready for production
- [ ] Needs fixes
- [ ] Needs retesting
```

---

## 🚀 Production Deployment Checklist

### Pre-Deployment
- [ ] All tests passed
- [ ] No critical bugs
- [ ] Performance metrics met
- [ ] Security audit passed
- [ ] Code review completed

### Backend Deployment
- [ ] Sentry DSN configured
- [ ] Rate limiting enabled
- [ ] Environment variables set
- [ ] Database migrated
- [ ] Health check passing

### Frontend Deployment
- [ ] Build successful
- [ ] Assets optimized
- [ ] API keys configured
- [ ] Push notifications tested
- [ ] App store ready

### Post-Deployment
- [ ] Monitor Sentry for errors
- [ ] Check performance metrics
- [ ] Verify user feedback
- [ ] Monitor crash reports
- [ ] Track adoption rate

---

## 📞 Support Contacts

**Development Team:**
- Technical Lead: [Contact]
- Backend Engineer: [Contact]
- QA Engineer: [Contact]

**Emergency Contacts:**
- On-call Engineer: [Contact]
- Sentry Alerts: [Email]
- User Support: [Email]

---

## 🎉 Success Criteria

**Application is production-ready when:**
- ✅ All P0 tests passed
- ✅ Zero critical bugs
- ✅ Performance metrics met
- ✅ Sentry monitoring active
- ✅ User acceptance complete
- ✅ App store approved

**Target:** World-class disaster management application 🚀


