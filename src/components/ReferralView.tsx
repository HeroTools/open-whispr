import { useState, useCallback, useEffect, useRef } from "react";
import { Gift, Copy, Check, Send, Users, Trophy, Clock, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { cn } from "./lib/utils";
import { useReferrals } from "../hooks/useReferrals";
import { useAuth } from "../hooks/useAuth";

function AnimatedCounter({ value, delay = 0 }: { value: number; delay?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    if (start === end) {
      setDisplay(end);
      return;
    }

    const timeout = setTimeout(() => {
      const duration = 600;
      const startTime = performance.now();
      let raf: number;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setDisplay(Math.round(start + (end - start) * eased));
        if (t < 1) raf = requestAnimationFrame(step);
      };

      raf = requestAnimationFrame(step);
      prevRef.current = end;

      return () => cancelAnimationFrame(raf);
    }, delay);

    return () => clearTimeout(timeout);
  }, [value, delay]);

  return <>{display}</>;
}

function StatTile({
  icon: Icon,
  label,
  value,
  colorClass,
  index,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  colorClass: string;
  index: number;
}) {
  return (
    <div
      className="rounded-lg border border-foreground/6 dark:border-white/5 bg-surface-1/30 dark:bg-white/[0.02] p-3 text-center"
      style={{ animation: `fade-in-up 0.4s ease-out ${index * 0.08}s backwards` }}
    >
      <Icon size={13} className={cn("mx-auto mb-1.5", colorClass)} />
      <p className="text-[16px] font-semibold tabular-nums text-foreground/80">
        <AnimatedCounter value={value} delay={200 + index * 100} />
      </p>
      <p className="text-[9px] text-foreground/25 mt-0.5">{label}</p>
    </div>
  );
}

function CopyButton({
  text,
  label,
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all duration-200",
        copied
          ? "bg-success/10 text-success border border-success/15"
          : "bg-foreground/[0.04] dark:bg-white/5 text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.07] dark:hover:bg-white/8 border border-foreground/6 dark:border-white/6",
        className
      )}
    >
      {copied ? (
        <>
          <Check size={10} style={{ animation: "check-pop 0.3s ease-out" }} />
          {label && "Copied"}
        </>
      ) : (
        <>
          <Copy size={10} />
          {label}
        </>
      )}
    </button>
  );
}

