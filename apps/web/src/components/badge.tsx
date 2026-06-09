import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface BadgeProps {
  intent?: "success" | "warn" | "danger" | "muted";
  children: ReactNode;
  className?: string;
}

export function Badge({
  intent = "muted",
  children,
  className,
}: BadgeProps) {
  const intents = {
    success: "bg-success/10 text-success",
    warn: "bg-warn/10 text-warn",
    danger: "bg-danger/10 text-danger",
    muted: "bg-canvas-sunk text-ink-muted",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-0.5 text-micro font-medium",
        intents[intent],
        className
      )}
    >
      {children}
    </span>
  );
}
