import { Check, Terminal, Info } from "lucide-react";
import { Button } from "./button";
import type { PasteToolsResult } from "../../types/electron";

interface PasteToolsInfoProps {
  pasteToolsInfo: PasteToolsResult | null;
  isChecking: boolean;
  onCheck: () => void;
}

export default function PasteToolsInfo({
  pasteToolsInfo,
  isChecking,
  onCheck,
}: PasteToolsInfoProps) {
  if (!pasteToolsInfo) {
    return (
      <div className="border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-gray-900">Automatic Pasting</h3>
              <p className="text-sm text-gray-600">Checking system capabilities...</p>
            </div>
          </div>
          {isChecking && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
          )}
        </div>
      </div>
    );
  }

  // Windows - always ready
  if (pasteToolsInfo.platform === "win32") {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Automatic Pasting Ready</h3>
              <p className="text-sm text-green-700">
                Windows supports automatic pasting out of the box. No setup required!
              </p>
            </div>
          </div>
          <div className="text-green-600">
            <Check className="w-5 h-5" />
          </div>
        </div>
      </div>
    );
  }

  // Linux with tools available
  if (pasteToolsInfo.platform === "linux" && pasteToolsInfo.available) {
    const method = pasteToolsInfo.method || "xdotool";
    const methodSuffix =
      pasteToolsInfo.isWayland && method === "xdotool" ? " (XWayland apps only)." : ".";

    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="w-6 h-6 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Automatic Pasting Ready</h3>
              <p className="text-sm text-green-700">
                Using <code className="bg-green-100 px-1 rounded">{method}</code> for automatic text
                pasting{methodSuffix}
              </p>
            </div>
          </div>
          <div className="text-green-600">
            <Check className="w-5 h-5" />
          </div>
        </div>
      </div>
    );
  }

  // Linux without tools - show helpful install instructions
  if (pasteToolsInfo.platform === "linux" && !pasteToolsInfo.available) {
    const isWayland = pasteToolsInfo.isWayland;
    const xwaylandAvailable = pasteToolsInfo.xwaylandAvailable;
    const recommendedTool = pasteToolsInfo.recommendedInstall;
    const showInstall = !!recommendedTool;

    return (
      <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900">
              {showInstall ? "Optional: Enable Automatic Pasting" : "Clipboard Mode on Wayland"}
            </h3>

            {showInstall ? (
              <>
                <p className="text-sm text-amber-800 mt-1">
                  For automatic text pasting, install{" "}
                  <code className="bg-amber-100 px-1 rounded font-mono">{recommendedTool}</code>:
                </p>

                <div className="mt-3 bg-gray-900 text-gray-100 p-3 rounded-md font-mono text-xs overflow-x-auto">
                  {recommendedTool === "wtype" ? (
                    <>
                      <div className="text-gray-400"># Fedora / RHEL</div>
                      <div>sudo dnf install wtype</div>
                      <div className="text-gray-400 mt-2"># Debian / Ubuntu</div>
                      <div>sudo apt install wtype</div>
                      <div className="text-gray-400 mt-2"># Arch Linux</div>
                      <div>sudo pacman -S wtype</div>
                    </>
                  ) : (
                    <>
                      <div className="text-gray-400"># Debian / Ubuntu / Mint</div>
                      <div>sudo apt install xdotool</div>
                      <div className="text-gray-400 mt-2"># Fedora / RHEL</div>
                      <div>sudo dnf install xdotool</div>
                      <div className="text-gray-400 mt-2"># Arch Linux</div>
                      <div>sudo pacman -S xdotool</div>
                    </>
                  )}
                </div>

                {isWayland && recommendedTool === "wtype" && xwaylandAvailable && (
                  <p className="text-sm text-amber-700 mt-3">
                    Note: For XWayland apps, xdotool also works.
                  </p>
                )}

                {isWayland && recommendedTool !== "wtype" && (
                  <p className="text-sm text-amber-700 mt-3">
                    Note: automatic pasting works for XWayland apps only.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-amber-800 mt-1">
                Automatic pasting isn't available on this Wayland session. OpenWhispr will copy text
                to your clipboard so you can paste manually with{" "}
                <kbd className="bg-amber-100 px-1 rounded text-xs">Ctrl+V</kbd>.
              </p>
            )}

            {showInstall && (
              <p className="text-sm text-amber-700 mt-3">
                Without this tool, OpenWhispr will copy text to your clipboard. You can then paste
                manually with <kbd className="bg-amber-100 px-1 rounded text-xs">Ctrl+V</kbd>.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onCheck} disabled={isChecking}>
            {isChecking ? "Checking..." : "Re-check"}
          </Button>
        </div>
      </div>
    );
  }

  // Fallback for macOS (shouldn't normally render this component on macOS)
  return null;
}
