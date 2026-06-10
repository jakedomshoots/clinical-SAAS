import { useAuth } from './auth';
import { demoRequest } from './demo-api';

const BASE = '/api';
export const DEMO_MODE_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_MODE === 'true';

function normalizePath(path: string) {
  return path.startsWith('/api/') ? path.slice(4) : path;
}

function canUseDemoApi(token?: string | null) {
  return DEMO_MODE_ENABLED && token === 'demo-dev-token';
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const normalizedPath = normalizePath(path);

  if (canUseDemoApi(token)) {
    const demo = await demoRequest<T>(method, normalizedPath, body);
    if (demo !== undefined) return demo;
  }

  try {
    const res = await fetch(`${BASE}${normalizedPath}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Request failed: ${res.status}`);
    }

    return res.json();
  } catch (error) {
    if (canUseDemoApi(token)) {
      const demo = await demoRequest<T>(method, normalizedPath, body);
      if (demo !== undefined) return demo;
    }
    throw error;
  }
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
