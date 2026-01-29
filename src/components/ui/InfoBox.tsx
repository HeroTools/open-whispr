import React from "react";
import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const infoBoxVariants = cva("rounded-lg border p-4 transition-colors", {
  variants: {
    variant: {
      default: "bg-primary/10 border-primary/25 dark:bg-primary/5 dark:border-primary/20",
      success: "bg-success/15 border-success/30 dark:bg-success/20 dark:border-success/30",
      warning: "bg-warning/15 border-warning/30 dark:bg-warning/20 dark:border-warning/30",
      info: "bg-info/15 border-info/30 dark:bg-info/20 dark:border-info/30",
      muted: "bg-muted/50 border-border dark:bg-muted/30",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface InfoBoxProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof infoBoxVariants> {}

export function InfoBox({ variant, className, children, ...props }: InfoBoxProps) {
  return (
    <div className={cn(infoBoxVariants({ variant }), className)} {...props}>
      {children}
    </div>
  );
}
