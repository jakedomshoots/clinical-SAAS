import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "standard" | "search";
}

export function Input({
  variant = "standard",
  className,
  disabled,
  ...props
}: InputProps) {
  const base =
    "w-full text-sm text-ink placeholder:text-ink-faint outline-none transition-colors duration-150 disabled:bg-canvas-sunk disabled:opacity-60";

  const variants = {
    standard:
      "bg-canvas border border-border rounded-sm px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent-soft",
    search:
      "bg-canvas-raised border border-border rounded-pill px-4 py-2 pl-10 focus:border-accent focus:ring-1 focus:ring-accent-soft",
  };

  return (
    <div className={cn("relative w-full", variant === "search" && "w-full")}>
      {variant === "search" && (
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      )}
      <input
        className={cn(base, variants[variant], className)}
        disabled={disabled}
        {...props}
      />
    </div>
  );
}
