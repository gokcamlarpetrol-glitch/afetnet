/**
 * AI TYPES - Type Definitions for AI Features
 * Risk scoring, preparedness plans, panic assistant
 */

// Risk Skoru
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskScore {
  level: RiskLevel;
  score: number; // 0-100
  factors: RiskFactor[];
  recommendations: string[];
  lastUpdated: number;
}

export interface RiskFactor {
  id: string;
  name: string;
  weight: number;
  value: number;
  description: string;
}

// Hazirlik Plani
export interface PreparednessPlan {
  id: string;
  title: string;
  sections: PlanSection[];
  completionRate: number;
  createdAt: number;
  updatedAt: number;
}

export interface PlanSection {
  id: string;
  title: string;
  items: PlanItem[];
  priority: 'high' | 'medium' | 'low';
}

export interface PlanItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: number;
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
}

