import React, { useEffect, useState, useCallback } from "react";
import {
  Copy,
  Check,
  Gift,
  Send,
  Mail,
  Users,
  Calendar,
  Sparkles,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { useToast } from "./ui/Toast";

interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalMonthsEarned: number;
  referrals: Array<{
    id: string;
    email: string;
    name: string;
    status: string;
    created_at: string;
    first_payment_at: string | null;
  }>;
}

interface ReferralInvite {
  id: string;
  recipientEmail: string;
  status: "sent" | "opened" | "converted" | "failed";
  sentAt: string;
  openedAt?: string;
  convertedAt?: string;
}

// Premium gift card preview component
function GiftCardPreview({ userName }: { userName: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Gradient accent glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-2xl" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-full blur-xl" />

      {/* Content */}
      <div className="relative z-10 space-y-3">
        {/* Pro badge */}
        <div className="flex items-center gap-2">
          <Badge className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-0 text-[10px] font-semibold tracking-wide px-2 py-0.5">
            <Sparkles className="w-3 h-3 mr-1" />
            OpenWhispr Pro
          </Badge>
        </div>

        {/* Main value proposition */}
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-white tracking-tight">1 MONTH FREE</h3>
          <p className="text-xs text-slate-400">Unlimited transcriptions included</p>
        </div>

        {/* Gifted by pill */}
        <div className="pt-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/5 text-xs text-slate-300">
            <Gift className="w-3 h-3 text-emerald-400" />
            Gifted by {userName || "You"}
          </span>
        </div>
      </div>
    </div>
  );
}

// How it works step component
function HowItWorksStep({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 dark:bg-primary/15 flex items-center justify-center">
        <span className="text-xs font-semibold text-primary">{step}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 dark:bg-surface-1/50 border border-border/30 dark:border-border-subtle/30">
      <div
        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
          highlight
            ? "bg-success/10 dark:bg-success/15"
            : "bg-muted/50 dark:bg-surface-raised/50"
        }`}
      >
        <Icon className={`w-4 h-4 ${highlight ? "text-success" : "text-muted-foreground"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className={`text-lg font-bold tabular-nums ${highlight ? "text-success" : "text-foreground"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

// Invite list item component
function InviteListItem({ invite }: { invite: ReferralInvite }) {
  const getStatusBadge = () => {
    switch (invite.status) {
      case "converted":
        return <Badge variant="success">Converted</Badge>;
      case "opened":
        return <Badge variant="info">Opened</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "sent":
      default:
        return <Badge variant="outline">Sent</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  };

  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20 dark:bg-surface-1/30 border border-border/20 dark:border-border-subtle/20 hover:border-border/40 dark:hover:border-border-subtle/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/50 dark:bg-surface-raised/50 flex items-center justify-center">
          <Mail className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground truncate">{invite.recipientEmail}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(invite.sentAt)}
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 ml-3">{getStatusBadge()}</div>
    </div>
  );
}

// Empty state component
function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/30 dark:bg-surface-1/50 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-muted-foreground/60" />
      </div>
      <h4 className="text-[13px] font-medium text-foreground mb-1">{title}</h4>
      <p className="text-[11px] text-muted-foreground max-w-[200px]">{description}</p>
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
  const [activeTab, setActiveTab] = useState("refer");
  const { toast } = useToast();

  // Get user's name from localStorage for the gift card preview
  const userName = localStorage.getItem("userName") || localStorage.getItem("agentName") || "";

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

    // Basic email validation
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
        // Refresh invites list
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
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary border-r-transparent" />
          <p className="mt-3 text-[12px] text-muted-foreground">Loading referral stats...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="py-8">
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-[13px] text-destructive">{error || "Unable to load referral stats"}</p>
          <Button onClick={fetchStats} variant="outline" className="mt-3" size="sm">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="refer" className="flex-1">
            <Gift className="w-4 h-4 mr-1.5" />
            Refer
          </TabsTrigger>
          <TabsTrigger value="past-invites" className="flex-1">
            <Mail className="w-4 h-4 mr-1.5" />
            Past Invites
          </TabsTrigger>
        </TabsList>

        {/* Refer Tab */}
        <TabsContent value="refer" className="space-y-4 mt-4">
          {/* Gift Card Preview */}
          <GiftCardPreview userName={userName} />

          {/* How it Works */}
          <div className="space-y-2.5">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              How it works
            </h4>
            <div className="space-y-2">
              <HowItWorksStep
                step={1}
                title="Share your link"
                description="Send your unique link to friends"
              />
              <HowItWorksStep
                step={2}
                title="They sign up free"
                description="Friends get 1 month of Pro free"
              />
              <HowItWorksStep
                step={3}
                title="You earn rewards"
                description="Get 1 free month when they subscribe"
              />
            </div>
          </div>

          {/* Your Invite Link */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Your invite link
            </h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted/50 dark:bg-surface-1/50 px-3 py-2 rounded-md border border-border/30 dark:border-border-subtle/30">
                <p className="text-[12px] font-mono text-foreground truncate">{stats.referralLink}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={copyLink}
                className="flex-shrink-0"
                disabled={copied}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Send Invites */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Send invites
            </h4>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="friend@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={sendingInvite}
                className="flex-1"
              />
              <Button
                onClick={sendInvite}
                size="sm"
                disabled={sendingInvite || !emailInput.trim()}
                className="flex-shrink-0"
              >
                {sendingInvite ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Total Referrals" value={stats.totalReferrals} icon={Users} />
            <StatCard label="Paid Subscribers" value={stats.completedReferrals} icon={ChevronRight} />
            <StatCard
              label="Free Months"
              value={stats.totalMonthsEarned}
              icon={Gift}
              highlight={stats.totalMonthsEarned > 0}
            />
          </div>

          {/* Rewards Note */}
          <div className="rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 px-3 py-2.5">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Unlimited rewards!</span>{" "}
              There&apos;s no cap on referrals. Keep sharing to earn more free months of Pro.
            </p>
          </div>
        </TabsContent>

        {/* Past Invites Tab */}
        <TabsContent value="past-invites" className="mt-4">
          {invites.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No invites sent yet"
              description="Send your first invite to see it here"
            />
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => (
                <InviteListItem key={invite.id} invite={invite} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
