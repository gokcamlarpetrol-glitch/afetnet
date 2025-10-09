# AfetNet OffMesh Test Plan

## Overview
This document outlines the testing procedures for the AfetNet offline mesh networking system. The mesh enables device-to-device communication without internet connectivity, critical for disaster scenarios.

## Test Environment Setup

### Prerequisites
- 2+ iOS devices (iPhone/iPad)
- 2+ Android devices (if available)
- Airplane mode capability
- AfetNet app installed on all devices
- Test area with 10-20m separation capability

### Test Configuration
- Enable airplane mode on all devices
- Ensure Bluetooth and Wi-Fi are enabled
- Start AfetNet app on all devices
- Verify mesh status shows "SEARCHING" or "ONLINE"

## Test Cases

### 1. Basic Device Discovery

#### iOS to iOS
**Objective**: Verify MultipeerConnectivity peer discovery
**Steps**:
1. Start AfetNet on Device A (iOS)
2. Start AfetNet on Device B (iOS)
3. Wait 30 seconds for discovery
4. Verify both devices show peer count > 0
5. Check diagnostics screen shows "mpeer" transport

**Expected Result**: 
- Both devices discover each other within 30 seconds
- Peer count shows 1 on each device
- Transport shows "mpeer:1"

#### Android to Android
**Objective**: Verify Wi-Fi Direct peer discovery
**Steps**:
1. Start AfetNet on Device A (Android)
2. Start AfetNet on Device B (Android)
3. Wait 30 seconds for discovery
4. Verify both devices show peer count > 0
5. Check diagnostics screen shows "wifi" transport

**Expected Result**:
- Both devices discover each other within 30 seconds
- Peer count shows 1 on each device
- Transport shows "wifi:1"

### 2. Message Transmission

#### Chat Message Test
**Objective**: Verify basic message delivery
**Steps**:
1. Establish peer connection (from Test 1)
2. Send chat message from Device A
3. Verify message received on Device B within 10 seconds
4. Check message content is correct
5. Verify message appears in diagnostics log

**Expected Result**:
- Message delivered within 10 seconds
- Content matches sent message
- Log shows "send" and "recv" events

#### SOS Message Test
**Objective**: Verify emergency message delivery
**Steps**:
1. Establish peer connection
2. Send SOS message from Device A
3. Verify message received on Device B within 5 seconds
4. Check SOS message contains location data
5. Verify rate limiting (max 1 SOS per minute)

**Expected Result**:
- SOS delivered within 5 seconds
- Location data present and accurate
- Rate limiting prevents spam

### 3. Multi-Hop Routing

#### 3-Device Chain Test
**Objective**: Verify message forwarding through intermediate nodes
**Steps**:
1. Position 3 devices in line: A - B - C (10m apart)
2. Ensure A can reach B, B can reach C, but A cannot reach C directly
3. Send message from A to C
4. Verify message reaches C through B
5. Check hop count increments (hop: 0 → 1 → 2)

**Expected Result**:
- Message reaches C within 20 seconds
- Hop count shows 2 on final message
- B acts as relay node

### 4. Network Resilience

#### Connection Recovery Test
**Objective**: Verify automatic reconnection after temporary disconnection
**Steps**:
1. Establish peer connection
2. Move devices 20m apart (out of range)
3. Wait 30 seconds
4. Move devices back within range
5. Verify connection re-establishes within 60 seconds

**Expected Result**:
- Connection lost when out of range
- Connection re-established when back in range
- No manual intervention required

#### Battery Low Test
**Objective**: Verify graceful degradation under low battery
**Steps**:
1. Establish peer connection
2. Simulate low battery (< 10%)
3. Verify mesh switches to "discovery only" mode
4. Check SOS messages still work
5. Verify chat messages are rate-limited

**Expected Result**:
- Mesh status shows "OFFLINE" or "SEARCHING"
- SOS messages still deliver
- Chat messages blocked or heavily rate-limited

### 5. Cross-Platform Compatibility

#### iOS to Android Test
**Objective**: Verify BLE beacon communication between platforms
**Steps**:
1. Start AfetNet on iOS device
2. Start AfetNet on Android device
3. Wait 60 seconds for discovery
4. Check if BLE beacon is detected
5. Verify SOS beacon functionality

**Expected Result**:
- BLE beacon detected (may take longer)
- SOS beacon works across platforms
- Full mesh may not be available (expected limitation)

