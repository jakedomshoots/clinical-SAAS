import { CopilotKitProvider, CopilotPopup } from '@copilotkit/react-core/v2';
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
  const { user } = useAuth();

  return (
    <CopilotKitProvider
      runtimeUrl={runtimeUrl}
      publicApiKey={publicApiKey}
      showDevConsole="auto"
      properties={{
        product: 'Concierge OS',
        role: user?.role ?? 'anonymous',
      }}
    >
      <CopilotClinicalToolRegistry />
      {children}
      <CopilotPopup
        agentId="default"
        defaultOpen={false}
        width={420}
        height={620}
        labels={{
          modalHeaderTitle: 'Concierge OS Copilot',
          chatInputPlaceholder: 'Ask about the current queue or stage a confirmed action...',
          welcomeMessageText:
            'I can help inspect the current operational context and prepare staff-confirmed actions.',
        }}
      />
    </CopilotKitProvider>
  );
}
