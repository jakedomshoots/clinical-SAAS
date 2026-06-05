import type { UUID, Role } from './common';

export interface User {
  id: UUID;
  email: string;
  display_name: string;
  role: Role;
  organization_id: UUID;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
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
}
