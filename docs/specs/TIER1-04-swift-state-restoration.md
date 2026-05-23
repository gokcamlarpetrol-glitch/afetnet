# TIER1 #4 — Swift CBCentralManager state restoration (killed-app SOS reception)

> **Risk**: HAYATİ KRİTİK (killed app → mesh SOS sessizce kaybolur, pazarlama "tam offline" yanlış)
> **Effort**: L (3-5 days + device test)
> **Faz**: v1.6.4 Hafta 2

## Root cause

Apple Core Bluetooth state restoration **opt-in**. Killed app + nearby peer advertises AfetNet UUID → iOS drops packet because no app registered for restoration.

Mevcut kod (`AfetNetBlePeripheralModule.swift:136`):
```swift
self.peripheralManager = CBPeripheralManager(delegate: self.peripheralDelegate, queue: self.bleQueue)
```
**No `CBPeripheralManagerOptionRestoreIdentifierKey`** → no restoration registry → killed app unreachable.

Central side: `react-native-ble-plx` `BleManager` is also without restore identifier (no JS API exposes it). Native shim needed.

## Architecture — native restoration shim + module options

**Component A** — `ios/AfetNetAcilletiim/AfetNetBLERestoreCoordinator.swift` (NEW):
- Singleton owns `CBCentralManager(options: [CBCentralManagerOptionRestoreIdentifierKey: "AfetNetCentral"])`
- Implements `centralManager(_:willRestoreState:)` — captures restored peripherals
- Posts `NSNotification "AfetNetBLERestorationDidComplete"`
- No React Native imports (init order safety)

**Component B** — `AppDelegate.swift` (modify):
- Add `application(_:willFinishLaunchingWithOptions:)` → `AfetNetBLERestoreCoordinator.shared.prepare()`
- CRITICAL: Apple requires `CBCentralManager` with restore ID created BEFORE `didFinishLaunchingWithOptions` returns when launch reason is BLE restoration

**Component C** — `AfetNetBlePeripheralModule.swift` (modify):
- Line 136: Add `options: [CBPeripheralManagerOptionRestoreIdentifierKey: "AfetNetPeripheral"]`
- PeripheralDelegate: add `peripheralManager(_:willRestoreState:)` → calls module `handleRestoredState(services:)`
- New method `handleRestoredState`: re-maps restored characteristics, sets `isRunning=true`, sends event `"onStateRestored"`
- Add `"onStateRestored"` to Events declaration

**Component D** — `MeshNetworkService.ts` (modify):
- In `startRealBLE()`: subscribe to `AfetNetPeripheral.addListener('onStateRestored')` → bootstrap SOS handler even before full app init

## Data flow — restoration launch

1. iOS kills app. BLE UUID in restoration registry.
2. Peer advertises same UUID.
3. iOS relaunches in background with `UIApplicationLaunchOptionsBluetoothCentralsKey`.
4. `willFinishLaunchingWithOptions` → `AfetNetBLERestoreCoordinator.shared.prepare()` creates CBCentralManager (BEFORE didFinish returns)
5. `didFinishLaunchingWithOptions` → RN bridge starts loading
6. CoreBluetooth calls `centralManager(_:willRestoreState:)` → coordinator posts notification
7. Parallel: `CBPeripheralManager willRestoreState` → module `handleRestoredState` → `sendEvent("onStateRestored")`
8. RN bridge ready → JS receives event → `MeshNetworkService.initialize()` + `startRealBLE()`
9. BLE scanner reconnects → SOS packet received → `processIncomingPacket` → notification
10. iOS gives ~30s background execution; extend via `beginBackgroundTask` if needed

## Apple's documented limits

- 30s execution window post-restoration (extend via `beginBackgroundTask`)
- ONLY system-initiated kills trigger restoration (user force-quit explicitly disables)
- `willRestoreState` fires BEFORE `centralManagerDidUpdateState`
- Background advertisement: local name + non-overflow service UUIDs stripped
- Multiple managers OK with distinct restore identifiers

## File-by-file changes

| File | Change |
|---|---|
| `ios/AfetNetAcilletiim/AfetNetBLERestoreCoordinator.swift` (NEW) | Full implementation (Component A above) |
| `ios/AfetNetAcilletiim/AppDelegate.swift` | Add `willFinishLaunchingWithOptions` calling `AfetNetBLERestoreCoordinator.shared.prepare()` |
| `modules/afetnet-ble-peripheral/ios/AfetNetBlePeripheralModule.swift:99` | Add `"onStateRestored"` to Events |
| `AfetNetBlePeripheralModule.swift:136` | Add `options: [CBPeripheralManagerOptionRestoreIdentifierKey: "AfetNetPeripheral"]` |
| `AfetNetBlePeripheralModule.swift` (PeripheralDelegate) | Add `peripheralManager(_:willRestoreState:)` handler |
| `AfetNetBlePeripheralModule.swift` (module class) | Add `handleRestoredState(services:)` — remaps characteristics, sets isRunning=true |
| `src/core/services/mesh/MeshNetworkService.ts:startRealBLE()` | Subscribe `AfetNetPeripheral.addListener('onStateRestored')` → bootstrap path |

## Testing plan

**Physical devices required** (simulator yok BLE):
1. EAS build + install on 2 phones via TestFlight dev
2. Device A: enable mesh, confirm advertising in Xcode Console
3. Device A: send to background, then trigger system-initiated kill (memory warning via Xcode Debug menu)
4. Device B: send mesh SOS
5. Device A: assert `[AfetNetRestore] willRestoreState` log in Console.app within 5s, then `MeshNetworkService bootstrap`, then notification on lock screen
6. Edge: airplane mode mid-restoration, both devices killed, no SOS within 30s timeout

## Acceptance criteria

- `centralManager(_:willRestoreState:)` log appears on restoration
- `onStateRestored` event fires in JS within 5s
- SOS notification on lock screen WITHOUT manual app open
- `UIBackgroundModes` still contains `bluetooth-central` + `bluetooth-peripheral` in built plist
- `npx tsc --noEmit` zero errors
- No crash on normal foreground launch (restoration code no-op when not restoration launch)

## Risk + rollback

**Risk**: User force-quit disables restoration (Apple policy — must document in onboarding). Dual `CBCentralManager` (native coordinator + JS BleManager) — mitigation: coordinator only for restoration detection, JS layer for scanning. EAS rebuild required; TestFlight rollout needed.

**Rollback**: Delete `AfetNetBLERestoreCoordinator.swift`, remove `willFinishLaunchingWithOptions`, revert module options. `onStateRestored` event becomes no-op in JS. No data loss.

**Rollout**: TestFlight internal (10 testers) → 100 external → full release. Gate on zero BLE init crash reports.

---
**Full agent spec transcript**: `/private/tmp/.../tasks/af106334c3d84946c.output`
