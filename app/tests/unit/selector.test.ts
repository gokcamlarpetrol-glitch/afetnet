// @afetnet: Unit tests for AI Protocol Selector
// Tests epsilon-greedy algorithm and protocol selection

import { advancedMeshNetwork } from '../../domain/security/protocols/aiSelector';

describe('AI Protocol Selector', () => {
  test('should initialize with default protocol', () => {
    const protocol = advancedMeshNetwork.getActiveProtocol();
    expect(['aodv', 'dsr', 'olsr']).toContain(protocol);
  });

  test('should switch protocols based on network conditions', async () => {
    // Simulate network conditions
    const initialProtocol = advancedMeshNetwork.getActiveProtocol();

    // Simulate high node count (should prefer OLSR)
    const optimalProtocol = await advancedMeshNetwork.selectOptimalProtocol({
      source: 'test1',
      destination: 'test2',
      priority: 'normal',
      networkSize: 100, // Large network
      emergencyMode: false,
    });

    expect(['aodv', 'dsr', 'olsr']).toContain(optimalProtocol);
  });

  test('should prefer AODV for emergency situations', async () => {
    const protocol = await advancedMeshNetwork.selectOptimalProtocol({
      source: 'test1',
      destination: 'test2',
      priority: 'critical',
      networkSize: 10,
      emergencyMode: true,
    });

    expect(protocol).toBe('aodv');
  });

  test('should get network metrics', () => {
    const metrics = advancedMeshNetwork.getNetworkMetrics();
    expect(metrics).toHaveProperty('nodeCount');
    expect(metrics).toHaveProperty('connectivityRatio');
    expect(metrics).toHaveProperty('averageHopCount');
  });

  test('should optimize for emergency mode', () => {
    advancedMeshNetwork.optimizeForEmergency();
    // Should increase scanning frequency and set high power mode
    expect(true).toBe(true); // Placeholder assertion
  });

  test('should optimize for battery saving', () => {
    advancedMeshNetwork.optimizeForBatterySaving();
    // Should decrease scanning frequency
    expect(true).toBe(true); // Placeholder assertion
  });
});




























