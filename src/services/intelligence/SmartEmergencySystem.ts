import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../../utils/productionLogger';
import { SimpleEventEmitter } from '../../lib/SimpleEventEmitter';
import { emergencyLogger } from '../logging/EmergencyLogger';

export interface EmergencyContext {
  location: {
    lat: number;
    lon: number;
    accuracy: number;
    address?: string;
  };
  emergencyType: 'earthquake' | 'fire' | 'flood' | 'collapse' | 'medical' | 'trapped' | 'lost' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  peopleCount: number;
  accessibility: 'accessible' | 'partially_blocked' | 'blocked' | 'unknown';
  timeOfDay: 'day' | 'night' | 'dawn' | 'dusk';
  weather?: 'clear' | 'rain' | 'storm' | 'snow' | 'fog';
  resources?: {
    battery: number;
    signal: number;
    food: number;
    water: number;
    medical: boolean;
  };
  specialNeeds?: string[];
}

export interface SmartRecommendation {
  id: string;
  type: 'immediate_action' | 'safety_measure' | 'resource_management' | 'communication' | 'evacuation';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  steps: string[];
  estimatedTime?: number; // in minutes
  requiredResources?: string[];
  warnings?: string[];
  alternatives?: string[];
  aiConfidence: number; // 0-100
}

export interface EmergencyPlan {
  id: string;
  name: string;
  context: EmergencyContext;
  recommendations: SmartRecommendation[];
  estimatedSurvivalTime: number; // in hours
  rescueProbability: number; // 0-100
  lastUpdated: number;
  status: 'active' | 'completed' | 'cancelled';
}

class SmartEmergencySystem extends SimpleEventEmitter {
  private activePlans = new Map<string, EmergencyPlan>();
  private emergencyTemplates = new Map<string, any>();
  private contextualData: any = {};
  private aiModel: any = null;

  constructor() {
    super();
    this.initializeEmergencyTemplates();
    this.loadContextualData();
  }

  private initializeEmergencyTemplates() {
    logger.debug('🧠 Initializing Smart Emergency System...');

    // Earthquake templates
    this.emergencyTemplates.set('earthquake', {
      immediate_actions: [
        'Drop, Cover, and Hold On',
        'Stay away from windows and heavy objects',
        'Check for injuries',
        'Turn off gas if possible'
      ],
      safety_measures: [
        'Move to open area if safe',
        'Avoid damaged buildings',
        'Stay alert for aftershocks',
        'Use stairs, not elevators'
      ],
      resource_management: [
        'Conserve battery power',
        'Ration food and water',
        'Use phone only for emergencies',
        'Keep warm if cold weather'
      ],
      communication: [
        'Send location to emergency contacts',
        'Use SOS features',
        'Listen to emergency broadcasts',
        'Signal for help if trapped'
      ]
    });

    // Fire templates
    this.emergencyTemplates.set('fire', {
      immediate_actions: [
        'Get low and crawl to exit',
        'Feel doors before opening',
        'Cover mouth with cloth',
        'Don\'t use elevators'
      ],
      safety_measures: [
        'Stay in room if exit blocked',
        'Seal door with wet towels',
        'Signal from window',
        'Stay calm and wait for rescue'
      ],
      resource_management: [
        'Conserve oxygen',
        'Stay hydrated',
        'Keep phone charged',
        'Use flashlight sparingly'
      ],
      communication: [
        'Call emergency services',
        'Send location immediately',
        'Use emergency features',
        'Signal with light or sound'
      ]
    });

    // Medical emergency templates
    this.emergencyTemplates.set('medical', {
      immediate_actions: [
        'Assess consciousness',
        'Check breathing and pulse',
        'Apply first aid if trained',
        'Keep person still'
      ],
      safety_measures: [
        'Ensure safe environment',
        'Prevent further injury',
        'Monitor vital signs',
        'Keep person warm'
      ],
      resource_management: [
        'Use medical supplies wisely',
        'Keep person hydrated',
        'Monitor condition closely',
        'Prepare for evacuation'
      ],
      communication: [
        'Call emergency medical services',
        'Provide detailed medical info',
        'Send exact location',
        'Keep emergency contacts updated'
      ]
    });

    logger.debug('✅ Emergency templates initialized');
  }

