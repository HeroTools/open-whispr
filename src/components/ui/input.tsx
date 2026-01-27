import * as React from "react";

import { cn } from "../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground border-input flex h-10 w-full min-w-0 rounded-xl border bg-transparent px-3.5 py-2 text-sm shadow-none transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "dark:bg-[oklch(0.13_0.006_270)] dark:border-[oklch(0.20_0.004_270)]",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15",
        "dark:focus-visible:border-[oklch(0.45_0.15_260)] dark:focus-visible:ring-[oklch(0.62_0.22_260/0.10)]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
