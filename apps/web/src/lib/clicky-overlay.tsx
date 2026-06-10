import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const CLICKY_COMMANDS_STORAGE_KEY = 'native-ai-commands-enabled';
const CLICKY_OVERLAY_ENABLED_STORAGE_KEY = 'clicky-overlay-enabled';
const CLICKY_OVERLAY_OPEN_STORAGE_KEY = 'clicky-overlay-open';
const CLICKY_OVERLAY_MODE_STORAGE_KEY = 'clicky-overlay-mode';

export type ClickyOverlayMode = 'dock' | 'spotlight';

interface ClickyAddOnState {
  nativeCommandsEnabled: boolean;
  overlayEnabled: boolean;
  overlayOpen: boolean;
  overlayMode: ClickyOverlayMode;
  toggleNativeCommands: () => void;
  openClickyMode: (mode?: ClickyOverlayMode) => void;
  setOverlayEnabled: (enabled: boolean) => void;
  setOverlayOpen: (open: boolean) => void;
  setOverlayMode: (mode: ClickyOverlayMode) => void;
}

const ClickyAddOnContext = createContext<ClickyAddOnState | null>(null);

function readBooleanPreference(key: string, defaultValue: boolean) {
  if (typeof window === 'undefined') return defaultValue;
  const stored = window.localStorage.getItem(key);
  if (stored === null) return defaultValue;
  return stored !== 'false';
}

function readOverlayModePreference() {
  if (typeof window === 'undefined') return 'dock';
  const stored = window.localStorage.getItem(CLICKY_OVERLAY_MODE_STORAGE_KEY);
  return stored === 'spotlight' ? 'spotlight' : 'dock';
}

export function ClickyAddOnProvider({ children }: { children: ReactNode }) {
  const [nativeCommandsEnabled, setNativeCommandsEnabled] = useState(() =>
    readBooleanPreference(CLICKY_COMMANDS_STORAGE_KEY, true)
  );
  const [overlayEnabled, setOverlayEnabledState] = useState(() =>
    readBooleanPreference(CLICKY_OVERLAY_ENABLED_STORAGE_KEY, false)
  );
  const [overlayOpen, setOverlayOpenState] = useState(() =>
    readBooleanPreference(CLICKY_OVERLAY_OPEN_STORAGE_KEY, true)
  );
  const [overlayMode, setOverlayMode] = useState<ClickyOverlayMode>(readOverlayModePreference);

  useEffect(() => {
    window.localStorage.setItem(
      CLICKY_COMMANDS_STORAGE_KEY,
      nativeCommandsEnabled ? 'true' : 'false'
    );
  }, [nativeCommandsEnabled]);

  useEffect(() => {
    window.localStorage.setItem(
      CLICKY_OVERLAY_ENABLED_STORAGE_KEY,
      overlayEnabled ? 'true' : 'false'
    );
  }, [overlayEnabled]);

  useEffect(() => {
    window.localStorage.setItem(CLICKY_OVERLAY_OPEN_STORAGE_KEY, overlayOpen ? 'true' : 'false');
  }, [overlayOpen]);

  useEffect(() => {
    window.localStorage.setItem(CLICKY_OVERLAY_MODE_STORAGE_KEY, overlayMode);
  }, [overlayMode]);

  const value = useMemo<ClickyAddOnState>(
    () => ({
      nativeCommandsEnabled,
      overlayEnabled,
      overlayOpen,
      overlayMode,
      toggleNativeCommands: () => setNativeCommandsEnabled((current) => !current),
      openClickyMode: (mode = 'spotlight') => {
        setOverlayMode(mode);
        setOverlayEnabledState(true);
        setOverlayOpenState(true);
      },
      setOverlayEnabled: (enabled) => {
        setOverlayEnabledState(enabled);
        if (enabled) setOverlayOpenState(true);
      },
      setOverlayOpen: setOverlayOpenState,
      setOverlayMode,
    }),
    [nativeCommandsEnabled, overlayEnabled, overlayMode, overlayOpen]
  );

  return <ClickyAddOnContext.Provider value={value}>{children}</ClickyAddOnContext.Provider>;
}

export function useClickyAddOn() {
  const context = useContext(ClickyAddOnContext);
  if (!context) throw new Error('useClickyAddOn must be used inside ClickyAddOnProvider');
  return context;
}
