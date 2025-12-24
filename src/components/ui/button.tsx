import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center cursor-pointer justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary-600 active:bg-primary-700 border-0",
        destructive: "bg-error text-white hover:bg-error-600 active:bg-error-700 border-0",
        "destructive-outline":
          "border border-error/20 bg-white text-error hover:bg-error/5 hover:border-error/40",
        success: "bg-success text-white hover:bg-success-600 active:bg-success-700 border-0",
        warning: "bg-warning text-white hover:bg-warning-600 active:bg-warning-700 border-0",
        outline:
          "border border-primary-200 bg-white text-primary-900 hover:bg-primary-50 hover:border-primary-300",
        secondary: "bg-primary-50 text-primary-900 hover:bg-primary-100 border border-primary-200",
        ghost: "text-primary-900 hover:bg-primary-50",
        link: "text-primary underline-offset-4 hover:text-primary-600 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-lg px-6 has-[>svg]:px-4",
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
