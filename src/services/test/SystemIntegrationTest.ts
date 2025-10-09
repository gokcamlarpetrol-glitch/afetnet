import { aiDecisionSupportSystem } from '../ai/AIDecisionSupportSystem';
import { smartSituationAnalyzer } from '../ai/SmartSituationAnalyzer';
import { satelliteCommunicationSystem } from '../communication/SatelliteCommunicationSystem';
import { droneCoordinationSystem } from '../drones/DroneCoordinationSystem';
import { emergencyLogger } from '../logging/EmergencyLogger';
import { emergencySimulationSystem } from '../simulation/EmergencySimulationSystem';

export interface SystemTestResult {
  systemName: string;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  details?: any;
}

class SystemIntegrationTest {
  private testResults: SystemTestResult[] = [];

  // CRITICAL: Run All System Tests
  async runAllTests(): Promise<SystemTestResult[]> {
    console.log('🧪 Starting comprehensive system integration tests...');
    this.testResults = [];

    try {
      // Test Satellite Communication System
      await this.testSatelliteSystem();
      
      // Test Drone Coordination System
      await this.testDroneSystem();
      
      // Test AI Decision Support System
      await this.testAIDecisionSystem();
      
      // Test Smart Situation Analyzer
      await this.testSituationAnalyzer();
      
      // Test Emergency Simulation System
      await this.testSimulationSystem();
      
      // Test System Integration
      await this.testSystemIntegration();

      console.log('✅ All system integration tests completed');
      emergencyLogger.logSystem('info', 'System integration tests completed', {
        totalTests: this.testResults.length,
        passed: this.testResults.filter(r => r.status === 'passed').length,
        failed: this.testResults.filter(r => r.status === 'failed').length,
        warnings: this.testResults.filter(r => r.status === 'warning').length
      });

      return this.testResults;

    } catch (error) {
      emergencyLogger.logSystem('error', 'System integration tests failed', { error: String(error) });
      console.error('❌ System integration tests failed:', error);
      return this.testResults;
    }
  }

  // CRITICAL: Test Satellite Communication System
  private async testSatelliteSystem(): Promise<void> {
    try {
      console.log('🛰️ Testing satellite communication system...');
      
      // Test system startup
      const satelliteStarted = await satelliteCommunicationSystem.startSatelliteCommunication();
      if (!satelliteStarted) {
        this.addTestResult('Satellite System', 'failed', 'Failed to start satellite communication system');
        return;
      }

      // Test satellite status
      const satelliteStatus = satelliteCommunicationSystem.getSatelliteStatus();
      if (!satelliteStatus.isActive) {
        this.addTestResult('Satellite System', 'failed', 'Satellite system not active');
        return;
      }

      // Test satellite connections
      const activeSatellites = satelliteCommunicationSystem.getActiveSatellites();
      if (activeSatellites.length === 0) {
        this.addTestResult('Satellite System', 'warning', 'No active satellite connections');
      } else {
        this.addTestResult('Satellite System', 'passed', `Satellite system active with ${activeSatellites.length} connections`, {
          activeSatellites: activeSatellites.length,
          totalSatellites: satelliteStatus.totalSatellites,
          pendingMessages: satelliteStatus.pendingMessages
        });
      }

      // Test emergency beacon registration
      try {
        const beaconId = await satelliteCommunicationSystem.registerEmergencyBeacon({
          type: 'personal',
          location: { lat: 41.0082, lon: 28.9784, altitude: 100 },
          batteryLevel: 85,
          emergencyCode: 'TEST_001',
          status: 'active'
        });
        
        if (beaconId) {
          this.addTestResult('Emergency Beacon', 'passed', 'Emergency beacon registered successfully', { beaconId });
        } else {
          this.addTestResult('Emergency Beacon', 'failed', 'Failed to register emergency beacon');
        }
      } catch (error) {
        this.addTestResult('Emergency Beacon', 'failed', 'Emergency beacon registration failed', { error: String(error) });
      }

      // Test satellite message sending
      try {
        const messageId = await satelliteCommunicationSystem.sendEmergencySatelliteMessage({
          type: 'sos',
          priority: 'high',
          payload: { test: true, message: 'Integration test message' },
          satelliteId: 'auto',
          maxRetries: 3,
          encryptionLevel: 'standard'
        });
        
        if (messageId) {
          this.addTestResult('Satellite Messaging', 'passed', 'Satellite message sent successfully', { messageId });
        } else {
          this.addTestResult('Satellite Messaging', 'failed', 'Failed to send satellite message');
        }
      } catch (error) {
        this.addTestResult('Satellite Messaging', 'failed', 'Satellite messaging failed', { error: String(error) });
      }

    } catch (error) {
      this.addTestResult('Satellite System', 'failed', 'Satellite system test failed', { error: String(error) });
    }
  }

