import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Bot,
  Check,
  ClipboardList,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Navigation,
  Printer,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AssistantCommandInputMode,
  AssistantCommandResult,
  AssistantProposal,
} from '@concierge-os/shared';
import { useToast } from '@/components/toast';
import { useApi } from '@/lib/api-client';
import {
  confirmAssistantProposal,
  dismissAssistantProposal,
  fetchAssistantProposals,
  submitAssistantCommand,
} from '@/lib/assistant-tools';
import { QUERY_KEYS } from '@/lib/query-keys';
import { humanizeWorkflowLabel } from '@/lib/ui-state';

type BrowserSpeechRecognitionEvent = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type BrowserSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

interface ClickyCommandPanelProps {
  nativeCommandsEnabled: boolean;
  contextPath?: string;
  contextLabel?: string;
  className?: string;
  compact?: boolean;
}

interface ClickyHistoryItem {
  id: string;
  command: string;
  inputMode: AssistantCommandInputMode;
  result: AssistantCommandResult;
}

function routeLabelFor(pathname: string) {
  if (pathname.startsWith('/patients/')) return 'Patient chart';
  if (pathname.startsWith('/patients')) return 'Patient search';
  if (pathname.startsWith('/tasks')) return 'Task queue';
  if (pathname.startsWith('/scheduling')) return 'Schedule';
  if (pathname.startsWith('/faxes')) return 'Fax center';
  if (pathname.startsWith('/messaging')) return 'Messages';
  if (pathname.startsWith('/billing')) return 'Billing cases';
  if (pathname.startsWith('/operations')) return 'Operations';
  if (pathname.startsWith('/setup')) return 'Setup';
  if (pathname.startsWith('/assistant-review')) return 'Assistant log';
  if (pathname.startsWith('/clicky')) return 'Clicky cockpit';
  return 'Command center';
}

function entityContextFor(pathname: string) {
  if (!pathname.startsWith('/patients/')) return { entityType: null, entityId: null };
  const patientId = pathname.split('/')[2] || null;
  return { entityType: patientId ? 'patient' : null, entityId: patientId };
}

function proposalActionPath(proposalType: AssistantProposal['proposal_type']) {
  if (proposalType === 'clinical.create_follow_up_task') return '/assistant/actions/follow-up-task';
  if (proposalType === 'clinical.draft_portal_reply') return '/assistant/actions/portal-reply-draft';
  if (proposalType === 'clinical.stage_fax_match') return '/assistant/actions/fax-match';
  return null;
}

function resultTone(resultType: AssistantCommandResult['result_type']) {
  if (resultType === 'proposal') return 'border-accent-soft bg-accent-soft text-accent';
  if (resultType === 'blocked') return 'border-danger/20 bg-danger/10 text-danger';
  if (resultType === 'clarification') return 'border-warn/30 bg-warn/10 text-warn';
  return 'border-border bg-canvas text-ink-secondary';
}

function previewPayload(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}

