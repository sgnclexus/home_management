import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimitException } from '../exceptions/custom.exceptions';
import { SanitizationUtil } from '../utils/sanitization.util';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  blockDuration?: number; // How long to block after limit exceeded
  progressiveDelay?: boolean; // Apply progressive delays
  whitelist?: string[]; // IP addresses to whitelist
  blacklist?: string[]; // IP addresses to blacklist
  trustProxy?: boolean; // Trust proxy headers for IP detection
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
    blockUntil?: number;
    violations: number;
    firstRequest: number;
    lastRequest: number;
  };
}

interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  suspiciousIPs: Set<string>;
  rateLimitViolations: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);
  private store: RateLimitStore = {};
  private config: RateLimitConfig;
  private metrics: SecurityMetrics = {
    totalRequests: 0,
    blockedRequests: 0,
    suspiciousIPs: new Set(),
    rateLimitViolations: 0,
  };

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: 15 * 60 * 1000, // 15 minutes default
      maxRequests: 100, // 100 requests per window default
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      blockDuration: 60 * 60 * 1000, // 1 hour default block
      progressiveDelay: true,
      whitelist: [],
      blacklist: [],
      trustProxy: true,
      keyGenerator: (req: Request) => this.getClientIdentifier(req),
      ...config,
    };

    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000);

    // Log security metrics every 5 minutes
    setInterval(() => {
      this.logSecurityMetrics();
    }, 5 * 60 * 1000);
  }

  async use(req: Request, res: Response, next: NextFunction) {
    const key = this.config.keyGenerator!(req);
    const clientIP = SanitizationUtil.getClientIP(req);
    const now = Date.now();

    this.metrics.totalRequests++;

    // Check blacklist
    if (this.config.blacklist?.includes(clientIP)) {
      this.logger.warn(`Blocked request from blacklisted IP: ${clientIP}`);
      this.metrics.blockedRequests++;
      throw new RateLimitException(0, this.config.windowMs, 'IP blacklisted');
    }

    // Check whitelist
    if (this.config.whitelist?.includes(clientIP)) {
      return next();
    }

    // Initialize or get existing record
    if (!this.store[key] || this.store[key].resetTime <= now) {
      this.store[key] = {
        count: 0,
        resetTime: now + this.config.windowMs,
        violations: this.store[key]?.violations || 0,
        firstRequest: now,
        lastRequest: now,
      };
    }

    const record = this.store[key];
    record.lastRequest = now;

    // Check if currently blocked
    if (record.blockUntil && record.blockUntil > now) {
      const remainingBlockTime = Math.ceil((record.blockUntil - now) / 1000);
      this.logger.warn(`Request blocked from ${clientIP}, ${remainingBlockTime}s remaining`);
      this.metrics.blockedRequests++;
      throw new RateLimitException(
        this.config.maxRequests, 
        this.config.windowMs, 
        `Blocked for ${remainingBlockTime} seconds`
      );
    }

    // Check if limit exceeded
    if (record.count >= this.config.maxRequests) {
      record.violations++;
      this.metrics.rateLimitViolations++;
      this.metrics.suspiciousIPs.add(clientIP);

      // Apply progressive blocking
      const blockDuration = this.calculateBlockDuration(record.violations);
      record.blockUntil = now + blockDuration;

      this.logger.warn(
        `Rate limit exceeded for ${clientIP}. Violations: ${record.violations}, Block duration: ${blockDuration}ms`
      );

      throw new RateLimitException(
        this.config.maxRequests, 
        this.config.windowMs,
        `Rate limit exceeded. Blocked for ${Math.ceil(blockDuration / 1000)} seconds`
      );
    }

    // Apply progressive delay if enabled
    if (this.config.progressiveDelay && record.count > this.config.maxRequests * 0.8) {
      const delay = this.calculateProgressiveDelay(record.count, this.config.maxRequests);
      if (delay > 0) {
        await this.sleep(delay);
      }
    }

    // Increment counter
    record.count++;

    // Add comprehensive rate limit headers
    res.setHeader('X-RateLimit-Limit', this.config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));
    res.setHeader('X-RateLimit-Window', this.config.windowMs);
    
    if (record.violations > 0) {
      res.setHeader('X-RateLimit-Violations', record.violations);
    }

    // Handle response to potentially skip counting
    const originalSend = res.send;
    const self = this;
    res.send = function(body) {
      const statusCode = res.statusCode;
      
      // Skip counting based on configuration
      if (
        (self.config.skipSuccessfulRequests && statusCode < 400) ||
        (self.config.skipFailedRequests && statusCode >= 400)
      ) {
        record.count--;
      }
      
      return originalSend.call(this, body);
    };

    next();
  }

  private cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    Object.keys(this.store).forEach(key => {
      const record = this.store[key];
      if (record.resetTime <= now && (!record.blockUntil || record.blockUntil <= now)) {
        delete this.store[key];
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired rate limit records`);
    }
  }

  private getClientIdentifier(req: Request): string {
    const ip = SanitizationUtil.getClientIP(req);
    const userAgent = SanitizationUtil.getUserAgent(req);
    
    // Create a more sophisticated identifier that includes IP and user agent hash
    const identifier = `${ip}:${this.hashString(userAgent)}`;
    return identifier;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private calculateBlockDuration(violations: number): number {
    if (!this.config.blockDuration) return 0;
    
    // Progressive blocking: each violation increases block time
    const multiplier = Math.min(violations, 10); // Cap at 10x
    return this.config.blockDuration * multiplier;
  }

  private calculateProgressiveDelay(currentCount: number, maxRequests: number): number {
    const ratio = currentCount / maxRequests;
    if (ratio <= 0.8) return 0;
    
    // Exponential delay as we approach the limit
    const delayMs = Math.pow((ratio - 0.8) * 5, 2) * 100;
    return Math.min(delayMs, 2000); // Cap at 2 seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private logSecurityMetrics() {
    this.logger.log(`Security Metrics - Total: ${this.metrics.totalRequests}, ` +
      `Blocked: ${this.metrics.blockedRequests}, ` +
      `Violations: ${this.metrics.rateLimitViolations}, ` +
      `Suspicious IPs: ${this.metrics.suspiciousIPs.size}`);
    
    // Reset metrics after logging
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      suspiciousIPs: new Set(),
      rateLimitViolations: 0,
    };
  }

  // Method to manually reset rate limit for a key (useful for testing)
  reset(key?: string) {
    if (key) {
      delete this.store[key];
    } else {
      this.store = {};
    }
  }

  // Get current status for a key
  getStatus(key: string) {
    const record = this.store[key];
    if (!record || record.resetTime <= Date.now()) {
      return {
        count: 0,
        remaining: this.config.maxRequests,
        resetTime: null,
        violations: 0,
        blocked: false,
      };
    }

    return {
      count: record.count,
      remaining: Math.max(0, this.config.maxRequests - record.count),
      resetTime: record.resetTime,
      violations: record.violations,
      blocked: record.blockUntil ? record.blockUntil > Date.now() : false,
      blockUntil: record.blockUntil,
    };
  }

  // Get security metrics
  getMetrics() {
    return {
      ...this.metrics,
      suspiciousIPs: Array.from(this.metrics.suspiciousIPs),
      activeConnections: Object.keys(this.store).length,
    };
  }

  // Add IP to blacklist
  blacklistIP(ip: string) {
    if (!this.config.blacklist) {
      this.config.blacklist = [];
    }
    if (!this.config.blacklist.includes(ip)) {
      this.config.blacklist.push(ip);
      this.logger.warn(`Added IP to blacklist: ${ip}`);
    }
  }

  // Remove IP from blacklist
  removeFromBlacklist(ip: string) {
    if (this.config.blacklist) {
      const index = this.config.blacklist.indexOf(ip);
      if (index > -1) {
        this.config.blacklist.splice(index, 1);
        this.logger.log(`Removed IP from blacklist: ${ip}`);
      }
    }
  }
}

// Factory function to create rate limit middleware with different configs
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return new RateLimitMiddleware(config);
}

// Predefined rate limit configurations
export const RateLimitConfigs = {
  // Strict rate limiting for authentication endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    skipSuccessfulRequests: true,
    blockDuration: 30 * 60 * 1000, // 30 minutes block
    progressiveDelay: true,
  },
  
  // Very strict rate limiting for password reset
  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 attempts per hour
    blockDuration: 2 * 60 * 60 * 1000, // 2 hours block
    keyGenerator: (req: Request) => {
      const email = req.body?.email;
      const ip = SanitizationUtil.getClientIP(req);
      return email ? `email:${email}` : `ip:${ip}`;
    },
  },

  // Strict rate limiting for payment endpoints
  PAYMENT: {
    windowMs: 10 * 60 * 1000, // 10 minutes
    maxRequests: 10, // 10 payment attempts per 10 minutes
    blockDuration: 60 * 60 * 1000, // 1 hour block
    progressiveDelay: true,
  },

  // Moderate rate limiting for API endpoints
  API: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
    blockDuration: 15 * 60 * 1000, // 15 minutes block
    progressiveDelay: true,
  },
  
  // Lenient rate limiting for general endpoints
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000, // 1000 requests per 15 minutes
    blockDuration: 5 * 60 * 1000, // 5 minutes block
  },

  // File upload rate limiting
  UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50, // 50 uploads per hour
    blockDuration: 30 * 60 * 1000, // 30 minutes block
  },

  // Admin endpoints - more lenient for legitimate admin users
  ADMIN: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 500, // 500 requests per 15 minutes
    blockDuration: 10 * 60 * 1000, // 10 minutes block
  },
};