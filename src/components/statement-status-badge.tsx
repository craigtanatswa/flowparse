import * as React from "react";
import { CheckCircle2, AlertTriangle, CircleX, Clock3, Loader2, CircleDot } from "lucide-react";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { statementStatus, type AppStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

const toneToVariant: Record<string, BadgeProps["variant"]> = {
  neutral: "neutral",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
};

const icons: Record<AppStatus, React.ComponentType<{ className?: string }>> = {
  uploaded: CircleDot,
  queued: Clock3,
  processing: Loader2,
  completed: CheckCircle2,
  partial: AlertTriangle,
  failed: CircleX,
};

export function StatementStatusBadge({
  status,
  size = "default",
  className,
}: {
  status: AppStatus;
  size?: BadgeProps["size"];
  className?: string;
}) {
  const config = statementStatus[status];
  const Icon = icons[status];
  return (
    <Badge
      variant={toneToVariant[config.tone]}
      size={size}
      className={cn("gap-1.5", className)}
    >
      <Icon className={cn(status === "processing" && "animate-spin")} />
      {size === "lg" ? config.label : config.shortLabel}
    </Badge>
  );
}
