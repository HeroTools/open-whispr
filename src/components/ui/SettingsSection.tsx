import React from "react";
import { cn } from "../lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  className,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
};

interface SettingsGroupProps {
  title?: string;
  children: React.ReactNode;
  variant?: "default" | "highlighted";
  className?: string;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  children,
  variant = "default",
  className,
}) => {
  const variantClasses = {
    default: "bg-muted/50 border-border",
    highlighted: "bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30",
  };

  return (
    <div
      className={cn(
        "space-y-4 p-4 rounded-xl border",
        variantClasses[variant],
        className
      )}
    >
      {title && <h4 className="font-medium text-foreground">{title}</h4>}
      {children}
    </div>
  );
};
