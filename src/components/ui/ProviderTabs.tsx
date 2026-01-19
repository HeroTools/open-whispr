import { ReactNode } from "react";
import { ProviderIcon } from "./ProviderIcon";
import { cn } from "../lib/utils";
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

const colorSchemeStyles = {
  indigo: {
    selected: "text-primary border-b-2 border-primary bg-primary/10",
  },
  purple: {
    selected: "text-purple-600 dark:text-purple-400 border-b-2 border-purple-500 bg-purple-50 dark:bg-purple-950/50",
  },
  dynamic: {
    selected: "text-primary border-b-2 border-primary bg-primary/10",
  },
};

export function ProviderTabs({
  providers,
  selectedId,
  onSelect,
  renderIcon,
  colorScheme = "indigo",
  scrollable = true,
}: ProviderTabsProps) {
  const selectedStyles = colorSchemeStyles[colorScheme]?.selected ?? colorSchemeStyles.indigo.selected;

  return (
    <div
      className={cn(
        "flex bg-muted/50 border-b border-border",
        scrollable && "overflow-x-auto"
      )}
    >
      {providers.map((provider) => {
        const isSelected = selectedId === provider.id;

        return (
          <button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-all",
              scrollable && "whitespace-nowrap",
              isSelected
                ? selectedStyles
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {renderIcon ? (
              renderIcon(provider.id)
            ) : (
              <ProviderIcon provider={provider.id} />
            )}
            <span>{provider.name}</span>
          </button>
        );
      })}
    </div>
  );
}
