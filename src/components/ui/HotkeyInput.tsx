import React, { useState, useCallback, useRef, useEffect } from "react";
import { formatHotkeyLabel } from "../../utils/hotkeys";

/**
 * Layout-independent key code to key name mapping.
 * Uses e.code (physical key) instead of e.key (layout-dependent character)
 * to ensure hotkeys work correctly across different keyboard layouts.
 */
const CODE_TO_KEY: Record<string, string> = {
  // Number row
  Backquote: "`",
  Digit1: "1",
  Digit2: "2",
  Digit3: "3",
  Digit4: "4",
  Digit5: "5",
  Digit6: "6",
  Digit7: "7",
  Digit8: "8",
  Digit9: "9",
  Digit0: "0",
  Minus: "-",
  Equal: "=",

  // QWERTY row
  KeyQ: "Q",
  KeyW: "W",
  KeyE: "E",
  KeyR: "R",
  KeyT: "T",
  KeyY: "Y",
  KeyU: "U",
  KeyI: "I",
  KeyO: "O",
  KeyP: "P",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",

  // ASDF row
  KeyA: "A",
  KeyS: "S",
  KeyD: "D",
  KeyF: "F",
  KeyG: "G",
  KeyH: "H",
  KeyJ: "J",
  KeyK: "K",
  KeyL: "L",
  Semicolon: ";",
  Quote: "'",

  // ZXCV row
  KeyZ: "Z",
  KeyX: "X",
  KeyC: "C",
  KeyV: "V",
  KeyB: "B",
  KeyN: "N",
  KeyM: "M",
  Comma: ",",
  Period: ".",
  Slash: "/",

  // Special keys
  Space: "Space",
  Escape: "Esc",
  Tab: "Tab",
  Enter: "Enter",
  Backspace: "Backspace",

  // Function keys
  F1: "F1",
  F2: "F2",
  F3: "F3",
  F4: "F4",
  F5: "F5",
  F6: "F6",
  F7: "F7",
  F8: "F8",
  F9: "F9",
  F10: "F10",
  F11: "F11",
  F12: "F12",

  // Arrow keys
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",

  // Other common keys
  Insert: "Insert",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
};

/**
 * Keys that should be ignored when pressed alone (modifier-only presses)
 */
const MODIFIER_CODES = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "CapsLock",
]);

export interface HotkeyInputProps {
  value: string;
  onChange: (hotkey: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Maps a keyboard event to an Electron-compatible accelerator string.
 * Uses physical key codes for layout independence.
 *
 * @example
 * // Returns "CommandOrControl+Shift+K" when Cmd+Shift+K is pressed on macOS
 * // Returns "CommandOrControl+Shift+K" when Ctrl+Shift+K is pressed on Windows/Linux
 */
export function mapKeyboardEventToHotkey(e: KeyboardEvent): string | null {
  // Ignore modifier-only key presses
  if (MODIFIER_CODES.has(e.code)) {
    return null;
  }

  // Get the base key from code
  const baseKey = CODE_TO_KEY[e.code];
  if (!baseKey) {
    return null;
  }

  // Build modifier array using Electron's cross-platform convention
  const modifiers: string[] = [];

  // CommandOrControl: Cmd on macOS, Ctrl on Windows/Linux
  if (e.ctrlKey || e.metaKey) {
    modifiers.push("CommandOrControl");
  }

  if (e.altKey) {
    modifiers.push("Alt");
  }

  if (e.shiftKey) {
    modifiers.push("Shift");
  }

  // Combine modifiers and base key
  if (modifiers.length > 0) {
    return [...modifiers, baseKey].join("+");
  }

  // Single key (no modifiers)
  return baseKey;
}

/**
 * HotkeyInput - A keyboard capture component for compound hotkeys.
 *
 * Supports:
 * - Single keys (e.g., "F1", "`")
 * - Compound keys (e.g., "CommandOrControl+Shift+K")
 * - Layout-independent key detection using e.code
 * - Cross-platform compatibility with Electron's accelerator format
 */
export function HotkeyInput({
  value,
  onChange,
  onBlur,
  placeholder = "Press a key combination...",
  className = "",
  disabled = false,
  autoFocus = false,
}: HotkeyInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;

      // Prevent default behavior for most keys
      e.preventDefault();
      e.stopPropagation();

      // Convert keyboard event to native KeyboardEvent for mapping
      const nativeEvent = e.nativeEvent;
      const hotkey = mapKeyboardEventToHotkey(nativeEvent);

      if (hotkey) {
        onChange(hotkey);
        setIsCapturing(false);
      }
    },
    [disabled, onChange]
  );

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setIsCapturing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsCapturing(false);
    onBlur?.();
  }, [onBlur]);

  // Auto-focus support
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const displayValue = value ? formatHotkeyLabel(value) : "";
  const isMac =
    typeof navigator !== "undefined" && /Mac|Darwin/.test(navigator.platform);

  return (
    <div
      ref={inputRef}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label="Press a key combination to set hotkey"
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`
        relative flex items-center justify-center
        w-full px-4 py-3
        text-center text-lg font-mono
        border-2 rounded-lg
        transition-all duration-200
        cursor-pointer select-none
        focus:outline-none
        ${
          disabled
            ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
            : isFocused
            ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200"
            : "bg-white border-gray-300 hover:border-gray-400"
        }
        ${className}
      `}
    >
      {isCapturing && !displayValue ? (
        <span className="text-indigo-600 animate-pulse">{placeholder}</span>
      ) : displayValue ? (
        <span className="text-gray-900">{displayValue}</span>
      ) : (
        <span className="text-gray-400">{placeholder}</span>
      )}

      {isFocused && (
        <div className="absolute -bottom-6 left-0 right-0 text-center">
          <span className="text-xs text-indigo-600">
            {isMac ? "Try Cmd+Shift+K or any key" : "Try Ctrl+Shift+K or any key"}
          </span>
        </div>
      )}
    </div>
  );
}

export default HotkeyInput;
