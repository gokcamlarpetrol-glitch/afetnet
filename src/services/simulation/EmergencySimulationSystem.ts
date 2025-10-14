import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { logger } from '../../utils/productionLogger';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: 'earthquake' | 'fire' | 'flood' | 'gas_leak' | 'medical' | 'evacuation' | 'terrorism';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  duration: number; // minutes
  objectives: SimulationObjective[];
  events: SimulationEvent[];
  rewards: SimulationReward[];
  requirements: string[];
  estimatedScore: number;
}

export interface SimulationObjective {
  id: string;
  title: string;
  description: string;
  type: 'survival' | 'rescue' | 'evacuation' | 'communication' | 'medical';
  points: number;
  completed: boolean;
  timeLimit?: number; // seconds
}

export interface SimulationEvent {
  id: string;
  title: string;
  description: string;
  type: 'hazard' | 'opportunity' | 'obstacle' | 'resource';
  timestamp: number; // seconds from start
  duration: number; // seconds
  impact: 'positive' | 'negative' | 'neutral';
  choices: SimulationChoice[];
}

export interface SimulationChoice {
  id: string;
  text: string;
  consequence: string;
  points: number;
  nextEvent?: string;
}

export interface SimulationReward {
  id: string;
  type: 'badge' | 'achievement' | 'skill_point' | 'unlock';
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface SimulationSession {
  id: string;
  scenarioId: string;
  userId: string;
  startTime: number;
  endTime?: number;
  score: number;
  objectives: SimulationObjective[];
  completedObjectives: number;
  totalObjectives: number;
  events: SimulationEvent[];
  choices: Map<string, string>; // eventId -> choiceId
  status: 'active' | 'completed' | 'failed' | 'paused';
  performance: SimulationPerformance;
}

export interface SimulationPerformance {
  responseTime: number; // average response time in seconds
  accuracy: number; // percentage of correct decisions
  survivalRate: number; // percentage of objectives completed
  efficiency: number; // score per minute
  leadership: number; // team coordination score
}

class EmergencySimulationSystem extends SimpleEventEmitter {
  private activeSimulations = new Map<string, SimulationSession>();
  private simulationScenarios = new Map<string, SimulationScenario>();
  private simulationHistory: SimulationSession[] = [];
  private userStats = new Map<string, any>();
  private isActive = false;

  constructor() {
    super();
    this.initializeSimulationScenarios();
  }

