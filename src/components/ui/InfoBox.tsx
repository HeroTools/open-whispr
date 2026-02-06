import React from "react";
import { cn } from "../lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const infoBoxVariants = cva("rounded-md border p-4 transition-colors", {
  variants: {
    variant: {
      default: "bg-primary/10 border-primary/20",
      success: "bg-success/10 border-success/20",
      warning: "bg-warning/10 border-warning/20",
      info: "bg-info/10 border-info/20",
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
