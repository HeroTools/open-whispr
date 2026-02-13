import { useState } from "react";
import { useTranslation } from "react-i18next";
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

const TEXT_PREVIEW_LENGTH = 120;

export default function TranscriptionItem({
  item,
  index,
  total,
  onCopy,
  onDelete,
}: TranscriptionItemProps) {
  const { i18n, t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const timestampSource = item.timestamp.endsWith("Z") ? item.timestamp : `${item.timestamp}Z`;
  const timestampDate = new Date(timestampSource);
  const formattedTimestamp = Number.isNaN(timestampDate.getTime())
    ? item.timestamp
    : timestampDate.toLocaleString(i18n.language, {
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
      className="group relative px-3 py-2.5 transition-colors duration-150 hover:bg-muted/30 dark:hover:bg-white/2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start gap-3">
        {/* Number badge - compact pill */}
        <div className="flex-shrink-0 mt-0.5">
          <span className="inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 rounded-sm bg-primary/10 dark:bg-primary/15 text-primary text-[10px] font-semibold tabular-nums">
            {total - index}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Text */}
          <p
            className={cn(
              "text-foreground text-[13px] leading-[1.5] break-words",
              !isExpanded && isLongText && "line-clamp-2"
            )}
          >
            {displayText}
          </p>

          {/* Metadata row */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formattedTimestamp}
            </span>
            {isLongText && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-0.5 text-[11px] text-primary/80 hover:text-primary transition-colors"
              >
                {isExpanded ? (
                  <>
                    <span>{t("common.less")}</span>
                    <ChevronUp size={12} />
                  </>
                ) : (
                  <>
                    <span>{t("common.more")}</span>
                    <ChevronDown size={12} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Actions - fade in on hover */}
        <div
          className={cn(
            "flex items-center gap-0.5 flex-shrink-0 transition-opacity duration-150",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onCopy(item.text)}
            className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-foreground/10"
          >
            <Copy size={12} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(item.id)}
            className="h-6 w-6 rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
