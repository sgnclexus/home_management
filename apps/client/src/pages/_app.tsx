import type { AppProps } from 'next/app';
import { appWithTranslation } from 'next-i18next';
import { AuthProvider } from '../contexts/AuthContext';
import { NetworkStatus, PWAUpdatePrompt } from '../components/pwa';
import ErrorBoundary from '../components/common/ErrorBoundary';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NetworkStatus />
        <PWAUpdatePrompt className="fixed top-16 left-4 right-4 z-40" />
        <Component {...pageProps} />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default appWithTranslation(MyApp);