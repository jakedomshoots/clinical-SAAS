import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: LucideIcon;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon: Icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 active:scale-[0.98] active:transition-transform active:duration-75 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

  const variants = {
    primary:
      "bg-accent text-accent-on hover:bg-accent-hover",
    secondary:
      "border border-border bg-canvas-raised text-ink-secondary hover:border-border-strong hover:bg-canvas-sunk",
    ghost:
      "text-ink-muted hover:text-ink hover:bg-canvas-sunk",
    danger:
      "bg-danger text-white hover:brightness-90",
  };

  const sizes = {
    sm: "text-small rounded-sm px-2 py-1",
    md: "text-sm rounded-md px-4 py-2",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-4 w-4",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {Icon && <Icon className={iconSizes[size]} />}
      {children}
    </button>
  );
}
