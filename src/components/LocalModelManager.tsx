import React from "react";
import UnifiedModelPicker from "./UnifiedModelPicker";
import { useSettings } from "../hooks/useSettings";

export function LocalModelManager() {
  const { reasoningModel, setReasoningModel } = useSettings();

  return (
    <UnifiedModelPicker
      selectedModel={reasoningModel}
      onModelSelect={setReasoningModel}
      modelType="llm"
      variant="settings"
    />
  );
}