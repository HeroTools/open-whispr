import React from "react";
import { Button } from "./button";
import { Copy, Trash2 } from "lucide-react";
import type { TranscriptionItem as TranscriptionItemType } from "../../types/electron";

interface TranscriptionItemProps {
  item: TranscriptionItemType;
  index: number;
  total: number;
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
}

export default function TranscriptionItem({
  item,
  index,
  total,
  onCopy,
  onDelete,
}: TranscriptionItemProps) {
  const timestampSource = item.timestamp.endsWith("Z") ? item.timestamp : `${item.timestamp}Z`;
  const timestampDate = new Date(timestampSource);
  const formattedTimestamp = Number.isNaN(timestampDate.getTime())
    ? item.timestamp
    : timestampDate.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

  return (
    <div className="relative bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
      <div className="p-6 pl-16" style={{ paddingTop: "8px" }}>
        <div className="flex items-start justify-between">
          <div className="flex-1 mr-3">
            <div
              className="flex items-center gap-2 mb-1"
              style={{ marginTop: "2px", lineHeight: "24px" }}
            >
              <span className="text-primary text-xs font-medium">#{total - index}</span>
              <div className="w-px h-3 bg-border" />
              <span className="text-xs text-muted-foreground">{formattedTimestamp}</span>
            </div>
            <p
              className="text-foreground text-sm"
              style={{
                lineHeight: "24px",
                textAlign: "left",
                marginTop: "2px",
                paddingBottom: "2px",
              }}
            >
              {item.text}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0" style={{ marginTop: "2px" }}>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onCopy(item.text)}
              className="h-7 w-7"
            >
              <Copy size={12} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(item.id)}
              className="h-7 w-7 text-destructive hover:text-destructive/90 hover:bg-destructive/10"
            >
              <Trash2 size={12} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
