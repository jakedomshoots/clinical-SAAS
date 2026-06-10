import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Crosshair,
  Inbox,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  MousePointer2,
  Navigation,
  Printer,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ROUTES,
  type AssistantCommandInputMode,
  type AssistantCommandResult,
  type AssistantProposal,
  type BillingWorkQueue,
  type Fax,
  type MessageThread,
  type Patient,
  type Task,
} from '@concierge-os/shared';
import { useToast } from '@/components/toast';
import { useApi } from '@/lib/api-client';
import {
  confirmAssistantProposal,
  dismissAssistantProposal,
  fetchAssistantProposals,
  submitAssistantCommand,
} from '@/lib/assistant-tools';
import type { ClickyTargetSnapshot, ClickyVisibleContext } from '@/lib/clicky-targeting';
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
  selectedTarget?: ClickyTargetSnapshot | null;
  visibleContext?: ClickyVisibleContext | null;
  onPickTarget?: () => void;
}

interface ClickyHistoryItem {
  id: string;
  command: string;
  inputMode: AssistantCommandInputMode;
  result: AssistantCommandResult;
}

interface ListResponse<T> {
  data: T[];
  total: number;
}

type ClickyTone = 'accent' | 'danger' | 'neutral' | 'success' | 'warn';

interface LiveMetric {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: ClickyTone;
}

interface FocusCard {
  eyebrow: string;
  title: string;
  detail: string;
  command: string;
  actionLabel: string;
  icon: LucideIcon;
  tone: ClickyTone;
}

interface ClickyActionCard {
  label: string;
  detail: string;
  command: string;
  evidence: string;
  icon: LucideIcon;
  tone: ClickyTone;
  disabled?: boolean;
}

