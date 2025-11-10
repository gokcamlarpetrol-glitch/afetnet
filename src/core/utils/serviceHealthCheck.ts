/**
 * SERVICE HEALTH CHECK - Backend Service Verification
 * Tests Firebase, BLE mesh, RevenueCat initialization
 */

import { createLogger } from './logger';
import getFirebaseApp from '../../lib/firebase';
import { premiumService } from '../services/PremiumService';
import { useMeshStore } from '../stores/meshStore';

const logger = createLogger('ServiceHealthCheck');

export interface ServiceHealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  message: string;
  lastChecked: number;
}

const healthStatuses: Map<string, ServiceHealthStatus> = new Map();

/**
 * Check Firebase service health
 */
export async function checkFirebaseHealth(): Promise<ServiceHealthStatus> {
  const startTime = Date.now();
  
  try {
    const firebaseApp = getFirebaseApp();
    
    if (!firebaseApp) {
      return {
        name: 'Firebase',
        status: 'down',
        message: 'Firebase app not initialized',
        lastChecked: startTime,
      };
    }
    
    // Check if Firestore is available
    try {
      const { getFirestore } = await import('firebase/firestore');
      const db = getFirestore(firebaseApp);
      
      if (!db) {
        return {
          name: 'Firebase',
          status: 'degraded',
          message: 'Firebase app initialized but Firestore not available',
          lastChecked: startTime,
        };
      }
      
      healthStatuses.set('Firebase', {
        name: 'Firebase',
        status: 'healthy',
        message: 'Firebase and Firestore initialized successfully',
        lastChecked: startTime,
      });
      
      return healthStatuses.get('Firebase')!;
    } catch (error) {
      return {
        name: 'Firebase',
        status: 'degraded',
        message: `Firestore error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Firebase',
      status: 'down',
      message: `Firebase initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: startTime,
    };
  }
}

/**
 * Check BLE Mesh service health
 * Note: "degraded" status is normal - Bluetooth might be off or no peers nearby
 */
export async function checkBLEMeshHealth(): Promise<ServiceHealthStatus> {
  const startTime = Date.now();
  
  try {
    // Check BLE mesh status via store
    const meshStore = useMeshStore.getState();
    const stats = meshStore.stats;
    const myDeviceId = meshStore.myDeviceId;
    
    if (!myDeviceId) {
      // This is normal on first launch or if Bluetooth is disabled
      healthStatuses.set('BLE Mesh', {
        name: 'BLE Mesh',
        status: 'degraded',
        message: 'BLE Mesh service not initialized - Bluetooth may be disabled or permissions not granted',
        lastChecked: startTime,
      });
      
      return healthStatuses.get('BLE Mesh')!;
    }
    
    // Check if there are any peers or messages (indicates service is active)
    const hasActivity = stats.peersDiscovered > 0 || stats.messagesSent > 0 || stats.messagesReceived > 0;
    
    if (hasActivity) {
      healthStatuses.set('BLE Mesh', {
        name: 'BLE Mesh',
        status: 'healthy',
        message: `BLE Mesh active - ${stats.peersDiscovered} peers, ${stats.messagesSent} sent, ${stats.messagesReceived} received`,
        lastChecked: startTime,
      });
      
      return healthStatuses.get('BLE Mesh')!;
    } else {
      // No activity is normal - just means no peers nearby or Bluetooth is off
      healthStatuses.set('BLE Mesh', {
        name: 'BLE Mesh',
        status: 'healthy',
        message: 'BLE Mesh initialized - No peers nearby (this is normal)',
        lastChecked: startTime,
      });
      
      return healthStatuses.get('BLE Mesh')!;
    }
  } catch (error) {
    // Only mark as down if there's an actual error
    return {
      name: 'BLE Mesh',
      status: 'degraded',
      message: `BLE Mesh check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: startTime,
    };
  }
}

/**
 * Check RevenueCat/Premium service health
 */
export async function checkPremiumServiceHealth(): Promise<ServiceHealthStatus> {
  const startTime = Date.now();
  
  try {
    // Try to get current offerings (this tests RevenueCat connection)
    try {
      // Note: This might fail if RevenueCat is not configured, which is OK
      const offerings = await premiumService.getOfferings() || null;
      
      if (offerings) {
        healthStatuses.set('Premium Service', {
          name: 'Premium Service',
          status: 'healthy',
          message: 'Premium service initialized and RevenueCat connected',
          lastChecked: startTime,
        });
      } else {
        // Check trial as fallback
        const { useTrialStore } = await import('../stores/trialStore');
        const isTrialActive = useTrialStore.getState().isTrialActive;
        
        healthStatuses.set('Premium Service', {
          name: 'Premium Service',
          status: isTrialActive ? 'healthy' : 'degraded',
          message: isTrialActive 
            ? 'Premium service initialized (trial active, RevenueCat not configured)'
            : 'Premium service initialized but RevenueCat not configured and trial expired',
          lastChecked: startTime,
        });
      }
      
      return healthStatuses.get('Premium Service')!;
    } catch (error) {
      return {
        name: 'Premium Service',
        status: 'degraded',
        message: `Premium service initialized but RevenueCat check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: startTime,
      };
    }
  } catch (error) {
    return {
      name: 'Premium Service',
      status: 'down',
      message: `Premium service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      lastChecked: startTime,
    };
  }
}

/**
 * Run all health checks
 */
export async function runAllHealthChecks(): Promise<ServiceHealthStatus[]> {
  logger.info('🔍 Running service health checks...');
  
  const checks = await Promise.allSettled([
    checkFirebaseHealth(),
    checkBLEMeshHealth(),
    checkPremiumServiceHealth(),
  ]);
  
  const results: ServiceHealthStatus[] = [];
  
  checks.forEach((check, index) => {
    if (check.status === 'fulfilled') {
      results.push(check.value);
    } else {
      const serviceNames = ['Firebase', 'BLE Mesh', 'Premium Service'];
      results.push({
        name: serviceNames[index],
        status: 'down',
        message: `Health check failed: ${check.reason?.message || 'Unknown error'}`,
        lastChecked: Date.now(),
      });
    }
  });
  
  // Log summary
  const healthy = results.filter(r => r.status === 'healthy').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const down = results.filter(r => r.status === 'down').length;
  
  logger.info(`✅ Health check complete: ${healthy} healthy, ${degraded} degraded, ${down} down`);
  
  results.forEach(result => {
    const emoji = result.status === 'healthy' ? '✅' : result.status === 'degraded' ? '⚠️' : '❌';
    logger.info(`${emoji} ${result.name}: ${result.message}`);
  });
  
  return results;
}

/**
 * Get cached health status
 */
export function getCachedHealthStatus(serviceName: string): ServiceHealthStatus | null {
  return healthStatuses.get(serviceName) || null;
}

/**
 * Get all cached health statuses
 */
export function getAllCachedHealthStatuses(): ServiceHealthStatus[] {
  return Array.from(healthStatuses.values());
}

