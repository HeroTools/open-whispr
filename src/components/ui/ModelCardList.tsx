import { Globe } from "lucide-react";
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
    badge: string;
  }
> = {
  indigo: {
    selected: "border-primary bg-primary/10 dark:bg-primary/20",
    default: "border-border bg-card hover:border-muted-foreground/30",
    badge: "text-xs text-primary-foreground bg-primary px-2 py-1 rounded-full font-medium",
  },
  purple: {
    selected: "border-primary bg-primary/10 dark:bg-primary/20",
    default: "border-border bg-card hover:border-muted-foreground/30",
    badge: "text-xs text-primary-foreground bg-primary px-2 py-1 rounded-full font-medium",
  },
  blue: {
    selected: "border-primary bg-primary/10 dark:bg-primary/20",
    default: "border-border bg-card hover:border-muted-foreground/30",
    badge: "text-xs text-primary-foreground bg-primary px-2 py-1 rounded-full font-medium",
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
            className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
              isSelected ? styles.selected : styles.default
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {model.icon ? (
                    <img src={model.icon} alt="" className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="font-medium text-foreground">{model.label}</span>
                </div>
                {model.description && (
                  <div className="text-xs text-muted-foreground mt-1">{model.description}</div>
                )}
              </div>
              {isSelected && <span className={styles.badge}>✓ Selected</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
