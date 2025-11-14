/**
 * AI TYPES - Type Definitions for AI Features
 * Risk scoring, preparedness plans, panic assistant
 */

// Risk Skoru
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RiskTrend = 'improving' | 'stable' | 'worsening';

export interface RiskScore {
  level: RiskLevel;
  score: number; // 0-100
  factors: RiskFactor[];
  recommendations: string[];
  insights: RiskInsight[];
  regionalSummary?: RegionalRiskSummary;
  aftershockProbability?: number; // 0-100
  trend: RiskTrend;
  lastUpdated: number;
  checklist?: string[];
  // Yeni detaylı alanlar
  buildingAnalysis?: BuildingRiskAnalysis;
  familyProfile?: FamilyRiskProfile;
  environmentalFactors?: EnvironmentalRiskFactors;
  evacuationReadiness?: EvacuationReadiness;
  historicalComparison?: HistoricalRiskComparison;
  mitigationPotential?: MitigationPotential;
  timeToSafety?: number; // dakika cinsinden tahliye süresi
  survivalProbability?: number; // 0-100
}

export interface BuildingRiskAnalysis {
  structuralIntegrity: number; // 0-100
  ageRisk: number; // 0-100
  floorRisk: number; // 0-100
  soilRisk: number; // 0-100
  maintenanceScore: number; // 0-100
  retrofitUrgency: 'none' | 'low' | 'medium' | 'high' | 'critical';
  vulnerabilities: string[];
  strengths: string[];
  estimatedDamageLevel: 'minimal' | 'light' | 'moderate' | 'severe' | 'collapse';
  evacuationTimeMinutes: number;
}

export interface FamilyRiskProfile {
  totalMembers: number;
  childrenCount: number;
  elderlyCount: number;
  disabledCount: number;
  petsCount: number;
  specialNeeds: string[];
  mobilityLimitations: boolean;
  evacuationDifficulty: 'easy' | 'moderate' | 'difficult' | 'critical';
  riskMultiplier: number; // 1.0 - 2.0 arası
  specialConsiderations: string[];
}

export interface EnvironmentalRiskFactors {
  proximityToFault: number; // km
  soilLiquefactionRisk: 'none' | 'low' | 'medium' | 'high';
  landslideRisk: 'none' | 'low' | 'medium' | 'high';
  tsunamiRisk: 'none' | 'low' | 'medium' | 'high';
  fireRisk: 'none' | 'low' | 'medium' | 'high';
  gasLineProximity: boolean;
  powerLineProximity: boolean;
  industrialProximity: boolean;
  overallEnvironmentalScore: number; // 0-100
}

export interface EvacuationReadiness {
  routeClarity: 'excellent' | 'good' | 'fair' | 'poor';
  alternativeRoutes: number;
  assemblyPointDistance: number; // km
  assemblyPointAccessibility: 'excellent' | 'good' | 'fair' | 'poor';
  vehicleAccess: boolean;
  publicTransportAccess: boolean;
  evacuationTimeEstimate: number; // dakika
  obstacles: string[];
  readinessScore: number; // 0-100
}

export interface HistoricalRiskComparison {
  previousScore?: number;
  previousDate?: number;
  scoreChange: number;
  trendDirection: RiskTrend;
  factorsImproved: string[];
  factorsWorsened: string[];
  comparisonPeriod: '24h' | '7d' | '30d' | '90d';
}

export interface MitigationPotential {
  quickWins: Array<{
    action: string;
    impact: number; // skor düşüşü (0-20)
    effort: 'low' | 'medium' | 'high';
    cost: 'free' | 'low' | 'medium' | 'high';
    timeframe: string;
  }>;
  longTermImprovements: Array<{
    action: string;
    impact: number; // skor düşüşü (0-30)
    effort: 'low' | 'medium' | 'high';
    cost: 'free' | 'low' | 'medium' | 'high';
    timeframe: string;
  }>;
  maxPotentialReduction: number; // maksimum skor düşüşü
  priorityActions: string[];
}

export interface RiskFactor {
  id: string;
  name: string;
  weight: number;
  value: number;
  description: string;
  severity?: RiskLevel;
  references?: string[];
  // Yeni detaylı alanlar
  subFactors?: RiskSubFactor[];
  impact: 'low' | 'medium' | 'high' | 'critical';
  controllability: 'high' | 'medium' | 'low' | 'none';
  mitigationOptions?: string[];
  trend?: RiskTrend;
  lastChange?: number;
}

