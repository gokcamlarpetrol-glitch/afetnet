// @afetnet: Reinforcement Learning Controller for Autonomous Network Optimization
// Contextual bandit/Q-learning for protocol selection and resource management

import { logger } from '../../core/utils/logger';
import { EventEmitter } from 'events';

export interface RLState {
  connectivity: number; // 0-100
  batteryLevel: number; // 0-100
  nodeCount: number;
  partitionCount: number;
  emergencyMode: boolean;
  mobility: 'static' | 'walking' | 'driving' | 'high_speed';
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk';
}

export interface RLAction {
  protocol: 'aodv' | 'dsr' | 'olsr';
  powerMode: 'ultra_low' | 'power_saver' | 'balanced' | 'high_performance' | 'emergency';
  multipathEnabled: boolean;
  samplingRate: number; // Hz
  dutyCycle: number; // %
}

export interface RLReward {
  deliverySuccess: number; // 0-1
  latency: number; // ms
  batteryConsumption: number; // mAh
  partitionTolerance: number; // 0-1
  securityScore: number; // 0-100
}

export interface RLExperience {
  state: RLState;
  action: RLAction;
  reward: RLReward;
  nextState: RLState;
  timestamp: number;
}

export interface RLConfig {
  epsilonGreedy: number; // Exploration rate
  learningRate: number; // Alpha
  discountFactor: number; // Gamma
  maxEpisodes: number;
  experienceBufferSize: number;
  rewardWeights: {
    deliverySuccess: number;
    latency: number;
    batteryConsumption: number;
    partitionTolerance: number;
    securityScore: number;
  };
}

export class ReinforcementLearningController extends EventEmitter {
  private qTable: Map<string, Map<string, number>> = new Map(); // state -> action -> qValue
  private experienceBuffer: RLExperience[] = [];
  private episodeCount = 0;
  private config: RLConfig;
  private isLearning = false;
  private lastAction: RLAction | null = null;
  private lastState: RLState | null = null;

  constructor() {
    super();
    this.config = {
      epsilonGreedy: 0.1, // 10% exploration
      learningRate: 0.1,
      discountFactor: 0.9,
      maxEpisodes: 1000,
      experienceBufferSize: 10000,
      rewardWeights: {
        deliverySuccess: 0.3,
        latency: 0.2,
        batteryConsumption: 0.2,
        partitionTolerance: 0.2,
        securityScore: 0.1,
      },
    };
  }

  async initialize(): Promise<void> {
    logger.debug('🧠 Initializing reinforcement learning controller...');

    this.isLearning = true;
    logger.debug('✅ Reinforcement learning controller initialized');
  }

  // @afetnet: Select optimal action for current state
  selectAction(state: RLState): RLAction {
    try {
      // Epsilon-greedy exploration
      if (Math.random() < this.config.epsilonGreedy) {
        // Explore: random action
        return this.getRandomAction();
      } else {
        // Exploit: best known action
        return this.getBestAction(state);
      }
    } catch (error) {
      logger.error('Failed to select RL action:', error);
      return this.getDefaultAction();
    }
  }

  // @afetnet: Update Q-table with experience
  updateQValue(experience: RLExperience): void {
    try {
      const stateKey = this.stateToKey(experience.state);
      const actionKey = this.actionToKey(experience.action);
      const nextStateKey = this.stateToKey(experience.nextState);

      const currentQ = this.getQValue(stateKey, actionKey);
      const reward = this.calculateReward(experience.reward);
      const maxNextQ = this.getMaxQValue(nextStateKey);

      // Q-learning update: Q(s,a) = Q(s,a) + α[r + γ max Q(s',a') - Q(s,a)]
      const newQ = currentQ + this.config.learningRate * (
        reward + this.config.discountFactor * maxNextQ - currentQ
      );

      this.setQValue(stateKey, actionKey, newQ);

      // Store experience
      this.experienceBuffer.push(experience);
      if (this.experienceBuffer.length > this.config.experienceBufferSize) {
        this.experienceBuffer.shift();
      }

      this.episodeCount++;

      logger.debug(`🧠 Q-value updated: ${stateKey} -> ${actionKey} = ${newQ.toFixed(3)}`);
    } catch (error) {
      logger.error('Failed to update Q-value:', error);
    }
  }

  // @afetnet: Convert state to string key
  private stateToKey(state: RLState): string {
    return `${state.connectivity}_${state.batteryLevel}_${state.nodeCount}_${state.partitionCount}_${state.emergencyMode}_${state.mobility}_${state.timeOfDay}`;
  }

