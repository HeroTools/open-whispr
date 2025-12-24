import React from "react";
import { Cloud, Lock } from "lucide-react";

interface ProcessingModeSelectorProps {
  useLocalWhisper: boolean;
  setUseLocalWhisper: (value: boolean) => void;
  className?: string;
}

export default function ProcessingModeSelector({
  useLocalWhisper,
  setUseLocalWhisper,
  className = "",
}: ProcessingModeSelectorProps) {
  return (
    <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${className}`}>
      <button
        onClick={() => setUseLocalWhisper(false)}
        className={`cursor-pointer rounded-xl border-2 p-4 text-left transition-all ${
          !useLocalWhisper
            ? "border-primary-500 bg-primary-50"
            : "border-primary-200 bg-white hover:border-primary-300"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="h-6 w-6 text-primary-600" />
            <h4 className="font-medium text-primary-900">Cloud Processing</h4>
          </div>
          <span className="rounded-full bg-primary-100 px-2 py-1 text-xs text-primary-600">
            Fastest
          </span>
        </div>
        <p className="text-sm text-secondary-500">
          Audio sent to OpenAI servers. Faster processing, requires API key.
        </p>
      </button>

      <button
        onClick={() => setUseLocalWhisper(true)}
        className={`cursor-pointer rounded-xl border-2 p-4 text-left transition-all ${
          useLocalWhisper
            ? "border-primary-500 bg-primary-50"
            : "border-primary-200 bg-white hover:border-primary-300"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="h-6 w-6 text-primary-600" />
            <h4 className="font-medium text-primary-900">Local Processing</h4>
          </div>
          <span className="rounded-full bg-primary-100 px-2 py-1 text-xs text-primary-600">Private</span>
        </div>
        <p className="text-sm text-secondary-500">
          Audio stays on your device. Complete privacy, works offline.
        </p>
      </button>
    </div>
  );
}