  // CRITICAL: Initialize Simulation Scenarios
  private initializeSimulationScenarios(): void {
    logger.debug('🎮 Initializing emergency simulation scenarios...');

    // Earthquake scenario
    this.addSimulationScenario({
      id: 'earthquake_simulation',
      name: 'Büyük Deprem Simülasyonu',
      description: '7.2 büyüklüğünde deprem sırasında hayatta kalma simülasyonu',
      type: 'earthquake',
      difficulty: 'intermediate',
      duration: 15,
      objectives: [
        {
          id: 'obj_1',
          title: 'Güvenli Yere Geçin',
          description: 'Deprem sırasında güvenli bir yere geçin',
          type: 'survival',
          points: 100,
          completed: false,
          timeLimit: 30
        },
        {
          id: 'obj_2',
          title: 'Acil Durum Çantasını Alın',
          description: 'Acil durum çantanızı alın ve güvenli yere götürün',
          type: 'survival',
          points: 150,
          completed: false,
          timeLimit: 120
        },
        {
          id: 'obj_3',
          title: 'Yaralı Kişiyi Kurtarın',
          description: 'Enkaz altında kalan yaralı kişiyi kurtarın',
          type: 'rescue',
          points: 300,
          completed: false,
          timeLimit: 600
        },
        {
          id: 'obj_4',
          title: 'Acil Durum Ekiplerini Arayın',
          description: '112 acil hat numarasını arayın',
          type: 'communication',
          points: 200,
          completed: false,
          timeLimit: 180
        }
      ],
      events: [
        {
          id: 'event_1',
          title: 'İlk Sarsıntı',
          description: 'Büyük bir sarsıntı başladı! Ne yapmalısınız?',
          type: 'hazard',
          timestamp: 0,
          duration: 30,
          impact: 'negative',
          choices: [
            {
              id: 'choice_1',
              text: 'Masa altına geçin',
              consequence: 'Güvenli bir yere geçtiniz. +50 puan',
              points: 50,
              nextEvent: 'event_2'
            },
            {
              id: 'choice_2',
              text: 'Merdivenlerden kaçmaya çalışın',
              consequence: 'Tehlikeli! Merdivenler çökmüş olabilir. -30 puan',
              points: -30,
              nextEvent: 'event_2'
            },
            {
              id: 'choice_3',
              text: 'Pencereye yaklaşın',
              consequence: 'Çok tehlikeli! Cam kırılabilir. -50 puan',
              points: -50,
              nextEvent: 'event_2'
            }
          ]
        },
        {
          id: 'event_2',
          title: 'Sarsıntı Durdu',
          description: 'Sarsıntı durdu. Şimdi ne yapmalısınız?',
          type: 'opportunity',
          timestamp: 30,
          duration: 60,
          impact: 'positive',
          choices: [
            {
              id: 'choice_4',
              text: 'Acil durum çantasını alın',
              consequence: 'İyi karar! Çanta alındı. +100 puan',
              points: 100,
              nextEvent: 'event_3'
            },
            {
              id: 'choice_5',
              text: 'Hemen dışarı çıkın',
              consequence: 'Çanta olmadan çıktınız. -50 puan',
              points: -50,
              nextEvent: 'event_3'
            },
            {
              id: 'choice_6',
              text: 'Önce binayı kontrol edin',
              consequence: 'Dikkatli yaklaşım. +25 puan',
              points: 25,
              nextEvent: 'event_3'
            }
          ]
        }
      ],
      rewards: [
        {
          id: 'reward_1',
          type: 'badge',
          name: 'Deprem Ustası',
          description: 'Deprem simülasyonunu başarıyla tamamladınız',
          icon: '🏆',
          rarity: 'rare'
        },
        {
          id: 'reward_2',
          type: 'skill_point',
          name: 'Hayatta Kalma +10',
          description: 'Hayatta kalma becerileriniz gelişti',
          icon: '💪',
          rarity: 'common'
        }
      ],
      requirements: ['basic_emergency_knowledge'],
      estimatedScore: 750
    });

    // Fire scenario
    this.addSimulationScenario({
      id: 'fire_simulation',
      name: 'Yangın Simülasyonu',
      description: 'Apartman yangını sırasında tahliye simülasyonu',
      type: 'fire',
      difficulty: 'beginner',
      duration: 10,
      objectives: [
        {
          id: 'fire_obj_1',
          title: 'Yangını Tespit Edin',
          description: 'Yangın belirtilerini fark edin',
          type: 'survival',
          points: 50,
          completed: false,
          timeLimit: 60
        },
        {
          id: 'fire_obj_2',
          title: 'Yangın Alarmını Çalıştırın',
          description: 'Yangın alarmını çalıştırın',
          type: 'communication',
          points: 75,
          completed: false,
          timeLimit: 30
        },
        {
          id: 'fire_obj_3',
          title: 'Güvenli Çıkış Yolunu Bulun',
          description: 'En güvenli çıkış yolunu belirleyin',
          type: 'evacuation',
          points: 150,
          completed: false,
          timeLimit: 120
        },
        {
          id: 'fire_obj_4',
          title: 'Tahliye Edin',
          description: 'Bina dışına güvenli şekilde çıkın',
          type: 'evacuation',
          points: 200,
          completed: false,
          timeLimit: 300
        }
      ],
      events: [
        {
          id: 'fire_event_1',
          title: 'Duman Kokusu',
          description: 'Yanık kokusu alıyorsunuz. Ne yapmalısınız?',
          type: 'hazard',
          timestamp: 0,
          duration: 30,
          impact: 'negative',
          choices: [
            {
              id: 'fire_choice_1',
              text: 'Dumanın kaynağını araştırın',
              consequence: 'Dumanın kaynağını buldunuz. +75 puan',
              points: 75,
              nextEvent: 'fire_event_2'
            },
            {
              id: 'fire_choice_2',
              text: 'Hemen alarmı çalıştırın',
              consequence: 'Hızlı tepki! Alarm çalıştırıldı. +100 puan',
              points: 100,
              nextEvent: 'fire_event_2'
            },
            {
              id: 'fire_choice_3',
              text: 'Koku görmezden gelin',
              consequence: 'Tehlikeli! Yangın yayılabilir. -100 puan',
              points: -100,
              nextEvent: 'fire_event_2'
            }
          ]
        }
      ],
      rewards: [
        {
          id: 'fire_reward_1',
          type: 'achievement',
          name: 'Yangın Savaşçısı',
          description: 'Yangın simülasyonunu başarıyla tamamladınız',
          icon: '🔥',
          rarity: 'epic'
        }
      ],
      requirements: [],
      estimatedScore: 475
    });

    logger.debug('✅ Simulation scenarios initialized');
  }

