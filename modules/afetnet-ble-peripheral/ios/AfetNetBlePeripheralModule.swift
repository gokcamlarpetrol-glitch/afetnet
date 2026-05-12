import ExpoModulesCore
import CoreBluetooth

// MARK: - Peripheral Delegate (NSObject required for CBPeripheralManagerDelegate)

private class PeripheralDelegate: NSObject, CBPeripheralManagerDelegate {
  weak var module: AfetNetBlePeripheralModule?

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    module?.handleStateUpdate(peripheral)
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
    if let error = error {
      NSLog("[AfetNetBlePeripheral] Failed to add service: \(error.localizedDescription)")
    } else {
      NSLog("[AfetNetBlePeripheral] GATT service added successfully")
    }
  }

  func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
    if let error = error {
      NSLog("[AfetNetBlePeripheral] Advertising failed: \(error.localizedDescription)")
    }
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
    module?.handleSubscribe(central: central)
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
    module?.handleUnsubscribe(central: central)
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
    module?.handleWriteRequests(peripheral: peripheral, requests: requests)
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
    request.value = Data()
    peripheral.respond(to: request, withResult: .success)
  }

  // Called when BLE transmit queue has space after updateValue returned false
  func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) {
    module?.retryPendingNotifications()
  }
}

// MARK: - Pending Notification

private struct PendingNotification {
  let data: Data
  let characteristic: CBMutableCharacteristic
  let timestamp: Date
}

// MARK: - Expo Module

public class AfetNetBlePeripheralModule: Module {
  private var peripheralManager: CBPeripheralManager?
  private let peripheralDelegate = PeripheralDelegate()
  private var gattService: CBMutableService?
  private var characteristics: [String: CBMutableCharacteristic] = [:]
  // Only track SUBSCRIBED centrals (those that wrote to CCCD for notifications)
  private var subscribedCentrals: [UUID: CBCentral] = [:]
  // Track ALL connected centrals (write-only + subscribed)
  private var connectedCentralIds: Set<UUID> = []
  private var isRunning = false
  private var pendingServiceUUID: String?
  private var pendingCharUUIDs: [String] = []
  private var advertisementData: Data?
  private var pendingStartPromise: Promise?
  // Queue for notifications that failed due to BLE queue pressure
  private var pendingNotifications: [PendingNotification] = []
  private let maxPendingNotifications = 50

  public func definition() -> ModuleDefinition {
    Name("AfetNetBlePeripheral")

    Events("onWriteReceived", "onDeviceConnected", "onDeviceDisconnected")

    OnCreate {
      self.peripheralDelegate.module = self
    }

    AsyncFunction("startPeripheral") { (serviceUUID: String, characteristicUUIDs: [String], promise: Promise) in
      guard !self.isRunning else {
        promise.resolve(nil)
        return
      }

      // CRITICAL FIX: If a previous start is pending (waiting for BT power-on),
      // reject the new call to prevent the first promise from hanging forever.
      if let pending = self.pendingStartPromise {
        pending.resolve(nil) // Resolve previous (best effort)
      }

      self.pendingServiceUUID = serviceUUID
      self.pendingCharUUIDs = characteristicUUIDs
      self.pendingStartPromise = promise

      if self.peripheralManager == nil {
        self.peripheralManager = CBPeripheralManager(delegate: self.peripheralDelegate, queue: DispatchQueue.main)
      } else if self.peripheralManager?.state == .poweredOn {
        self.setupGATTService()
        self.startAdvertising()
        self.isRunning = true
        self.pendingStartPromise?.resolve(nil)
        self.pendingStartPromise = nil
      }
      // else: wait for peripheralManagerDidUpdateState callback
    }

    AsyncFunction("stopPeripheral") { (promise: Promise) in
      self.peripheralManager?.stopAdvertising()
      if let service = self.gattService {
        self.peripheralManager?.remove(service)
      }
      self.characteristics.removeAll()
      self.subscribedCentrals.removeAll()
      self.connectedCentralIds.removeAll()
      self.pendingNotifications.removeAll()
      self.gattService = nil
      self.isRunning = false
      // CRITICAL: Cancel pending start promise to prevent JS-side await hanging forever
      if let startPromise = self.pendingStartPromise {
        startPromise.reject("CANCELLED", "Peripheral stopped before start completed")
        self.pendingStartPromise = nil
      }
      promise.resolve(nil)
    }

    Function("isPeripheralRunning") { () -> Bool in
      return self.isRunning
    }

    Function("updateAdvertisementData") { (hexData: String) in
      self.advertisementData = Self.hexToData(hexData)
      if self.isRunning {
        self.peripheralManager?.stopAdvertising()
        self.startAdvertising()
      }
    }

    Function("notifyCharacteristic") { (characteristicUUID: String, hexData: String) in
      let uuid = characteristicUUID.lowercased()
      guard let characteristic = self.characteristics[uuid],
            let data = Self.hexToData(hexData) else { return }

      // updateValue returns false if BLE queue is full
      let success = self.peripheralManager?.updateValue(data, for: characteristic, onSubscribedCentrals: nil) ?? false
      if !success {
        // Queue for retry when peripheralManagerIsReadyToUpdateSubscribers fires
        NSLog("[AfetNetBlePeripheral] updateValue returned false — queuing for retry")
        self.queuePendingNotification(data: data, characteristic: characteristic)
      }
    }

    Function("getConnectedDeviceCount") { () -> Int in
      // Return count of ALL connected centrals (including write-only clients)
      return self.connectedCentralIds.count
    }
  }

