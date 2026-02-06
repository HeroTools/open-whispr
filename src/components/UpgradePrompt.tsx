import { Dialog, DialogContent } from "./ui/dialog";
import { ChevronRight } from "lucide-react";
import { useUsage } from "../hooks/useUsage";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wordsUsed?: number;
  limit?: number;
}

export default function UpgradePrompt({
  open,
  onOpenChange,
  wordsUsed = 2000,
  limit = 2000,
}: UpgradePromptProps) {
  const usage = useUsage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <div className="text-center space-y-2 pt-2">
          <h2 className="text-xl font-semibold text-neutral-900">
            You've reached your weekly limit
          </h2>
          <p className="text-sm text-neutral-500">
            {wordsUsed.toLocaleString()} of {limit.toLocaleString()} words used.
            <br />
            Your transcription was saved and pasted.
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <OptionCard
            title="Upgrade to Pro"
            description="Unlimited transcriptions. $9/month."
            onClick={() => {
              usage?.openCheckout();
            }}
            highlighted
          />
          <OptionCard
            title="Use your own API key"
            description="Bring your own key for unlimited use."
            onClick={() => {
              localStorage.setItem("cloudTranscriptionMode", "byok");
              onOpenChange(false);
            }}
          />
          <OptionCard
            title="Switch to local"
            description="Offline transcription. No limits."
            onClick={() => {
              localStorage.setItem("useLocalWhisper", "true");
              onOpenChange(false);
            }}
          />
        </div>

        <p className="text-xs text-neutral-400 text-center">Rolling weekly limit</p>
      </DialogContent>
    </Dialog>
  );
}

function OptionCard({
  title,
  description,
  onClick,
  highlighted = false,
}: {
  title: string;
  description: string;
  onClick: () => void;
  highlighted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-shadow duration-150 hover:shadow-md flex items-center justify-between ${
        highlighted
          ? "bg-gradient-to-r from-indigo-50 to-purple-50/50 border-indigo-200"
          : "bg-neutral-50 border-neutral-200 hover:border-neutral-300"
      }`}
    >
      <div>
        <div className="font-medium text-neutral-900">{title}</div>
        <div className="text-sm text-neutral-500">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-neutral-400 flex-shrink-0" />
    </button>
  );
}
