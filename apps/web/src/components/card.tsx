import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-canvas-raised border border-border rounded-md',
        hover && 'transition-shadow duration-200 hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
}
