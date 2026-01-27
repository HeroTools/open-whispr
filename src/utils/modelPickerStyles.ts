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
      "border border-border rounded-xl overflow-hidden dark:border-border dark:bg-surface-1",
    header: "font-medium text-foreground tracking-tight",
    modelCard: {
      selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
      default:
        "border-border bg-card dark:bg-card dark:border-border dark:hover:border-border-hover hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full font-medium",
      downloaded:
        "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/12 px-2 py-0.5 rounded-full",
      recommended: "text-xs text-primary bg-primary/10 dark:bg-primary/12 px-2 py-0.5 rounded-full",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/85 text-primary-foreground",
      select: "border-primary/25 text-primary hover:bg-primary/8",
      delete:
        "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh: "border-primary/25 text-primary hover:bg-primary/8",
    },
  },
  indigo: {
    container:
      "border border-border rounded-xl overflow-hidden dark:border-border dark:bg-surface-1",
    header: "font-medium text-foreground tracking-tight",
    modelCard: {
      selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
      default:
        "border-border bg-card dark:bg-card dark:border-border dark:hover:border-border-hover hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full font-medium",
      downloaded:
        "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/12 px-2 py-0.5 rounded-full",
      recommended: "text-xs text-primary bg-primary/10 dark:bg-primary/12 px-2 py-0.5 rounded-full",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/85 text-primary-foreground",
      select: "border-primary/25 text-primary hover:bg-primary/8",
      delete:
        "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh: "border-primary/25 text-primary hover:bg-primary/8",
    },
  },
  blue: {
    container:
      "bg-muted/30 rounded-xl overflow-hidden border border-border dark:border-border dark:bg-surface-1",
    header: "font-medium text-foreground tracking-tight",
    modelCard: {
      selected: "border-primary/30 bg-primary/5 dark:bg-primary/6 dark:border-primary/25",
      default:
        "border-border bg-card dark:bg-card dark:border-border dark:hover:border-border-hover hover:border-muted-foreground/30",
    },
    badges: {
      selected: "text-xs text-primary-foreground bg-primary px-2 py-0.5 rounded-full font-medium",
      downloaded:
        "text-xs text-green-700 dark:text-green-400 bg-green-500/10 dark:bg-green-500/12 px-2 py-0.5 rounded-full",
      recommended: "text-xs bg-primary/10 dark:bg-primary/12 text-primary px-2 py-0.5 rounded-full",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/85 text-primary-foreground",
      select: "border-border text-foreground hover:bg-muted dark:hover:bg-surface-raised",
      delete:
        "text-destructive hover:text-destructive/90 hover:bg-destructive/8 border-destructive/25",
      refresh: "border-border text-foreground hover:bg-muted",
    },
  },
};

export function getModelPickerStyles(colorScheme: ColorScheme): ModelPickerStyles {
  return MODEL_PICKER_COLORS[colorScheme];
}
