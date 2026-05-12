Pod::Spec.new do |s|
  s.name           = 'AfetNetBlePeripheral'
  s.version        = '1.0.0'
  s.summary        = 'AfetNet BLE Peripheral GATT Server for offline mesh networking'
  s.description    = 'Native module providing CBPeripheralManager-based GATT server for BLE mesh communication'
  s.author         = 'AfetNet'
  s.homepage       = 'https://github.com/afetnet'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end
