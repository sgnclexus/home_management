import { Injectable, Logger } from '@nestjs/common';
import { FirebaseConfigService } from '../config/firebase.config';
import { SanitizationUtil } from '../utils/sanitization.util';
import * as admin from 'firebase-admin';

export interface AuditLogEntry {
  id?: string;
  type: 'user_action' | 'system_event' | 'security_event' | 'data_change' | 'authentication' | 'authorization' | 'payment' | 'admin_action';
  action: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  sessionId?: string;
  requestId?: string;
  correlationId?: string;
  source?: string;
  outcome: 'success' | 'failure' | 'partial';
  riskScore?: number;
  geolocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
  deviceFingerprint?: string;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

export interface AuditLogFilters {
  type?: string;
  action?: string;
  userId?: string;
  entityType?: string;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly sensitiveFields = [
    'password', 'token', 'secret', 'key', 'credential', 'authorization',
    'cookie', 'session', 'jwt', 'bearer', 'apikey', 'privatekey',
    'cardnumber', 'cvv', 'ssn', 'taxid', 'bankaccount'
  ];

  constructor(private firebaseConfig: FirebaseConfigService) {}

  private get firestore(): admin.firestore.Firestore {
    return this.firebaseConfig.getFirestore();
  }

  // Enhanced authentication logging
  async logAuthentication(
    action: 'login_attempt' | 'login_success' | 'login_failure' | 'logout' | 'token_refresh' | 'password_reset',
    userId: string | null,
    details: Record<string, any>,
    request?: any
  ): Promise<void> {
    const entry: AuditLogEntry = {
      type: 'authentication',
      action,
      userId: userId || undefined,
      details: this.sanitizeDetails(details),
      timestamp: new Date(),
      severity: action.includes('failure') ? 'warning' : 'info',
      outcome: action.includes('failure') ? 'failure' : 'success',
      ipAddress: request ? SanitizationUtil.getClientIP(request) : undefined,
      userAgent: request ? SanitizationUtil.getUserAgent(request) : undefined,
      riskScore: this.calculateRiskScore(action, details, request),
    };

    await this.createLogEntry(entry);
  }

  // Enhanced authorization logging
  async logAuthorization(
    action: 'access_granted' | 'access_denied' | 'permission_check' | 'role_change',
    userId: string,
    resource: string,
    details: Record<string, any>,
    request?: any
  ): Promise<void> {
    const entry: AuditLogEntry = {
      type: 'authorization',
      action,
      userId,
      entityType: 'resource',
      entityId: resource,
      details: this.sanitizeDetails(details),
      timestamp: new Date(),
      severity: action === 'access_denied' ? 'warning' : 'info',
      outcome: action === 'access_denied' ? 'failure' : 'success',
      ipAddress: request ? SanitizationUtil.getClientIP(request) : undefined,
      userAgent: request ? SanitizationUtil.getUserAgent(request) : undefined,
    };

    await this.createLogEntry(entry);
  }

  // Enhanced payment logging
  async logPayment(
    action: 'payment_initiated' | 'payment_processed' | 'payment_failed' | 'payment_refunded' | 'payment_disputed',
    userId: string,
    paymentId: string,
    details: Record<string, any>,
    request?: any
  ): Promise<void> {
    const entry: AuditLogEntry = {
      type: 'payment',
      action,
      userId,
      entityType: 'payment',
      entityId: paymentId,
      details: this.sanitizeDetails(details),
      timestamp: new Date(),
      severity: action.includes('failed') || action.includes('disputed') ? 'error' : 'info',
      outcome: action.includes('failed') ? 'failure' : 'success',
      ipAddress: request ? SanitizationUtil.getClientIP(request) : undefined,
      userAgent: request ? SanitizationUtil.getUserAgent(request) : undefined,
      riskScore: this.calculatePaymentRiskScore(details),
    };

    await this.createLogEntry(entry);
  }

