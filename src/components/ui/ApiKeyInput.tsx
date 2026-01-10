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

  const variantClasses = variant === "purple" ? "border-purple-300 focus:border-purple-500" : "";

  const buttonVariantClasses =
    variant === "purple" ? "border-purple-300 text-purple-700 hover:bg-purple-50" : "";

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-neutral-700 mb-2">{label}</label>
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
      {helpText && <p className="text-xs text-neutral-600 mt-2">{helpText}</p>}
    </div>
  );
}
