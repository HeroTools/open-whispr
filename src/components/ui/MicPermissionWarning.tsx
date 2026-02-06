import { useMemo } from "react";
import { Button } from "./button";
import { AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

interface MicPermissionWarningProps {
  error: string | null;
  onOpenSoundSettings: () => void;
  onOpenPrivacySettings: () => void;
}

type Platform = "darwin" | "win32" | "linux";

const getPlatform = (): Platform => {
  if (typeof window !== "undefined" && window.electronAPI?.getPlatform) {
    const p = window.electronAPI.getPlatform();
    if (p === "darwin" || p === "win32" || p === "linux") return p;
  }
  // Fallback to user agent
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) return "darwin";
    if (ua.includes("linux")) return "linux";
  }
  return "win32";
};

const PLATFORM_CONFIG: Record<
  Platform,
  { message: string; soundLabel: string; privacyLabel: string; showPrivacyButton: boolean }
> = {
  darwin: {
    message: "Check Sound settings to select your input device",
    soundLabel: "Sound",
    privacyLabel: "Privacy",
    showPrivacyButton: true,
  },
  win32: {
    message: "Check Windows Settings to select your input device",
    soundLabel: "Sound",
    privacyLabel: "Privacy",
    showPrivacyButton: true,
  },
  linux: {
    message: "Check system sound settings to select your input device",
    soundLabel: "Sound",
    privacyLabel: "",
    showPrivacyButton: false,
  },
};

export default function MicPermissionWarning({
  error,
  onOpenSoundSettings,
  onOpenPrivacySettings,
}: MicPermissionWarningProps) {
  const config = useMemo(() => PLATFORM_CONFIG[getPlatform()], []);

  return (
    <div
      className={cn(
        "rounded-md p-2.5 border",
        "bg-warning/10 border-warning/20"
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-warning/15 flex items-center justify-center shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-warning" />
        </div>
        <p className="flex-1 text-[11px] text-warning/90 leading-snug">
          {error || config.message}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSoundSettings}
            className="h-6 px-2 text-[10px] text-warning hover:text-warning hover:bg-warning/10"
          >
            {config.soundLabel}
          </Button>
          {config.showPrivacyButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenPrivacySettings}
              className="h-6 px-2 text-[10px] text-warning hover:text-warning hover:bg-warning/10"
            >
              {config.privacyLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
