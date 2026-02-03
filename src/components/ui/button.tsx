import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[6px] text-sm font-medium cursor-pointer select-none",
    "transition-all duration-150 ease-out",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary CTA — refined blue metallic
        default: [
          "relative text-white font-semibold tracking-[0.01em]",
          "bg-gradient-to-b from-[#4a8df0] to-[#2563d4]",
          "border border-[#1e4fad]/70",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_1px_2px_0_rgba(0,0,0,0.1),0_1px_3px_0_rgba(37,99,212,0.2)]",
          "hover:from-[#5a9af5] hover:to-[#3574e0]",
          "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_2px_4px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(37,99,212,0.25)]",
          "active:from-[#3574e0] active:to-[#1e4fad] active:scale-[0.98]",
          "active:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.15)]",
        ].join(" "),

        // Success — emerald metallic
        success: [
          "relative text-white font-semibold tracking-[0.01em]",
          "bg-gradient-to-b from-[#34d399] to-[#10b981]",
          "border border-[#059669]/70",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_1px_2px_0_rgba(0,0,0,0.1),0_1px_3px_0_rgba(16,185,129,0.2)]",
          "hover:from-[#4ade80] hover:to-[#22c55e]",
          "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2),0_2px_4px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(16,185,129,0.25)]",
          "active:from-[#22c55e] active:to-[#059669] active:scale-[0.98]",
          "active:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.15)]",
        ].join(" "),

        // Destructive — red metallic
        destructive: [
          "relative text-white font-semibold tracking-[0.01em]",
          "bg-gradient-to-b from-[#f87171] to-[#ef4444]",
          "border border-[#dc2626]/70",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_1px_2px_0_rgba(0,0,0,0.1),0_1px_3px_0_rgba(239,68,68,0.2)]",
          "hover:from-[#fca5a5] hover:to-[#f87171]",
          "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_2px_4px_0_rgba(0,0,0,0.12),0_2px_8px_0_rgba(239,68,68,0.25)]",
          "active:from-[#ef4444] active:to-[#dc2626] active:scale-[0.98]",
          "active:shadow-[inset_0_2px_4px_0_rgba(0,0,0,0.15)]",
        ].join(" "),

        // Outline — uses design tokens
        outline: [
          "relative font-medium",
          "text-foreground bg-muted/80",
          "border border-border",
          "shadow-sm backdrop-blur-sm",
          "hover:bg-muted",
          "active:scale-[0.98]",
          // Dark mode overrides
          "dark:bg-surface-3",
          "dark:border-border-subtle",
          "dark:hover:bg-surface-raised",
        ].join(" "),

        // Secondary — uses design tokens
        secondary: [
          "relative font-medium",
          "text-foreground bg-secondary",
          "border border-border/50",
          "hover:bg-muted",
          "active:scale-[0.98]",
          // Dark mode overrides
          "dark:text-foreground/90 dark:bg-white/8",
          "dark:border-white/5",
          "dark:hover:bg-white/12",
        ].join(" "),

        // Ghost — uses design tokens
        ghost: [
          "font-medium",
          "text-foreground",
          "hover:bg-muted",
          "active:scale-[0.98]",
          // Dark mode overrides
          "dark:text-foreground/90",
          "dark:hover:bg-white/8",
        ].join(" "),

        // Link — uses design tokens
        link: [
          "font-medium",
          "text-primary",
          "hover:text-primary/80 hover:underline",
          "underline-offset-4",
          // Dark mode overrides
          "dark:text-primary",
          "dark:hover:text-primary/80",
        ].join(" "),
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs gap-1.5",
        lg: "h-10 px-5 text-sm",
        icon: "size-9",
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
