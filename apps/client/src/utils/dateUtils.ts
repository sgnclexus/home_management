/**
 * Utility functions for handling dates, especially when dealing with Firestore timestamps
 */

/**
 * Safely converts a value to a Date object
 * Handles Firestore timestamps, ISO strings, and existing Date objects
 */
export const toDate = (value: any): Date => {
  if (value instanceof Date) {
    return value;
  }
  
  if (value && typeof value === 'object' && value.toDate) {
    // Firestore Timestamp
    return value.toDate();
  }
  
  if (value && typeof value === 'object' && value.seconds) {
    // Firestore Timestamp object
    return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
  }
  
  // Try to parse as string or number
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  
  return date;
};

/**
 * Safely formats a date for display
 */
export const formatDateTime = (
  value: any, 
  locale: string = 'es-ES', 
  options: Intl.DateTimeFormatOptions = {}
): string => {
  try {
    const date = toDate(value);
    return date.toLocaleDateString(locale, options);
  } catch (error) {
    console.warn('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Safely formats a time for display
 */
export const formatTime = (
  value: any, 
  locale: string = 'es-ES', 
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
): string => {
  try {
    const date = toDate(value);
    return date.toLocaleTimeString(locale, options);
  } catch (error) {
    console.warn('Error formatting time:', error);
    return 'Invalid Time';
  }
};

/**
 * Formats a date range for display
 */
export const formatDateTimeRange = (
  startValue: any,
  endValue: any,
  locale: string = 'es-ES'
): string => {
  try {
    const startDate = toDate(startValue);
    const endDate = toDate(endValue);
    
    const startTime = formatTime(startDate, locale);
    const endTime = formatTime(endDate, locale);
    
    return `${startTime} - ${endTime}`;
  } catch (error) {
    console.warn('Error formatting date range:', error);
    return 'Invalid Time Range';
  }
};

/**
 * Checks if a date value is valid
 */
export const isValidDate = (value: any): boolean => {
  try {
    const date = toDate(value);
    return !isNaN(date.getTime());
  } catch {
    return false;
  }
};