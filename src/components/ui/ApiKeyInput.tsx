import React from "react";
import { Button } from "./button";
import { Input } from "./input";
import { useClipboard } from "../../hooks/useClipboard";

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
  className = "",
  placeholder = "sk-...",
  label = "API Key",
  helpText = "Get your API key from platform.openai.com",
  variant = "default",
}: ApiKeyInputProps) {
  const { pasteFromClipboardWithFallback } = useClipboard();

  const variantClasses = variant === "purple" ? "border-primary focus:border-primary" : "";

  const buttonVariantClasses =
    variant === "purple" ? "border-primary text-primary hover:bg-primary/10" : "";

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-foreground mb-2">{label}</label>
      <div className="flex gap-3">
        <Input
          type="password"
          placeholder={placeholder}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className={`flex-1 ${variantClasses}`}
        />
        <Button
          variant="outline"
          onClick={() => pasteFromClipboardWithFallback(setApiKey)}
          className={buttonVariantClasses}
        >
          Paste
        </Button>
      </div>
      {helpText && <p className="text-xs text-muted-foreground mt-2">{helpText}</p>}
    </div>
  );
}
