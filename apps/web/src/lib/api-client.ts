import { useAuth } from './auth';

const BASE = '/api';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function createApiClient(token: string | null) {
  return {
    get: <T>(path: string) => request<T>('GET', path, undefined, token),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body, token),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body, token),
    delete: <T>(path: string) => request<T>('DELETE', path, undefined, token),
  };
}

export function useApi() {
  const { token } = useAuth();
  return createApiClient(token);
}
