import { TriageService, TriageFactors } from '../core/logic/triage';

describe('TriageService', () => {
  let triageService: TriageService;

  beforeEach(() => {
    triageService = TriageService.getInstance();
  });

  it('should calculate priority correctly for critical cases', () => {
    const criticalFactors: TriageFactors = {
      injured: true,
      underRubble: true,
      lowBattery: true,
      repeatedCalls: 3,
      volunteerNearby: false,
      timeElapsed: 90,
      peopleCount: 5,
      locationAccuracy: 150,
    };

    const priority = triageService.calculatePriority(criticalFactors);
    expect(priority).toBe(2); // Critical
  });

  it('should calculate priority correctly for high priority cases', () => {
    const highPriorityFactors: TriageFactors = {
      injured: false,
      underRubble: true,
      lowBattery: false,
      repeatedCalls: 1,
      volunteerNearby: true,
      timeElapsed: 30,
      peopleCount: 3,
      locationAccuracy: 50,
    };

    const priority = triageService.calculatePriority(highPriorityFactors);
    expect(priority).toBe(1); // High
  });

  it('should calculate priority correctly for normal cases', () => {
    const normalFactors: TriageFactors = {
      injured: false,
      underRubble: false,
      lowBattery: false,
      repeatedCalls: 0,
      volunteerNearby: false,
      timeElapsed: 10,
      peopleCount: 1,
      locationAccuracy: 10,
    };

    const priority = triageService.calculatePriority(normalFactors);
    expect(priority).toBe(0); // Normal
  });

  it('should get correct priority labels', () => {
    expect(triageService.getPriorityLabel(0)).toBe('Normal');
    expect(triageService.getPriorityLabel(1)).toBe('High');
    expect(triageService.getPriorityLabel(2)).toBe('Critical');
  });

  it('should get correct priority colors', () => {
    expect(triageService.getPriorityColor(0)).toBe('#34C759');
    expect(triageService.getPriorityColor(1)).toBe('#FF9500');
    expect(triageService.getPriorityColor(2)).toBe('#FF3B30');
  });

  it('should provide appropriate recommendations', () => {
    const criticalRecommendations = triageService.getTriageRecommendations(2);
    expect(criticalRecommendations).toContain('Immediate response required');
    expect(criticalRecommendations).toContain('Deploy emergency rescue team');

    const highRecommendations = triageService.getTriageRecommendations(1);
    expect(highRecommendations).toContain('Response within 30 minutes');

    const normalRecommendations = triageService.getTriageRecommendations(0);
    expect(normalRecommendations).toContain('Standard response procedures');
  });

  it('should detect escalation conditions', () => {
    const testMessage = {
      t: 0,
      id: 'test-message',
      ts: Date.now() - 60 * 60 * 1000, // 1 hour ago
      loc: { lat: 41.0082, lon: 28.9784, acc: 10 },
      prio: 2,
      flags: { underRubble: true, injured: true, anonymity: false },
      ppl: 1,
      ttl: 8,
    };

    const shouldEscalate = triageService.shouldEscalate(testMessage, 20, 1);
    expect(shouldEscalate).toBe(true);
  });
});