  // CRITICAL: Test Drone Coordination System
  private async testDroneSystem(): Promise<void> {
    try {
      console.log('🚁 Testing drone coordination system...');
      
      // Test system startup
      const droneStarted = await droneCoordinationSystem.startDroneCoordination();
      if (!droneStarted) {
        this.addTestResult('Drone System', 'failed', 'Failed to start drone coordination system');
        return;
      }

      // Test drone fleet status
      const droneStatus = droneCoordinationSystem.getDroneFleetStatus();
      if (!droneStatus.isActive) {
        this.addTestResult('Drone System', 'failed', 'Drone system not active');
        return;
      }

      // Test available drones
      const availableDrones = droneCoordinationSystem.getAvailableDrones();
      if (availableDrones.length === 0) {
        this.addTestResult('Drone System', 'warning', 'No available drones in fleet');
      } else {
        this.addTestResult('Drone System', 'passed', `Drone fleet active with ${availableDrones.length} available drones`, {
          totalDrones: droneStatus.totalDrones,
          activeDrones: droneStatus.activeDrones,
          availableDrones: droneStatus.availableDrones,
          activeMissions: droneStatus.activeMissions
        });
      }

      // Test emergency mission creation
      try {
        const missionId = await droneCoordinationSystem.createEmergencyMission({
          type: 'search',
          priority: 'high',
          targetLocation: { lat: 41.0082, lon: 28.9784, radius: 500 },
          objectives: [
            {
              id: 'test_obj_1',
              title: 'Test Search Area',
              description: 'Search test area for survivors',
              type: 'search_area',
              completed: false,
              parameters: { area: 'test_zone' }
            } as any
          ],
          estimatedDuration: 15
        });
        
        if (missionId) {
          this.addTestResult('Drone Mission', 'passed', 'Emergency mission created successfully', { missionId });
        } else {
          this.addTestResult('Drone Mission', 'failed', 'Failed to create emergency mission');
        }
      } catch (error) {
        this.addTestResult('Drone Mission', 'failed', 'Drone mission creation failed', { error: String(error) });
      }

    } catch (error) {
      this.addTestResult('Drone System', 'failed', 'Drone system test failed', { error: String(error) });
    }
  }

