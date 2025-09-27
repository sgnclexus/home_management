import { Injectable } from '@nestjs/common';
import { i18next } from '../config/i18n.config';

export type SupportedLanguage = 'es' | 'en';

@Injectable()
export class I18nService {
  /**
   * Translate a key with optional interpolation values
   * @param key - Translation key (e.g., 'errors.user.notFound')
   * @param options - Translation options including language and interpolation values
   * @returns Translated string
   */
  translate(
    key: string,
    options: {
      lng?: SupportedLanguage;
      ns?: string;
      [key: string]: any;
    } = {}
  ): string {
    const { lng = 'es', ns, ...interpolationValues } = options;
    
    return i18next.t(key, {
      lng,
      ns,
      ...interpolationValues,
    });
  }

  /**
   * Get translated error message
   * @param errorKey - Error key (e.g., 'user.notFound')
   * @param language - Target language
   * @param interpolationValues - Values for string interpolation
   * @returns Translated error message
   */
  getErrorMessage(
    errorKey: string,
    language: SupportedLanguage = 'es',
    interpolationValues: Record<string, any> = {}
  ): string {
    return this.translate(`errors.${errorKey}`, {
      lng: language,
      ...interpolationValues,
    });
  }

  /**
   * Get translated notification message
   * @param notificationKey - Notification key (e.g., 'payment.dueReminder')
   * @param language - Target language
   * @param interpolationValues - Values for string interpolation
   * @returns Translated notification message
   */
  getNotificationMessage(
    notificationKey: string,
    language: SupportedLanguage = 'es',
    interpolationValues: Record<string, any> = {}
  ): string {
    return this.translate(`notifications.${notificationKey}`, {
      lng: language,
      ...interpolationValues,
    });
  }

  /**
   * Get translated success message
   * @param successKey - Success key (e.g., 'created', 'updated')
   * @param language - Target language
   * @param interpolationValues - Values for string interpolation
   * @returns Translated success message
   */
  getSuccessMessage(
    successKey: string,
    language: SupportedLanguage = 'es',
    interpolationValues: Record<string, any> = {}
  ): string {
    return this.translate(`common.${successKey}`, {
      lng: language,
      ...interpolationValues,
    });
  }

  /**
   * Detect language from request headers
   * @param acceptLanguageHeader - Accept-Language header value
   * @returns Detected language or default
   */
  detectLanguage(acceptLanguageHeader?: string): SupportedLanguage {
    if (!acceptLanguageHeader) {
      return 'es';
    }

    // Parse Accept-Language header
    const languages = acceptLanguageHeader
      .split(',')
      .map(lang => {
        const [code, quality = '1'] = lang.trim().split(';q=');
        return {
          code: code.toLowerCase().split('-')[0], // Get base language code
          quality: parseFloat(quality),
        };
      })
      .sort((a, b) => b.quality - a.quality);

    // Find first supported language
    for (const lang of languages) {
      if (lang.code === 'es' || lang.code === 'en') {
        return lang.code as SupportedLanguage;
      }
    }

    return 'es'; // Default fallback
  }

  /**
   * Get user's preferred language from user data
   * @param user - User object with preferredLanguage property
   * @returns User's preferred language or default
   */
  getUserLanguage(user: { preferredLanguage?: string }): SupportedLanguage {
    const preferredLang = user.preferredLanguage?.toLowerCase();
    
    if (preferredLang === 'es' || preferredLang === 'en') {
      return preferredLang as SupportedLanguage;
    }
    
    return 'es'; // Default fallback
  }

  /**
   * Format date according to language locale
   * @param date - Date to format
   * @param language - Target language
   * @param options - Intl.DateTimeFormatOptions
   * @returns Formatted date string
   */
  formatDate(
    date: Date,
    language: SupportedLanguage = 'es',
    options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  ): string {
    const locale = language === 'es' ? 'es-ES' : 'en-US';
    return new Intl.DateTimeFormat(locale, options).format(date);
  }

  /**
   * Format currency according to language locale
   * @param amount - Amount to format
   * @param currency - Currency code (default: USD)
   * @param language - Target language
   * @returns Formatted currency string
   */
  formatCurrency(
    amount: number,
    currency: string = 'USD',
    language: SupportedLanguage = 'es'
  ): string {
    const locale = language === 'es' ? 'es-ES' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  }
}