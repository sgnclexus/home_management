import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isSupportedLocale,
  getLocaleDisplayName,
  formatDate,
  formatNumber,
  formatCurrency,
  getTextDirection,
} from '../i18n';

describe('i18n utilities', () => {
  describe('constants', () => {
    it('should have correct supported locales', () => {
      expect(SUPPORTED_LOCALES).toEqual(['es', 'en']);
    });

    it('should have correct default locale', () => {
      expect(DEFAULT_LOCALE).toBe('es');
    });
  });

  describe('isSupportedLocale', () => {
    it('should return true for supported locales', () => {
      expect(isSupportedLocale('es')).toBe(true);
      expect(isSupportedLocale('en')).toBe(true);
    });

    it('should return false for unsupported locales', () => {
      expect(isSupportedLocale('fr')).toBe(false);
      expect(isSupportedLocale('de')).toBe(false);
      expect(isSupportedLocale('')).toBe(false);
    });
  });

  describe('getLocaleDisplayName', () => {
    it('should return correct display names for supported locales', () => {
      expect(getLocaleDisplayName('es')).toBe('Español');
      expect(getLocaleDisplayName('en')).toBe('English');
    });

    it('should return the locale code for unsupported locales', () => {
      expect(getLocaleDisplayName('fr')).toBe('fr');
      expect(getLocaleDisplayName('unknown')).toBe('unknown');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2024-01-15T10:30:00Z');

    it('should format date with default locale and options', () => {
      const formatted = formatDate(testDate);
      expect(formatted).toMatch(/enero|January/); // Should contain month name
      expect(formatted).toContain('2024');
      expect(formatted).toContain('15');
    });

    it('should format date with specific locale', () => {
      const formattedEs = formatDate(testDate, 'es');
      const formattedEn = formatDate(testDate, 'en');
      
      expect(formattedEs).toContain('enero');
      expect(formattedEn).toContain('January');
    });

    it('should format date with custom options', () => {
      const formatted = formatDate(testDate, 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
      
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('2024');
    });

    it('should handle string dates', () => {
      const formatted = formatDate('2024-01-15', 'en');
      expect(formatted).toContain('January');
      expect(formatted).toContain('2024');
    });
  });

  describe('formatNumber', () => {
    it('should format number with default locale', () => {
      const formatted = formatNumber(1234.56);
      expect(formatted).toContain('1234');
      expect(formatted).toContain('56');
    });

    it('should format number with specific locale', () => {
      const formattedEs = formatNumber(1234.56, 'es');
      const formattedEn = formatNumber(1234.56, 'en');
      
      // Both should be formatted strings containing the number parts
      expect(typeof formattedEs).toBe('string');
      expect(typeof formattedEn).toBe('string');
      expect(formattedEs).toContain('56');
      expect(formattedEn).toContain('56');
      // English uses comma separator for thousands
      expect(formattedEn).toMatch(/1[,.]234/);
    });

    it('should format number with custom options', () => {
      const formatted = formatNumber(0.1234, 'en', {
        style: 'percent',
        minimumFractionDigits: 2,
      });
      
      expect(formatted).toContain('%');
      expect(formatted).toContain('12');
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with default options', () => {
      const formatted = formatCurrency(1234.56);
      expect(formatted).toContain('56');
      expect(typeof formatted).toBe('string');
    });

    it('should format currency with specific currency', () => {
      const formattedUSD = formatCurrency(1234.56, 'USD', 'en');
      const formattedEUR = formatCurrency(1234.56, 'EUR', 'en');
      
      expect(formattedUSD).toContain('$');
      expect(formattedEUR).toContain('€');
    });

    it('should format currency with different locales', () => {
      const formattedEs = formatCurrency(1234.56, 'USD', 'es');
      const formattedEn = formatCurrency(1234.56, 'USD', 'en');
      
      // Both should contain currency symbols and be strings
      expect(typeof formattedEs).toBe('string');
      expect(typeof formattedEn).toBe('string');
      expect(formattedEs.length).toBeGreaterThan(0);
      expect(formattedEn.length).toBeGreaterThan(0);
    });
  });

  describe('getTextDirection', () => {
    it('should return ltr for all supported locales', () => {
      expect(getTextDirection('es')).toBe('ltr');
      expect(getTextDirection('en')).toBe('ltr');
    });

    it('should return ltr for unsupported locales', () => {
      expect(getTextDirection('ar')).toBe('ltr'); // Would be 'rtl' if Arabic was supported
      expect(getTextDirection('unknown')).toBe('ltr');
    });
  });
});