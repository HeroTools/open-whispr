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
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${className}`}>
      <button
        onClick={() => setUseLocalWhisper(false)}
        className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
          !useLocalWhisper
            ? "border-primary bg-primary/10 dark:bg-primary/20"
            : "border-border bg-card hover:border-muted-foreground/30"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Cloud className="w-6 h-6 text-primary" />
            <h4 className="font-medium text-foreground">Cloud Processing</h4>
          </div>
          <span className="text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/20 px-2 py-1 rounded-full">
            Fastest
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Audio sent to OpenAI servers. Faster processing, requires API key.
        </p>
      </button>

      <button
        onClick={() => setUseLocalWhisper(true)}
        className={`p-4 border-2 rounded-xl text-left transition-all cursor-pointer ${
          useLocalWhisper
            ? "border-primary bg-primary/10 dark:bg-primary/20"
            : "border-border bg-card hover:border-muted-foreground/30"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6 text-primary" />
            <h4 className="font-medium text-foreground">Local Processing</h4>
          </div>
          <span className="text-xs text-primary-foreground bg-primary px-2 py-1 rounded-full">Private</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Audio stays on your device. Complete privacy, works offline.
        </p>
      </button>
    </div>
  );
}