  // @afetnet: Convert action to string key
  private actionToKey(action: RLAction): string {
    return `${action.protocol}_${action.powerMode}_${action.multipathEnabled}_${action.samplingRate}_${action.dutyCycle}`;
  }

  private getRandomAction(): RLAction {
    const protocols: RLAction['protocol'][] = ['aodv', 'dsr', 'olsr'];
    const powerModes: RLAction['powerMode'][] = ['ultra_low', 'power_saver', 'balanced', 'high_performance', 'emergency'];
    const samplingRates = [1, 5, 10, 20, 50];

    return {
      protocol: protocols[Math.floor(Math.random() * protocols.length)],
      powerMode: powerModes[Math.floor(Math.random() * powerModes.length)],
      multipathEnabled: Math.random() > 0.5,
      samplingRate: samplingRates[Math.floor(Math.random() * samplingRates.length)],
      dutyCycle: Math.floor(Math.random() * 100) + 1,
    };
  }

  private getBestAction(state: RLState): RLAction {
    const stateKey = this.stateToKey(state);
    const stateActions = this.qTable.get(stateKey);

    if (!stateActions || stateActions.size === 0) {
      return this.getRandomAction();
    }

    // Find action with highest Q-value
    let bestAction: RLAction = this.getDefaultAction();
    let bestQValue = -Infinity;

    for (const [actionKey, qValue] of stateActions) {
      if (qValue > bestQValue) {
        bestQValue = qValue;
        bestAction = this.keyToAction(actionKey);
      }
    }

    return bestAction;
  }

  private getDefaultAction(): RLAction {
    return {
      protocol: 'aodv',
      powerMode: 'balanced',
      multipathEnabled: true,
      samplingRate: 10,
      dutyCycle: 60,
    };
  }

  private getQValue(stateKey: string, actionKey: string): number {
    const stateActions = this.qTable.get(stateKey);
    return stateActions?.get(actionKey) || 0;
  }

  private setQValue(stateKey: string, actionKey: string, value: number): void {
    let stateActions = this.qTable.get(stateKey);
    if (!stateActions) {
      stateActions = new Map();
      this.qTable.set(stateKey, stateActions);
    }
    stateActions.set(actionKey, value);
  }

  private getMaxQValue(stateKey: string): number {
    const stateActions = this.qTable.get(stateKey);
    if (!stateActions || stateActions.size === 0) return 0;

    let maxQ = -Infinity;
    for (const qValue of stateActions.values()) {
      maxQ = Math.max(maxQ, qValue);
    }
    return maxQ;
  }

  private keyToAction(actionKey: string): RLAction {
    const [protocol, powerMode, multipathEnabled, samplingRate, dutyCycle] = actionKey.split('_');

    return {
      protocol: protocol as RLAction['protocol'],
      powerMode: powerMode as RLAction['powerMode'],
      multipathEnabled: multipathEnabled === 'true',
      samplingRate: parseInt(samplingRate),
      dutyCycle: parseInt(dutyCycle),
    };
  }

  private calculateReward(reward: RLReward): number {
    // Weighted reward calculation
    const weights = this.config.rewardWeights;

    // Normalize and weight components
    const deliveryScore = reward.deliverySuccess;
    const latencyScore = Math.max(0, 1 - (reward.latency / 10000)); // Lower latency = higher score
    const batteryScore = Math.max(0, 1 - (reward.batteryConsumption / 1000)); // Lower consumption = higher score
    const partitionScore = reward.partitionTolerance;
    const securityScore = reward.securityScore / 100;

    const totalReward = (
      deliveryScore * weights.deliverySuccess +
      latencyScore * weights.latency +
      batteryScore * weights.batteryConsumption +
      partitionScore * weights.partitionTolerance +
      securityScore * weights.securityScore
    );

    return totalReward;
  }

  // @afetnet: Record experience for learning
  recordExperience(state: RLState, action: RLAction, reward: RLReward, nextState: RLState): void {
    const experience: RLExperience = {
      state,
      action,
      reward,
      nextState,
      timestamp: Date.now(),
    };

    this.updateQValue(experience);
    this.emit('experience', experience);
  }

  // @afetnet: Get learning statistics
  getLearningStats(): {
    episodes: number;
    experiences: number;
    averageReward: number;
    explorationRate: number;
    qTableSize: number;
  } {
    const totalRewards = this.experienceBuffer.reduce((sum, exp) => sum + this.calculateReward(exp.reward), 0);
    const averageReward = this.experienceBuffer.length > 0 ? totalRewards / this.experienceBuffer.length : 0;

    return {
      episodes: this.episodeCount,
      experiences: this.experienceBuffer.length,
      averageReward,
      explorationRate: this.config.epsilonGreedy,
      qTableSize: this.qTable.size,
    };
  }

