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
  return (
    <div className="group relative overflow-hidden rounded-lg border border-neutral-200 bg-white p-4 transition-all hover:border-neutral-300 hover:shadow-sm">
      {/* Foreground overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-white/40 via-transparent to-neutral-50/30" />

      {/* Content - with relative positioning to appear above foreground */}
      <div className="relative">
        {/* Header com número e timestamp */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-neutral-100 text-[10px] font-semibold text-neutral-600">
              {total - index}
            </span>
            <span className="text-xs font-medium text-neutral-500">
              {new Date(item.timestamp).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Ações - visíveis no hover ou sempre em mobile */}
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onCopy(item.text)}
              className="h-7 w-7 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              title="Copy to clipboard"
            >
              <Copy size={14} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDelete(item.id)}
              className="h-7 w-7 text-neutral-400 hover:bg-error-50 hover:text-error-600"
              title="Delete transcription"
            >
              <Trash2 size={14} />
            </Button>
          </div>
        </div>

        {/* Texto da transcrição */}
        <p className="text-sm leading-relaxed text-neutral-700">
          {item.text}
        </p>
      </div>
    </div>
  );
}
