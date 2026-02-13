import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Eye, Pencil, Loader2, Sparkles, Download, FileText } from "lucide-react";
import { MarkdownRenderer } from "../ui/MarkdownRenderer";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu";
import { cn } from "../lib/utils";
import type { NoteItem } from "../../types/electron";

interface NoteEditorProps {
  note: NoteItem;
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  isSaving: boolean;
  isRecording: boolean;
  partialTranscript: string;
  finalTranscript: string | null;
  onFinalTranscriptConsumed: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onOpenEnhance?: () => void;
  onExportNote?: (format: "md" | "txt") => void;
  hasEnhancedContent?: boolean;
  enhancedContent?: string | null;
  isEnhancementStale?: boolean;
}

export default function NoteEditor({
  note,
  onTitleChange,
  onContentChange,
  isSaving,
  isRecording,
  partialTranscript,
  finalTranscript,
  onFinalTranscriptConsumed,
  onStartRecording,
  onStopRecording,
  onOpenEnhance,
  onExportNote,
  hasEnhancedContent,
  enhancedContent,
  isEnhancementStale,
}: NoteEditorProps) {
  const { t } = useTranslation();
  const [isPreview, setIsPreview] = useState(false);
  const [viewMode, setViewMode] = useState<"raw" | "enhanced">("raw");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const prevNoteIdRef = useRef<number>(note.id);

  const cursorPosRef = useRef(0);
  const dictationRef = useRef<{ start: number; end: number } | null>(null);
  const isDictationUpdateRef = useRef(false);
  const prevRecordingRef = useRef(false);

  useEffect(() => {
    if (note.id !== prevNoteIdRef.current) {
      prevNoteIdRef.current = note.id;
      setIsPreview(false);
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

  const wordCount = useMemo(() => {
    const trimmed = note.content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [note.content]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-4 pb-0">
        <div
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleTitleInput}
          onKeyDown={handleTitleKeyDown}
          onPaste={handleTitlePaste}
          data-placeholder={t("notes.editor.untitled")}
          className="w-full text-base font-semibold text-foreground bg-transparent outline-none tracking-[-0.01em] empty:before:content-[attr(data-placeholder)] empty:before:text-foreground/15 empty:before:pointer-events-none"
          role="textbox"
          aria-label={t("notes.editor.noteTitle")}
        />
      </div>

      <div className="flex items-center gap-px px-5 py-1.5">
        <button
          onClick={isRecording ? onStopRecording : onStartRecording}
          className={cn(
            "flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-medium transition-all duration-200",
            isRecording
              ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
              : "text-muted-foreground/40 hover:text-foreground/60 hover:bg-foreground/4"
          )}
        >
          {isRecording ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-destructive/60 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
              </span>
              {t("notes.editor.stop")}
            </>
          ) : (
            <>
              <Mic size={11} />
              {t("notes.editor.dictate")}
            </>
          )}
        </button>

        {viewMode !== "enhanced" && (
          <button
            onClick={() => setIsPreview(!isPreview)}
            className={cn(
              "flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-medium transition-all duration-200",
              isPreview
                ? "bg-foreground/6 text-foreground/60"
                : "text-muted-foreground/40 hover:text-foreground/60 hover:bg-foreground/4"
            )}
          >
            {isPreview ? <Pencil size={10} /> : <Eye size={10} />}
            {isPreview ? t("notes.editor.edit") : t("notes.editor.preview")}
          </button>
        )}

        {onOpenEnhance && (
          <button
            onClick={onOpenEnhance}
            className="flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-medium text-muted-foreground/40 hover:text-foreground/60 hover:bg-foreground/4 transition-all duration-150"
          >
            <Sparkles size={10} />
            {isEnhancementStale ? t("notes.editor.reEnhance") : t("notes.editor.enhance")}
          </button>
        )}

        {onExportNote && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-medium text-muted-foreground/40 hover:text-foreground/60 hover:bg-foreground/4 transition-all duration-150">
                <Download size={10} />
                {t("notes.editor.export")}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={4}>
              <DropdownMenuItem onClick={() => onExportNote("md")} className="text-[12px] gap-2">
                <FileText size={13} className="text-foreground/40" />
                {t("notes.editor.asMarkdown")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExportNote("txt")} className="text-[12px] gap-2">
                <FileText size={13} className="text-foreground/40" />
                {t("notes.editor.asPlainText")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {hasEnhancedContent && (
          <div className="flex items-center rounded-md bg-foreground/3 dark:bg-white/3 p-0.5 ml-1">
            <button
              onClick={() => setViewMode("raw")}
              className={cn(
                "px-2 h-5 rounded text-[9px] font-medium transition-all duration-150",
                viewMode === "raw"
                  ? "bg-background dark:bg-surface-2 text-foreground/60 shadow-sm"
                  : "text-foreground/25 hover:text-foreground/40"
              )}
            >
              {t("notes.editor.raw")}
            </button>
            <button
              onClick={() => setViewMode("enhanced")}
              className={cn(
                "px-2 h-5 rounded text-[9px] font-medium transition-all duration-150 flex items-center gap-1",
                viewMode === "enhanced"
                  ? "bg-background dark:bg-surface-2 text-foreground/60 shadow-sm"
                  : "text-foreground/25 hover:text-foreground/40"
              )}
            >
              {t("notes.editor.enhanced")}
              {isEnhancementStale && <span className="w-1 h-1 rounded-full bg-amber-400/60" />}
            </button>
          </div>
        )}

        <div className="flex-1" />

        <span className="text-[9px] text-foreground/20 tabular-nums flex items-center gap-1.5">
          {isSaving && <Loader2 size={8} className="animate-spin" />}
          {isSaving
            ? t("notes.editor.saving")
            : wordCount > 0
              ? t("notes.editor.wordsCount", { count: wordCount })
              : ""}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {viewMode === "enhanced" && enhancedContent ? (
          <div className="px-5 py-3 text-[13px] text-foreground leading-relaxed">
            <MarkdownRenderer content={enhancedContent} />
          </div>
        ) : isPreview ? (
          <div className="px-5 py-3 text-[13px] text-foreground leading-relaxed">
            <MarkdownRenderer content={note.content} />
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={handleContentChange}
            onSelect={handleSelect}
            placeholder={t("notes.editor.startWriting")}
            className="w-full h-full px-5 py-3 text-[13px] text-foreground/90 bg-transparent! border-none! outline-none resize-none rounded-none leading-[1.7] placeholder:text-foreground/15"
            style={{ boxShadow: "none" }}
          />
        )}
      </div>
    </div>
  );
}
