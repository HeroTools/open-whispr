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

  const getActionsContent = () => {
    if (!actions) return null;

    if (platform !== "darwin" && React.isValidElement(actions)) {
      const childrenArray = React.Children.toArray(actions.props.children);
      return <>{[...childrenArray].reverse()}</>;
    }

    return actions;
  };

  return (
    <div className={`bg-background border-b border-border select-none ${className}`}>
      <div
        className="flex items-center justify-between h-12 px-4"
        style={{ WebkitAppRegion: "drag" }}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" }}>
          {platform !== "darwin" ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuitConfirm(true)}
                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                title="Quit OpenWhispr"
                aria-label="Quit OpenWhispr"
              >
                <Power size={16} />
              </Button>
              {getActionsContent()}
            </>
          ) : (
            <>
              {showTitle && title && (
                <h1 className="text-sm font-semibold text-foreground">{title}</h1>
              )}
              {children}
            </>
          )}
        </div>

        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" }}>
          {platform !== "darwin" ? (
            <>
              <WindowControls />
            </>
          ) : (
            <>
              {actions}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQuitConfirm(true)}
                className="h-8 w-8 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                title="Quit OpenWhispr"
                aria-label="Quit OpenWhispr"
              >
                <Power size={16} />
              </Button>
            </>
          )}
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
