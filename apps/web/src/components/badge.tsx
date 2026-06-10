import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface BadgeProps {
  intent?: 'success' | 'warn' | 'danger' | 'muted';
  children: ReactNode;
  className?: string;
  rounded?: 'pill' | 'md';
}

export function Badge({ intent = 'muted', children, className, rounded = 'pill' }: BadgeProps) {
  const intents = {
    success: 'bg-success/10 text-success',
    warn: 'bg-warn/10 text-warn-text',
    danger: 'bg-danger/10 text-danger',
    muted: 'bg-canvas-sunk text-ink-muted',
  };

  const roundeds = {
    pill: 'rounded-pill',
    md: 'rounded-md',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 text-small font-medium',
        roundeds[rounded],
        intents[intent],
        className
      )}
    >
      {children}
    </span>
  );
}
