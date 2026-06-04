import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth';
import { App } from '@/App';
import { CopilotRuntimeProvider } from '@/lib/copilot-runtime';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CopilotRuntimeProvider>
          <App />
        </CopilotRuntimeProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
