import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { FolderOpen, Info, Wrench, Copy, Check, AlertCircle, FileText } from "lucide-react";
import { useToast } from "./ui/Toast";

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
        title: "Error loading debug state",
        description: "Could not retrieve debug logging status",
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

      // Reload the state to get updated log path
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
        title: "Error",
        description: `Failed to toggle debug logging: ${error}`,
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
        title: "Error",
        description: `Failed to open logs folder: ${error}`,
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
        title: "Copy Failed",
        description: "Could not copy path to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Troubleshooting</h3>
        <p className="text-sm text-gray-600">
          Enable debug logging to diagnose issues and share logs for support
        </p>
      </div>

      {/* Main Debug Logging Card */}
      <div className="space-y-4 p-6 bg-linear-to-br from-slate-50 via-slate-50 to-slate-100 border border-slate-200 rounded-xl shadow-sm">
        {/* Header with status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-800 rounded-lg">
              <Wrench className="w-5 h-5 text-slate-100" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">Debug Logging</h4>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`w-2 h-2 rounded-full ${
                    debugEnabled
                      ? "bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50"
                      : "bg-slate-300"
                  }`}
                />
                <span className="text-xs font-medium text-slate-600">
                  {isLoading ? "Loading..." : debugEnabled ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600 leading-relaxed">
          Captures detailed logs of audio processing, transcription, and system operations. Enable
          this when experiencing issues to help diagnose problems.
        </p>

        {/* Log Path Display - Only when active */}
        {debugEnabled && logPath && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600 uppercase tracking-wide">
              Current Log File
            </label>
            <div className="flex gap-2">
              <div className="flex-1 p-3 bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <code className="text-xs text-emerald-400 break-all leading-relaxed">
                  {logPath}
                </code>
              </div>
              <Button
                onClick={handleCopyPath}
                variant="outline"
                size="icon"
                className="h-12 w-12 border-slate-300 hover:bg-slate-100"
                title="Copy log path"
              >
                {copiedPath ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4 text-slate-600" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleToggleDebug}
            disabled={isLoading || isToggling}
            className={`flex-1 font-medium ${
              debugEnabled
                ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/20"
                : "bg-slate-800 hover:bg-slate-900 text-white shadow-md shadow-slate-800/20"
            }`}
          >
            {isToggling ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                {debugEnabled ? "Disabling..." : "Enabling..."}
              </>
            ) : (
              <>{debugEnabled ? "Disable Debug Mode" : "Enable Debug Mode"}</>
            )}
          </Button>

          <Button
            onClick={handleOpenLogsFolder}
            variant="outline"
            disabled={!debugEnabled || isLoading}
            className={`flex-1 font-medium ${
              debugEnabled
                ? "border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                : "opacity-50 cursor-not-allowed"
            }`}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Open Logs Folder
          </Button>
        </div>
      </div>

      {/* Sharing Instructions - Only when enabled */}
      {debugEnabled && (
        <div className="p-5 bg-linear-to-br from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg mt-0.5">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-indigo-900 mb-2">How to Share Logs for Support</h4>
              <div className="text-sm text-indigo-800 space-y-2">
                <p>To help us diagnose your issue:</p>
                <ol className="space-y-1 ml-4 list-decimal">
                  <li>Reproduce the issue while debug mode is enabled</li>
                  <li>Click "Open Logs Folder" above</li>
                  <li>Find the most recent log file (sorted by date)</li>
                  <li>Attach the log file to your bug report or support email</li>
                </ol>
                <p className="text-xs text-indigo-700 mt-3 pt-3 border-t border-indigo-200">
                  Your logs don't contain API keys or sensitive data
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Cards */}
      <div className="grid grid-cols-1 gap-4">
        {/* What Gets Logged */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-blue-900 mb-2">What Gets Logged</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-600" />
                  <span>Audio processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-600" />
                  <span>API requests</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-600" />
                  <span>FFmpeg operations</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-600" />
                  <span>System diagnostics</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-600" />
                  <span>Transcription pipeline</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-blue-600" />
                  <span>Error details</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Note */}
        {debugEnabled && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-amber-900 mb-1">Performance Note</h4>
                <p className="text-sm text-amber-800">
                  Debug logging writes detailed information to disk and may have a minor impact on
                  app performance. Disable it when not troubleshooting.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
