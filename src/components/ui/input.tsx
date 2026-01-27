import * as React from "react";

import { cn } from "../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground border-input flex h-10 w-full min-w-0 rounded-xl border bg-input px-3.5 py-2 text-sm shadow-none transition-all duration-200 outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "dark:bg-surface-1 dark:border-border-subtle",
        "focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15",
        "dark:focus-visible:border-border-active dark:focus-visible:ring-ring/10",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  );
}

export { Input };
