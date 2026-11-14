import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm text-foreground shadow-[0_1px_1px_rgba(20,32,28,0.02)] outline-none transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