export interface RiskSubFactor {
  id: string;
  name: string;
  value: number;
  description: string;
  contribution: number; // ana faktöre katkısı (0-100)
}

export interface RiskInsight {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  actions?: string[];
}

export interface RegionalRiskSummary {
  regionId: string;
  regionName: string;
  hazardLevel: 'very_high' | 'high' | 'medium' | 'low';
  description: string;
  distanceKm?: number;
  historicalEvents: Array<{
    year: number;
    magnitude: number;
    note: string;
  }>;
  criticalInfrastructure?: string[];
}

// Hazirlik Plani
export interface PreparednessPlan {
  id: string;
  title: string;
  sections: PlanSection[];
  completionRate: number;
  createdAt: number;
  updatedAt: number;
  personaSummary?: string;
  // Yeni detaylı alanlar
  totalItems: number;
  completedItems: number;
  criticalItemsRemaining: number;
  estimatedTotalDurationMinutes: number;
  nextDueItems?: PlanItem[];
  timeline?: PlanTimeline;
  milestones?: PlanMilestone[];
  checklist?: PlanChecklist;
  emergencyContacts?: EmergencyContact[];
  customizations?: PlanCustomization;
}

export interface PlanSection {
  id: string;
  title: string;
  items: PlanItem[];
  priority: 'high' | 'medium' | 'low';
  summary?: string;
  estimatedDurationMinutes?: number;
  resources?: string[];
  phase?: 'hazirlik' | 'tatbikat' | 'acil_durum' | 'iyilesme';
  // Yeni detaylı alanlar
  completionRate: number;
  subSections?: PlanSubSection[];
  prerequisites?: string[]; // Diğer section ID'leri
  category: 'supplies' | 'communication' | 'safety' | 'training' | 'documentation' | 'special_needs' | 'recovery';
  icon?: string;
  color?: string;
  estimatedCost?: 'free' | 'low' | 'medium' | 'high';
  difficulty?: 'easy' | 'moderate' | 'challenging';
  frequency?: 'once' | 'monthly' | 'quarterly' | 'yearly';
  lastCompleted?: number;
  nextReviewDate?: number;
}

export interface PlanSubSection {
  id: string;
  title: string;
  items: PlanItem[];
  summary?: string;
  estimatedDurationMinutes?: number;
}

export interface PlanItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: number;
  importance?: 'critical' | 'high' | 'medium' | 'low';
  instructions?: string;
  dependsOn?: string[];
  // Yeni detaylı alanlar
  subTasks?: PlanSubTask[];
  checklist?: string[]; // Alt kontrol listesi
  estimatedDurationMinutes?: number;
  estimatedCost?: number; // TL cinsinden
  location?: string; // Nerede yapılacak
  assignedTo?: string; // Kim yapacak
  category?: string;
  tags?: string[];
  notes?: string;
  attachments?: PlanAttachment[];
  reminders?: PlanReminder[];
  verificationMethod?: 'manual' | 'photo' | 'document' | 'witness';
  completedAt?: number;
  completedBy?: string;
  skipped?: boolean;
  skipReason?: string;
  difficulty?: 'easy' | 'moderate' | 'challenging';
  resources?: PlanResource[];
  relatedItems?: string[]; // İlgili item ID'leri
  progress?: number; // 0-100 arası ilerleme
}

export interface PlanSubTask {
  id: string;
  text: string;
  completed: boolean;
  estimatedDurationMinutes?: number;
  instructions?: string;
}

export interface PlanAttachment {
  id: string;
  type: 'photo' | 'document' | 'link' | 'note';
  url?: string;
  title: string;
  description?: string;
  addedAt: number;
}

export interface PlanReminder {
  id: string;
  date: number;
  message: string;
  sent: boolean;
}

export interface PlanResource {
  id: string;
  type: 'website' | 'document' | 'video' | 'contact' | 'tool' | 'app';
  title: string;
  url?: string;
  description?: string;
  phone?: string;
  email?: string;
}

export interface PlanTimeline {
  phases: TimelinePhase[];
  milestones: TimelineMilestone[];
  criticalPath: string[]; // Item ID'leri
}

export interface TimelinePhase {
  id: string;
  name: string;
  startDate: number;
  endDate?: number;
  items: string[]; // Item ID'leri
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
}

export interface TimelineMilestone {
  id: string;
  name: string;
  targetDate: number;
  items: string[]; // Item ID'leri
  completed: boolean;
  completedAt?: number;
}