interface CompletionReceipt {
  title: string;
  detail: string;
  tone: 'confirmed' | 'dismissed';
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

function toneClasses(tone: ClickyTone) {
  if (tone === 'danger') return 'border-danger/20 bg-danger/10 text-danger';
  if (tone === 'warn') return 'border-warn/20 bg-warn/10 text-warn';
  if (tone === 'success') return 'border-success/20 bg-success/10 text-success';
  if (tone === 'accent') return 'border-accent-soft bg-accent-soft text-accent';
  return 'border-border bg-canvas text-ink-secondary';
}

function actionHoverClasses(tone: ClickyTone) {
  if (tone === 'danger') return 'hover:border-danger/30 hover:bg-danger/10';
  if (tone === 'warn') return 'hover:border-warn/30 hover:bg-warn/10';
  if (tone === 'success') return 'hover:border-success/30 hover:bg-success/10';
  if (tone === 'accent') return 'hover:border-accent-soft hover:bg-accent-soft';
  return 'hover:bg-canvas-sunk';
}

function previewPayload(payload: Record<string, unknown>) {
  return JSON.stringify(payload, null, 2);
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function patientName(patient: Patient) {
  return `${patient.first_name} ${patient.last_name}`;
}

function isOpenTask(task: Task) {
  return task.status !== 'completed' && task.status !== 'cancelled';
}

function sortNewestProposal(a: AssistantProposal, b: AssistantProposal) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function ClickyCommandPanel({
  nativeCommandsEnabled,
  contextPath,
  contextLabel,
  className = '',
  compact = false,
  selectedTarget = null,
  visibleContext = null,
  onPickTarget,
}: ClickyCommandPanelProps) {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentPathname = useRouterState({ select: (state) => state.location.pathname });
  const activePath = contextPath ?? currentPathname;
  const activeLabel = contextLabel ?? routeLabelFor(activePath);
  const { entityType, entityId } = entityContextFor(activePath);
  const activePatientId = entityType === 'patient' ? entityId : null;
  const [commandText, setCommandText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [history, setHistory] = useState<ClickyHistoryItem[]>([]);
  const [completionReceipt, setCompletionReceipt] = useState<CompletionReceipt | null>(null);
  const speechRef = useRef<BrowserSpeechRecognition | null>(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const proposalsQuery = useQuery({
    queryKey: [...QUERY_KEYS.ASSISTANT_PROPOSALS, 'clicky-panel'],
    queryFn: () => fetchAssistantProposals(api),
  });

  const tasksQuery = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, 'clicky-context'],
    queryFn: () => api.get<ListResponse<Task>>(`${ROUTES.TASKS}?page=1&page_size=50`),
  });

  const faxesQuery = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, 'clicky-context'],
    queryFn: () => api.get<ListResponse<Fax>>(`${ROUTES.FAXES}?direction=inbound&page=1&page_size=50`),
  });

  const threadsQuery = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'clicky-context'],
    queryFn: () => api.get<ListResponse<MessageThread>>('/messages/threads'),
  });

  const billingQueueQuery = useQuery({
    queryKey: [...QUERY_KEYS.BILLING_WORK_QUEUE, 'clicky-context'],
    queryFn: () => api.get<BillingWorkQueue>(ROUTES.BILLING_WORK_QUEUE),
  });

  const patientQuery = useQuery({
    queryKey: activePatientId ? QUERY_KEYS.PATIENT(activePatientId) : ['clicky-patient', 'none'],
    queryFn: () => api.get<Patient>(ROUTES.PATIENT(activePatientId ?? '')),
    enabled: Boolean(activePatientId),
  });

  const invalidateAssistantData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSISTANT_PROPOSALS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAXES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MESSAGES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_WORK_QUEUE }),
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
      setCompletionReceipt(null);
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
    onSuccess: async (_proposal, variables) => {
      setCompletionReceipt({
        title: `${variables.title} confirmed`,
        detail:
          variables.proposal_type === 'navigation.open_route'
            ? `Clicky opened ${variables.route_path}.`
            : 'The action ran through ConciergeOS confirmation and the related work queues refreshed.',
        tone: 'confirmed',
      });
      toast.success('Clicky action confirmed');
      await invalidateAssistantData();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to confirm proposal');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (proposal: AssistantProposal) => dismissAssistantProposal(api, proposal.id),
    onSuccess: async (_proposal, variables) => {
      setCompletionReceipt({
        title: `${variables.title} dismissed`,
        detail: 'Clicky removed the staged action without changing clinic data.',
        tone: 'dismissed',
      });
      toast.success('Clicky proposal dismissed');
      await invalidateAssistantData();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to dismiss proposal');
    },
  });

  const tasks = useMemo(() => tasksQuery.data?.data ?? [], [tasksQuery.data?.data]);
  const inboundFaxes = useMemo(() => faxesQuery.data?.data ?? [], [faxesQuery.data?.data]);
  const threads = useMemo(() => threadsQuery.data?.data ?? [], [threadsQuery.data?.data]);
  const billingQueue = billingQueueQuery.data;
  const activePatient = patientQuery.data;
  const openTasks = tasks.filter(isOpenTask);
  const urgentTasks = openTasks.filter(
    (task) => task.priority === 'urgent' || task.priority === 'high'
  );
  const blockedTasks = openTasks.filter((task) => task.status === 'blocked');
  const unmatchedFaxes = inboundFaxes.filter((fax) => !fax.patient_id);
  const unreadMessages = threads.reduce((count, thread) => count + thread.unread_count, 0);
  const billingBlockers =
    (billingQueue?.missing_coding_count ?? 0) +
    (billingQueue?.eligibility_needed_count ?? 0) +
    (billingQueue?.denial_rework_count ?? 0) +
    (billingQueue?.remittance_pending_count ?? 0);

  const proposals = useMemo(
    () => [...(proposalsQuery.data ?? [])].sort(sortNewestProposal),
    [proposalsQuery.data]
  );
  const relevantProposals = proposals.filter(
    (proposal) =>
      proposal.route_path === activePath ||
      (entityId && proposal.entity_id === entityId) ||
      proposal.source === 'clicky'
  );
  const visibleProposals = relevantProposals.length > 0 ? relevantProposals : proposals;
  const stagedProposal = visibleProposals.find((proposal) => proposal.status === 'pending') ?? null;
  const latestProposalId = history.find((item) => item.result.proposal)?.result.proposal?.id;

  const liveMetrics = useMemo<LiveMetric[]>(
    () => [
      {
        label: 'Open work',
        value: String(openTasks.length),
        detail: `${urgentTasks.length} urgent or high`,
        icon: ClipboardList,
        tone: urgentTasks.length > 0 ? 'danger' : 'neutral',
      },
      {
        label: 'Unread portal',
        value: String(unreadMessages),
        detail: `${threads.length} active threads`,
        icon: MessageSquare,
        tone: unreadMessages > 0 ? 'accent' : 'neutral',
      },
      {
        label: 'Fax matching',
        value: String(unmatchedFaxes.length),
        detail: 'unmatched inbound',
        icon: Printer,
        tone: unmatchedFaxes.length > 0 ? 'warn' : 'success',
      },
      {
        label: 'Billing blocks',
        value: String(billingBlockers),
        detail: `${billingQueue?.ready_count ?? 0} ready to file`,
        icon: CreditCard,
        tone: billingBlockers > 0 ? 'warn' : 'success',
      },
    ],
    [
      billingBlockers,
      billingQueue?.ready_count,
      openTasks.length,
      threads.length,
      unmatchedFaxes.length,
      unreadMessages,
      urgentTasks.length,
    ]
  );

  const focusCard = useMemo<FocusCard>(() => {
    if (selectedTarget) {
      return {
        eyebrow: 'Point focus',
        title: selectedTarget.label,
        detail:
          selectedTarget.text ||
          `${selectedTarget.tagName} selected on ${selectedTarget.routePath}.`,
        command: `summarize this view around ${selectedTarget.label}`,
        actionLabel: 'Ask target',
        icon: MousePointer2,
        tone: 'accent',
      };
    }

    if (activePath.startsWith('/billing')) {
      return {
        eyebrow: 'Billing focus',
        title:
          billingBlockers > 0
            ? `${pluralize(billingBlockers, 'billing blocker')} need review`
            : 'Billing queue is quiet',
        detail:
          billingBlockers > 0
            ? `${billingQueue?.eligibility_needed_count ?? 0} eligibility, ${
                billingQueue?.denial_rework_count ?? 0
              } denial/rework, ${billingQueue?.remittance_pending_count ?? 0} remittance.`
            : `${billingQueue?.ready_count ?? 0} claim${billingQueue?.ready_count === 1 ? '' : 's'} ready to file.`,
        command: billingBlockers > 0 ? 'review billing blockers' : 'open billing queue',
        actionLabel: billingBlockers > 0 ? 'Stage review' : 'Open billing',
        icon: CreditCard,
        tone: billingBlockers > 0 ? 'warn' : 'success',
      };
    }

    if (activePath.startsWith('/patients/')) {
      return {
        eyebrow: 'Patient focus',
        title: activePatient ? `${patientName(activePatient)} is in context` : 'Patient chart loaded',
        detail:
          activePatient && urgentTasks.length > 0
            ? `${urgentTasks[0].title} is the highest priority related clinic task.`
            : 'Clicky can stage a follow-up task, draft a reply, or summarize this chart without writing automatically.',
        command: 'create follow up task to call tomorrow',
        actionLabel: 'Stage follow-up',
        icon: Users,
        tone: 'accent',
      };
    }

    if (activePath.startsWith('/faxes')) {
      return {
        eyebrow: 'Fax focus',
        title:
          unmatchedFaxes.length > 0
            ? `${pluralize(unmatchedFaxes.length, 'fax')} need matching`
            : 'Inbound faxes are matched',
        detail:
          unmatchedFaxes[0]?.ocr_text?.slice(0, 120) ??
          'Clicky can stage a fax match for staff confirmation when an inbound fax is unmatched.',
        command: 'stage fax match to the first patient',
        actionLabel: 'Stage fax match',
        icon: Printer,
        tone: unmatchedFaxes.length > 0 ? 'warn' : 'success',
      };
    }

    if (activePath.startsWith('/messaging')) {
      return {
        eyebrow: 'Message focus',
        title:
          unreadMessages > 0
            ? `${pluralize(unreadMessages, 'unread portal message')}`
            : 'No unread portal messages',
        detail:
          threads.find((thread) => thread.unread_count > 0)?.subject ??
          'Clicky can draft a patient reply but will keep it unsent until staff reviews it.',
        command: 'draft portal reply about the lab result',
        actionLabel: 'Draft reply',
        icon: MessageSquare,
        tone: unreadMessages > 0 ? 'accent' : 'neutral',
      };
    }

    if (urgentTasks.length > 0) {
      return {
        eyebrow: 'Clinic focus',
        title: urgentTasks[0].title,
        detail: urgentTasks[0].patient_name
          ? `${urgentTasks[0].patient_name} - ${urgentTasks[0].assigned_to_name ?? 'unassigned'}`
          : (urgentTasks[0].description ?? 'Urgent work needs an owner.'),
        command: 'open task queue',
        actionLabel: 'Open tasks',
        icon: AlertTriangle,
        tone: 'danger',
      };
    }

    return {
      eyebrow: 'Clinic focus',
      title: 'Front office is in a stable state',
      detail: 'Clicky is watching work queues and can stage actions when a blocker appears.',
      command: 'summarize this view',
      actionLabel: 'Summarize',
      icon: Activity,
      tone: 'success',
    };
  }, [
    activePatient,
    activePath,
    billingBlockers,
    billingQueue?.denial_rework_count,
    billingQueue?.eligibility_needed_count,
    billingQueue?.ready_count,
    billingQueue?.remittance_pending_count,
    threads,
    selectedTarget,
    unmatchedFaxes,
    unreadMessages,
    urgentTasks,
  ]);

  const clickyActions = useMemo<ClickyActionCard[]>(() => {
    const cards: ClickyActionCard[] = [];

    if (selectedTarget) {
      cards.push({
        label: 'Use pointed target',
        detail: 'Ask Clicky about the selected UI area.',
        command: `summarize this view around ${selectedTarget.label}`,
        evidence: selectedTarget.pointTag,
        icon: MousePointer2,
        tone: 'accent',
      });
    }

    if (visibleContext && !selectedTarget) {
      cards.push({
        label: 'Read current screen',
        detail: 'Use visible headings and actions as context.',
        command: 'summarize this screen',
        evidence: visibleContext.title,
        icon: Activity,
        tone: 'success',
      });
    }

    if (activePath.startsWith('/billing')) {
      cards.push(
        {
          label: 'Review claim blockers',
          detail: 'Stage a billing blocker review tied to this queue.',
          command: 'review billing blockers',
          evidence: `${billingBlockers} blocker${billingBlockers === 1 ? '' : 's'} detected`,
          icon: ShieldCheck,
          tone: billingBlockers > 0 ? 'warn' : 'neutral',
        },
        {
          label: 'Open billing queue',
          detail: 'Jump to the billing work surface.',
          command: 'open billing queue',
          evidence: `${billingQueue?.ready_count ?? 0} ready`,
          icon: Navigation,
          tone: 'accent',
        }
      );
    }

    if (activePath.startsWith('/patients/')) {
      cards.push(
        {
          label: 'Stage follow-up',
          detail: 'Create a high-priority task for staff review.',
          command: 'create follow up task to call tomorrow',
          evidence: activePatient ? patientName(activePatient) : 'patient chart',
          icon: ClipboardList,
          tone: 'accent',
        },
        {
          label: 'Draft patient reply',
          detail: 'Prepare portal language without sending it.',
          command: 'draft portal reply about the lab result',
          evidence: unreadMessages > 0 ? `${unreadMessages} unread` : 'review required',
          icon: MessageSquare,
          tone: 'neutral',
        }
      );
    }

    if (activePath.startsWith('/faxes') || unmatchedFaxes.length > 0) {
      cards.push({
        label: 'Stage fax match',
        detail: 'Match the newest inbound fax to a patient candidate.',
        command: 'stage fax match to the first patient',
        evidence: `${unmatchedFaxes.length} unmatched`,
        icon: Printer,
        tone: unmatchedFaxes.length > 0 ? 'warn' : 'neutral',
        disabled: unmatchedFaxes.length === 0,
      });
    }

    if (activePath.startsWith('/messaging') || unreadMessages > 0) {
      cards.push({
        label: 'Draft portal reply',
        detail: 'Prepare a response for the oldest unread thread.',
        command: 'draft portal reply about the lab result',
        evidence: `${unreadMessages} unread`,
        icon: MessageSquare,
        tone: unreadMessages > 0 ? 'accent' : 'neutral',
      });
    }

    if (activePath.startsWith('/tasks') || blockedTasks.length > 0 || urgentTasks.length > 0) {
      cards.push({
        label: 'Open priority queue',
        detail: 'Jump to urgent, blocked, or unassigned work.',
        command: 'open task queue',
        evidence: `${urgentTasks.length} urgent/high`,
        icon: Inbox,
        tone: urgentTasks.length > 0 ? 'danger' : 'neutral',
      });
    }

    cards.push({
      label: 'Summarize view',
      detail: 'Explain the current page and safe next move.',
      command: 'summarize this view',
      evidence: activeLabel,
      icon: Sparkles,
      tone: 'success',
    });

    const uniqueCards = cards.filter(
      (card, index, allCards) =>
        allCards.findIndex((candidate) => candidate.command === card.command) === index
    );
    return uniqueCards.slice(0, compact ? 4 : 6);
  }, [
    activeLabel,
    activePath,
    activePatient,
    billingBlockers,
    billingQueue?.ready_count,
    blockedTasks.length,
    compact,
    selectedTarget,
    unmatchedFaxes.length,
    unreadMessages,
    urgentTasks.length,
    visibleContext,
  ]);

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
      if (transcript.trim()) submitCommand('voice', transcript);
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

  const FocusIcon = focusCard.icon;
  const focusTone = toneClasses(focusCard.tone);

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
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-subhead font-semibold text-ink">Clicky</h2>
              <span className="inline-flex items-center gap-1 rounded-sm border border-success/20 bg-success/10 px-2 py-0.5 text-micro font-medium text-success">
                <Radio className="h-3 w-3" />
                Live
              </span>
            </div>
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
            {nativeCommandsEnabled ? 'Commands enabled' : 'Commands disabled'}
          </div>
        </div>
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${compact ? 'p-3' : 'p-4'}`}>
        {completionReceipt && (
          <section
            data-testid="clicky-completion-receipt"
            className={`mb-3 rounded-md border px-3 py-3 ${
              completionReceipt.tone === 'confirmed'
                ? 'border-success/20 bg-success/10'
                : 'border-border bg-canvas'
            }`}
          >
            <div className="flex items-start gap-2">
              <CheckCircle2
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  completionReceipt.tone === 'confirmed' ? 'text-success' : 'text-ink-muted'
                }`}
              />
              <div className="min-w-0">
                <div className="text-small font-semibold text-ink">{completionReceipt.title}</div>
                <div className="mt-1 text-small text-ink-secondary">{completionReceipt.detail}</div>
              </div>
            </div>
          </section>
        )}

        {(selectedTarget || visibleContext || onPickTarget) && (
          <section
            data-testid="clicky-screen-context"
            className="mb-3 rounded-md border border-border bg-canvas px-3 py-3"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-micro font-medium uppercase text-ink-faint">
                  <MousePointer2 className="h-3.5 w-3.5" />
                  Screen awareness
                </div>
                <div className="mt-1 text-small font-semibold text-ink">
                  {selectedTarget?.label ?? visibleContext?.title ?? activeLabel}
                </div>
                <div className="mt-1 line-clamp-2 text-small text-ink-secondary">
                  {selectedTarget?.text ?? visibleContext?.summary ?? activePath}
                </div>
                {selectedTarget && (
                  <div className="mt-2 font-mono text-[11px] leading-4 text-ink-muted">
                    {selectedTarget.pointTag}
                  </div>
                )}
              </div>
              {onPickTarget && (
                <button
                  type="button"
                  onClick={onPickTarget}
                  data-testid="clicky-pick-target"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-canvas-raised px-3 text-small font-semibold text-ink-secondary hover:bg-canvas-sunk"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                  Pick target
                </button>
              )}
            </div>
          </section>
        )}

        <section
          data-testid="clicky-live-focus"
          className={`rounded-md border px-3 py-3 ${focusTone}`}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-micro font-semibold uppercase">
                <FocusIcon className="h-3.5 w-3.5" />
                {focusCard.eyebrow}
              </div>
              <h3 className="mt-2 text-base font-semibold text-ink">{focusCard.title}</h3>
              <p className="mt-1 text-small text-ink-secondary">{focusCard.detail}</p>
            </div>
            <button
              type="button"
              data-testid="clicky-focus-action"
              onClick={() => submitCommand('typed', focusCard.command)}
              disabled={!nativeCommandsEnabled || commandMutation.isPending}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-accent px-3 text-small font-semibold text-accent-on hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {commandMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              {focusCard.actionLabel}
            </button>
          </div>
        </section>

        <section
          data-testid="clicky-live-metrics"
          className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}
        >
          {liveMetrics.map(({ label, value, detail, icon: Icon, tone }) => (
            <div key={label} className="rounded-md border border-border bg-canvas px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-micro font-medium uppercase text-ink-faint">{label}</span>
                <span className={`grid h-6 w-6 place-items-center rounded ${toneClasses(tone)}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-2 font-serif text-xl font-medium text-ink">{value}</div>
              <div className="text-micro text-ink-muted">{detail}</div>
            </div>
          ))}
        </section>

        <div className="mt-3 rounded-md border border-border bg-canvas p-3">
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

        <section className="mt-3" data-testid="clicky-action-stack">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-meta font-medium uppercase text-ink-faint">
              Suggested actions
            </div>
            <div className="text-micro text-ink-muted">Route-aware and confirmation-gated</div>
          </div>
          <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
            {clickyActions.map(({ label, command, detail, evidence, icon: Icon, tone, disabled }) => (
              <button
                key={command}
                type="button"
                data-testid={`clicky-action-${label.toLowerCase().replaceAll(' ', '-')}`}
                onClick={() => submitCommand('typed', command)}
                disabled={!nativeCommandsEnabled || disabled || commandMutation.isPending}
                className={`flex min-h-24 items-start gap-3 rounded-md border border-border bg-canvas px-3 py-3 text-left transition-colors ${actionHoverClasses(
                  tone
                )} disabled:cursor-not-allowed disabled:opacity-45`}
              >
                <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md ${toneClasses(tone)}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-small font-semibold text-ink">{label}</span>
                  <span className="mt-1 block text-small text-ink-secondary">{detail}</span>
                  <span className="mt-2 inline-flex rounded-sm border border-border bg-canvas-raised px-1.5 py-0.5 text-micro text-ink-muted">
                    {evidence}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        {stagedProposal && (
          <section
            data-testid="clicky-active-proposal"
            className="mt-4 rounded-md border border-accent bg-accent-soft/60 px-3 py-3"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-micro font-medium uppercase text-accent">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Staged action waiting for you
                </div>
                <h3 className="mt-2 text-base font-semibold text-ink">{stagedProposal.title}</h3>
                <p className="mt-1 text-small text-ink-secondary">{stagedProposal.summary}</p>
                <p className="mt-1 text-micro text-ink-muted">
                  {stagedProposal.confidence_reason}
                </p>
              </div>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  data-testid={`clicky-confirm-active-${stagedProposal.id}`}
                  onClick={() => confirmMutation.mutate(stagedProposal)}
                  disabled={confirmMutation.isPending || dismissMutation.isPending}
                  className="inline-flex h-9 items-center gap-1 rounded-md bg-accent px-3 text-small font-semibold text-accent-on disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {confirmMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Confirm
                </button>
                <button
                  type="button"
                  data-testid={`clicky-dismiss-active-${stagedProposal.id}`}
                  onClick={() => dismissMutation.mutate(stagedProposal)}
                  disabled={confirmMutation.isPending || dismissMutation.isPending}
                  className="inline-flex h-9 items-center gap-1 rounded-md border border-border bg-canvas px-3 text-small font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </button>
              </div>
            </div>
          </section>
        )}

        {history.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-meta font-medium uppercase text-ink-faint">
              Command timeline
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
              Proposal queue
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
          ) : visibleProposals.length === 0 ? (
            <div className="rounded-md border border-border bg-canvas px-3 py-4 text-small text-ink-muted">
              No staged proposals. Run a suggested action to stage one for review.
            </div>
          ) : (
            <div className="space-y-2">
              {visibleProposals.slice(0, compact ? 3 : 6).map((proposal) => (
                <article
                  key={proposal.id}
                  data-testid={`clicky-proposal-${proposal.id}`}
                  className={`rounded-md border bg-canvas px-3 py-3 ${
                    latestProposalId === proposal.id || stagedProposal?.id === proposal.id
                      ? 'border-accent'
                      : 'border-border'
                  }`}
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-micro font-medium uppercase text-ink-faint">
                          {humanizeWorkflowLabel(proposal.proposal_type)}
                        </span>
                        <span className={`rounded-sm border px-1.5 py-0.5 text-micro ${toneClasses(
                          proposal.status === 'pending'
                            ? 'warn'
                            : proposal.status === 'confirmed'
                              ? 'success'
                              : 'neutral'
                        )}`}
                        >
                          {proposal.status}
                        </span>
                      </div>
                      <h3 className="mt-1 text-small font-semibold text-ink">
                        {proposal.title}
                      </h3>
                      <p className="mt-1 text-small text-ink-secondary">{proposal.summary}</p>
                      <p className="mt-1 text-micro text-ink-muted">
                        {proposal.confidence_reason}
                      </p>
                    </div>
                    {proposal.status === 'pending' && (
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
                          onClick={() => dismissMutation.mutate(proposal)}
                          disabled={confirmMutation.isPending || dismissMutation.isPending}
                          className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-small font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <X className="h-3.5 w-3.5" />
                          Dismiss
                        </button>
                      </div>
                    )}
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
