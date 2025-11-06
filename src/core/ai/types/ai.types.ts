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
}

export interface RiskFactor {
  id: string;
  name: string;
  weight: number;
  value: number;
  description: string;
  severity?: RiskLevel;
  references?: string[];
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
}

export interface PlanItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: number;
  importance?: 'critical' | 'high' | 'medium' | 'low';
  instructions?: string;
  dependsOn?: string[];
}

// Afet Ani Asistan
export interface PanicAssistantState {
  isActive: boolean;
  currentScenario: DisasterScenario | null;
  actions: EmergencyAction[];
  lastUpdate: number;
}

export type DisasterScenario = 'earthquake' | 'fire' | 'flood' | 'trapped';

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
}

