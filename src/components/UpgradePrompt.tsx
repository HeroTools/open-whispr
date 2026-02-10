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
          <h2 className="text-xl font-semibold text-foreground">
            You've reached your weekly limit
          </h2>
          <p className="text-sm text-muted-foreground">
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
            disabled={usage?.checkoutLoading}
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

        <p className="text-xs text-muted-foreground/60 text-center">Rolling weekly limit</p>
      </DialogContent>
    </Dialog>
  );
}

function OptionCard({
  title,
  description,
  onClick,
  highlighted = false,
  disabled = false,
}: {
  title: string;
  description: string;
  onClick: () => void;
  highlighted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left p-4 rounded-lg border transition-shadow duration-150 hover:shadow-md flex items-center justify-between cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        highlighted
          ? "bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/15"
          : "bg-muted/50 dark:bg-surface-2 border-border dark:border-border-subtle hover:border-border-hover"
      }`}
    >
      <div>
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
    </button>
  );
}