  // @afetnet: Update exploration rate (decay epsilon)
  updateExplorationRate(): void {
    // Decay epsilon over time
    this.config.epsilonGreedy = Math.max(0.01, this.config.epsilonGreedy * 0.995);

    logger.debug(`🧠 Exploration rate updated: ${this.config.epsilonGreedy.toFixed(3)}`);
  }

  // @afetnet: Export Q-table for analysis
  exportQTable(): Record<string, Record<string, number>> {
    const exportData: Record<string, Record<string, number>> = {};

    for (const [stateKey, actionMap] of this.qTable) {
      exportData[stateKey] = Object.fromEntries(actionMap);
    }

    return exportData;
  }

  // @afetnet: Import Q-table from backup
  importQTable(qTableData: Record<string, Record<string, number>>): void {
    this.qTable.clear();

    for (const [stateKey, actionMap] of Object.entries(qTableData)) {
      const map = new Map(Object.entries(actionMap));
      this.qTable.set(stateKey, map);
    }

    logger.debug('🧠 Q-table imported');
  }

  // @afetnet: Reset learning (clear Q-table and experience)
  resetLearning(): void {
    this.qTable.clear();
    this.experienceBuffer = [];
    this.episodeCount = 0;
    this.lastAction = null;
    this.lastState = null;

    logger.debug('🧠 Learning reset');
  }

  // @afetnet: Get action recommendations for current state
  getRecommendations(state: RLState): {
    bestAction: RLAction;
    confidence: number;
    alternativeActions: RLAction[];
  } {
    const bestAction = this.getBestAction(state);
    const stateKey = this.stateToKey(state);
    const stateActions = this.qTable.get(stateKey);

    let confidence = 0;
    if (stateActions && stateActions.size > 0) {
      const maxQ = Math.max(...Array.from(stateActions.values()));
      const minQ = Math.min(...Array.from(stateActions.values()));
      confidence = stateActions.size > 1 ? (maxQ - minQ) / Math.abs(maxQ) : 0.5;
    }

    // Generate alternative actions
    const alternativeActions = this.generateAlternativeActions(bestAction);

    return {
      bestAction,
      confidence: Math.max(0, Math.min(1, confidence)),
      alternativeActions,
    };
  }

  private generateAlternativeActions(bestAction: RLAction): RLAction[] {
    const alternatives: RLAction[] = [];

    // Generate variations of the best action
    const protocols: RLAction['protocol'][] = ['aodv', 'dsr', 'olsr'];
    const powerModes: RLAction['powerMode'][] = ['ultra_low', 'power_saver', 'balanced', 'high_performance', 'emergency'];

    for (const protocol of protocols.filter(p => p !== bestAction.protocol)) {
      alternatives.push({
        ...bestAction,
        protocol,
      });
    }

    for (const powerMode of powerModes.filter(p => p !== bestAction.powerMode)) {
      alternatives.push({
        ...bestAction,
        powerMode,
      });
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  // @afetnet: Check if learning should continue
  shouldContinueLearning(): boolean {
    return this.episodeCount < this.config.maxEpisodes && this.isLearning;
  }

  // @afetnet: Get exploration vs exploitation ratio
  getExplorationStats(): {
    explorationCount: number;
    exploitationCount: number;
    explorationRate: number;
    convergenceScore: number;
  } {
    const totalActions = this.episodeCount;
    const explorationCount = Math.floor(totalActions * this.config.epsilonGreedy);
    const exploitationCount = totalActions - explorationCount;

    // Simple convergence score based on Q-value stability
    let convergenceScore = 0;
    if (this.qTable.size > 0) {
      const allQValues = Array.from(this.qTable.values()).flatMap(actionMap => Array.from(actionMap.values()));
      const avgQValue = allQValues.reduce((sum, q) => sum + q, 0) / allQValues.length;
      const variance = allQValues.reduce((sum, q) => sum + Math.pow(q - avgQValue, 2), 0) / allQValues.length;
      convergenceScore = Math.max(0, 1 - variance);
    }

    return {
      explorationCount,
      exploitationCount,
      explorationRate: this.config.epsilonGreedy,
      convergenceScore,
    };
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping reinforcement learning controller...');

    this.isLearning = false;
    logger.debug('✅ Reinforcement learning controller stopped');
  }
}

// @afetnet: Export singleton instance
export const reinforcementLearningController = new ReinforcementLearningController();