  // MARK: - GATT Service Setup

  private func setupGATTService() {
    guard let serviceUUIDStr = pendingServiceUUID else { return }

    // Remove old service first to prevent duplicates on BT toggle
    if let oldService = self.gattService {
      self.peripheralManager?.remove(oldService)
      self.gattService = nil
    }

    let serviceUUID = CBUUID(string: serviceUUIDStr)
    let service = CBMutableService(type: serviceUUID, primary: true)

    var chars: [CBMutableCharacteristic] = []
    self.characteristics.removeAll()

    for uuidStr in pendingCharUUIDs {
      let charUUID = CBUUID(string: uuidStr)
      let characteristic = CBMutableCharacteristic(
        type: charUUID,
        properties: [.write, .writeWithoutResponse, .notify, .read],
        value: nil,
        permissions: [.writeable, .readable]
      )
      chars.append(characteristic)
      self.characteristics[uuidStr.lowercased()] = characteristic
    }

    service.characteristics = chars
    self.gattService = service
    self.peripheralManager?.add(service)
  }

  // MARK: - Advertising

  private func startAdvertising() {
    guard let serviceUUIDStr = pendingServiceUUID else { return }
    let serviceUUID = CBUUID(string: serviceUUIDStr)

    let advertisementDict: [String: Any] = [
      CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
      CBAdvertisementDataLocalNameKey: "AfetNet",
    ]

    self.peripheralManager?.startAdvertising(advertisementDict)
  }

  // MARK: - Pending Notification Queue

  private func queuePendingNotification(data: Data, characteristic: CBMutableCharacteristic) {
    let notification = PendingNotification(data: data, characteristic: characteristic, timestamp: Date())
    pendingNotifications.append(notification)

    // Evict old entries (keep most recent, drop notifications older than 30s)
    let cutoff = Date().addingTimeInterval(-30)
    pendingNotifications = pendingNotifications.filter { $0.timestamp > cutoff }
    if pendingNotifications.count > maxPendingNotifications {
      pendingNotifications = Array(pendingNotifications.suffix(maxPendingNotifications))
    }
  }

