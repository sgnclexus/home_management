import { GetStaticPropsContext, GetServerSidePropsContext } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

/**
 * Supported locales in the application
 */
export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];

/**
 * Default locale for the application
 */
export const DEFAULT_LOCALE: SupportedLocale = 'es';

/**
 * Common namespaces used across the application
 */
export const COMMON_NAMESPACES = ['common'] as const;

/**
 * Get server-side translations for a page
 * @param locale - The locale to get translations for
 * @param namespaces - Array of translation namespaces to include
 * @returns Promise with translation props
 */
export const getTranslations = async (
  locale: string,
  namespaces: string[] = ['common']
) => {
  return serverSideTranslations(locale, namespaces);
};

/**
 * Get static props with translations for static pages
 * @param context - Next.js GetStaticPropsContext
 * @param namespaces - Array of translation namespaces to include
 * @returns Promise with translation props
 */
export const getStaticTranslations = async (
  context: GetStaticPropsContext,
  namespaces: string[] = ['common']
) => {
  const locale = context.locale || DEFAULT_LOCALE;
  return {
    props: {
      ...(await serverSideTranslations(locale, namespaces)),
    },
  };
};

/**
 * Get server-side props with translations for SSR pages
 * @param context - Next.js GetServerSidePropsContext
 * @param namespaces - Array of translation namespaces to include
 * @returns Promise with translation props
 */
export const getServerSideTranslations = async (
  context: GetServerSidePropsContext,
  namespaces: string[] = ['common']
) => {
  const locale = context.locale || DEFAULT_LOCALE;
  return {
    props: {
      ...(await serverSideTranslations(locale, namespaces)),
    },
  };
};

/**
 * Check if a locale is supported
 * @param locale - The locale to check
 * @returns boolean indicating if the locale is supported
 */
export const isSupportedLocale = (locale: string): locale is SupportedLocale => {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
};

/**
 * Get the display name for a locale
 * @param locale - The locale code
 * @returns The display name of the locale
 */
export const getLocaleDisplayName = (locale: string): string => {
  const displayNames: Record<SupportedLocale, string> = {
    es: 'Español',
    en: 'English',
  };
  
  return displayNames[locale as SupportedLocale] || locale;
};

/**
 * Format a date according to the current locale
 * @param date - The date to format
 * @param locale - The locale to use for formatting
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  locale: string = DEFAULT_LOCALE,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, options).format(dateObj);
};

/**
 * Format a number according to the current locale
 * @param number - The number to format
 * @param locale - The locale to use for formatting
 * @param options - Intl.NumberFormatOptions
 * @returns Formatted number string
 */
export const formatNumber = (
  number: number,
  locale: string = DEFAULT_LOCALE,
  options: Intl.NumberFormatOptions = {}
): string => {
  return new Intl.NumberFormat(locale, options).format(number);
};

/**
 * Format currency according to the current locale
 * @param amount - The amount to format
 * @param currency - The currency code (e.g., 'USD', 'EUR')
 * @param locale - The locale to use for formatting
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currency: string = 'USD',
  locale: string = DEFAULT_LOCALE
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Get the text direction for a locale
 * @param locale - The locale code
 * @returns 'ltr' or 'rtl'
 */
export const getTextDirection = (locale: string): 'ltr' | 'rtl' => {
  // For now, all supported locales are LTR
  // This can be extended if RTL languages are added
  return 'ltr';
};

/**
 * Translation key helper for type safety
 * @param key - The translation key
 * @returns The same key (for type checking)
 */
export const t = (key: string): string => key;