  // CRITICAL: Add Simulation Scenario
  addSimulationScenario(scenario: SimulationScenario): void {
    try {
      this.simulationScenarios.set(scenario.id, scenario);
      emergencyLogger.logSystem('info', 'Simulation scenario added', { scenarioId: scenario.id, name: scenario.name });
      logger.debug(`📋 Simulation scenario added: ${scenario.name}`);
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to add simulation scenario', { error: String(error) });
    }
  }

  // CRITICAL: Start Simulation
  async startSimulation(scenarioId: string, userId: string): Promise<string | null> {
    try {
      const scenario = this.simulationScenarios.get(scenarioId);
      if (!scenario) {
        logger.warn(`⚠️ Simulation scenario not found: ${scenarioId}`);
        return null;
      }

      logger.debug(`🎮 Starting simulation: ${scenario.name}`);

      const sessionId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const session: SimulationSession = {
        id: sessionId,
        scenarioId: scenarioId,
        userId: userId,
        startTime: Date.now(),
        score: 0,
        objectives: [...scenario.objectives],
        completedObjectives: 0,
        totalObjectives: scenario.objectives.length,
        events: [...scenario.events],
        choices: new Map(),
        status: 'active',
        performance: {
          responseTime: 0,
          accuracy: 0,
          survivalRate: 0,
          efficiency: 0,
          leadership: 0
        }
      };

      this.activeSimulations.set(sessionId, session);

      this.emit('simulationStarted', { session, scenario });
      emergencyLogger.logSystem('info', 'Simulation started', {
        sessionId,
        scenarioId,
        userId,
        difficulty: scenario.difficulty
      });

      logger.debug(`✅ Simulation started: ${sessionId}`);
      return sessionId;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to start simulation', { error: String(error) });
      logger.error('❌ Failed to start simulation:', error);
      return null;
    }
  }

