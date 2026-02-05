/**
 * SEISMIC MODULE - BARREL EXPORTS
 * 
 * Central export point for all seismic detection services
 * 
 * @example
 * import { seismicEngine, onDeviceEEWService } from '@/core/services/seismic';
 * 
 * @version 1.0.0
 * @elite true
 */

// ============================================================
// SEISMIC ENGINE
// ============================================================

export {
    seismicEngine,
    type DetectionEvent,
} from './AdvancedSeismicEngine';

// ============================================================
// ON-DEVICE EEW
// ============================================================

export { onDeviceEEWService } from './OnDeviceEEWService';

// ============================================================
// SEISMIC MATH
// ============================================================

export * from './SeismicMath';
