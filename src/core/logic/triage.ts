import { MessageData, Priority } from '../data/models';

export interface TriageFactors {
  injured: boolean;
  underRubble: boolean;
  lowBattery: boolean;
  repeatedCalls: number;
  volunteerNearby: boolean;
  timeElapsed: number; // minutes since incident
  peopleCount: number;
  locationAccuracy: number;
}

export class TriageService {
  private static instance: TriageService;

  private constructor() {}

  static getInstance(): TriageService {
    if (!TriageService.instance) {
      TriageService.instance = new TriageService();
    }
    return TriageService.instance;
  }

  calculatePriority(factors: TriageFactors): Priority {
    let score = 0;

    // Critical factors (automatic high priority)
    if (factors.injured) {
      score += 50;
    }

    if (factors.underRubble) {
      score += 40;
    }

    // High priority factors
    if (factors.lowBattery) {
      score += 20;
    }

    if (factors.peopleCount > 5) {
      score += 15;
    }

    if (factors.volunteerNearby) {
      score += 10;
    }

    // Time-based urgency
    if (factors.timeElapsed > 60) { // More than 1 hour
      score += 15;
    } else if (factors.timeElapsed > 30) { // More than 30 minutes
      score += 10;
    }

    // Repeated calls increase urgency
    if (factors.repeatedCalls > 3) {
      score += 15;
    } else if (factors.repeatedCalls > 1) {
      score += 8;
    }

    // Location accuracy affects priority
    if (factors.locationAccuracy > 100) { // Poor location accuracy
      score += 5;
    }

    // Determine priority based on score
    if (score >= 40) {
      return 2; // Critical (Red)
    } else if (score >= 20) {
      return 1; // High (Yellow)
    } else {
      return 0; // Normal (Green)
    }
  }

  scoreMessage(message: MessageData): number {
    const factors: TriageFactors = {
      injured: message.flags.injured,
      underRubble: message.flags.underRubble,
      lowBattery: message.batt !== undefined && message.batt < 20,
      repeatedCalls: 0, // Would need to be tracked separately
      volunteerNearby: false, // Would need location-based check
      timeElapsed: this.getTimeElapsed(message.ts),
      peopleCount: message.ppl,
      locationAccuracy: message.loc.acc,
    };

    return this.calculatePriority(factors);
  }

  private getTimeElapsed(timestamp: number): number {
    const now = Date.now();
    const elapsed = now - timestamp;
    return Math.floor(elapsed / (1000 * 60)); // Convert to minutes
  }

  getPriorityLabel(priority: Priority): string {
    switch (priority) {
      case 2:
        return 'Critical';
      case 1:
        return 'High';
      case 0:
        return 'Normal';
      default:
        return 'Unknown';
    }
  }

  getPriorityColor(priority: Priority): string {
    switch (priority) {
      case 2:
        return '#FF3B30'; // Red
      case 1:
        return '#FF9500'; // Orange
      case 0:
        return '#34C759'; // Green
      default:
        return '#8E8E93'; // Gray
    }
  }

  // Advanced triage logic for complex scenarios
  calculateAdvancedPriority(
    message: MessageData,
    additionalFactors: {
      weatherConditions?: 'severe' | 'moderate' | 'mild';
      timeOfDay?: 'night' | 'day';
      areaRisk?: 'high' | 'medium' | 'low';
      resourceAvailability?: 'low' | 'medium' | 'high';
    } = {}
  ): Priority {
    const basePriority = this.scoreMessage(message);
    let adjustedPriority = basePriority;

    // Weather conditions
    if (additionalFactors.weatherConditions === 'severe') {
      adjustedPriority = Math.min(adjustedPriority + 1, 2);
    }

    // Time of day (night increases urgency)
    if (additionalFactors.timeOfDay === 'night') {
      adjustedPriority = Math.min(adjustedPriority + 1, 2);
    }

    // Area risk level
    if (additionalFactors.areaRisk === 'high') {
      adjustedPriority = Math.min(adjustedPriority + 1, 2);
    }

    // Resource availability (low availability increases priority)
    if (additionalFactors.resourceAvailability === 'low') {
      adjustedPriority = Math.min(adjustedPriority + 1, 2);
    }

    return adjustedPriority as Priority;
  }

  // Batch processing for multiple messages
  batchCalculatePriority(messages: MessageData[]): Map<string, Priority> {
    const priorities = new Map<string, Priority>();

    for (const message of messages) {
      const priority = this.scoreMessage(message);
      priorities.set(message.id, priority);
    }

    return priorities;
  }

  // Get triage recommendations
  getTriageRecommendations(priority: Priority): string[] {
    switch (priority) {
      case 2: // Critical
        return [
          'Immediate response required',
          'Deploy emergency rescue team',
          'Alert medical personnel',
          'Coordinate with local authorities',
          'Prepare evacuation if necessary',
        ];
      case 1: // High
        return [
          'Response within 30 minutes',
          'Assess situation on site',
          'Prepare rescue equipment',
          'Monitor for escalation',
        ];
      case 0: // Normal
        return [
          'Standard response procedures',
          'Regular monitoring',
          'Document situation',
          'Provide updates to affected',
        ];
      default:
        return ['Unable to determine recommendations'];
    }
  }

  // Emergency escalation logic
  shouldEscalate(
    message: MessageData,
    timeSinceLastUpdate: number,
    previousPriority: Priority
  ): boolean {
    const currentPriority = this.scoreMessage(message);
    const timeElapsed = this.getTimeElapsed(message.ts);

    // Always escalate if priority increased
    if (currentPriority > previousPriority) {
      return true;
    }

    // Escalate if critical message is old
    if (currentPriority === 2 && timeElapsed > 30) {
      return true;
    }

    // Escalate if high priority message is very old
    if (currentPriority === 1 && timeElapsed > 60) {
      return true;
    }

    // Escalate if no update for too long
    if (timeSinceLastUpdate > 15) { // 15 minutes without update
      return true;
    }

    return false;
  }
}