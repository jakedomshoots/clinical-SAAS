import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Fax, MessageThread, Patient, Task } from '@concierge-os/shared';
import { useApi } from '@/lib/api-client';
import { useAuth } from '@/lib/auth';
import { QUERY_KEYS } from '@/lib/query-keys';

interface ListResponse<T> {
  data: T[];
  total: number;
}

export interface AssistantAction {
  toolId: AssistantToolId;
  title: string;
  detail: string;
  confirmLabel: string;
  run: () => void;
  pending: boolean;
}

export interface AssistantSuggestion {
  label: string;
  detail: string;
  tone: 'red' | 'amber' | 'green' | 'neutral';
  actionLabel: string;
  action: AssistantAction;
  pending: boolean;
}

export const ASSISTANT_TOOL_IDS = {
  CREATE_FOLLOW_UP_TASK: 'clinical.create_follow_up_task',
  DRAFT_PORTAL_REPLY: 'clinical.draft_portal_reply',
  STAGE_FAX_MATCH: 'clinical.stage_fax_match',
} as const;

export type AssistantToolId = (typeof ASSISTANT_TOOL_IDS)[keyof typeof ASSISTANT_TOOL_IDS];

export const ASSISTANT_TOOL_DEFINITIONS: Record<
  AssistantToolId,
  {
    name: string;
    description: string;
    requiresConfirmation: boolean;
  }
> = {
  [ASSISTANT_TOOL_IDS.CREATE_FOLLOW_UP_TASK]: {
    name: 'Create follow-up task',
    description: 'Creates a staff task from the current clinical context.',
    requiresConfirmation: true,
  },
  [ASSISTANT_TOOL_IDS.DRAFT_PORTAL_REPLY]: {
    name: 'Draft portal reply',
    description: 'Drafts a portal message without sending it.',
    requiresConfirmation: true,
  },
  [ASSISTANT_TOOL_IDS.STAGE_FAX_MATCH]: {
    name: 'Stage fax match',
    description: 'Stages an inbound fax match for staff review.',
    requiresConfirmation: true,
  },
};

export interface CopilotActionDescriptor {
  name: AssistantToolId;
  description: string;
  available: 'always';
  confirmationRequired: boolean;
  parameters: Array<{
    name: string;
    type: 'string';
    required: boolean;
    description: string;
  }>;
}

export function getAssistantCopilotActionDescriptors(): CopilotActionDescriptor[] {
  return Object.entries(ASSISTANT_TOOL_DEFINITIONS).map(([toolId, definition]) => ({
    name: toolId as AssistantToolId,
    description: definition.description,
    available: 'always',
    confirmationRequired: definition.requiresConfirmation,
    parameters: [
      {
        name: 'context',
        type: 'string',
        required: true,
        description: 'Human-readable clinical route or queue context used to stage the action.',
      },
    ],
  }));
}

function routeLabelFor(pathname: string) {
  if (pathname.startsWith('/patients/')) return 'Patient chart';
  if (pathname.startsWith('/patients')) return 'Patient search';
  if (pathname.startsWith('/tasks')) return 'Task queue';
  if (pathname.startsWith('/scheduling')) return 'Schedule';
  if (pathname.startsWith('/faxes')) return 'Fax center';
  if (pathname.startsWith('/messaging')) return 'Messages';
  if (pathname.startsWith('/portal-intake')) return 'Portal intake';
  if (pathname.startsWith('/portal-mock')) return 'Portal simulator';
  if (pathname.startsWith('/billing')) return 'Billing cases';
  if (pathname.startsWith('/integrations')) return 'Integration setup';
  if (pathname.startsWith('/setup')) return 'Setup checklist';
  if (pathname.startsWith('/assistant-review')) return 'AI review';
  return 'Command center';
}

