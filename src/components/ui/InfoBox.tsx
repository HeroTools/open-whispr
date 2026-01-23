import React from "react";
import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const infoBoxVariants = cva(
  "rounded-lg border p-4 transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/5 border-primary/20",
        success: "bg-green-500/10 dark:bg-green-500/20 border-green-500/30",
        warning: "bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30",
        info: "bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30",
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
