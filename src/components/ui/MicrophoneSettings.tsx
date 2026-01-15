import React, { useState, useEffect, useCallback, useRef } from "react";
import { Toggle } from "./toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Button } from "./button";
import { RefreshCw, Mic } from "lucide-react";
import { isBuiltInMicrophone } from "../../utils/audioDeviceUtils";

interface AudioDevice {
  deviceId: string;
  label: string;
  isBuiltIn: boolean;
}

interface MicrophoneSettingsProps {
  preferBuiltInMic: boolean;
  selectedMicDeviceId: string;
  onPreferBuiltInChange: (value: boolean) => void;
  onDeviceSelect: (deviceId: string) => void;
}

export const MicrophoneSettings: React.FC<MicrophoneSettingsProps> = ({
  preferBuiltInMic,
  selectedMicDeviceId,
  onPreferBuiltInChange,
  onDeviceSelect,
}) => {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to access current values without triggering re-renders
  const preferBuiltInRef = useRef(preferBuiltInMic);
  const selectedDeviceRef = useRef(selectedMicDeviceId);
  const onDeviceSelectRef = useRef(onDeviceSelect);

  // Keep refs in sync
  useEffect(() => {
    preferBuiltInRef.current = preferBuiltInMic;
    selectedDeviceRef.current = selectedMicDeviceId;
    onDeviceSelectRef.current = onDeviceSelect;
  }, [preferBuiltInMic, selectedMicDeviceId, onDeviceSelect]);

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Request permission first to get device labels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          isBuiltIn: isBuiltInMicrophone(d.label),
        }));

      setDevices(audioInputs);

      // If no device is selected and not preferring built-in, select the first device
      if (!preferBuiltInRef.current && !selectedDeviceRef.current && audioInputs.length > 0) {
        onDeviceSelectRef.current(audioInputs[0].deviceId);
      }
    } catch {
      setError("Unable to access microphone. Please check permissions.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();

    const handleDeviceChange = () => loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [loadDevices]);

  const builtInDevice = devices.find((d) => d.isBuiltIn);
  const selectedDevice = devices.find((d) => d.deviceId === selectedMicDeviceId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-800">Prefer Built-in Microphone</p>
          <p className="text-xs text-neutral-600 mt-1">
            Always use your device's built-in mic to prevent audio interruptions when using
            Bluetooth headphones
          </p>
        </div>
        <Toggle checked={preferBuiltInMic} onChange={onPreferBuiltInChange} />
      </div>

      {preferBuiltInMic && builtInDevice && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Mic className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-800">
              Using: <span className="font-medium">{builtInDevice.label}</span>
            </span>
          </div>
        </div>
      )}

      {preferBuiltInMic && !builtInDevice && devices.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            No built-in microphone detected. Using system default.
          </p>
        </div>
      )}

      {!preferBuiltInMic && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-neutral-700">Input Device</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadDevices}
              disabled={isLoading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <Select
              value={selectedMicDeviceId || "default"}
              onValueChange={(value) => onDeviceSelect(value === "default" ? "" : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a microphone">
                  {selectedMicDeviceId
                    ? selectedDevice?.label || "Unknown Device"
                    : "System Default"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">System Default</SelectItem>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId} value={device.deviceId}>
                    {device.label}
                    {device.isBuiltIn && (
                      <span className="ml-2 text-xs text-neutral-500">(Built-in)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <p className="text-xs text-neutral-500">
            Select a specific microphone or use the system default setting.
          </p>
        </div>
      )}
    </div>
  );
};

export default MicrophoneSettings;
