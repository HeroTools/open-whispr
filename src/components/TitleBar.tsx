import React, { useState } from "react";
import WindowControls from "./WindowControls";
import { Button } from "./ui/button";
import { Power } from "lucide-react";
import { ConfirmDialog } from "./ui/dialog";

interface TitleBarProps {
  title?: string;
  showTitle?: boolean;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export default function TitleBar({
  title = "",
  showTitle = false,
  children,
  className = "",
  actions,
}: TitleBarProps) {
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Get platform info
  const platform =
    typeof window !== "undefined" && window.electronAPI?.getPlatform
      ? window.electronAPI.getPlatform()
      : "darwin";

  const handleQuit = async () => {
    try {
      await window.electronAPI?.appQuit?.();
    } catch {
      // Silently handle if API not available
    }
  };

  return (
    <div
      className={`bg-white border-b border-gray-100 select-none ${className}`}
    >
      <div
        className="flex items-center justify-between h-12 px-4"
        style={{ WebkitAppRegion: "drag" }}
      >
        {/* Left section - title or custom content */}
        <div className="flex items-center gap-2">
          {showTitle && title && (
            <h1 className="text-sm font-semibold text-gray-900">{title}</h1>
          )}
          {children}
        </div>

        {/* Right section - actions and window controls */}
        <div
          className="flex items-center gap-2"
          style={{ WebkitAppRegion: "no-drag" }}
        >
          {actions}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowQuitConfirm(true)}
            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            title="Quit OpenWhispr"
            aria-label="Quit OpenWhispr"
          >
            <Power size={16} />
          </Button>
          {/* Show window controls on Linux and Windows (macOS uses native controls) */}
          {platform !== "darwin" && <WindowControls />}
        </div>
      </div>
      <ConfirmDialog
        open={showQuitConfirm}
        onOpenChange={setShowQuitConfirm}
        title="Quit OpenWhispr?"
        description="This will close OpenWhispr and stop background processes."
        confirmText="Quit"
        cancelText="Cancel"
        onConfirm={handleQuit}
        variant="destructive"
      />
    </div>
  );
}
