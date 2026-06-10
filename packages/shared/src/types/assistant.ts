export type AssistantProposalType =
  | 'navigation.open_route'
  | 'clinical.create_follow_up_task'
  | 'clinical.draft_portal_reply'
  | 'clinical.stage_fax_match'
  | 'operations.review_blocker'
  | 'workspace.summarize_current_view';

export type AssistantProposalStatus = 'pending' | 'confirmed' | 'dismissed' | 'expired' | 'failed';
export type AssistantProposalSource = 'clicky' | 'concierge_command';
export type AssistantCommandInputMode = 'typed' | 'voice';

export interface AssistantRouteContext {
  path: string;
  label: string;
  entity_type: string | null;
  entity_id: string | null;
}

export interface AssistantWorkSummary {
  urgent_open_tasks: number;
  unread_threads: number;
  unmatched_inbound_faxes: number;
  today_appointments: number;
  readiness_blockers: number;
}

export interface AssistantContext {
  route: AssistantRouteContext;
  user: {
    id: string;
    role: string;
    display_name: string;
  };
  allowed_tools: string[];
  work_summary: AssistantWorkSummary;
  assistant_rules: string[];
}

export interface AssistantProposal {
  id: string;
  proposal_type: AssistantProposalType;
  title: string;
  summary: string;
  route_path: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  confidence_reason: string;
  source: AssistantProposalSource;
  input_mode: AssistantCommandInputMode | null;
  original_command: string | null;
  status: AssistantProposalStatus;
  created_at: string;
  created_by_user_id: string;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  expires_at: string | null;
}

export interface AssistantCommandRequest {
  command: string;
  input_mode: AssistantCommandInputMode;
  route_path: string;
  entity_type?: string | null;
  entity_id?: string | null;
}

export type AssistantCommandResultType = 'proposal' | 'answer' | 'clarification' | 'blocked';

export interface AssistantCommandResult {
  result_type: AssistantCommandResultType;
  message: string;
  proposal: AssistantProposal | null;
}
