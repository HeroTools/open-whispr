import React, { useState } from "react";
import {
  Home,
  NotebookPen,
  BookOpen,
  Upload,
  Settings,
  HelpCircle,
  UserCircle,
  Power,
  Gift,
} from "lucide-react";
import { cn } from "./lib/utils";
import SupportDropdown from "./ui/SupportDropdown";
import WindowControls from "./WindowControls";
import { ConfirmDialog } from "./ui/dialog";

export type ControlPanelView = "home" | "personal-notes" | "dictionary" | "upload";

interface ControlPanelSidebarProps {
  activeView: ControlPanelView;
  onViewChange: (view: ControlPanelView) => void;
  onOpenSettings: () => void;
  onOpenReferrals?: () => void;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  isSignedIn?: boolean;
  updateAction?: React.ReactNode;
}

const platform =
  typeof window !== "undefined" && window.electronAPI?.getPlatform
    ? window.electronAPI.getPlatform()
    : "darwin";

const navItems: {
  id: ControlPanelView;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "personal-notes", label: "Notes", icon: NotebookPen },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "dictionary", label: "Dictionary", icon: BookOpen },
];

export default function ControlPanelSidebar({
  activeView,
  onViewChange,
  onOpenSettings,
  onOpenReferrals,
  userName,
  userEmail,
  userImage,
  isSignedIn,
  updateAction,
}: ControlPanelSidebarProps) {
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  const handleQuit = async () => {
    try {
      await window.electronAPI?.appQuit?.();
    } catch {
      // noop
    }
  };

  return (
    <div className="w-48 shrink-0 border-r border-border/15 dark:border-white/5 flex flex-col bg-surface-1/60 dark:bg-surface-0/40">
      <ConfirmDialog
        open={showQuitConfirm}
        onOpenChange={setShowQuitConfirm}
        title="Quit OpenWhispr?"
        description="This will close OpenWhispr and stop background processes."
        confirmText="Quit"
        cancelText="Cancel"
        onConfirm={handleQuit}
        variant="destructive"
      />

      {platform === "darwin" ? (
        <div
          className="w-full h-10 shrink-0"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />
      ) : (
        <div
          className="flex items-center justify-between px-2 h-10 shrink-0"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        >
          <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <WindowControls />
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-0.5 px-2 pt-4 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "group relative flex items-center gap-2.5 w-full h-8 px-2.5 rounded-md outline-none transition-all duration-150 text-left",
                isActive
                  ? "bg-primary/8 dark:bg-primary/10"
                  : "hover:bg-foreground/4 dark:hover:bg-white/4 active:bg-foreground/6"
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3.5 rounded-r-full bg-primary" />
              )}
              <Icon
                size={15}
                className={cn(
                  "shrink-0 transition-colors duration-150",
                  isActive ? "text-primary" : "text-foreground/25 group-hover:text-foreground/40"
                )}
              />
              <span
                className={cn(
                  "text-[12px] transition-colors duration-150",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-foreground/50 group-hover:text-foreground/70"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="px-2 pb-2 space-y-0.5">
        {updateAction && (
          <div className="px-1 pb-1" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            {updateAction}
          </div>
        )}

        {isSignedIn && onOpenReferrals && (
          <button
            onClick={onOpenReferrals}
            className="group flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-all duration-200 bg-success/[0.04] dark:bg-success/[0.06] border border-success/[0.08] dark:border-success/[0.10] hover:bg-success/[0.07] dark:hover:bg-success/[0.10] hover:border-success/[0.14] dark:hover:border-success/[0.16]"
          >
            <div className="flex items-center justify-center h-5 w-5 rounded bg-success/10 dark:bg-success/15 shrink-0">
              <Gift size={11} className="text-success" />
            </div>
            <span className="text-[11px] text-success/70 dark:text-success/60 group-hover:text-success/90 dark:group-hover:text-success/80 font-medium transition-colors duration-150">
              Get 1 month free
            </span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          className="group flex items-center gap-2.5 w-full h-8 px-2.5 rounded-md text-left hover:bg-foreground/4 dark:hover:bg-white/4 transition-all duration-150"
        >
          <Settings
            size={15}
            className="shrink-0 text-foreground/20 group-hover:text-foreground/40 transition-colors duration-150"
          />
          <span className="text-[12px] text-foreground/40 group-hover:text-foreground/60 transition-colors duration-150">
            Settings
          </span>
        </button>

        <SupportDropdown
          trigger={
            <button className="group flex items-center gap-2.5 w-full h-8 px-2.5 rounded-md text-left hover:bg-foreground/4 dark:hover:bg-white/4 transition-all duration-150">
              <HelpCircle
                size={15}
                className="shrink-0 text-foreground/20 group-hover:text-foreground/40 transition-colors duration-150"
              />
              <span className="text-[12px] text-foreground/40 group-hover:text-foreground/60 transition-colors duration-150">
                Support
              </span>
            </button>
          }
        />

        <button
          onClick={() => setShowQuitConfirm(true)}
          className="group flex items-center gap-2.5 w-full h-8 px-2.5 rounded-md text-left hover:bg-destructive/5 dark:hover:bg-destructive/8 transition-all duration-150"
        >
          <Power
            size={15}
            className="shrink-0 text-foreground/20 group-hover:text-destructive/60 transition-colors duration-150"
          />
          <span className="text-[12px] text-foreground/40 group-hover:text-destructive/60 transition-colors duration-150">
            Quit
          </span>
        </button>

        <div className="mx-1 h-px bg-border/10 dark:bg-white/4 my-1.5!" />

        <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md">
          {userImage ? (
            <img src={userImage} alt="" className="w-6 h-6 rounded-full shrink-0 object-cover" />
          ) : (
            <UserCircle size={18} className="shrink-0 text-foreground/15" />
          )}
          <div className="flex-1 min-w-0">
            {isSignedIn && (userName || userEmail) ? (
              <>
                <p className="text-[11px] text-foreground/60 truncate leading-tight">
                  {userName || "User"}
                </p>
                {userEmail && (
                  <p className="text-[9px] text-foreground/25 truncate leading-tight">
                    {userEmail}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[11px] text-foreground/30">Not signed in</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
