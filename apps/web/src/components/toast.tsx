import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastIntent = 'success' | 'error' | 'warn' | 'info';

export interface Toast {
  id: string;
  message: string;
  intent: ToastIntent;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, intent?: ToastIntent, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, intent: ToastIntent = 'info', duration = 4000) => {
      const id = String(++toastIdCounter);
      setToasts((current) => [...current, { id, message, intent, duration }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  const success = useCallback((message: string) => toast(message, 'success'), [toast]);
  const error = useCallback((message: string) => toast(message, 'error', 6000), [toast]);
  const warn = useCallback((message: string) => toast(message, 'warn', 5000), [toast]);
  const info = useCallback((message: string) => toast(message, 'info'), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warn, info }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const INTENT_CONFIG = {
  success: {
    icon: CheckCircle2,
    classes: 'border-l-4 border-l-success bg-canvas-raised text-ink shadow-card',
    iconClass: 'text-success',
  },
  error: {
    icon: XCircle,
    classes: 'border-l-4 border-l-danger bg-canvas-raised text-ink shadow-card',
    iconClass: 'text-danger',
  },
  warn: {
    icon: AlertTriangle,
    classes: 'border-l-4 border-l-warn bg-canvas-raised text-ink shadow-card',
    iconClass: 'text-warn',
  },
  info: {
    icon: Info,
    classes: 'border-l-4 border-l-accent bg-canvas-raised text-ink shadow-card',
    iconClass: 'text-accent',
  },
} as const;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const { icon: Icon, classes, iconClass } = INTENT_CONFIG[toast.intent];

  useEffect(() => {
    // Trigger enter animation
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-md border border-border p-3.5 transition-all duration-300 ${classes} ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
      <span className="min-w-0 flex-1 text-small leading-5">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint hover:text-ink transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[9999] flex w-80 max-w-[calc(100vw-2.5rem)] flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
