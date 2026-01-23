import React from "react";
import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const infoBoxVariants = cva(
  "rounded-lg border p-4 transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/5 border-primary/20",
        success: "bg-success/10 dark:bg-success/20 border-success/30",
        warning: "bg-warning/10 dark:bg-warning/20 border-warning/30",
        info: "bg-info/10 dark:bg-info/20 border-info/30",
        muted: "bg-muted/30 border-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface InfoBoxProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof infoBoxVariants> {}

export function InfoBox({ variant, className, children, ...props }: InfoBoxProps) {
  return (
    <div className={cn(infoBoxVariants({ variant }), className)} {...props}>
      {children}
    </div>
  );
}