### 6. Performance and Limits

#### Rate Limiting Test
**Objective**: Verify message rate limits are enforced
**Steps**:
1. Establish peer connection
2. Send 15 chat messages rapidly
3. Verify only 10 messages are sent (rate limit)
4. Wait 1 minute
5. Verify rate limit resets

**Expected Result**:
- Only 10 messages sent in first minute
- Remaining messages queued
- Rate limit resets after 1 minute

#### Queue Management Test
**Objective**: Verify message queue handling
**Steps**:
1. Establish peer connection
2. Send 50 messages rapidly
3. Verify queue size limits (max 200)
4. Check oldest message age
5. Verify queue processing

**Expected Result**:
- Queue size stays under 200
- Oldest messages processed first
- No message loss due to queue overflow

### 7. Diagnostics and Monitoring

#### Diagnostics Screen Test
**Objective**: Verify diagnostics information is accurate
**Steps**:
1. Access diagnostics screen (5x logo tap)
2. Verify peer information is displayed
3. Check queue depth and age
4. Review recent events log
5. Test log export functionality

**Expected Result**:
- All information displays correctly
- Log export generates valid JSON
- Real-time updates work

#### Error Handling Test
**Objective**: Verify graceful error handling
**Steps**:
1. Force transport errors (disable Bluetooth/Wi-Fi)
2. Verify error events are logged
3. Check UI doesn't crash
4. Verify recovery when services restored

**Expected Result**:
- Errors logged in diagnostics
- UI remains stable
- Automatic recovery when possible

## Test Results Template

### Device Information
- Device A: [Model, OS Version, App Version]
- Device B: [Model, OS Version, App Version]
- Test Date: [Date]
- Test Duration: [Duration]

### Test Results
| Test Case | Status | Notes |
|-----------|--------|-------|
| iOS Discovery | ✅/❌ | [Notes] |
| Android Discovery | ✅/❌ | [Notes] |
| Chat Message | ✅/❌ | [Notes] |
| SOS Message | ✅/❌ | [Notes] |
| Multi-Hop | ✅/❌ | [Notes] |
| Connection Recovery | ✅/❌ | [Notes] |
| Battery Low | ✅/❌ | [Notes] |
| Cross-Platform | ✅/❌ | [Notes] |
| Rate Limiting | ✅/❌ | [Notes] |
| Queue Management | ✅/❌ | [Notes] |
| Diagnostics | ✅/❌ | [Notes] |
| Error Handling | ✅/❌ | [Notes] |

### Issues Found
- [List any issues encountered]
- [Include error messages or logs]
- [Note any workarounds]

### Recommendations
- [Suggestions for improvement]
- [Additional test cases needed]
- [Performance optimizations]

## Known Limitations

### Cross-Platform
- iOS and Android cannot form full mesh networks
- BLE beacon communication is limited
- SOS beacon works across platforms

### Performance
- Message delivery not guaranteed (best effort)
- Network topology affects delivery success
- Battery usage increases with mesh activity

### Security
- Messages are signed but not encrypted by default
- Admin key required for encryption
- No authentication of message sources

## Troubleshooting

### Common Issues
1. **No peer discovery**: Check Bluetooth/Wi-Fi enabled, restart app
2. **Message not delivered**: Check TTL, hop count, network topology
3. **High battery usage**: Reduce mesh activity, check battery settings
4. **Diagnostics not updating**: Restart app, check permissions

### Debug Steps
1. Enable diagnostics screen
2. Check transport status
3. Review recent events log
4. Export log for analysis
5. Test with different devices

## Success Criteria

### Minimum Requirements
- ✅ Peer discovery within 30 seconds
- ✅ Message delivery within 10 seconds (direct)
- ✅ SOS message delivery within 5 seconds
- ✅ Automatic reconnection after disconnection
- ✅ Graceful degradation under low battery
- ✅ No app crashes during testing

### Performance Targets
- ✅ 95% message delivery success rate
- ✅ < 5% battery drain per hour
- ✅ < 100ms message processing time
- ✅ Support for 8+ hop routing
- ✅ Handle 200+ queued messages

## Conclusion

This test plan ensures the AfetNet offline mesh system meets the requirements for disaster communication scenarios. Regular testing should be performed to maintain system reliability and performance.



