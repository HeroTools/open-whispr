export type ColorScheme = "purple" | "indigo" | "blue";

export interface ModelPickerStyles {
  container: string;
  header: string;
  modelCard: { selected: string; default: string };
  badges: { selected: string; downloaded: string; recommended: string };
  buttons: { download: string; select: string; delete: string; refresh: string };
}

export const MODEL_PICKER_COLORS: Record<ColorScheme, ModelPickerStyles> = {
  purple: {
    container:
      "bg-card border border-border rounded-xl overflow-hidden dark:bg-surface-1 shadow-sm",
    header: "font-medium text-foreground tracking-tight",
    modelCard: {
      selected:
        "border-primary/30 bg-primary/8 dark:bg-primary/6 dark:border-primary/20 shadow-[0_0_0_1px_oklch(0.62_0.22_260/0.12),0_0_10px_-3px_oklch(0.62_0.22_260/0.18)]",
      default:
        "border-border bg-surface-1 hover:border-border-hover hover:bg-muted dark:bg-card dark:border-border dark:hover:border-border-hover dark:hover:bg-surface-raised",
    },
    badges: {
      selected:
        "text-[10px] text-primary-foreground bg-primary px-1.5 py-0.5 rounded-sm font-medium",
      downloaded:
        "text-[10px] text-success dark:text-success bg-success/10 dark:bg-success/12 px-1.5 py-0.5 rounded-sm",
      recommended:
        "text-[10px] text-primary bg-primary/10 dark:bg-primary/12 px-1.5 py-0.5 rounded-sm font-medium",
    },
    buttons: {
      download: "",
      select: "border-primary/25 text-primary hover:bg-primary/8",
      delete:
        "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh: "border-primary/25 text-primary hover:bg-primary/8",
    },
  },
  indigo: {
    container:
      "bg-card border border-border rounded-xl overflow-hidden dark:bg-surface-1 shadow-sm",
    header: "font-medium text-foreground tracking-tight",
    modelCard: {
      selected:
        "border-primary/30 bg-primary/8 dark:bg-primary/6 dark:border-primary/20 shadow-[0_0_0_1px_oklch(0.62_0.22_260/0.12),0_0_10px_-3px_oklch(0.62_0.22_260/0.18)]",
      default:
        "border-border bg-surface-1 hover:border-border-hover hover:bg-muted dark:bg-card dark:border-border dark:hover:border-border-hover dark:hover:bg-surface-raised",
    },
    badges: {
      selected:
        "text-[10px] text-primary-foreground bg-primary px-1.5 py-0.5 rounded-sm font-medium",
      downloaded:
        "text-[10px] text-success dark:text-success bg-success/10 dark:bg-success/12 px-1.5 py-0.5 rounded-sm",
      recommended:
        "text-[10px] text-primary bg-primary/10 dark:bg-primary/12 px-1.5 py-0.5 rounded-sm font-medium",
    },
    buttons: {
      download: "",
      select: "border-primary/25 text-primary hover:bg-primary/8",
      delete:
        "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh: "border-primary/25 text-primary hover:bg-primary/8",
    },
  },
  blue: {
    container:
      "bg-surface-1 dark:bg-white/3 rounded-xl overflow-hidden border border-border dark:border-white/5 backdrop-blur-md shadow-sm",
    header: "text-sm font-medium text-foreground tracking-tight",
    modelCard: {
      selected:
        "border-primary/30 bg-primary/10 dark:bg-primary/6 shadow-[0_0_0_1px_oklch(0.62_0.22_260/0.15),0_0_12px_-3px_oklch(0.62_0.22_260/0.2)]",
      default:
        "border-border bg-surface-1 hover:border-border-hover hover:bg-surface-raised dark:border-white/5 dark:bg-white/3 dark:hover:border-white/20 dark:hover:bg-white/8",
    },
    badges: {
      selected:
        "text-[10px] text-primary-foreground bg-primary px-1.5 py-0.5 rounded-sm font-medium",
      downloaded: "text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded-sm font-medium",
      recommended: "text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-medium",
    },
    buttons: {
      download: "",
      select:
        "border-border text-foreground hover:bg-surface-raised dark:border-white/10 dark:hover:bg-white/8",
      delete:
        "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh:
        "border-border text-foreground hover:bg-surface-raised dark:border-white/10 dark:hover:bg-white/8",
    },
  },
};

export function getModelPickerStyles(colorScheme: ColorScheme): ModelPickerStyles {
  return MODEL_PICKER_COLORS[colorScheme];
}
