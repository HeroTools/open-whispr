import React, { useEffect, useState, useCallback, useRef } from "react";
import { Send, Mail, Copy, Check, Link, UserPlus, Gift } from "lucide-react";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { useToast } from "./ui/Toast";
import { cn } from "./lib/utils";
import { SpectrogramCard } from "./referral-cards/SpectrogramCard";

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  completedReferrals: number;
  totalMonthsEarned: number;
}

interface ReferralInvite {
  id: string;
  recipientEmail: string;
  status: "sent" | "opened" | "converted" | "failed";
  sentAt: string;
  openedAt?: string;
  convertedAt?: string;
}

const statusConfig: Record<
  ReferralInvite["status"],
  { label: string; variant: "success" | "info" | "destructive" | "outline" }
> = {
  converted: { label: "Converted", variant: "success" },
  opened: { label: "Opened", variant: "info" },
  failed: { label: "Failed", variant: "destructive" },
  sent: { label: "Sent", variant: "outline" },
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
}

function AnimatedCounter({ value, delay = 0 }: { value: number; delay?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (value === 0) {
      setDisplay(0);
      return;
    }

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }

    const duration = 800;
    let start: number | null = null;

    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * value));
        if (progress < 1) rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [value, delay]);

  return <span className="tabular-nums">{display}</span>;
}

function TiltCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const nx = (e.clientX - centerX) / (rect.width / 2);
      const ny = (e.clientY - centerY) / (rect.height / 2);
      const tiltX = -ny * 4;
      const tiltY = nx * 4;
      const hx = ((e.clientX - rect.left) / rect.width) * 100;
      const hy = ((e.clientY - rect.top) / rect.height) * 100;

      card.style.setProperty("--tilt-x", `${tiltX}deg`);
      card.style.setProperty("--tilt-y", `${tiltY}deg`);
      card.style.setProperty("--highlight-x", `${hx}%`);
      card.style.setProperty("--highlight-y", `${hy}%`);
      card.style.setProperty("--highlight-opacity", "1");
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
    card.style.setProperty("--highlight-opacity", "0");
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={cn("tilt-card", className)}
    >
      {children}
    </div>
  );
}

function StatGauge({
  value,
  label,
  delay = 0,
  highlight = false,
}: {
  value: number;
  label: string;
  delay?: number;
  highlight?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay + 400);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "stat-gauge rounded-md px-3 py-2.5",
        "bg-foreground/3 border border-foreground/6",
        "backdrop-blur-sm"
      )}
      data-active={mounted && value > 0 ? "true" : "false"}
    >
      <div
        className={cn(
          "text-[18px] font-bold tabular-nums leading-none",
          highlight ? "text-success" : "text-foreground"
        )}
      >
        <AnimatedCounter value={value} delay={delay} />
      </div>
      <div className="text-[10px] text-foreground/30 mt-1 leading-tight">{label}</div>
    </div>
  );
}

