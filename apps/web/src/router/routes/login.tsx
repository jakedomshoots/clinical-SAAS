import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { DEMO_MODE_ENABLED, createApiClient } from '@/lib/api-client';
import { ROUTES } from '@concierge-os/shared';
import type { TokenResponse } from '@concierge-os/shared';
import { Activity, Loader2 } from 'lucide-react';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState(DEMO_MODE_ENABLED ? 'admin@clinic.example.com' : '');
  const [password, setPassword] = useState(DEMO_MODE_ENABLED ? 'admin123!' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function loginDemo() {
    if (!DEMO_MODE_ENABLED) return;
    login('demo-dev-token', {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'admin@clinic.example.com',
      display_name: 'Clinic Admin',
      role: 'admin',
      organization_id: 'default',
      is_active: true,
      mfa_enabled: false,
      last_login_at: new Date().toISOString(),
      access_reviewed_at: null,
      access_reviewed_by_id: null,
      access_review_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    router.navigate({ to: '/' });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const api = createApiClient(null);
      const res = await api.post<TokenResponse>(ROUTES.AUTH.LOGIN, { email, password });
      login(res.access_token, res.user);
      router.navigate({ to: '/' });
    } catch (err) {
      if (DEMO_MODE_ENABLED && email === 'admin@clinic.example.com' && password === 'admin123!') {
        loginDemo();
        return;
      }
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-clinic-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Activity className="mx-auto mb-3 h-10 w-10 text-accent-600" />
          <h1 className="text-xl font-semibold text-clinic-800">ConciergeOS</h1>
          <p className="mt-1 text-sm text-clinic-500">Sign in to your clinic</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-clinic-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-clinic-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-900 placeholder:text-clinic-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              placeholder="admin@clinic.local"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-clinic-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-clinic-300 px-3 py-2 text-sm text-clinic-900 placeholder:text-clinic-400 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>

          {DEMO_MODE_ENABLED && (
            <button
              type="button"
              onClick={loginDemo}
              className="mt-3 flex w-full items-center justify-center rounded-md border border-clinic-300 px-4 py-2 text-sm font-medium text-clinic-700 transition-colors hover:bg-clinic-50"
            >
              Continue in demo mode
            </button>
          )}
          <Link to="/patient-portal" className="mt-3 flex w-full items-center justify-center rounded-md border border-clinic-200 bg-clinic-50 px-4 py-2 text-sm font-medium text-clinic-700 transition-colors hover:bg-white">
            Open patient portal
          </Link>
        </form>
      </div>
    </div>
  );
}
