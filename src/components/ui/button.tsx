import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(12,42,36,0.18)] hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        outline:
          "border border-border bg-card text-foreground shadow-[0_1px_1px_rgba(20,32,28,0.03)] hover:bg-muted/70",
        ghost: "text-foreground/80 hover:bg-muted hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "bg-accent text-accent-foreground hover:bg-accent/70",
      },
      size: {
        default: "h-10 px-4 [&_svg]:size-4",
        sm: "h-9 rounded-md px-3 text-[13px] [&_svg]:size-3.5",
        lg: "h-11 rounded-xl px-5 [&_svg]:size-4",
        icon: "size-10 [&_svg]:size-4",
        "icon-sm": "size-8 rounded-md [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