export function ClickyCommandPanel({
  nativeCommandsEnabled,
  contextPath,
  contextLabel,
  className = '',
  compact = false,
}: ClickyCommandPanelProps) {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentPathname = useRouterState({ select: (state) => state.location.pathname });
  const activePath = contextPath ?? currentPathname;
  const activeLabel = contextLabel ?? routeLabelFor(activePath);
  const { entityType, entityId } = entityContextFor(activePath);
  const [commandText, setCommandText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState<ClickyHistoryItem[]>([]);
  const speechRef = useRef<BrowserSpeechRecognition | null>(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const proposalsQuery = useQuery({
    queryKey: [...QUERY_KEYS.ASSISTANT_PROPOSALS, 'clicky-panel'],
    queryFn: () => fetchAssistantProposals(api),
  });

  const invalidateAssistantData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSISTANT_PROPOSALS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAXES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MESSAGES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT }),
    ]);
  };

  const commandMutation = useMutation({
    mutationFn: ({ command, inputMode }: { command: string; inputMode: AssistantCommandInputMode }) =>
      submitAssistantCommand(api, {
        command,
        input_mode: inputMode,
        route_path: activePath,
        entity_type: entityType,
        entity_id: entityId,
      }),
    onSuccess: async (result, variables) => {
      setMessage(result.message);
      setHistory((current) => [
        {
          id: `${Date.now()}-${current.length}`,
          command: variables.command,
          inputMode: variables.inputMode,
          result,
        },
        ...current,
      ].slice(0, 5));
      setCommandText('');
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSISTANT_PROPOSALS });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Clicky command failed');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (proposal: AssistantProposal) => {
      const actionPath = proposalActionPath(proposal.proposal_type);
      if (actionPath) {
        await api.post(actionPath, proposal.payload);
      } else if (proposal.proposal_type === 'navigation.open_route') {
        const routePath =
          typeof proposal.payload.route_path === 'string'
            ? proposal.payload.route_path
            : proposal.route_path;
        await navigate({ to: routePath });
      }
      return confirmAssistantProposal(api, proposal.id);
    },
    onSuccess: async () => {
      toast.success('Clicky proposal confirmed');
      await invalidateAssistantData();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm proposal');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (proposalId: string) => dismissAssistantProposal(api, proposalId),
    onSuccess: async () => {
      toast.success('Clicky proposal dismissed');
      await invalidateAssistantData();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to dismiss proposal');
    },
  });

  const quickCommands = useMemo(
    () => [
      {
        label: 'Open billing',
        command: 'open billing queue',
        icon: Navigation,
        disabled: false,
      },
      {
        label: 'Summarize view',
        command: 'summarize this view',
        icon: Sparkles,
        disabled: false,
      },
      {
        label: 'Create follow-up',
        command: 'create follow up task to call tomorrow',
        icon: ClipboardList,
        disabled: !activePath.startsWith('/patients/'),
      },
      {
        label: 'Draft reply',
        command: 'draft portal reply about the lab result',
        icon: MessageSquare,
        disabled: false,
      },
      {
        label: 'Stage fax match',
        command: 'stage fax match to the first patient',
        icon: Printer,
        disabled: false,
      },
      {
        label: 'Review blockers',
        command: 'review launch blockers',
        icon: ShieldCheck,
        disabled: false,
      },
    ],
    [activePath]
  );

  const submitCommand = (inputMode: AssistantCommandInputMode, overrideCommand?: string) => {
    const command = (overrideCommand ?? commandText).trim();
    if (!command || commandMutation.isPending || !nativeCommandsEnabled) return;
    commandMutation.mutate({ command, inputMode });
  };

  const toggleVoice = () => {
    if (!speechSupported || listening) {
      speechRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognitionCtor = (
      window as typeof window & {
        SpeechRecognition?: new () => BrowserSpeechRecognition;
        webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
      }
    ).SpeechRecognition ?? (window as typeof window & {
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      setListening(false);
      setCommandText(transcript);
      if (transcript.trim()) commandMutation.mutate({ command: transcript, inputMode: 'voice' });
    };
    recognition.onerror = () => {
      setListening(false);
      setMessage('Voice capture failed. Typed commands remain available.');
    };
    recognition.onend = () => setListening(false);
    speechRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  useEffect(
    () => () => {
      speechRef.current?.stop();
    },
    []
  );

  const proposals = proposalsQuery.data ?? [];
  const latestProposalId = history.find((item) => item.result.proposal)?.result.proposal?.id;

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-canvas-raised ${className}`}
      data-testid="clicky-command-panel"
      aria-label="Clicky command panel"
    >
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md border border-accent-soft bg-accent-soft">
            <Bot className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-subhead font-semibold text-ink">Clicky</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-micro text-ink-muted">
              <span className="rounded-sm border border-border bg-canvas px-2 py-1">
                {activeLabel}
              </span>
              <span className="rounded-sm border border-border bg-canvas px-2 py-1 font-mono">
                {activePath}
              </span>
              {entityId && (
                <span className="rounded-sm border border-border bg-canvas px-2 py-1">
                  {entityType}: {entityId.slice(-4)}
                </span>
              )}
            </div>
          </div>
          <div className="rounded-sm border border-border bg-canvas px-2 py-1 text-micro text-ink-muted">
            {nativeCommandsEnabled ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}>
        <div className="rounded-md border border-border bg-canvas p-3">
          <div className="flex items-center gap-2">
            <input
              data-testid="clicky-command-input"
              disabled={!nativeCommandsEnabled || commandMutation.isPending}
              value={commandText}
              onChange={(event) => {
                setCommandText(event.target.value);
                setMessage(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitCommand('typed');
              }}
              className="h-10 min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed disabled:opacity-60"
              placeholder="Ask Clicky to open, summarize, draft, match, or stage work..."
            />
            <button
              type="button"
              onClick={toggleVoice}
              disabled={!nativeCommandsEnabled || !speechSupported || commandMutation.isPending}
              aria-label={listening ? 'Stop Clicky voice command' : 'Start Clicky voice command'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-ink-muted hover:bg-canvas-sunk disabled:cursor-not-allowed disabled:opacity-50"
            >
              {listening ? <MicOff className="h-4 w-4 text-danger" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              type="button"
              data-testid="clicky-submit-command"
              onClick={() => submitCommand('typed')}
              disabled={!nativeCommandsEnabled || !commandText.trim() || commandMutation.isPending}
              aria-label="Submit Clicky command"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-accent text-accent-on hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {commandMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {!nativeCommandsEnabled && (
            <div className="mt-3 rounded-sm border border-warn/30 bg-warn/10 px-3 py-2 text-small text-warn">
              Clicky command entry is disabled. Pending proposals remain reviewable.
            </div>
          )}
          {!speechSupported && (
            <div className="mt-3 text-micro text-ink-faint">
              Voice capture is unavailable in this browser; typed commands are active.
            </div>
          )}
          {message && (
            <div
              data-testid="clicky-command-message"
              className="mt-3 rounded-sm border border-border bg-canvas-raised px-3 py-2 text-small text-ink-secondary"
            >
              {message}
            </div>
          )}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {quickCommands.map(({ label, command, icon: Icon, disabled }) => (
            <button
              key={label}
              type="button"
              data-testid={`clicky-quick-${label.toLowerCase().replaceAll(' ', '-')}`}
              onClick={() => submitCommand('typed', command)}
              disabled={!nativeCommandsEnabled || disabled || commandMutation.isPending}
              className="flex min-h-12 items-center gap-2 rounded-md border border-border bg-canvas px-3 py-2 text-left text-small text-ink-secondary hover:bg-canvas-sunk disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon className="h-4 w-4 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{label}</span>
                <span className="block truncate text-micro text-ink-muted">{command}</span>
              </span>
            </button>
          ))}
        </div>

        {history.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-meta font-medium uppercase text-ink-faint">
              Recent command results
            </div>
            <div className="space-y-2">
              {history.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-md border px-3 py-2 text-small ${resultTone(item.result.result_type)}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="rounded-sm border border-current/20 px-1.5 py-0.5 text-micro uppercase">
                      {item.inputMode}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink">{item.command}</div>
                      <div className="mt-1 text-current">{item.result.message}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4" data-testid="clicky-proposal-list">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-meta font-medium uppercase text-ink-faint">
              Staged proposals
            </div>
            <button
              type="button"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSISTANT_PROPOSALS })
              }
              className="rounded-md border border-border px-2 py-1 text-micro font-medium text-ink-muted hover:bg-canvas-sunk"
            >
              Refresh
            </button>
          </div>

          {proposalsQuery.isLoading ? (
            <div className="rounded-md border border-border bg-canvas px-3 py-4 text-small text-ink-muted">
              Loading Clicky proposals
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-md border border-border bg-canvas px-3 py-4 text-small text-ink-muted">
              No staged proposals.
            </div>
          ) : (
            <div className="space-y-2">
              {proposals.slice(0, compact ? 3 : 6).map((proposal) => (
                <article
                  key={proposal.id}
                  data-testid={`clicky-proposal-${proposal.id}`}
                  className={`rounded-md border bg-canvas px-3 py-3 ${
                    latestProposalId === proposal.id ? 'border-accent' : 'border-border'
                  }`}
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="text-micro font-medium uppercase text-ink-faint">
                        {humanizeWorkflowLabel(proposal.proposal_type)}
                      </div>
                      <h3 className="mt-1 text-small font-semibold text-ink">
                        {proposal.title}
                      </h3>
                      <p className="mt-1 text-small text-ink-secondary">{proposal.summary}</p>
                      <p className="mt-1 text-micro text-ink-muted">
                        {proposal.confidence_reason}
                      </p>
                    </div>
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        data-testid={`clicky-confirm-${proposal.id}`}
                        onClick={() => confirmMutation.mutate(proposal)}
                        disabled={confirmMutation.isPending || dismissMutation.isPending}
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-2.5 text-small font-semibold text-accent-on disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Confirm
                      </button>
                      <button
                        type="button"
                        data-testid={`clicky-dismiss-${proposal.id}`}
                        onClick={() => dismissMutation.mutate(proposal.id)}
                        disabled={confirmMutation.isPending || dismissMutation.isPending}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-small font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <X className="h-3.5 w-3.5" />
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <details className="mt-2 rounded-sm border border-border bg-canvas-raised px-2 py-1 text-micro text-ink-muted">
                    <summary className="cursor-pointer font-medium text-ink-secondary">
                      Payload
                    </summary>
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-4">
                      {previewPayload(proposal.payload)}
                    </pre>
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
