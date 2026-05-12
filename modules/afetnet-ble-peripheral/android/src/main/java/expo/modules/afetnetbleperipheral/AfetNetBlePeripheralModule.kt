package expo.modules.afetnetbleperipheral

import android.Manifest
import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.ParcelUuid
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class AfetNetBlePeripheralModule : Module() {
  companion object {
    private const val TAG = "AfetNetBlePeripheral"
  }

  private var gattServer: BluetoothGattServer? = null
  private var advertiser: BluetoothLeAdvertiser? = null
  @Volatile private var isRunning = false
  @Volatile private var isAdvertising = false
  private var serviceUUID: UUID? = null
  private val characteristicMap: MutableMap<String, BluetoothGattCharacteristic> = ConcurrentHashMap()
  private val connectedDevices: MutableMap<String, BluetoothDevice> = ConcurrentHashMap()
  private var advertisementData: ByteArray? = null
  private var pendingServiceUUID: String? = null
  private var pendingCharUUIDs: List<String> = emptyList()
  private var btStateReceiver: BroadcastReceiver? = null
  private var serviceAdded = false

  // BLE state change receiver — detects Bluetooth toggle
  private fun createBtStateReceiver(): BroadcastReceiver {
    return object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != BluetoothAdapter.ACTION_STATE_CHANGED) return
        val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
        when (state) {
          BluetoothAdapter.STATE_OFF, BluetoothAdapter.STATE_TURNING_OFF -> {
            Log.w(TAG, "Bluetooth turning off — cleaning up GATT server")
            val wasRunning = isRunning
            isRunning = false
            isAdvertising = false
            connectedDevices.clear()
            // Don't close gattServer here — OS already invalidated it
            gattServer = null
            advertiser = null
            serviceAdded = false
            if (wasRunning) {
              try {
                sendEvent("onDeviceDisconnected", mapOf("deviceId" to "ALL", "reason" to "bt_off"))
              } catch (_: Exception) {}
            }
          }
          BluetoothAdapter.STATE_ON -> {
            Log.i(TAG, "Bluetooth turned back on")
            // If we were running before BT was toggled, attempt auto-restart
            if (pendingServiceUUID != null && pendingCharUUIDs.isNotEmpty()) {
              Log.i(TAG, "Auto-restarting GATT server after BT toggle")
              // CRITICAL: Set isRunning=false BEFORE clearing characteristicMap
              // to prevent notifyCharacteristic from reading stale/empty map during restart
              isRunning = false
              try {
                val ctx = appContext.reactContext ?: return
                val bluetoothManager = ctx.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager ?: return
                val adapter = bluetoothManager.adapter ?: return
                if (!adapter.isEnabled) return

                // Re-open GATT server
                gattServer = bluetoothManager.openGattServer(ctx, gattServerCallback)
                if (gattServer == null) {
                  Log.e(TAG, "Failed to re-open GATT server after BT toggle")
                  return
                }

                // Re-create service
                val service = createGattService() ?: return
                serviceAdded = false
                gattServer?.addService(service)

                // Re-start advertising
                advertiser = adapter.bluetoothLeAdvertiser
                if (advertiser != null) {
                  startAdvertisingInternal()
                }

                isRunning = true
                Log.i(TAG, "GATT server auto-restarted after BT toggle")
              } catch (e: Exception) {
                Log.e(TAG, "Failed to auto-restart after BT toggle: ${e.message}")
              }
            }
          }
        }
      }
    }
  }

  private val advertiseCallback = object : AdvertiseCallback() {
    override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
      Log.i(TAG, "Advertising started successfully")
      isAdvertising = true
    }
    override fun onStartFailure(errorCode: Int) {
      Log.e(TAG, "Advertising failed with error code: $errorCode")
      isAdvertising = false
      // Error code 3 = ADVERTISE_FAILED_ALREADY_STARTED — not a real failure
      if (errorCode != ADVERTISE_FAILED_ALREADY_STARTED) {
        Log.e(TAG, "Advertising truly failed — isRunning remains $isRunning but no advertising")
      }
    }
  }

  private val gattServerCallback = object : BluetoothGattServerCallback() {
    override fun onConnectionStateChange(device: BluetoothDevice, status: Int, newState: Int) {
      val deviceId = device.address
      if (newState == BluetoothProfile.STATE_CONNECTED) {
        connectedDevices[deviceId] = device
        try { sendEvent("onDeviceConnected", mapOf("deviceId" to deviceId)) } catch (_: Exception) {}
      } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
        connectedDevices.remove(deviceId)
        try { sendEvent("onDeviceDisconnected", mapOf("deviceId" to deviceId)) } catch (_: Exception) {}
      }
    }

    override fun onServiceAdded(status: Int, service: BluetoothGattService?) {
      if (status == BluetoothGatt.GATT_SUCCESS) {
        serviceAdded = true
        Log.i(TAG, "GATT service added successfully")
      } else {
        Log.e(TAG, "Failed to add GATT service, status: $status")
        serviceAdded = false
      }
    }

    override fun onNotificationSent(device: BluetoothDevice?, status: Int) {
      if (status != BluetoothGatt.GATT_SUCCESS) {
        Log.w(TAG, "Notification send failed for ${device?.address}, status: $status")
      }
    }

    override fun onCharacteristicWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      characteristic: BluetoothGattCharacteristic,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray?
    ) {
      val data = value
      if (data == null) {
        // CRITICAL: Must send response even for null value when responseNeeded=true,
        // otherwise remote GATT client hangs indefinitely waiting for response
        if (responseNeeded) {
          gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
        }
        return
      }

      // Track connected device
      val deviceId = device.address
      if (!connectedDevices.containsKey(deviceId)) {
        connectedDevices[deviceId] = device
        try { sendEvent("onDeviceConnected", mapOf("deviceId" to deviceId)) } catch (_: Exception) {}
      }

      // Send response if needed
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, null)
      }

      // Emit to JS
      val charUUID = characteristic.uuid.toString().lowercase()
      val hexData = data.toHexString()
      try {
        sendEvent("onWriteReceived", mapOf(
          "deviceId" to deviceId,
          "characteristicUUID" to charUUID,
          "data" to hexData
        ))
      } catch (_: Exception) {}
    }

    override fun onCharacteristicReadRequest(
      device: BluetoothDevice,
      requestId: Int,
      offset: Int,
      characteristic: BluetoothGattCharacteristic
    ) {
      gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, ByteArray(0))
    }

    override fun onDescriptorWriteRequest(
      device: BluetoothDevice,
      requestId: Int,
      descriptor: BluetoothGattDescriptor,
      preparedWrite: Boolean,
      responseNeeded: Boolean,
      offset: Int,
      value: ByteArray?
    ) {
      if (responseNeeded) {
        gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value)
      }
    }
  }

  private fun createGattService(): BluetoothGattService? {
    val svcUUID = serviceUUID ?: return null
    val service = BluetoothGattService(svcUUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
    characteristicMap.clear()

    for (uuidStr in pendingCharUUIDs) {
      val charUUID = UUID.fromString(uuidStr)
      val characteristic = BluetoothGattCharacteristic(
        charUUID,
        BluetoothGattCharacteristic.PROPERTY_WRITE or
          BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE or
          BluetoothGattCharacteristic.PROPERTY_NOTIFY or
          BluetoothGattCharacteristic.PROPERTY_READ,
        BluetoothGattCharacteristic.PERMISSION_WRITE or
          BluetoothGattCharacteristic.PERMISSION_READ
      )
      val cccd = BluetoothGattDescriptor(
        UUID.fromString("00002902-0000-1000-8000-00805f9b34fb"),
        BluetoothGattDescriptor.PERMISSION_WRITE or BluetoothGattDescriptor.PERMISSION_READ
      )
      characteristic.addDescriptor(cccd)
      service.addCharacteristic(characteristic)
      characteristicMap[uuidStr.lowercase()] = characteristic
    }

    return service
  }

  private fun startAdvertisingInternal() {
    val svcUUID = serviceUUID ?: return
    val adv = advertiser ?: return

    val settings = AdvertiseSettings.Builder()
      .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
      .setConnectable(true)
      .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
      .setTimeout(0)
      .build()

    val dataBuilder = AdvertiseData.Builder()
      .setIncludeDeviceName(false)
      .addServiceUuid(ParcelUuid(svcUUID))

    advertisementData?.let { data ->
      if (data.isNotEmpty()) {
        dataBuilder.addServiceData(ParcelUuid(svcUUID), data)
      }
    }

    adv.startAdvertising(settings, dataBuilder.build(), advertiseCallback)
  }

  private fun registerBtStateReceiver() {
    if (btStateReceiver != null) return
    val context = appContext.reactContext ?: return
    val receiver = createBtStateReceiver()
    btStateReceiver = receiver
    val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
    } else {
      context.registerReceiver(receiver, filter)
    }
  }

  private fun unregisterBtStateReceiver() {
    val context = appContext.reactContext ?: return
    btStateReceiver?.let {
      try { context.unregisterReceiver(it) } catch (_: Exception) {}
    }
    btStateReceiver = null
  }

  override fun definition() = ModuleDefinition {
    Name("AfetNetBlePeripheral")

    Events("onWriteReceived", "onDeviceConnected", "onDeviceDisconnected")

    AsyncFunction("startPeripheral") { serviceUUIDStr: String, charUUIDs: List<String>, promise: Promise ->
      if (isRunning) {
        promise.resolve(null)
        return@AsyncFunction
      }

      val context = appContext.reactContext ?: run {
        promise.reject("NO_CONTEXT", "React context not available", null)
        return@AsyncFunction
      }

      if (!hasBluetoothPermissions(context)) {
        promise.reject("NO_PERMISSION", "Bluetooth permissions not granted", null)
        return@AsyncFunction
      }

      val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
      val adapter = bluetoothManager?.adapter

      if (adapter == null || !adapter.isEnabled) {
        promise.reject("BLE_UNAVAILABLE", "Bluetooth adapter not available or disabled", null)
        return@AsyncFunction
      }

      serviceUUID = UUID.fromString(serviceUUIDStr)
      pendingServiceUUID = serviceUUIDStr
      pendingCharUUIDs = charUUIDs

      // Register BT state change receiver
      registerBtStateReceiver()

      // Setup GATT Server
      gattServer = bluetoothManager.openGattServer(context, gattServerCallback)
      if (gattServer == null) {
        promise.reject("GATT_FAILED", "Failed to open GATT server", null)
        return@AsyncFunction
      }

      // Create and add service
      val service = createGattService()
      if (service == null) {
        promise.reject("SERVICE_FAILED", "Failed to create GATT service", null)
        return@AsyncFunction
      }
      serviceAdded = false
      gattServer?.addService(service)

      // Start advertising
      advertiser = adapter.bluetoothLeAdvertiser
      if (advertiser == null) {
        promise.reject("ADV_UNAVAILABLE", "BLE Advertiser not available on this device", null)
        return@AsyncFunction
      }

      startAdvertisingInternal()

      isRunning = true
      promise.resolve(null)
    }

    AsyncFunction("stopPeripheral") { promise: Promise ->
      try {
        advertiser?.stopAdvertising(advertiseCallback)
      } catch (e: Exception) {
        Log.w(TAG, "stopAdvertising error: ${e.message}")
      }

      try {
        gattServer?.clearServices()
        gattServer?.close()
      } catch (e: Exception) {
        Log.w(TAG, "GATT server cleanup error: ${e.message}")
      }

      gattServer = null
      advertiser = null
      characteristicMap.clear()
      connectedDevices.clear()
      isRunning = false
      isAdvertising = false
      serviceAdded = false

      unregisterBtStateReceiver()

      promise.resolve(null)
    }

    Function("isPeripheralRunning") {
      isRunning
    }

    Function("updateAdvertisementData") { hexData: String ->
      advertisementData = hexData.hexToByteArray()
      // Android requires stop+restart to update advertisement data
      if (isRunning && advertiser != null && serviceUUID != null) {
        try {
          advertiser?.stopAdvertising(advertiseCallback)
          isAdvertising = false
        } catch (_: Exception) {}

        startAdvertisingInternal()
      }
    }

    Function("notifyCharacteristic") { characteristicUUID: String, hexData: String ->
      if (!isRunning) return@Function // Guard: skip during BT restart to avoid stale characteristicMap
      val uuid = characteristicUUID.lowercase()
      val characteristic = characteristicMap[uuid] ?: return@Function
      val data = hexData.hexToByteArray() ?: return@Function
      val server = gattServer ?: return@Function

      // Send to each connected device
      for ((_, device) in connectedDevices) {
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // API 33+: use non-deprecated overload with data parameter
            server.notifyCharacteristicChanged(device, characteristic, false, data)
          } else {
            // Pre-API 33: set value then notify
            @Suppress("DEPRECATION")
            synchronized(characteristic) {
              characteristic.value = data
              server.notifyCharacteristicChanged(device, characteristic, false)
            }
          }
        } catch (e: Exception) {
          Log.w(TAG, "Failed to notify device ${device.address}: ${e.message}")
        }
      }
    }

    Function("getConnectedDeviceCount") {
      connectedDevices.size
    }
  }

  private fun hasBluetoothPermissions(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      return ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
        ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
    }
    return true // Pre-Android 12 doesn't need runtime BLE permissions
  }

  private fun ByteArray.toHexString(): String = joinToString("") { "%02x".format(it) }

  private fun String.hexToByteArray(): ByteArray? {
    if (length % 2 != 0) return null
    return try {
      ByteArray(length / 2) { i ->
        substring(i * 2, i * 2 + 2).toInt(16).toByte()
      }
    } catch (_: NumberFormatException) {
      null
    }
  }
}
