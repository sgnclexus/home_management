import {
  userToFirestoreDocument,
  firestoreDocumentToUser,
  validateUserDocument,
  createDefaultUserDocument,
  paymentToFirestoreDocument,
  firestoreDocumentToPayment,
  paymentTransactionLogToFirestoreDocument,
  firestoreDocumentToPaymentTransactionLog,
  auditLogToFirestoreDocument,
  firestoreDocumentToAuditLog,
  validatePaymentDocument,
  validatePaymentTransactionLogDocument,
  reservationToFirestoreDocument,
  firestoreDocumentToReservation,
  validateReservationDocument,
  commonAreaToFirestoreDocument,
  firestoreDocumentToCommonArea,
  validateCommonAreaDocument,
  FIRESTORE_COLLECTIONS,
  USER_FIELD_PATHS,
  PAYMENT_FIELD_PATHS,
  AUDIT_LOG_FIELD_PATHS,
  RESERVATION_FIELD_PATHS,
  COMMON_AREA_FIELD_PATHS,
} from '../firestore-schemas';
import { 
  User, 
  UserDocument, 
  UserRole, 
  Payment,
  PaymentDocument,
  PaymentTransactionLog,
  PaymentTransactionLogDocument,
  AuditLog,
  AuditLogDocument,
  Reservation,
  ReservationDocument,
  CommonArea,
  CommonAreaDocument,
  Timestamp
} from '@home-management/types';

// Mock Firestore Timestamp
const mockTimestamp: Timestamp = {
  toDate: () => new Date('2023-01-01T00:00:00.000Z'),
  seconds: 1672531200,
  nanoseconds: 0,
};

