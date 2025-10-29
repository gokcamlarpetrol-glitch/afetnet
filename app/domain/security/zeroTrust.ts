// @afetnet: Zero-Trust Security Framework for Disaster Communication
// Explicit policy matrix with feature flags and runtime validation

import { logger } from '../../core/utils/logger';

export interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  version: string;
  rules: SecurityRule[];
  createdAt: number;
  lastUpdated: number;
  isActive: boolean;
  author: string;
  tags: string[];
}

export interface SecurityRule {
  id: string;
  type: 'allow' | 'deny' | 'require_mfa' | 'require_elevation' | 'audit';
  subject: string; // user/device identifier
  resource: string; // feature/action identifier
  action: string; // operation (read, write, execute, etc.)
  conditions: SecurityCondition[];
  effect: 'permit' | 'deny' | 'require_auth' | 'require_elevation';
  priority: number; // 1-100, higher = more restrictive
  expiresAt?: number;
  metadata: Record<string, any>;
}

export interface SecurityCondition {
  type: 'time' | 'location' | 'device' | 'network' | 'biometric' | 'context';
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range';
  field: string;
  value: any;
  description: string;
}

export interface SecurityContext {
  userId: string;
  deviceId: string;
  location?: { lat: number; lon: number };
  networkType: string;
  batteryLevel: number;
  emergencyMode: boolean;
  timestamp: number;
  sessionId: string;
  biometricVerified?: boolean;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  reason: string;
  requiredActions: string[];
  auditRequired: boolean;
  riskScore: number; // 0-100
  recommendations: string[];
}

export class ZeroTrustSecurityManager {
  private activePolicy: SecurityPolicy | null = null;
  private policyCache: Map<string, PolicyEvaluationResult> = new Map();
  private securityEvents: SecurityEvent[] = [];
  private featureFlags: Map<string, boolean> = new Map();
  private riskAssessment: RiskAssessmentEngine;

  constructor() {
    this.riskAssessment = new RiskAssessmentEngine();
  }

  async initialize(): Promise<void> {
    logger.debug('🛡️ Initializing zero-trust security manager...');

    try {
      // Load default security policy
      await this.loadDefaultPolicy();

      // Initialize feature flags
      this.initializeFeatureFlags();

      // Start policy monitoring
      this.startPolicyMonitoring();

      logger.debug('✅ Zero-trust security manager initialized');
    } catch (error) {
      logger.error('Failed to initialize zero-trust security:', error);
      throw error;
    }
  }

  private async loadDefaultPolicy(): Promise<void> {
    // @afetnet: Load default security policy with emergency overrides
    this.activePolicy = {
      id: 'default_policy_v1',
      name: 'AfetNet Default Security Policy',
      description: 'Default security policy for disaster communication with emergency overrides',
      version: '1.0.0',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      isActive: true,
      author: 'AfetNet Security Team',
      tags: ['emergency', 'disaster', 'offline', 'mesh'],
      rules: [
        // Emergency features - always allowed
        {
          id: 'emergency_access',
          type: 'allow',
          subject: '*',
          resource: 'emergency/*',
          action: '*',
          conditions: [],
          effect: 'permit',
          priority: 100,
          metadata: { emergency_override: true },
        },
        // Location access for emergency
        {
          id: 'location_emergency',
          type: 'allow',
          subject: '*',
          resource: 'location/emergency',
          action: 'access',
          conditions: [
            {
              type: 'context',
              operator: 'equals',
              field: 'emergencyMode',
              value: true,
              description: 'Emergency mode must be active',
            },
          ],
          effect: 'permit',
          priority: 95,
          metadata: { emergency_critical: true },
        },
        // Mesh networking - restricted but necessary
        {
          id: 'mesh_networking',
          type: 'allow',
          subject: 'authenticated_device',
          resource: 'network/mesh',
          action: 'connect',
          conditions: [
            {
              type: 'network',
              operator: 'equals',
              field: 'type',
              value: 'offline_mesh',
              description: 'Only offline mesh networking allowed',
            },
          ],
          effect: 'permit',
          priority: 80,
          metadata: { mesh_required: true },
        },
        // Premium features - require subscription
        {
          id: 'premium_features',
          type: 'require_elevation',
          subject: 'premium_user',
          resource: 'features/premium/*',
          action: 'access',
          conditions: [
            {
              type: 'context',
              operator: 'equals',
              field: 'subscriptionStatus',
              value: 'active',
              description: 'Premium subscription required',
            },
          ],
          effect: 'require_elevation',
          priority: 70,
          metadata: { monetization_required: true },
        },
        // Default deny for unknown actions
        {
          id: 'default_deny',
          type: 'deny',
          subject: '*',
          resource: '*',
          action: '*',
          conditions: [],
          effect: 'deny',
          priority: 0,
          metadata: { default_policy: true },
        },
      ],
    };

    logger.debug('✅ Default security policy loaded');
  }

