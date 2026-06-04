import { lazy, Suspense, type ReactNode } from 'react';

const runtimeUrl = import.meta.env.VITE_COPILOTKIT_RUNTIME_URL?.trim();
const publicApiKey = import.meta.env.VITE_COPILOTKIT_PUBLIC_API_KEY?.trim();
const copilotEnabled = Boolean(runtimeUrl || publicApiKey);
const CopilotRuntimeProviderInner = lazy(() => import('@/lib/copilot-runtime-provider-inner'));

export function isCopilotRuntimeEnabled() {
  return copilotEnabled;
}

export function CopilotRuntimeProvider({ children }: { children: ReactNode }) {
  if (!copilotEnabled) {
    return children;
  }

  return (
    <Suspense fallback={children}>
      <CopilotRuntimeProviderInner
        runtimeUrl={runtimeUrl || undefined}
        publicApiKey={publicApiKey || undefined}
      >
        {children}
      </CopilotRuntimeProviderInner>
    </Suspense>
  );
}