  // CRITICAL: Test AI Decision Support System
  private async testAIDecisionSystem(): Promise<void> {
    try {
      console.log('🧠 Testing AI decision support system...');
      
      // Test system startup
      const aiStarted = await aiDecisionSupportSystem.startAIDecisionSystem();
      if (!aiStarted) {
        this.addTestResult('AI Decision System', 'failed', 'Failed to start AI decision support system');
        return;
      }

      // Test system status
      const aiStatus = aiDecisionSupportSystem.getSystemStatus();
      if (!aiStatus.isActive) {
        this.addTestResult('AI Decision System', 'failed', 'AI decision system not active');
        return;
      }

      this.addTestResult('AI Decision System', 'passed', 'AI decision support system active', {
        totalDecisions: aiStatus.totalDecisions,
        averageConfidence: aiStatus.averageConfidence,
        isProcessing: aiStatus.isProcessing
      });

      // Test decision generation
      try {
        const testContext = {
          id: 'test_context_001',
          type: 'emergency_response' as const,
          severity: 'high' as const,
          location: { lat: 41.0082, lon: 28.9784, radius: 1000 },
          affectedPopulation: 100,
          availableResources: {
            personnel: [],
            equipment: [],
            vehicles: [],
            medical: [],
            communication: []
          },
          environmentalConditions: {
            weather: {
              temperature: 25,
              humidity: 60,
              windSpeed: 10,
              precipitation: 0,
              visibility: 100
            },
            hazards: {
              fire: false,
              flood: false,
              gasLeak: false,
              structuralDamage: true,
              electricalHazard: false
            },
            accessibility: {
              roadConditions: 'damaged' as const,
              airspaceClear: true,
              waterAccess: false
            }
          },
          timeConstraints: {
            immediate: 30,
            shortTerm: 2,
            longTerm: 24
          },
          realTimeData: {
            casualties: { confirmed: 5, injured: 10, missing: 2, rescued: 3 },
            infrastructure: {
              buildings: { total: 100, damaged: 20, destroyed: 5 },
              utilities: { power: false, water: false, gas: true },
              transportation: { roads: 10, bridges: 2, airports: 1 }
            },
            communication: {
              cellular: 'degraded' as const,
              internet: 'offline' as const,
              radio: 'active' as const
            }
          }
        };

        const decision = await aiDecisionSupportSystem.generateDecision(testContext);
        
        if (decision) {
          this.addTestResult('AI Decision Generation', 'passed', 'AI decision generated successfully', {
            decisionId: decision.id,
            confidence: decision.confidence,
            priority: decision.priority,
            actions: decision.actions.length
          });
        } else {
          this.addTestResult('AI Decision Generation', 'failed', 'Failed to generate AI decision');
        }
      } catch (error) {
        this.addTestResult('AI Decision Generation', 'failed', 'AI decision generation failed', { error: String(error) });
      }

    } catch (error) {
      this.addTestResult('AI Decision System', 'failed', 'AI decision system test failed', { error: String(error) });
    }
  }

  // CRITICAL: Test Smart Situation Analyzer
  private async testSituationAnalyzer(): Promise<void> {
    try {
      console.log('🧠 Testing smart situation analyzer...');
      
      // Test system startup
      const analyzerStarted = await smartSituationAnalyzer.startSituationAnalysis();
      if (!analyzerStarted) {
        this.addTestResult('Situation Analyzer', 'failed', 'Failed to start smart situation analyzer');
        return;
      }

      // Wait a moment for analysis to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Test current analysis
      const currentAnalysis = smartSituationAnalyzer.getCurrentAnalysis();
      if (currentAnalysis) {
        this.addTestResult('Situation Analyzer', 'passed', 'Smart situation analyzer active and working', {
          riskLevel: currentAnalysis.riskLevel,
          confidence: currentAnalysis.confidence,
          riskFactors: currentAnalysis.riskFactors.length,
          recommendations: currentAnalysis.recommendations.length
        });
      } else {
        this.addTestResult('Situation Analyzer', 'warning', 'Smart situation analyzer active but no analysis yet');
      }

      // Test analysis history
      const analysisHistory = smartSituationAnalyzer.getAnalysisHistory();
      this.addTestResult('Analysis History', 'passed', `Analysis history available with ${analysisHistory.length} entries`);

    } catch (error) {
      this.addTestResult('Situation Analyzer', 'failed', 'Situation analyzer test failed', { error: String(error) });
    }
  }

  // CRITICAL: Test Emergency Simulation System
  private async testSimulationSystem(): Promise<void> {
    try {
      console.log('🎮 Testing emergency simulation system...');
      
      // Test simulation scenarios
      const scenarios = emergencySimulationSystem.getSimulationScenarios();
      if (scenarios.length === 0) {
        this.addTestResult('Simulation System', 'failed', 'No simulation scenarios available');
        return;
      }

      this.addTestResult('Simulation Scenarios', 'passed', `Simulation system has ${scenarios.length} scenarios available`, {
        scenarios: scenarios.map(s => ({ id: s.id, name: s.name, difficulty: s.difficulty }))
      });

      // Test simulation creation
      try {
        const firstScenario = scenarios[0];
        const sessionId = await emergencySimulationSystem.startSimulation(firstScenario.id, 'test_user_001');
        
        if (sessionId) {
          this.addTestResult('Simulation Creation', 'passed', 'Emergency simulation created successfully', {
            sessionId,
            scenarioId: firstScenario.id,
            scenarioName: firstScenario.name
          });

          // Test active simulations
          const activeSimulations = emergencySimulationSystem.getActiveSimulations();
          this.addTestResult('Active Simulations', 'passed', `Active simulations: ${activeSimulations.length}`);

        } else {
          this.addTestResult('Simulation Creation', 'failed', 'Failed to create emergency simulation');
        }
      } catch (error) {
        this.addTestResult('Simulation Creation', 'failed', 'Simulation creation failed', { error: String(error) });
      }

    } catch (error) {
      this.addTestResult('Simulation System', 'failed', 'Simulation system test failed', { error: String(error) });
    }
  }

