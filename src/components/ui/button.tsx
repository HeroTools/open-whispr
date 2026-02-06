import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[6px] text-sm font-medium cursor-pointer select-none",
    "transition-all duration-150 ease-out",
    "outline-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary CTA — flat mint
        default: [
          "relative text-[#080908] font-semibold tracking-[0.01em]",
          "bg-[#70FFBA]",
          "border border-[#70FFBA]/20",
          "shadow-none",
          "hover:bg-[#8BFFC8] hover:shadow-[0_0_12px_rgba(112,255,186,0.15)]",
          "active:bg-[#5DE6A6] active:scale-[0.98]",
        ].join(" "),

        // Success — same as primary (mint IS success)
        success: [
          "relative text-[#080908] font-semibold tracking-[0.01em]",
          "bg-[#70FFBA]",
          "border border-[#70FFBA]/20",
          "shadow-none",
          "hover:bg-[#8BFFC8] hover:shadow-[0_0_12px_rgba(112,255,186,0.15)]",
          "active:bg-[#5DE6A6] active:scale-[0.98]",
        ].join(" "),

        // Destructive — flat red
        destructive: [
          "relative text-white font-semibold tracking-[0.01em]",
          "bg-[#FF6B6B]",
          "border border-[#FF6B6B]/20",
          "shadow-none",
          "hover:bg-[#FF8585]",
          "active:bg-[#E65555] active:scale-[0.98]",
        ].join(" "),

        // Outline — flat with border
        outline: [
          "relative font-medium",
          "text-foreground bg-surface-1",
          "border border-border",
          "hover:bg-surface-2 hover:border-border-hover",
          "active:scale-[0.98]",
        ].join(" "),

        // Secondary — subtle surface
        secondary: [
          "relative font-medium",
          "text-foreground bg-surface-2",
          "border border-border-subtle",
          "hover:bg-surface-raised",
          "active:scale-[0.98]",
        ].join(" "),

        // Ghost — minimal
        ghost: [
          "font-medium",
          "text-muted-foreground",
          "hover:text-foreground hover:bg-surface-1",
          "active:scale-[0.98]",
        ].join(" "),

        // Link
        link: [
          "font-medium",
          "text-primary",
          "hover:text-primary/80 hover:underline",
          "underline-offset-4",
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
