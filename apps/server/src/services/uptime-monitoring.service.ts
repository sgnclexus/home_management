import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface UptimeCheck {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatus: number;
  timeout: number;
  interval: number; // in minutes
  enabled: boolean;
  headers?: Record<string, string>;
  body?: string;
}

export interface UptimeResult {
  checkId: string;
  timestamp: string;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  statusCode?: number;
  error?: string;
  location: string;
}

export interface UptimeStats {
  checkId: string;
  uptime: number; // percentage
  averageResponseTime: number;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  lastCheck: string;
  status: 'up' | 'down' | 'degraded';
}

@Injectable()
export class UptimeMonitoringService {
  private readonly logger = new Logger(UptimeMonitoringService.name);
  private readonly checks = new Map<string, UptimeCheck>();
  private readonly intervals = new Map<string, NodeJS.Timeout>();

  constructor(private configService: ConfigService) {
    this.initializeDefaultChecks();
  }

  private initializeDefaultChecks(): void {
    const baseUrl = this.configService.get('API_BASE_URL') || 'http://localhost:3001';
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';

    const defaultChecks: UptimeCheck[] = [
      {
        id: 'api-health',
        name: 'API Health Check',
        url: `${baseUrl}/api/health`,
        method: 'GET',
        expectedStatus: 200,
        timeout: 10000,
        interval: 5, // 5 minutes
        enabled: true,
      },
      {
        id: 'frontend-health',
        name: 'Frontend Health Check',
        url: frontendUrl,
        method: 'GET',
        expectedStatus: 200,
        timeout: 15000,
        interval: 5, // 5 minutes
        enabled: true,
      },
      {
        id: 'api-auth',
        name: 'API Authentication Endpoint',
        url: `${baseUrl}/api/auth/health`,
        method: 'GET',
        expectedStatus: 200,
        timeout: 10000,
        interval: 10, // 10 minutes
        enabled: true,
      },
      {
        id: 'api-payments',
        name: 'API Payments Endpoint',
        url: `${baseUrl}/api/payments/health`,
        method: 'GET',
        expectedStatus: 200,
        timeout: 10000,
        interval: 10, // 10 minutes
        enabled: true,
      },
    ];

    defaultChecks.forEach(check => {
      this.addCheck(check);
    });
  }

  addCheck(check: UptimeCheck): void {
    this.checks.set(check.id, check);
    
    if (check.enabled) {
      this.startMonitoring(check);
    }
    
    this.logger.log(`Added uptime check: ${check.name}`);
  }

  removeCheck(checkId: string): void {
    this.stopMonitoring(checkId);
    this.checks.delete(checkId);
    this.logger.log(`Removed uptime check: ${checkId}`);
  }

  updateCheck(checkId: string, updates: Partial<UptimeCheck>): void {
    const check = this.checks.get(checkId);
    if (!check) {
      throw new Error(`Check not found: ${checkId}`);
    }

    const updatedCheck = { ...check, ...updates };
    this.checks.set(checkId, updatedCheck);

    // Restart monitoring with new configuration
    this.stopMonitoring(checkId);
    if (updatedCheck.enabled) {
      this.startMonitoring(updatedCheck);
    }

    this.logger.log(`Updated uptime check: ${checkId}`);
  }

  private startMonitoring(check: UptimeCheck): void {
    // Clear existing interval if any
    this.stopMonitoring(check.id);

    // Perform initial check
    this.performCheck(check);

    // Schedule recurring checks
    const interval = setInterval(() => {
      this.performCheck(check);
    }, check.interval * 60 * 1000); // Convert minutes to milliseconds

    this.intervals.set(check.id, interval);
    this.logger.log(`Started monitoring: ${check.name} (every ${check.interval} minutes)`);
  }

  private stopMonitoring(checkId: string): void {
    const interval = this.intervals.get(checkId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(checkId);
    }
  }

