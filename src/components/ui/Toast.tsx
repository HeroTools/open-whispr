import * as React from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "../lib/utils";

export interface ToastProps {
  id?: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: "default" | "destructive" | "success";
  duration?: number;
  onClose?: () => void;
}

export interface ToastContextType {
  toast: (props: Omit<ToastProps, "id">) => void;
  dismiss: (id?: string) => void;
  toastCount: number;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastState extends ToastProps {
  id: string;
  isExiting?: boolean;
  createdAt: number;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = React.useState<ToastState[]>([]);
  const timersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const clearTimer = React.useCallback((id: string) => {
    const timer = timersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[id];
    }
  }, []);

  const startExitAnimation = React.useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t)));
    // Remove after exit animation completes
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const toast = React.useCallback(
    (props: Omit<ToastProps, "id">) => {
      const id = Math.random().toString(36).substring(2, 11);
      const newToast: ToastState = { ...props, id, createdAt: Date.now() };

      setToasts((prev) => [...prev, newToast]);

      const duration = props.duration ?? 3500;
      if (duration > 0) {
        const timer = setTimeout(() => {
          startExitAnimation(id);
        }, duration);
        timersRef.current[id] = timer;
      }

      return id;
    },
    [startExitAnimation]
  );

  const dismiss = React.useCallback(
    (id?: string) => {
      if (id) {
        clearTimer(id);
        startExitAnimation(id);
      } else {
        const lastToast = toasts[toasts.length - 1];
        if (lastToast) {
          clearTimer(lastToast.id);
          startExitAnimation(lastToast.id);
        }
      }
    },
    [toasts, clearTimer, startExitAnimation]
  );

  const pauseTimer = React.useCallback(
    (id: string) => {
      clearTimer(id);
    },
    [clearTimer]
  );

  const resumeTimer = React.useCallback(
    (id: string, remainingTime: number) => {
      if (remainingTime > 0) {
        const timer = setTimeout(() => {
          startExitAnimation(id);
        }, remainingTime);
        timersRef.current[id] = timer;
      }
    },
    [startExitAnimation]
  );

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      const timers = timersRef.current;
      for (const id in timers) {
        clearTimeout(timers[id]);
      }
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss, toastCount: toasts.length }}>
      {children}
      <ToastViewport
        toasts={toasts}
        onDismiss={dismiss}
        onPauseTimer={pauseTimer}
        onResumeTimer={resumeTimer}
      />
    </ToastContext.Provider>
  );
};

const ToastViewport: React.FC<{
  toasts: ToastState[];
  onDismiss: (id: string) => void;
  onPauseTimer: (id: string) => void;
  onResumeTimer: (id: string, remainingTime: number) => void;
}> = ({ toasts, onDismiss, onPauseTimer, onResumeTimer }) => {
  // Detect if we're in the dictation panel (minimal overlay with mic button)
  const isDictationPanel = React.useMemo(() => {
    return (
      window.location.pathname.indexOf("control") === -1 &&
      window.location.search.indexOf("panel=true") === -1
    );
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col gap-1.5 pointer-events-none",
        isDictationPanel
          ? "bottom-20 right-6" // Above mic button in dictation panel
          : "bottom-5 right-5" // Standard position in control panel
      )}
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={() => onDismiss(toast.id)}
          onPauseTimer={() => onPauseTimer(toast.id)}
          onResumeTimer={(remaining) => onResumeTimer(toast.id, remaining)}
        />
      ))}
    </div>
  );
};

