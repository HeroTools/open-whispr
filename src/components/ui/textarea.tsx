import * as React from "react";

import { cn } from "../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full cursor-text resize-y rounded-lg border px-3 py-2 text-sm transition-all duration-200 ease-in-out outline-none disabled:cursor-not-allowed disabled:opacity-50",
          // Use existing CSS from index.css - the textarea styles are already defined there
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
