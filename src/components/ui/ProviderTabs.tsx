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

export function ProviderTabs({
  providers,
  selectedId,
  onSelect,
  renderIcon,
  colorScheme = "indigo",
  scrollable = false,
}: ProviderTabsProps) {
  return (
    <div
      className={`relative flex p-0.5 rounded-lg bg-muted/40 dark:bg-background ${scrollable ? "overflow-x-auto" : ""}`}
    >
      {providers.map((provider) => {
        const isSelected = selectedId === provider.id;

        return (
          <button
            key={provider.id}
            onClick={() => onSelect(provider.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition-all duration-150 ${
              scrollable ? "whitespace-nowrap" : ""
            } ${
              isSelected
                ? "bg-card text-primary shadow-sm dark:bg-surface-3 dark:text-primary border border-primary/15 dark:border-primary/20"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            {renderIcon ? renderIcon(provider.id) : <ProviderIcon provider={provider.id} />}
            <span>{provider.name}</span>
          </button>
        );
      })}
    </div>
  );
}