export function ReferralDashboard() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const { toast } = useToast();

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.electronAPI?.getReferralStats?.();
      setStats(data ?? null);
    } catch (err) {
      console.error("Failed to fetch referral stats:", err);
      setError("Unable to load referral stats. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    try {
      const result = await window.electronAPI?.getReferralInvites?.();
      setInvites(result?.invites ?? []);
    } catch (err) {
      console.error("Failed to fetch referral invites:", err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchInvites();
  }, [fetchStats, fetchInvites]);

  const copyLink = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(stats.referralLink);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Referral link copied to clipboard",
        variant: "success",
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      toast({
        title: "Copy Failed",
        description: "Failed to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  const sendInvite = async () => {
    if (!emailInput.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingInvite(true);
      const result = await window.electronAPI?.sendReferralInvite?.(emailInput.trim());

      if (result?.success) {
        toast({
          title: "Invite Sent!",
          description: `Invitation sent to ${emailInput}`,
          variant: "success",
        });
        setEmailInput("");
        fetchInvites();
      } else {
        throw new Error("Failed to send invite");
      }
    } catch (err) {
      console.error("Failed to send invite:", err);
      toast({
        title: "Send Failed",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !sendingInvite) {
      sendInvite();
    }
  };

  if (loading) {
    return (
      <div className="bg-card px-7 pt-9 pb-6">
        <div className="h-5 w-36 rounded bg-foreground/4 animate-pulse" />
        <div className="h-3 w-44 rounded bg-foreground/3 animate-pulse mt-2" />
        <div className="h-16 rounded-lg bg-foreground/3 animate-pulse mt-5" />
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          <div className="h-14 rounded-md bg-foreground/3 animate-pulse" />
          <div className="h-14 rounded-md bg-foreground/3 animate-pulse" />
          <div className="h-14 rounded-md bg-foreground/3 animate-pulse" />
        </div>
        <div className="h-px bg-foreground/4 mt-5" />
        <div className="h-3 w-20 rounded bg-foreground/3 animate-pulse mt-5" />
        <div className="h-8 rounded-md bg-foreground/3 animate-pulse mt-2" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-85 bg-card text-center px-6">
        <p className="text-[13px] text-foreground/40 mb-3">
          {error || "Unable to load referral data"}
        </p>
        <button
          onClick={fetchStats}
          className="px-3.5 py-1.5 rounded-md text-[12px] font-medium bg-foreground/7 text-foreground/55 border border-foreground/5 hover:bg-foreground/12 hover:text-foreground/90 transition-all duration-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="relative bg-card">
      {/* Animated mesh gradient background */}
      <div className="referral-mesh-bg">
        <div
          className="absolute w-50 h-50 rounded-full blur-[80px] opacity-3"
          style={{
            background: "oklch(0.55 0.2 320)",
            top: "40%",
            left: "15%",
            animation: "mesh-drift 25s ease-in-out infinite alternate",
            animationDelay: "-8s",
          }}
        />
      </div>

      <div className="relative z-10 px-7 pt-7 pb-6">
        <h2 className="text-[20px] font-bold tracking-tight leading-tight text-foreground">
          Refer and earn rewards
        </h2>
        <p className="text-[12px] text-foreground/30 mt-1">Give a month. Get a month.</p>

        <Tabs defaultValue="refer" className="mt-4">
          <TabsList className="w-full justify-start bg-transparent! p-0! h-auto! gap-4 rounded-none! border-b border-foreground/6">
            <TabsTrigger
              value="refer"
              className="rounded-none! bg-transparent! shadow-none! px-0! pb-2! pt-0! text-[12px] border-b-2 border-transparent text-foreground/30 hover:text-foreground/50 data-[state=active]:bg-transparent! data-[state=active]:shadow-none! data-[state=active]:border-foreground/50 data-[state=active]:text-foreground"
            >
              Refer
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-none! bg-transparent! shadow-none! px-0! pb-2! pt-0! text-[12px] border-b-2 border-transparent text-foreground/30 hover:text-foreground/50 data-[state=active]:bg-transparent! data-[state=active]:shadow-none! data-[state=active]:border-foreground/50 data-[state=active]:text-foreground"
            >
              Past invites ({invites.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="refer" className="mt-5">
            <div className="space-y-5">
              <TiltCard>
                <SpectrogramCard referralCode={stats.referralCode} />
              </TiltCard>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded bg-foreground/4 flex items-center justify-center shrink-0">
                    <Link className="w-2.5 h-2.5 text-foreground/30" />
                  </div>
                  <span className="text-[11px] text-foreground/40">Share your invite link</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded bg-foreground/4 flex items-center justify-center shrink-0">
                    <UserPlus className="w-2.5 h-2.5 text-foreground/30" />
                  </div>
                  <span className="text-[11px] text-foreground/40">
                    They sign up and get a{" "}
                    <strong className="text-foreground/60">free month of Pro</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded bg-foreground/4 flex items-center justify-center shrink-0">
                    <Gift className="w-2.5 h-2.5 text-foreground/30" />
                  </div>
                  <span className="text-[11px] text-foreground/40">
                    You get a <strong className="text-foreground/60">free month</strong> when they
                    dictate 2,000 words
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-medium text-foreground/25 uppercase tracking-wider">
                  Your invite link
                </h4>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 h-8 px-3 rounded-md bg-foreground/4 border border-foreground/7 overflow-hidden">
                    <Link className="w-3 h-3 text-foreground/20 shrink-0" />
                    <span className="text-[12px] text-foreground/50 font-mono truncate select-all">
                      {stats.referralLink}
                    </span>
                  </div>
                  <button
                    onClick={copyLink}
                    className={cn(
                      "shrink-0 h-8 px-3.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 active:scale-[0.97]",
                      copied
                        ? "bg-emerald-500/15 text-emerald-400/80"
                        : "bg-foreground/7 text-foreground/55 border border-foreground/5 hover:bg-foreground/12 hover:text-foreground/90"
                    )}
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-[10px] font-medium text-foreground/25 uppercase tracking-wider">
                  Send invites
                </h4>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sendingInvite}
                    className="flex-1 h-8 px-3 text-[12px] rounded-md bg-foreground/4 border border-foreground/7 text-foreground/70 placeholder:text-foreground/20 focus:outline-none focus:border-foreground/15 focus:ring-1 focus:ring-foreground/10 disabled:opacity-50"
                  />
                  <button
                    onClick={sendInvite}
                    disabled={sendingInvite || !emailInput.trim()}
                    className="shrink-0 h-8 px-3.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 bg-foreground/7 text-foreground/55 border border-foreground/5 hover:bg-foreground/12 hover:text-foreground/90 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {sendingInvite ? (
                      <div className="w-3 h-3 border-1.5 border-current border-r-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    {sendingInvite ? "Sending" : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-5">
            <div className="grid grid-cols-3 gap-2.5">
              <StatGauge value={stats.totalReferrals} label="Referred" delay={0} />
              <StatGauge value={stats.completedReferrals} label="Converted" delay={150} />
              <StatGauge
                value={stats.totalMonthsEarned}
                label="Months earned"
                delay={300}
                highlight={stats.totalMonthsEarned > 0}
              />
            </div>

            {invites.length > 0 ? (
              <div className="space-y-1 mt-4">
                {invites.map((invite) => {
                  const { label, variant } = statusConfig[invite.status] ?? statusConfig.sent;
                  return (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between py-1.5 px-2.5 rounded-md bg-foreground/3 border border-foreground/5 hover:border-foreground/8 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Mail className="w-3 h-3 text-foreground/20 shrink-0" />
                        <span className="text-[11px] text-foreground/60 truncate">
                          {invite.recipientEmail}
                        </span>
                        <span className="text-[10px] text-foreground/15 shrink-0">
                          {formatDate(invite.sentAt)}
                        </span>
                      </div>
                      <Badge variant={variant} className="ml-2 text-[9px] shrink-0">
                        {label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="w-5 h-5 text-foreground/10 mb-2" />
                <p className="text-[12px] text-foreground/25">No invites sent yet</p>
                <p className="text-[10px] text-foreground/15 mt-0.5">
                  Share your link or send an invite to get started
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