describe('Firestore Schema Utilities', () => {
  const mockUser: User = {
    id: 'user123',
    uid: 'user123',
    email: 'user@example.com',
    displayName: 'John Doe',
    role: UserRole.RESIDENT,
    apartmentNumber: '101',
    phoneNumber: '+1234567890',
    preferredLanguage: 'en',
    isActive: true,
    fcmToken: 'fcm-token-123',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  const mockUserDocument: UserDocument = {
    uid: 'user123',
    email: 'user@example.com',
    displayName: 'John Doe',
    role: UserRole.RESIDENT,
    apartmentNumber: '101',
    phoneNumber: '+1234567890',
    preferredLanguage: 'en',
    isActive: true,
    fcmToken: 'fcm-token-123',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  describe('userToFirestoreDocument', () => {
    it('should convert User entity to Firestore document format', () => {
      const result = userToFirestoreDocument(mockUser);
      
      expect(result).toEqual({
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'John Doe',
        role: UserRole.RESIDENT,
        apartmentNumber: '101',
        phoneNumber: '+1234567890',
        preferredLanguage: 'en',
        isActive: true,
        fcmToken: 'fcm-token-123',
      });
    });

    it('should handle optional fields correctly', () => {
      const userWithoutOptionalFields: User = {
        id: 'user123',
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'John Doe',
        role: UserRole.RESIDENT,
        preferredLanguage: 'es',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = userToFirestoreDocument(userWithoutOptionalFields);
      
      expect(result.apartmentNumber).toBeUndefined();
      expect(result.phoneNumber).toBeUndefined();
      expect(result.fcmToken).toBeUndefined();
    });
  });

  describe('firestoreDocumentToUser', () => {
    it('should convert Firestore document to User entity', () => {
      const result = firestoreDocumentToUser(mockUserDocument);
      
      expect(result).toEqual({
        id: 'user123',
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'John Doe',
        role: UserRole.RESIDENT,
        apartmentNumber: '101',
        phoneNumber: '+1234567890',
        preferredLanguage: 'en',
        isActive: true,
        fcmToken: 'fcm-token-123',
        createdAt: new Date('2023-01-01T00:00:00.000Z'),
        updatedAt: new Date('2023-01-01T00:00:00.000Z'),
      });
    });
  });

  describe('validateUserDocument', () => {
    it('should validate correct user document', () => {
      expect(validateUserDocument(mockUserDocument)).toBe(true);
    });

    it('should reject document with missing required fields', () => {
      const invalidDoc = { ...mockUserDocument };
      delete (invalidDoc as any).uid;
      expect(validateUserDocument(invalidDoc)).toBe(false);
    });

    it('should reject document with invalid field types', () => {
      const invalidDoc = { ...mockUserDocument, isActive: 'true' };
      expect(validateUserDocument(invalidDoc)).toBe(false);
    });

    it('should reject document with invalid role', () => {
      const invalidDoc = { ...mockUserDocument, role: 'invalid-role' };
      expect(validateUserDocument(invalidDoc)).toBe(false);
    });

    it('should reject document with invalid language', () => {
      const invalidDoc = { ...mockUserDocument, preferredLanguage: 'fr' };
      expect(validateUserDocument(invalidDoc)).toBe(false);
    });

    it('should reject document with invalid timestamps', () => {
      const invalidDoc = { ...mockUserDocument, createdAt: 'invalid-timestamp' };
      expect(validateUserDocument(invalidDoc)).toBe(false);
    });

    it('should reject null or non-object input', () => {
      expect(validateUserDocument(null)).toBe(false);
      expect(validateUserDocument('string')).toBe(false);
      expect(validateUserDocument(123)).toBe(false);
    });
  });

  describe('createDefaultUserDocument', () => {
    it('should create default user document with required fields', () => {
      const result = createDefaultUserDocument(
        'user123',
        'user@example.com',
        'John Doe'
      );

      expect(result).toEqual({
        uid: 'user123',
        email: 'user@example.com',
        displayName: 'John Doe',
        role: UserRole.RESIDENT,
        preferredLanguage: 'es',
        isActive: true,
      });
    });

    it('should create user document with custom role and language', () => {
      const result = createDefaultUserDocument(
        'admin123',
        'admin@example.com',
        'Admin User',
        UserRole.ADMIN,
        'en'
      );

      expect(result).toEqual({
        uid: 'admin123',
        email: 'admin@example.com',
        displayName: 'Admin User',
        role: UserRole.ADMIN,
        preferredLanguage: 'en',
        isActive: true,
      });
    });
  });

  describe('FIRESTORE_COLLECTIONS', () => {
    it('should define all required collection names', () => {
      expect(FIRESTORE_COLLECTIONS.USERS).toBe('users');
      expect(FIRESTORE_COLLECTIONS.PAYMENTS).toBe('payments');
      expect(FIRESTORE_COLLECTIONS.PAYMENT_TRANSACTION_LOGS).toBe('payment_transaction_logs');
      expect(FIRESTORE_COLLECTIONS.RESERVATIONS).toBe('reservations');
      expect(FIRESTORE_COLLECTIONS.COMMON_AREAS).toBe('common_areas');
      expect(FIRESTORE_COLLECTIONS.MEETINGS).toBe('meetings');
      expect(FIRESTORE_COLLECTIONS.VOTES).toBe('votes');
      expect(FIRESTORE_COLLECTIONS.AUDIT_LOGS).toBe('audit_logs');
      expect(FIRESTORE_COLLECTIONS.NOTIFICATIONS).toBe('notifications');
    });
  });

  describe('USER_FIELD_PATHS', () => {
    it('should define all user field paths', () => {
      expect(USER_FIELD_PATHS.UID).toBe('uid');
      expect(USER_FIELD_PATHS.EMAIL).toBe('email');
      expect(USER_FIELD_PATHS.DISPLAY_NAME).toBe('displayName');
      expect(USER_FIELD_PATHS.ROLE).toBe('role');
      expect(USER_FIELD_PATHS.APARTMENT_NUMBER).toBe('apartmentNumber');
      expect(USER_FIELD_PATHS.PHONE_NUMBER).toBe('phoneNumber');
      expect(USER_FIELD_PATHS.PREFERRED_LANGUAGE).toBe('preferredLanguage');
      expect(USER_FIELD_PATHS.IS_ACTIVE).toBe('isActive');
      expect(USER_FIELD_PATHS.FCM_TOKEN).toBe('fcmToken');
      expect(USER_FIELD_PATHS.CREATED_AT).toBe('createdAt');
      expect(USER_FIELD_PATHS.UPDATED_AT).toBe('updatedAt');
    });
  });

  // Payment-related tests
  const mockPayment: Payment = {
    id: 'payment123',
    userId: 'user123',
    amount: 100.50,
    currency: 'USD',
    description: 'Monthly maintenance fee',
    status: 'pending',
    dueDate: new Date('2023-02-01T00:00:00.000Z'),
    paidDate: new Date('2023-01-15T10:30:00.000Z'),
    paymentMethod: 'stripe',
    transactionId: 'txn_123456',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  const mockPaymentDocument: PaymentDocument = {
    id: 'payment123',
    userId: 'user123',
    amount: 100.50,
    currency: 'USD',
    description: 'Monthly maintenance fee',
    status: 'pending',
    dueDate: mockTimestamp,
    paidDate: mockTimestamp,
    paymentMethod: 'stripe',
    transactionId: 'txn_123456',
    createdAt: mockTimestamp,
    updatedAt: mockTimestamp,
  };

  describe('paymentToFirestoreDocument', () => {
    it('should convert Payment entity to Firestore document format', () => {
      const result = paymentToFirestoreDocument(mockPayment);
      
      expect(result.id).toBe('payment123');
      expect(result.userId).toBe('user123');
      expect(result.amount).toBe(100.50);
      expect(result.currency).toBe('USD');
      expect(result.description).toBe('Monthly maintenance fee');
      expect(result.status).toBe('pending');
      expect(result.paymentMethod).toBe('stripe');
      expect(result.transactionId).toBe('txn_123456');
      expect(result.dueDate).toHaveProperty('seconds');
      expect(result.paidDate).toHaveProperty('seconds');
    });

    it('should handle optional fields correctly', () => {
      const paymentWithoutOptionalFields: Payment = {
        id: 'payment123',
        userId: 'user123',
        amount: 100.50,
        currency: 'USD',
        description: 'Monthly maintenance fee',
        status: 'pending',
        dueDate: new Date('2023-02-01T00:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = paymentToFirestoreDocument(paymentWithoutOptionalFields);
      
      expect(result.paidDate).toBeUndefined();
      expect(result.paymentMethod).toBeUndefined();
      expect(result.transactionId).toBeUndefined();
    });
  });

  describe('firestoreDocumentToPayment', () => {
    it('should convert Firestore document to Payment entity', () => {
      const result = firestoreDocumentToPayment(mockPaymentDocument);
      
      expect(result.id).toBe('payment123');
      expect(result.userId).toBe('user123');
      expect(result.amount).toBe(100.50);
      expect(result.currency).toBe('USD');
      expect(result.description).toBe('Monthly maintenance fee');
      expect(result.status).toBe('pending');
      expect(result.paymentMethod).toBe('stripe');
      expect(result.transactionId).toBe('txn_123456');
      expect(result.dueDate).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(result.paidDate).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(result.createdAt).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(result.updatedAt).toEqual(new Date('2023-01-01T00:00:00.000Z'));
    });
  });

  describe('validatePaymentDocument', () => {
    it('should validate correct payment document', () => {
      expect(validatePaymentDocument(mockPaymentDocument)).toBe(true);
    });

    it('should reject document with missing required fields', () => {
      const invalidDoc = { ...mockPaymentDocument };
      delete (invalidDoc as any).userId;
      expect(validatePaymentDocument(invalidDoc)).toBe(false);
    });

    it('should reject document with invalid status', () => {
      const invalidDoc = { ...mockPaymentDocument, status: 'invalid-status' };
      expect(validatePaymentDocument(invalidDoc)).toBe(false);
    });

    it('should reject document with invalid amount type', () => {
      const invalidDoc = { ...mockPaymentDocument, amount: '100.50' };
      expect(validatePaymentDocument(invalidDoc)).toBe(false);
    });
  });

  // PaymentTransactionLog tests
  const mockPaymentTransactionLog: PaymentTransactionLog = {
    id: 'log123',
    paymentId: 'payment123',
    userId: 'user123',
    action: 'processed',
    provider: 'stripe',
    providerTransactionId: 'pi_123456',
    providerResponse: { status: 'succeeded' },
    amount: 100.50,
    currency: 'USD',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date('2023-01-01T00:00:00.000Z'),
    metadata: { test: true },
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  const mockPaymentTransactionLogDocument: PaymentTransactionLogDocument = {
    id: 'log123',
    paymentId: 'payment123',
    userId: 'user123',
    action: 'processed',
    provider: 'stripe',
    providerTransactionId: 'pi_123456',
    providerResponse: { status: 'succeeded' },
    amount: 100.50,
    currency: 'USD',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: mockTimestamp,
    metadata: { test: true },
  };

  describe('paymentTransactionLogToFirestoreDocument', () => {
    it('should convert PaymentTransactionLog entity to Firestore document format', () => {
      const result = paymentTransactionLogToFirestoreDocument(mockPaymentTransactionLog);
      
      expect(result.id).toBe('log123');
      expect(result.paymentId).toBe('payment123');
      expect(result.userId).toBe('user123');
      expect(result.action).toBe('processed');
      expect(result.provider).toBe('stripe');
      expect(result.providerTransactionId).toBe('pi_123456');
      expect(result.providerResponse).toEqual({ status: 'succeeded' });
      expect(result.amount).toBe(100.50);
      expect(result.currency).toBe('USD');
      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.userAgent).toBe('Mozilla/5.0');
      expect(result.timestamp).toHaveProperty('seconds');
      expect(result.metadata).toEqual({ test: true });
    });
  });

  describe('firestoreDocumentToPaymentTransactionLog', () => {
    it('should convert Firestore document to PaymentTransactionLog entity', () => {
      const result = firestoreDocumentToPaymentTransactionLog(mockPaymentTransactionLogDocument);
      
      expect(result.id).toBe('log123');
      expect(result.paymentId).toBe('payment123');
      expect(result.userId).toBe('user123');
      expect(result.action).toBe('processed');
      expect(result.provider).toBe('stripe');
      expect(result.timestamp).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(result.createdAt).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(result.updatedAt).toEqual(new Date('2023-01-01T00:00:00.000Z'));
    });
  });

  describe('validatePaymentTransactionLogDocument', () => {
    it('should validate correct payment transaction log document', () => {
      expect(validatePaymentTransactionLogDocument(mockPaymentTransactionLogDocument)).toBe(true);
    });

    it('should reject document with invalid action', () => {
      const invalidDoc = { ...mockPaymentTransactionLogDocument, action: 'invalid-action' };
      expect(validatePaymentTransactionLogDocument(invalidDoc)).toBe(false);
    });

    it('should reject document with invalid provider', () => {
      const invalidDoc = { ...mockPaymentTransactionLogDocument, provider: 'invalid-provider' };
      expect(validatePaymentTransactionLogDocument(invalidDoc)).toBe(false);
    });
  });

  // AuditLog tests
  const mockAuditLog: AuditLog = {
    id: 'audit123',
    type: 'payment',
    action: 'payment_created',
    userId: 'user123',
    entityId: 'payment123',
    entityType: 'payment',
    details: { amount: 100.50, currency: 'USD' },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: new Date('2023-01-01T00:00:00.000Z'),
    severity: 'info',
    createdAt: new Date('2023-01-01T00:00:00.000Z'),
    updatedAt: new Date('2023-01-01T00:00:00.000Z'),
  };

  const mockAuditLogDocument: AuditLogDocument = {
    id: 'audit123',
    type: 'payment',
    action: 'payment_created',
    userId: 'user123',
    entityId: 'payment123',
    entityType: 'payment',
    details: { amount: 100.50, currency: 'USD' },
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    timestamp: mockTimestamp,
    severity: 'info',
  };

  describe('auditLogToFirestoreDocument', () => {
    it('should convert AuditLog entity to Firestore document format', () => {
      const result = auditLogToFirestoreDocument(mockAuditLog);
      
      expect(result.id).toBe('audit123');
      expect(result.type).toBe('payment');
      expect(result.action).toBe('payment_created');
      expect(result.userId).toBe('user123');
      expect(result.entityId).toBe('payment123');
      expect(result.entityType).toBe('payment');
      expect(result.details).toEqual({ amount: 100.50, currency: 'USD' });
      expect(result.severity).toBe('info');
      expect(result.timestamp).toHaveProperty('seconds');
    });
  });

  describe('firestoreDocumentToAuditLog', () => {
    it('should convert Firestore document to AuditLog entity', () => {
      const result = firestoreDocumentToAuditLog(mockAuditLogDocument);
      
      expect(result.id).toBe('audit123');
      expect(result.type).toBe('payment');
      expect(result.action).toBe('payment_created');
      expect(result.timestamp).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(result.createdAt).toEqual(new Date('2023-01-01T00:00:00.000Z'));
      expect(result.updatedAt).toEqual(new Date('2023-01-01T00:00:00.000Z'));
    });
  });

  describe('PAYMENT_FIELD_PATHS', () => {
    it('should define all payment field paths', () => {
      expect(PAYMENT_FIELD_PATHS.ID).toBe('id');
      expect(PAYMENT_FIELD_PATHS.USER_ID).toBe('userId');
      expect(PAYMENT_FIELD_PATHS.AMOUNT).toBe('amount');
      expect(PAYMENT_FIELD_PATHS.CURRENCY).toBe('currency');
      expect(PAYMENT_FIELD_PATHS.DESCRIPTION).toBe('description');
      expect(PAYMENT_FIELD_PATHS.STATUS).toBe('status');
      expect(PAYMENT_FIELD_PATHS.DUE_DATE).toBe('dueDate');
      expect(PAYMENT_FIELD_PATHS.PAID_DATE).toBe('paidDate');
      expect(PAYMENT_FIELD_PATHS.PAYMENT_METHOD).toBe('paymentMethod');
      expect(PAYMENT_FIELD_PATHS.TRANSACTION_ID).toBe('transactionId');
      expect(PAYMENT_FIELD_PATHS.CREATED_AT).toBe('createdAt');
      expect(PAYMENT_FIELD_PATHS.UPDATED_AT).toBe('updatedAt');
    });
  });

  describe('AUDIT_LOG_FIELD_PATHS', () => {
    it('should define all audit log field paths', () => {
      expect(AUDIT_LOG_FIELD_PATHS.ID).toBe('id');
      expect(AUDIT_LOG_FIELD_PATHS.TYPE).toBe('type');
      expect(AUDIT_LOG_FIELD_PATHS.ACTION).toBe('action');
      expect(AUDIT_LOG_FIELD_PATHS.USER_ID).toBe('userId');
      expect(AUDIT_LOG_FIELD_PATHS.ENTITY_ID).toBe('entityId');
      expect(AUDIT_LOG_FIELD_PATHS.ENTITY_TYPE).toBe('entityType');
      expect(AUDIT_LOG_FIELD_PATHS.DETAILS).toBe('details');
      expect(AUDIT_LOG_FIELD_PATHS.IP_ADDRESS).toBe('ipAddress');
      expect(AUDIT_LOG_FIELD_PATHS.USER_AGENT).toBe('userAgent');
      expect(AUDIT_LOG_FIELD_PATHS.TIMESTAMP).toBe('timestamp');
      expect(AUDIT_LOG_FIELD_PATHS.SEVERITY).toBe('severity');
    });
  });

  describe('reservationToFirestoreDocument', () => {
    it('should convert Reservation entity to Firestore document format', () => {
      const reservation: Reservation = {
        id: 'res-123',
        userId: 'user-123',
        areaId: 'area-123',
        areaName: 'Swimming Pool',
        startTime: new Date('2024-01-15T10:00:00Z'),
        endTime: new Date('2024-01-15T12:00:00Z'),
        status: 'confirmed',
        notes: 'Birthday party',
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      const result = reservationToFirestoreDocument(reservation);

      expect(result.id).toBe(reservation.id);
      expect(result.userId).toBe(reservation.userId);
      expect(result.areaId).toBe(reservation.areaId);
      expect(result.areaName).toBe(reservation.areaName);
      expect(result.status).toBe(reservation.status);
      expect(result.notes).toBe(reservation.notes);
      expect(result.startTime.seconds).toBe(Math.floor(reservation.startTime.getTime() / 1000));
      expect(result.endTime.seconds).toBe(Math.floor(reservation.endTime.getTime() / 1000));
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });

  describe('firestoreDocumentToReservation', () => {
    it('should convert Firestore document to Reservation entity', () => {
      const doc: ReservationDocument = {
        id: 'res-123',
        userId: 'user-123',
        areaId: 'area-123',
        areaName: 'Swimming Pool',
        startTime: { toDate: () => new Date('2024-01-15T10:00:00Z'), seconds: 1705312800, nanoseconds: 0 },
        endTime: { toDate: () => new Date('2024-01-15T12:00:00Z'), seconds: 1705320000, nanoseconds: 0 },
        status: 'confirmed',
        notes: 'Birthday party',
        createdAt: { toDate: () => new Date('2024-01-01T00:00:00Z'), seconds: 1704067200, nanoseconds: 0 },
        updatedAt: { toDate: () => new Date('2024-01-01T00:00:00Z'), seconds: 1704067200, nanoseconds: 0 },
      };

      const result = firestoreDocumentToReservation(doc);

      expect(result.id).toBe(doc.id);
      expect(result.userId).toBe(doc.userId);
      expect(result.areaId).toBe(doc.areaId);
      expect(result.areaName).toBe(doc.areaName);
      expect(result.status).toBe(doc.status);
      expect(result.notes).toBe(doc.notes);
      expect(result.startTime).toEqual(new Date('2024-01-15T10:00:00Z'));
      expect(result.endTime).toEqual(new Date('2024-01-15T12:00:00Z'));
      expect(result.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(result.updatedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    });
  });

  describe('validateReservationDocument', () => {
    it('should validate correct reservation document', () => {
      const doc = {
        id: 'res-123',
        userId: 'user-123',
        areaId: 'area-123',
        areaName: 'Swimming Pool',
        startTime: { toDate: () => new Date() },
        endTime: { toDate: () => new Date() },
        status: 'confirmed',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
      };

      expect(validateReservationDocument(doc)).toBe(true);
    });

    it('should reject document with missing required fields', () => {
      const doc = {
        id: 'res-123',
        userId: 'user-123',
        // missing areaId
        areaName: 'Swimming Pool',
        startTime: { toDate: () => new Date() },
        endTime: { toDate: () => new Date() },
        status: 'confirmed',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
      };

      expect(validateReservationDocument(doc)).toBe(false);
    });

    it('should reject document with invalid status', () => {
      const doc = {
        id: 'res-123',
        userId: 'user-123',
        areaId: 'area-123',
        areaName: 'Swimming Pool',
        startTime: { toDate: () => new Date() },
        endTime: { toDate: () => new Date() },
        status: 'invalid-status',
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
      };

      expect(validateReservationDocument(doc)).toBe(false);
    });
  });

  describe('commonAreaToFirestoreDocument', () => {
    it('should convert CommonArea entity to Firestore document format', () => {
      const area: CommonArea = {
        id: 'area-123',
        name: 'Swimming Pool',
        description: 'Olympic-size pool',
        capacity: 50,
        availableHours: { start: '06:00', end: '22:00' },
        isActive: true,
        rules: ['No diving', 'No glass containers'],
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
      };

      const result = commonAreaToFirestoreDocument(area);

      expect(result.id).toBe(area.id);
      expect(result.name).toBe(area.name);
      expect(result.description).toBe(area.description);
      expect(result.capacity).toBe(area.capacity);
      expect(result.availableHours).toEqual(area.availableHours);
      expect(result.isActive).toBe(area.isActive);
      expect(result.rules).toEqual(area.rules);
      expect(result).not.toHaveProperty('createdAt');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });

  describe('firestoreDocumentToCommonArea', () => {
    it('should convert Firestore document to CommonArea entity', () => {
      const doc: CommonAreaDocument = {
        id: 'area-123',
        name: 'Swimming Pool',
        description: 'Olympic-size pool',
        capacity: 50,
        availableHours: { start: '06:00', end: '22:00' },
        isActive: true,
        rules: ['No diving', 'No glass containers'],
        createdAt: { toDate: () => new Date('2024-01-01T00:00:00Z'), seconds: 1704067200, nanoseconds: 0 },
        updatedAt: { toDate: () => new Date('2024-01-01T00:00:00Z'), seconds: 1704067200, nanoseconds: 0 },
      };

      const result = firestoreDocumentToCommonArea(doc);

      expect(result.id).toBe(doc.id);
      expect(result.name).toBe(doc.name);
      expect(result.description).toBe(doc.description);
      expect(result.capacity).toBe(doc.capacity);
      expect(result.availableHours).toEqual(doc.availableHours);
      expect(result.isActive).toBe(doc.isActive);
      expect(result.rules).toEqual(doc.rules);
      expect(result.createdAt).toEqual(new Date('2024-01-01T00:00:00Z'));
      expect(result.updatedAt).toEqual(new Date('2024-01-01T00:00:00Z'));
    });
  });

  describe('validateCommonAreaDocument', () => {
    it('should validate correct common area document', () => {
      const doc = {
        id: 'area-123',
        name: 'Swimming Pool',
        description: 'Olympic-size pool',
        capacity: 50,
        availableHours: { start: '06:00', end: '22:00' },
        isActive: true,
        rules: ['No diving'],
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
      };

      expect(validateCommonAreaDocument(doc)).toBe(true);
    });

    it('should reject document with missing required fields', () => {
      const doc = {
        id: 'area-123',
        // missing name
        description: 'Olympic-size pool',
        capacity: 50,
        availableHours: { start: '06:00', end: '22:00' },
        isActive: true,
        rules: ['No diving'],
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
      };

      expect(validateCommonAreaDocument(doc)).toBe(false);
    });

    it('should reject document with invalid capacity type', () => {
      const doc = {
        id: 'area-123',
        name: 'Swimming Pool',
        description: 'Olympic-size pool',
        capacity: 'fifty', // should be number
        availableHours: { start: '06:00', end: '22:00' },
        isActive: true,
        rules: ['No diving'],
        createdAt: { toDate: () => new Date() },
        updatedAt: { toDate: () => new Date() },
      };

      expect(validateCommonAreaDocument(doc)).toBe(false);
    });
  });

  describe('RESERVATION_FIELD_PATHS', () => {
    it('should define all reservation field paths', () => {
      expect(RESERVATION_FIELD_PATHS.ID).toBe('id');
      expect(RESERVATION_FIELD_PATHS.USER_ID).toBe('userId');
      expect(RESERVATION_FIELD_PATHS.AREA_ID).toBe('areaId');
      expect(RESERVATION_FIELD_PATHS.AREA_NAME).toBe('areaName');
      expect(RESERVATION_FIELD_PATHS.START_TIME).toBe('startTime');
      expect(RESERVATION_FIELD_PATHS.END_TIME).toBe('endTime');
      expect(RESERVATION_FIELD_PATHS.STATUS).toBe('status');
      expect(RESERVATION_FIELD_PATHS.NOTES).toBe('notes');
      expect(RESERVATION_FIELD_PATHS.CREATED_AT).toBe('createdAt');
      expect(RESERVATION_FIELD_PATHS.UPDATED_AT).toBe('updatedAt');
    });
  });

  describe('COMMON_AREA_FIELD_PATHS', () => {
    it('should define all common area field paths', () => {
      expect(COMMON_AREA_FIELD_PATHS.ID).toBe('id');
      expect(COMMON_AREA_FIELD_PATHS.NAME).toBe('name');
      expect(COMMON_AREA_FIELD_PATHS.DESCRIPTION).toBe('description');
      expect(COMMON_AREA_FIELD_PATHS.CAPACITY).toBe('capacity');
      expect(COMMON_AREA_FIELD_PATHS.AVAILABLE_HOURS).toBe('availableHours');
      expect(COMMON_AREA_FIELD_PATHS.IS_ACTIVE).toBe('isActive');
      expect(COMMON_AREA_FIELD_PATHS.RULES).toBe('rules');
      expect(COMMON_AREA_FIELD_PATHS.CREATED_AT).toBe('createdAt');
      expect(COMMON_AREA_FIELD_PATHS.UPDATED_AT).toBe('updatedAt');
    });
  });
});