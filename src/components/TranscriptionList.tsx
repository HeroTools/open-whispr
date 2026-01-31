import { useState, useMemo } from "react";
import { Copy, Trash2, Mic } from "lucide-react";
import { Button } from "./ui/button";
import type { TranscriptionItemGrouped } from "../types/electron";

interface TranscriptionListProps {
  transcriptions: TranscriptionItemGrouped[];
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
  hotkey?: string;
}

interface GroupedTranscriptions {
  label: string;
  date: string;
  items: TranscriptionItemGrouped[];
}

function getDateLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Parse the date string (YYYY-MM-DD format from SQLite)
  const date = new Date(dateStr + "T00:00:00");

  if (date.getTime() === today.getTime()) {
    return "TODAY";
  }
  if (date.getTime() === yesterday.getTime()) {
    return "YESTERDAY";
  }

  // Format as "Jan 30" for older dates
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  }).toUpperCase();
}

function formatTime(timestamp: string): string {
  const timestampSource = timestamp.endsWith("Z") ? timestamp : `${timestamp}Z`;
  const date = new Date(timestampSource);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TranscriptionList({
  transcriptions,
  onCopy,
  onDelete,
  isLoading = false,
  hotkey = "F8",
}: TranscriptionListProps) {
  const grouped = useMemo((): GroupedTranscriptions[] => {
    const groups: Map<string, TranscriptionItemGrouped[]> = new Map();

    for (const item of transcriptions) {
      const day = item.day;
      if (!groups.has(day)) {
        groups.set(day, []);
      }
      groups.get(day)!.push(item);
    }

    return Array.from(groups.entries()).map(([date, items]) => ({
      label: getDateLabel(date),
      date,
      items,
    }));
  }, [transcriptions]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="w-8 h-8 mx-auto mb-3 bg-indigo-600 rounded-lg flex items-center justify-center animate-pulse">
          <span className="text-white text-sm">...</span>
        </div>
        <p className="text-gray-500">Loading transcriptions...</p>
      </div>
    );
  }

  if (transcriptions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
          <Mic className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No transcriptions yet</h3>
        <p className="text-gray-600 mb-4 max-w-sm mx-auto">
          Press your hotkey to start recording and create your first transcription.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-w-md mx-auto">
          <h4 className="font-medium text-gray-800 mb-2">Quick Start:</h4>
          <ol className="text-sm text-gray-600 text-left space-y-1">
            <li>1. Click in any text field</li>
            <li>
              2. Press{" "}
              <kbd className="bg-white px-2 py-1 rounded text-xs font-mono border border-gray-300">
                {hotkey}
              </kbd>{" "}
              to start recording
            </li>
            <li>3. Speak your text</li>
            <li>
              4. Press{" "}
              <kbd className="bg-white px-2 py-1 rounded text-xs font-mono border border-gray-300">
                {hotkey}
              </kbd>{" "}
              again to stop
            </li>
            <li>5. Your text will appear automatically!</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.date}>
          {/* Date header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 mb-3">
            <h3 className="text-xs font-semibold text-gray-500 tracking-wide">
              {group.label}
            </h3>
          </div>

          {/* Transcription items */}
          <div className="space-y-2">
            {group.items.map((item) => (
              <TranscriptionRow
                key={item.id}
                item={item}
                onCopy={onCopy}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TranscriptionRowProps {
  item: TranscriptionItemGrouped;
  onCopy: (text: string) => void;
  onDelete: (id: number) => void;
}

function TranscriptionRow({ item, onCopy, onDelete }: TranscriptionRowProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="group relative flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onCopy(item.text)}
    >
      {/* Time */}
      <span className="text-xs text-gray-400 w-20 flex-shrink-0 pt-0.5">
        {formatTime(item.timestamp)}
      </span>

      {/* Text */}
      <p className="flex-1 text-sm text-gray-700 leading-relaxed line-clamp-2">
        {item.text}
      </p>

      {/* Actions */}
      <div
        className={`flex gap-1 flex-shrink-0 transition-opacity ${
          isHovered ? "opacity-100" : "opacity-0"
        }`}
      >
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(item.text);
          }}
          className="h-7 w-7"
          title="Copy to clipboard"
        >
          <Copy size={14} />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
          title="Delete"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
