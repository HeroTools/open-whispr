import { useEffect, useRef } from "react";
import { useUsage } from "../hooks/useUsage";
import { useToast } from "./ui/Toast";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";

export default function UsageDisplay() {
  const usage = useUsage();
  const { toast } = useToast();
  const hasShownApproachingToast = useRef(false);

  // One-time toast when approaching limit (>80%)
  useEffect(() => {
    if (usage?.isApproachingLimit && !hasShownApproachingToast.current) {
      hasShownApproachingToast.current = true;
      toast({
        title: "Approaching Weekly Limit",
        description: `You've used ${usage.wordsUsed.toLocaleString()} of ${usage.limit.toLocaleString()} free words this week.`,
        duration: 6000,
      });
    }
  }, [usage?.isApproachingLimit, usage?.wordsUsed, usage?.limit, toast]);

  if (!usage) return null;

  // Pro plan or trial — minimal display
  if (usage.isSubscribed) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-700">Your Plan</span>
          {usage.isTrial ? (
            <Badge variant="outline" className="text-indigo-600 border-indigo-300">
              Trial ({usage.trialDaysLeft} {usage.trialDaysLeft === 1 ? "day" : "days"} left)
            </Badge>
          ) : (
            <Badge variant="success">Pro</Badge>
          )}
        </div>
        <p className="text-sm text-neutral-600">
          {usage.isTrial
            ? "Unlimited transcriptions during your trial"
            : "Unlimited transcriptions"}
        </p>
        {!usage.isTrial && (
          <Button variant="outline" size="sm" onClick={() => usage.openBillingPortal()}>
            Manage Subscription
          </Button>
        )}
      </div>
    );
  }

  // Free plan
  const percentage = usage.limit > 0 ? Math.min(100, (usage.wordsUsed / usage.limit) * 100) : 0;
  const progressColor =
    percentage >= 100
      ? "[&>div]:bg-red-500"
      : percentage >= 80
        ? "[&>div]:bg-amber-500"
        : "[&>div]:bg-indigo-600";

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-neutral-700">Weekly Usage</span>
        {usage.isOverLimit ? (
          <Badge variant="warning">Limit reached</Badge>
        ) : (
          <Badge variant="outline">Free</Badge>
        )}
      </div>

      <div className="space-y-1.5">
        <Progress
          value={percentage}
          className={`h-2 transition-colors duration-500 ${progressColor}`}
        />
        <div className="flex items-center justify-between">
          <span className="text-sm tabular-nums text-neutral-600">
            {usage.wordsUsed.toLocaleString()} / {usage.limit.toLocaleString()}
          </span>
          {usage.isApproachingLimit && (
            <span className="text-xs text-amber-600">
              {usage.wordsRemaining.toLocaleString()} words remaining
            </span>
          )}
          {!usage.isApproachingLimit && !usage.isOverLimit && (
            <span className="text-xs text-neutral-400">Rolling weekly limit</span>
          )}
        </div>
      </div>

      {usage.isOverLimit ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={() => usage.openCheckout()}
          >
            Upgrade to Pro
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              localStorage.setItem("cloudTranscriptionMode", "byok");
              window.location.reload();
            }}
          >
            Use Your Own Key
          </Button>
        </div>
      ) : usage.isApproachingLimit ? (
        <Button
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700"
          onClick={() => usage.openCheckout()}
        >
          Upgrade to Pro
        </Button>
      ) : (
        <a
          href="#"
          className="text-indigo-600 hover:text-indigo-700 text-sm inline-block"
          onClick={(e) => {
            e.preventDefault();
            usage.openCheckout();
          }}
        >
          Upgrade to Pro — unlimited transcriptions
        </a>
      )}
    </div>
  );
}