  func retryPendingNotifications() {
    guard !pendingNotifications.isEmpty else { return }
    NSLog("[AfetNetBlePeripheral] Retrying \(pendingNotifications.count) pending notifications")

    var remaining: [PendingNotification] = []
    for (index, notification) in pendingNotifications.enumerated() {
      let success = peripheralManager?.updateValue(
        notification.data,
        for: notification.characteristic,
        onSubscribedCentrals: nil
      ) ?? false

      if !success {
        // Queue is full again — keep this and ALL remaining for next retry
        // Once updateValue returns false, all subsequent calls will also fail
        remaining.append(contentsOf: pendingNotifications[index...])
        break
      }
    }

    // Keep only notifications that still haven't been sent
    pendingNotifications = remaining
    if !remaining.isEmpty {
      NSLog("[AfetNetBlePeripheral] \(remaining.count) notifications still pending")
    }
  }

  // MARK: - Delegate Handlers (called by PeripheralDelegate)

  func handleStateUpdate(_ peripheral: CBPeripheralManager) {
    if peripheral.state == .poweredOn {
      if pendingStartPromise != nil {
        setupGATTService()
        startAdvertising()
        isRunning = true
        pendingStartPromise?.resolve(nil)
        pendingStartPromise = nil
      } else if isRunning {
        // Bluetooth was turned back on while running — resume
        setupGATTService()
        startAdvertising()
      }
    } else {
      // Handle ALL non-poweredOn states: poweredOff, unauthorized, resetting, unsupported, unknown
      let wasRunning = isRunning
      isRunning = false
      subscribedCentrals.removeAll()
      connectedCentralIds.removeAll()
      pendingNotifications.removeAll()

      if let promise = pendingStartPromise {
        promise.reject("BLE_UNAVAILABLE", "Bluetooth is not available (state: \(peripheral.state.rawValue))")
        pendingStartPromise = nil
      }

      if wasRunning {
        NSLog("[AfetNetBlePeripheral] BLE state changed to \(peripheral.state.rawValue) — peripheral stopped")
      }
    }
  }

  func handleSubscribe(central: CBCentral) {
    subscribedCentrals[central.identifier] = central
    let isNew = !connectedCentralIds.contains(central.identifier)
    connectedCentralIds.insert(central.identifier)
    if isNew {
      sendEvent("onDeviceConnected", [
        "deviceId": central.identifier.uuidString
      ])
    }
  }

  func handleUnsubscribe(central: CBCentral) {
    subscribedCentrals.removeValue(forKey: central.identifier)
    // Don't remove from connectedCentralIds — central may still be connected for writes
    sendEvent("onDeviceDisconnected", [
      "deviceId": central.identifier.uuidString
    ])
  }

  func handleWriteRequests(peripheral: CBPeripheralManager, requests: [CBATTRequest]) {
    guard !requests.isEmpty else { return }

    for request in requests {
      guard let data = request.value else { continue }

      let charUUID = request.characteristic.uuid.uuidString.lowercased()
      let deviceId = request.central.identifier.uuidString
      let hexData = Self.dataToHex(data)

      // Track connected central
      let isNew = !connectedCentralIds.contains(request.central.identifier)
      connectedCentralIds.insert(request.central.identifier)
      if isNew {
        sendEvent("onDeviceConnected", [
          "deviceId": deviceId
        ])
      }

      sendEvent("onWriteReceived", [
        "deviceId": deviceId,
        "characteristicUUID": charUUID,
        "data": hexData,
      ])
    }

    // Per Apple docs: respond to the FIRST request exactly once per didReceiveWrite call
    peripheral.respond(to: requests[0], withResult: .success)
  }

  // MARK: - Hex Utilities

  private static func hexToData(_ hex: String) -> Data? {
    guard hex.count % 2 == 0 else { return nil }
    var data = Data(capacity: hex.count / 2)
    var index = hex.startIndex
    while index < hex.endIndex {
      let nextIndex = hex.index(index, offsetBy: 2)
      guard let byte = UInt8(hex[index..<nextIndex], radix: 16) else { return nil }
      data.append(byte)
      index = nextIndex
    }
    return data
  }

  private static func dataToHex(_ data: Data) -> String {
    return data.map { String(format: "%02x", $0) }.joined()
  }
}