const variantConfig = {
  default: {
    icon: Info,
    containerClass: cn(
      // Glass morphism base
      "bg-card/90 dark:bg-surface-2/95",
      "border border-border/60 dark:border-white/10",
      // Metallic highlight
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_4px_12px_-2px_rgba(0,0,0,0.15),0_2px_4px_-1px_rgba(0,0,0,0.1)]",
      "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_8px_24px_-4px_rgba(0,0,0,0.4),0_2px_8px_-2px_rgba(0,0,0,0.3)]"
    ),
    iconClass: "text-muted-foreground",
    titleClass: "text-card-foreground",
    descClass: "text-muted-foreground",
    progressClass: "bg-muted-foreground/30",
  },
  destructive: {
    icon: AlertCircle,
    containerClass: cn(
      // Subtle red tint with glass
      "bg-destructive/8 dark:bg-destructive/12",
      "border border-destructive/20 dark:border-destructive/25",
      // Colored glow
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_4px_12px_-2px_rgba(220,38,38,0.15),0_2px_4px_-1px_rgba(0,0,0,0.1)]",
      "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_8px_24px_-4px_rgba(220,38,38,0.25),0_2px_8px_-2px_rgba(0,0,0,0.3)]"
    ),
    iconClass: "text-destructive",
    titleClass: "text-destructive dark:text-red-400",
    descClass: "text-destructive/80 dark:text-red-400/80",
    progressClass: "bg-destructive/40",
  },
  success: {
    icon: CheckCircle2,
    containerClass: cn(
      // Subtle green tint with glass
      "bg-success/8 dark:bg-success/12",
      "border border-success/20 dark:border-success/25",
      // Colored glow
      "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_4px_12px_-2px_rgba(22,163,74,0.15),0_2px_4px_-1px_rgba(0,0,0,0.1)]",
      "dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_8px_24px_-4px_rgba(22,163,74,0.25),0_2px_8px_-2px_rgba(0,0,0,0.3)]"
    ),
    iconClass: "text-success",
    titleClass: "text-success dark:text-emerald-400",
    descClass: "text-success/80 dark:text-emerald-400/80",
    progressClass: "bg-success/40",
  },
};

const Toast: React.FC<
  ToastState & {
    onClose?: () => void;
    onPauseTimer: () => void;
    onResumeTimer: (remaining: number) => void;
  }
> = ({
  title,
  description,
  action,
  variant = "default",
  duration = 3500,
  isExiting,
  createdAt,
  onClose,
  onPauseTimer,
  onResumeTimer,
}) => {
  const config = variantConfig[variant];
  const Icon = config.icon;
  const pausedAtRef = React.useRef<number | null>(null);

  const handleMouseEnter = () => {
    pausedAtRef.current = Date.now();
    onPauseTimer();
  };

  const handleMouseLeave = () => {
    if (pausedAtRef.current && duration > 0) {
      const elapsed = pausedAtRef.current - createdAt;
      const remaining = Math.max(duration - elapsed, 500);
      onResumeTimer(remaining);
    }
    pausedAtRef.current = null;
  };

  return (
    <div
      className={cn(
        // Layout
        "pointer-events-auto relative flex items-start gap-2.5 w-[320px]",
        "px-3 py-2.5 pr-8 overflow-hidden",
        // Tight radius matching buttons
        "rounded-[6px]",
        // Glass blur
        "backdrop-blur-xl",
        // Animation states
        "transition-all duration-200 ease-out",
        isExiting
          ? "opacity-0 translate-x-2 scale-[0.98]"
          : "opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-4 fade-in-0 duration-300",
        // Variant styling
        config.containerClass
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Status Icon */}
      <Icon className={cn("size-4 shrink-0 mt-0.5", config.iconClass)} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <div className={cn("text-[13px] font-medium leading-tight", config.titleClass)}>
            {title}
          </div>
        )}
        {description && (
          <div className={cn("text-[12px] leading-snug mt-0.5", config.descClass)}>
            {description}
          </div>
        )}
      </div>

      {/* Action slot */}
      {action && <div className="shrink-0 self-center">{action}</div>}

      {/* Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className={cn(
            "absolute right-1.5 top-1.5 p-1 rounded-[4px]",
            "opacity-50 hover:opacity-100",
            "hover:bg-foreground/5 dark:hover:bg-white/10",
            "transition-all duration-150",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring/40",
            config.iconClass
          )}
        >
          <X className="size-3.5" />
          <span className="sr-only">Close</span>
        </button>
      )}

      {/* Progress indicator - subtle bottom bar */}
      {duration > 0 && !isExiting && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
          <div
            className={cn("h-full", config.progressClass)}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
};

// Helper function for common toast patterns
export const toast = {
  success: (message: string) => ({
    title: "Success",
    description: message,
    variant: "success" as const,
  }),
  error: (message: string) => ({
    title: "Error",
    description: message,
    variant: "destructive" as const,
  }),
  info: (message: string) => ({
    description: message,
    variant: "default" as const,
  }),
};
