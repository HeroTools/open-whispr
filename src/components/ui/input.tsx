import * as React from "react";

import { cn } from "../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-sm text-neutral-900 shadow-sm transition-all duration-200 outline-none",
        "placeholder:text-neutral-400",
        "hover:border-neutral-300",
        "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-neutral-50",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-neutral-900",
        "aria-invalid:border-red-300 aria-invalid:ring-red-100",
        className
      )}
      {...props}
    />
  );
}

export { Input };
