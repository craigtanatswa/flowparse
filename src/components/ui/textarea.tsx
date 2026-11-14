import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[90px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground shadow-[0_1px_1px_rgba(20,32,28,0.02)] outline-none placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export { Textarea };