  // Enhanced admin action logging
  async logAdminAction(
    action: string,
    adminUserId: string,
    targetEntityType: string,
    targetEntityId: string,
    details: Record<string, any>,
    request?: any,
    previousValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<void> {
    const entry: AuditLogEntry = {
      type: 'admin_action',
      action,
      userId: adminUserId,
      entityType: targetEntityType,
      entityId: targetEntityId,
      details: this.sanitizeDetails(details),
      previousValues: previousValues ? this.sanitizeDetails(previousValues) : undefined,
      newValues: newValues ? this.sanitizeDetails(newValues) : undefined,
      timestamp: new Date(),
      severity: this.getAdminActionSeverity(action),
      outcome: 'success',
      ipAddress: request ? SanitizationUtil.getClientIP(request) : undefined,
      userAgent: request ? SanitizationUtil.getUserAgent(request) : undefined,
    };

    await this.createLogEntry(entry);
  }

  async logUserAction(
    action: string,
    userId: string,
    details: Record<string, any>,
    options?: {
      entityId?: string;
      entityType?: string;
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      requestId?: string;
      severity?: 'info' | 'warning' | 'error' | 'critical';
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      type: 'user_action',
      action,
      userId,
      details,
      timestamp: new Date(),
      severity: options?.severity || 'info',
      outcome: 'success',
      ...options,
    };

    await this.createLogEntry(entry);
  }

  async logSystemEvent(
    action: string,
    details: Record<string, any>,
    options?: {
      severity?: 'info' | 'warning' | 'error' | 'critical';
      requestId?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      type: 'system_event',
      action,
      details,
      timestamp: new Date(),
      severity: options?.severity || 'info',
      outcome: 'success',
      ...options,
    };

    await this.createLogEntry(entry);
  }

  async logSecurityEvent(
    action: 'rate_limit_exceeded' | 'suspicious_activity' | 'malicious_request' | 'brute_force_attempt' | 'sql_injection_attempt' | 'xss_attempt' | 'unauthorized_access' | 'data_breach_attempt',
    details: Record<string, any>,
    options?: {
      userId?: string;
      ipAddress?: string;
      userAgent?: string;
      severity?: 'info' | 'warning' | 'error' | 'critical';
      requestId?: string;
      correlationId?: string;
      riskScore?: number;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      type: 'security_event',
      action,
      details: this.sanitizeDetails(details),
      timestamp: new Date(),
      severity: options?.severity || this.getSecurityEventSeverity(action),
      outcome: 'failure', // Security events are typically failures/threats
      riskScore: options?.riskScore || this.calculateSecurityRiskScore(action, details),
      ...options,
    };

    await this.createLogEntry(entry);

    // For critical security events, also log to console immediately
    if (entry.severity === 'critical') {
      this.logger.error(`CRITICAL SECURITY EVENT: ${action}`, {
        userId: options?.userId,
        ipAddress: options?.ipAddress,
        details: this.sanitizeDetails(details),
      });
    }
  }

  async logDataChange(
    action: string,
    entityType: string,
    entityId: string,
    userId: string,
    details: Record<string, any>,
    options?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      requestId?: string;
    }
  ): Promise<void> {
    const entry: AuditLogEntry = {
      type: 'data_change',
      action,
      entityType,
      entityId,
      userId,
      details,
      timestamp: new Date(),
      severity: 'info',
      outcome: 'success',
      ...options,
    };

    await this.createLogEntry(entry);
  }

  async getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
    let query: admin.firestore.Query = this.firestore.collection('audit_logs');

