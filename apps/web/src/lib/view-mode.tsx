import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { getOnboardingState } from '@/lib/persistence';

export type ViewMode = 'simple' | 'standard' | 'power';
export type UserRole = 'admin' | 'manager' | 'front_desk' | 'provider' | 'billing';

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  effectiveRole: UserRole;
}

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

const STORAGE_KEY = 'concierge-os.view-mode';

function getStoredMode(): ViewMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'simple' || raw === 'standard' || raw === 'power') return raw;
  } catch { /* ignore */ }
  return 'standard';
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [viewMode, setViewModeState] = useState<ViewMode>(getStoredMode);

  const effectiveRole: UserRole = (user?.role as UserRole) || 'front_desk';

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* ignore */ }
  }, []);

  // If user role changes to front_desk/provider/billing, auto-downgrade from power mode
  useEffect(() => {
    if (viewMode === 'power' && !['admin', 'manager'].includes(effectiveRole)) {
      setViewMode('standard');
    }
  }, [effectiveRole, viewMode, setViewMode]);

  // For new users (onboarding not completed), default to simple mode
  useEffect(() => {
    const onboarding = getOnboardingState();
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!onboarding.completed && !stored) {
      setViewMode('simple');
    }
  }, [setViewMode]);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, effectiveRole }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextValue {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used within ViewModeProvider');
  return ctx;
}
