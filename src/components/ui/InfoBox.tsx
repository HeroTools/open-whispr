import React from "react";
import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const infoBoxVariants = cva("rounded-md border p-4 transition-colors", {
  variants: {
    variant: {
      default: "bg-primary/8 border-primary/20 dark:bg-primary/10 dark:border-primary/20",
      success: "bg-success/8 border-success/20 dark:bg-success/10 dark:border-success/20",
      warning: "bg-warning/8 border-warning/20 dark:bg-warning/10 dark:border-warning/20",
      info: "bg-info/8 border-info/20 dark:bg-info/10 dark:border-info/20",
      muted: "bg-surface-1 border-border-subtle",
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
