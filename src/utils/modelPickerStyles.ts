export type ColorScheme = "purple" | "indigo" | "blue";

export interface ModelPickerStyles {
  container: string;
  progress: string;
  progressText: string;
  progressBar: string;
  progressFill: string;
  header: string;
  modelCard: { selected: string; default: string };
  badges: { selected: string; downloaded: string; recommended: string };
  buttons: { download: string; select: string; delete: string; refresh: string };
}

export const MODEL_PICKER_COLORS: Record<ColorScheme, ModelPickerStyles> = {
  purple: {
    container: "border border-border rounded-xl overflow-hidden dark:border-[oklch(0.22_0.005_270)] dark:bg-[oklch(0.13_0.006_270)]",
    progress: "bg-primary/8 dark:bg-[oklch(0.12_0.008_270)] border-b border-primary/15",
    progressText: "text-primary",
    progressBar: "bg-primary/15 dark:bg-[oklch(0.10_0.005_270)] rounded-full",
    progressFill: "bg-primary",
    header: "font-medium text-foreground tracking-tight",
    modelCard: {
      selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
      default: "border-border bg-card dark:bg-[oklch(0.145_0.007_270)] dark:border-[oklch(0.22_0.005_270)] dark:hover:border-[oklch(0.30_0.012_250)] hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full font-medium",
      downloaded: "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/12 px-2 py-0.5 rounded-full",
      recommended: "text-xs text-primary bg-primary/10 dark:bg-primary/12 px-2 py-0.5 rounded-full",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/85 text-primary-foreground",
      select: "border-primary/25 text-primary hover:bg-primary/8",
      delete: "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh: "border-primary/25 text-primary hover:bg-primary/8",
    },
  },
  indigo: {
    container: "border border-border rounded-xl overflow-hidden dark:border-[oklch(0.22_0.005_270)] dark:bg-[oklch(0.13_0.006_270)]",
    progress: "bg-primary/8 dark:bg-[oklch(0.12_0.008_270)] border-b border-primary/15",
    progressText: "text-primary",
    progressBar: "bg-primary/15 dark:bg-[oklch(0.10_0.005_270)] rounded-full",
    progressFill: "bg-primary",
    header: "font-medium text-foreground tracking-tight",
    modelCard: {
      selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
      default: "border-border bg-card dark:bg-[oklch(0.145_0.007_270)] dark:border-[oklch(0.22_0.005_270)] dark:hover:border-[oklch(0.30_0.012_250)] hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full font-medium",
      downloaded: "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/12 px-2 py-0.5 rounded-full",
      recommended: "text-xs text-primary bg-primary/10 dark:bg-primary/12 px-2 py-0.5 rounded-full",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/85 text-primary-foreground",
      select: "border-primary/25 text-primary hover:bg-primary/8",
      delete: "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh: "border-primary/25 text-primary hover:bg-primary/8",
    },
  },
  blue: {
    container: "bg-muted/30 rounded-xl overflow-hidden border border-border dark:border-[oklch(0.22_0.005_270)] dark:bg-[oklch(0.13_0.006_270)]",
    progress: "bg-primary/8 dark:bg-[oklch(0.12_0.008_270)] border-b border-primary/15",
    progressText: "text-primary",
    progressBar: "bg-primary/15 dark:bg-[oklch(0.10_0.005_270)] rounded-full",
    progressFill: "bg-primary",
    header: "font-medium text-foreground tracking-tight",
    modelCard: {
      selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
      default: "border-border bg-card dark:bg-[oklch(0.145_0.007_270)] dark:border-[oklch(0.22_0.005_270)] dark:hover:border-[oklch(0.30_0.012_250)] hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full font-medium",
      downloaded: "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/12 px-2 py-0.5 rounded-full",
      recommended: "text-xs bg-primary/10 dark:bg-primary/12 text-primary px-2 py-0.5 rounded-full",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/85 text-primary-foreground",
      select: "border-border text-foreground hover:bg-muted dark:hover:bg-[oklch(0.20_0.012_270)]",
      delete: "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh: "border-border text-foreground hover:bg-muted",
    },
  },
};

export function getModelPickerStyles(colorScheme: ColorScheme): ModelPickerStyles {
  return MODEL_PICKER_COLORS[colorScheme];
}
