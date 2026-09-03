import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { SokolDataProvider } from './contexts/SokolDataContext';
import { AnalyticsConstructorProvider } from './components/analytics/constructor/AnalyticsConstructorContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SokolDataProvider>
          <AnalyticsConstructorProvider>
            <BrowserRouter>
              {children}
            </BrowserRouter>
          </AnalyticsConstructorProvider>
        </SokolDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
