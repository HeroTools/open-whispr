import { ReactNode } from "react";
import { ProviderIcon } from "./ProviderIcon";
import type { ColorScheme as BaseColorScheme } from "../../utils/modelPickerStyles";

export interface ProviderTabItem {
  id: string;
  name: string;
}

type ColorScheme = Exclude<BaseColorScheme, "blue"> | "dynamic";

interface ProviderTabsProps {
  providers: ProviderTabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  renderIcon?: (providerId: string) => ReactNode;
  colorScheme?: ColorScheme;
  /** Allow horizontal scrolling for many providers */
  scrollable?: boolean;
}

const COLOR_CONFIG: Record<
  Exclude<ColorScheme, "dynamic">,
  { selectedClass: string }
> = {
  indigo: {
    selectedClass: "border-b-2 border-primary bg-primary/10 dark:bg-primary/20 text-primary",
  },
  purple: {
    selectedClass: "border-b-2 border-primary bg-primary/10 dark:bg-primary/20 text-primary",
  },
};

export function ProviderTabs({
  providers,
  selectedId,
  onSelect,
  renderIcon,
  colorScheme = "indigo",
  scrollable = false,
}: ProviderTabsProps) {
  const colors = colorScheme !== "dynamic" ? COLOR_CONFIG[colorScheme] : null;

  return (
    <div
      className={`flex bg-muted/30 border-b border-border ${scrollable ? "overflow-x-auto" : ""}`}
    >
      {providers.map((provider) => {
        const isSelected = selectedId === provider.id;

        const selectedClass = colors?.selectedClass || "border-b-2 border-primary bg-primary/10 dark:bg-primary/20 text-primary";
        const baseClass = "flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all";
        const stateClass = isSelected
          ? selectedClass
          : "text-muted-foreground hover:bg-muted";

        return (
          <button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className={`${baseClass} ${scrollable ? "whitespace-nowrap" : ""} ${stateClass}`}
          >
            {renderIcon ? renderIcon(provider.id) : <ProviderIcon provider={provider.id} />}
            <span>{provider.name}</span>
          </button>
        );
      })}
    </div>
  );
}