function routeAssistantHelp(pathname: string) {
  if (pathname.startsWith('/patients'))
    return 'I can help stage outreach, create follow-up tasks, or summarize chart blockers before staff acts.';
  if (pathname.startsWith('/tasks'))
    return 'I can help prioritize urgent work, draft patient updates, and keep every task owner-visible.';
  if (pathname.startsWith('/scheduling'))
    return 'I can help spot same-day schedule gaps, reminders, and checkout blockers.';
  if (pathname.startsWith('/faxes'))
    return 'I can help stage fax matches and flag documents that need human confirmation.';
  if (pathname.startsWith('/messaging'))
    return 'I can draft replies for staff review, but I will not send without confirmation.';
  if (pathname.startsWith('/billing'))
    return 'I can flag missing charge details and keep billing actions tied to signed clinical work.';
  if (pathname.startsWith('/integrations') || pathname.startsWith('/setup'))
    return 'I can point to the next setup blocker and keep launch readiness explicit.';
  if (pathname.startsWith('/assistant-review'))
    return 'I can help review staged AI actions, confirmations, and audit trails.';
  return 'I can help identify the next best clinic action while keeping risky changes confirmation-gated.';
}

function patientName(patient: Patient) {
  return `${patient.first_name} ${patient.last_name}`;
}

