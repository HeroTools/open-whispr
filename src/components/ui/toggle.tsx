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
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:ring-offset-1 ${
      checked ? "bg-indigo-600" : "bg-neutral-300"
    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <span
      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
        checked ? "translate-x-5" : "translate-x-1"
      }`}
    />
  </button>
);