  private async loadContextualData() {
    try {
      const stored = await AsyncStorage.getItem('emergency_contextual_data');
      if (stored) {
        this.contextualData = JSON.parse(stored);
      }
    } catch (error) {
      logger.error('❌ Failed to load contextual data:', error);
    }
  }

  private async saveContextualData() {
    try {
      await AsyncStorage.setItem('emergency_contextual_data', JSON.stringify(this.contextualData));
    } catch (error) {
      logger.error('❌ Failed to save contextual data:', error);
    }
  }

  // CRITICAL: Analyze Emergency Context and Generate Smart Plan
  async analyzeEmergencyContext(context: EmergencyContext): Promise<EmergencyPlan> {
    try {
      emergencyLogger.logSystem('info', 'Analyzing emergency context', { context });

      // Generate unique plan ID
      const planId = `emergency_plan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // Analyze context and generate recommendations
      const recommendations = await this.generateSmartRecommendations(context);

      // Calculate survival metrics
      const survivalTime = this.calculateSurvivalTime(context);
      const rescueProbability = this.calculateRescueProbability(context);

      // Create emergency plan
      const plan: EmergencyPlan = {
        id: planId,
        name: `${context.emergencyType.toUpperCase()} Emergency Plan`,
        context,
        recommendations,
        estimatedSurvivalTime: survivalTime,
        rescueProbability,
        lastUpdated: Date.now(),
        status: 'active'
      };

      // Store plan
      this.activePlans.set(planId, plan);
      await this.saveEmergencyPlan(plan);

      // Emit event
      this.emit('emergencyPlanGenerated', plan);
      emergencyLogger.logSystem('info', 'Emergency plan generated', { planId, recommendations: recommendations.length });

      return plan;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to analyze emergency context', { error: String(error) });
      throw error;
    }
  }

  // CRITICAL: Generate Smart Recommendations
  private async generateSmartRecommendations(context: EmergencyContext): Promise<SmartRecommendation[]> {
    const recommendations: SmartRecommendation[] = [];

    try {
      // Get template for emergency type
      const template = this.emergencyTemplates.get(context.emergencyType);
      if (!template) {
        throw new Error(`No template found for emergency type: ${context.emergencyType}`);
      }

      // Generate immediate action recommendations
      if (template.immediate_actions) {
        recommendations.push({
          id: `immediate_${Date.now()}`,
          type: 'immediate_action',
          priority: 'critical',
          title: 'Hemen Yapılması Gerekenler',
          description: 'Acil durumda öncelikli eylemler',
          steps: template.immediate_actions,
          estimatedTime: 5,
          aiConfidence: 95,
          warnings: ['Bu adımlar hemen uygulanmalıdır']
        });
      }

      // Generate safety measure recommendations
      if (template.safety_measures) {
        recommendations.push({
          id: `safety_${Date.now()}`,
          type: 'safety_measure',
          priority: 'high',
          title: 'Güvenlik Önlemleri',
          description: 'Kendinizi ve diğerlerini koruma yöntemleri',
          steps: template.safety_measures,
          estimatedTime: 15,
          aiConfidence: 90
        });
      }

      // Generate resource management recommendations
      if (template.resource_management) {
        const resourceSteps = this.customizeResourceManagement(template.resource_management, context);
        recommendations.push({
          id: `resource_${Date.now()}`,
          type: 'resource_management',
          priority: 'high',
          title: 'Kaynak Yönetimi',
          description: 'Mevcut kaynakları en iyi şekilde kullanma',
          steps: resourceSteps,
          estimatedTime: 10,
          aiConfidence: 85
        });
      }

      // Generate communication recommendations
      if (template.communication) {
        const commSteps = this.customizeCommunication(template.communication, context);
        recommendations.push({
          id: `communication_${Date.now()}`,
          type: 'communication',
          priority: 'critical',
          title: 'İletişim Stratejisi',
          description: 'Yardım talep etme ve iletişim kurma',
          steps: commSteps,
          estimatedTime: 5,
          aiConfidence: 92
        });
      }

      // Generate contextual recommendations based on specific conditions
      const contextualRecs = this.generateContextualRecommendations(context);
      recommendations.push(...contextualRecs);

      // Sort by priority
      recommendations.sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

      return recommendations;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to generate recommendations', { error: String(error) });
      return [{
        id: `fallback_${Date.now()}`,
        type: 'immediate_action',
        priority: 'critical',
        title: 'Temel Güvenlik',
        description: 'Genel güvenlik önlemleri',
        steps: ['Güvenli bir yere geçin', 'Yardım isteyin', 'Durumu bildirin'],
        aiConfidence: 70
      }];
    }
  }

  // Customize resource management based on context
  private customizeResourceManagement(baseSteps: string[], context: EmergencyContext): string[] {
    const customized = [...baseSteps];

    if (context.resources) {
      if (context.resources.battery < 20) {
        customized.push('Telefonu uçak moduna alın, sadece acil durumlarda kullanın');
      }
      if (context.resources.food < 30) {
        customized.push('Yemeği minimum düzeyde kullanın');
      }
      if (context.resources.water < 30) {
        customized.push('Su tüketimini sınırlayın');
      }
    }

    if (context.timeOfDay === 'night') {
      customized.push('Gece için enerji tasarrufu yapın');
    }

    if (context.weather === 'rain' || context.weather === 'storm') {
      customized.push('Yağmur suyu toplama yöntemleri araştırın');
    }

    return customized;
  }

  // Customize communication based on context
  private customizeCommunication(baseSteps: string[], context: EmergencyContext): string[] {
    const customized = [...baseSteps];

    if (context.accessibility === 'blocked') {
      customized.push('Enkaz altındaysanız, düzenli aralıklarla ses çıkarın');
      customized.push('Işık sinyali göndermeyi deneyin');
    }

    if (context.peopleCount > 1) {
      customized.push('Grup halinde kalın, ayrılmayın');
      customized.push('Bir kişi sürekli iletişim kursun');
    }

    if (context.severity === 'critical') {
      customized.push('SOS sinyali gönderin');
      customized.push('Acil durum ekiplerini bilgilendirin');
    }

    return customized;
  }

  // Generate contextual recommendations
  private generateContextualRecommendations(context: EmergencyContext): SmartRecommendation[] {
    const recommendations: SmartRecommendation[] = [];

    // Special needs recommendations
    if (context.specialNeeds && context.specialNeeds.length > 0) {
      recommendations.push({
        id: `special_needs_${Date.now()}`,
        type: 'safety_measure',
        priority: 'high',
        title: 'Özel İhtiyaçlar',
        description: 'Özel durumlar için önlemler',
        steps: context.specialNeeds,
        aiConfidence: 80
      });
    }

    // Weather-specific recommendations
    if (context.weather === 'storm') {
      recommendations.push({
        id: `storm_${Date.now()}`,
        type: 'safety_measure',
        priority: 'high',
        title: 'Fırtına Güvenliği',
        description: 'Fırtına koşullarında güvenlik',
        steps: [
          'Açık alanlardan kaçının',
          'Yıldırım çekebilecek objelerden uzak durun',
          'Güvenli bir barınak bulun'
        ],
        aiConfidence: 85
      });
    }

    // Night-time recommendations
    if (context.timeOfDay === 'night') {
      recommendations.push({
        id: `night_${Date.now()}`,
        type: 'resource_management',
        priority: 'medium',
        title: 'Gece Güvenliği',
        description: 'Gece koşullarında güvenlik',
        steps: [
          'Işık kaynaklarını koruyun',
          'Grup halinde kalın',
          'Ses çıkararak varlığınızı belli edin'
        ],
        aiConfidence: 75
      });
    }

    return recommendations;
  }

  // Calculate estimated survival time
  private calculateSurvivalTime(context: EmergencyContext): number {
    let baseTime = 72; // 72 hours base survival time

    // Adjust based on resources
    if (context.resources) {
      if (context.resources.water < 20) baseTime -= 24;
      if (context.resources.food < 20) baseTime -= 12;
      if (context.resources.battery < 10) baseTime -= 6;
      if (!context.resources.medical) baseTime -= 12;
    }

    // Adjust based on emergency type
    switch (context.emergencyType) {
      case 'medical':
        baseTime = Math.min(baseTime, 24);
        break;
      case 'fire':
        baseTime = Math.min(baseTime, 12);
        break;
      case 'trapped':
        baseTime = Math.min(baseTime, 48);
        break;
    }

    // Adjust based on accessibility
    switch (context.accessibility) {
      case 'blocked':
        baseTime = Math.min(baseTime, 36);
        break;
      case 'partially_blocked':
        baseTime = Math.min(baseTime, 60);
        break;
    }

    return Math.max(baseTime, 6); // Minimum 6 hours
  }

  // Calculate rescue probability
  private calculateRescueProbability(context: EmergencyContext): number {
    let probability = 80; // Base rescue probability

    // Adjust based on emergency type
    switch (context.emergencyType) {
      case 'earthquake':
        probability = 85;
        break;
      case 'fire':
        probability = 90;
        break;
      case 'medical':
        probability = 95;
        break;
      case 'trapped':
        probability = 70;
        break;
      case 'lost':
        probability = 75;
        break;
    }

    // Adjust based on severity
    switch (context.severity) {
      case 'critical':
        probability += 10;
        break;
      case 'high':
        probability += 5;
        break;
      case 'medium':
        probability -= 5;
        break;
      case 'low':
        probability -= 10;
        break;
    }

    // Adjust based on accessibility
    switch (context.accessibility) {
      case 'accessible':
        probability += 10;
        break;
      case 'partially_blocked':
        probability -= 5;
        break;
      case 'blocked':
        probability -= 15;
        break;
    }

    // Adjust based on resources
    if (context.resources) {
      if (context.resources.battery > 50) probability += 5;
      if (context.resources.signal > 70) probability += 10;
    }

    return Math.max(Math.min(probability, 98), 30); // Between 30-98%
  }

  // CRITICAL: Update Emergency Plan
  async updateEmergencyPlan(planId: string, updates: Partial<EmergencyPlan>): Promise<boolean> {
    try {
      const plan = this.activePlans.get(planId);
      if (!plan) {
        throw new Error(`Plan not found: ${planId}`);
      }

      // Update plan
      Object.assign(plan, updates);
      plan.lastUpdated = Date.now();

      // Re-analyze if context changed
      if (updates.context) {
        const newRecommendations = await this.generateSmartRecommendations(updates.context);
        plan.recommendations = newRecommendations;
        plan.estimatedSurvivalTime = this.calculateSurvivalTime(updates.context);
        plan.rescueProbability = this.calculateRescueProbability(updates.context);
      }

      // Save updated plan
      await this.saveEmergencyPlan(plan);

      this.emit('emergencyPlanUpdated', plan);
      emergencyLogger.logSystem('info', 'Emergency plan updated', { planId, updates });

      return true;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to update emergency plan', { error: String(error) });
      return false;
    }
  }

  // Get active emergency plans
  getActivePlans(): EmergencyPlan[] {
    return Array.from(this.activePlans.values()).filter(plan => plan.status === 'active');
  }

  // Get emergency plan by ID
  getEmergencyPlan(planId: string): EmergencyPlan | null {
    return this.activePlans.get(planId) || null;
  }

  // Save emergency plan
  private async saveEmergencyPlan(plan: EmergencyPlan): Promise<void> {
    try {
      await AsyncStorage.setItem(`emergency_plan_${plan.id}`, JSON.stringify(plan));
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to save emergency plan', { error: String(error) });
    }
  }

  // Load emergency plan
  private async loadEmergencyPlan(planId: string): Promise<EmergencyPlan | null> {
    try {
      const stored = await AsyncStorage.getItem(`emergency_plan_${planId}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to load emergency plan', { error: String(error) });
      return null;
    }
  }

  // CRITICAL: Get Real-time Emergency Advice
  async getRealTimeAdvice(context: EmergencyContext): Promise<SmartRecommendation[]> {
    try {
      const recommendations = await this.generateSmartRecommendations(context);
      
      // Filter for immediate actions only
      const immediateAdvice = recommendations.filter(rec => 
        rec.type === 'immediate_action' || rec.priority === 'critical'
      );

      emergencyLogger.logSystem('info', 'Real-time emergency advice generated', { 
        totalRecommendations: recommendations.length,
        immediateAdvice: immediateAdvice.length 
      });

      return immediateAdvice;

    } catch (error) {
      emergencyLogger.logSystem('error', 'Failed to get real-time advice', { error: String(error) });
      return [];
    }
  }
}

// Export singleton instance
export const smartEmergencySystem = new SmartEmergencySystem();
export default SmartEmergencySystem;

