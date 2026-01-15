import { useState, useEffect, useCallback } from "react";

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: MediaDeviceKind;
}

export function useAudioDevices() {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const getDevices = useCallback(async () => {
    console.log("[useAudioDevices] Starting device enumeration...");

    try {
      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.error("[useAudioDevices] MediaDevices API not available");
        return;
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      console.log("[useAudioDevices] All devices enumerated:", {
        totalDevices: allDevices.length,
        deviceKinds: allDevices.map(d => d.kind),
      });

      const audioInputs = allDevices
        .filter((device) => device.kind === "audioinput")
        .map((device) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${device.deviceId.slice(0, 5)}...`,
          kind: device.kind,
        }));

      console.log("[useAudioDevices] Audio inputs found:", {
        count: audioInputs.length,
        devices: audioInputs.map(d => ({
          deviceId: d.deviceId.slice(0, 8) + "...",
          label: d.label,
          hasLabel: !!d.label && d.label !== "",
        })),
      });

      setDevices(audioInputs);

      // Check if we have meaningful labels (not just fallback labels)
      // A device has a real label if it's not empty and doesn't match our fallback pattern
      const hasRealLabels = audioInputs.some(d => {
        const hasLabel = d.label && d.label !== "";
        const isFallbackLabel = d.label.startsWith("Microphone ");
        return hasLabel && !isFallbackLabel;
      });

      console.log("[useAudioDevices] Permission check:", {
        hasRealLabels,
        audioInputCount: audioInputs.length,
        labels: audioInputs.map(d => d.label),
      });

      if (hasRealLabels) {
        console.log("[useAudioDevices] Permission granted - devices have real labels");
        setPermissionGranted(true);
      } else if (audioInputs.length === 0) {
        console.warn("[useAudioDevices] No audio input devices found");
        setPermissionGranted(false);
      } else {
        console.warn("[useAudioDevices] Devices found but no real labels - permission likely not granted");
        setPermissionGranted(false);
      }

    } catch (error) {
      console.error("[useAudioDevices] Error enumerating devices:", error);
    }
  }, []);

  useEffect(() => {
    getDevices();

    const handleDeviceChange = () => {
        getDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [getDevices]);

  return { devices, refreshDevices: getDevices, permissionGranted };
}
