import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Download, Loader2, FileText, Sparkles, AlignLeft } from "lucide-react";
import { MarkdownTextarea } from "../ui/MarkdownTextarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { cn } from "../lib/utils";
import type { NoteItem } from "../../types/electron";
import type { ActionProcessingState } from "../../hooks/useActionProcessing";
import ActionProcessingOverlay from "./ActionProcessingOverlay";
import DictationWidget from "./DictationWidget";

function formatNoteDate(dateStr: string): string {
  const source = dateStr.endsWith("Z") ? dateStr : `${dateStr}Z`;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "";
  const datePart = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} \u00b7 ${timePart}`;
}

export interface Enhancement {
  content: string;
  isStale: boolean;
  onChange: (content: string) => void;
}

interface NoteEditorProps {
  note: NoteItem;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  isSaving: boolean;
  isRecording: boolean;
  partialTranscript: string;
  finalTranscript: string | null;
  onFinalTranscriptConsumed: () => void;
  isProcessing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onExportNote?: (format: "md" | "txt") => void;
  enhancement?: Enhancement;
  actionPicker?: React.ReactNode;
  actionProcessingState?: ActionProcessingState;
  actionName?: string | null;
}

export default function NoteEditor({
  note,
  onTitleChange,
  onContentChange,
  isSaving,
  isRecording,
  isProcessing,
  partialTranscript,
  finalTranscript,
  onFinalTranscriptConsumed,
  onStartRecording,
  onStopRecording,
  onExportNote,
  enhancement,
  actionPicker,
  actionProcessingState,
  actionName,
}: NoteEditorProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<"raw" | "enhanced">("raw");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const prevNoteIdRef = useRef<number>(note.id);

  const cursorPosRef = useRef(0);
  const dictationRef = useRef<{ start: number; end: number } | null>(null);
  const isDictationUpdateRef = useRef(false);
  const prevRecordingRef = useRef(false);

  const segmentContainerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({ opacity: 0 });

  const updateSegmentIndicator = useCallback(() => {
    const container = segmentContainerRef.current;
    if (!container) return;

    const idx = viewMode === "raw" ? 0 : 1;

    const buttons = container.querySelectorAll<HTMLButtonElement>("[data-segment-button]");
    const btn = buttons[idx];
    if (!btn) return;

    const cr = container.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    setIndicatorStyle({
      width: br.width,
      height: br.height,
      transform: `translateX(${br.left - cr.left}px)`,
      opacity: 1,
    });
  }, [viewMode]);

  useEffect(() => {
    updateSegmentIndicator();
  }, [updateSegmentIndicator]);

  useEffect(() => {
    const observer = new ResizeObserver(() => updateSegmentIndicator());
    if (segmentContainerRef.current) observer.observe(segmentContainerRef.current);
    return () => observer.disconnect();
  }, [updateSegmentIndicator]);

  const prevProcessingStateRef = useRef(actionProcessingState);
  useEffect(() => {
    if (prevProcessingStateRef.current === "processing" && actionProcessingState === "success") {
      setViewMode("enhanced");
    }
    prevProcessingStateRef.current = actionProcessingState;
  }, [actionProcessingState]);

  useEffect(() => {
    if (note.id !== prevNoteIdRef.current) {
      prevNoteIdRef.current = note.id;
      setViewMode("raw");
      if (titleRef.current && titleRef.current.textContent !== note.title) {
        titleRef.current.textContent = note.title || "";
      }
      textareaRef.current?.focus();
    }
  }, [note.id]);

  useEffect(() => {
    if (titleRef.current && titleRef.current.textContent !== note.title) {
      titleRef.current.textContent = note.title || "";
    }
  }, [note.title]);

  const handleTitleInput = useCallback(() => {
    if (titleRef.current) {
      const text = titleRef.current.textContent || "";
      onTitleChange(text);
    }
  }, [onTitleChange]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      textareaRef.current?.focus();
    }
  }, []);

  const handleTitlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\n/g, " ");
    document.execCommand("insertText", false, text);
  }, []);

  useEffect(() => {
    if (isRecording && !prevRecordingRef.current) {
      dictationRef.current = { start: cursorPosRef.current, end: cursorPosRef.current };
      if (viewMode === "enhanced") setViewMode("raw");
    }
    if (!isRecording && prevRecordingRef.current) {
      dictationRef.current = null;
    }
    prevRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (!partialTranscript || !dictationRef.current) return;

    const { start, end } = dictationRef.current;
    const before = note.content.slice(0, start);
    const after = note.content.slice(end);
    const newContent = before + partialTranscript + after;

    dictationRef.current = { start, end: start + partialTranscript.length };
    isDictationUpdateRef.current = true;
    onContentChange(newContent);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const pos = start + partialTranscript.length;
        textareaRef.current.setSelectionRange(pos, pos);
        cursorPosRef.current = pos;
      }
    });
  }, [partialTranscript]); // note.content intentionally excluded

  useEffect(() => {
    if (finalTranscript == null) return;

    const range = dictationRef.current;
    if (!range) {
      const pos = cursorPosRef.current;
      const before = note.content.slice(0, pos);
      const after = note.content.slice(pos);
      const separator = before && !before.endsWith("\n") ? "\n" : "";
      const newContent = before + separator + finalTranscript + after;
      isDictationUpdateRef.current = true;
      onContentChange(newContent);
      onFinalTranscriptConsumed();
      return;
    }

    const { start, end } = range;
    const before = note.content.slice(0, start);
    const after = note.content.slice(end);
    const newContent = before + finalTranscript + after;

    const newEnd = start + finalTranscript.length;
    dictationRef.current = { start: newEnd, end: newEnd };

    isDictationUpdateRef.current = true;
    onContentChange(newContent);
    onFinalTranscriptConsumed();

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newEnd, newEnd);
        cursorPosRef.current = newEnd;
      }
    });
  }, [finalTranscript]); // note.content intentionally excluded

  const handleSelect = () => {
    if (textareaRef.current) {
      cursorPosRef.current = textareaRef.current.selectionStart;
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;

    if (isDictationUpdateRef.current) {
      isDictationUpdateRef.current = false;
      return;
    }

    if (dictationRef.current) {
      const delta = newValue.length - note.content.length;
      const editPos = e.target.selectionStart - delta;
      if (editPos <= dictationRef.current.start) {
        dictationRef.current.start += delta;
        dictationRef.current.end += delta;
      }
    }

    onContentChange(newValue);
    cursorPosRef.current = e.target.selectionStart;
  };

  const handleEnhancedChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      enhancement?.onChange(e.target.value);
    },
    [enhancement]
  );

  const wordCount = useMemo(() => {
    const trimmed = note.content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [note.content]);

  const noteDate = formatNoteDate(note.created_at);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-5 pt-4 pb-0">
        <div
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleTitleInput}
          onKeyDown={handleTitleKeyDown}
          onPaste={handleTitlePaste}
          data-placeholder={t("notes.editor.untitled")}
          className="text-base font-semibold text-foreground bg-transparent outline-none tracking-[-0.01em] empty:before:content-[attr(data-placeholder)] empty:before:text-foreground/15 empty:before:pointer-events-none"
          role="textbox"
          aria-label={t("notes.editor.noteTitle")}
        />
        <div className="flex items-center mt-1">
          <div className="flex items-center text-[10px] text-foreground/20 min-w-0">
            {noteDate && <span>{noteDate}</span>}
            {noteDate && (isSaving || wordCount > 0) && <span className="mx-1.5">&middot;</span>}
            <span className="tabular-nums flex items-center gap-1 shrink-0">
              {isSaving && <Loader2 size={8} className="animate-spin" />}
              {isSaving
                ? t("notes.editor.saving")
                : wordCount > 0
                  ? t("notes.editor.wordsCount", { count: wordCount })
                  : ""}
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {enhancement && (
              <div
                ref={segmentContainerRef}
                className="relative flex items-center shrink-0 rounded-md bg-foreground/3 dark:bg-white/3 p-0.5"
              >
                <div
                  className="absolute top-0.5 left-0 rounded bg-background dark:bg-surface-2 shadow-sm transition-[width,height,transform,opacity] duration-200 ease-out pointer-events-none"
                  style={indicatorStyle}
                />
                <button
                  data-segment-button
                  onClick={() => setViewMode("raw")}
                  className={cn(
                    "relative z-1 px-1.5 h-5 rounded text-[9px] font-medium transition-colors duration-150 flex items-center gap-1",
                    viewMode === "raw"
                      ? "text-foreground/60"
                      : "text-foreground/25 hover:text-foreground/40"
                  )}
                >
                  <AlignLeft size={10} />
                  {t("notes.editor.raw")}
                </button>
                <button
                  data-segment-button
                  onClick={() => setViewMode("enhanced")}
                  className={cn(
                    "relative z-1 px-1.5 h-5 rounded text-[9px] font-medium transition-colors duration-150 flex items-center gap-1",
                    viewMode === "enhanced"
                      ? "text-foreground/60"
                      : "text-foreground/25 hover:text-foreground/40"
                  )}
                >
                  <Sparkles size={9} />
                  {t("notes.editor.enhanced")}
                  {enhancement.isStale && (
                    <span
                      className="w-1 h-1 rounded-full bg-amber-400/60"
                      title={t("notes.editor.staleIndicator")}
                    />
                  )}
                </button>
              </div>
            )}
            {onExportNote && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="shrink-0 h-6 w-6 flex items-center justify-center rounded-md bg-foreground/3 dark:bg-white/3 text-foreground/25 hover:text-foreground/40 hover:bg-foreground/6 dark:hover:bg-white/6 transition-colors duration-150"
                    aria-label={t("notes.editor.export")}
                  >
                    <Download size={11} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={4}>
                  <DropdownMenuItem
                    onClick={() => onExportNote("md")}
                    className="text-[12px] gap-2"
                  >
                    <FileText size={13} className="text-foreground/40" />
                    {t("notes.editor.asMarkdown")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onExportNote("txt")}
                    className="text-[12px] gap-2"
                  >
                    <FileText size={13} className="text-foreground/40" />
                    {t("notes.editor.asPlainText")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 relative min-h-0">
        <div className="h-full overflow-y-auto">
          {viewMode === "enhanced" && enhancement ? (
            <MarkdownTextarea value={enhancement.content} onChange={handleEnhancedChange} />
          ) : (
            <MarkdownTextarea
              value={note.content}
              onChange={handleContentChange}
              onSelect={handleSelect}
              textareaRef={textareaRef}
              placeholder={t("notes.editor.startWriting")}
              disabled={actionProcessingState === "processing"}
            />
          )}
        </div>
        <ActionProcessingOverlay
          state={actionProcessingState ?? "idle"}
          actionName={actionName ?? null}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, transparent, var(--color-background))" }}
        />
        <DictationWidget
          isRecording={isRecording}
          isProcessing={isProcessing}
          onStart={onStartRecording}
          onStop={onStopRecording}
          actionPicker={actionPicker}
        />
      </div>
    </div>
  );
}
