import { Globe, Check } from "lucide-react";
import type { ColorScheme } from "../../utils/modelPickerStyles";

export interface ModelCardOption {
  value: string;
  label: string;
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

const COLOR_CONFIG: Record<
  ColorScheme,
  {
    selected: string;
    default: string;
  }
> = {
  indigo: {
    selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
    default: "border-border bg-card dark:bg-[oklch(0.145_0.007_270)] dark:border-[oklch(0.22_0.005_270)] dark:hover:border-[oklch(0.30_0.012_250)] hover:border-muted-foreground/30",
  },
  purple: {
    selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
    default: "border-border bg-card dark:bg-[oklch(0.145_0.007_270)] dark:border-[oklch(0.22_0.005_270)] dark:hover:border-[oklch(0.30_0.012_250)] hover:border-muted-foreground/30",
  },
  blue: {
    selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
    default: "border-border bg-card dark:bg-[oklch(0.145_0.007_270)] dark:border-[oklch(0.22_0.005_270)] dark:hover:border-[oklch(0.30_0.012_250)] hover:border-muted-foreground/30",
  },
};

export default function ModelCardList({
  models,
  selectedModel,
  onModelSelect,
  colorScheme = "indigo",
  className = "",
}: ModelCardListProps) {
  const styles = COLOR_CONFIG[colorScheme];

  return (
    <div className={`space-y-2 ${className}`}>
      {models.map((model) => {
        const isSelected = selectedModel === model.value;

        return (
          <button
            key={model.value}
            onClick={() => onModelSelect(model.value)}
            className={`w-full p-4 rounded-xl border text-left transition-all duration-200 group ${
              isSelected ? styles.selected : styles.default
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  isSelected ? "bg-primary/15" : "bg-muted dark:bg-[oklch(0.13_0.006_270)]"
                }`}>
                  {model.icon ? (
                    <img src={model.icon} alt="" className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <span className="font-medium text-foreground">{model.label}</span>
                  {model.description && (
                    <div className="text-xs text-muted-foreground mt-0.5">{model.description}</div>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