export interface PlanMilestone {
  id: string;
  title: string;
  description: string;
  targetDate: number;
  items: string[]; // Item ID'leri
  completed: boolean;
  completedAt?: number;
  reward?: string; // Tamamlandığında ödül/başarı
}

export interface PlanChecklist {
  id: string;
  title: string;
  items: ChecklistItem[];
  category: string;
  completed: boolean;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  checkedAt?: number;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  phoneSecondary?: string;
  email?: string;
  address?: string;
  isOutOfCity: boolean;
  notes?: string;
  priority: 'primary' | 'secondary' | 'backup';
}

export interface PlanCustomization {
  familySize: number;
  hasChildren: boolean;
  hasElderly: boolean;
  hasPets: boolean;
  hasDisabilities: boolean;
  locationName?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  residenceType?: string;
  floorNumber?: number;
  specialNeeds?: string[];
  preferences?: {
    language?: string;
    reminderFrequency?: 'daily' | 'weekly' | 'monthly';
    notificationEnabled?: boolean;
  };
}

// Afet Ani Asistan
export interface PanicAssistantState {
  isActive: boolean;
  currentScenario: DisasterScenario | null;
  actions: EmergencyAction[];
  lastUpdate: number;
  // Yeni detaylı alanlar
  currentPhase?: 'before' | 'during' | 'after' | 'check';
  completedActionsCount: number;
  totalActionsCount: number;
  estimatedTimeRemaining?: number; // dakika
  criticalActionsRemaining: number;
  progressPercentage: number;
  lastActionCompletedAt?: number;
  scenarioContext?: DisasterScenarioContext;
}

export type DisasterScenario = 'earthquake' | 'fire' | 'flood' | 'trapped' | 'tsunami' | 'landslide' | 'storm';

export interface DisasterScenarioContext {
  magnitude?: number;
  intensity?: number;
  location?: string;
  distance?: number;
  timeSinceEvent?: number; // dakika
  aftershockRisk?: 'low' | 'medium' | 'high' | 'critical';
  buildingDamage?: 'none' | 'light' | 'moderate' | 'severe' | 'collapse';
  evacuationRequired?: boolean;
  utilitiesStatus?: {
    electricity: 'on' | 'off' | 'unknown';
    water: 'on' | 'off' | 'unknown';
    gas: 'on' | 'off' | 'unknown';
  };
}

export interface EmergencyAction {
  id: string;
  text: string;
  priority: number;
  completed: boolean;
  icon: string;
  phase: 'before' | 'during' | 'after' | 'check';
  details?: string;
  checklist?: string[];
  expectedDurationMinutes?: number;
  emergencyNumber?: string;
  // Yeni detaylı alanlar
  stepByStepGuide?: ActionStep[];
  visualGuide?: VisualGuide;
  audioInstructions?: AudioInstruction;
  videoUrl?: string;
  imageUrl?: string;
  warningLevel?: 'info' | 'warning' | 'critical' | 'emergency';
  timeCritical?: boolean; // Dakikalar içinde yapılması gereken
  dependsOn?: string[]; // Önce tamamlanması gereken aksiyon ID'leri
  location?: string; // Nerede yapılacak
  toolsNeeded?: string[]; // Gerekli araçlar
  safetyNotes?: string[]; // Güvenlik notları
  commonMistakes?: string[]; // Yaygın hatalar
  successCriteria?: string[]; // Başarı kriterleri
  relatedActions?: string[]; // İlgili aksiyon ID'leri
  estimatedRiskReduction?: number; // Risk azaltma yüzdesi (0-100)
  completedAt?: number;
  skipped?: boolean;
  skipReason?: string;
  progress?: number; // 0-100 arası ilerleme
}

export interface ActionStep {
  id: string;
  order: number;
  text: string;
  completed: boolean;
  critical: boolean;
  estimatedSeconds?: number;
  visualCue?: string; // Görsel ipucu
  audioCue?: string; // Ses ipucu
}

export interface VisualGuide {
  type: 'diagram' | 'photo' | 'illustration' | 'animation';
  url?: string;
  description: string;
  annotations?: VisualAnnotation[];
}

export interface VisualAnnotation {
  id: string;
  x: number; // 0-100 arası yüzde
  y: number; // 0-100 arası yüzde
  text: string;
  color?: string;
}

export interface AudioInstruction {
  text: string;
  language: string;
  durationSeconds?: number;
  url?: string;
  playbackSpeed?: number;
}

