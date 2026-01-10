import { useMemo } from "react";
import { Button } from "./button";

interface MicPermissionWarningProps {
  error: string | null;
  onOpenSoundSettings: () => void;
  onOpenPrivacySettings: () => void;
}

const getPlatformInfo = () => {
  if (typeof navigator === "undefined") {
    return { isMac: true, isWindows: false, isLinux: false };
  }
  const ua = navigator.userAgent.toLowerCase();
  return {
    isMac: ua.includes("mac"),
    isWindows: ua.includes("win"),
    isLinux: ua.includes("linux"),
  };
};

export default function MicPermissionWarning({
  error,
  onOpenSoundSettings,
  onOpenPrivacySettings,
}: MicPermissionWarningProps) {
  const { isMac, isWindows, isLinux } = useMemo(() => getPlatformInfo(), []);

  const defaultMessage = isWindows
    ? "If the microphone prompt doesn't appear, open Windows Settings to select your input device, then try again."
    : isLinux
      ? "If the microphone prompt doesn't appear, open your system sound settings to select your input device, then try again."
      : "If the microphone prompt doesn't appear, open Sound settings to select your input device, then try again.";

  const soundButtonLabel = isWindows
    ? "Open Sound Settings"
    : isLinux
      ? "Open Sound Settings"
      : "Open Sound Input Settings";

  const privacyButtonLabel = isWindows
    ? "Open Privacy Settings"
    : isLinux
      ? "Open Privacy Settings"
      : "Open Microphone Privacy";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
      <p className="text-sm text-amber-900">{error || defaultMessage}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onOpenSoundSettings}>
          {soundButtonLabel}
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenPrivacySettings}>
          {privacyButtonLabel}
        </Button>
      </div>
    </div>
  );
}
