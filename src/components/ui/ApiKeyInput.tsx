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
  helpText?: string;
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

  const variantClasses = variant === "purple" ? "border-primary-300 focus:border-primary-500" : "";

  const buttonVariantClasses =
    variant === "purple" ? "border-primary-300 text-primary-700 hover:bg-primary-50" : "";

  return (
    <div className={className}>
      <label className="mb-2 block text-sm font-medium text-primary-900">{label}</label>
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
      <p className="mt-2 text-xs text-secondary-500">{helpText}</p>
    </div>
  );
}
