import React, { useState, useCallback, useRef, useEffect } from "react";
import { formatHotkeyLabel } from "../../utils/hotkeys";
import { cn } from "../lib/utils";

const CODE_TO_KEY: Record<string, string> = {
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
  // Navigation keys
  Insert: "Insert",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "PageUp",
  PageDown: "PageDown",
  // Additional keys (useful on Windows/Linux)
  Pause: "Pause",
  ScrollLock: "Scrolllock",
  PrintScreen: "PrintScreen",
  NumLock: "Numlock",
  // Numpad keys
  Numpad0: "num0",
  Numpad1: "num1",
  Numpad2: "num2",
  Numpad3: "num3",
  Numpad4: "num4",
  Numpad5: "num5",
  Numpad6: "num6",
  Numpad7: "num7",
  Numpad8: "num8",
  Numpad9: "num9",
  NumpadAdd: "numadd",
  NumpadSubtract: "numsub",
  NumpadMultiply: "nummult",
  NumpadDivide: "numdiv",
  NumpadDecimal: "numdec",
  NumpadEnter: "Enter",
  // Media keys (may work on some systems)
  MediaPlayPause: "MediaPlayPause",
  MediaStop: "MediaStop",
  MediaTrackNext: "MediaNextTrack",
  MediaTrackPrevious: "MediaPreviousTrack",
};

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
  disabled?: boolean;
  autoFocus?: boolean;
}

export function mapKeyboardEventToHotkey(e: KeyboardEvent): string | null {
  if (MODIFIER_CODES.has(e.code)) {
    return null;
  }

  const baseKey = CODE_TO_KEY[e.code];
  if (!baseKey) {
    return null;
  }

  const modifiers: string[] = [];

  if (e.ctrlKey || e.metaKey) {
    modifiers.push("CommandOrControl");
  }
  if (e.altKey) {
    modifiers.push("Alt");
  }
  if (e.shiftKey) {
    modifiers.push("Shift");
  }

  return modifiers.length > 0 ? [...modifiers, baseKey].join("+") : baseKey;
}

export function HotkeyInput({
  value,
  onChange,
  onBlur,
  disabled = false,
  autoFocus = false,
}: HotkeyInputProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeModifiers, setActiveModifiers] = useState<Set<string>>(
    new Set()
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const isMac =
    typeof navigator !== "undefined" && /Mac|Darwin/.test(navigator.platform);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const mods = new Set<string>();
      if (e.ctrlKey || e.metaKey) mods.add(isMac ? "Cmd" : "Ctrl");
      if (e.altKey) mods.add(isMac ? "Option" : "Alt");
      if (e.shiftKey) mods.add("Shift");
      setActiveModifiers(mods);

      const hotkey = mapKeyboardEventToHotkey(e.nativeEvent);
      if (hotkey) {
        onChange(hotkey);
        setIsCapturing(false);
        setActiveModifiers(new Set());
        containerRef.current?.blur();
      }
    },
    [disabled, onChange, isMac]
  );

  const handleKeyUp = useCallback(() => {
    setActiveModifiers(new Set());
  }, []);

  const handleFocus = useCallback(() => {
    if (!disabled) {
      setIsCapturing(true);
      window.electronAPI?.setHotkeyListeningMode?.(true);
    }
  }, [disabled]);

  const handleBlur = useCallback(() => {
    setIsCapturing(false);
    setActiveModifiers(new Set());
    window.electronAPI?.setHotkeyListeningMode?.(false);
    onBlur?.();
  }, [onBlur]);

  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    return () => {
      window.electronAPI?.setHotkeyListeningMode?.(false);
    };
  }, []);

  useEffect(() => {
    if (!isCapturing || !isMac) return;

    const dispose = window.electronAPI?.onGlobeKeyPressed?.(() => {
      onChange("GLOBE");
      setIsCapturing(false);
      setActiveModifiers(new Set());
      containerRef.current?.blur();
    });

    return () => dispose?.();
  }, [isCapturing, isMac, onChange]);

  const displayValue = formatHotkeyLabel(value);
  const isGlobe = value === "GLOBE";

  const hotkeyParts = value?.includes("+") ? displayValue.split("+") : [];

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Press a key combination to set hotkey"
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "relative overflow-hidden rounded-xl border-2 transition-all duration-300 ease-out cursor-pointer select-none focus:outline-none",
          disabled
            ? "bg-muted border-border cursor-not-allowed opacity-60"
            : isCapturing
              ? "bg-gradient-to-br from-primary/10 to-chart-3/10 dark:from-primary/20 dark:to-chart-3/20 border-primary shadow-lg shadow-primary/10 dark:shadow-primary/20"
              : "bg-card border-border hover:border-muted-foreground/50 hover:shadow-md"
        )}
      >
        {isCapturing && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-chart-3 to-primary animate-pulse" />
        )}

        <div className="px-6 py-5">
          {isCapturing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <div className="size-2 bg-destructive rounded-full animate-pulse" />
                <span className="text-sm font-medium text-muted-foreground">
                  Recording
                </span>
              </div>

              {activeModifiers.size > 0 ? (
                <div className="flex items-center justify-center gap-1.5">
                  {Array.from(activeModifiers).map((mod) => (
                    <kbd
                      key={mod}
                      className="px-2.5 py-1.5 bg-primary/10 dark:bg-primary/20 border border-primary/30 dark:border-primary/40 rounded-lg text-sm font-semibold text-primary shadow-sm"
                    >
                      {mod}
                    </kbd>
                  ))}
                  <span className="text-primary/60 font-medium">+</span>
                  <span className="px-2.5 py-1.5 border-2 border-dashed border-primary/40 rounded-lg text-sm text-primary/60">
                    key
                  </span>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">
                  Press any key or combination
                </p>
              )}

              <p className="text-xs text-center text-muted-foreground/70">
                {isMac ? "Try Cmd+Shift+K or Option+Space" : "Try Ctrl+Shift+K or Alt+Space"}
              </p>
            </div>
          ) : value ? (
            <div className="flex flex-col items-center gap-2">
              {hotkeyParts.length > 0 ? (
                <div className="flex items-center justify-center gap-1.5">
                  {hotkeyParts.map((part, i) => (
                    <React.Fragment key={part}>
                      {i > 0 && (
                        <span className="text-border font-medium">+</span>
                      )}
                      <kbd className="px-3 py-2 bg-muted border border-border rounded-lg text-base font-semibold text-foreground shadow-sm">
                        {part}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              ) : isGlobe ? (
                <div className="flex items-center gap-2">
                  <kbd className="px-4 py-2 bg-gradient-to-b from-muted to-muted/80 border border-border rounded-xl text-2xl shadow-sm">
                    🌐
                  </kbd>
                  <span className="text-sm font-medium text-muted-foreground">
                    Globe/Fn
                  </span>
                </div>
              ) : (
                <kbd className="px-5 py-3 bg-gradient-to-b from-muted to-muted/80 border border-border rounded-xl text-xl font-bold text-foreground shadow-sm min-w-[60px] text-center">
                  {displayValue}
                </kbd>
              )}

              <p className="text-xs text-muted-foreground/70">
                Click to change
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707"
                  />
                </svg>
                <span className="font-medium">Click to set hotkey</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default HotkeyInput;
