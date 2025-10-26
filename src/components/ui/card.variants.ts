import { cva } from "class-variance-authority";

/**
 * Card Component Variants
 * Usage: Use these variants for consistent card styling throughout the app
 */

export const cardVariants = cva("rounded-xl border bg-background transition-all duration-200", {
  variants: {
    variant: {
      default: "border-primary-200 bg-white shadow-sm",
      elevated: "border-primary-200 bg-white shadow-lg",
      ghost: "border-transparent bg-transparent shadow-none",
      outline: "border-primary-500 bg-white",
      success: "border-primary-300 bg-primary-50",
      warning: "border-secondary-300 bg-secondary-50",
      error: "border-error/20 bg-error/5",
    },
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-4",
      lg: "p-6",
      xl: "p-8",
    },
    hover: {
      none: "",
      lift: "hover:shadow-md hover:-translate-y-0.5",
      glow: "hover:shadow-lg hover:border-primary-400",
      scale: "hover:scale-[1.02]",
    },
  },
  defaultVariants: {
    variant: "default",
    padding: "md",
    hover: "none",
  },
});

export const cardHeaderVariants = cva("flex flex-col space-y-1.5", {
  variants: {
    padding: {
      none: "p-0",
      sm: "p-3",
      md: "p-4 pb-3",
      lg: "p-6 pb-4",
    },
  },
  defaultVariants: {
    padding: "md",
  },
});

export const cardContentVariants = cva("", {
  variants: {
    padding: {
      none: "p-0",
      sm: "p-3 pt-0",
      md: "p-4 pt-0",
      lg: "p-6 pt-0",
    },
  },
  defaultVariants: {
    padding: "md",
  },
});

export const cardFooterVariants = cva("flex items-center", {
  variants: {
    padding: {
      none: "p-0",
      sm: "p-3 pt-0",
      md: "p-4 pt-3",
      lg: "p-6 pt-4",
    },
    alignment: {
      left: "justify-start",
      center: "justify-center",
      right: "justify-end",
      between: "justify-between",
    },
  },
  defaultVariants: {
    padding: "md",
    alignment: "left",
  },
});
