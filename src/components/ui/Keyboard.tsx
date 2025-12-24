import React, { useState, useEffect } from "react";
import { formatHotkeyLabel } from "../../utils/hotkeys";

interface KeyboardProps {
  selectedKey?: string;
  setSelectedKey: (key: string) => void;
}

interface KeyProps {
  keyValue: string;
  isSelected: boolean;
  onClick: () => void;
  width?: string;
  disabled?: boolean;
  displayValue?: React.ReactNode;
}

const Key: React.FC<KeyProps> = ({
  keyValue,
  isSelected,
  onClick,
  width = "w-12",
  disabled = false,
  displayValue,
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    if (disabled) return;
    setIsPressed(true);
    onClick();
    setTimeout(() => setIsPressed(false), 150);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={` ${width} h-12 transform rounded-lg font-mono text-sm font-medium transition-all duration-150 ease-in-out active:scale-95 ${isPressed ? "translate-y-1" : "translate-y-0"} hover:translate-y-0.5 focus:ring-2 focus:ring-indigo-300 focus:outline-none ${
        isSelected
          ? "border-2 border-indigo-600 bg-indigo-500 text-white"
          : disabled
            ? "cursor-not-allowed bg-gray-300 text-gray-500"
            : "border-2 border-gray-300 bg-white text-gray-800 hover:border-gray-400"
      } ${isPressed ? "bg-gray-100" : ""} `}
    >
      {displayValue ?? (keyValue === "Space" ? "" : keyValue)}
    </button>
  );
};

export default function Keyboard({ selectedKey, setSelectedKey }: KeyboardProps) {
  const isMac = typeof navigator !== "undefined" && /Mac|Darwin/.test(navigator.platform);
  const canUseGlobe = isMac;
  const functionKeys = [
    "Esc",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
  ];

  const numberRow = ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];

  const qwertyRow = ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"];

  const asdfRow = ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'"];

  const zxcvRow = ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"];

  const handleKeyClick = (key: string) => {
    setSelectedKey(key);
  };

  useEffect(() => {
    if (!canUseGlobe && selectedKey === "GLOBE") {
      setSelectedKey("`");
    }
  }, [canUseGlobe, selectedKey, setSelectedKey]);

  return (
    <div className="rounded-2xl border border-gray-300 bg-gradient-to-b from-gray-100 to-gray-200 p-6">
      {/* Function Keys Row */}
      <div className="mb-4 flex justify-center gap-2">
        {functionKeys.map((key) => (
          <Key
            key={key}
            keyValue={key}
            isSelected={selectedKey === key}
            onClick={() => handleKeyClick(key)}
            width={key === "Esc" ? "w-14" : "w-12"}
          />
        ))}
      </div>

      {/* Number Row */}
      <div className="mb-2 flex justify-center gap-1">
        {numberRow.map((key) => (
          <Key
            key={key}
            keyValue={key}
            isSelected={selectedKey === key}
            onClick={() => handleKeyClick(key)}
          />
        ))}
        <Key
          keyValue="Backspace"
          isSelected={selectedKey === "Backspace"}
          onClick={() => handleKeyClick("Backspace")}
          width="w-20"
          disabled
        />
      </div>

      {/* QWERTY Row */}
      <div className="mb-2 flex justify-center gap-1">
        <Key
          keyValue="Tab"
          isSelected={selectedKey === "Tab"}
          onClick={() => handleKeyClick("Tab")}
          width="w-16"
          disabled
        />
        {qwertyRow.map((key) => (
          <Key
            key={key}
            keyValue={key}
            isSelected={selectedKey === key}
            onClick={() => handleKeyClick(key)}
          />
        ))}
      </div>

      {/* ASDF Row */}
      <div className="mb-2 flex justify-center gap-1">
        <Key
          keyValue="Caps"
          isSelected={selectedKey === "CapsLock"}
          onClick={() => handleKeyClick("CapsLock")}
          width="w-18"
          disabled
        />
        {asdfRow.map((key) => (
          <Key
            key={key}
            keyValue={key}
            isSelected={selectedKey === key}
            onClick={() => handleKeyClick(key)}
          />
        ))}
        <Key
          keyValue="Enter"
          isSelected={selectedKey === "Enter"}
          onClick={() => handleKeyClick("Enter")}
          width="w-20"
          disabled
        />
      </div>

      {/* ZXCV Row */}
      <div className="mb-2 flex justify-center gap-1">
        <Key
          keyValue="Shift"
          isSelected={selectedKey === "Shift"}
          onClick={() => handleKeyClick("Shift")}
          width="w-24"
          disabled
        />
        {zxcvRow.map((key) => (
          <Key
            key={key}
            keyValue={key}
            isSelected={selectedKey === key}
            onClick={() => handleKeyClick(key)}
          />
        ))}
        <Key
          keyValue="Shift"
          isSelected={false}
          onClick={() => handleKeyClick("Shift")}
          width="w-24"
          disabled
        />
      </div>

      {/* Bottom Row */}
      <div className="flex justify-center gap-1">
        <Key
          keyValue="Ctrl"
          isSelected={selectedKey === "Ctrl"}
          onClick={() => handleKeyClick("Ctrl")}
          width="w-16"
          disabled
        />
        {canUseGlobe ? (
          <Key
            keyValue="GLOBE"
            displayValue={
              <span role="img" aria-label="Globe">
                🌐
              </span>
            }
            isSelected={selectedKey === "GLOBE"}
            onClick={() => handleKeyClick("GLOBE")}
            width="w-16"
          />
        ) : (
          <Key
            keyValue="Globe"
            displayValue={
              <span role="img" aria-label="Globe">
                🌐
              </span>
            }
            isSelected={false}
            onClick={() => {}}
            width="w-16"
            disabled
          />
        )}
        <Key
          keyValue="Alt"
          isSelected={selectedKey === "Alt"}
          onClick={() => handleKeyClick("Alt")}
          width="w-16"
          disabled
        />
        <Key
          keyValue="Space"
          isSelected={selectedKey === "Space"}
          onClick={() => handleKeyClick("Space")}
          width="w-64"
        />
        <Key
          keyValue="Alt"
          isSelected={false}
          onClick={() => handleKeyClick("Alt")}
          width="w-16"
          disabled
        />
        <Key
          keyValue="Ctrl"
          isSelected={false}
          onClick={() => handleKeyClick("Ctrl")}
          width="w-16"
          disabled
        />
      </div>

      {/* Selected Key Display */}
      {selectedKey && (
        <div className="mt-6 text-center">
          <div className="inline-flex items-center rounded-lg border-2 border-indigo-300 bg-indigo-100 px-4 py-2">
            <span className="mr-2 text-sm text-indigo-700">Selected:</span>
            <kbd className="rounded border border-indigo-200 bg-white px-3 py-1 font-mono text-lg font-semibold text-indigo-900">
              {formatHotkeyLabel(selectedKey)}
            </kbd>
          </div>
        </div>
      )}
    </div>
  );
}
