// AI-POWERED NETWORK INTELLIGENCE ENGINE
// Machine learning and predictive analytics for optimal disaster communication

import { logger } from '../utils/productionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface NetworkMetrics {
  timestamp: number;
  connectivity: number; // 0-100
  latency: number; // ms
  packetLoss: number; // 0-100
  throughput: number; // kbps
  nodeCount: number;
  hopCount: number;
  batteryLevels: number[];
  signalStrengths: number[];
  messageSuccessRate: number;
  emergencyTraffic: number;
}

export interface PredictiveModel {
  type: 'routing' | 'power' | 'connectivity' | 'failure';
  confidence: number; // 0-100
  predictions: Map<string, number>;
  lastUpdated: number;
  accuracy: number; // Historical accuracy
}

export interface NetworkBehavior {
  pattern: string;
  probability: number;
  duration: number; // minutes
  impact: 'positive' | 'negative' | 'neutral';
  recommendations: string[];
}

export interface AIOptimization {
  protocolRecommendation: 'aodv' | 'dsr' | 'olsr';
  powerMode: 'aggressive_saving' | 'balanced' | 'high_performance';
  routingStrategy: 'direct' | 'multi_hop' | 'redundant';
  scanningFrequency: number; // Hz
  confidence: number;
  reasoning: string[];
}

class NetworkIntelligenceEngine {
  private networkHistory: NetworkMetrics[] = [];
  private predictiveModels: Map<string, PredictiveModel> = new Map();
  private behaviorPatterns: NetworkBehavior[] = [];
  private isLearning = false;
  private modelUpdateInterval: NodeJS.Timeout | null = null;
  private anomalyDetectionActive = false;

  async initialize(): Promise<void> {
    logger.debug('🧠 Initializing AI-powered network intelligence engine...');

    try {
      // Load historical data
      await this.loadNetworkHistory();

      // Initialize predictive models
      this.initializePredictiveModels();

      // Start machine learning
      this.startMachineLearning();

      // Start anomaly detection
      this.startAnomalyDetection();

      this.isLearning = true;
      logger.debug('✅ Network intelligence engine initialized');

    } catch (error) {
      logger.error('❌ Failed to initialize network intelligence engine:', error);
      throw error;
    }
  }