export default function ReferralView() {
  const { isSignedIn } = useAuth();
  const referrals = useReferrals();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleSendInvite = useCallback(async () => {
    if (!email.trim() || !referrals) return;
    setIsSending(true);
    setSendResult(null);
    const result = await referrals.sendInvite(email.trim());
    setSendResult(result);
    if (result.success) setEmail("");
    setIsSending(false);
  }, [email, referrals]);

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 -mt-4">
        <div
          className="w-10 h-10 rounded-[10px] bg-gradient-to-b from-foreground/5 to-foreground/[0.02] dark:from-white/8 dark:to-white/3 border border-foreground/8 dark:border-white/8 flex items-center justify-center mb-4"
          style={{ animation: "float-up 0.4s ease-out" }}
        >
          <Gift size={17} strokeWidth={1.5} className="text-foreground/25 dark:text-foreground/35" />
        </div>
        <p className="text-[13px] font-semibold text-foreground mb-1">Referrals</p>
        <p className="text-[11px] text-foreground/30 text-center leading-relaxed">
          Sign in to access your referral program
        </p>
      </div>
    );
  }

  if (referrals?.isLoading && !referrals?.hasLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={16} className="animate-spin text-foreground/20" />
      </div>
    );
  }

  if (!referrals) return null;

  const hasReferrals = referrals.totalReferrals > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 -mt-4">
      <div
        className="w-full max-w-[380px]"
        style={{ animation: "float-up 0.4s ease-out" }}
      >
        {!hasReferrals && (
          <div className="flex flex-col items-center mb-5">
            <div className="w-10 h-10 rounded-[10px] bg-gradient-to-b from-primary/8 to-primary/4 dark:from-primary/12 dark:to-primary/6 border border-primary/10 dark:border-primary/15 flex items-center justify-center mb-4">
              <Gift size={17} strokeWidth={1.5} className="text-primary/50 dark:text-primary/60" />
            </div>
            <h2 className="text-[13px] font-semibold text-foreground mb-1">
              Refer Friends, Earn Free Months
            </h2>
            <p className="text-[11px] text-foreground/30 text-center leading-relaxed max-w-[260px]">
              Share your code with friends. When they subscribe, you both win.
            </p>
          </div>
        )}

        {hasReferrals && (
          <div className="flex items-center gap-2 mb-4">
            <Gift size={14} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Referrals</h2>
          </div>
        )}

        <div className="relative rounded-lg overflow-hidden border border-foreground/8 dark:border-white/8 bg-surface-1/50 dark:bg-white/[0.03] backdrop-blur-sm">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-primary/40 via-accent/30 to-transparent" />

          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.03] dark:via-white/[0.04] to-transparent"
              style={{ animation: "shimmer-slide 4s ease-in-out infinite" }}
            />
          </div>

          <div className="relative p-4">
            <p className="text-[10px] text-foreground/30 uppercase tracking-widest mb-2">
              Your Referral Code
            </p>

            <div className="flex items-center gap-3 mb-3">
              <span className="text-[18px] font-mono font-bold tracking-[0.15em] text-foreground/80 dark:text-foreground/90">
                {referrals.referralCode || "--------"}
              </span>
              {referrals.referralCode && (
                <CopyButton text={referrals.referralCode} label="Copy" />
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-md bg-foreground/[0.02] dark:bg-white/[0.03] border border-foreground/5 dark:border-white/5">
                <p className="text-[10px] text-foreground/30 truncate font-mono">
                  {referrals.referralLink || "---"}
                </p>
              </div>
              {referrals.referralLink && (
                <CopyButton text={referrals.referralLink} className="shrink-0" />
              )}
            </div>
          </div>
        </div>

        {hasReferrals && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <StatTile
              icon={Users}
              label="Referred"
              value={referrals.totalReferrals}
              colorClass="text-primary/40"
              index={0}
            />
            <StatTile
              icon={Trophy}
              label="Completed"
              value={referrals.completedReferrals}
              colorClass="text-success/40"
              index={1}
            />
            <StatTile
              icon={Clock}
              label="Months Earned"
              value={referrals.totalMonthsEarned}
              colorClass="text-accent/40"
              index={2}
            />
          </div>
        )}

        <div className="mt-4">
          <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-2">
            Invite a Friend
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSendResult(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSendInvite()}
              className="flex-1 h-8 text-[11px]"
              disabled={isSending}
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleSendInvite}
              disabled={!email.trim() || isSending}
              className="h-8 text-[11px] px-3 gap-1.5 shrink-0"
            >
              {isSending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Send size={11} />
              )}
              Send
            </Button>
          </div>
          {sendResult && (
            <p
              className={cn(
                "text-[10px] mt-1.5",
                sendResult.success ? "text-success/60" : "text-destructive/60"
              )}
              style={{ animation: "fade-in-up 0.2s ease-out" }}
            >
              {sendResult.success ? "Invite sent successfully!" : sendResult.error}
            </p>
          )}
        </div>

        {referrals.referrals.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] text-foreground/25 uppercase tracking-widest mb-2">
              Recent Referrals
            </p>
            <div className="space-y-1 max-h-[140px] overflow-y-auto">
              {referrals.referrals.slice(0, 10).map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-surface-1/30 dark:bg-white/[0.02] border border-foreground/4 dark:border-white/4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-foreground/50 truncate">
                      {ref.name || ref.email}
                    </p>
                    {ref.name && (
                      <p className="text-[9px] text-foreground/20 truncate">{ref.email}</p>
                    )}
                  </div>
                  <Badge
                    variant={ref.status === "pending" ? "warning" : "success"}
                    className="text-[9px] px-1.5 py-0 h-4 shrink-0 ml-2"
                  >
                    {ref.status === "rewarded"
                      ? "Earned"
                      : ref.status === "completed"
                        ? "Completed"
                        : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {referrals.error && (
          <p
            className="text-[10px] text-destructive/50 text-center mt-3"
            style={{ animation: "fade-in-up 0.2s ease-out" }}
          >
            {referrals.error}
          </p>
        )}
      </div>
    </div>
  );
}