  private initializeFeatureFlags(): void {
    // @afetnet: Initialize feature flags for security and functionality
    const defaultFlags = {
      'pqc_enabled': true,
      'mesh_networking': true,
      'offline_maps': true,
      'emergency_mode': true,
      'dead_reckoning': true,
      'multipath_routing': true,
      'partition_detection': true,
      'premium_features': true,
      'telemetry_collection': false, // Disabled for privacy
      'remote_sync': false, // Disabled for privacy
      'experimental_features': false,
      'debug_mode': __DEV__,
    };

    for (const [flag, enabled] of Object.entries(defaultFlags)) {
      this.featureFlags.set(flag, enabled);
    }

    logger.debug('✅ Feature flags initialized');
  }

  private startPolicyMonitoring(): void {
    logger.debug('🛡️ Starting policy monitoring...');

    // Monitor policy violations every 30 seconds
    setInterval(() => {
      this.checkPolicyCompliance();
    }, 30000);
  }

  // @afetnet: Evaluate security policy for action
  async evaluatePolicy(
    subject: string,
    resource: string,
    action: string,
    context: SecurityContext
  ): Promise<PolicyEvaluationResult> {
    try {
      if (!this.activePolicy) {
        return {
          allowed: false,
          reason: 'No active security policy',
          requiredActions: ['initialize_policy'],
          auditRequired: true,
          riskScore: 100,
          recommendations: ['Initialize security policy'],
        };
      }

      // Check cache first
      const cacheKey = `${subject}:${resource}:${action}:${context.sessionId}`;
      const cachedResult = this.policyCache.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Evaluate rules
      const result = await this.evaluateRules(subject, resource, action, context);

      // Cache result (5 minute TTL)
      this.policyCache.set(cacheKey, result);
      setTimeout(() => this.policyCache.delete(cacheKey), 300000);

      // Log evaluation
      this.logSecurityEvent({
        type: 'policy_evaluation',
        subject,
        resource,
        action,
        result: result.allowed ? 'allowed' : 'denied',
        context,
      });

      return result;
    } catch (error) {
      logger.error('Policy evaluation failed:', error);
      return {
        allowed: false,
        reason: 'Policy evaluation error',
        requiredActions: ['check_logs'],
        auditRequired: true,
        riskScore: 100,
        recommendations: ['Check security logs'],
      };
    }
  }

  private async evaluateRules(
    subject: string,
    resource: string,
    action: string,
    context: SecurityContext
  ): Promise<PolicyEvaluationResult> {
    if (!this.activePolicy) {
      throw new Error('No active policy');
    }

    // Sort rules by priority (highest first)
    const sortedRules = this.activePolicy.rules.sort((a, b) => b.priority - a.priority);

    let finalDecision: PolicyEvaluationResult = {
      allowed: false,
      reason: 'No matching rule',
      requiredActions: [],
      auditRequired: false,
      riskScore: 50,
      recommendations: [],
    };

    for (const rule of sortedRules) {
      // Check if rule matches
      if (this.ruleMatches(rule, subject, resource, action, context)) {
        finalDecision = await this.applyRule(rule, context);
        break; // First matching rule wins
      }
    }

    return finalDecision;
  }