  private async performCheck(check: UptimeCheck): Promise<UptimeResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const location = this.configService.get('FUNCTION_REGION', 'us-central1');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), check.timeout);

      const response = await fetch(check.url, {
        method: check.method,
        headers: {
          'User-Agent': 'Home-Management-Uptime-Monitor/1.0',
          ...check.headers,
        },
        body: check.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const statusCode = response.status;
      
      let status: 'up' | 'down' | 'degraded';
      if (statusCode === check.expectedStatus) {
        status = responseTime > 5000 ? 'degraded' : 'up';
      } else {
        status = 'down';
      }

      const result: UptimeResult = {
        checkId: check.id,
        timestamp,
        status,
        responseTime,
        statusCode,
        location,
      };

      // Store result
      await this.storeResult(result);

      // Send alerts if needed
      if (status !== 'up') {
        await this.sendAlert(check, result);
      }

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const result: UptimeResult = {
        checkId: check.id,
        timestamp,
        status: 'down',
        responseTime,
        error: error.message,
        location,
      };

      // Store result
      await this.storeResult(result);

      // Send alert
      await this.sendAlert(check, result);

      return result;
    }
  }

  private async storeResult(result: UptimeResult): Promise<void> {
    try {
      await admin.firestore()
        .collection('uptime_results')
        .add({
          ...result,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
    } catch (error) {
      this.logger.error('Failed to store uptime result', error);
    }
  }

  private async sendAlert(check: UptimeCheck, result: UptimeResult): Promise<void> {
    try {
      // Check if we should send an alert (avoid spam)
      const shouldSendAlert = await this.shouldSendAlert(check.id, result.status);
      
      if (!shouldSendAlert) {
        return;
      }

      const alertMessage = this.createAlertMessage(check, result);
      
      // Send to notification service
      await this.sendNotification(alertMessage, result.status);
      
      // Record alert sent
      await admin.firestore()
        .collection('uptime_alerts')
        .add({
          checkId: check.id,
          checkName: check.name,
          status: result.status,
          message: alertMessage,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

      this.logger.warn(`Uptime alert sent for ${check.name}: ${result.status}`);
    } catch (error) {
      this.logger.error('Failed to send uptime alert', error);
    }
  }

  private async shouldSendAlert(checkId: string, status: string): Promise<boolean> {
    try {
      // Don't send alerts more than once every 15 minutes for the same check
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      const recentAlerts = await admin.firestore()
        .collection('uptime_alerts')
        .where('checkId', '==', checkId)
        .where('timestamp', '>', fifteenMinutesAgo)
        .limit(1)
        .get();

      return recentAlerts.empty;
    } catch (error) {
      this.logger.error('Failed to check alert history', error);
      return true; // Send alert if we can't check history
    }
  }

  private createAlertMessage(check: UptimeCheck, result: UptimeResult): string {
    const statusEmoji = {
      up: '✅',
      down: '🔴',
      degraded: '⚠️',
    };

    let message = `${statusEmoji[result.status]} ${check.name} is ${result.status.toUpperCase()}`;
    
    if (result.error) {
      message += `\nError: ${result.error}`;
    }
    
    if (result.statusCode) {
      message += `\nStatus Code: ${result.statusCode}`;
    }
    
    message += `\nResponse Time: ${result.responseTime}ms`;
    message += `\nURL: ${check.url}`;
    message += `\nTime: ${result.timestamp}`;
    
    return message;
  }

  private async sendNotification(message: string, severity: string): Promise<void> {
    // Integration with notification service
    // This could send to Slack, email, SMS, etc.
    
    const webhookUrl = this.configService.get('SLACK_WEBHOOK_URL');
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: message,
            channel: '#alerts',
            username: 'Uptime Monitor',
            icon_emoji: severity === 'down' ? ':red_circle:' : ':warning:',
          }),
        });
      } catch (error) {
        this.logger.error('Failed to send Slack notification', error);
      }
    }
  }

  async getStats(checkId: string, days: number = 7): Promise<UptimeStats> {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const snapshot = await admin.firestore()
        .collection('uptime_results')
        .where('checkId', '==', checkId)
        .where('timestamp', '>', startDate)
        .orderBy('timestamp', 'desc')
        .get();

      const results = snapshot.docs.map(doc => doc.data() as UptimeResult);
      
      if (results.length === 0) {
        return {
          checkId,
          uptime: 0,
          averageResponseTime: 0,
          totalChecks: 0,
          successfulChecks: 0,
          failedChecks: 0,
          lastCheck: '',
          status: 'down',
        };
      }

      const totalChecks = results.length;
      const successfulChecks = results.filter(r => r.status === 'up').length;
      const failedChecks = totalChecks - successfulChecks;
      const uptime = (successfulChecks / totalChecks) * 100;
      
      const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalChecks;
      
      const lastResult = results[0];
      
      return {
        checkId,
        uptime: Math.round(uptime * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime),
        totalChecks,
        successfulChecks,
        failedChecks,
        lastCheck: lastResult.timestamp,
        status: lastResult.status,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for check ${checkId}`, error);
      throw error;
    }
  }

  async getAllStats(days: number = 7): Promise<UptimeStats[]> {
    const checkIds = Array.from(this.checks.keys());
    const statsPromises = checkIds.map(checkId => this.getStats(checkId, days));
    
    try {
      return await Promise.all(statsPromises);
    } catch (error) {
      this.logger.error('Failed to get all stats', error);
      return [];
    }
  }

  getChecks(): UptimeCheck[] {
    return Array.from(this.checks.values());
  }

  async cleanup(retentionDays: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      // Clean up old results
      const resultsSnapshot = await admin.firestore()
        .collection('uptime_results')
        .where('timestamp', '<', cutoffDate)
        .get();

      const batch = admin.firestore().batch();
      resultsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();

      // Clean up old alerts
      const alertsSnapshot = await admin.firestore()
        .collection('uptime_alerts')
        .where('timestamp', '<', cutoffDate)
        .get();

      const alertsBatch = admin.firestore().batch();
      alertsSnapshot.docs.forEach(doc => {
        alertsBatch.delete(doc.ref);
      });

      await alertsBatch.commit();

      this.logger.log(`Cleaned up ${resultsSnapshot.docs.length} old uptime results and ${alertsSnapshot.docs.length} old alerts`);
    } catch (error) {
      this.logger.error('Failed to cleanup old uptime data', error);
    }
  }

  onModuleDestroy(): void {
    // Clean up intervals when service is destroyed
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
  }
}