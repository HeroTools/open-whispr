import { Button } from "./button";
import { Check, LucideIcon, Settings } from "lucide-react";
import { cn } from "../lib/utils";

interface PermissionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  granted: boolean;
  onRequest: () => void;
  buttonText?: string;
  onOpenSettings?: () => void;
}

export default function PermissionCard({
  icon: Icon,
  title,
  description,
  granted,
  onRequest,
  buttonText = "Grant Access",
  onOpenSettings,
}: PermissionCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-lg p-2.5 transition-all duration-150",
        "border",
        granted
          ? "bg-success/5 border-success/15 dark:bg-success/8 dark:border-success/20"
          : "bg-surface-1 border-border-subtle hover:bg-surface-2 hover:border-border-hover"
      )}
    >
      <div className="flex items-center gap-2.5">
        {/* Icon container */}
        <div
          className={cn(
            "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors",
            granted ? "bg-success/10" : "bg-primary/8 dark:bg-primary/10"
          )}
        >
          {granted ? (
            <Check className="w-3.5 h-3.5 text-success" strokeWidth={2.5} />
          ) : (
            <Icon className="w-3.5 h-3.5 text-primary" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[12px] font-medium text-foreground leading-tight">{title}</h3>
            {granted && (
              <span className="text-[9px] font-medium text-success/70 uppercase tracking-wider">
                Granted
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/80 leading-snug mt-0.5">{description}</p>
        </div>

        {/* Actions - only when not granted */}
        {!granted && (
          <div className="flex items-center gap-1 shrink-0">
            <Button onClick={onRequest} size="sm" className="h-6 px-2.5 text-[10px]">
              {buttonText}
            </Button>
            {onOpenSettings && (
              <Button onClick={onOpenSettings} size="sm" variant="outline" className="h-6 w-6 p-0">
                <Settings className="w-3 h-3 text-foreground" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
