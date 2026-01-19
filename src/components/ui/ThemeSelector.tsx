import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "../lib/utils";
import type { ThemeMode } from "../../hooks/useTheme";

interface ThemeSelectorProps {
  value: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

const themes: {
  value: ThemeMode;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "light",
    label: "Light",
    icon: <Sun className="size-5" />,
  },
  {
    value: "dark",
    label: "Dark",
    icon: <Moon className="size-5" />,
  },
  {
    value: "system",
    label: "System",
    icon: <Monitor className="size-5" />,
  },
];

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {themes.map((theme) => {
        const isSelected = value === theme.value;
        return (
          <button
            key={theme.value}
            onClick={() => onChange(theme.value)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200",
              isSelected
                ? "border-primary bg-primary/10 dark:bg-primary/20"
                : "border-border bg-card hover:border-muted-foreground/50"
            )}
          >
            <div
              className={cn(
                "p-2 rounded-lg",
                isSelected
                  ? "bg-primary/10 text-primary dark:bg-primary/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {theme.icon}
            </div>
            <div className="text-center">
              <p
                className={cn(
                  "text-sm font-medium",
                  isSelected ? "text-primary" : "text-foreground"
                )}
              >
                {theme.label}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
