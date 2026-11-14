import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex gap-3 rounded-2xl border px-4 py-3.5 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-border bg-muted/40 text-foreground [&>svg]:text-muted-foreground",
        info: "border-sky-200 bg-sky-50/80 text-sky-950 [&>svg]:text-sky-700",
        warning: "border-amber-200 bg-amber-50/80 text-amber-950 [&>svg]:text-amber-700",
        danger: "border-rose-200 bg-rose-50/80 text-rose-950 [&>svg]:text-rose-700",
        success: "border-emerald-200 bg-emerald-50/80 text-emerald-950 [&>svg]:text-emerald-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-medium leading-5", className)} {...props} />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-[13px] leading-5 opacity-90", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
