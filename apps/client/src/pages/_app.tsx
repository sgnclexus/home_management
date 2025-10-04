import type { AppProps } from 'next/app';
import Head from 'next/head';
import { appWithTranslation } from 'next-i18next';
import { AuthProvider } from '../contexts/AuthContext';
import { RealtimeProvider } from '../contexts/RealtimeContext';
import { NetworkStatus, PWAUpdatePrompt } from '../components/pwa';
import ErrorBoundary from '../components/common/ErrorBoundary';
import NoSSR from '../components/common/NoSSR';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <Head>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover" />
      </Head>
      <AuthProvider>
        <RealtimeProvider>
          <NoSSR>
            <NetworkStatus />
            <PWAUpdatePrompt className="fixed top-16 left-4 right-4 z-40" />
          </NoSSR>
          <Component {...pageProps} />
        </RealtimeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default appWithTranslation(MyApp);