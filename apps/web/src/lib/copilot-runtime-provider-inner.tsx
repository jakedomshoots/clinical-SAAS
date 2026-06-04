import { CopilotKitProvider } from '@copilotkit/react-core/v2';
import '@copilotkit/react-core/v2/styles.css';
import { type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { CopilotClinicalToolRegistry } from '@/lib/copilot-tools';

export default function CopilotRuntimeProviderInner({
  children,
  runtimeUrl,
  publicApiKey,
}: {
  children: ReactNode;
  runtimeUrl?: string;
  publicApiKey?: string;
}) {
  const { token, user } = useAuth();
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  return (
    <CopilotKitProvider
      runtimeUrl={runtimeUrl}
      publicApiKey={publicApiKey}
      headers={headers}
      showDevConsole="auto"
      properties={{
        product: 'Concierge OS',
        role: user?.role ?? 'anonymous',
        userId: user?.id ?? null,
      }}
    >
      <CopilotClinicalToolRegistry />
      {children}
    </CopilotKitProvider>
  );
}