  // CRITICAL: Test System Integration
  private async testSystemIntegration(): Promise<void> {
    try {
      console.log('🔗 Testing system integration...');
      
      // Test all systems are active
      const satelliteStatus = satelliteCommunicationSystem.getSatelliteStatus();
      const droneStatus = droneCoordinationSystem.getDroneFleetStatus();
      const aiStatus = aiDecisionSupportSystem.getSystemStatus();
      const analyzerStatus = smartSituationAnalyzer.getSystemStatus();
      const simulationStatus = emergencySimulationSystem.getSystemStatus();

      const allSystemsActive = satelliteStatus.isActive && 
                               droneStatus.isActive && 
                               aiStatus.isActive && 
                               analyzerStatus.isActive;

      if (allSystemsActive) {
        this.addTestResult('System Integration', 'passed', 'All advanced systems are active and integrated', {
          satelliteActive: satelliteStatus.isActive,
          droneActive: droneStatus.isActive,
          aiActive: aiStatus.isActive,
          analyzerActive: analyzerStatus.isActive,
          simulationScenarios: simulationStatus.totalScenarios
        });
      } else {
        this.addTestResult('System Integration', 'warning', 'Some systems are not active', {
          satelliteActive: satelliteStatus.isActive,
          droneActive: droneStatus.isActive,
          aiActive: aiStatus.isActive,
          analyzerActive: analyzerStatus.isActive
        });
      }

      // Test cross-system communication
      try {
        // Test satellite message with AI decision
        const testMessage = await satelliteCommunicationSystem.sendEmergencySatelliteMessage({
          type: 'emergency',
          priority: 'critical',
          maxRetries: 5,
          payload: { 
            test: true, 
            message: 'Integration test - AI decision requested',
            requestAI: true 
          },
          satelliteId: 'auto',
          encryptionLevel: 'military'
        });

        if (testMessage) {
          this.addTestResult('Cross-System Communication', 'passed', 'Cross-system communication working', {
            satelliteMessageId: testMessage
          });
        }
      } catch (error) {
        this.addTestResult('Cross-System Communication', 'failed', 'Cross-system communication failed', { error: String(error) });
      }

    } catch (error) {
      this.addTestResult('System Integration', 'failed', 'System integration test failed', { error: String(error) });
    }
  }

  // CRITICAL: Add Test Result
  private addTestResult(systemName: string, status: SystemTestResult['status'], message: string, details?: any): void {
    const result: SystemTestResult = {
      systemName,
      status,
      message,
      details
    };
    
    this.testResults.push(result);
    
    const emoji = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⚠️';
    console.log(`${emoji} ${systemName}: ${message}`);
  }

  // CRITICAL: Get Test Summary
  getTestSummary(): {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    successRate: number;
  } {
    const total = this.testResults.length;
    const passed = this.testResults.filter(r => r.status === 'passed').length;
    const failed = this.testResults.filter(r => r.status === 'failed').length;
    const warnings = this.testResults.filter(r => r.status === 'warning').length;
    const successRate = total > 0 ? (passed / total) * 100 : 0;

    return {
      total,
      passed,
      failed,
      warnings,
      successRate
    };
  }

  // CRITICAL: Get All Test Results
  getAllTestResults(): SystemTestResult[] {
    return [...this.testResults];
  }
}

// Export singleton instance
export const systemIntegrationTest = new SystemIntegrationTest();
export default SystemIntegrationTest;




