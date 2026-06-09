import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { DEMO_MODE_ENABLED, createApiClient } from '@/lib/api-client';
import { ROUTES } from '@concierge-os/shared';
import type { PasswordRotationCompleteRequest, TokenResponse } from '@concierge-os/shared';
import { Loader2 } from 'lucide-react';

export const Route = createFileRoute('/login')({
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState(DEMO_MODE_ENABLED ? 'admin@clinic.example.com' : '');
  const [password, setPassword] = useState(DEMO_MODE_ENABLED ? 'admin123!' : '');
  const [newPassword, setNewPassword] = useState('');
  const [showRotation, setShowRotation] = useState(false);
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
      password_must_change: false,
      temporary_password_expires_at: null,
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
      const message = err instanceof Error ? err.message : 'Login failed';
      setShowRotation(message === 'Password change required before login');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordRotation(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const api = createApiClient(null);
      const payload: PasswordRotationCompleteRequest = {
        email,
        current_password: password,
        new_password: newPassword,
      };
      const res = await api.post<TokenResponse>(ROUTES.AUTH.COMPLETE_PASSWORD_ROTATION, payload);
      login(res.access_token, res.user);
      router.navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password change failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="font-serif text-2xl font-medium text-ink">ConciergeOS</div>
          <h1 className="font-serif text-headline text-ink text-center mt-2">Sign in</h1>
          <p className="text-small text-ink-muted text-center mt-1">Sign in to your clinic</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-canvas-raised border border-border rounded-lg shadow-md p-8 max-w-sm mx-auto">
          {error && (
            <div className="mb-4 rounded-md border border-danger/20 bg-danger/10 px-3 py-2 text-small text-danger">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-small font-medium text-ink-secondary">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
              placeholder="admin@clinic.local"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1 block text-small font-medium text-ink-secondary">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>

          {DEMO_MODE_ENABLED && (
            <button
              type="button"
              onClick={loginDemo}
              className="mt-3 flex w-full items-center justify-center rounded-md border border-border bg-canvas-raised px-4 py-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-canvas-sunk"
            >
              Continue in demo mode
            </button>
          )}
          <Link to="/patient-portal" className="mt-3 flex w-full items-center justify-center rounded-md text-ink-muted hover:text-ink px-4 py-2 text-sm font-medium transition-colors hover:bg-canvas-sunk">
            Open patient portal
          </Link>
        </form>
        {showRotation && (
          <form onSubmit={handlePasswordRotation} className="mt-4 bg-canvas-raised border border-border rounded-lg shadow-md p-8 max-w-sm mx-auto">
            <h2 className="font-serif text-headline text-ink text-center">Set a permanent password</h2>
            <p className="text-small text-ink-muted text-center mt-1">Temporary passwords must be changed before a clinic session starts.</p>
            <div className="mt-4">
              <label htmlFor="new-password" className="mb-1 block text-small font-medium text-ink-secondary">New password</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={12}
                className="w-full bg-canvas border border-border rounded-sm px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent-soft"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !newPassword}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Change password and sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
