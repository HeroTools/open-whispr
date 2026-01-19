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

// All color schemes now use semantic tokens from the theme
// The "indigo" scheme uses the primary color (blue/purple)
// "purple" uses chart-3 (purple accent)
// "blue" uses a blue variant
export const MODEL_PICKER_COLORS: Record<ColorScheme, ModelPickerStyles> = {
  purple: {
    container: "border border-border rounded-xl overflow-hidden bg-card",
    progress: "bg-purple-100 dark:bg-purple-950/50 border-b border-purple-300 dark:border-purple-800",
    progressText: "text-foreground",
    progressBar: "bg-purple-200 dark:bg-purple-900/50",
    progressFill: "bg-gradient-to-r from-purple-500 to-purple-600",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-purple-500 dark:border-purple-500/50 bg-purple-50 dark:bg-purple-950/50",
      default: "border-border bg-card hover:border-muted-foreground/50",
    },
    badges: {
      selected: "text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded",
      recommended: "text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded",
    },
    buttons: {
      download: "bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white",
      select: "border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50",
      delete: "text-destructive hover:bg-destructive/10 border-destructive/30",
      refresh: "border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50",
    },
  },
  indigo: {
    container: "border border-border rounded-xl overflow-hidden bg-card",
    progress: "bg-primary/10 dark:bg-primary/20 border-b border-primary/30",
    progressText: "text-foreground",
    progressBar: "bg-primary/20 dark:bg-primary/30",
    progressFill: "bg-gradient-to-r from-primary to-primary/80",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-primary dark:border-primary/50 bg-primary/10 dark:bg-primary/20",
      default: "border-border bg-card hover:border-muted-foreground/50",
    },
    badges: {
      selected: "text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-0.5 rounded",
      recommended: "text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2 py-0.5 rounded",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/80 text-primary-foreground",
      select: "border-primary/30 text-primary hover:bg-primary/10",
      delete: "text-destructive hover:bg-destructive/10 border-destructive/30",
      refresh: "border-primary/30 text-primary hover:bg-primary/10",
    },
  },
  blue: {
    container: "bg-muted/50 rounded-lg overflow-hidden border border-border",
    progress: "bg-primary/10 dark:bg-primary/20 border-b border-primary/30",
    progressText: "text-foreground",
    progressBar: "bg-primary/20 dark:bg-primary/30",
    progressFill: "bg-gradient-to-r from-primary to-primary/80",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-primary dark:border-primary/50 bg-primary/10 dark:bg-primary/20",
      default: "border-border bg-card hover:border-muted-foreground/50",
    },
    badges: {
      selected: "text-xs text-primary bg-primary/10 dark:bg-primary/20 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-2 py-1 rounded",
      recommended: "text-xs bg-primary/10 text-primary px-2 py-1 rounded",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/80 text-primary-foreground",
      select: "border-border text-foreground hover:bg-muted",
      delete: "text-destructive hover:bg-destructive/10 border-destructive/30",
      refresh: "border-border text-foreground hover:bg-muted",
    },
  },
};

export function getModelPickerStyles(colorScheme: ColorScheme): ModelPickerStyles {
  return MODEL_PICKER_COLORS[colorScheme];
}
