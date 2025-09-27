import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { join } from 'path';

export const initializeI18n = async () => {
  // Determine the correct path for locales
  const localesPath = process.env.NODE_ENV === 'test' 
    ? join(process.cwd(), 'src/locales')
    : join(__dirname, '../locales');

  await i18next
    .use(Backend)
    .init({
      lng: 'es', // default language
      fallbackLng: 'es',
      debug: process.env.NODE_ENV === 'development',
      
      backend: {
        loadPath: join(localesPath, '{{lng}}/{{ns}}.json'),
        addPath: join(localesPath, '{{lng}}/{{ns}}.missing.json'),
      },
      
      ns: ['common', 'errors', 'notifications'],
      defaultNS: 'common',
      
      interpolation: {
        escapeValue: false, // not needed for server-side
      },
      
      saveMissing: false,
      
      detection: {
        order: ['header', 'querystring'],
        lookupHeader: 'accept-language',
        lookupQuerystring: 'lng',
        caches: false,
      },
    });

  return i18next;
};

export { i18next };