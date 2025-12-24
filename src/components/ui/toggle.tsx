import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const Toggle = ({ checked, onChange, disabled = false }: ToggleProps) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-1 focus:outline-none ${
      checked ? "bg-indigo-600" : "bg-neutral-300"
    } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
  >
    <span
      className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${
        checked ? "translate-x-5" : "translate-x-1"
      }`}
    />
  </button>
);
