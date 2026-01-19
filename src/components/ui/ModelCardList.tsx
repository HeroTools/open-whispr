import { Globe, Check } from "lucide-react";
import { cn } from "../lib/utils";
import type { ColorScheme } from "../../utils/modelPickerStyles";

// Providers with monochrome (black) icons that need inversion in dark mode
const MONOCHROME_PROVIDERS = ["openai", "anthropic", "whisper"];

export interface ModelCardOption {
  value: string;
  label: string;
  provider?: string;
  description?: string;
  icon?: string;
}

interface ModelCardListProps {
  models: ModelCardOption[];
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
  colorScheme?: ColorScheme;
  className?: string;
}

const colorSchemeStyles = {
  indigo: {
    card: "border-primary bg-primary/10 dark:bg-primary/20",
    badge: "text-primary bg-primary/10 dark:bg-primary/20",
  },
  purple: {
    card: "border-purple-500 bg-purple-50 dark:bg-purple-950/50",
    badge: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50",
  },
  blue: {
    card: "border-blue-500 bg-blue-50 dark:bg-blue-950/50",
    badge: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50",
  },
};

export default function ModelCardList({
  models,
  selectedModel,
  onModelSelect,
  colorScheme = "indigo",
  className,
}: ModelCardListProps) {
  const styles = colorSchemeStyles[colorScheme] ?? colorSchemeStyles.indigo;

  return (
    <div className={cn("space-y-2", className)}>
      {models.map((model) => {
        const isSelected = selectedModel === model.value;

        return (
          <button
            key={model.value}
            onClick={() => onModelSelect(model.value)}
            className={cn(
              "w-full p-3 rounded-lg border-2 text-left transition-all",
              isSelected
                ? styles.card
                : "border-border bg-card hover:border-muted-foreground/50"
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {model.icon ? (
                    <img
                      src={model.icon}
                      alt=""
                      className={cn(
                        "size-4",
                        model.provider && MONOCHROME_PROVIDERS.includes(model.provider) && "dark:invert"
                      )}
                      aria-hidden="true"
                    />
                  ) : (
                    <Globe
                      className="size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className="font-medium text-foreground">
                    {model.label}
                  </span>
                </div>
                {model.description && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {model.description}
                  </div>
                )}
              </div>
              {isSelected && (
                <span className={cn("text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1", styles.badge)}>
                  <Check className="size-3" />
                  Selected
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
