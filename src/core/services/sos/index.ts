/**
 * SOS SERVICES INDEX - ELITE V4
 * Unified exports for all SOS-related services
 */

// State Management
export {
    useSOSStore,
    EmergencyReason,
    type SOSStatus,
    type ChannelStatus,
    type SOSLocation,
    type SOSAck,
    type SOSSignal,
    type DeviceStatus,
    type ChannelState,
} from './SOSStateManager';

// Controller
export {
    unifiedSOSController,
    default as UnifiedSOSController,
} from './UnifiedSOSController';

// Channel Router
export {
    sosChannelRouter,
    default as SOSChannelRouter,
} from './SOSChannelRouter';

// Beacon Service
export {
    sosBeaconService,
    default as SOSBeaconService,
} from './SOSBeaconService';
