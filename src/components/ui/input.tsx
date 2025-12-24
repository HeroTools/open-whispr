import * as React from "react";

import { cn } from "../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-lg border border-primary-200 bg-white px-3 py-2 text-sm text-primary-900 outline-none",
        "placeholder:text-secondary-500",
        "hover:border-primary-300",
        "focus:border-primary focus:ring-2 focus:ring-primary/10",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-primary-50 disabled:opacity-50",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary-900",
        className
      )}
      {...props}
    />
  );
}

export { Input };
