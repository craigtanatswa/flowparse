import type { ReactNode } from "react";

import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  brand = false,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  brand?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center",
        className
      )}
    >
      {brand ? (
        <LogoMark className="mb-5 size-12" />
      ) : (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