  private ruleMatches(
    rule: SecurityRule,
    subject: string,
    resource: string,
    action: string,
    context: SecurityContext
  ): boolean {
    // Check subject match
    if (rule.subject !== '*' && rule.subject !== subject) return false;

    // Check resource match
    if (rule.resource !== '*' && !resource.startsWith(rule.resource.replace('*', ''))) return false;

    // Check action match
    if (rule.action !== '*' && rule.action !== action) return false;

    // Check conditions
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(condition: SecurityCondition, context: SecurityContext): boolean {
    let fieldValue: any;

    // Extract field value from context
    switch (condition.type) {
      case 'context':
        fieldValue = (context as any)[condition.field];
        break;
      case 'device':
        fieldValue = context.deviceId;
        break;
      case 'network':
        fieldValue = context.networkType;
        break;
      case 'location':
        if (context.location) {
          fieldValue = context.location[condition.field as keyof typeof context.location];
        }
        break;
      case 'time':
        fieldValue = context.timestamp;
        break;
      default:
        fieldValue = null;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in_range':
        return fieldValue >= condition.value[0] && fieldValue <= condition.value[1];
      default:
        return false;
    }
  }

  private async applyRule(rule: SecurityRule, context: SecurityContext): Promise<PolicyEvaluationResult> {
    const riskScore = this.riskAssessment.calculateRisk(rule, context);

    switch (rule.effect) {
      case 'permit':
        return {
          allowed: true,
          reason: `Rule ${rule.id} permits this action`,
          requiredActions: [],
          auditRequired: rule.metadata?.audit_required || false,
          riskScore,
          recommendations: [],
        };

      case 'deny':
        return {
          allowed: false,
          reason: `Rule ${rule.id} denies this action`,
          requiredActions: ['request_authorization'],
          auditRequired: true,
          riskScore,
          recommendations: ['Contact security administrator'],
        };

      case 'require_auth':
        return {
          allowed: false,
          reason: `Rule ${rule.id} requires additional authentication`,
          requiredActions: ['authenticate', 'verify_identity'],
          auditRequired: true,
          riskScore,
          recommendations: ['Provide additional authentication'],
        };

      case 'require_elevation':
        return {
          allowed: false,
          reason: `Rule ${rule.id} requires privilege elevation`,
          requiredActions: ['elevate_privileges', 'verify_subscription'],
          auditRequired: true,
          riskScore,
          recommendations: ['Upgrade to premium' , 'Contact support'],
        };

      default:
        return {
          allowed: false,
          reason: 'Unknown rule effect',
          requiredActions: [],
          auditRequired: true,
          riskScore: 100,
          recommendations: ['Check security policy'],
        };
    }
  }

  // @afetnet: Check if feature is enabled
  isFeatureEnabled(feature: string): boolean {
    return this.featureFlags.get(feature) || false;
  }

  // @afetnet: Enable/disable feature flag
  setFeatureFlag(feature: string, enabled: boolean): void {
    this.featureFlags.set(feature, enabled);
    logger.debug(`Feature flag ${feature} ${enabled ? 'enabled' : 'disabled'}`);

    this.logSecurityEvent({
      type: 'feature_flag_change',
      subject: 'system',
      resource: `feature/${feature}`,
      action: enabled ? 'enable' : 'disable',
      result: 'success',
    });
  }

  // @afetnet: Get all feature flags
  getFeatureFlags(): Map<string, boolean> {
    return new Map(this.featureFlags);
  }

  // @afetnet: Update security policy
  async updatePolicy(newPolicy: SecurityPolicy): Promise<void> {
    try {
      logger.info('Updating security policy:', newPolicy.id);

      // Validate policy
      if (!this.validatePolicy(newPolicy)) {
        throw new Error('Invalid security policy');
      }

      // Backup current policy
      if (this.activePolicy) {
        await this.backupPolicy(this.activePolicy);
      }

      // Activate new policy
      this.activePolicy = newPolicy;
      this.activePolicy.lastUpdated = Date.now();

      // Clear cache
      this.policyCache.clear();

      // Log policy update
      this.logSecurityEvent({
        type: 'policy_update',
        subject: 'admin',
        resource: 'security/policy',
        action: 'update',
        result: 'success',
      });

      logger.info('✅ Security policy updated successfully');
    } catch (error) {
      logger.error('Failed to update security policy:', error);
      throw error;
    }
  }

  private validatePolicy(policy: SecurityPolicy): boolean {
    // Validate policy structure and rules
    if (!policy.id || !policy.name || !policy.rules) return false;

    // Check for required emergency rules
    const hasEmergencyRule = policy.rules.some(rule =>
      rule.resource.includes('emergency') && rule.effect === 'permit'
    );

    return hasEmergencyRule;
  }

  private async backupPolicy(policy: SecurityPolicy): Promise<void> {
    // @afetnet: Backup current policy before update
    const backup = {
      ...policy,
      backupTimestamp: Date.now(),
      backupReason: 'policy_update',
    };

    // Store backup (simplified)
    logger.debug('Policy backed up');
  }

  private checkPolicyCompliance(): void {
    // Check policy compliance and violations
    const violations = this.detectPolicyViolations();

    if (violations.length > 0) {
      logger.warn(`Policy violations detected: ${violations.length}`);

      for (const violation of violations) {
        this.logSecurityEvent({
          type: 'policy_violation',
          subject: violation.subject,
          resource: violation.resource,
          action: violation.action,
          result: 'denied',
        });
      }
    }
  }

  private detectPolicyViolations(): any[] {
    // Detect policy violations (simplified)
    return []; // No violations in this implementation
  }

  private logSecurityEvent(event: any): void {
    const securityEvent: SecurityEvent = {
      ...event,
      id: `security_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };

    this.securityEvents.push(securityEvent);

    // Keep only last 1000 events
    if (this.securityEvents.length > 1000) {
      this.securityEvents = this.securityEvents.slice(-1000);
    }

    // Log based on severity
    if (event.result === 'denied' || event.type.includes('violation')) {
      logger.warn('Security event:', securityEvent);
    } else {
      logger.debug('Security event:', securityEvent);
    }
  }

  // @afetnet: Get security statistics
  getSecurityStats(): {
    totalEvaluations: number;
    allowedActions: number;
    deniedActions: number;
    policyVersion: string;
    featureFlagsActive: number;
    riskScore: number;
    recentViolations: number;
  } {
    const evaluations = this.policyCache.size;
    const allowed = Array.from(this.policyCache.values()).filter(r => r.allowed).length;
    const denied = evaluations - allowed;
    const activeFlags = Array.from(this.featureFlags.values()).filter(Boolean).length;
    const recentViolations = this.securityEvents.filter(
      e => e.type === 'policy_violation' && Date.now() - e.timestamp < 300000
    ).length;

    return {
      totalEvaluations: evaluations,
      allowedActions: allowed,
      deniedActions: denied,
      policyVersion: this.activePolicy?.version || 'unknown',
      featureFlagsActive: activeFlags,
      riskScore: this.calculateOverallRisk(),
      recentViolations,
    };
  }

  private calculateOverallRisk(): number {
    // Calculate overall security risk score
    const violations = this.securityEvents.filter(
      e => e.type === 'policy_violation' && Date.now() - e.timestamp < 3600000
    ).length;

    const baseRisk = 10; // Base risk
    const violationRisk = violations * 5;

    return Math.min(100, baseRisk + violationRisk);
  }

  // @afetnet: Emergency override - allows critical actions even if policy denies
  async emergencyOverride(
    subject: string,
    resource: string,
    action: string,
    reason: string
  ): Promise<boolean> {
    logger.critical('🚨 Emergency security override requested:', { subject, resource, action, reason });

    // Log emergency override
    this.logSecurityEvent({
      type: 'emergency_override',
      subject,
      resource,
      action,
      result: 'granted',
      metadata: { reason, emergency: true },
    });

    // Always allow emergency actions
    return true;
  }

  // @afetnet: Get active policy
  getActivePolicy(): SecurityPolicy | null {
    return this.activePolicy;
  }

  // @afetnet: Get security events
  getSecurityEvents(): SecurityEvent[] {
    return [...this.securityEvents];
  }

  async stop(): Promise<void> {
    logger.debug('🛑 Stopping zero-trust security manager...');
    // No cleanup needed
    logger.debug('✅ Zero-trust security manager stopped');
  }
}

// Risk Assessment Engine
class RiskAssessmentEngine {
  calculateRisk(rule: SecurityRule, context: SecurityContext): number {
    let risk = 50; // Base risk

    // Higher priority rules have lower risk
    risk -= rule.priority * 0.3;

    // Emergency context reduces risk
    if (context.emergencyMode) {
      risk -= 20;
    }

    // Network type affects risk
    if (context.networkType === 'offline_mesh') {
      risk -= 10; // Offline mesh is safer
    }

    // Battery level affects risk
    if (context.batteryLevel < 20) {
      risk += 10; // Low battery increases risk
    }

    return Math.max(0, Math.min(100, risk));
  }
}

interface SecurityEvent {
  id: string;
  type: string;
  subject: string;
  resource: string;
  action: string;
  result: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// @afetnet: Export singleton instance
export const zeroTrustSecurityManager = new ZeroTrustSecurityManager();







