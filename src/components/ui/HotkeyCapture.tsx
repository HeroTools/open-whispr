import React, { useState, useEffect, useRef } from "react";
import { Keyboard } from "lucide-react";

interface HotkeyCaptureProps {
  value: string;
  onChange: (hotkey: string) => void;
  placeholder?: string;
}

export default function HotkeyCapture({
  value,
  onChange,
  placeholder = "Click and press a key combination",
}: HotkeyCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedKeys, setCapturedKeys] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLDivElement>(null);

  const isMac = typeof navigator !== "undefined" && /Mac|Darwin/.test(navigator.platform);

  // Map of key codes to Electron accelerator format
  const keyMap: Record<string, string> = {
    Control: "CommandOrControl",
    Meta: "CommandOrControl", // Cmd on Mac, Win key on Windows
    Alt: "Alt",
    Shift: "Shift",
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Escape: "Esc",
    Delete: "Delete",
    Backspace: "Backspace",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Tab: "Tab",
    Enter: "Return",
  };

  // Function keys
  for (let i = 1; i <= 24; i++) {
    keyMap[`F${i}`] = `F${i}`;
  }

  const formatHotkey = (keys: Set<string>): string => {
    const modifiers = [];
    let mainKey = "";

    keys.forEach((key) => {
      if (["CommandOrControl", "Alt", "Shift"].includes(key)) {
        modifiers.push(key);
      } else {
        mainKey = key;
      }
    });

    if (!mainKey) return "";

    // Sort modifiers in standard order
    const orderedModifiers = ["CommandOrControl", "Alt", "Shift"].filter((mod) =>
      modifiers.includes(mod)
    );

    return [...orderedModifiers, mainKey].join("+");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isCapturing) return;

    e.preventDefault();
    e.stopPropagation();

    const key = e.key;
    let mappedKey = keyMap[key] || key.toUpperCase();

    // Handle special cases
    if (key === "Control" || key === "Meta") {
      mappedKey = "CommandOrControl";
    }

    // Create new set with the captured key
    const newKeys = new Set(capturedKeys);

    // If it's a modifier, add it
    if (["CommandOrControl", "Alt", "Shift"].includes(mappedKey)) {
      newKeys.add(mappedKey);
    } else if (mappedKey.length === 1 || keyMap[key]) {
      // If it's a regular key (letter, number, symbol) or special key
      // Clear any previous main key and add this one
      const modifiers = Array.from(newKeys).filter((k) =>
        ["CommandOrControl", "Alt", "Shift"].includes(k)
      );
      newKeys.clear();
      modifiers.forEach((mod) => newKeys.add(mod));
      newKeys.add(mappedKey);

      // If we have a main key, finalize the capture
      const hotkey = formatHotkey(newKeys);
      if (hotkey) {
        onChange(hotkey);
        setIsCapturing(false);
        setCapturedKeys(new Set());
      }
    }

    setCapturedKeys(newKeys);
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (!isCapturing) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleFocus = () => {
    setIsCapturing(true);
    setCapturedKeys(new Set());
  };

  const handleBlur = () => {
    setIsCapturing(false);
    setCapturedKeys(new Set());
  };

  const displayValue = isCapturing
    ? formatHotkey(capturedKeys) || "Press keys..."
    : value || placeholder;

  const getDisplayLabel = (hotkey: string): string => {
    if (!hotkey) return placeholder;

    // Replace CommandOrControl with appropriate symbol
    let display = hotkey;
    if (isMac) {
      display = display.replace(/CommandOrControl/g, "⌘");
      display = display.replace(/Alt/g, "⌥");
      display = display.replace(/Shift/g, "⇧");
    } else {
      display = display.replace(/CommandOrControl/g, "Ctrl");
    }

    return display;
  };

  return (
    <div className="relative">
      <div
        ref={inputRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`flex w-full cursor-text items-center justify-between rounded-lg border-2 px-4 py-3 transition-all duration-200 ${
          isCapturing
            ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
            : "border-gray-300 bg-white hover:border-gray-400"
        } focus:outline-none`}
      >
        <div className="flex items-center gap-2">
          <Keyboard className="h-4 w-4 text-gray-500" />
          <kbd
            className={`font-mono text-sm font-medium ${isCapturing ? "text-indigo-700" : "text-gray-700"} `}
          >
            {isCapturing ? formatHotkey(capturedKeys) || "Press keys..." : getDisplayLabel(value)}
          </kbd>
        </div>
        {isCapturing && <span className="animate-pulse text-xs text-indigo-600">Recording...</span>}
      </div>

      <p className="mt-2 text-xs text-gray-500">
        {isMac ? "Examples: ⌘+K, ⌥+Space, ⌘+⇧+A" : "Examples: Ctrl+K, Alt+Space, Ctrl+Shift+A"}
      </p>

      {/* Clear button */}
      {value && !isCapturing && (
        <button
          onClick={() => onChange("")}
          className="absolute top-1/2 right-2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
        >
          Clear
        </button>
      )}
    </div>
  );
}
