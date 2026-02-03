import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

/**
 * Premium button component with refined metallic/glass styling.
 *
 * Design principles:
 * - Tight, consistent 6px radii across all sizes
 * - Subtle single inset highlight (no heavy overlays)
 * - Micro-interactions: scale transform on press
 * - Unified metallic treatment with restrained gradients
 *
 * Variants:
 * - default: Primary CTA (refined blue metallic)
 * - success: Positive actions (emerald metallic)
 * - destructive: Dangerous actions (red metallic)
 * - outline: Secondary actions (frosted glass)
 * - secondary: Subtle filled background
 * - ghost: Minimal, text only
 * - link: Inline text link
 */
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

        // Outline — explicit colors for reliability
        outline: [
          "relative font-medium",
          // Light mode: dark text on light gray bg
          "text-[#171717] bg-[#f5f5f5]/80",
          "border border-[#e5e5e5]",
          "shadow-sm backdrop-blur-sm",
          "hover:bg-[#e5e5e5]",
          "active:scale-[0.98]",
          // Dark mode overrides
          "dark:text-white dark:bg-surface-3",
          "dark:border-border-subtle",
          "dark:hover:bg-surface-raised",
        ].join(" "),

        // Secondary — explicit colors for reliability
        secondary: [
          "relative font-medium",
          // Light mode: dark text on light gray bg
          "text-[#171717] bg-[#f5f5f5]",
          "border border-[#e5e5e5]/50",
          "hover:bg-[#e5e5e5]",
          "active:scale-[0.98]",
          // Dark mode overrides
          "dark:text-white/90 dark:bg-white/8",
          "dark:border-white/5",
          "dark:hover:bg-white/12",
        ].join(" "),

        // Ghost — explicit colors for reliability
        ghost: [
          "font-medium",
          // Light mode: dark text, transparent bg
          "text-[#171717]",
          "hover:bg-[#f5f5f5]",
          "active:scale-[0.98]",
          // Dark mode overrides
          "dark:text-white/90",
          "dark:hover:bg-white/8",
        ].join(" "),

        // Link — explicit colors for reliability
        link: [
          "font-medium",
          // Light mode: blue text
          "text-[#2563eb]",
          "hover:text-[#1d4ed8] hover:underline",
          "underline-offset-4",
          // Dark mode overrides
          "dark:text-blue-400",
          "dark:hover:text-blue-300",
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
