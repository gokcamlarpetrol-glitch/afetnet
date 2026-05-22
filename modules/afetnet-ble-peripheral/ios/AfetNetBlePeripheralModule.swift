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

// SOS ve acil durum mesajlarının silinmemesi için öncelik işaretçisi
private struct PendingNotification {
  let data: Data
  let characteristic: CBMutableCharacteristic
  let timestamp: Date
  let isHighPriority: Bool  // SOS/kritik paketler true — eviction'da korunur
}

// SOS characteristic UUID — düşük öncelikli paket eviction kararı için referans
private let SOSCharacteristicUUID = "00000004-0000-1000-8000-00805f9b34fb"

// MARK: - Expo Module

public class AfetNetBlePeripheralModule: Module {
  // BLE callback'leri için dedicated queue — main thread'den bağımsız çalışır,
  // yoğun SOS trafiğinde UI gecikmesi yaşanmaz
  private let bleQueue = DispatchQueue(label: "com.afetnet.ble.peripheral", qos: .userInitiated)
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
  // SOS karakteristik UUID'si — JS tarafından startPeripheral'da geçilir (tek
  // kaynak: constants.ts → AFETNET_CHAR_SOS_UUID). Varsayılan, JS hiç geçmezse
  // diye güvenli fallback'tir. queuePendingNotification eviction kararında kullanılır.
  private var activeSosCharUUID: String = SOSCharacteristicUUID

  public func definition() -> ModuleDefinition {
    Name("AfetNetBlePeripheral")

    Events("onWriteReceived", "onDeviceConnected", "onDeviceDisconnected")

    OnCreate {
      self.peripheralDelegate.module = self
    }

    AsyncFunction("startPeripheral") { (serviceUUID: String, characteristicUUIDs: [String], sosCharacteristicUUID: String, promise: Promise) in
      // THREAD-SAFETY (görev #7): Tüm paylaşılan durum (isRunning, pendingStartPromise,
      // peripheralManager, characteristics, gattService, pendingNotifications...)
      // yalnızca bleQueue üzerinde okunur/yazılır. CBPeripheralManager delegate
      // callback'leri zaten bleQueue'da çalışıyor; Expo fonksiyon gövdeleri de
      // bleQueue'ya alınarak tek seri senkronizasyon alanı sağlanır — aksi halde
      // JS thread ↔ bleQueue arasında veri yarışı (Array/Dictionary çökmesi).
      self.bleQueue.async {
        // görev #8: SOS karakteristik UUID'sini JS'ten al — Swift'te hardcode
        // değil, constants.ts tek kaynak. Sürümler arası sapma riski ortadan kalkar.
        self.activeSosCharUUID = sosCharacteristicUUID.lowercased()

        guard !self.isRunning else {
          promise.resolve(nil)
          return
        }

        // K9: If a previous start is still pending (waiting for BT power-on),
        // REJECT it. Previous code resolved with nil — JS side saw "start success"
        // for a call that was actually superseded. Reject matches stopPeripheral
        // semantics and lets the JS side fall back / retry correctly.
        if let pending = self.pendingStartPromise {
          pending.reject("CANCELLED", "Superseded by new startPeripheral call")
        }

        self.pendingServiceUUID = serviceUUID
        self.pendingCharUUIDs = characteristicUUIDs
        self.pendingStartPromise = promise

        if self.peripheralManager == nil {
          // bleQueue: UI thread'den bağımsız dedicated BLE kuyruğu
          self.peripheralManager = CBPeripheralManager(delegate: self.peripheralDelegate, queue: self.bleQueue)
        } else if self.peripheralManager?.state == .poweredOn {
          self.setupGATTService()
          self.startAdvertising()
          self.isRunning = true
          self.pendingStartPromise?.resolve(nil)
          self.pendingStartPromise = nil
        }
        // else: wait for peripheralManagerDidUpdateState callback
      }
    }

    AsyncFunction("stopPeripheral") { (promise: Promise) in
      // THREAD-SAFETY (görev #7): teardown bleQueue üzerinde yapılır — delegate
      // callback'leriyle (retryPendingNotifications vb.) aynı seri alanda, böylece
      // pendingNotifications/subscribedCentrals eşzamanlı mutasyonu engellenir.
      self.bleQueue.async {
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
    }

    Function("isPeripheralRunning") { () -> Bool in
      // THREAD-SAFETY (görev #7): isRunning'i bleQueue üzerinden oku.
      return self.bleQueue.sync { self.isRunning }
    }

    Function("updateAdvertisementData") { (hexData: String) in
      // THREAD-SAFETY (görev #7): paylaşılan durum bleQueue üzerinde.
      self.bleQueue.async {
        self.advertisementData = Self.hexToData(hexData)
        if self.isRunning {
          self.peripheralManager?.stopAdvertising()
          self.startAdvertising()
        }
      }
    }

    Function("notifyCharacteristic") { (characteristicUUID: String, hexData: String) in
      // THREAD-SAFETY (görev #7): characteristics sözlüğü ve pendingNotifications
      // bleQueue üzerinde — retryPendingNotifications ile aynı seri alanda.
      self.bleQueue.async {
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
    }

    Function("getConnectedDeviceCount") { () -> Int in
      // THREAD-SAFETY (görev #7): connectedCentralIds'i bleQueue üzerinden oku.
      // Return count of ALL connected centrals (including write-only clients)
      return self.bleQueue.sync { self.connectedCentralIds.count }
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
    // SOS karakteristiğine ait paketler yüksek önceliklidir — eviction'dan korunur.
    // görev #8: hardcoded sabit yerine JS'ten geçilen activeSosCharUUID kullanılır.
    let isSOS = characteristic.uuid.uuidString.lowercased() == activeSosCharUUID
    let notification = PendingNotification(
      data: data,
      characteristic: characteristic,
      timestamp: Date(),
      isHighPriority: isSOS
    )
    pendingNotifications.append(notification)

    // 30 saniyeden eski girdileri temizle — ANCAK yüksek öncelikli (SOS) paketler
    // KORUNUR. KRİTİK (görev #8): Önceki kod yaş filtresini KOŞULSUZ uyguluyordu;
    // BLE iletim kuyruğu 30 sn+ tıkanırsa (afet sonrası yoğun trafikte fazlasıyla
    // olası) mahsur kullanıcının SOS bildirimi de siliniyordu — v1.6.3'ün "SOS
    // paketi düşürülemez" garantisi deliniyordu. SOS paketleri yaşına bakılmaksızın
    // kuyrukta kalır; yalnız düşük öncelikli paketler 30 sn sonra düşer.
    let cutoff = Date().addingTimeInterval(-30)
    pendingNotifications = pendingNotifications.filter { $0.isHighPriority || $0.timestamp > cutoff }

    // Kuyruk doluysa: önce düşük öncelikli paketi at, yoksa en eskiyi at
    // SOS paketleri asla öncelik sırası dışında silinmez
    if pendingNotifications.count > maxPendingNotifications {
      if let lowPriorityIndex = pendingNotifications.firstIndex(where: { !$0.isHighPriority }) {
        NSLog("[AfetNetBlePeripheral] Kuyruk dolu — düşük öncelikli paket silindi (SOS korundu)")
        pendingNotifications.remove(at: lowPriorityIndex)
      } else {
        // Tüm paketler yüksek öncelikli — en eskiyi at (son çare)
        NSLog("[AfetNetBlePeripheral] Kuyruk dolu — tüm paketler yüksek öncelikli, en eski silindi")
        pendingNotifications.removeFirst()
      }
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
