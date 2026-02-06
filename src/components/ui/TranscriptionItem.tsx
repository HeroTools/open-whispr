import { useState } from "react";
import { Button } from "./button";
import { Copy, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { TranscriptionItem as TranscriptionItemType } from "../../types/electron";
import { cn } from "../lib/utils";

interface TranscriptionItemProps {
  item: TranscriptionItemType;
  index: number;
  total: number;
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
}

const TEXT_PREVIEW_LENGTH = 280;

export default function TranscriptionItem({
  item,
  index,
  total,
  onCopy,
  onDelete,
}: TranscriptionItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

  const isLongText = item.text.length > TEXT_PREVIEW_LENGTH;
  const displayText =
    isExpanded || !isLongText ? item.text : `${item.text.slice(0, TEXT_PREVIEW_LENGTH)}…`;

  return (
    <div
      className="group relative px-6 py-5 transition-all duration-300 hover:bg-primary/5"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-5">
        {/* Number badge - luxury pill with glow */}
        <div className="flex-shrink-0 mt-1">
          <span className="inline-flex items-center justify-center min-w-[40px] h-7 px-2.5 rounded-lg bg-primary/15 text-primary text-xs font-semibold tabular-nums shadow-[0_0_10px_rgba(112,255,186,0.15)]">
            {total - index}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Text */}
          <p
            className={cn(
              "text-foreground text-[15px] leading-relaxed break-words",
              !isExpanded && isLongText && "line-clamp-3"
            )}
          >
            {displayText}
          </p>

          {/* Metadata row */}
          <div className="flex items-center gap-3 mt-2.5">
            <span className="text-xs text-muted-foreground tabular-nums">
              {formattedTimestamp}
            </span>
            {isLongText && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary transition-colors duration-200"
              >
                {isExpanded ? (
                  <>
                    <span>Show Less</span>
                    <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    <span>Show More</span>
                    <ChevronDown size={14} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Actions - fade in on hover with scale */}
        <div
          className={cn(
            "flex items-center gap-1 flex-shrink-0 transition-all duration-300",
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onCopy(item.text)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all duration-200"
          >
            <Copy size={14} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
