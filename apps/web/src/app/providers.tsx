'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Toaster } from 'sonner';
import { AuthProvider } from '../contexts/auth.context';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 2 * 60 * 1000,
        refetchOnWindowFocus: true,
        // Don't retry on 4xx — only on network/5xx errors
        retry: (failureCount, error) => {
          if (error instanceof AxiosError) {
            const status = error.response?.status;
            if (status && status >= 400 && status < 500) return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // useState initializer guarantees single instance per component mount.
  // Never use a module-level singleton — it causes cross-tenant data leakage
  // in multi-tenant SaaS when users switch sessions without a full page reload.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--st-d-1)',
            border: '1px solid var(--st-d-3)',
            color: 'var(--st-d-9)',
            fontFamily: 'var(--st-font-ui)',
            fontSize: '13.5px',
          },
        }}
      />
    </QueryClientProvider>
  );
}
