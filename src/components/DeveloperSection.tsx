import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { FolderOpen, Copy, Check } from "lucide-react";
import { useToast } from "./ui/Toast";
import { Toggle } from "./ui/toggle";

export default function DeveloperSection() {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadDebugState();
  }, []);

  const loadDebugState = async () => {
    try {
      setIsLoading(true);
      const state = await window.electronAPI.getDebugState();
      setDebugEnabled(state.enabled);
      setLogPath(state.logPath);
    } catch (error) {
      console.error("Failed to load debug state:", error);
      toast({
        title: "Couldn't load debug settings",
        description: "Something went wrong. Try reopening Settings.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDebug = async () => {
    if (isToggling) return;

    try {
      setIsToggling(true);
      const newState = !debugEnabled;
      const result = await window.electronAPI.setDebugLogging(newState);

      if (!result.success) {
        throw new Error(result.error || "Failed to update debug logging");
      }

      setDebugEnabled(newState);
      await loadDebugState();

      toast({
        title: newState ? "Debug Logging Enabled" : "Debug Logging Disabled",
        description: newState
          ? "Detailed logs are now being written to disk"
          : "Debug logging has been turned off",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Couldn't update debug logging",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsToggling(false);
    }
  };

  const handleOpenLogsFolder = async () => {
    try {
      const result = await window.electronAPI.openLogsFolder();
      if (!result.success) {
        throw new Error(result.error || "Failed to open folder");
      }
    } catch (error) {
      toast({
        title: "Couldn't open logs folder",
        description: "The folder might not exist yet. Try enabling debug mode first.",
        variant: "destructive",
      });
    }
  };

  const handleCopyPath = async () => {
    if (!logPath) return;

    try {
      await navigator.clipboard.writeText(logPath);
      setCopiedPath(true);
      toast({
        title: "Copied",
        description: "Log file path copied to clipboard",
        variant: "success",
        duration: 2000,
      });
      setTimeout(() => setCopiedPath(false), 2000);
    } catch (error) {
      toast({
        title: "Couldn't copy",
        description: "Something went wrong copying to your clipboard.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-foreground tracking-tight">Debug Logging</h3>
        <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
          Capture detailed logs to help diagnose issues
        </p>
      </div>

      {/* Debug Toggle */}
      <div className="rounded-xl border border-border/60 dark:border-border-subtle bg-card dark:bg-surface-2 divide-y divide-border/40 dark:divide-border-subtle">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-medium text-foreground">Debug mode</p>
                <div
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    debugEnabled ? "bg-success" : "bg-muted-foreground/30"
                  }`}
                />
              </div>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                {debugEnabled
                  ? "Logging audio processing, API requests, and system operations"
                  : "Enable to capture detailed diagnostic information"}
              </p>
            </div>
            <div className="shrink-0">
              <Toggle
                checked={debugEnabled}
                onChange={handleToggleDebug}
                disabled={isLoading || isToggling}
              />
            </div>
          </div>
        </div>

        {/* Log Path — only when active */}
        {debugEnabled && logPath && (
          <div className="px-5 py-4">
            <p className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
              Current log file
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-muted-foreground font-mono break-all leading-relaxed bg-muted/30 dark:bg-surface-raised/30 px-3 py-2 rounded-lg border border-border/30">
                {logPath}
              </code>
              <Button
                onClick={handleCopyPath}
                variant="ghost"
                size="sm"
                className="shrink-0 h-8 w-8 p-0"
              >
                {copiedPath ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {debugEnabled && (
          <div className="px-5 py-4">
            <Button onClick={handleOpenLogsFolder} variant="outline" size="sm" className="w-full">
              <FolderOpen className="mr-2 h-3.5 w-3.5" />
              Open Logs Folder
            </Button>
          </div>
        )}
      </div>

      {/* What gets logged */}
      <div>
        <div className="mb-5">
          <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
            What gets logged
          </h3>
        </div>
        <div className="rounded-xl border border-border/60 dark:border-border-subtle bg-card dark:bg-surface-2">
          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {[
                "Audio processing",
                "API requests",
                "FFmpeg operations",
                "System diagnostics",
                "Transcription pipeline",
                "Error details",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="h-1 w-1 rounded-full bg-muted-foreground/30 shrink-0" />
                  <span className="text-[12px] text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Performance note — conditional */}
      {debugEnabled && (
        <div className="rounded-xl border border-warning/20 bg-warning/5 dark:bg-warning/10">
          <div className="px-5 py-4">
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-warning">Note</span> — Debug logging writes to disk
              continuously and may slightly affect performance. Disable when not troubleshooting.
            </p>
          </div>
        </div>
      )}

      {/* Sharing instructions — conditional */}
      {debugEnabled && (
        <div>
          <div className="mb-5">
            <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
              Sharing logs for support
            </h3>
          </div>
          <div className="rounded-xl border border-border/60 dark:border-border-subtle bg-card dark:bg-surface-2">
            <div className="px-5 py-4">
              <div className="space-y-2">
                {[
                  "Reproduce the issue while debug mode is enabled",
                  'Click "Open Logs Folder" above',
                  "Attach the most recent log file to your bug report",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="shrink-0 text-[11px] font-mono text-muted-foreground/40 mt-0.5 w-4 text-right">
                      {i + 1}
                    </span>
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/40 mt-4 pt-3 border-t border-border/20">
                Logs do not contain API keys or sensitive data
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
