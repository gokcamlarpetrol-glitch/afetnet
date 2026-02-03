/**
 * BLE CONSTANTS - ELITE EDITION
 * Service and Characteristic UUIDs for AfetNet Mesh Network.
 */

// Primary AfetNet Service UUID
export const AFETNET_SERVICE_UUID = '00000001-0000-1000-8000-00805f9b34fb';

// Message Characteristic (for small messages and presence)
export const AFETNET_CHAR_MSG_UUID = '00000002-0000-1000-8000-00805f9b34fb';

// Chunk Characteristic (for large message transfers)
export const AFETNET_CHAR_CHUNK_UUID = '00000003-0000-1000-8000-00805f9b34fb';

// SOS Beacon Characteristic (high priority emergency)
export const AFETNET_CHAR_SOS_UUID = '00000004-0000-1000-8000-00805f9b34fb';

// Location Characteristic (GPS updates)
export const AFETNET_CHAR_LOCATION_UUID = '00000005-0000-1000-8000-00805f9b34fb';

// Manufacturer ID for advertising data
export const MANUFACTURER_ID = 0xAF07; // Custom AfetNet identifier (AF07 = AfetNet)

// BLE Limits
export const MAX_ADVERTISING_DATA = 27; // Bytes (31 - 4 header)
export const MAX_CHUNK_SIZE = 185; // Bytes per GATT write (MTU ~200 - overhead)
export const MAX_MANUFACTURER_DATA = 24; // Bytes in manufacturer data

// Timing
export const SCAN_DURATION_MS = 4000;
export const ADVERTISE_DURATION_MS = 2000;
export const CONNECTION_TIMEOUT_MS = 10000;

// Mesh Protocol
export const MESH_VERSION = 2;
export const MAX_HOP_COUNT = 7;
export const TTL_CRITICAL = 7;
export const TTL_HIGH = 5;
export const TTL_NORMAL = 3;
export const TTL_LOW = 2;
