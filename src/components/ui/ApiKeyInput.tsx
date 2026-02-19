import React from "react";
import { Check } from "lucide-react";
import { Input } from "./input";

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
  const hasKey = apiKey.length > 0;
  const variantClasses = variant === "purple" ? "border-primary focus:border-primary" : "";

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-foreground mb-1">{label}</label>}
      <div className="relative">
        <Input
          type="password"
          placeholder={placeholder}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className={`h-8 text-sm ${hasKey ? "pr-8" : ""} ${variantClasses}`}
        />
        {hasKey && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <Check className="w-3.5 h-3.5 text-success" />
          </div>
        )}
      </div>
      {helpText && <p className="text-2xs text-muted-foreground/70 mt-1">{helpText}</p>}
    </div>
  );
}
