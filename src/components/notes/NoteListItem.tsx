import { Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../lib/utils";
import type { NoteItem } from "../../types/electron";

interface NoteListItemProps {
  note: NoteItem;
  isActive: boolean;
  onClick: () => void;
  onDelete: (id: number) => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/[*_~`]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/>\s+/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

function relativeTime(dateStr: string): string {
  const source = dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return dateStr;

  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function NoteListItem({ note, isActive, onClick, onDelete }: NoteListItemProps) {
  const preview = stripMarkdown(note.content);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={cn(
        "group relative px-3 py-2 cursor-pointer transition-all duration-150",
        isActive ? "bg-primary/6 dark:bg-primary/8" : "hover:bg-foreground/3 dark:hover:bg-white/3"
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-primary" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-[12px] truncate transition-colors duration-150",
              isActive ? "text-foreground font-medium" : "text-foreground/80"
            )}
          >
            {note.title || "Untitled"}
          </p>
          <div className="flex items-center gap-0.5 shrink-0">
            <span className="text-[9px] text-muted-foreground/30 tabular-nums group-hover:opacity-0 transition-opacity">
              {relativeTime(note.updated_at)}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
              className="h-5 w-5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={10} />
            </Button>
          </div>
        </div>
        {preview && (
          <p className="text-[10px] text-muted-foreground/40 line-clamp-1 mt-0.5">{preview}</p>
        )}
      </div>
    </div>
  );
}
