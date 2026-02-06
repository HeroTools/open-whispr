import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Toggle = ({ checked, onChange, disabled = false }: ToggleProps) => {
  const getTrackClasses = () => {
    if (disabled) {
      return checked ? "bg-primary/40" : "bg-muted";
    }
    return checked
      ? "bg-primary hover:bg-primary/90"
      : "bg-surface-raised hover:bg-surface-3";
  };

  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 ${getTrackClasses()} ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full transition-all duration-150 ${
          checked ? "translate-x-3.5" : "translate-x-0.5"
        } ${disabled ? "bg-muted-foreground/50" : "bg-background shadow-sm"}`}
      />
    </button>
  );
};
