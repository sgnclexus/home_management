import { SetMetadata } from '@nestjs/common';

export interface AuditLogOptions {
  action: string;
  entityType?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  sensitiveFields?: string[];
}

export const AUDIT_LOG_KEY = 'audit_log';

export const AuditLog = (options: AuditLogOptions) => SetMetadata(AUDIT_LOG_KEY, options);