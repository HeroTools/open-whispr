import React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { useClipboard } from "../../hooks/useClipboard";
import { cn } from "../lib/utils";

interface ApiKeyInputProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  className?: string;
  placeholder?: string;
  label?: string;
  helpText?: React.ReactNode;
  variant?: "default" | "purple";
}

export default function ApiKeyInput({
  apiKey,
  setApiKey,
  className,
  placeholder = "sk-...",
  label = "API Key",
  helpText = "Get your API key from platform.openai.com",
  variant = "default",
}: ApiKeyInputProps) {
  const { pasteFromClipboardWithFallback } = useClipboard();

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-foreground mb-2">
        {label}
      </label>
      <div className="flex gap-3">
        <Input
          type="password"
          placeholder={placeholder}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className={cn(
            "flex-1",
            variant === "purple" &&
              "border-chart-3/50 focus-visible:border-chart-3 dark:border-chart-3/50 dark:focus-visible:border-chart-3"
          )}
        />
        <Button
          variant="outline"
          onClick={() => pasteFromClipboardWithFallback(setApiKey)}
          className={cn(
            variant === "purple" &&
              "border-chart-3/50 text-chart-3 hover:bg-chart-3/10 dark:border-chart-3/50 dark:text-chart-3 dark:hover:bg-chart-3/20"
          )}
        >
          Paste
        </Button>
      </div>
      {helpText && (
        <p className="text-xs text-muted-foreground mt-2">{helpText}</p>
      )}
    </div>
  );
}
