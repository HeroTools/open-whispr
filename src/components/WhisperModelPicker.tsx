import React from "react";
import UnifiedModelPicker from "./UnifiedModelPicker";

interface WhisperModelPickerProps {
  selectedModel: string;
  onModelSelect: (model: string) => void;
  className?: string;
  variant?: "onboarding" | "settings";
}

export default function WhisperModelPicker({
  selectedModel,
  onModelSelect,
  className = "",
  variant = "settings",
}: WhisperModelPickerProps) {
  return (
    <UnifiedModelPicker
      selectedModel={selectedModel}
      onModelSelect={onModelSelect}
      modelType="whisper"
      className={className}
      variant={variant}
    />
  );
}