  // CRITICAL: Process Event Choice
  async processEventChoice(sessionId: string, eventId: string, choiceId: string): Promise<boolean> {
    try {
      const session = this.activeSimulations.get(sessionId);
      if (!session) return false;

      const event = session.events.find(e => e.id === eventId);
      const choice = event?.choices.find(c => c.id === choiceId);
      
      if (!event || !choice) return false;

      // Record choice
      session.choices.set(eventId, choiceId);
      
      // Add points
      session.score += choice.points;

      // Update performance
      const responseTime = Date.now() - session.startTime;
      session.performance.responseTime = responseTime;

      this.emit('eventChoiceProcessed', { sessionId, eventId, choiceId, points: choice.points });
      emergencyLogger.logSystem('info', 'Event choice processed', {
        sessionId,
        eventId,
        choiceId,
        points: choice.points,
        consequence: choice.consequence
      });

      logger.debug(`🎯 Choice processed: ${choice.consequence}`);

      // Check for next event
      if (choice.nextEvent) {
        this.triggerNextEvent(sessionId, choice.nextEvent);
      }

      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to process event choice', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Complete Objective
  async completeObjective(sessionId: string, objectiveId: string): Promise<boolean> {
    try {
      const session = this.activeSimulations.get(sessionId);
      if (!session) return false;

      const objective = session.objectives.find(o => o.id === objectiveId);
      if (!objective || objective.completed) return false;

      objective.completed = true;
      session.completedObjectives++;

      this.emit('objectiveCompleted', { sessionId, objectiveId, objective });
      emergencyLogger.logSystem('info', 'Objective completed', {
        sessionId,
        objectiveId,
        objectiveTitle: objective.title,
        points: objective.points
      });

      logger.debug(`✅ Objective completed: ${objective.title}`);

      // Check if all objectives are completed
      if (session.completedObjectives === session.totalObjectives) {
        await this.completeSimulation(sessionId);
      }

      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to complete objective', { error: String(error) });
      return false;
    }
  }

  // CRITICAL: Complete Simulation
  private async completeSimulation(sessionId: string): Promise<void> {
    try {
      const session = this.activeSimulations.get(sessionId);
      if (!session) return;

      session.status = 'completed';
      session.endTime = Date.now();

      // Calculate final performance
      const duration = (session.endTime - session.startTime) / 1000 / 60; // minutes
      session.performance.efficiency = session.score / duration;
      session.performance.survivalRate = (session.completedObjectives / session.totalObjectives) * 100;

      // Move to history
      this.activeSimulations.delete(sessionId);
      this.simulationHistory.push(session);

      // Calculate rewards
      const rewards = this.calculateRewards(session);

      this.emit('simulationCompleted', { session, rewards });
      emergencyLogger.logSystem('info', 'Simulation completed', {
        sessionId,
        score: session.score,
        completedObjectives: session.completedObjectives,
        duration: duration
      });

      logger.debug(`🎉 Simulation completed: ${sessionId} (Score: ${session.score})`);

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to complete simulation', { error: String(error) });
    }
  }

  // CRITICAL: Calculate Rewards
  private calculateRewards(session: SimulationSession): SimulationReward[] {
    const scenario = this.simulationScenarios.get(session.scenarioId);
    if (!scenario) return [];

    const rewards: SimulationReward[] = [];

    // Base rewards for completion
    if (session.completedObjectives === session.totalObjectives) {
      rewards.push(...scenario.rewards);
    }

    // Score-based rewards
    if (session.score >= scenario.estimatedScore * 1.5) {
      rewards.push({
        id: 'high_score_reward',
        type: 'badge',
        name: 'Yüksek Skor Ustası',
        description: 'Beklenen skorun %150\'sini geçtiniz',
        icon: '⭐',
        rarity: 'epic'
      });
    }

    return rewards;
  }

  // CRITICAL: Trigger Next Event
  private triggerNextEvent(sessionId: string, nextEventId: string): void {
    const session = this.activeSimulations.get(sessionId);
    if (!session) return;

    const nextEvent = session.events.find(e => e.id === nextEventId);
    if (nextEvent) {
      this.emit('nextEventTriggered', { sessionId, event: nextEvent });
    }
  }

  // CRITICAL: Get Active Simulations
  getActiveSimulations(): SimulationSession[] {
    return Array.from(this.activeSimulations.values());
  }

  // CRITICAL: Get Simulation Scenarios
  getSimulationScenarios(): SimulationScenario[] {
    return Array.from(this.simulationScenarios.values());
  }

  // CRITICAL: Get Simulation History
  getSimulationHistory(): SimulationSession[] {
    return [...this.simulationHistory].sort((a, b) => (b.startTime - a.startTime));
  }

  // CRITICAL: Get User Statistics
  getUserStatistics(userId: string): any {
    const userSessions = this.simulationHistory.filter(s => s.userId === userId);
    
    if (userSessions.length === 0) {
      return {
        totalSimulations: 0,
        averageScore: 0,
        totalPlayTime: 0,
        completedObjectives: 0,
        badges: []
      };
    }

    const totalSimulations = userSessions.length;
    const averageScore = userSessions.reduce((sum, s) => sum + s.score, 0) / totalSimulations;
    const totalPlayTime = userSessions.reduce((sum, s) => {
      const duration = s.endTime ? (s.endTime - s.startTime) : 0;
      return sum + duration;
    }, 0);
    const completedObjectives = userSessions.reduce((sum, s) => sum + s.completedObjectives, 0);

    return {
      totalSimulations,
      averageScore,
      totalPlayTime,
      completedObjectives,
      badges: [] // TODO: Implement badge system
    };
  }

  // CRITICAL: Get System Status
  getSystemStatus(): {
    isActive: boolean;
    activeSimulations: number;
    totalScenarios: number;
    totalSessions: number;
  } {
    return {
      isActive: this.isActive,
      activeSimulations: this.activeSimulations.size,
      totalScenarios: this.simulationScenarios.size,
      totalSessions: this.simulationHistory.length
    };
  }
}

// Export singleton instance
export const emergencySimulationSystem = new EmergencySimulationSystem();
export default EmergencySimulationSystem;










