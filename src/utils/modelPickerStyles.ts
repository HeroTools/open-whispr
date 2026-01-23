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
    container: "border border-border rounded-xl overflow-hidden",
    progress: "bg-primary/10 dark:bg-primary/20 border-b border-primary/30",
    progressText: "text-primary",
    progressBar: "bg-primary/20",
    progressFill: "bg-primary",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-primary bg-primary/10 dark:bg-primary/20",
      default: "border-border bg-card hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/20 px-2 py-0.5 rounded",
      recommended: "text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/90",
      select: "border-primary/30 text-primary hover:bg-primary/10",
      delete: "text-destructive hover:text-destructive/90 hover:bg-destructive/10 border-destructive/30",
      refresh: "border-primary/30 text-primary hover:bg-primary/10",
    },
  },
  indigo: {
    container: "border border-border rounded-xl overflow-hidden",
    progress: "bg-primary/10 dark:bg-primary/20 border-b border-primary/30",
    progressText: "text-primary",
    progressBar: "bg-primary/20",
    progressFill: "bg-primary",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-primary bg-primary/10 dark:bg-primary/20",
      default: "border-border bg-card hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/20 px-2 py-0.5 rounded",
      recommended: "text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/90",
      select: "border-primary/30 text-primary hover:bg-primary/10",
      delete: "text-destructive hover:text-destructive/90 hover:bg-destructive/10 border-destructive/30",
      refresh: "border-primary/30 text-primary hover:bg-primary/10",
    },
  },
  blue: {
    container: "bg-muted/30 rounded-lg overflow-hidden border border-border",
    progress: "bg-primary/10 dark:bg-primary/20 border-b border-primary/30",
    progressText: "text-primary",
    progressBar: "bg-primary/20",
    progressFill: "bg-primary",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-primary bg-primary/10 dark:bg-primary/20",
      default: "border-border bg-card hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/20 px-2 py-1 rounded",
      recommended: "text-xs bg-primary/10 dark:bg-primary/20 text-primary px-2 py-1 rounded",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/90",
      select: "border-border text-foreground hover:bg-muted",
      delete: "text-destructive hover:text-destructive/90 hover:bg-destructive/10 border-destructive/30",
      refresh: "border-border text-foreground hover:bg-muted",
    },
  },
};

export function getModelPickerStyles(colorScheme: ColorScheme): ModelPickerStyles {
  return MODEL_PICKER_COLORS[colorScheme];
}