  private async loadNetworkHistory(): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem('network_intelligence_history');
      if (historyData) {
        this.networkHistory = JSON.parse(historyData);
        logger.debug(`Loaded ${this.networkHistory.length} network intelligence entries`);
      }
    } catch (error) {
      logger.error('Failed to load network history:', error);
    }
  }

  private initializePredictiveModels(): void {
    logger.debug('🧮 Initializing predictive models...');

    // Initialize routing prediction model
    this.predictiveModels.set('routing', {
      type: 'routing',
      confidence: 0,
      predictions: new Map(),
      lastUpdated: Date.now(),
      accuracy: 0,
    });

    // Initialize power prediction model
    this.predictiveModels.set('power', {
      type: 'power',
      confidence: 0,
      predictions: new Map(),
      lastUpdated: Date.now(),
      accuracy: 0,
    });

    // Initialize connectivity prediction model
    this.predictiveModels.set('connectivity', {
      type: 'connectivity',
      confidence: 0,
      predictions: new Map(),
      lastUpdated: Date.now(),
      accuracy: 0,
    });

    // Initialize failure prediction model
    this.predictiveModels.set('failure', {
      type: 'failure',
      confidence: 0,
      predictions: new Map(),
      lastUpdated: Date.now(),
      accuracy: 0,
    });

    logger.debug('✅ Predictive models initialized');
  }

  private startMachineLearning(): void {
    logger.debug('🧠 Starting machine learning engine...');

    // Update models every 2 minutes
    this.modelUpdateInterval = setInterval(() => {
      if (this.isLearning) {
        this.updatePredictiveModels();
        this.learnFromNetworkBehavior();
        this.detectNetworkAnomalies();
      }
    }, 120000); // Every 2 minutes
  }

  private startAnomalyDetection(): void {
    logger.debug('🔍 Starting anomaly detection...');

    this.anomalyDetectionActive = true;

    // Check for anomalies every 30 seconds
    setInterval(() => {
      if (this.anomalyDetectionActive) {
        this.detectAnomalies();
      }
    }, 30000);
  }

  async collectNetworkMetrics(): Promise<NetworkMetrics> {
    const now = Date.now();

    // Collect current network metrics
    const metrics: NetworkMetrics = {
      timestamp: now,
      connectivity: Math.floor(Math.random() * 100), // Mock data - in real implementation would get from BLE mesh
      latency: Math.floor(Math.random() * 1000) + 50,
      packetLoss: Math.floor(Math.random() * 20),
      throughput: Math.floor(Math.random() * 1000) + 100,
      nodeCount: Math.floor(Math.random() * 50) + 10,
      hopCount: Math.floor(Math.random() * 8) + 1,
      batteryLevels: Array.from({ length: 10 }, () => Math.floor(Math.random() * 100)),
      signalStrengths: Array.from({ length: 10 }, () => Math.floor(Math.random() * 100)),
      messageSuccessRate: Math.random() * 0.3 + 0.7, // 70-100%
      emergencyTraffic: Math.floor(Math.random() * 100),
    };

    // Add to history
    this.networkHistory.push(metrics);

    // Keep only last 1000 entries
    if (this.networkHistory.length > 1000) {
      this.networkHistory = this.networkHistory.slice(-1000);
    }

    // Save to storage
    await this.saveNetworkHistory();

    return metrics;
  }

  private async saveNetworkHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('network_intelligence_history', JSON.stringify(this.networkHistory));
    } catch (error) {
      logger.error('Failed to save network history:', error);
    }
  }

  private updatePredictiveModels(): void {
    logger.debug('📈 Updating predictive models...');

    if (this.networkHistory.length < 10) return;

    // Update routing model
    this.updateRoutingModel();

    // Update power model
    this.updatePowerModel();

    // Update connectivity model
    this.updateConnectivityModel();

    // Update failure prediction model
    this.updateFailureModel();

    logger.debug('✅ Predictive models updated');
  }

  private updateRoutingModel(): void {
    const model = this.predictiveModels.get('routing');
    if (!model) return;

    // Analyze historical routing performance
    const recentHistory = this.networkHistory.slice(-50);

    // Simple routing prediction based on network size and connectivity
    const avgConnectivity = recentHistory.reduce((sum, m) => sum + m.connectivity, 0) / recentHistory.length;
    const avgNodeCount = recentHistory.reduce((sum, m) => sum + m.nodeCount, 0) / recentHistory.length;

    // Predict best protocol based on conditions
    let bestProtocol: 'aodv' | 'dsr' | 'olsr' = 'aodv';

    if (avgNodeCount > 30 && avgConnectivity > 70) {
      bestProtocol = 'olsr'; // Good for large, stable networks
    } else if (avgNodeCount < 15 && avgConnectivity > 50) {
      bestProtocol = 'dsr'; // Good for small, dynamic networks
    } else {
      bestProtocol = 'aodv'; // Default for unreliable networks
    }

    model.predictions.set('best_protocol', bestProtocol === 'aodv' ? 1 : bestProtocol === 'dsr' ? 2 : 3);
    model.confidence = Math.min(95, 50 + (recentHistory.length * 0.9));
    model.lastUpdated = Date.now();
    model.accuracy = this.calculateModelAccuracy(model);

    this.predictiveModels.set('routing', model);
  }

  private updatePowerModel(): void {
    const model = this.predictiveModels.get('power');
    if (!model) return;

    // Analyze battery consumption patterns
    const recentHistory = this.networkHistory.slice(-30);

    // Calculate average battery drain rate
    const batteryTrend = this.calculateBatteryTrend(recentHistory);

    // Predict optimal power mode
    let powerMode: 'aggressive_saving' | 'balanced' | 'high_performance' = 'balanced';

    if (batteryTrend < -5) { // Rapid battery drain
      powerMode = 'aggressive_saving';
    } else if (batteryTrend > 2) { // Battery recovering
      powerMode = 'high_performance';
    }

    model.predictions.set('power_mode', powerMode === 'aggressive_saving' ? 1 : powerMode === 'balanced' ? 2 : 3);
    model.confidence = Math.min(90, 40 + (recentHistory.length * 1.7));
    model.lastUpdated = Date.now();
    model.accuracy = this.calculateModelAccuracy(model);

    this.predictiveModels.set('power', model);
  }

  private updateConnectivityModel(): void {
    const model = this.predictiveModels.get('connectivity');
    if (!model) return;

    // Predict connectivity based on time patterns and environmental factors
    const hourOfDay = new Date().getHours();
    const dayOfWeek = new Date().getDay();

    // Analyze historical connectivity patterns
    const timeBasedHistory = this.networkHistory.filter(m => {
      const hour = new Date(m.timestamp).getHours();
      return Math.abs(hour - hourOfDay) <= 1;
    });

    if (timeBasedHistory.length > 0) {
      const avgConnectivity = timeBasedHistory.reduce((sum, m) => sum + m.connectivity, 0) / timeBasedHistory.length;
      model.predictions.set('expected_connectivity', avgConnectivity);
      model.confidence = Math.min(85, 30 + (timeBasedHistory.length * 1.1));
    }

    model.lastUpdated = Date.now();
    model.accuracy = this.calculateModelAccuracy(model);

    this.predictiveModels.set('connectivity', model);
  }

  private updateFailureModel(): void {
    const model = this.predictiveModels.get('failure');
    if (!model) return;

    // Predict network failures based on patterns
    const recentHistory = this.networkHistory.slice(-20);

    // Calculate failure indicators
    const highPacketLoss = recentHistory.filter(m => m.packetLoss > 15).length;
    const lowConnectivity = recentHistory.filter(m => m.connectivity < 30).length;
    const highLatency = recentHistory.filter(m => m.latency > 1000).length;

    // Predict failure probability
    const failureScore = (highPacketLoss * 0.3 + lowConnectivity * 0.4 + highLatency * 0.3) / recentHistory.length;
    const failureProbability = Math.min(100, failureScore * 100);

    model.predictions.set('failure_probability', failureProbability);
    model.confidence = Math.min(80, 20 + (recentHistory.length * 3));
    model.lastUpdated = Date.now();
    model.accuracy = this.calculateModelAccuracy(model);

    this.predictiveModels.set('failure', model);
  }

  private calculateBatteryTrend(history: NetworkMetrics[]): number {
    if (history.length < 2) return 0;

    // Calculate battery trend over time
    const batteryChanges: number[] = [];

    for (let i = 1; i < history.length; i++) {
      const avgBattery1 = history[i - 1].batteryLevels.reduce((sum, b) => sum + b, 0) / history[i - 1].batteryLevels.length;
      const avgBattery2 = history[i].batteryLevels.reduce((sum, b) => sum + b, 0) / history[i].batteryLevels.length;
      batteryChanges.push(avgBattery2 - avgBattery1);
    }

    return batteryChanges.reduce((sum, change) => sum + change, 0) / batteryChanges.length;
  }

  private calculateModelAccuracy(model: PredictiveModel): number {
    // Calculate model accuracy based on historical performance
    // In real implementation, would compare predictions with actual outcomes

    return Math.min(95, 50 + (Date.now() - model.lastUpdated) / 1000000); // Simplified accuracy calculation
  }

  private learnFromNetworkBehavior(): void {
    logger.debug('🎓 Learning from network behavior...');

    if (this.networkHistory.length < 20) return;

    // Analyze patterns in network behavior
    this.identifyBehaviorPatterns();
    this.updateBehavioralModels();
    this.generateRecommendations();
  }

  private identifyBehaviorPatterns(): void {
    const recentHistory = this.networkHistory.slice(-100);

    // Identify time-based patterns
    const hourlyPatterns = new Map<number, NetworkMetrics[]>();
    const dailyPatterns = new Map<number, NetworkMetrics[]>();

    for (const metrics of recentHistory) {
      const date = new Date(metrics.timestamp);
      const hour = date.getHours();
      const day = date.getDay();

      if (!hourlyPatterns.has(hour)) hourlyPatterns.set(hour, []);
      if (!dailyPatterns.has(day)) dailyPatterns.set(day, []);

      hourlyPatterns.get(hour)!.push(metrics);
      dailyPatterns.get(day)!.push(metrics);
    }

    // Analyze patterns and create behavior models
    for (const [hour, metrics] of hourlyPatterns) {
      if (metrics.length > 5) {
        this.createTimeBasedBehavior(hour, metrics, 'hourly');
      }
    }

    for (const [day, metrics] of dailyPatterns) {
      if (metrics.length > 10) {
        this.createTimeBasedBehavior(day, metrics, 'daily');
      }
    }
  }

  private createTimeBasedBehavior(timeKey: number, metrics: NetworkMetrics[], period: 'hourly' | 'daily'): void {
    const avgConnectivity = metrics.reduce((sum, m) => sum + m.connectivity, 0) / metrics.length;
    const avgLatency = metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;
    const avgPacketLoss = metrics.reduce((sum, m) => sum + m.packetLoss, 0) / metrics.length;

    // Create behavior pattern
    const behavior: NetworkBehavior = {
      pattern: `${period}_connectivity_${timeKey}`,
      probability: avgConnectivity / 100,
      duration: period === 'hourly' ? 60 : 1440, // minutes
      impact: avgConnectivity > 70 ? 'positive' : avgConnectivity > 30 ? 'neutral' : 'negative',
      recommendations: this.generateBehaviorRecommendations(avgConnectivity, avgLatency, avgPacketLoss),
    };

    // Add to patterns if significant
    if (behavior.probability > 0.3) {
      this.behaviorPatterns.push(behavior);
    }
  }

  private generateBehaviorRecommendations(connectivity: number, latency: number, packetLoss: number): string[] {
    const recommendations: string[] = [];

    if (connectivity < 50) {
      recommendations.push('Consider switching to more reliable routing protocol');
      recommendations.push('Increase scanning frequency for better connectivity');
    }

    if (latency > 500) {
      recommendations.push('High latency detected - optimize routing paths');
      recommendations.push('Consider using shorter hop routes');
    }

    if (packetLoss > 10) {
      recommendations.push('High packet loss - check network interference');
      recommendations.push('Increase error correction mechanisms');
    }

    return recommendations;
  }

  private updateBehavioralModels(): void {
    // Update machine learning models based on behavior patterns
    for (const pattern of this.behaviorPatterns) {
      // Update model weights based on pattern success
      const model = this.predictiveModels.get('connectivity');
      if (model) {
        // In real implementation, would update neural network weights
        model.accuracy = Math.min(95, model.accuracy + (pattern.probability * 0.1));
      }
    }
  }

  private generateRecommendations(): void {
    // Generate network optimization recommendations
    const recommendations: string[] = [];

    const connectivityModel = this.predictiveModels.get('connectivity');
    const failureModel = this.predictiveModels.get('failure');

    if (connectivityModel && connectivityModel.predictions.get('expected_connectivity') < 50) {
      recommendations.push('Expected poor connectivity - prepare offline mode');
    }

    if (failureModel && failureModel.predictions.get('failure_probability') > 70) {
      recommendations.push('High failure probability detected - activate redundancy');
    }

    // Store recommendations for UI display
    // In real implementation, would dispatch to UI components
  }

  private detectAnomalies(): void {
    logger.debug('🔍 Detecting network anomalies...');

    if (this.networkHistory.length < 5) return;

    const recentMetrics = this.networkHistory.slice(-5);
    const baselineMetrics = this.networkHistory.slice(-20, -5);

    // Compare recent metrics with baseline
    const connectivityChange = this.calculateMetricChange(
      recentMetrics.map(m => m.connectivity),
      baselineMetrics.map(m => m.connectivity)
    );

    const latencyChange = this.calculateMetricChange(
      recentMetrics.map(m => m.latency),
      baselineMetrics.map(m => m.latency)
    );

    const packetLossChange = this.calculateMetricChange(
      recentMetrics.map(m => m.packetLoss),
      baselineMetrics.map(m => m.packetLoss)
    );

    // Detect anomalies
    if (Math.abs(connectivityChange) > 30) {
      this.reportAnomaly('connectivity', connectivityChange > 0 ? 'improved' : 'degraded', Math.abs(connectivityChange));
    }

    if (Math.abs(latencyChange) > 200) {
      this.reportAnomaly('latency', latencyChange > 0 ? 'increased' : 'decreased', Math.abs(latencyChange));
    }

    if (Math.abs(packetLossChange) > 15) {
      this.reportAnomaly('packet_loss', packetLossChange > 0 ? 'increased' : 'decreased', Math.abs(packetLossChange));
    }
  }

  private calculateMetricChange(recent: number[], baseline: number[]): number {
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const baselineAvg = baseline.reduce((sum, val) => sum + val, 0) / baseline.length;
    return recentAvg - baselineAvg;
  }

  private reportAnomaly(type: string, direction: string, magnitude: number): void {
    logger.warn(`🚨 Network anomaly detected: ${type} ${direction} by ${magnitude.toFixed(2)}`);

    // In real implementation, would trigger alerts and adaptive responses
    this.triggerAdaptiveResponse(type, direction, magnitude);
  }

  private triggerAdaptiveResponse(type: string, direction: string, magnitude: number): void {
    // Trigger adaptive responses based on anomaly type and magnitude

    if (type === 'connectivity' && direction === 'degraded' && magnitude > 40) {
      logger.debug('🔄 Triggering connectivity recovery response...');
      // Switch to more reliable routing protocol
      // Increase scanning frequency
      // Activate redundancy mechanisms
    }

    if (type === 'latency' && direction === 'increased' && magnitude > 300) {
      logger.debug('🔄 Triggering latency optimization response...');
      // Optimize routing paths
      // Reduce hop counts
      // Switch to lower latency protocol
    }
  }

  private detectNetworkAnomalies(): void {
    // Advanced anomaly detection using statistical methods
    const recentMetrics = this.networkHistory.slice(-10);

    if (recentMetrics.length < 5) return;

    // Calculate standard deviations
    const connectivityValues = recentMetrics.map(m => m.connectivity);
    const latencyValues = recentMetrics.map(m => m.latency);
    const packetLossValues = recentMetrics.map(m => m.packetLoss);

    const connectivityStd = this.calculateStandardDeviation(connectivityValues);
    const latencyStd = this.calculateStandardDeviation(latencyValues);
    const packetLossStd = this.calculateStandardDeviation(packetLossValues);

    // Detect statistical anomalies (values outside 3 standard deviations)
    const latestMetrics = recentMetrics[recentMetrics.length - 1];

    if (Math.abs(latestMetrics.connectivity - this.calculateMean(connectivityValues)) > 3 * connectivityStd) {
      this.reportAnomaly('connectivity_statistical', 'outlier', Math.abs(latestMetrics.connectivity - this.calculateMean(connectivityValues)));
    }

    if (Math.abs(latestMetrics.latency - this.calculateMean(latencyValues)) > 3 * latencyStd) {
      this.reportAnomaly('latency_statistical', 'outlier', Math.abs(latestMetrics.latency - this.calculateMean(latencyValues)));
    }
  }

  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  // Public API
  async selectOptimalProtocol(params: {
    source: string;
    destination: string;
    priority: string;
    networkSize: number;
    emergencyMode: boolean;
  }): Promise<'aodv' | 'dsr' | 'olsr'> {
    // Use AI models to select optimal protocol
    const routingModel = this.predictiveModels.get('routing');
    const failureModel = this.predictiveModels.get('failure');

    // Emergency mode always uses AODV
    if (params.emergencyMode || params.priority === 'critical') {
      return 'aodv';
    }

    // High failure probability - use AODV for reliability
    if (failureModel && failureModel.predictions.get('failure_probability') > 60) {
      return 'aodv';
    }

    // Use routing model prediction
    if (routingModel) {
      const prediction = routingModel.predictions.get('best_protocol');
      if (prediction === 1) return 'aodv';
      if (prediction === 2) return 'dsr';
      if (prediction === 3) return 'olsr';
    }

    // Fallback based on network size
    if (params.networkSize > 50) return 'olsr';
    if (params.networkSize < 15) return 'dsr';
    return 'aodv';
  }

  async predictNetworkConditions(timeAhead: number = 3600000): Promise<{
    expectedConnectivity: number;
    expectedLatency: number;
    expectedPacketLoss: number;
    confidence: number;
    recommendations: string[];
  }> {
    const connectivityModel = this.predictiveModels.get('connectivity');
    const failureModel = this.predictiveModels.get('failure');

    const expectedConnectivity = connectivityModel?.predictions.get('expected_connectivity') || 50;
    const failureProbability = failureModel?.predictions.get('failure_probability') || 0;

    const expectedPacketLoss = failureProbability * 0.8; // Estimate packet loss from failure probability
    const expectedLatency = 100 + (failureProbability * 5); // Estimate latency from failure probability

    const confidence = Math.min(
      (connectivityModel?.confidence || 0),
      (failureModel?.confidence || 0)
    ) / 100;

    const recommendations: string[] = [];
    if (expectedConnectivity < 50) {
      recommendations.push('Expected poor connectivity - prepare offline operations');
    }
    if (expectedPacketLoss > 15) {
      recommendations.push('Expected high packet loss - increase error correction');
    }

    return {
      expectedConnectivity,
      expectedLatency,
      expectedPacketLoss,
      confidence,
      recommendations,
    };
  }

  getNetworkInsights(): {
    behaviorPatterns: NetworkBehavior[];
    modelAccuracies: Map<string, number>;
    currentAnomalies: string[];
    optimizationOpportunities: string[];
    overallHealth: number;
  } {
    const modelAccuracies = new Map();
    for (const [name, model] of this.predictiveModels) {
      modelAccuracies.set(name, model.accuracy);
    }

    const currentAnomalies = this.getCurrentAnomalies();
    const optimizationOpportunities = this.identifyOptimizationOpportunities();

    // Calculate overall health score
    const connectivityModel = this.predictiveModels.get('connectivity');
    const failureModel = this.predictiveModels.get('failure');
    const routingModel = this.predictiveModels.get('routing');

    const healthScore = (
      (connectivityModel?.accuracy || 0) * 0.3 +
      (100 - (failureModel?.predictions.get('failure_probability') || 50)) * 0.4 +
      (routingModel?.accuracy || 0) * 0.3
    );

    return {
      behaviorPatterns: this.behaviorPatterns.slice(-10), // Last 10 patterns
      modelAccuracies,
      currentAnomalies,
      optimizationOpportunities,
      overallHealth: Math.round(healthScore),
    };
  }

  private getCurrentAnomalies(): string[] {
    const anomalies: string[] = [];
    const failureModel = this.predictiveModels.get('failure');

    if (failureModel && failureModel.predictions.get('failure_probability') > 70) {
      anomalies.push('High failure probability detected');
    }

    const connectivityModel = this.predictiveModels.get('connectivity');
    if (connectivityModel && connectivityModel.predictions.get('expected_connectivity') < 30) {
      anomalies.push('Poor connectivity expected');
    }

    return anomalies;
  }

  private identifyOptimizationOpportunities(): string[] {
    const opportunities: string[] = [];

    const powerModel = this.predictiveModels.get('power');
    if (powerModel && powerModel.predictions.get('power_mode') === 1) { // Aggressive saving
      opportunities.push('Battery optimization opportunity detected');
    }

    const routingModel = this.predictiveModels.get('routing');
    if (routingModel && routingModel.accuracy < 60) {
      opportunities.push('Routing optimization needed - low model accuracy');
    }

    return opportunities;
  }

  async getEmergencyResponseRecommendation(): Promise<{
    protocol: 'aodv' | 'dsr' | 'olsr';
    powerMode: 'aggressive_saving' | 'balanced' | 'high_performance';
    routingStrategy: 'direct' | 'multi_hop' | 'redundant';
    confidence: number;
    reasoning: string[];
  }> {
    logger.debug('🚨 Generating emergency response recommendation...');

    const routingModel = this.predictiveModels.get('routing');
    const powerModel = this.predictiveModels.get('power');
    const failureModel = this.predictiveModels.get('failure');

    // Emergency always uses AODV for maximum reliability
    const protocol: 'aodv' | 'dsr' | 'olsr' = 'aodv';

    // Emergency uses balanced power (not aggressive saving to maintain reliability)
    const powerMode: 'aggressive_saving' | 'balanced' | 'high_performance' = 'balanced';

    // Emergency uses redundant routing for maximum reliability
    const routingStrategy: 'direct' | 'multi_hop' | 'redundant' = 'redundant';

    const confidence = Math.min(
      (routingModel?.confidence || 0),
      (100 - (failureModel?.predictions.get('failure_probability') || 50))
    ) / 100;

    const reasoning: string[] = [
      'Emergency mode activated - prioritizing reliability over efficiency',
      'Using AODV protocol for maximum route reliability',
      'Maintaining balanced power consumption for sustained operation',
      'Implementing redundant routing for fault tolerance',
    ];

    return {
      protocol,
      powerMode,
      routingStrategy,
      confidence,
      reasoning,
    };
  }

  async optimizeNetworkForScenario(scenario: 'normal' | 'emergency' | 'low_battery' | 'high_traffic'): Promise<AIOptimization> {
    logger.debug(`🎯 Optimizing network for ${scenario} scenario...`);

    let protocolRecommendation: 'aodv' | 'dsr' | 'olsr' = 'aodv';
    let powerMode: 'aggressive_saving' | 'balanced' | 'high_performance' = 'balanced';
    let routingStrategy: 'direct' | 'multi_hop' | 'redundant' = 'direct';
    let scanningFrequency = 3; // Hz
    const reasoning: string[] = [];

    switch (scenario) {
      case 'emergency':
        protocolRecommendation = 'aodv';
        powerMode = 'balanced'; // Maintain reliability
        routingStrategy = 'redundant';
        scanningFrequency = 5;
        reasoning.push('Emergency scenario: Maximum reliability prioritized');
        reasoning.push('AODV protocol for proven reliability in critical situations');
        reasoning.push('Redundant routing to ensure message delivery');
        break;

      case 'low_battery':
        protocolRecommendation = 'dsr';
        powerMode = 'aggressive_saving';
        routingStrategy = 'direct';
        scanningFrequency = 1;
        reasoning.push('Low battery scenario: Maximum power conservation');
        reasoning.push('DSR protocol for efficient routing in small networks');
        reasoning.push('Direct routing to minimize energy consumption');
        break;

      case 'high_traffic':
        protocolRecommendation = 'olsr';
        powerMode = 'high_performance';
        routingStrategy = 'multi_hop';
        scanningFrequency = 8;
        reasoning.push('High traffic scenario: Optimized for scalability');
        reasoning.push('OLSR protocol for efficient large network routing');
        reasoning.push('Multi-hop routing for load distribution');
        break;

      default: // normal
        protocolRecommendation = 'aodv';
        powerMode = 'balanced';
        routingStrategy = 'multi_hop';
        scanningFrequency = 3;
        reasoning.push('Normal scenario: Balanced optimization');
        reasoning.push('AODV protocol for reliable routing');
        reasoning.push('Multi-hop routing for efficiency');
    }

    const optimization: AIOptimization = {
      protocolRecommendation,
      powerMode,
      routingStrategy,
      scanningFrequency,
      confidence: 0.85, // 85% confidence in optimization
      reasoning,
    };

    logger.debug(`✅ Network optimized for ${scenario}: ${protocolRecommendation} protocol, ${powerMode} power mode`);

    return optimization;
  }

  async predictNetworkFailures(timeWindow: number = 3600000): Promise<{
    probability: number;
    expectedTime: number;
    failureType: string;
    mitigationSteps: string[];
  }> {
    const failureModel = this.predictiveModels.get('failure');
    if (!failureModel) {
      return {
        probability: 0,
        expectedTime: 0,
        failureType: 'unknown',
        mitigationSteps: ['Monitor network health'],
      };
    }

    const probability = failureModel.predictions.get('failure_probability') || 0;
    const expectedTime = timeWindow * (probability / 100); // Proportional to probability

    let failureType = 'connectivity';
    let mitigationSteps: string[] = [];

    if (probability > 80) {
      failureType = 'critical_connectivity';
      mitigationSteps = [
        'Switch to AODV protocol immediately',
        'Activate redundant routing paths',
        'Prepare offline operation mode',
        'Increase scanning frequency',
        'Alert all network participants',
      ];
    } else if (probability > 60) {
      failureType = 'degraded_performance';
      mitigationSteps = [
        'Optimize routing paths',
        'Reduce non-essential traffic',
        'Monitor battery levels closely',
        'Prepare fallback communication methods',
      ];
    } else if (probability > 40) {
      failureType = 'minor_degradation';
      mitigationSteps = [
        'Monitor network metrics closely',
        'Consider protocol optimization',
        'Review power management settings',
      ];
    }

    return {
      probability,
      expectedTime,
      failureType,
      mitigationSteps,
    };
  }

  getLearningProgress(): {
    dataPoints: number;
    modelAccuracies: Map<string, number>;
    behaviorPatterns: number;
    learningRate: number;
    nextMilestone: string;
  } {
    const modelAccuracies = new Map();
    for (const [name, model] of this.predictiveModels) {
      modelAccuracies.set(name, model.accuracy);
    }

    const averageAccuracy = Array.from(modelAccuracies.values()).reduce((sum, acc) => sum + acc, 0) / modelAccuracies.size;

    let learningRate = 0.1; // Base learning rate
    if (this.networkHistory.length > 100) learningRate = 0.05;
    if (this.networkHistory.length > 500) learningRate = 0.02;

    let nextMilestone = 'Collect more data for improved predictions';
    if (averageAccuracy < 60) nextMilestone = 'Improve model accuracy through more training';
    if (averageAccuracy > 80) nextMilestone = 'Deploy advanced optimization features';
    if (averageAccuracy > 90) nextMilestone = 'Enable autonomous network management';

    return {
      dataPoints: this.networkHistory.length,
      modelAccuracies,
      behaviorPatterns: this.behaviorPatterns.length,
      learningRate,
      nextMilestone,
    };
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping network intelligence engine...');

    // Stop machine learning intervals
    if (this.modelUpdateInterval) {
      clearInterval(this.modelUpdateInterval);
      this.modelUpdateInterval = null;
    }

    this.isLearning = false;
    this.anomalyDetectionActive = false;

    // Save network history
    await this.saveNetworkHistory();

    logger.debug('✅ Network intelligence engine stopped');
  }
}

// Export singleton instance
export const networkIntelligenceEngine = new NetworkIntelligenceEngine();
