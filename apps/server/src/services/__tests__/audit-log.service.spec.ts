import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService, AuditLogEntry } from '../audit-log.service';
import { FirebaseConfigService } from '../../config/firebase.config';

// Mock Firestore
const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  set: jest.fn(),
  get: jest.fn(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockReturnThis(),
};

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: FirebaseConfigService,
          useValue: {
            getFirestore: () => mockFirestore,
          },
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  describe('logUserAction', () => {
    it('should log user action successfully', async () => {
      const mockDocRef = { id: 'test-id', set: jest.fn() };
      mockFirestore.doc.mockReturnValue(mockDocRef);

      await service.logUserAction(
        'user_login',
        'user123',
        { loginMethod: 'email' },
        {
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          severity: 'info',
        }
      );

      expect(mockFirestore.collection).toHaveBeenCalledWith('audit_logs');
      expect(mockDocRef.set).toHaveBeenCalledWith({
        type: 'user_action',
        action: 'user_login',
        userId: 'user123',
        details: { loginMethod: 'email' },
        timestamp: expect.any(Date),
        severity: 'info',
        outcome: 'success',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        id: 'test-id',
      });
    });

    it('should handle errors gracefully', async () => {
      const mockDocRef = { id: 'test-id', set: jest.fn().mockRejectedValue(new Error('Firestore error')) };
      mockFirestore.doc.mockReturnValue(mockDocRef);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        service.logUserAction('test_action', 'user123', {})
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to create audit log entry:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('logSystemEvent', () => {
    it('should log system event successfully', async () => {
      const mockDocRef = { id: 'test-id', set: jest.fn() };
      mockFirestore.doc.mockReturnValue(mockDocRef);

      await service.logSystemEvent(
        'system_startup',
        { version: '1.0.0' },
        { severity: 'info' }
      );

      expect(mockDocRef.set).toHaveBeenCalledWith({
        type: 'system_event',
        action: 'system_startup',
        details: { version: '1.0.0' },
        timestamp: expect.any(Date),
        severity: 'info',
        outcome: 'success',
        id: 'test-id',
      });
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event with default severity', async () => {
      const mockDocRef = { id: 'test-id', set: jest.fn() };
      mockFirestore.doc.mockReturnValue(mockDocRef);

      await service.logSecurityEvent(
        'brute_force_attempt',
        { attempts: 3 },
        { userId: 'user123', ipAddress: '127.0.0.1' }
      );

      expect(mockDocRef.set).toHaveBeenCalledWith({
        type: 'security_event',
        action: 'brute_force_attempt',
        details: { attempts: 3 },
        timestamp: expect.any(Date),
        severity: 'warning',
        outcome: 'failure',
        riskScore: expect.any(Number),
        userId: 'user123',
        ipAddress: '127.0.0.1',
        id: 'test-id',
      });
    });
  });

  describe('logDataChange', () => {
    it('should log data change successfully', async () => {
      const mockDocRef = { id: 'test-id', set: jest.fn() };
      mockFirestore.doc.mockReturnValue(mockDocRef);

      await service.logDataChange(
        'update',
        'User',
        'user123',
        'admin456',
        { field: 'email', oldValue: 'old@test.com', newValue: 'new@test.com' }
      );

      expect(mockDocRef.set).toHaveBeenCalledWith({
        type: 'data_change',
        action: 'update',
        entityType: 'User',
        entityId: 'user123',
        userId: 'admin456',
        details: { field: 'email', oldValue: 'old@test.com', newValue: 'new@test.com' },
        timestamp: expect.any(Date),
        severity: 'info',
        outcome: 'success',
        id: 'test-id',
      });
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with filters', async () => {
      const mockDocs = [
        {
          id: 'log1',
          data: () => ({
            type: 'user_action',
            action: 'login',
            userId: 'user123',
            timestamp: { toDate: () => new Date('2023-01-01') },
          }),
        },
        {
          id: 'log2',
          data: () => ({
            type: 'system_event',
            action: 'startup',
            timestamp: { toDate: () => new Date('2023-01-02') },
          }),
        },
      ];

      const mockSnapshot = { docs: mockDocs };
      mockFirestore.get.mockResolvedValue(mockSnapshot);

      const filters = {
        type: 'user_action',
        userId: 'user123',
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-31'),
        limit: 10,
      };

      const result = await service.getAuditLogs(filters);

      expect(mockFirestore.where).toHaveBeenCalledWith('type', '==', 'user_action');
      expect(mockFirestore.where).toHaveBeenCalledWith('userId', '==', 'user123');
      expect(mockFirestore.where).toHaveBeenCalledWith('timestamp', '>=', filters.startDate);
      expect(mockFirestore.where).toHaveBeenCalledWith('timestamp', '<=', filters.endDate);
      expect(mockFirestore.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(mockFirestore.limit).toHaveBeenCalledWith(10);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'log1',
        type: 'user_action',
        action: 'login',
        userId: 'user123',
        timestamp: new Date('2023-01-01'),
      });
    });

    it('should retrieve audit logs without filters', async () => {
      const mockSnapshot = { docs: [] };
      mockFirestore.get.mockResolvedValue(mockSnapshot);

      const result = await service.getAuditLogs();

      expect(mockFirestore.orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(result).toEqual([]);
    });
  });

  describe('getAuditLogById', () => {
    it('should retrieve audit log by id', async () => {
      const mockDoc = {
        exists: true,
        id: 'log1',
        data: () => ({
          type: 'user_action',
          action: 'login',
          timestamp: { toDate: () => new Date('2023-01-01') },
        }),
      };

      const mockDocRef = {
        get: jest.fn().mockResolvedValue(mockDoc),
      };

      mockFirestore.doc.mockReturnValue(mockDocRef);

      const result = await service.getAuditLogById('log1');

      expect(mockFirestore.doc).toHaveBeenCalledWith('log1');
      expect(result).toEqual({
        id: 'log1',
        type: 'user_action',
        action: 'login',
        timestamp: new Date('2023-01-01'),
      });
    });

    it('should return null for non-existent log', async () => {
      const mockDoc = { exists: false };
      const mockDocRef = {
        get: jest.fn().mockResolvedValue(mockDoc),
      };

      mockFirestore.doc.mockReturnValue(mockDocRef);

      const result = await service.getAuditLogById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getAuditLogStats', () => {
    it('should calculate audit log statistics', async () => {
      const mockLogs: AuditLogEntry[] = [
        {
          type: 'user_action',
          action: 'login',
          severity: 'info',
          outcome: 'success',
          details: {},
          timestamp: new Date(),
        },
        {
          type: 'user_action',
          action: 'logout',
          severity: 'info',
          outcome: 'success',
          details: {},
          timestamp: new Date(),
        },
        {
          type: 'security_event',
          action: 'failed_login',
          severity: 'warning',
          outcome: 'failure',
          details: {},
          timestamp: new Date(),
        },
      ];

      // Mock getAuditLogs to return test data
      jest.spyOn(service, 'getAuditLogs').mockResolvedValue(mockLogs);

      const stats = await service.getAuditLogStats();

      expect(stats).toEqual({
        total: 3,
        byType: {
          user_action: 2,
          security_event: 1,
        },
        bySeverity: {
          info: 2,
          warning: 1,
        },
        byAction: {
          login: 1,
          logout: 1,
          failed_login: 1,
        },
      });
    });
  });
});