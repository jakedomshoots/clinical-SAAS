import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Bot, Check, X } from 'lucide-react';
import type { AssistantProposal } from '@concierge-os/shared';
import { useToast } from '@/components/toast';
import { useApi } from '@/lib/api-client';
import {
  confirmAssistantProposal,
  dismissAssistantProposal,
  fetchAssistantProposals,
} from '@/lib/assistant-tools';
import { QUERY_KEYS } from '@/lib/query-keys';
import { humanizeWorkflowLabel } from '@/lib/ui-state';

interface InlineAssistantProposalsProps {
  title?: string;
  routePath?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export function InlineAssistantProposals({
  title = 'Command proposals',
  routePath,
  entityType,
  entityId,
  limit = 3,
}: InlineAssistantProposalsProps) {
  const api = useApi();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const queryKey = [
    ...QUERY_KEYS.ASSISTANT_PROPOSALS,
    'inline',
    routePath ?? 'all',
    entityType ?? 'all',
    entityId ?? 'all',
  ];
  const { data: proposals = [] } = useQuery({
    queryKey,
    queryFn: () =>
      fetchAssistantProposals(api, {
        route_path: routePath,
        entity_type: entityType,
        entity_id: entityId,
      }),
  });

  const proposalActionPath: Partial<Record<AssistantProposal['proposal_type'], string>> = {
    'clinical.create_follow_up_task': '/assistant/actions/follow-up-task',
    'clinical.draft_portal_reply': '/assistant/actions/portal-reply-draft',
    'clinical.stage_fax_match': '/assistant/actions/fax-match',
  };

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ASSISTANT_PROPOSALS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TASKS }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FAXES }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MESSAGES }),
    ]);
  };

  const confirmMutation = useMutation({
    mutationFn: async (proposal: AssistantProposal) => {
      const actionPath = proposalActionPath[proposal.proposal_type];
      if (actionPath) {
        await api.post(actionPath, proposal.payload);
      } else if (proposal.proposal_type === 'navigation.open_route') {
        await navigate({ to: proposal.route_path });
      }
      return confirmAssistantProposal(api, proposal.id);
    },
    onSuccess: async () => {
      toast.success('Proposal reviewed');
      await invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to review proposal');
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (proposalId: string) => dismissAssistantProposal(api, proposalId),
    onSuccess: async () => {
      toast.success('Proposal dismissed');
      await invalidate();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to dismiss proposal');
    },
  });

  const visible = proposals.slice(0, limit);
  if (visible.length === 0) return null;

  return (
    <section className="rounded-md border border-border bg-canvas-raised" aria-label={title}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {visible.map((proposal) => (
          <article key={proposal.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_auto]">
            <div>
              <div className="text-micro font-medium uppercase text-ink-faint">
                {humanizeWorkflowLabel(proposal.proposal_type)}
              </div>
              <h3 className="mt-1 text-sm font-semibold text-ink">{proposal.title}</h3>
              <p className="mt-1 text-small text-ink-secondary">{proposal.summary}</p>
              <p className="mt-1 text-micro text-ink-muted">{proposal.confidence_reason}</p>
            </div>
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => confirmMutation.mutate(proposal)}
                disabled={confirmMutation.isPending || dismissMutation.isPending}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-accent px-2.5 text-small font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" />
                Review
              </button>
              <button
                type="button"
                onClick={() => dismissMutation.mutate(proposal.id)}
                disabled={confirmMutation.isPending || dismissMutation.isPending}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-small font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
