import { Test, TestingModule } from '@nestjs/testing';
import { I18nService, SupportedLanguage } from '../i18n.service';
import { i18next } from '../../config/i18n.config';

// Mock i18next
jest.mock('../../config/i18n.config', () => ({
  i18next: {
    t: jest.fn(),
  },
}));

const mockI18next = i18next as jest.Mocked<typeof i18next>;

describe('I18nService', () => {
  let service: I18nService;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup default mock behavior
    mockI18next.t.mockImplementation((...args: any[]) => {
      const [key, options = {}] = args;
      const { lng = 'es' } = options;
      
      // Mock translations
      const translations: Record<string, Record<string, string>> = {
        es: {
          'success': 'Éxito',
          'common.created': 'Creado exitosamente',
          'errors.user.notFound': 'Usuario no encontrado',
          'errors.payment.invalidAmount': 'Monto inválido',
          'notifications.payment.processed': 'Su pago de {{amount}} ha sido procesado exitosamente',
          'notifications.payment.dueReminder': 'Recordatorio: Su pago de {{amount}} vence el {{dueDate}}',
        },
        en: {
          'success': 'Success',
          'common.created': 'Created successfully',
          'errors.user.notFound': 'User not found',
          'errors.payment.invalidAmount': 'Invalid amount',
          'notifications.payment.processed': 'Your payment of {{amount}} has been processed successfully',
          'notifications.payment.dueReminder': 'Reminder: Your payment of {{amount}} is due on {{dueDate}}',
        },
      };
      
      let translation = translations[lng]?.[key] || key;
      
      // Handle interpolation
      if (options.amount) {
        translation = translation.replace('{{amount}}', options.amount);
      }
      if (options.dueDate) {
        translation = translation.replace('{{dueDate}}', options.dueDate);
      }
      
      return translation;
    });
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [I18nService],
    }).compile();

    service = module.get<I18nService>(I18nService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('translate', () => {
    it('should translate basic keys in Spanish', () => {
      const result = service.translate('success', { lng: 'es' });
      expect(result).toBe('Éxito');
    });

    it('should translate basic keys in English', () => {
      const result = service.translate('success', { lng: 'en' });
      expect(result).toBe('Success');
    });

    it('should handle interpolation', () => {
      const result = service.translate('notifications.payment.dueReminder', {
        lng: 'en',
        amount: '$100',
        dueDate: '2024-01-15',
      });
      expect(result).toContain('$100');
      expect(result).toContain('2024-01-15');
    });

    it('should default to Spanish when no language specified', () => {
      const result = service.translate('success');
      expect(result).toBe('Éxito');
    });
  });

  describe('getErrorMessage', () => {
    it('should get error message in Spanish', () => {
      const result = service.getErrorMessage('user.notFound', 'es');
      expect(result).toBe('Usuario no encontrado');
    });

    it('should get error message in English', () => {
      const result = service.getErrorMessage('user.notFound', 'en');
      expect(result).toBe('User not found');
    });

    it('should handle interpolation in error messages', () => {
      const result = service.getErrorMessage('payment.invalidAmount', 'en', {
        amount: '$-50',
      });
      expect(result).toContain('Invalid amount');
    });
  });

  describe('getNotificationMessage', () => {
    it('should get notification message in Spanish', () => {
      const result = service.getNotificationMessage('payment.processed', 'es', {
        amount: '$100',
      });
      expect(result).toContain('$100');
      expect(result).toContain('procesado exitosamente');
    });

    it('should get notification message in English', () => {
      const result = service.getNotificationMessage('payment.processed', 'en', {
        amount: '$100',
      });
      expect(result).toContain('$100');
      expect(result).toContain('processed successfully');
    });
  });

  describe('getSuccessMessage', () => {
    it('should get success message in Spanish', () => {
      const result = service.getSuccessMessage('created', 'es');
      expect(result).toBe('Creado exitosamente');
    });

    it('should get success message in English', () => {
      const result = service.getSuccessMessage('created', 'en');
      expect(result).toBe('Created successfully');
    });
  });

  describe('detectLanguage', () => {
    it('should detect Spanish from Accept-Language header', () => {
      const result = service.detectLanguage('es-ES,es;q=0.9,en;q=0.8');
      expect(result).toBe('es');
    });

    it('should detect English from Accept-Language header', () => {
      const result = service.detectLanguage('en-US,en;q=0.9,es;q=0.8');
      expect(result).toBe('en');
    });

    it('should default to Spanish for unsupported languages', () => {
      const result = service.detectLanguage('fr-FR,fr;q=0.9,de;q=0.8');
      expect(result).toBe('es');
    });

    it('should default to Spanish when no header provided', () => {
      const result = service.detectLanguage();
      expect(result).toBe('es');
    });

    it('should handle complex Accept-Language headers', () => {
      const result = service.detectLanguage('fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5');
      expect(result).toBe('en');
    });
  });

  describe('getUserLanguage', () => {
    it('should return user preferred language when valid', () => {
      const user = { preferredLanguage: 'en' };
      const result = service.getUserLanguage(user);
      expect(result).toBe('en');
    });

    it('should return Spanish for invalid preferred language', () => {
      const user = { preferredLanguage: 'fr' };
      const result = service.getUserLanguage(user);
      expect(result).toBe('es');
    });

    it('should return Spanish when no preferred language', () => {
      const user = {};
      const result = service.getUserLanguage(user);
      expect(result).toBe('es');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2024-01-15T10:30:00Z');

    it('should format date in Spanish locale', () => {
      const result = service.formatDate(testDate, 'es');
      expect(result).toContain('enero');
      expect(result).toContain('2024');
    });

    it('should format date in English locale', () => {
      const result = service.formatDate(testDate, 'en');
      expect(result).toContain('January');
      expect(result).toContain('2024');
    });

    it('should use custom format options', () => {
      const result = service.formatDate(testDate, 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      expect(result).toContain('Jan');
      expect(result).toContain('2024');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency in Spanish locale', () => {
      const result = service.formatCurrency(1234.56, 'USD', 'es');
      expect(result).toContain('1234');
      expect(result).toContain('56');
    });

    it('should format currency in English locale', () => {
      const result = service.formatCurrency(1234.56, 'USD', 'en');
      expect(result).toContain('$');
      expect(result).toContain('1,234.56');
    });

    it('should handle different currencies', () => {
      const result = service.formatCurrency(1000, 'EUR', 'en');
      expect(result).toContain('€');
      expect(result).toContain('1,000');
    });
  });
});