import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
  {
    variants: {
      variant: {
        // Primary CTA — bold, filled, high contrast, always shows brand color
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/85 active:bg-primary/75 dark:hover:bg-primary/90 dark:active:bg-primary/80",
        // Destructive — red, clear danger signal
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/85 active:bg-destructive/75",
        // Secondary — bordered, medium emphasis
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted/60 hover:border-muted-foreground/25",
        // Tertiary — subtle filled background
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 dark:bg-[oklch(0.18_0.005_270)] dark:hover:bg-[oklch(0.22_0.008_270)]",
        // Ghost — minimal, text only
        ghost:
          "text-foreground hover:bg-muted/60",
        // Link — inline text
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-xl px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
