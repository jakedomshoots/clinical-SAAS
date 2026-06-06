import type { UUID, Role } from './common';

export interface User {
  id: UUID;
  email: string;
  display_name: string;
  role: Role;
  organization_id: UUID;
  is_active: boolean;
  mfa_enabled: boolean;
  password_must_change: boolean;
  temporary_password_expires_at: string | null;
  last_login_at: string | null;
  access_reviewed_at: string | null;
  access_reviewed_by_id?: UUID | null;
  access_review_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PasswordRotationCompleteRequest {
  email: string;
  current_password: string;
  new_password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
  role: Role;
  organization_id?: UUID;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface UserListResponse {
  data: User[];
  total: number;
}

export interface UserUpdate {
  display_name?: string;
  role?: Role;
  is_active?: boolean;
  mfa_enabled?: boolean;
}

export interface UserAccessReviewItem {
  user: User;
  review_status: 'current' | 'needs_review';
  findings: string[];
  recommended_action: string;
}

export interface UserAccessReviewSummary {
  data: UserAccessReviewItem[];
  total: number;
  due_count: number;
  privileged_without_mfa_count: number;
  inactive_count: number;
  review_window_days: number;
}

export interface UserAccessReviewUpdate {
  note?: string | null;
  mfa_enabled?: boolean;
}

export interface UserPasswordResetResponse {
  user: User;
  temporary_password: string;
  temporary_password_expires_at: string;
}

export interface UserRecoveryItem {
  user_id: UUID;
  email: string;
  display_name: string;
  role: Role;
  status: 'temporary_active' | 'temporary_expired';
  temporary_password_expires_at: string | null;
  last_login_at: string | null;
}

export interface UserRecoverySummary {
  data: UserRecoveryItem[];
  total: number;
  temporary_password_count: number;
  expired_temporary_password_count: number;
}

export interface RoleAccessMatrixRole {
  role: Role;
  label: string;
  active_users: number;
  can_view_patients: boolean;
  can_manage_clinical: boolean;
  can_manage_front_office: boolean;
  can_manage_staff: boolean;
  can_manage_operations: boolean;
  can_manage_integrations: boolean;
  can_export_audit: boolean;
  mfa_required: boolean;
  access_review_required: boolean;
  summary: string;
}

export interface RoleAccessMatrixWarning {
  key: string;
  label: string;
  severity: 'critical' | 'warning';
  role: Role | null;
  detail: string;
}

export interface RoleAccessMatrix {
  generated_at: string;
  total_roles: number;
  summary: Record<string, number>;
  roles: RoleAccessMatrixRole[];
  warnings: RoleAccessMatrixWarning[];
}
