import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ProviderTabs } from "../ui/ProviderTabs";
import { ProviderIcon } from "../ui/ProviderIcon";
import { REASONING_PROVIDERS } from "../../models/ModelRegistry";
import { cn } from "../lib/utils";

interface NoteModelPickerProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
  disabled?: boolean;
}

const CLOUD_PROVIDER_IDS = ["openai", "anthropic", "gemini", "groq"] as const;

const PROVIDER_KEY_MAP: Record<string, string> = {
  openai: "openaiApiKey",
  anthropic: "anthropicApiKey",
  gemini: "geminiApiKey",
  groq: "groqApiKey",
};

function getAvailableProviders() {
  const isSignedIn = localStorage.getItem("isSignedIn") === "true";
  const cloudMode = localStorage.getItem("cloudReasoningMode");
  const isCloud = isSignedIn && cloudMode === "openwhispr";

  return CLOUD_PROVIDER_IDS.filter(
    (id) => REASONING_PROVIDERS[id] && (isCloud || !!localStorage.getItem(PROVIDER_KEY_MAP[id]))
  );
}

function getProviderForModel(modelId: string): string | null {
  for (const id of CLOUD_PROVIDER_IDS) {
    const provider = REASONING_PROVIDERS[id];
    if (provider?.models.some((m) => m.value === modelId)) return id;
  }
  return null;
}

export default function NoteModelPicker({
  selectedModel,
  onModelSelect,
  disabled,
}: NoteModelPickerProps) {
  const { t } = useTranslation();
  const availableProviders = useMemo(getAvailableProviders, []);

  const initialProvider =
    (selectedModel && getProviderForModel(selectedModel)) || availableProviders[0] || null;

  const [activeProvider, setActiveProvider] = useState(initialProvider);

  if (availableProviders.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground/60 py-4 text-center">
        {t("notes.enhance.noProviders")}
      </p>
    );
  }

  const currentProvider =
    activeProvider &&
    availableProviders.includes(activeProvider as (typeof CLOUD_PROVIDER_IDS)[number])
      ? activeProvider
      : availableProviders[0];

  const providerTabs = availableProviders.map((id) => ({
    id,
    name: REASONING_PROVIDERS[id].name,
  }));

  const models = REASONING_PROVIDERS[currentProvider]?.models ?? [];

  const handleProviderChange = (providerId: string) => {
    setActiveProvider(providerId);
    const firstModel = REASONING_PROVIDERS[providerId]?.models[0];
    if (firstModel) onModelSelect(firstModel.value);
  };

  return (
    <div className={cn("space-y-1.5", disabled && "opacity-40 pointer-events-none")}>
      <ProviderTabs
        providers={providerTabs}
        selectedId={currentProvider}
        onSelect={handleProviderChange}
        renderIcon={(id) => <ProviderIcon provider={id} className="w-3.5 h-3.5" />}
        scrollable
      />
      <div className="max-h-[140px] overflow-y-auto space-y-0.5">
        {models.map((model) => {
          const isSelected = selectedModel === model.value;
          return (
            <button
              key={model.value}
              type="button"
              onClick={() => onModelSelect(model.value)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left",
                "transition-colors duration-150 cursor-pointer",
                isSelected
                  ? "bg-primary/8 dark:bg-primary/6"
                  : "hover:bg-foreground/3 dark:hover:bg-white/4"
              )}
            >
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isSelected
                    ? "bg-primary shadow-[0_0_6px_oklch(0.62_0.22_260/0.5)]"
                    : "bg-muted-foreground/30"
                )}
              />
              <span className="text-[12px] font-semibold text-foreground truncate">
                {model.label}
              </span>
              <span className="text-[10px] text-muted-foreground/50 truncate ml-auto shrink-0">
                {model.descriptionKey
                  ? t(model.descriptionKey, { defaultValue: model.description })
                  : model.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