    // Apply filters
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    if (filters.action) {
      query = query.where('action', '==', filters.action);
    }
    if (filters.userId) {
      query = query.where('userId', '==', filters.userId);
    }
    if (filters.entityType) {
      query = query.where('entityType', '==', filters.entityType);
    }
    if (filters.severity) {
      query = query.where('severity', '==', filters.severity);
    }
    if (filters.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    if (filters.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }

    // Order by timestamp (most recent first)
    query = query.orderBy('timestamp', 'desc');

    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate(),
    })) as AuditLogEntry[];
  }

  async getAuditLogById(id: string): Promise<AuditLogEntry | null> {
    const doc = await this.firestore.collection('audit_logs').doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data()?.timestamp.toDate(),
    } as AuditLogEntry;
  }

  async getAuditLogStats(filters: AuditLogFilters = {}): Promise<{
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    byAction: Record<string, number>;
  }> {
    const logs = await this.getAuditLogs(filters);
    
    const stats = {
      total: logs.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      byAction: {} as Record<string, number>,
    };

    logs.forEach(log => {
      // Count by type
      stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;
      
      // Count by severity
      stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
      
      // Count by action
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
    });

    return stats;
  }

  private async createLogEntry(entry: AuditLogEntry): Promise<void> {
    try {
      const docRef = this.firestore.collection('audit_logs').doc();
      await docRef.set({
        ...entry,
        id: docRef.id,
        timestamp: entry.timestamp,
      });
    } catch (error) {
      // Log to console if Firestore fails, but don't throw to avoid breaking the main flow
      console.error('Failed to create audit log entry:', error);
    }
  }

  // Enhanced method to sanitize sensitive data before logging
  private sanitizeDetails(details: Record<string, any>): Record<string, any> {
    if (!details || typeof details !== 'object') {
      return details;
    }

    const sanitizeObject = (obj: any, depth = 0): any => {
      if (depth > 10) {
        return '[MAX_DEPTH_EXCEEDED]';
      }

      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.slice(0, 100).map(item => sanitizeObject(item, depth + 1));
      }

      const result: any = {};
      Object.keys(obj).slice(0, 50).forEach(key => {
        const lowerKey = key.toLowerCase();
        if (this.sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'string' && obj[key].length > 1000) {
          result[key] = obj[key].substring(0, 1000) + '[TRUNCATED]';
        } else {
          result[key] = sanitizeObject(obj[key], depth + 1);
        }
      });

      return result;
    };

    return sanitizeObject(details);
  }

  private calculateRiskScore(action: string, details: Record<string, any>, request?: any): number {
    let score = 0;

    // Base score by action type
    const actionScores: Record<string, number> = {
      'login_failure': 30,
      'login_attempt': 10,
      'login_success': 5,
      'password_reset': 20,
      'logout': 0,
      'token_refresh': 5,
    };

    score += actionScores[action] || 0;

    // IP-based scoring
    if (request) {
      const ip = SanitizationUtil.getClientIP(request);
      if (ip === 'unknown' || !SanitizationUtil.validateIPAddress(ip)) {
        score += 20;
      }
    }

    // Failed attempts increase score
    if (details.failedAttempts) {
      score += Math.min(details.failedAttempts * 10, 50);
    }

    // Unusual timing patterns
    if (details.timeOfDay) {
      const hour = new Date().getHours();
      if (hour < 6 || hour > 22) {
        score += 10; // Late night/early morning activity
      }
    }

    return Math.min(score, 100);
  }

  private calculatePaymentRiskScore(details: Record<string, any>): number {
    let score = 0;

    // Large amounts increase risk
    if (details.amount) {
      const amount = Number(details.amount);
      if (amount > 10000) score += 30;
      else if (amount > 5000) score += 20;
      else if (amount > 1000) score += 10;
    }

    // Multiple payment attempts
    if (details.attemptCount && details.attemptCount > 1) {
      score += details.attemptCount * 5;
    }

    // New payment method
    if (details.isNewPaymentMethod) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  private calculateSecurityRiskScore(action: string, details: Record<string, any>): number {
    const actionScores: Record<string, number> = {
      'rate_limit_exceeded': 40,
      'suspicious_activity': 60,
      'malicious_request': 80,
      'brute_force_attempt': 70,
      'sql_injection_attempt': 90,
      'xss_attempt': 85,
      'unauthorized_access': 75,
      'data_breach_attempt': 95,
    };

    return actionScores[action] || 50;
  }

  private getSecurityEventSeverity(action: string): 'info' | 'warning' | 'error' | 'critical' {
    const criticalEvents = ['data_breach_attempt', 'sql_injection_attempt'];
    const errorEvents = ['malicious_request', 'xss_attempt', 'unauthorized_access'];
    const warningEvents = ['brute_force_attempt', 'suspicious_activity'];

    if (criticalEvents.includes(action)) return 'critical';
    if (errorEvents.includes(action)) return 'error';
    if (warningEvents.includes(action)) return 'warning';
    return 'info';
  }

  private getAdminActionSeverity(action: string): 'info' | 'warning' | 'error' | 'critical' {
    const criticalActions = ['delete_user', 'delete_payment', 'system_shutdown'];
    const errorActions = ['disable_user', 'cancel_payment', 'modify_permissions'];
    const warningActions = ['update_user_role', 'modify_settings'];

    if (criticalActions.some(a => action.includes(a))) return 'critical';
    if (errorActions.some(a => action.includes(a))) return 'error';
    if (warningActions.some(a => action.includes(a))) return 'warning';
    return 'info';
  }

  // Get security insights from audit logs
  async getSecurityInsights(timeRange: { start: Date; end: Date }): Promise<{
    totalEvents: number;
    securityEvents: number;
    highRiskEvents: number;
    topThreats: Array<{ action: string; count: number }>;
    suspiciousIPs: Array<{ ip: string; eventCount: number; riskScore: number }>;
    userRiskProfiles: Array<{ userId: string; riskScore: number; eventCount: number }>;
  }> {
    const logs = await this.getAuditLogs({
      startDate: timeRange.start,
      endDate: timeRange.end,
      limit: 10000,
    });

    const securityEvents = logs.filter(log => 
      log.type === 'security_event' || log.severity === 'critical' || log.severity === 'error'
    );

    const highRiskEvents = logs.filter(log => (log.riskScore || 0) > 70);

    // Count threats by action
    const threatCounts: Record<string, number> = {};
    securityEvents.forEach(event => {
      threatCounts[event.action] = (threatCounts[event.action] || 0) + 1;
    });

    const topThreats = Object.entries(threatCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    // Analyze suspicious IPs
    const ipAnalysis: Record<string, { eventCount: number; totalRiskScore: number }> = {};
    logs.forEach(log => {
      if (log.ipAddress && log.ipAddress !== 'unknown') {
        if (!ipAnalysis[log.ipAddress]) {
          ipAnalysis[log.ipAddress] = { eventCount: 0, totalRiskScore: 0 };
        }
        ipAnalysis[log.ipAddress].eventCount++;
        ipAnalysis[log.ipAddress].totalRiskScore += log.riskScore || 0;
      }
    });

    const suspiciousIPs = Object.entries(ipAnalysis)
      .map(([ip, data]) => ({
        ip,
        eventCount: data.eventCount,
        riskScore: Math.round(data.totalRiskScore / data.eventCount),
      }))
      .filter(item => item.riskScore > 30 || item.eventCount > 50)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 20);

    // Analyze user risk profiles
    const userAnalysis: Record<string, { eventCount: number; totalRiskScore: number }> = {};
    logs.forEach(log => {
      if (log.userId) {
        if (!userAnalysis[log.userId]) {
          userAnalysis[log.userId] = { eventCount: 0, totalRiskScore: 0 };
        }
        userAnalysis[log.userId].eventCount++;
        userAnalysis[log.userId].totalRiskScore += log.riskScore || 0;
      }
    });

    const userRiskProfiles = Object.entries(userAnalysis)
      .map(([userId, data]) => ({
        userId,
        eventCount: data.eventCount,
        riskScore: Math.round(data.totalRiskScore / data.eventCount),
      }))
      .filter(item => item.riskScore > 40)
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 20);

    return {
      totalEvents: logs.length,
      securityEvents: securityEvents.length,
      highRiskEvents: highRiskEvents.length,
      topThreats,
      suspiciousIPs,
      userRiskProfiles,
    };
  }
}