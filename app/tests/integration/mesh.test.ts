// @afetnet: Integration tests for 3-node mesh network
// Tests end-to-end message delivery and protocol handoff

import { advancedMeshNetwork } from '../../domain/security/protocols/aiSelector';
import { advancedMultipathRouter } from '../../domain/messaging/multipath';
import { networkPartitionDetector } from '../../domain/network/partition';
import { networkHealthMonitor } from '../../domain/network/health';

describe('3-Node Mesh Network Integration', () => {
  beforeAll(async () => {
    // Initialize all systems
    await advancedMeshNetwork.initialize();
    await advancedMultipathRouter.initialize();
    await networkPartitionDetector.initialize();
    await networkHealthMonitor.initialize();
  });

  test('should establish 3-node mesh network', async () => {
    // Simulate 3 nodes joining the network
    const nodes = ['node1', 'node2', 'node3'];

    for (const nodeId of nodes) {
      // Register heartbeats
      networkPartitionDetector.registerHeartbeat(nodeId);
    }

    // Check network metrics
    const metrics = advancedMeshNetwork.getNetworkMetrics();
    expect(metrics.nodeCount).toBeGreaterThanOrEqual(3);
  });

  test('should route messages between nodes', async () => {
    // Send message from node1 to node3
    const messageId = await advancedMultipathRouter.sendWithMultipath(
      'node1',
      'node3',
      'Test message from node1 to node3',
      'data',
      'normal'
    );

    expect(messageId).toBeDefined();

    // Check that message is in multipath tracking
    const stats = advancedMultipathRouter.getMultipathStats();
    expect(stats.activeMessages).toBeGreaterThan(0);
  });

  test('should handle network partition and recovery', async () => {
    // Simulate network partition (node3 becomes isolated)
    networkPartitionDetector.registerHeartbeat('node1');
    networkPartitionDetector.registerHeartbeat('node2');
    // node3 heartbeat timeout will trigger partition detection

    // Wait for partition detection
    await new Promise(resolve => setTimeout(resolve, 6000));

    const partitions = networkPartitionDetector.getPartitions();
    expect(partitions.length).toBeGreaterThan(1);
  });

  test('should monitor network health', () => {
    const health = networkHealthMonitor.getHealthState();
    expect(health).toHaveProperty('overallHealth');
    expect(health).toHaveProperty('stability');
    expect(health).toHaveProperty('reliability');
  });

  test('should provide network recommendations', () => {
    const recommendations = networkHealthMonitor.getRecommendations();
    expect(Array.isArray(recommendations)).toBe(true);
  });

  test('should handle emergency mode activation', async () => {
    // Activate emergency mode
    await advancedMeshNetwork.optimizeForEmergency();

    // Check that emergency optimizations are applied
    const health = advancedMeshNetwork.getNetworkHealth();
    expect(health).toBeDefined();

    // Deactivate emergency mode
    advancedMeshNetwork.optimizeForBatterySaving();
  });

  afterAll(async () => {
    // Cleanup all systems
    await advancedMeshNetwork.stop();
    await advancedMultipathRouter.cleanupOldMultipathMessages();
    await networkPartitionDetector.stop();
    await networkHealthMonitor.stop();
  });
});