export function useClinicalAssistantTools({
  pathname,
  onCompleted,
}: {
  pathname: string;
  onCompleted: (message: string) => void;
}) {
  const api = useApi();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const patientId = pathname.match(/^\/patients\/([^/]+)/)?.[1];
  const routeLabel = routeLabelFor(pathname);

  const { data: tasks } = useQuery({
    queryKey: [...QUERY_KEYS.TASKS, 'clinical-assistant'],
    queryFn: () => api.get<ListResponse<Task>>('/tasks?page=1&page_size=20'),
  });
  const { data: faxes } = useQuery({
    queryKey: [...QUERY_KEYS.FAXES, 'clinical-assistant'],
    queryFn: () => api.get<ListResponse<Fax>>('/faxes?direction=inbound&page=1&page_size=20'),
  });
  const { data: threads } = useQuery({
    queryKey: [...QUERY_KEYS.MESSAGES, 'clinical-assistant'],
    queryFn: () => api.get<ListResponse<MessageThread>>('/messages/threads'),
  });
  const { data: patient } = useQuery({
    queryKey: patientId ? QUERY_KEYS.PATIENT(patientId) : ['clinical-assistant', 'no-patient'],
    queryFn: () => api.get<Patient>(`/patients/${patientId}`),
    enabled: Boolean(patientId),
  });

  const urgentTask = tasks?.data.find(
    (task) => task.status !== 'completed' && task.priority === 'urgent'
  );
  const unmatchedFax = faxes?.data.find((fax) => !fax.patient_id);
  const unreadThread = threads?.data.find((thread) => thread.unread_count > 0);
  const activeTask = tasks?.data.find((task) => task.status === 'in_progress');

  const invalidateAssistantData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAXES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MESSAGES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUDIT }),
    ]);
  };

  const createFollowUpTask = useMutation({
    mutationFn: () =>
      api.post<Task>('/assistant/actions/follow-up-task', {
        context: routeLabel,
        title: patient
          ? `Review chart and follow up with ${patientName(patient)}`
          : 'Review assistant flagged follow-up',
        priority: patient ? 'high' : 'normal',
        due_date: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        patient_id: patient?.id ?? urgentTask?.patient_id ?? null,
      }),
    onSuccess: async () => {
      onCompleted('Follow-up task created');
      await invalidateAssistantData();
    },
  });

  const draftPortalReply = useMutation({
    mutationFn: () =>
      api.post('/assistant/actions/portal-reply-draft', {
        context: routeLabel,
        recipient_id:
          unreadThread?.participants.find((participant) => participant.name !== 'Clinic Admin')
            ?.id ??
          user?.id ??
          'patient',
        subject:
          unreadThread?.subject ?? `Follow-up for ${patient ? patientName(patient) : 'your visit'}`,
        body: patient
          ? `Hi ${patient.first_name}, your care team is reviewing your chart and will follow up with next steps.`
          : 'Hi, your care team is reviewing this and will follow up with next steps.',
        thread_id: unreadThread?.id,
      }),
    onSuccess: async () => {
      onCompleted('Portal reply drafted');
      await invalidateAssistantData();
    },
  });

  const matchFaxToPatient = useMutation({
    mutationFn: () =>
      api.post<Fax>('/assistant/actions/fax-match', {
        context: routeLabel,
        fax_id: unmatchedFax?.id,
        patient_id: patient?.id ?? urgentTask?.patient_id ?? '00000000-0000-4000-8000-000000000101',
      }),
    onSuccess: async () => {
      onCompleted('Fax match staged');
      await invalidateAssistantData();
    },
  });

  const suggestions = useMemo(
    () =>
      [
        urgentTask && {
          label: 'Urgent callback',
          detail: urgentTask.title,
          tone: 'red',
          actionLabel: 'Create follow-up',
          action: {
            toolId: ASSISTANT_TOOL_IDS.CREATE_FOLLOW_UP_TASK,
            title: 'Create follow-up task',
            detail: patient
              ? `This will create a high-priority task tied to ${patientName(patient)}.`
              : `This will create a follow-up task tied to ${urgentTask.patient_name ?? 'the urgent queue item'}.`,
            confirmLabel: 'Create task',
            run: () => createFollowUpTask.mutate(),
            pending: createFollowUpTask.isPending,
          },
          pending: createFollowUpTask.isPending,
        },
        unmatchedFax && {
          label: 'Possible fax match',
          detail: patient
            ? `Match ${unmatchedFax.pages} page${unmatchedFax.pages === 1 ? '' : 's'} to ${patientName(patient)}`
            : `${unmatchedFax.pages} page${unmatchedFax.pages === 1 ? '' : 's'} need patient matching`,
          tone: 'amber',
          actionLabel: 'Stage match',
          action: {
            toolId: ASSISTANT_TOOL_IDS.STAGE_FAX_MATCH,
            title: 'Stage fax match',
            detail: patient
              ? `This will attach the unmatched inbound fax to ${patientName(patient)}.`
              : 'This will stage the inbound fax against the assistant suggested patient for staff review.',
            confirmLabel: 'Stage match',
            run: () => matchFaxToPatient.mutate(),
            pending: matchFaxToPatient.isPending,
          },
          pending: matchFaxToPatient.isPending,
        },
        activeTask && {
          label: 'Work in motion',
          detail: activeTask.title,
          tone: 'green',
          actionLabel: 'Draft update',
          action: {
            toolId: ASSISTANT_TOOL_IDS.DRAFT_PORTAL_REPLY,
            title: 'Draft portal update',
            detail: 'This will draft a portal message but will not send it.',
            confirmLabel: 'Draft update',
            run: () => draftPortalReply.mutate(),
            pending: draftPortalReply.isPending,
          },
          pending: draftPortalReply.isPending,
        },
        unreadThread && {
          label: 'Portal reply',
          detail: unreadThread.subject,
          tone: 'neutral',
          actionLabel: 'Draft reply',
          action: {
            toolId: ASSISTANT_TOOL_IDS.DRAFT_PORTAL_REPLY,
            title: 'Draft portal reply',
            detail: `This will draft a reply in the "${unreadThread.subject}" thread but will not send it.`,
            confirmLabel: 'Draft reply',
            run: () => draftPortalReply.mutate(),
            pending: draftPortalReply.isPending,
          },
          pending: draftPortalReply.isPending,
        },
      ].filter(Boolean) as AssistantSuggestion[],
    [
      activeTask,
      createFollowUpTask,
      draftPortalReply,
      matchFaxToPatient,
      patient,
      unreadThread,
      unmatchedFax,
      urgentTask,
    ]
  );

  const contextChips = [
    routeLabel,
    patient && patientName(patient),
    urgentTask && 'urgent task',
    unmatchedFax && 'unmatched fax',
    unreadThread && 'unread portal',
  ].filter(Boolean) as string[];

  const fallbackSuggestion: AssistantSuggestion = {
    label: 'All clear',
    detail: routeAssistantHelp(pathname),
    tone: 'green',
    actionLabel: 'Create follow-up',
    action: {
      toolId: ASSISTANT_TOOL_IDS.CREATE_FOLLOW_UP_TASK,
      title: 'Create follow-up task',
      detail: `This will create a general follow-up task from the ${routeLabel.toLowerCase()}.`,
      confirmLabel: 'Create task',
      run: () => createFollowUpTask.mutate(),
      pending: createFollowUpTask.isPending,
    },
    pending: createFollowUpTask.isPending,
  };

  return {
    contextChips,
    suggestions: suggestions.length > 0 ? suggestions : [fallbackSuggestion],
  };
}
